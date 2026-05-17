/**
 * Sidebar JS v0.1.6
 *
 * Mới ở v0.1.6 (Phase 2):
 *   - Tab navigation: "Tạo nhận xét" / "Cache điểm"
 *   - Cache Monitor: stats + class list + per-class detail (HS × môn)
 *   - Auto-suggest NLPC preview cho 1 HS (dùng NLPCMapper)
 *   - Reset cache: toàn bộ + per-class
 *
 * Kế thừa v0.1.3:
 *   - Setting Thầy/Cô + sinh NX môn + apply về Vnedu + auto-Lưu
 */

(function () {
    'use strict';

    let engine = null;
    let currentModule = null;
    let currentContext = null;
    let currentStudents = [];
    let generatedNhanXet = new Map();
    let settings = {
        gvLa: 'co'
    };

    // v0.1.17: trạng thái license cache trong RAM (re-sync mỗi lần đổi)
    let licenseState = null;

    // Phase 2: Cache Monitor state
    let currentTab = 'nhanxet';      // 'nhanxet' | 'cache'
    let cacheStats = null;            // { totalClasses, totalStudents, totalScoreEntries, byClass }
    let selectedClass = null;         // tên lớp đang xem detail
    let selectedClassData = null;     // { lastUpdated, students:{...} }

    // v0.1.8 NLPC state — toàn bộ 13 trường đều AUTO suy từ điểm môn
    // GV override bằng click badge cycle T → Đ → C
    let nlpcStudents = [];           // [{stt, hoVaTen, isSelected}]
    let nlpcSelectedStt = null;      // stt HS đang chọn
    let nlpcUserSelectedAt = 0;      // BUG-002 fix: timestamp user chọn qua dropdown (chống auto-revert)
    let nlpcAutoSuggestions = null;  // NLPCMapper kết quả: { tu_chu_tu_hoc:{grade,badge,...}, ... }
    let nlpcOverrides = {};          // GV override: { tu_chu_tu_hoc: 'cht', ... } (overlay lên auto)
    let nlpcGenerated = null;        // payload sau khi tạo nhận xét text từ engine

    // V1.5: Định nghĩa các field NL/PC theo CT GDPT 2018 + TT27/2020.
    //   Lớp 1-2: 4 NL đặc thù (Ngôn ngữ, Tính toán, Thẩm mĩ, Thể chất).
    //   Lớp 3:   6 NL đặc thù (+ Công nghệ, Tin học).
    //   Lớp 4-5: 7 NL đặc thù (+ Khoa học).
    //   V1.5 thay đổi: Năng lực Khoa học chỉ áp dụng lớp 4-5 (bỏ cho lớp 1-3 vì
    //   chưa có môn Khoa học, chỉ có TNXH).
    // grade=null mặc định hiển thị ĐỦ (an toàn cho lớp 4-5, lớp dưới Vnedu thiếu ô sẽ skip).
    const NLPC_FIELD_DEFS = {
        nang_luc_chung: [
            { key: 'tu_chu_tu_hoc', label: 'Tự chủ và tự học' },
            { key: 'giao_tiep_hop_tac', label: 'Giao tiếp và hợp tác' },
            { key: 'giai_quyet_van_de', label: 'GQVĐ và sáng tạo' }
        ],
        nang_luc_dac_thu: [
            { key: 'ngon_ngu', label: 'Ngôn ngữ' },
            { key: 'tinh_toan', label: 'Tính toán' },
            { key: 'khoa_hoc', label: 'Khoa học', minGrade: 4 },
            { key: 'tham_mi', label: 'Thẩm mĩ' },
            { key: 'the_chat', label: 'Thể chất' },
            { key: 'cong_nghe', label: 'Công nghệ', minGrade: 3 },
            { key: 'tin_hoc', label: 'Tin học', minGrade: 3 }
        ],
        pham_chat: [
            { key: 'yeu_nuoc', label: 'Yêu nước' },
            { key: 'nhan_ai', label: 'Nhân ái' },
            { key: 'cham_chi', label: 'Chăm chỉ' },
            { key: 'trung_thuc', label: 'Trung thực' },
            { key: 'trach_nhiem', label: 'Trách nhiệm' }
        ]
    };

    /** BUG-006: Detect lớp 1-5 từ chuỗi như "3A", "Lớp 5C", "5C-Khối 5". Trả null nếu không nhận diện được. */
    function getGradeLevel(lop) {
        if (!lop) return null;
        const m = String(lop).match(/[1-5]/);
        return m ? parseInt(m[0]) : null;
    }

    /** BUG-006: Lọc field defs theo grade level. Field có minGrade=N chỉ hiển thị khi grade >= N.
     *  V.01 fix: KHÔNG detect được lớp → MẶC ĐỊNH HIỂN THỊ ĐỦ (an toàn cho lớp 3-5, lớp 1-2
     *  thừa 2 ô Vnedu không có → adapter sẽ skip, không gây lỗi). */
    function getActiveFieldDefs(sec) {
        const grade = getGradeLevel(currentContext?.lop);
        const defs = NLPC_FIELD_DEFS[sec] || [];
        return defs.filter(def => {
            if (def.minGrade == null) return true;
            if (grade == null) return true;  // ← default SHOW khi không xác định được lớp
            return grade >= def.minGrade;
        });
    }

    /** Lấy grade thực tế của 1 field: override (nếu GV đã click) hoặc suggestion auto */
    function getEffectiveGrade(fieldKey) {
        if (nlpcOverrides[fieldKey]) return nlpcOverrides[fieldKey];
        const sg = nlpcAutoSuggestions?.[fieldKey];
        return sg?.grade || 'ht';  // default Đ nếu thiếu
    }

    async function init() {
        await loadSettings();
        try {
            await loadEngineWithData();
        } catch (e) {
            console.error('[Sidebar] Lỗi load engine:', e);
        }
        bindEvents();
        applySettingsToUI();
        await refreshLicenseUI();
        scheduleLicenseRecheck();
        showView('empty');
        requestContextFromContentScript();
    }

    async function loadEngineWithData() {
        engine = new NhanXetEngineV2();
        engine.options.gvLa = settings.gvLa;

        try {
            const url = chrome.runtime.getURL('engine/data/nhanxet-ngan.json');
            const res = await fetch(url);
            const data = await res.json();
            engine.loadData(data);
            console.log('[Sidebar] Engine ready với', Object.keys(data.subjects).length, 'môn, gvLa =', settings.gvLa);
        } catch (e) {
            console.error('[Sidebar] Không load được data:', e);
            throw e;
        }
    }

    async function loadSettings() {
        try {
            const stored = await chrome.storage.local.get('settings');
            if (stored.settings) {
                settings = { ...settings, ...stored.settings };
            }
        } catch (e) {
            console.warn('[Sidebar] Không load được settings:', e);
        }
    }

    async function saveSettings() {
        try {
            await chrome.storage.local.set({ settings });
        } catch (e) {
            console.warn('[Sidebar] Không save được settings:', e);
        }
    }

    function applySettingsToUI() {
        document.querySelectorAll('#setting-gvLa button').forEach(b => {
            b.classList.toggle('active', b.dataset.value === settings.gvLa);
        });
    }

    function bindEvents() {
        document.getElementById('btn-close').onclick = () => {
            parent.postMessage({ type: 'COGIAO_CLOSE_SIDEBAR' }, '*');
        };

        document.getElementById('btn-rescan').onclick = () => {
            parent.postMessage({ type: 'COGIAO_RESCAN' }, '*');
            showToast('Đang quét lại dữ liệu Vnedu...');
        };
        document.getElementById('btn-settings').onclick = () => showView('settings');
        document.getElementById('btn-back').onclick = () => {
            if (currentModule === 'so-nhan-xet') showView('so-nhan-xet');
            else if (currentModule === 'nlpc') showView('nlpc');
            else showView('empty');
        };

        document.getElementById('btn-generate').onclick = generateAllNhanXet;
        document.getElementById('btn-apply').onclick = applyAllToVnedu;

        // V.05: 2 nút launcher mở module Vnedu
        document.getElementById('btn-launcher-mon').onclick = () => openVneduModule('so-diem');
        document.getElementById('btn-launcher-nlpc').onclick = () => openVneduModule('nlpc');

        document.querySelectorAll('#setting-gvLa button').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('#setting-gvLa button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                settings.gvLa = btn.dataset.value;
                if (engine) engine.options.gvLa = settings.gvLa;
                saveSettings();
                showToast(`Đã đổi xưng hô sang "${btn.textContent}"`);
            };
        });

        // Phase 2: Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => switchTab(btn.dataset.tab);
        });

        // Cache Monitor controls
        document.getElementById('cm-btn-clear-all').onclick = handleClearAllCache;
        document.getElementById('cm-btn-clear-class').onclick = handleClearSelectedClass;
        document.getElementById('cm-btn-close-detail').onclick = closeClassDetail;
        document.getElementById('cm-btn-suggest').onclick = openSuggestForFirstStudent;
        document.getElementById('sg-btn-close').onclick = () => switchTab('cache');

        // v0.1.7 NLPC controls
        document.getElementById('nlpc-student-select').onchange = (e) => {
            const stt = parseInt(e.target.value);
            if (!isNaN(stt)) selectNLPCStudent(stt);
        };
        document.getElementById('nlpc-btn-generate').onclick = generateNLPCText;
        document.getElementById('nlpc-btn-apply').onclick = applyNLPCToVnedu;

        // v0.1.18 License controls — luồng self-serve (đăng ký → CK → đăng nhập)
        const bind = (id, handler) => {
            const el = document.getElementById(id);
            if (el) el.onclick = handler;
        };
        bind('lic-btn-register', handleRegisterClick);
        bind('lic-btn-go-login', () => {
            // Chuyển từ pending → form login. renderLicenseSection sẽ tự prefill
            // SĐT + mã từ pending data nhờ licUiMode='login'.
            licUiMode = 'login';
            renderLicenseSection(licenseState);
            setTimeout(() => {
                const maIn = document.getElementById('lic-login-ma');
                if (maIn) maIn.focus();
            }, 100);
        });
        bind('lic-btn-cancel-pending', handleCancelPending);
        bind('lic-btn-login', handleLoginClick);
        bind('lic-btn-remove', handleRemoveLicense);
        bind('lic-link-to-login', (e) => {
            e.preventDefault();
            licUiMode = 'login';
            renderLicenseSection(licenseState);
        });
        bind('lic-link-to-register', (e) => {
            e.preventDefault();
            licUiMode = 'register';
            renderLicenseSection(licenseState);
        });

        bind('lock-btn-cancel', closeLockModal);
        bind('lock-btn-activate', () => {
            closeLockModal();
            showView('settings');
            // Cuộn xuống section bản quyền
            const box = document.getElementById('lic-status-box');
            if (box) setTimeout(() => box.scrollIntoView({ behavior: 'smooth' }), 100);
        });

        // QR image error handler — fallback hiện thông báo khi chưa có file qr.png.
        // Bắt bằng addEventListener (KHÔNG dùng inline onerror — vi phạm CSP của Chrome MV3).
        const qrImg = document.getElementById('lic-qr-img');
        if (qrImg) {
            qrImg.addEventListener('error', () => {
                qrImg.style.display = 'none';
                const fb = document.getElementById('lic-qr-fallback');
                if (fb) fb.style.display = 'block';
            });
            qrImg.addEventListener('load', () => {
                qrImg.style.display = '';
                const fb = document.getElementById('lic-qr-fallback');
                if (fb) fb.style.display = 'none';
            });
        }
    }

    /* ====================================================================
     * Phase 2: Tab switching
     * ================================================================== */
    function switchTab(tabName) {
        currentTab = tabName;
        document.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tab === tabName);
        });

        // Tab "Cache" → ẩn rescan bar (không cần), show view-cache
        const rescanBar = document.getElementById('rescan-bar');
        const applyBar = document.getElementById('apply-bar');

        if (tabName === 'cache') {
            rescanBar.style.display = 'none';
            applyBar.classList.add('view-hidden');
            showView('cache');
            requestCacheStats();
        } else {
            // Tab "nhanxet" — phục hồi UI mặc định theo currentModule
            rescanBar.style.display = '';
            if (currentModule === 'so-nhan-xet') showView('so-nhan-xet');
            else if (currentModule === 'nlpc') showView('nlpc');
            else showView('empty');
        }
    }

    /* ====================================================================
     * Phase 2: Cache Monitor — request + render stats
     * ================================================================== */
    function requestCacheStats() {
        parent.postMessage({ type: 'COGIAO_REQUEST_CACHE_STATS' }, '*');
    }

    function renderCacheStats(stats) {
        cacheStats = stats || { totalClasses: 0, totalStudents: 0, totalScoreEntries: 0, byClass: {} };

        document.getElementById('cm-stat-classes').textContent = cacheStats.totalClasses;
        document.getElementById('cm-stat-students').textContent = cacheStats.totalStudents;
        document.getElementById('cm-stat-scores').textContent = cacheStats.totalScoreEntries;

        const list = document.getElementById('cm-class-list');
        const classes = Object.entries(cacheStats.byClass || {});

        if (classes.length === 0) {
            list.innerHTML = '<div class="cm-empty">Chưa có lớp nào trong cache. Hãy mở Sổ NX môn trên Vnedu — điểm sẽ tự lưu.</div>';
            return;
        }

        list.innerHTML = classes.map(([cls, info]) => {
            const updated = info.lastUpdated ? formatRelativeTime(info.lastUpdated) : '';
            return `
                <div class="cm-class-item ${cls === selectedClass ? 'active' : ''}" data-class="${escapeHtml(cls)}">
                    <div>
                        <div class="cm-class-name">Lớp ${escapeHtml(cls)}</div>
                        <div class="cm-class-meta">${info.students} HS · ${info.scores} điểm</div>
                    </div>
                    <div class="cm-class-meta">${updated}</div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.cm-class-item').forEach(el => {
            el.onclick = () => openClassDetail(el.dataset.class);
        });
    }

    function formatRelativeTime(iso) {
        try {
            const dt = new Date(iso);
            const diffMs = Date.now() - dt.getTime();
            const diffMin = Math.floor(diffMs / 60000);
            if (diffMin < 1) return 'vừa xong';
            if (diffMin < 60) return diffMin + ' phút trước';
            const diffH = Math.floor(diffMin / 60);
            if (diffH < 24) return diffH + ' giờ trước';
            const diffD = Math.floor(diffH / 24);
            return diffD + ' ngày trước';
        } catch (e) { return ''; }
    }

    /* ====================================================================
     * Phase 2: Class detail (HS × môn)
     * ================================================================== */
    async function openClassDetail(className) {
        try {
            selectedClass = className;
            selectedClassData = await CacheManager.getClassCache(className);
            renderCacheStats(cacheStats);

            const detailSec = document.getElementById('cm-detail-section');
            detailSec.style.display = 'block';
            document.getElementById('cm-detail-class').textContent = className;

            renderClassDetailTable(selectedClassData);
        } catch (e) {
            console.error('[Sidebar] openClassDetail lỗi:', e);
            showToast('Lỗi đọc cache: ' + e.message);
        }
    }

    function closeClassDetail() {
        selectedClass = null;
        selectedClassData = null;
        document.getElementById('cm-detail-section').style.display = 'none';
        renderCacheStats(cacheStats);
    }

    function renderClassDetailTable(classData) {
        const table = document.getElementById('cm-detail-table');
        if (!classData || !classData.students || Object.keys(classData.students).length === 0) {
            table.innerHTML = '<tr><td>Chưa có HS nào trong lớp này</td></tr>';
            return;
        }

        // Lấy danh sách subject xuất hiện trong lớp (subset của VALID_SUBJECTS)
        const subjectsInUse = new Set();
        Object.values(classData.students).forEach(s => {
            Object.keys(s.diem || {}).forEach(k => subjectsInUse.add(k));
        });
        // Sắp theo thứ tự VALID_SUBJECTS để cột ổn định
        const subjects = CacheManager.VALID_SUBJECTS.filter(k => subjectsInUse.has(k));

        const headers = ['<th>Họ tên</th>', ...subjects.map(s => `<th title="${s}">${shortSubject(s)}</th>`)];
        const rows = Object.entries(classData.students).map(([name, s]) => {
            const cells = subjects.map(subj => {
                const val = s.diem[subj];
                if (val === null || val === undefined) {
                    return '<td class="no-score">—</td>';
                }
                return `<td class="has-score">${val}</td>`;
            });
            return `<tr><td>${escapeHtml(name)}</td>${cells.join('')}</tr>`;
        });

        table.innerHTML = `<thead><tr>${headers.join('')}</tr></thead><tbody>${rows.join('')}</tbody>`;
    }

    function shortSubject(key) {
        const map = {
            'tieng-viet': 'TV', 'toan': 'Toán', 'tnxh': 'TNXH', 'khoa-hoc': 'KH',
            'lich-su-dia': 'LSĐL', 'dao-duc': 'ĐĐ', 'tin-hoc': 'Tin', 'cong-nghe': 'CN',
            'tieng-anh': 'TA', 'gd-the-chap': 'GDTC', 'am-nhac': 'ÂN', 'mi-thuat': 'MT',
            'htn': 'HĐTN', 'diem-tb': 'TB'
        };
        return map[key] || key;
    }

    /* ====================================================================
     * Phase 2/3: Auto-suggest NLPC preview cho 1 HS
     * ================================================================== */
    async function openSuggestForFirstStudent() {
        if (!selectedClass || !selectedClassData) {
            showToast('Hãy chọn lớp trước');
            return;
        }
        const names = Object.keys(selectedClassData.students || {});
        if (names.length === 0) {
            showToast('Lớp này chưa có HS nào');
            return;
        }
        await openSuggestForStudent(selectedClass, names[0]);
    }

    async function openSuggestForStudent(className, studentName) {
        try {
            const result = await NLPCMapper.autoSuggestForStudent(className, studentName);
            renderSuggestView(result);
            showView('suggest');
        } catch (e) {
            console.error('[Sidebar] openSuggest lỗi:', e);
            showToast('Lỗi: ' + e.message);
        }
    }

    function renderSuggestView({ className, studentId, found, diem, suggestions, lastSynced }) {
        document.getElementById('sg-student-name').textContent = studentId;

        const ctxEl = document.getElementById('sg-context');
        if (!found) {
            ctxEl.innerHTML = `<strong>Lớp ${escapeHtml(className)} · ${escapeHtml(studentId)}</strong><br>
                Chưa có dữ liệu trong cache. Hãy mở Sổ NX môn trên Vnedu trước.`;
        } else {
            const subjectCount = Object.values(diem).filter(v => v !== null).length;
            ctxEl.innerHTML = `<strong>Lớp ${escapeHtml(className)} · ${escapeHtml(studentId)}</strong><br>
                Đã có điểm ${subjectCount} môn · Cập nhật ${formatRelativeTime(lastSynced)}`;
        }

        const fieldsEl = document.getElementById('sg-fields');
        fieldsEl.innerHTML = Object.entries(suggestions).map(([key, sg]) => {
            const badgeClass = sg.grade || 'none';
            return `
                <div class="sg-field">
                    <div class="sg-field-header">
                        <span class="sg-field-label">${escapeHtml(sg.label)}</span>
                        <span class="sg-field-badge ${badgeClass}">${sg.badge}</span>
                    </div>
                    <div class="sg-field-hint">${escapeHtml(sg.hint)}</div>
                </div>
            `;
        }).join('');
    }

    /* ====================================================================
     * Phase 2: Reset handlers
     * ================================================================== */
    function handleClearAllCache() {
        if (!confirm('Xóa TOÀN BỘ cache điểm? Thao tác không hoàn tác được.\n(Dữ liệu trên Vnedu KHÔNG bị ảnh hưởng.)')) return;
        parent.postMessage({ type: 'COGIAO_CLEAR_CACHE', payload: {} }, '*');
        selectedClass = null;
        selectedClassData = null;
        document.getElementById('cm-detail-section').style.display = 'none';
        showToast('Đã xóa toàn bộ cache');
    }

    function handleClearSelectedClass() {
        if (!selectedClass) return;
        if (!confirm(`Xóa cache lớp ${selectedClass}? Các lớp khác vẫn giữ.`)) return;
        parent.postMessage({ type: 'COGIAO_CLEAR_CACHE', payload: { className: selectedClass } }, '*');
        showToast(`Đã xóa cache lớp ${selectedClass}`);
        closeClassDetail();
    }

    /**
     * V.05 Launcher: gửi message yêu cầu content-script điều hướng Vnedu Start menu
     * tới module tương ứng. module = 'so-diem' (Nhập sổ điểm) hoặc 'nlpc' (Phẩm chất - Năng lực).
     */
    function openVneduModule(module) {
        const btnId = module === 'so-diem' ? 'btn-launcher-mon' : 'btn-launcher-nlpc';
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.disabled = true;
            const originalLabel = btn.querySelector('.btn-launcher-label').textContent;
            btn.querySelector('.btn-launcher-label').textContent = 'Đang mở...';
            setTimeout(() => {
                btn.disabled = false;
                btn.querySelector('.btn-launcher-label').textContent = originalLabel;
            }, 2500);
        }
        parent.postMessage({ type: 'COGIAO_OPEN_VNEDU_MODULE', payload: { module } }, '*');
        showToast('Đang mở module Vnedu...');
    }

    function showToast(msg) {
        let toast = document.getElementById('sidebar-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'sidebar-toast';
            toast.style.cssText = 'position:fixed;bottom:50px;left:50%;transform:translateX(-50%);background:#2C2C2A;color:white;padding:8px 16px;border-radius:6px;font-size:12px;z-index:9999;';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.display = 'block';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 2000);
    }

    window.addEventListener('message', (e) => {
        const { type, payload } = e.data || {};
        if (!type) return;

        if (type === 'VNEDU_CONTEXT') {
            handleContextUpdate(payload);
        }
        if (type === 'COGIAO_APPLY_RESULT') {
            handleApplyResult(payload);
        }
        if (type === 'COGIAO_AUTO_SAVE_RESULT') {
            handleAutoSaveResult(payload);
        }
        // Phase 2: cache events từ content-script
        if (type === 'COGIAO_CACHE_STATS') {
            renderCacheStats(payload);
        }
        if (type === 'COGIAO_CACHE_UPDATED') {
            // Auto-refresh stats nếu đang ở tab cache
            if (currentTab === 'cache') {
                requestCacheStats();
                if (selectedClass === payload.className) {
                    openClassDetail(selectedClass);
                }
            }
        }
        // v0.1.7 NLPC events
        if (type === 'COGIAO_NLPC_STUDENT_SELECTED') {
            // Sau khi click chọn HS trong Vnedu, request rescan để load form đúng HS
            parent.postMessage({ type: 'COGIAO_RESCAN' }, '*');
        }
        if (type === 'COGIAO_NLPC_APPLY_RESULT') {
            handleNLPCApplyResult(payload);
        }
        if (type === 'COGIAO_OPEN_VNEDU_MODULE_RESULT') {
            if (!payload.success) {
                showToast('Không mở được — vui lòng bấm Start menu Vnedu thủ công');
                console.warn('[Sidebar] openVneduModule failed:', payload);
            }
        }
    });

    function requestContextFromContentScript() {
        parent.postMessage({ type: 'COGIAO_REQUEST_CONTEXT' }, '*');
    }

    function handleContextUpdate({ module, context, students }) {
        currentModule = module;
        currentContext = context;
        currentStudents = students || [];
        generatedNhanXet.clear();

        if (!module) {
            showView('empty');
            return;
        }

        if (module === 'so-nhan-xet') {
            renderSoNhanXetView();
            showView('so-nhan-xet');
        } else if (module === 'nlpc') {
            nlpcStudents = currentStudents || [];
            renderNLPCView();
            showView('nlpc');
        }
    }

    function showView(name) {
        document.querySelectorAll('.view').forEach(v => v.classList.add('view-hidden'));
        const el = document.getElementById('view-' + name);
        if (el) el.classList.remove('view-hidden');

        const applyBar = document.getElementById('apply-bar');
        if (name === 'so-nhan-xet' && generatedNhanXet.size > 0) {
            applyBar.classList.remove('view-hidden');
        } else {
            applyBar.classList.add('view-hidden');
        }
    }

    function renderSoNhanXetView() {
        const ctx = currentContext || {};
        const monDisplay = formatMonDisplay(ctx.mon);

        document.getElementById('ctx-box').innerHTML = `
            <div class="context-label">Đã phát hiện:</div>
            <div class="context-title">Sổ nhận xét môn — Lớp ${escapeHtml(ctx.lop || '?')}</div>
            <div class="context-pills">
                ${monDisplay ? `<span class="pill">${escapeHtml(monDisplay)}</span>` : ''}
                ${ctx.hocKy ? `<span class="pill">${escapeHtml(ctx.hocKy)}</span>` : ''}
                ${ctx.kyDanhGia ? `<span class="pill">${escapeHtml(ctx.kyDanhGia)}</span>` : ''}
            </div>
        `;

        const total = currentStudents.length;
        const daCo = currentStudents.filter(s => s.daCoNhanXet).length;

        // v0.1.20: nhận diện loại môn — nếu LỚP có >=1 HS có điểm số → môn có điểm,
        // chỉ tính HS có điểm là "cần đánh giá". Ngược lại (TNXH/ĐĐ/MT/AN/GDTC/HĐTN)
        // → tính theo mức chữ T/H/C. Tránh false positive khi Vnedu để default value
        // trong input XL ẩn cho HS chưa được đánh giá.
        const monCoDiem = currentStudents.some(s => s.diem !== null);
        const dangDuocDanhGia = s => monCoDiem ? s.diem !== null : !!s.mucDat;

        const coDanhGia = currentStudents.filter(dangDuocDanhGia).length;
        const canSinh = currentStudents.filter(s => !s.daCoNhanXet && dangDuocDanhGia(s)).length;

        document.getElementById('stats').innerHTML = `
            <div class="stat-card">
                <div class="stat-label">Tổng HS</div>
                <div class="stat-value">${total}</div>
            </div>
            <div class="stat-card warn">
                <div class="stat-label">Cần tạo</div>
                <div class="stat-value">${Math.max(canSinh, 0)}</div>
            </div>
            <div class="stat-card ok">
                <div class="stat-label">Đã có</div>
                <div class="stat-value">${daCo}</div>
            </div>
        `;

        const btn = document.getElementById('btn-generate');
        if (canSinh > 0) {
            btn.textContent = `Tạo nhận xét cho ${canSinh} HS`;
            btn.disabled = false;
        } else if (coDanhGia === 0) {
            btn.textContent = 'Chưa có HS nào được đánh giá (điểm hoặc mức)';
            btn.disabled = true;
        } else {
            btn.textContent = 'Tất cả HS đã có nhận xét';
            btn.disabled = true;
        }

        document.getElementById('student-list').innerHTML =
            '<div class="hint-empty">Bấm "Tạo nhận xét" để bắt đầu</div>';
    }

    async function generateAllNhanXet() {
        if (!engine || !currentContext) return;

        const subjectCode = mapSubjectName(currentContext.mon);
        if (!subjectCode) {
            alert(`Chưa có ngân hàng nhận xét cho môn "${currentContext.mon}".`);
            return;
        }

        // LICENSE GATE — V1.6: free user lock cứng vào cặp (môn, lớp) đầu tiên.
        const className = currentContext.lop || null;
        if (window.LicenseClient) {
            const gate = await LicenseClient.canUseFeature('subject', subjectCode, className);
            if (!gate.allowed) {
                showLockModal(gate.reason, { ...gate, currentSubject: subjectCode, currentClass: className });
                return;
            }
        }

        // v0.1.20: per-subject filter — môn có điểm thì lấy theo điểm, môn không điểm lấy theo mức chữ.
        const monCoDiem = currentStudents.some(s => s.diem !== null);
        const toGenerate = currentStudents.filter(s =>
            !s.daCoNhanXet && (monCoDiem ? s.diem !== null : !!s.mucDat)
        );
        if (toGenerate.length === 0) {
            alert('Không có HS nào cần tạo nhận xét (HS phải có điểm số hoặc mức T/H/C).');
            return;
        }

        engine.options.gvLa = settings.gvLa;

        try {
            const result = engine.sinhCaLop(toGenerate, subjectCode);

            generatedNhanXet.clear();
            for (const r of result) {
                generatedNhanXet.set(r.hoVaTen, r);
            }

            renderStudentList(result);
            document.getElementById('apply-bar').classList.remove('view-hidden');

            // V1.6: lock CẶP (môn, lớp) — gọi SAU sinh thành công, chỉ ảnh hưởng free user.
            if (window.LicenseClient) {
                await LicenseClient.commitFreeSubject(subjectCode, className);
                refreshLicenseUI();
            }
        } catch (e) {
            console.error('[Sidebar] Lỗi tạo nhận xét:', e);
            alert('Lỗi khi tạo nhận xét: ' + e.message);
        }
    }

    function mapSubjectName(name) {
        if (!name) return null;
        const lower = name.toLowerCase();
        // BUG-003/004 fix: nhận thêm dạng viết tắt (TN-XH, TNXH, LSĐL, GDTC, HĐTN...)
        if (lower.includes('tiếng việt') || lower === 'tv') return 'tieng-viet';
        if (lower.includes('toán')) return 'toan';
        if (lower.includes('tự nhiên') || lower.includes('xã hội') ||
            /^tn[\s\-]*xh$/.test(lower) || lower === 'tnxh' || lower === 'tn') return 'tnxh';
        if (lower.includes('khoa học') || lower === 'kh') return 'khoahoc';
        if (lower.includes('lịch sử') || lower.includes('địa lí') ||
            /^ls[\s\-]*đl$/.test(lower) || lower === 'lsdl') return 'lichsudia';
        if (lower.includes('đạo đức') || lower === 'đđ' || lower === 'dd') return 'daoduc';
        // V1.7: phân biệt Công nghệ vs Tin học (Vnedu thường có 2 cột con dưới
        // "Tin học và Công nghệ"). Phải kiểm tra Công nghệ TRƯỚC để bắt
        // "Tin học và Công nghệ (Công nghệ)" và "Công nghệ" riêng.
        if (/\(\s*công nghệ\s*\)/.test(lower)) return 'congnghe';
        if (lower.includes('công nghệ') && !lower.includes('tin học')) return 'congnghe';
        if (lower.includes('tin học') || lower === 'th' ||
            /^th[\s\-]*cn$/.test(lower)) return 'tinhoc';
        if (lower.includes('tiếng anh') || lower.includes('ngoại ngữ') || lower === 'ta') return 'tienganh';
        if (lower.includes('thể chất') || lower === 'gdtc' || lower.includes('giáo dục thể')) return 'gdtc';
        if (lower.includes('âm nhạc') || lower === 'ân' || lower === 'an') return 'amnhac';
        if (lower.includes('mĩ thuật') || lower.includes('mỹ thuật') || lower === 'mt') return 'mithuat';
        if (lower.includes('trải nghiệm') || lower.includes('hđtn') || lower === 'htn') return 'htn';
        return null;
    }

    function renderStudentList(result) {
        const list = document.getElementById('student-list');
        list.innerHTML = result.map((s, i) => {
            const wordCount = (s.nhanXet || '').split(/\s+/).length;
            const badgeClass = s.mucDo === 'tot_xs' ? 'tot-xs' : s.mucDo;
            return `
                <div class="student-item" data-idx="${i}">
                    <div class="student-header">
                        <span class="student-stt">${i + 1}</span>
                        <span class="student-name">${escapeHtml(s.hoVaTen)}</span>
                        <span class="badge ${badgeClass}">${s.diem !== null && s.diem !== undefined ? s.diem + ' · ' : ''}${s.badge || s.xepLoai}</span>
                        <div class="student-actions">
                            <button class="mini-btn" data-action="edit" title="Sửa nhận xét">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button class="mini-btn" data-action="regen" title="Tạo lại nhận xét khác">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M3 21v-5h5"/></svg>
                            </button>
                        </div>
                    </div>
                    <div class="student-nx">${escapeHtml(s.nhanXet)}</div>
                    <div class="student-meta">${wordCount} từ</div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.mini-btn').forEach(btn => {
            btn.addEventListener('click', handleItemAction);
        });
    }

    function handleItemAction(e) {
        const action = e.currentTarget.dataset.action;
        const item = e.currentTarget.closest('.student-item');
        const idx = parseInt(item.dataset.idx);
        const hoVaTen = item.querySelector('.student-name').textContent.trim();
        const result = generatedNhanXet.get(hoVaTen);
        if (!result) return;

        if (action === 'edit') {
            startEditItem(item, result);
        } else if (action === 'regen') {
            regenOneItem(item, result);
        }
    }

    function startEditItem(item, result) {
        if (item.classList.contains('editing')) return;
        item.classList.add('editing');

        const nxDiv = item.querySelector('.student-nx');
        const metaDiv = item.querySelector('.student-meta');
        const currentText = result.nhanXet;

        nxDiv.style.display = 'none';
        metaDiv.style.display = 'none';

        const wrapper = document.createElement('div');
        wrapper.className = 'edit-wrapper';
        wrapper.innerHTML = `
            <textarea class="edit-textarea">${escapeHtml(currentText)}</textarea>
            <div class="edit-actions">
                <button class="btn-edit-cancel">Hủy</button>
                <button class="btn-edit-save">Lưu chỉnh sửa</button>
            </div>
        `;
        item.appendChild(wrapper);

        const textarea = wrapper.querySelector('textarea');
        textarea.focus();
        textarea.setSelectionRange(currentText.length, currentText.length);

        wrapper.querySelector('.btn-edit-cancel').onclick = () => {
            wrapper.remove();
            nxDiv.style.display = '';
            metaDiv.style.display = '';
            item.classList.remove('editing');
        };

        wrapper.querySelector('.btn-edit-save').onclick = () => {
            const newText = textarea.value.trim();
            if (!newText) {
                showToast('Nhận xét không được để trống');
                return;
            }
            result.nhanXet = newText;
            nxDiv.textContent = newText;
            metaDiv.textContent = newText.split(/\s+/).length + ' từ';

            wrapper.remove();
            nxDiv.style.display = '';
            metaDiv.style.display = '';
            item.classList.remove('editing');

            showToast('Đã lưu chỉnh sửa');
        };
    }

    function regenOneItem(item, result) {
        if (!engine || !currentContext) return;
        const subjectCode = mapSubjectName(currentContext.mon);
        if (!subjectCode) return;

        engine.options.gvLa = settings.gvLa;

        const hsInput = {
            stt: result.stt,
            hoVaTen: result.hoVaTen,
            diem: result.diem,
            mucDat: result.mucDat  // v0.1.19: hỗ trợ môn không điểm
        };

        try {
            const oldNx = result.nhanXet;
            let attempts = 0;
            let newNx = oldNx;

            while (newNx === oldNx && attempts < 5) {
                newNx = engine.sinhNhanXet(hsInput, subjectCode);
                attempts++;
            }

            result.nhanXet = newNx;

            const nxDiv = item.querySelector('.student-nx');
            const metaDiv = item.querySelector('.student-meta');
            nxDiv.textContent = newNx;
            metaDiv.textContent = newNx.split(/\s+/).length + ' từ';

            nxDiv.style.background = '#FFF9F0';
            setTimeout(() => { nxDiv.style.background = ''; }, 500);

            showToast('Đã tạo nhận xét mới');
        } catch (e) {
            console.error('[Sidebar] Lỗi tạo lại:', e);
            showToast('Lỗi: ' + e.message);
        }
    }

    function applyAllToVnedu() {
        if (generatedNhanXet.size === 0) {
            showToast('Chưa có nhận xét nào được tạo');
            return;
        }

        const items = [];
        for (const s of currentStudents) {
            const gen = generatedNhanXet.get(s.hoVaTen);
            if (gen) {
                items.push({ stt: s.stt, nhanXet: gen.nhanXet });
            }
        }

        parent.postMessage({
            type: 'COGIAO_APPLY_NHAN_XET',
            payload: { items }
        }, '*');
    }

    function handleApplyResult({ success, failed, total }) {
        const modal = document.getElementById('result-modal');
        const titleEl = document.getElementById('modal-title');
        const msgEl = document.getElementById('modal-message');

        if (failed === 0) {
            modal.querySelector('.modal').classList.remove('error');
            titleEl.textContent = 'Đã áp dụng thành công';
            msgEl.textContent = `Đã ghi ${success}/${total} nhận xét vào Vnedu.`;
        } else if (success > 0) {
            modal.querySelector('.modal').classList.remove('error');
            titleEl.textContent = 'Áp dụng một phần';
            msgEl.textContent = `Thành công ${success}/${total}. ${failed} nhận xét không ghi được.`;
        } else {
            modal.querySelector('.modal').classList.add('error');
            titleEl.textContent = 'Không thể áp dụng';
            msgEl.textContent = `Tất cả ${total} nhận xét đều thất bại.`;
        }

        modal.style.display = 'flex';

        document.getElementById('modal-cancel').onclick = closeModal;
        document.getElementById('modal-confirm').onclick = confirmAutoSave;
    }

    function closeModal() {
        document.getElementById('result-modal').style.display = 'none';
    }

    function confirmAutoSave() {
        const btn = document.getElementById('modal-confirm');
        btn.disabled = true;
        btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: -2px; animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            Đang lưu...
        `;

        parent.postMessage({ type: 'COGIAO_AUTO_SAVE' }, '*');

        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: -2px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Lưu vào Vnedu
            `;
        }, 5000);
    }

    function handleAutoSaveResult(payload) {
        const btn = document.getElementById('modal-confirm');
        const msgEl = document.getElementById('modal-message');

        if (payload.success) {
            const titleEl = document.getElementById('modal-title');
            titleEl.textContent = '✓ Đã lưu thành công';
            msgEl.innerHTML = `Đã tự động bấm nút <strong>"${escapeHtml(payload.buttonText || 'Lưu')}"</strong> trên Vnedu.<br><br>Vnedu sẽ xử lý lưu trữ trong giây lát.`;
            document.querySelector('.modal-note').style.display = 'none';
            document.getElementById('modal-cancel').style.display = 'none';
            btn.innerHTML = 'Đóng';
            btn.disabled = false;
            btn.onclick = () => {
                closeModal();
                document.querySelector('.modal-note').style.display = '';
                document.getElementById('modal-cancel').style.display = '';
            };
        } else {
            const reason = payload.reason === 'not_found'
                ? 'Không tìm thấy nút Lưu trên trang Vnedu. Vui lòng bấm nút Lưu thủ công.'
                : 'Có lỗi khi bấm nút Lưu: ' + (payload.error || 'không rõ');
            msgEl.innerHTML = `<span style="color: #A32D2D;">${escapeHtml(reason)}</span>`;
            btn.disabled = false;
            btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: -2px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Thử lại
            `;
        }
    }

    /* ====================================================================
     * v0.1.7 — NLPC Form
     * ================================================================== */
    function renderNLPCView() {
        const ctx = currentContext || {};

        // [NLPC-DBG] V.01 - render view
        console.log('[NLPC-DBG] renderNLPCView ENTRY', {
            ctx_lop: ctx.lop, ctx_hocKy: ctx.hocKy, ctx_module: ctx.module,
            studentCount: nlpcStudents.length,
            students: nlpcStudents.map(s => ({ stt: s.stt, name: s.hoVaTen, sel: s.isSelected })),
            selectedStt: nlpcSelectedStt,
            gradeLevel: getGradeLevel(ctx.lop)
        });

        document.getElementById('nlpc-context-box').innerHTML = `
            <strong>Phẩm chất - Năng lực ghi học bạ</strong> · Lớp ${escapeHtml(ctx.lop || '?')}
            ${ctx.hocKy ? ' · ' + escapeHtml(ctx.hocKy) : ''}
        `;

        // Populate dropdown HS
        // BUG-002 fix: KHÔNG dùng s.isSelected để set attribute "selected" trong HTML
        // (sẽ override lựa chọn của user mỗi khi rescan). Dùng nlpcSelectedStt thay.
        const sel = document.getElementById('nlpc-student-select');
        sel.innerHTML = '<option value="">— Chọn học sinh —</option>' +
            nlpcStudents.map(s =>
                `<option value="${s.stt}">${s.stt}. ${escapeHtml(s.hoVaTen)}</option>`
            ).join('');

        // BUG-002 fix: 3 trường hợp:
        //   A. Lần đầu (nlpcSelectedStt null) → auto-detect từ Vnedu
        //   B. User VỪA chọn qua dropdown (<3s) → giữ user's choice, KHÔNG auto-revert
        //   C. Đã hết grace period → follow Vnedu (user có thể đã click trực tiếp trong Vnedu)
        const auto = nlpcStudents.find(s => s.isSelected);
        const userRecentlySelected = Date.now() - nlpcUserSelectedAt < 3000;

        if (nlpcSelectedStt === null || nlpcSelectedStt === undefined) {
            // A: Lần đầu render
            if (auto) {
                nlpcSelectedStt = auto.stt;
                sel.value = auto.stt;
                loadNLPCForStudent(auto.stt);
            }
        } else if (userRecentlySelected) {
            // B: User vừa chủ động chọn — giữ lựa chọn, không auto-update
            if (nlpcStudents.find(s => s.stt === nlpcSelectedStt)) {
                sel.value = nlpcSelectedStt;
            } else {
                nlpcSelectedStt = null;
                sel.value = '';
            }
        } else if (auto && nlpcSelectedStt !== auto.stt) {
            // C: User có thể đã click HS khác trực tiếp trong Vnedu → sync sidebar theo
            nlpcSelectedStt = auto.stt;
            sel.value = auto.stt;
            loadNLPCForStudent(auto.stt);
        } else {
            sel.value = nlpcSelectedStt;
        }

        renderNLPCFields();
    }

    async function selectNLPCStudent(stt) {
        nlpcSelectedStt = stt;
        nlpcUserSelectedAt = Date.now();  // BUG-002 fix: đánh dấu user vừa chủ động chọn
        const hs = nlpcStudents.find(s => s.stt === stt);
        if (!hs) return;

        // Bảo Vnedu chọn HS này (để form 16 textarea load đúng HS)
        parent.postMessage({
            type: 'COGIAO_NLPC_SELECT_STUDENT',
            payload: { stt, hoVaTen: hs.hoVaTen }
        }, '*');

        await loadNLPCForStudent(stt);
    }

    async function loadNLPCForStudent(stt) {
        const hs = nlpcStudents.find(s => s.stt === stt);
        if (!hs) {
            console.warn('[NLPC-DBG] loadNLPCForStudent: stt không tìm thấy HS', { stt, total: nlpcStudents.length });
            return;
        }
        console.log('[NLPC-DBG] loadNLPCForStudent', { stt, name: hs.hoVaTen, className: (currentContext||{}).lop });

        // Reset override khi đổi HS — tránh leak giữa các HS
        nlpcOverrides = {};
        nlpcGenerated = null;
        document.getElementById('nlpc-btn-apply').disabled = true;
        document.getElementById('nlpc-preview').style.display = 'none';

        const className = (currentContext || {}).lop || '';
        const statusEl = document.getElementById('nlpc-cache-status');

        if (!className) {
            statusEl.textContent = '⚠ Chưa nhận được tên lớp từ Vnedu.';
            statusEl.className = 'nlpc-status warn';
            nlpcAutoSuggestions = NLPCMapper.scoresToGrades({});
            renderNLPCFields();
            return;
        }

        try {
            const result = await NLPCMapper.autoSuggestForStudent(className, hs.hoVaTen);
            nlpcAutoSuggestions = result.suggestions;

            if (!result.found) {
                statusEl.innerHTML = `⚠ Chưa có cache điểm cho HS này. Hãy mở Sổ NX các môn (TV, Toán, ...) để tự động thu thập điểm.`;
                statusEl.className = 'nlpc-status warn';
            } else {
                const subjectCount = Object.values(result.diem).filter(v => v !== null).length;
                statusEl.innerHTML = `✓ Đã có điểm <strong>${subjectCount} môn</strong> trong cache (cập nhật ${formatRelativeTime(result.lastSynced)})`;
                statusEl.className = 'nlpc-status ok';
            }
        } catch (e) {
            console.error('[Sidebar] loadNLPCForStudent lỗi:', e);
            statusEl.textContent = 'Lỗi đọc cache: ' + e.message;
            statusEl.className = 'nlpc-status warn';
        }

        renderNLPCFields();
    }

    function renderNLPCFields() {
        for (const sec of ['nang_luc_chung', 'nang_luc_dac_thu', 'pham_chat']) {
            const secEl = document.getElementById('nlpc-section-' +
                (sec === 'nang_luc_chung' ? 'nlc' :
                 sec === 'nang_luc_dac_thu' ? 'nldt' : 'pc'));
            const fieldsEl = secEl.querySelector('.nlpc-fields');
            const defs = getActiveFieldDefs(sec);  // BUG-006: lọc theo lớp

            fieldsEl.innerHTML = defs.map(def => renderOneNLPCField(sec, def)).join('');
        }

        // Bind click vào badge để cycle T → Đ → C (override)
        document.querySelectorAll('.nlpc-auto-badge[data-field]').forEach(badge => {
            badge.onclick = () => {
                const fieldKey = badge.dataset.field;
                const current = getEffectiveGrade(fieldKey);
                nlpcOverrides[fieldKey] = NLPCMapper.cycleGrade(current);
                renderNLPCFields();
            };
        });

        // Reset overrides nút (nếu có ít nhất 1 override)
        updateOverrideStatus();
    }

    function renderOneNLPCField(sec, def) {
        const sg = nlpcAutoSuggestions?.[def.key];
        const isOverridden = !!nlpcOverrides[def.key];
        const grade = getEffectiveGrade(def.key);
        const badge = NLPCMapper.gradeToBadge(grade);

        // Hint: nếu override, ghi rõ "GV chỉnh"; nếu không, dùng hint từ NLPCMapper
        const hint = isOverridden
            ? `GV đã chỉnh: ${badge} (gốc: ${sg?.hint || 'chưa cache'})`
            : (sg?.hint || '(chưa có cache → mặc định Đ)');

        return `
            <div class="nlpc-field ${isOverridden ? 'overridden' : 'auto'}">
                <div class="nlpc-field-row">
                    <span class="nlpc-field-label">${escapeHtml(def.label)}</span>
                    <span class="nlpc-auto-badge clickable ${grade}"
                          data-field="${def.key}"
                          title="Click để đổi: T → Đ → C">
                        ${badge}
                    </span>
                </div>
                <div class="nlpc-auto-hint">${escapeHtml(hint)}</div>
            </div>
        `;
    }

    function updateOverrideStatus() {
        const count = Object.keys(nlpcOverrides).length;
        const statusEl = document.getElementById('nlpc-cache-status');
        if (count > 0 && statusEl) {
            // Append override note (không ghi đè cache status)
            const existing = statusEl.dataset.baseHtml || statusEl.innerHTML;
            statusEl.dataset.baseHtml = existing;
            statusEl.innerHTML = existing + ` · <em>GV chỉnh ${count} trường</em> <a href="#" id="nlpc-reset-overrides">[reset]</a>`;
            const reset = document.getElementById('nlpc-reset-overrides');
            if (reset) reset.onclick = (e) => {
                e.preventDefault();
                nlpcOverrides = {};
                renderNLPCFields();
                statusEl.innerHTML = statusEl.dataset.baseHtml;
                statusEl.dataset.baseHtml = '';
            };
        }
    }

    /**
     * Tạo 16 nhận xét text từ 13 grade (auto/override) + 3 nhận xét tổng hợp.
     * v0.1.8: TẤT CẢ 13 trường đều auto từ điểm môn; GV override = nlpcOverrides[fieldKey]
     */
    async function generateNLPCText() {
        if (!engine || !engine.data) {
            alert('Ngân hàng nhận xét chưa load. Hãy đợi giây lát rồi thử lại.');
            return;
        }
        if (!nlpcSelectedStt) {
            alert('Hãy chọn 1 HS trước.');
            return;
        }

        // LICENSE GATE — NLPC luôn cần bản quyền (model 1 môn free chỉ Sổ NX môn).
        if (window.LicenseClient) {
            const gate = await LicenseClient.canUseFeature('nlpc');
            if (!gate.allowed) {
                showLockModal(gate.reason, gate);
                return;
            }
        }

        // Build danhGia object cho engine.sinhNLPCDayDu — chỉ gom grade của các field
        // ACTIVE theo lớp (BUG-006: lớp 1-2 KHÔNG gồm cong_nghe + tin_hoc)
        const danhGia = { nang_luc_chung: {}, nang_luc_dac_thu: {}, pham_chat: {} };
        for (const sec of Object.keys(NLPC_FIELD_DEFS)) {
            for (const def of getActiveFieldDefs(sec)) {
                danhGia[sec][def.key] = getEffectiveGrade(def.key);
            }
        }

        engine.options.gvLa = settings.gvLa;
        const hs = nlpcStudents.find(s => s.stt === nlpcSelectedStt);
        const gradeLevel = getGradeLevel(currentContext?.lop);

        try {
            // engine.sinhNLPCDayDu trả 3 section, mỗi section có 'Nhận xét chung' + N trường con
            const result = engine.sinhNLPCDayDu(
                { hoVaTen: hs.hoVaTen, gradeLevel },
                danhGia
            );
            nlpcGenerated = convertGeneratedToPayload(result);

            renderNLPCPreview(nlpcGenerated);
            document.getElementById('nlpc-btn-apply').disabled = false;
            showToast(`Đã tạo nhận xét cho ${hs.hoVaTen}`);
        } catch (e) {
            console.error('[Sidebar] generateNLPCText lỗi:', e);
            alert('Lỗi tạo nhận xét NLPC: ' + e.message);
        }
    }

    /**
     * Convert output engine (key = label tiếng Việt) → payload (key = field key)
     * mà fillNLPCFields cần.
     */
    function convertGeneratedToPayload(engineOutput) {
        const labelToKey = {
            'Nhận xét chung': 'chung',
            'Tự chủ và tự học': 'tu_chu_tu_hoc',
            'Giao tiếp và hợp tác': 'giao_tiep_hop_tac',
            'Giải quyết vấn đề và sáng tạo': 'giai_quyet_van_de',
            'Năng lực ngôn ngữ': 'ngon_ngu',
            'Năng lực tính toán': 'tinh_toan',
            'Năng lực khoa học': 'khoa_hoc',
            'Năng lực thẩm mĩ': 'tham_mi',
            'Năng lực thể chất': 'the_chat',
            'Năng lực công nghệ': 'cong_nghe',
            'Năng lực tin học': 'tin_hoc',
            'Yêu nước': 'yeu_nuoc',
            'Nhân ái': 'nhan_ai',
            'Chăm chỉ': 'cham_chi',
            'Trung thực': 'trung_thuc',
            'Trách nhiệm': 'trach_nhiem'
        };

        const result = { nang_luc_chung: {}, nang_luc_dac_thu: {}, pham_chat: {} };
        for (const sec of Object.keys(result)) {
            const secObj = engineOutput[sec] || {};
            for (const [label, text] of Object.entries(secObj)) {
                const key = labelToKey[label];
                if (key) result[sec][key] = text;
            }
        }
        return result;
    }

    function countNonEmpty(payload) {
        let n = 0;
        for (const sec of Object.values(payload)) {
            for (const t of Object.values(sec)) {
                if (t && t.trim()) n++;
            }
        }
        return n;
    }

    function renderNLPCPreview(payload) {
        const previewEl = document.getElementById('nlpc-preview');
        const listEl = document.getElementById('nlpc-preview-list');
        previewEl.style.display = 'block';

        const sectionLabels = {
            nang_luc_chung: 'NL Chung',
            nang_luc_dac_thu: 'NL Đặc thù',
            pham_chat: 'Phẩm chất'
        };

        const items = [];
        for (const [sec, fields] of Object.entries(payload)) {
            for (const [key, text] of Object.entries(fields)) {
                if (!text) continue;
                items.push(`
                    <div class="nlpc-preview-item">
                        <div class="nlpc-preview-key">${sectionLabels[sec]} · ${key}</div>
                        <div class="nlpc-preview-text">${escapeHtml(text)}</div>
                    </div>
                `);
            }
        }
        listEl.innerHTML = items.join('') || '<div class="cm-empty">Không sinh được nhận xét nào</div>';
    }

    function applyNLPCToVnedu() {
        if (!nlpcGenerated) {
            showToast('Chưa tạo nhận xét. Bấm "Tạo nhận xét" trước.');
            return;
        }
        // BUG-005 fix: gắn tên HS vào payload để adapter verify trước khi điền
        const hs = nlpcStudents.find(s => s.stt === nlpcSelectedStt);
        // [NLPC-DBG] log payload trước khi gửi cho adapter
        console.log('[NLPC-DBG] applyNLPCToVnedu SEND', {
            expectedHS: hs?.hoVaTen,
            payload_keys: {
                nlc: Object.keys(nlpcGenerated.nang_luc_chung || {}),
                nldt: Object.keys(nlpcGenerated.nang_luc_dac_thu || {}),
                pc: Object.keys(nlpcGenerated.pham_chat || {})
            }
        });
        parent.postMessage({
            type: 'COGIAO_APPLY_NLPC',
            payload: { ...nlpcGenerated, _expectedHS: hs?.hoVaTen }
        }, '*');
    }

    function handleNLPCApplyResult({ success, failed, detail, error, expected, actual }) {
        const modal = document.getElementById('result-modal');
        const titleEl = document.getElementById('modal-title');
        const msgEl = document.getElementById('modal-message');
        const noteEl = modal.querySelector('.modal-note');
        const cancelBtn = document.getElementById('modal-cancel');
        const confirmBtn = document.getElementById('modal-confirm');

        // BUG-005: HS mismatch — Vnedu form đang hiển thị HS KHÁC với HS chọn trong sidebar
        if (error === 'hs_mismatch' || error === 'no_active_hs') {
            modal.querySelector('.modal').classList.add('error');
            titleEl.textContent = '⚠ HS không khớp — KHÔNG ghi nhận xét';
            msgEl.innerHTML = `
                <div style="text-align:left">
                  <p style="margin-bottom:8px"><strong>Sidebar đang chọn:</strong> ${escapeHtml(expected || '?')}</p>
                  <p style="margin-bottom:8px"><strong>Vnedu đang hiển thị:</strong> ${escapeHtml(actual || '?')}</p>
                  <p style="margin-bottom:8px;color:#b94a48"><strong>Đã ngăn ghi nhận xét</strong> để tránh lưu nhầm vào HS khác.</p>
                  <p style="font-size:12px;color:#555">Cách khắc phục: trong panel <strong>bên trái Vnedu</strong>, click vào HS <strong>${escapeHtml(expected || '?')}</strong> để Vnedu load form đúng. Sau đó bấm "Áp dụng" lại.</p>
                </div>
            `;
            if (noteEl) noteEl.style.display = 'none';
            cancelBtn.style.display = 'none';
            confirmBtn.textContent = 'Đã hiểu';
            confirmBtn.onclick = closeModal;
            modal.style.display = 'flex';
            return;
        }

        const total = success + failed;

        if (failed === 0) {
            modal.querySelector('.modal').classList.remove('error');
            titleEl.textContent = 'Đã áp dụng NL · PC thành công';
            msgEl.textContent = `Đã ghi ${success} ô nhận xét vào form Phẩm chất · Năng lực của Vnedu.`;
        } else if (success > 0) {
            modal.querySelector('.modal').classList.remove('error');
            titleEl.textContent = 'Áp dụng một phần NL · PC';
            const failKeys = (detail || []).filter(d => d.status !== 'ok')
                .map(d => `${d.section}.${d.key}`).join(', ');
            msgEl.innerHTML = `Thành công <strong>${success}/${total}</strong>. <strong>${failed}</strong> ô không ghi được.<br>` +
                              `<span style="font-size:11px;color:#888">Chi tiết: ${escapeHtml(failKeys)}</span>`;
            console.warn('[Sidebar] NLPC fields fail:', failKeys);
        } else {
            modal.querySelector('.modal').classList.add('error');
            titleEl.textContent = 'Không thể áp dụng';
            msgEl.textContent = `Tất cả ${total} ô nhận xét đều thất bại. Vui lòng kiểm tra lại form NL/PC trên Vnedu.`;
        }

        // Hồi phục note + nút (handleAutoSaveResult có thể ẩn note/cancel ở lần trước)
        if (noteEl) {
            noteEl.style.display = '';
            noteEl.innerHTML = 'Bấm <strong>"Lưu vào Vnedu"</strong> để tự động bấm nút Lưu của Vnedu,<br>' +
                               'hoặc <strong>"Để sau"</strong> nếu muốn kiểm tra lại từng ô trước.';
        }
        cancelBtn.style.display = '';
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: -2px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Lưu vào Vnedu
        `;

        modal.style.display = 'flex';

        cancelBtn.onclick = closeModal;
        confirmBtn.onclick = confirmAutoSave;
    }

    /* ====================================================================
     * v0.1.18 — LICENSE: self-serve register → CK → login
     * ================================================================== */

    const SUBJECT_LABELS = {
        'tieng-viet': 'Tiếng Việt', 'toan': 'Toán', 'tnxh': 'Tự nhiên & Xã hội',
        'khoahoc': 'Khoa học', 'lichsudia': 'Lịch sử & Địa lí', 'daoduc': 'Đạo đức',
        'tinhoc': 'Tin học', 'congnghe': 'Công nghệ', 'tienganh': 'Tiếng Anh', 'gdtc': 'Giáo dục thể chất',
        'amnhac': 'Âm nhạc', 'mithuat': 'Mĩ thuật', 'htn': 'Hoạt động trải nghiệm'
    };
    function subjectKeyToLabel(k) { return SUBJECT_LABELS[k] || k || '?'; }

    // 'register' (mặc định khi free) hoặc 'login' (khi GV bấm "Đã có mã" hoặc đến từ pending)
    let licUiMode = 'register';

    async function refreshLicenseUI() {
        if (!window.LicenseClient) return;
        licenseState = await LicenseClient.getState();
        renderLicenseSection(licenseState);
    }

    async function renderLicenseSection(state) {
        const box = document.getElementById('lic-status-box');
        if (!box) return;

        const formReg     = document.getElementById('lic-form-register');
        const formPending = document.getElementById('lic-form-pending');
        const formLogin   = document.getElementById('lic-form-login');
        const info        = document.getElementById('lic-info');

        // Default ẩn hết
        formReg.style.display = 'none';
        formPending.style.display = 'none';
        formLogin.style.display = 'none';
        info.style.display = 'none';

        const settingNote = document.getElementById('lic-setting-note');

        if (state.status === 'active') {
            // Ẩn status box + setting-note "Bản miễn phí..." khi đã kích hoạt
            box.style.display = 'none';
            if (settingNote) settingNote.style.display = 'none';

            info.style.display = 'block';
            document.getElementById('lic-info-sdt').textContent = state.sdt || '—';
            document.getElementById('lic-info-name').textContent = state.gv_ho_ten || '(chưa cập nhật)';
            document.getElementById('lic-info-until').textContent = formatDateVi_(state.validUntil) || '—';
            document.getElementById('lic-info-remaining').textContent = formatRemaining_(state.validUntil);
            return;
        }

        // Các state khác — đảm bảo status box + setting-note hiển thị lại
        box.style.display = '';
        if (settingNote) settingNote.style.display = '';

        if (state.status === 'pending') {
            // Khi thầy bấm "Tôi đã CK — đăng nhập", licUiMode='login' → hiện form Login
            // prefill sẵn SĐT + mã từ pending state, để GV chỉ việc bấm Đăng nhập.
            if (licUiMode === 'login') {
                box.className = 'lic-status lic-status-free';
                box.innerHTML = '⏳ Nhập SĐT + mã đã đăng ký để hoàn tất kích hoạt';
                formLogin.style.display = 'block';
                const sdtIn = document.getElementById('lic-login-sdt');
                const maIn = document.getElementById('lic-login-ma');
                if (sdtIn && !sdtIn.value) sdtIn.value = state.sdt || '';
                if (maIn && !maIn.value) maIn.value = state.ma || '';
                return;
            }

            box.className = 'lic-status lic-status-pending';
            box.innerHTML = '⏳ Đã đăng ký — vui lòng chuyển khoản để hoàn tất';
            formPending.style.display = 'block';
            document.getElementById('lic-pending-sdt').textContent = state.sdt || '—';
            document.getElementById('lic-pending-name').textContent = state.hoTen || '—';
            document.getElementById('lic-pending-ma').textContent = state.ma || '—';
            // Load ảnh QR từ thư mục extension
            const qrImg = document.getElementById('lic-qr-img');
            try {
                qrImg.src = chrome.runtime.getURL('license/qr.png');
                qrImg.style.display = '';
                document.getElementById('lic-qr-fallback').style.display = 'none';
            } catch (e) { /* extension context khác */ }
            return;
        }

        if (state.status === 'expired' || state.status === 'needs_recheck') {
            box.className = 'lic-status lic-status-error';
            box.innerHTML = state.status === 'expired'
                ? '⚠ Đã hết hạn — đăng ký gia hạn rồi đăng nhập lại'
                : '⚠ Máy lâu chưa online — đăng nhập lại để xác thực';
            formLogin.style.display = 'block';
            prefillLoginSdt();
            return;
        }

        // 'free' — V1.6: hiển thị cặp (môn, lớp) đã lock
        box.className = 'lic-status lic-status-free';
        if (state.freeSubject && state.freeClass) {
            box.innerHTML = `Bản miễn phí — đã chọn môn <strong>${escapeHtml(subjectKeyToLabel(state.freeSubject))}</strong> · lớp <strong>${escapeHtml(state.freeClass)}</strong>`;
        } else if (state.freeSubject) {
            box.innerHTML = `Bản miễn phí — đã chọn môn <strong>${escapeHtml(subjectKeyToLabel(state.freeSubject))}</strong> (lớp đầu tiên thầy/cô mở sẽ được lưu)`;
        } else {
            box.innerHTML = 'Bản miễn phí — <strong>1 môn + 1 lớp</strong> đầu tiên thầy/cô dùng sẽ được lưu';
        }

        if (licUiMode === 'login') {
            formLogin.style.display = 'block';
            prefillLoginSdt();
        } else {
            formReg.style.display = 'block';
        }
    }

    // Format ISO date 2027-05-15 → 15/05/2027
    function formatDateVi_(iso) {
        if (!iso) return '';
        const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return String(iso);
        return m[3] + '/' + m[2] + '/' + m[1];
    }

    // Số ngày còn lại từ now đến validUntil
    function formatRemaining_(iso) {
        if (!iso) return '—';
        const target = new Date(iso).getTime();
        if (isNaN(target)) return '—';
        const days = Math.ceil((target - Date.now()) / 86400000);
        if (days <= 0) return 'Đã hết hạn';
        if (days > 365 * 5) return 'Vĩnh viễn';  // mã thầy set ngày 2099 cho khách đặc biệt
        if (days >= 30) return Math.round(days / 30) + ' tháng (' + days + ' ngày)';
        return days + ' ngày';
    }

    // Prefill SĐT vào form đăng nhập từ storage — GV quay lại sau khi xóa cache đỡ phải gõ.
    async function prefillLoginSdt() {
        const sdtIn = document.getElementById('lic-login-sdt');
        if (!sdtIn || sdtIn.value) return;
        if (!window.LicenseClient || !LicenseClient.getLastSdt) return;
        const last = await LicenseClient.getLastSdt();
        if (last && !sdtIn.value) sdtIn.value = last;
    }

    async function handleRegisterClick() {
        const hoTen = (document.getElementById('lic-reg-hoten').value || '').trim();
        const sdtRaw = (document.getElementById('lic-reg-sdt').value || '').trim();
        const errEl = document.getElementById('lic-reg-error');
        errEl.style.display = 'none';

        const btn = document.getElementById('lic-btn-register');
        btn.disabled = true; const oldText = btn.textContent; btn.textContent = 'Đang đăng ký...';

        try {
            const res = await LicenseClient.dangKy(sdtRaw, hoTen);
            if (res.ok) {
                showToast(res.daDangKyTruoc
                    ? 'SĐT đã đăng ký — hiển thị lại mã cũ'
                    : '✓ Đăng ký thành công, vui lòng chuyển khoản');
                document.getElementById('lic-reg-hoten').value = '';
                document.getElementById('lic-reg-sdt').value = '';
                await refreshLicenseUI();
            } else {
                errEl.style.display = 'block';
                errEl.textContent = mapLicenseError(res);
            }
        } finally {
            btn.disabled = false; btn.textContent = oldText;
        }
    }

    async function handleLoginClick() {
        const sdtRaw = (document.getElementById('lic-login-sdt').value || '').trim();
        const ma = (document.getElementById('lic-login-ma').value || '').trim();
        const errEl = document.getElementById('lic-login-error');
        errEl.style.display = 'none';

        const btn = document.getElementById('lic-btn-login');
        btn.disabled = true; const oldText = btn.textContent; btn.textContent = 'Đang đăng nhập...';

        try {
            const res = await LicenseClient.dangNhap(sdtRaw, ma);
            if (res.ok) {
                showToast('✓ Kích hoạt thành công cho ' + (res.gv_ho_ten || res.sdt));
                document.getElementById('lic-login-ma').value = '';
                licUiMode = 'register';
                await refreshLicenseUI();
                closeLockModal();
            } else {
                errEl.style.display = 'block';
                errEl.textContent = mapLicenseError(res);
                // Pending state local lệch với server (vd admin clear sheet) → dọn để bắt đầu lại
                if (res.error === 'sdt_chua_dang_ky' || res.error === 'ma_khong_dung') {
                    await LicenseClient.clearPending();
                    licUiMode = 'register';
                    setTimeout(refreshLicenseUI, 1500);
                }
            }
        } finally {
            btn.disabled = false; btn.textContent = oldText;
        }
    }

    async function handleCancelPending() {
        if (!confirm('Hủy đăng ký này? (Mã hiện tại sẽ không dùng được nữa, phải đăng ký mới)')) return;
        await LicenseClient.clearPending();
        licUiMode = 'register';
        showToast('Đã hủy đăng ký pending');
        await refreshLicenseUI();
    }

    async function handleRemoveLicense() {
        if (!confirm('Gỡ kích hoạt khỏi máy này?\n(SĐT và mã vẫn còn trên server. Đăng nhập lại bằng SĐT+mã trên máy mới sau khi quản trị reset thiết bị.)')) return;
        await LicenseClient.clearLocal();
        licUiMode = 'register';
        showToast('Đã gỡ kích hoạt khỏi máy');
        await refreshLicenseUI();
    }

    function mapLicenseError(res) {
        const errMap = {
            'sdt_sai': 'Số điện thoại sai định dạng. Đúng dạng: 10 số bắt đầu bằng 0 (vd 0912345678).',
            'ho_ten_sai': 'Họ tên cần ít nhất 3 ký tự.',
            'ma_sai_dinh_dang': 'Mã phải đúng 4 ký tự (chữ thường + số, vd k7m3).',
            'sdt_chua_dang_ky': 'SĐT chưa đăng ký. Bấm "Đăng ký mới" trước.',
            'ma_khong_dung': 'Mã không khớp với SĐT. Kiểm tra lại.',
            'chua_thanh_toan': 'Hệ thống chưa ghi nhận thanh toán. Vui lòng đợi 1-24h sau khi CK. Nếu đã CK lâu, liên hệ quản trị.',
            'da_dung_cho_may_khac': 'SĐT này đã kích hoạt ở máy khác. Liên hệ quản trị để reset.',
            'da_kich_hoat_o_may_khac': 'SĐT đã kích hoạt ở máy khác. Liên hệ quản trị.',
            'da_tra_tien_hay_dang_nhap': 'SĐT đã thanh toán — bấm "Đã có mã? Đăng nhập" để vào tiếp.',
            'het_han': 'Đã hết hạn. Đăng ký gia hạn (thao tác lại từ đầu).',
            'sdt_da_bi_khoa': 'SĐT đã bị khóa. Liên hệ quản trị.',
            'thieu_device_fingerprint': 'Không lấy được mã định danh thiết bị.',
            'network': 'Lỗi kết nối mạng. Thử lại sau.',
            'rate_limit': 'Quá nhiều yêu cầu. Đợi 1 phút rồi thử lại.',
            'server_chua_cau_hinh': 'Hệ thống license chưa cấu hình. Báo quản trị.',
            'chua_setup_sheet': 'Server chưa setup sheet. Báo quản trị.'
        };
        return res.message || errMap[res.error] || ('Lỗi: ' + (res.error || 'không rõ'));
    }

    function showLockModal(reason, ctx) {
        const titleEl = document.getElementById('lock-title');
        const msgEl = document.getElementById('lock-message');
        if (!titleEl || !msgEl) return;

        if (reason === 'free_no_nlpc') {
            titleEl.textContent = 'Năng lực · Phẩm chất cần bản quyền';
            msgEl.innerHTML = 'Bản miễn phí <strong>không hỗ trợ</strong> tạo nhận xét NL/PC. Mở khóa để dùng được tất cả 16 trường NL/PC.';
        } else if (reason === 'free_other_subject') {
            const subj = ctx?.freeSubject ? subjectKeyToLabel(ctx.freeSubject) : '?';
            const lopLocked = ctx?.freeClass ? ` · lớp <strong>${escapeHtml(ctx.freeClass)}</strong>` : '';
            titleEl.textContent = 'Đã dùng hết quota miễn phí';
            msgEl.innerHTML = `Bản miễn phí chỉ dùng được <strong>1 môn + 1 lớp</strong> — máy này đã chọn môn <strong>${escapeHtml(subj)}</strong>${lopLocked}. Đăng ký bản quyền để dùng tất cả môn ở tất cả lớp.`;
        } else if (reason === 'free_other_class') {
            const subj = ctx?.freeSubject ? subjectKeyToLabel(ctx.freeSubject) : '?';
            const lopLocked = ctx?.freeClass || '?';
            const lopHienTai = ctx?.currentClass || '?';
            titleEl.textContent = `Bản miễn phí đã khóa ở lớp ${lopLocked}`;
            msgEl.innerHTML = `Máy này đã chọn cặp <strong>môn ${escapeHtml(subj)} · lớp ${escapeHtml(lopLocked)}</strong>. Thầy/cô đang mở <strong>lớp ${escapeHtml(lopHienTai)}</strong> — cần đăng ký bản quyền để dùng thêm lớp khác.`;
        } else if (reason === 'expired') {
            titleEl.textContent = 'Mã đã hết hạn';
            msgEl.textContent = 'Mã kích hoạt đã hết hạn. Liên hệ thầy quản trị để gia hạn.';
        } else if (reason === 'needs_recheck') {
            titleEl.textContent = 'Cần kết nối mạng';
            msgEl.textContent = 'Máy này lâu chưa online — vui lòng kết nối Internet rồi kích hoạt lại bằng mã cũ.';
        } else {
            titleEl.textContent = 'Tính năng cần bản quyền';
            msgEl.textContent = 'Mở khóa bản quyền để dùng tính năng này.';
        }
        document.getElementById('lock-modal').style.display = 'flex';
    }

    function closeLockModal() {
        const m = document.getElementById('lock-modal');
        if (m) m.style.display = 'none';
    }

    function scheduleLicenseRecheck() {
        if (!window.LicenseClient) return;
        // Async, không await — không chặn UI khởi động
        LicenseClient.recheckIfDue().then(r => {
            if (r && r.ok === false) refreshLicenseUI();
        }).catch(() => {});
    }

    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * BUG-003 fix: Hiển thị tên môn cho gọn.
     * - "TN-XH" → "TNXH" (bỏ dấu '-' khi 2 chữ cái viết tắt liền)
     * - "Lịch sử - Địa lí" → giữ nguyên (có space hai bên dấu '-')
     * - Tên thường → giữ nguyên
     */
    function formatMonDisplay(raw) {
        if (!raw) return '';
        // Bỏ dấu '-' chỉ khi hai bên KHÔNG có khoảng trắng (vd "TN-XH" → "TNXH")
        return raw.replace(/(\S)-(\S)/g, '$1$2').trim();
    }

    init();
})();

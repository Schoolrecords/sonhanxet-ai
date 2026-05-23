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
        gvLa: 'co',
        // V6.1: Văn phong nhận xét — 'hocba' (TT27 khách quan, mặc định) | 'thanthien' (xưng "Em")
        vanPhong: 'hocba'
    };

    // V2.0: Ky override — GV có thể chọn kỳ thủ công khi auto-detect không chính xác.
    // null = dùng kyCode auto-detect từ Vnedu; nếu set → override.
    // Giá trị hợp lệ: 'ghk1' | 'chk1' | 'ghk2' | 'chk2' | null.
    let kyOverride = null;

    function getEffectiveKy() {
        if (kyOverride) return kyOverride;
        return (currentContext && currentContext.kyCode) || 'chk2';
    }

    function kyLabel(code) {
        return {
            ghk1: 'Giữa HK1',
            chk1: 'Cuối HK1',
            ghk2: 'Giữa HK2',
            chk2: 'Cuối HK2'
        }[code] || 'Cuối HK2';
    }

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

    // V.06 NLPC Bulk: 1-chạm cho cả lớp
    // Map<stt, {stt, hoVaTen, payload, lowConfidence, status: 'pending'|'done'|'fail'|'skipped'|'running', reason?}>
    let nlpcBulkPayloads = null;     // null = chưa generate; Map khi đã có
    let nlpcBulkRunning = false;     // queue đang chạy → khóa thao tác
    let nlpcBulkAbort = false;       // user bấm Dừng
    let nlpcBulkStartFrom = null;    // stt để resume từ
    let _bulkStepResolvers = new Map(); // requestId → resolve fn cho async wait

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

    /**
     * V2.3.7: Map style từ dropdown sang style engine theo ky.
     * - 'auto'    → tự theo ky: ghk* → giuaky, chk1 → cuoihk1, chk2 → cuoinam
     * - 'cuoinam' (user chọn explicit) khi ky != chk2 → cảnh báo console + downgrade
     *   theo ky (giuaky/cuoihk1). Tránh suffix "năm học tới" cho Giữa HK2.
     * - 'dinhhuong' / 'ngan' / 'default' → giữ nguyên.
     */
    function resolveCommentStyle(effectiveKy, selectedStyle) {
        if (!selectedStyle || selectedStyle === 'auto') {
            if (effectiveKy === 'ghk1' || effectiveKy === 'ghk2') return 'giuaky';
            if (effectiveKy === 'chk1') return 'cuoihk1';
            if (effectiveKy === 'chk2') return 'cuoinam';
            return 'default';
        }
        if (selectedStyle === 'cuoinam' && effectiveKy !== 'chk2') {
            console.warn('[Sidebar V2.3.7] style "cuoinam" chỉ áp dụng cho Cuối HK2 — auto downgrade theo ky', effectiveKy);
            if (effectiveKy === 'ghk1' || effectiveKy === 'ghk2') return 'giuaky';
            if (effectiveKy === 'chk1') return 'cuoihk1';
            return 'default';
        }
        return selectedStyle;
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
        engine.options.vanPhong = settings.vanPhong;

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

        // V2.0: load thêm ky-specific phrases (Giữa HK1 / Cuối HK1 / Giữa HK2).
        // File tách riêng cho dễ revert; nếu fetch fail engine vẫn chạy với pool flat (chk2).
        try {
            const kyUrl = chrome.runtime.getURL('engine/data/nhanxet-ky.json');
            const kyRes = await fetch(kyUrl);
            const kyData = await kyRes.json();
            engine.loadKyData(kyData);
            console.log('[Sidebar] V2.0 ky data loaded:', Object.keys(kyData.subjects).length, 'môn × 3 kỳ');
        } catch (e) {
            console.warn('[Sidebar] V2.0 ky data load fail (engine vẫn chạy chk2 default):', e);
        }

        // V2.2: load grade-specific phrases (Toán + TV × lớp 1-5 × chk2 × trend).
        // Nếu fail engine vẫn chạy với ky-data + flat pool.
        try {
            const gUrl = chrome.runtime.getURL('engine/data/nhanxet-grade.json');
            const gRes = await fetch(gUrl);
            const gData = await gRes.json();
            engine.loadGradeData(gData);
            const subs = Object.keys(gData.subjects).length;
            console.log('[Sidebar] V2.2 grade data loaded:', subs, 'môn × 5 grade × chk2');
        } catch (e) {
            console.warn('[Sidebar] V2.2 grade data load fail (engine vẫn chạy ky-data + flat):', e);
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
        document.querySelectorAll('#setting-vanPhong button').forEach(b => {
            b.classList.toggle('active', b.dataset.value === settings.vanPhong);
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

        // V6.1: Toggle văn phong (Học bạ/Vnedu ↔ Thân thiện)
        document.querySelectorAll('#setting-vanPhong button').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('#setting-vanPhong button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                settings.vanPhong = btn.dataset.value;
                if (engine) engine.options.vanPhong = settings.vanPhong;
                saveSettings();
                showToast(`Đã đổi văn phong sang "${btn.textContent}"`);
            };
        });

        // V6.0.4: tab bar đã gỡ bỏ — chỉ còn view "nhanxet" mặc định.
        // switchTab() vẫn giữ để legacy code (sg-btn-close, cm-* internal) không vỡ.

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

        // V.06 NLPC Bulk handlers
        document.getElementById('nlpc-btn-bulk-generate').onclick = generateNLPCBulk;
        document.getElementById('bulk-btn-back').onclick = () => {
            if (nlpcBulkRunning) { showToast('Đang đẩy — hãy bấm Dừng trước'); return; }
            showView('nlpc');
        };
        document.getElementById('bulk-btn-apply').onclick = () => runBulkApplyQueue();
        document.getElementById('bulk-btn-stop').onclick = () => { nlpcBulkAbort = true; };
        document.getElementById('bulk-result-close').onclick = closeBulkResultModal;
        document.getElementById('bulk-result-resume').onclick = () => {
            closeBulkResultModal();
            runBulkApplyQueue(nlpcBulkStartFrom);
        };

        // V6.0 License controls — flow Một-chạm (1 form đăng ký, tự polling)
        const bind = (id, handler) => {
            const el = document.getElementById(id);
            if (el) el.onclick = handler;
        };
        bind('lic-btn-register', handleRegisterClick);
        bind('lic-btn-copy-ma', handleCopyMaClick);
        bind('lic-btn-check-now', handleCheckNowClick);
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
        // V.06 NLPC Bulk: nhận kết quả 1 step → resolve Promise tương ứng
        if (type === 'COGIAO_NLPC_BULK_STEP_RESULT' || type === 'COGIAO_NLPC_BULK_READ_RESULT') {
            const rid = payload?.requestId;
            const resolver = _bulkStepResolvers.get(rid);
            if (resolver) {
                _bulkStepResolvers.delete(rid);
                resolver(payload);
            }
        }
        // V6.0.2: vendor Vnedu spam exception → hiện banner đề xuất F5
        if (type === 'COGIAO_VNEDU_HEALTH_BAD') {
            const banner = document.getElementById('vnedu-health-banner');
            if (banner) banner.hidden = false;
        }
    });

    // V6.0.2: Banner Vnedu health — wire buttons F5 / dismiss
    document.getElementById('vnedu-health-f5')?.addEventListener('click', () => {
        parent.postMessage({ type: 'COGIAO_RELOAD_VNEDU' }, '*');
    });
    document.getElementById('vnedu-health-dismiss')?.addEventListener('click', () => {
        const banner = document.getElementById('vnedu-health-banner');
        if (banner) banner.hidden = true;
    });

    function requestContextFromContentScript() {
        parent.postMessage({ type: 'COGIAO_REQUEST_CONTEXT' }, '*');
    }

    function handleContextUpdate({ module, context, students }) {
        // V2.0: reset ky override khi đổi lớp/môn/kỳ — để auto-detect lại theo Vnedu.
        const prev = currentContext || {};
        const next = context || {};
        if (prev.lop !== next.lop || prev.mon !== next.mon || prev.kyCode !== next.kyCode) {
            kyOverride = null;
        }

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

        // V2.0: dropdown chọn kỳ — auto detect + cho phép GV override
        const effectiveKy = getEffectiveKy();
        const autoKy = ctx.kyCode || 'chk2';
        const kyOptions = ['ghk1', 'chk1', 'ghk2', 'chk2'].map(c => {
            const sel = c === effectiveKy ? 'selected' : '';
            const autoTag = (c === autoKy && !kyOverride) ? ' (auto)' : '';
            return `<option value="${c}" ${sel}>${kyLabel(c)}${autoTag}</option>`;
        }).join('');

        document.getElementById('ctx-box').innerHTML = `
            <div class="context-title">NHẬN XÉT MÔN/HĐGD — LỚP ${escapeHtml(ctx.lop || '?')}</div>
            <div class="context-pills">
                ${monDisplay ? `<span class="pill">${escapeHtml(monDisplay)}</span>` : ''}
                ${ctx.hocKy ? `<span class="pill">${escapeHtml(ctx.hocKy)}</span>` : ''}
                ${ctx.kyDanhGia ? `<span class="pill">${escapeHtml(ctx.kyDanhGia)}</span>` : ''}
            </div>
            <div class="context-ky-row">
                <label class="context-ky-label" for="ctx-ky-select">📅 Kỳ nhận xét:</label>
                <select id="ctx-ky-select" class="context-ky-select">
                    ${kyOptions}
                </select>
                ${kyOverride ? '<button id="ctx-ky-reset" class="context-ky-reset" title="Trở lại auto-detect">↻</button>' : ''}
            </div>
        `;

        const kySelect = document.getElementById('ctx-ky-select');
        if (kySelect) {
            kySelect.onchange = () => {
                const val = kySelect.value;
                kyOverride = (val === autoKy) ? null : val;
                renderSoNhanXetView();
            };
        }
        const kyReset = document.getElementById('ctx-ky-reset');
        if (kyReset) {
            kyReset.onclick = () => {
                kyOverride = null;
                renderSoNhanXetView();
            };
        }

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
        engine.options.vanPhong = settings.vanPhong;

        try {
            // V2.3.7: dùng resolveCommentStyle để map dropdown → engine style theo ky
            const styleSelect = document.getElementById('comment-style');
            const effectiveKy = getEffectiveKy();
            const selectedStyle = (styleSelect && styleSelect.value) || 'auto';
            const engineCtx = {
                gradeLevel: getGradeLevel(currentContext?.lop),
                kyCode: effectiveKy,
                style: resolveCommentStyle(effectiveKy, selectedStyle)
            };
            const result = engine.sinhCaLop(toGenerate, subjectCode, effectiveKy, engineCtx);

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
        engine.options.vanPhong = settings.vanPhong;

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

            // V2.3.7: regenerate dùng cùng resolveCommentStyle để đảm bảo style đúng ky
            const styleSel = document.getElementById('comment-style');
            const regenKy = getEffectiveKy();
            const selectedStyleRegen = (styleSel && styleSel.value) || 'auto';
            const regenCtx = {
                gradeLevel: getGradeLevel(currentContext?.lop),
                kyCode: regenKy,
                style: resolveCommentStyle(regenKy, selectedStyleRegen)
            };
            while (newNx === oldNx && attempts < 5) {
                engine.resetUsedPhrases();
                // Thêm random salt vào tên để seeded index ra index khác mỗi lần
                const hsInputWithSalt = { ...hsInput, hoVaTen: hsInput.hoVaTen + '|r' + Date.now() + attempts };
                newNx = engine.sinhNhanXet(hsInputWithSalt, subjectCode, regenKy, regenCtx);
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

        // V.06: cập nhật label "Cả lớp (N HS · HK)" trong bulk section
        const bulkTitleEl = document.getElementById('nlpc-bulk-title');
        if (bulkTitleEl) {
            const n = nlpcStudents.length;
            const ky = ctx.hocKy ? ' · ' + ctx.hocKy : '';
            bulkTitleEl.textContent = n > 0 ? `Cả lớp (${n} HS${ky})` : 'Cả lớp';
        }

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
            statusEl.style.display = '';
            nlpcAutoSuggestions = NLPCMapper.scoresToGrades({});
            renderNLPCFields();
            return;
        }

        try {
            const result = await NLPCMapper.autoSuggestForStudent(className, hs.hoVaTen);
            nlpcAutoSuggestions = result.suggestions;

            if (!result.found) {
                // V6.0.4: ẨN hoàn toàn dòng cảnh báo "chưa có cache" — gây nhiễu khi cache thực ra có
                // mà lookup bị miss (name mismatch, class mismatch, ...). Sẽ build modal lỗi đẹp sau.
                statusEl.innerHTML = '';
                statusEl.className = 'nlpc-status';
                statusEl.style.display = 'none';
            } else {
                const subjectCount = Object.values(result.diem).filter(v => v !== null).length;
                statusEl.innerHTML = `✓ Đã có điểm <strong>${subjectCount} môn</strong> trong cache (cập nhật ${formatRelativeTime(result.lastSynced)})`;
                statusEl.className = 'nlpc-status ok';
                statusEl.style.display = '';
            }
        } catch (e) {
            console.error('[Sidebar] loadNLPCForStudent lỗi:', e);
            statusEl.textContent = 'Lỗi đọc cache: ' + e.message;
            statusEl.className = 'nlpc-status warn';
            statusEl.style.display = '';
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
        engine.options.vanPhong = settings.vanPhong;
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
     * V.06 — NLPC Bulk: 1-chạm cho cả lớp (2 pha: tạo & duyệt → đẩy queue)
     * ================================================================== */

    /**
     * Pha 1: sinh payload NLPC cho TẤT CẢ HS đang có trong nlpcStudents.
     * License gate 1 lần. Mỗi HS: autoSuggest từ cache → engine.sinhNLPCDayDu.
     * HS không có cache → đánh dấu lowConfidence, dùng mức 'ht' mặc định.
     */
    async function generateNLPCBulk() {
        if (!engine || !engine.data) {
            alert('Ngân hàng nhận xét chưa load. Hãy đợi giây lát rồi thử lại.');
            return;
        }
        if (!nlpcStudents || nlpcStudents.length === 0) {
            alert('Chưa có danh sách HS. Hãy mở form NL-PC trong Vnedu trước.');
            return;
        }

        // License gate — 1 lần cho cả batch
        if (window.LicenseClient) {
            const gate = await LicenseClient.canUseFeature('nlpc');
            if (!gate.allowed) {
                showLockModal(gate.reason, gate);
                return;
            }
        }

        const className = (currentContext || {}).lop || '';
        if (!className) {
            alert('Chưa nhận được tên lớp từ Vnedu. Hãy bấm "Quét lại" rồi thử lại.');
            return;
        }
        const gradeLevel = getGradeLevel(className);

        engine.options.gvLa = settings.gvLa;
        engine.options.vanPhong = settings.vanPhong;

        const btn = document.getElementById('nlpc-btn-bulk-generate');
        const originalLabel = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span><span>Đang tạo...</span>';

        nlpcBulkPayloads = new Map();
        let withGradesCount = 0, defaultCount = 0;

        // V.06: ĐỌC T/Đ/C TRỰC TIẾP TỪ FORM VNEDU thay cho cache chrome.storage.
        // Mỗi HS: select trong Vnedu → đợi form active → đọc badge T/Đ/C → sinh NX.
        // Lý do: chrome.storage.local bị xóa khi reinstall extension, nhưng Vnedu form
        // luôn có T/Đ/C do GV đã chấm — đó là source of truth thật.
        //
        // Hiển thị overlay progress để GV biết đang đọc cả lớp (35 HS × ~1.5s = ~50s).
        const readOverlay = document.getElementById('bulk-running-overlay');
        const readProgressFill = document.getElementById('bulk-progress-fill');
        const readProgressText = document.getElementById('bulk-progress-text');
        const readCurrentLabel = document.getElementById('bulk-running-current');
        const readBoxTitle = readOverlay?.querySelector('.bulk-running-title');
        const readBoxIcon = readOverlay?.querySelector('.bulk-running-icon');
        const readBoxWarn = readOverlay?.querySelector('.bulk-running-warn');
        const originalBoxTitle = readBoxTitle?.textContent;
        const originalBoxIcon = readBoxIcon?.textContent;
        const originalBoxWarn = readBoxWarn?.textContent;
        if (readBoxTitle) readBoxTitle.textContent = 'Đang đọc đánh giá NL-PC từ Vnedu…';
        if (readBoxIcon) readBoxIcon.textContent = '📖';
        if (readBoxWarn) readBoxWarn.textContent = 'Đang select từng HS để đọc badge T/Đ/C — đừng tab ra khỏi Vnedu';
        // Switch sang view bulk SỚM để hiện overlay (view nlpc-bulk có overlay).
        showView('nlpc-bulk');
        // Tạo entry pending cho từng HS để view bulk có khung hiển thị
        for (const hs of nlpcStudents) {
            nlpcBulkPayloads.set(hs.stt, {
                stt: hs.stt, hoVaTen: hs.hoVaTen,
                payload: { nang_luc_chung: {}, nang_luc_dac_thu: {}, pham_chat: {} },
                lowConfidence: true, status: 'pending'
            });
        }
        renderBulkPreview();
        if (readOverlay) readOverlay.style.display = 'flex';

        nlpcBulkAbort = false;

        try {
            for (let i = 0; i < nlpcStudents.length; i++) {
                if (nlpcBulkAbort) break;
                const hs = nlpcStudents[i];

                // Update progress
                const pct = Math.round((i / nlpcStudents.length) * 100);
                if (readProgressFill) readProgressFill.style.width = pct + '%';
                if (readProgressText) readProgressText.textContent = `${i} / ${nlpcStudents.length}`;
                if (readCurrentLabel) readCurrentLabel.textContent = `Đọc HS #${hs.stt} — ${hs.hoVaTen}`;

                // Gọi adapter read T/Đ/C cho HS này
                const readRes = await sendBulkReadStep(hs.stt, hs.hoVaTen);

                // Build danhGia từ grades đọc được; field nào không có badge → fallback 'ht'
                const danhGia = { nang_luc_chung: {}, nang_luc_dac_thu: {}, pham_chat: {} };
                let foundForHS = 0;
                for (const sec of Object.keys(NLPC_FIELD_DEFS)) {
                    for (const def of getActiveFieldDefs(sec)) {
                        const gradeFromForm = readRes?.grades?.[sec]?.[def.key];
                        if (gradeFromForm) {
                            danhGia[sec][def.key] = gradeFromForm;
                            foundForHS++;
                        } else {
                            danhGia[sec][def.key] = 'ht';
                        }
                    }
                }

                const lowConfidence = foundForHS === 0; // không đọc được badge nào → default
                if (lowConfidence) defaultCount++;
                else withGradesCount++;

                const result = engine.sinhNLPCDayDu(
                    { hoVaTen: hs.hoVaTen, gradeLevel },
                    danhGia
                );
                const payload = convertGeneratedToPayload(result);

                nlpcBulkPayloads.set(hs.stt, {
                    stt: hs.stt,
                    hoVaTen: hs.hoVaTen,
                    payload,
                    lowConfidence,
                    status: 'pending'
                });
            }

            // Cleanup overlay
            if (readOverlay) readOverlay.style.display = 'none';
            if (readBoxTitle) readBoxTitle.textContent = originalBoxTitle;
            if (readBoxIcon) readBoxIcon.textContent = originalBoxIcon;
            if (readBoxWarn) readBoxWarn.textContent = originalBoxWarn;

            btn.innerHTML = originalLabel;
            btn.disabled = false;

            renderBulkPreview();
            const msg = withGradesCount > 0
                ? `Đã đọc đánh giá NL-PC từ Vnedu cho ${withGradesCount}/${nlpcStudents.length} HS`
                : `Đã tạo NX cho ${nlpcStudents.length} HS (mức mặc định)`;
            showToast(msg);
        } catch (e) {
            console.error('[NLPC-BULK] generateNLPCBulk lỗi:', e);
            if (readOverlay) readOverlay.style.display = 'none';
            btn.innerHTML = originalLabel;
            btn.disabled = false;
            alert('Lỗi tạo NX cả lớp: ' + e.message);
        }
    }

    /** Gửi step đọc grades cho 1 HS, await response */
    function sendBulkReadStep(stt, expectedHS) {
        return new Promise((resolve) => {
            const requestId = `read-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            _bulkStepResolvers.set(requestId, resolve);
            setTimeout(() => {
                if (_bulkStepResolvers.has(requestId)) {
                    _bulkStepResolvers.delete(requestId);
                    resolve({ success: false, reason: 'no_response_8s', stt, expectedHS });
                }
            }, 8000);
            parent.postMessage({
                type: 'COGIAO_NLPC_BULK_READ',
                payload: { requestId, stt, expectedHS }
            }, '*');
        });
    }

    /** Render table 35 HS + summary + context */
    function renderBulkPreview() {
        if (!nlpcBulkPayloads) return;
        const ctx = currentContext || {};
        const kyTxt = ctx.hocKy || ctx.kyCode || '';
        document.getElementById('bulk-context').textContent =
            `Lớp ${ctx.lop || '?'} · ${nlpcBulkPayloads.size} HS${kyTxt ? ' · ' + kyTxt : ''}`;

        let skipN = 0;
        for (const item of nlpcBulkPayloads.values()) {
            if (item.status === 'skipped') skipN++;
        }
        const toApply = nlpcBulkPayloads.size - skipN;
        const summaryEl = document.getElementById('bulk-summary');

        let summaryHtml = `Sẽ đẩy <strong>${toApply}/${nlpcBulkPayloads.size}</strong> HS sang Vnedu`;
        if (skipN) summaryHtml += ` · ${skipN} HS đã bỏ`;
        summaryEl.innerHTML = summaryHtml;

        const applyBtnLabel = document.getElementById('bulk-btn-apply-label');
        applyBtnLabel.textContent = `Đẩy ${toApply} HS sang Vnedu`;
        document.getElementById('bulk-btn-apply').disabled = (toApply === 0);

        // Render rows
        const tbody = document.getElementById('bulk-table-body');
        const rows = [];
        const sorted = Array.from(nlpcBulkPayloads.values()).sort((a, b) => a.stt - b.stt);

        for (const item of sorted) {
            const nlcN = countSectionFields(item.payload.nang_luc_chung);
            const nldtN = countSectionFields(item.payload.nang_luc_dac_thu);
            const pcN = countSectionFields(item.payload.pham_chat);

            let rowClass = '';
            if (item.status === 'skipped') rowClass = 'bulk-row-skipped';
            else if (item.status === 'done') rowClass = 'bulk-row-done';
            else if (item.status === 'fail') rowClass = 'bulk-row-fail';
            else if (item.status === 'running') rowClass = 'bulk-row-running';

            // V.06: KHÔNG còn warning ⚠/⚠ per row. Nguồn dữ liệu là form Vnedu, badge
            // T/Đ/C đọc trực tiếp. NX đã sinh theo grade thật → tin cậy được.
            const warnIcon = '';

            const statIcon = (n) => n > 0
                ? `<span class="bulk-stat-ok">${n}</span>`
                : `<span class="bulk-stat-empty">—</span>`;

            const actionBtn = item.status === 'skipped'
                ? `<button class="bulk-row-act-btn" data-act="unskip" data-stt="${item.stt}">Đưa lại</button>`
                : `<button class="bulk-row-act-btn bulk-act-skip" data-act="skip" data-stt="${item.stt}">Bỏ</button>`;

            const statusBadge = item.status === 'done' ? '✓ '
                              : item.status === 'fail' ? '✗ '
                              : item.status === 'running' ? '⏳ '
                              : '';

            rows.push(`
                <tr class="${rowClass}">
                    <td>${item.stt}</td>
                    <td class="bulk-td-name">${statusBadge}${warnIcon}${escapeHtml(item.hoVaTen)}</td>
                    <td>${statIcon(nlcN)}</td>
                    <td>${statIcon(nldtN)}</td>
                    <td>${statIcon(pcN)}</td>
                    <td>${actionBtn}</td>
                </tr>
            `);
        }
        tbody.innerHTML = rows.join('');

        // Bind action buttons
        tbody.querySelectorAll('.bulk-row-act-btn').forEach(btn => {
            btn.onclick = () => {
                if (nlpcBulkRunning) return;
                const stt = parseInt(btn.dataset.stt);
                const act = btn.dataset.act;
                const item = nlpcBulkPayloads.get(stt);
                if (!item) return;
                if (act === 'skip') item.status = 'skipped';
                else if (act === 'unskip') item.status = 'pending';
                renderBulkPreview();
            };
        });
    }

    function countSectionFields(secObj) {
        if (!secObj) return 0;
        return Object.values(secObj).filter(t => t && t.trim()).length;
    }

    /**
     * Pha 2: chạy queue đẩy 35 HS sang Vnedu.
     * Hard stop on first race/timeout. Resume từ HS lỗi qua startFromStt.
     */
    async function runBulkApplyQueue(startFromStt = null) {
        if (!nlpcBulkPayloads || nlpcBulkPayloads.size === 0) {
            showToast('Chưa có payload — hãy bấm "Tạo NL-PC cho cả lớp" trước');
            return;
        }
        if (nlpcBulkRunning) return;

        const sorted = Array.from(nlpcBulkPayloads.values()).sort((a, b) => a.stt - b.stt);
        const queue = sorted.filter(item => {
            if (item.status === 'skipped') return false;
            if (item.status === 'done') return false; // đã làm rồi (resume)
            if (startFromStt && item.stt < startFromStt) return false;
            return true;
        });

        if (queue.length === 0) {
            showToast('Không còn HS nào để đẩy');
            return;
        }

        nlpcBulkRunning = true;
        nlpcBulkAbort = false;
        nlpcBulkStartFrom = null;

        const overlay = document.getElementById('bulk-running-overlay');
        const progressFill = document.getElementById('bulk-progress-fill');
        const progressText = document.getElementById('bulk-progress-text');
        const currentLabel = document.getElementById('bulk-running-current');
        overlay.style.display = 'flex';

        const total = queue.length;
        let doneN = 0, failN = 0;
        const failures = [];
        let firstFailStt = null;

        for (let i = 0; i < queue.length; i++) {
            if (nlpcBulkAbort) break;
            const item = queue[i];

            // Update UI
            item.status = 'running';
            renderBulkPreview();
            currentLabel.textContent = `HS #${item.stt} — ${item.hoVaTen}`;
            const pct = Math.round((i / total) * 100);
            progressFill.style.width = pct + '%';
            progressText.textContent = `${i} / ${total}`;

            const result = await sendBulkStep({
                stt: item.stt,
                expectedHS: item.hoVaTen,
                fillPayload: { ...item.payload, _expectedHS: item.hoVaTen },
                autoSave: true
            });

            if (result.success) {
                item.status = 'done';
                doneN++;
            } else {
                item.status = 'fail';
                item.reason = `${result.stage}: ${result.reason}`;
                failN++;
                failures.push({ stt: item.stt, hoVaTen: item.hoVaTen, stage: result.stage, reason: result.reason, lastSeen: result.lastSeen, actual: result.actual });
                if (!firstFailStt) firstFailStt = item.stt;

                // Hard stop on race/mismatch — không cascade
                if (result.stage === 'wait_active' || result.reason === 'hs_mismatch') {
                    renderBulkPreview();
                    progressText.textContent = `${i + 1} / ${total} · DỪNG`;
                    break;
                }
                // Soft fail (no_fields_filled, save timeout) → skip HS này, tiếp tục
            }

            renderBulkPreview();
            await new Promise(r => setTimeout(r, 200)); // breathing room giữa HS
        }

        // Cleanup
        nlpcBulkRunning = false;
        overlay.style.display = 'none';
        renderBulkPreview();

        // Hiện modal kết quả
        nlpcBulkStartFrom = firstFailStt;
        showBulkResultModal({ doneN, failN, total, failures, aborted: nlpcBulkAbort });
    }

    /** Gửi 1 step cho content-script, await response qua requestId */
    function sendBulkStep({ stt, expectedHS, fillPayload, autoSave }) {
        return new Promise((resolve, reject) => {
            const requestId = `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            _bulkStepResolvers.set(requestId, resolve);

            // Timeout an toàn 12s (1 step ~3-4s, đệm gấp đôi)
            setTimeout(() => {
                if (_bulkStepResolvers.has(requestId)) {
                    _bulkStepResolvers.delete(requestId);
                    resolve({ success: false, stage: 'timeout', reason: 'no_response_12s', stt, expectedHS });
                }
            }, 12000);

            parent.postMessage({
                type: 'COGIAO_NLPC_BULK_STEP',
                payload: { requestId, stt, expectedHS, fillPayload, autoSave }
            }, '*');
        });
    }

    function showBulkResultModal({ doneN, failN, total, failures, aborted }) {
        const modal = document.getElementById('bulk-result-modal');
        const iconEl = document.getElementById('bulk-result-icon');
        const titleEl = document.getElementById('bulk-result-title');
        const bodyEl = document.getElementById('bulk-result-body');
        const resumeBtn = document.getElementById('bulk-result-resume');

        // Tip phòng tránh Vnedu framework bug khi switch module (ext-all.js getAt undefined).
        // Hiện trong MỌI trạng thái kết thúc bulk vì GV thường tiếp tục sang module khác sau đó.
        const f5Tip = `
            <div class="bulk-result-tip">
                <span class="bulk-result-tip-icon">💡</span>
                <span><strong>Mẹo:</strong> Trước khi chuyển sang module khác (Sổ NX môn / Sổ điểm),
                bấm <strong>F5</strong> để làm mới trang Vnedu — tránh lỗi nội bộ của Vnedu khi
                switch module.</span>
            </div>
        `;

        if (failN === 0 && !aborted) {
            iconEl.textContent = '✅';
            titleEl.textContent = 'Xong! Đã đẩy tất cả NL-PC';
            bodyEl.innerHTML = `Hoàn tất <strong>${doneN}/${total}</strong> HS. Tất cả đã được Lưu vào Vnedu.` + f5Tip;
            resumeBtn.style.display = 'none';
        } else if (aborted) {
            iconEl.textContent = '⏸️';
            titleEl.textContent = 'Đã dừng theo yêu cầu';
            bodyEl.innerHTML = `Đã đẩy thành công <strong>${doneN}/${total}</strong> HS trước khi dừng.`
                + (nlpcBulkStartFrom ? `<br><br>Có thể tiếp tục từ HS #${nlpcBulkStartFrom}.` : '')
                + f5Tip;
            resumeBtn.style.display = nlpcBulkStartFrom ? '' : 'none';
        } else {
            iconEl.textContent = '⚠️';
            titleEl.textContent = `Đã dừng — ${doneN} OK, ${failN} lỗi`;
            const failList = failures.map(f => {
                const detail = f.stage === 'wait_active'
                    ? `Vnedu hiển thị "${f.lastSeen || '?'}" thay vì "${f.hoVaTen}"`
                    : f.actual
                        ? `Vnedu đang ở "${f.actual}"`
                        : `${f.stage}: ${f.reason}`;
                return `<li><strong>HS #${f.stt}</strong> (${escapeHtml(f.hoVaTen)}): ${escapeHtml(detail)}</li>`;
            }).join('');
            bodyEl.innerHTML = `
                <p>Đã làm thành công <strong>${doneN}/${total}</strong>. Dừng tại HS #${failures[0]?.stt}.</p>
                <ul>${failList}</ul>
                <p style="margin-top:8px;font-size:11.5px;color:#777">Kiểm tra panel HS bên trái Vnedu (đang ở đúng HS chưa?), sau đó bấm <strong>Tiếp tục</strong>.</p>
                ${f5Tip}
            `;
            resumeBtn.style.display = nlpcBulkStartFrom ? '' : 'none';
        }

        modal.style.display = 'flex';
    }

    function closeBulkResultModal() {
        document.getElementById('bulk-result-modal').style.display = 'none';
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

        // V6: nếu rời pending → dừng polling
        if (state.status !== 'pending' && window.LicenseClient && LicenseClient.isPolling()) {
            LicenseClient.stopPolling();
        }

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
            box.className = 'lic-status lic-status-pending';
            box.innerHTML = '⏳ Đã đăng ký — vui lòng chuyển khoản để hoàn tất';
            formPending.style.display = 'block';
            document.getElementById('lic-pending-sdt').textContent = state.sdt || '—';
            document.getElementById('lic-pending-name').textContent = state.hoTen || '—';
            // V6: mã = SĐT cho user mới, hoặc mã 4 ký tự cho user cũ. Server đã trả `ma`.
            document.getElementById('lic-pending-ma').textContent = state.ma || '—';

            // V6.1.2: caption dynamic — admin/legacy có mã khác SĐT
            const hintEl = document.getElementById('lic-ck-hint');
            if (hintEl) {
                const maEqualsSdt = state.ma && state.sdt &&
                    String(state.ma).replace(/\s+/g,'') === String(state.sdt).replace(/\s+/g,'');
                hintEl.textContent = maEqualsSdt
                    ? '(Chính là số điện thoại của thầy/cô — gõ đúng để hệ thống nhận diện)'
                    : '(Gõ đúng nội dung trên khi chuyển khoản — hệ thống sẽ tự nhận diện thanh toán)';
            }

            // Load ảnh QR từ thư mục extension
            const qrImg = document.getElementById('lic-qr-img');
            try {
                qrImg.src = chrome.runtime.getURL('license/qr.png');
                qrImg.style.display = '';
                document.getElementById('lic-qr-fallback').style.display = 'none';
            } catch (e) { /* extension context khác */ }

            // V6: bắt đầu polling adaptive nếu chưa chạy
            startLicensePolling_(state.sdt);
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
                // V6: case đặc biệt — đã paid trước đó (đổi máy / admin) → auto-activated
                if (res.autoActivated) {
                    showToast('✓ Đã kích hoạt cho ' + (res.gv_ho_ten || res.sdt));
                    document.getElementById('lic-reg-hoten').value = '';
                    document.getElementById('lic-reg-sdt').value = '';
                    await refreshLicenseUI();
                    closeLockModal();
                    return;
                }
                showToast(res.daDangKyTruoc
                    ? 'SĐT đã đăng ký — hiển thị lại nội dung CK'
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

    // V6: copy nội dung CK (= SĐT) vào clipboard
    async function handleCopyMaClick() {
        const ma = (document.getElementById('lic-pending-ma').textContent || '').trim();
        if (!ma || ma === '—') return;
        try {
            await navigator.clipboard.writeText(ma);
            showToast('✓ Đã copy "' + ma + '" — dán vào nội dung CK');
        } catch (e) {
            // Fallback cho môi trường không có Clipboard API
            const ta = document.createElement('textarea');
            ta.value = ma;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); showToast('✓ Đã copy ' + ma); }
            catch (err) { showToast('Không copy được, vui lòng chọn và Ctrl+C'); }
            document.body.removeChild(ta);
        }
    }

    // V6: cô bấm "Kiểm tra ngay" sau khi polling auto đã give up
    async function handleCheckNowClick() {
        const state = licenseState;
        if (!state || state.status !== 'pending' || !state.sdt) return;

        const btn = document.getElementById('lic-btn-check-now');
        btn.disabled = true; const oldText = btn.textContent; btn.textContent = 'Đang kiểm tra...';
        try {
            const res = await LicenseClient.checkPaymentStatus(state.sdt);
            if (res.ok && res.status === 'da_tra_tien') {
                // Thầy đã tick — gọi dangKy lại để trigger flow autoActivated
                const dk = await LicenseClient.dangKy(state.sdt, state.hoTen || 'GV');
                if (dk.ok && dk.autoActivated) {
                    showToast('✓ Đã kích hoạt cho ' + (dk.gv_ho_ten || dk.sdt));
                    await refreshLicenseUI();
                    closeLockModal();
                    return;
                }
            } else if (res.ok && res.status === 'cho_thanh_toan') {
                showToast('Thầy chưa xác nhận. Vui lòng đợi hoặc nhắn Zalo 0913031073.');
                startLicensePolling_(state.sdt);  // tiếp tục poll
            } else if (res.ok && res.status === 'khong_ton_tai') {
                showToast('Pending lệch server. Đang đăng ký lại...');
                await LicenseClient.clearPending();
                await refreshLicenseUI();
            } else {
                showToast(mapLicenseError(res));
            }
        } finally {
            btn.disabled = false; btn.textContent = oldText;
        }
    }

    // V6 polling helper — gọi từ renderLicenseSection khi vào pending.
    // Tránh start trùng (LicenseClient tự dọn timer cũ trong startPolling).
    function startLicensePolling_(sdt) {
        if (!sdt || !window.LicenseClient) return;
        document.getElementById('lic-btn-check-now').style.display = 'none';

        LicenseClient.startPolling(sdt, {
            onActivated: async (bindRes) => {
                showToast('🎉 Đã kích hoạt thành công cho ' + (bindRes.gv_ho_ten || bindRes.sdt));
                await refreshLicenseUI();
                closeLockModal();
            },
            onGiveUp: async (errRes) => {
                // Hết 30 phút polling, hoặc bind fail (đã active máy khác)
                if (errRes && errRes.error) {
                    showToast(mapLicenseError(errRes));
                    if (errRes.error === 'da_kich_hoat_o_may_khac' ||
                        errRes.error === 'da_dung_cho_may_khac') {
                        // Xóa pending vì SĐT đã active ở máy khác — trở lại form đăng ký
                        await LicenseClient.clearPending();
                        await refreshLicenseUI();
                        return;
                    }
                }
                const btn = document.getElementById('lic-btn-check-now');
                if (btn) btn.style.display = 'block';
            }
        });
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
        if (!confirm('Hủy đăng ký này? (Nếu đã chuyển khoản, vui lòng nhắn Zalo thầy Chung 0913031073)')) return;
        if (window.LicenseClient && LicenseClient.stopPolling) LicenseClient.stopPolling();
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
            'ma_sai_dinh_dang': 'Mã không hợp lệ. Vui lòng kiểm tra lại.',
            'sdt_chua_dang_ky': 'SĐT chưa đăng ký. Bấm "Bắt đầu kích hoạt" trước.',
            'ma_khong_dung': 'Mã không khớp với SĐT. Kiểm tra lại.',
            'chua_thanh_toan': 'Hệ thống chưa ghi nhận thanh toán. Vui lòng đợi sau khi CK. Nếu đã CK lâu, nhắn Zalo thầy Chung 0913031073.',
            'da_dung_cho_may_khac': 'SĐT này đã kích hoạt ở máy khác. Theo chính sách 30k/1 máy, vui lòng nhắn Zalo thầy Chung 0913031073.',
            'da_kich_hoat_o_may_khac': 'SĐT này đã kích hoạt ở máy khác. Theo chính sách 30k/1 máy, vui lòng nhắn Zalo thầy Chung 0913031073.',
            'het_han': 'Đã hết hạn. Đăng ký gia hạn (thao tác lại từ đầu).',
            'sdt_da_bi_khoa': 'SĐT đã bị khóa. Nhắn Zalo thầy Chung 0913031073.',
            'thieu_device_fingerprint': 'Không lấy được mã định danh thiết bị.',
            'network': 'Lỗi kết nối mạng. Thử lại sau.',
            'rate_limit': 'Quá nhiều yêu cầu. Đợi 1 phút rồi thử lại.',
            'server_chua_cau_hinh': 'Hệ thống license chưa cấu hình. Báo quản trị.',
            'chua_setup_sheet': 'Server chưa setup sheet. Báo quản trị.',
            'server_chua_deploy_v3': 'Apps Script server chưa deploy phiên bản v3. Báo quản trị: Apps Script → Deploy → Manage deployments → New version.',
            'unknown_action': 'Server không hiểu yêu cầu. Báo quản trị deploy lại Apps Script v3.'
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

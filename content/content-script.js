/**
 * Content script - Entry point khi vào trang Vnedu
 *
 * Luồng:
 *   1. Đợi Vnedu render xong DOM (Vnedu là SPA-like, render chậm)
 *   2. Tự động mount sidebar iframe bên phải màn hình
 *   3. Đọc context Vnedu, gửi sang sidebar
 *   4. Lắng nghe yêu cầu từ sidebar và ghi nhận xét vào DOM Vnedu
 */

(function () {
    'use strict';

    console.log('%c[Sổ nhận xét - AI]', 'background:#1D9E75;color:white;padding:2px 6px;border-radius:3px',
        'Content script loaded on', location.href);

    const SIDEBAR_ID = 'cogiao-ai-sidebar';
    const TOGGLE_BTN_ID = 'cogiao-ai-toggle';

    // V6.0.2: Vendor Vnedu (Ext.js) thỉnh thoảng throw uncaught exception khi
    // switch module — Vnedu KHÔNG cleanup Ext.js component cũ → fire setValue/
    // checkChange/updateCharCount đụng reference đã destroy → undefined.
    //   - `Cannot read 'getAt' of undefined` (ext-all.js): AJAX store callback
    //   - `Cannot read 'update' of undefined` (so_hoc_ba_c1.js): updateCharCount
    // Spam exception này làm Vnedu form "đơ cục bộ" khi click HS thứ 2-3.
    //
    // Content-script chạy trong ISOLATED WORLD → window.addEventListener('error')
    // KHÔNG bắt được lỗi từ PAGE CONTEXT (ext-all.js). Phải inject script vào
    // page context (page-error-bridge.js) để bắt + postMessage bridge ra đây.
    //
    // Counter spam: >= 5 lỗi trong 10s → hiện banner đề xuất F5 trong sidebar.
    let _vendorErrCount = 0;
    let _vendorErrWindowStart = 0;
    let _vendorErrAlertSent = false;
    const _VENDOR_ERR_THRESHOLD = 5;
    const _VENDOR_ERR_WINDOW_MS = 10000;

    function handleVendorError(filename, message) {
        const now = Date.now();
        if (now - _vendorErrWindowStart > _VENDOR_ERR_WINDOW_MS) {
            _vendorErrWindowStart = now;
            _vendorErrCount = 0;
            _vendorErrAlertSent = false;
        }
        _vendorErrCount++;
        if (_vendorErrCount === 1) {
            // V6.0.2: dùng console.log (info) thay warn — đây là VENDOR lỗi, không
            // phải extension lỗi. Chrome Extensions panel "Lỗi" hiển thị warn → user
            // hoang mang tưởng extension có vấn đề.
            console.log(`[Sổ nhận xét - AI] Vnedu vendor exception: ${message} @ ${filename}`);
        }
        if (_vendorErrCount >= _VENDOR_ERR_THRESHOLD && !_vendorErrAlertSent) {
            _vendorErrAlertSent = true;
            console.log(`[Sổ nhận xét - AI] Vnedu lỗi nội bộ ${_vendorErrCount} lần trong 10s → đề xuất F5`);
            const iframe = document.getElementById(SIDEBAR_ID);
            iframe?.contentWindow?.postMessage({
                type: 'COGIAO_VNEDU_HEALTH_BAD',
                payload: { errCount: _vendorErrCount }
            }, '*');
        }
    }

    // Inject page-error-bridge vào main world để bắt lỗi vendor
    function injectPageErrorBridge() {
        try {
            const s = document.createElement('script');
            s.src = chrome.runtime.getURL('content/page-error-bridge.js');
            s.onload = () => s.remove();
            (document.head || document.documentElement).appendChild(s);
        } catch (e) {
            console.warn('[Sổ nhận xét - AI] Không inject được page-error-bridge:', e);
        }
    }
    injectPageErrorBridge();

    // 6.3.0: cầu nối Sổ chủ nhiệm (CKEditor, ExtJS chỉ đọc/ghi được ở main world)
    let _scnState = { active: false };
    function injectScnBridge() {
        try {
            const s = document.createElement('script');
            s.src = chrome.runtime.getURL('content/scn-bridge.js');
            s.onload = () => s.remove();
            (document.head || document.documentElement).appendChild(s);
        } catch (e) {
            console.warn('[Sổ nhận xét - AI] Không inject được scn-bridge:', e);
        }
    }
    injectScnBridge();

    /** Module đang mở: 2 màn cũ (adapter) hoặc Sổ chủ nhiệm (cầu nối báo). */
    function detectCurrentModule() {
        const m = window.VneduAdapter.detectModule();
        if (m) return m;
        return _scnState && _scnState.active ? 'so-chu-nhiem' : null;
    }
    const AI_MODULES = ['so-nhan-xet', 'nlpc', 'so-chu-nhiem'];

    window.addEventListener('message', (e) => {
        if (e.source !== window || !e.data) return;
        const d = e.data;
        if (d.type === '__COGIAO_SCN_STATE__' && d.state && typeof d.state === 'object') {
            _scnState = d.state;
            return;
        }
        if (d.type === '__COGIAO_SCN_FILL_RESULT__' || d.type === '__COGIAO_SCN_SAVE_RESULT__' || d.type === '__COGIAO_SCN_SYNC_RESULT__' || d.type === '__COGIAO_SCN_OPEN_RESULT__' || d.type === '__COGIAO_SCN_SODO_RESULT__') {
            const iframe = document.getElementById(SIDEBAR_ID);
            iframe?.contentWindow?.postMessage({
                type: d.type === '__COGIAO_SCN_FILL_RESULT__' ? 'COGIAO_SCN_FILL_RESULT'
                    : d.type === '__COGIAO_SCN_SYNC_RESULT__' ? 'COGIAO_SCN_SYNC_RESULT'
                    : d.type === '__COGIAO_SCN_OPEN_RESULT__' ? 'COGIAO_SCN_OPEN_RESULT'
                    : d.type === '__COGIAO_SCN_SODO_RESULT__' ? 'COGIAO_SCN_SODO_RESULT' : 'COGIAO_SCN_SAVE_RESULT',
                payload: { reqId: d.reqId, result: d.result }
            }, '*');
            if (d.type === '__COGIAO_SCN_SAVE_RESULT__') _suppressUpdatesUntil = Date.now() + 2500;
        }
    });

    let _vneduAccount = null;   // 6.2.0
    function askVneduAccount() {
        try { window.postMessage({ type: '__COGIAO_ASK_ACCOUNT__' }, '*'); } catch (e) { /* silent */ }
    }

    // 6.2.0: vnEdu có thanh tác vụ riêng ở đáy màn hình (z-index rất cao) che mất chân khung.
    // Khung dừng ngay phía trên thanh đó để cả hai cùng hiện đủ.
    let _lastTaskbarH = -1;
    function fitSidebarAboveTaskbar() {
        const iframe = document.getElementById(SIDEBAR_ID);
        if (!iframe) return;
        let h = 0;
        try {
            const bars = document.querySelectorAll('.ux-taskbar, .x-docked-bot.x-toolbar');
            for (const b of bars) {
                const r = b.getBoundingClientRect();
                if (r.height > 0 && r.height < 120 && r.width > window.innerWidth * 0.5 &&
                    Math.abs(r.bottom - window.innerHeight) < 4) { h = Math.max(h, Math.ceil(r.height)); }
            }
        } catch (e) { /* silent */ }
        if (h === _lastTaskbarH) return;
        _lastTaskbarH = h;
        iframe.style.height = h ? ('calc(100vh - ' + h + 'px)') : '';
    }
    window.addEventListener('resize', fitSidebarAboveTaskbar);
    setInterval(() => {
        fitSidebarAboveTaskbar();
        // 6.3.6: vnEdu dựng lại trang lúc khởi động có thể gỡ mất khung bảng bên
        // (thẻ xanh vẫn còn) → gắn lại, nếu không bấm thẻ sẽ không thấy gì.
        if (document.getElementById(TOGGLE_BTN_ID) && !document.getElementById(SIDEBAR_ID)) {
            console.log('[Sổ nhận xét - AI] Khung bảng bên bị gỡ → gắn lại');
            mountSidebar();
        }
    }, 2500);

    /** 6.2.0: vnEdu ghi "Quyền hạn: Bạn không có quyền nhập điểm" khi tài khoản không phụ trách lớp/môn. */
    function vneduBaoKhongCoQuyen() {
        try {
            const snap = document.evaluate("//*[contains(text(),'không có quyền nhập')]", document, null,
                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            for (let i = 0; i < snap.snapshotLength; i++) {
                const el = snap.snapshotItem(i);
                if (el.closest && el.closest('#' + SIDEBAR_ID)) continue;
                const r = el.getBoundingClientRect();
                if (r.width > 0 && r.height > 0 && el.offsetParent !== null) return true;
            }
        } catch (e) { /* silent */ }
        return false;
    }

    function mountSidebar() {
        if (document.getElementById(SIDEBAR_ID)) return;

        const iframe = document.createElement('iframe');
        iframe.id = SIDEBAR_ID;
        iframe.src = chrome.runtime.getURL('sidebar/sidebar.html');
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allow', 'clipboard-write');

        // V6.0.2: Sidebar LUÔN ẨN mặc định. Chỉ hiện khi GV vào module NX
        // ("Nhập số điểm" hoặc "Phẩm chất - Năng lực ghi học bạ" từ Start Vnedu)
        // → logic auto-show trong checkModuleChange kích hoạt. Khi GV rời module
        // → auto-hide. Không persist auto-state.
        iframe.classList.add('cogiao-ai-hidden');
        _aiPaused = true;

        document.body.appendChild(iframe);

        iframe.addEventListener('load', () => {
            fitSidebarAboveTaskbar();
            setTimeout(() => {
                askVneduAccount();
                sendContextToSidebar();
                setupModuleWatcher();  // v0.1.12: bắt SPA navigation
                // V6.0.2: Nếu GV reload page khi đang ở module NX, watcher chưa
                // fire kịp → check current ngay sau mount để auto-show không trễ.
                try {
                    const current = detectCurrentModule();
                    if (AI_MODULES.includes(current)) {
                        iframe.classList.remove('cogiao-ai-hidden');
                        _aiPaused = false;
                        capNhatGoiY();
                        console.log(`[Sổ nhận xét - AI] Mount xong, đang ở module "${current}" → auto-show`);
                    }
                } catch (e) { /* silent */ }
            }, 300);
        });

        createToggleButton();
    }

    // 6.3.6: thẻ mở luôn hiện ở mép phải MỌI trang vnEdu (trước đây là dải 22px chữ
    // "Đóng / Mở" rất mờ — GV kích hoạt xong không biết tiện ích nằm đâu).
    const HINT_ID = 'cogiao-ai-hint';
    const HINT_KEY = 'snx_launcher_seen_v1';
    function createToggleButton() {
        if (document.getElementById(TOGGLE_BTN_ID)) return;
        const btn = document.createElement('button');
        btn.id = TOGGLE_BTN_ID;
        btn.type = 'button';
        btn.title = 'Sổ nhận xét - AI · Bấm để mở hoặc đóng';
        const icon = document.createElement('img');
        icon.className = 'toggle-icon';
        icon.alt = '';
        icon.src = chrome.runtime.getURL('icons/icon-48.png');
        const label = document.createElement('span');
        label.className = 'toggle-label';
        label.textContent = 'Nhận xét AI';
        btn.appendChild(icon);
        btn.appendChild(label);
        btn.onclick = () => { anGoiY(true); toggleSidebar(); };
        document.body.appendChild(btn);
        capNhatGoiY();
        hienGoiYLanDau();
    }

    /** Lần đầu: một dòng chỉ vào thẻ mở. Bấm thẻ hoặc dấu × thì thôi không hiện nữa. */
    function hienGoiYLanDau() {
        try {
            chrome.storage.local.get(HINT_KEY, (r) => {
                if (r && r[HINT_KEY]) return;
                if (document.getElementById(HINT_ID)) return;
                const box = document.createElement('div');
                box.id = HINT_ID;
                box.setAttribute('role', 'status');
                box.innerHTML = '<span class="hint-text"><b>Sổ nhận xét - AI</b> ở đây. Bấm thẻ xanh để mở.</span>' +
                    '<button type="button" class="hint-close" title="Đã hiểu">×</button>';
                box.querySelector('.hint-close').onclick = () => anGoiY(true);
                document.body.appendChild(box);
                capNhatGoiY();
            });
        } catch (e) { /* silent */ }
    }
    function anGoiY(luu) {
        const box = document.getElementById(HINT_ID);
        if (box) box.remove();
        if (luu) { try { chrome.storage.local.set({ [HINT_KEY]: 1 }); } catch (e) { /* silent */ } }
    }
    /** Gợi ý chỉ hiện khi thanh bên đang đóng (thẻ nằm sát mép phải). */
    function capNhatGoiY() {
        const iframe = document.getElementById(SIDEBAR_ID);
        const dong = !iframe || iframe.classList.contains('cogiao-ai-hidden');
        const btn = document.getElementById(TOGGLE_BTN_ID);
        if (btn) btn.classList.toggle('snx-mo', !dong);
        const box = document.getElementById(HINT_ID);
        if (box) box.style.display = dong ? '' : 'none';
    }

    // 6.3.6: báo service worker màn đang mở → dấu xanh trên biểu tượng tiện ích của tab này.
    let _lastBadgeModule = undefined;
    function baoManChoBieuTuong(module) {
        if (module === _lastBadgeModule) return;
        _lastBadgeModule = module;
        try { chrome.runtime.sendMessage({ type: 'SNX_MODULE', module: module || null }).catch(() => {}); } catch (e) { /* silent */ }
    }

    // 6.3.6: nút "Mở giúp tôi" ở màn Bắt đầu → tự mở đúng màn vnEdu.
    let _dangMoMan = false;
    async function handleOpenModule(payload) {
        const iframe = document.getElementById(SIDEBAR_ID);
        const traLoi = (result) => iframe?.contentWindow?.postMessage({
            type: 'COGIAO_OPEN_MODULE_RESULT', payload: { target: payload && payload.target, result }
        }, '*');
        const target = payload && payload.target;
        if (!['so-nhan-xet', 'nlpc', 'scn1', 'scn2'].includes(target)) { traLoi({ success: false, reason: 'bad_target' }); return; }
        if (_dangMoMan) { traLoi({ success: false, reason: 'busy' }); return; }
        _dangMoMan = true;
        try {
            const r = await window.VneduAdapter.openVneduModule(target);
            traLoi(r || { success: false });
            // Màn mới mở → quét ngay cho thanh bên đổi sang màn làm việc
            setTimeout(checkModuleChange, 800);
            setTimeout(checkModuleChange, 2500);
        } catch (e) {
            traLoi({ success: false, reason: 'exception', error: e && e.message });
        } finally {
            _dangMoMan = false;
        }
    }

    let _lastDetectedModule = null;
    let _lastContextKey = null;  // pathname|lop|mon (Sổ NX) hoặc pathname|lop (NLPC)
    let _lastDataSignature = null;  // chữ ký dữ liệu HS — đổi khi GV nhập/sửa điểm trên Vnedu
    let _consecutiveNullCount = 0;  // V.06: phân biệt popup/mask thoáng (null 1-2 lần) vs navigation thật (null 3+)

    // V.05 fix lag: throttle checkModuleChange để giảm tải CPU khi Vnedu animation
    // gây mutation observer fire liên tục (sau save / switch class).
    let _lastCheckRunTime = 0;
    const _MIN_CHECK_INTERVAL_MS = 1200;

    /**
     * Chữ ký gọn của dữ liệu HS hiện tại. Khi GV nhập thêm điểm / xếp loại bên Vnedu,
     * chữ ký đổi → watcher tự rescan mà KHÔNG cần GV bấm "Cập nhật dữ liệu".
     */
    function computeDataSignature(module) {
        try {
            if (module === 'so-nhan-xet') {
                const rows = window.VneduAdapter.getStudentRows();
                return 'sonx:' + rows.length + ':' +
                    rows.map(r => `${r.stt}/${r.diem}/${r.mucDat || ''}/${r.daCoNhanXet ? 1 : 0}`).join(',');
            }
            if (module === 'nlpc') {
                const list = window.VneduAdapter.getNLPCStudentList();
                const sel = list.find(s => s.isSelected);
                return 'nlpc:' + list.length + ':' + (sel ? sel.stt + '-' + sel.hoVaTen : 'none');
            }
            if (module === 'so-chu-nhiem') return 'scn:' + (_scnState.sig || '');
        } catch (e) { /* im lặng — chữ ký rỗng coi như chưa có dữ liệu */ }
        return '';
    }

    function sendContextToSidebar() {
        const iframe = document.getElementById(SIDEBAR_ID);
        if (!iframe || !iframe.contentWindow) return;

        const module = detectCurrentModule();
        _lastDetectedModule = module;  // track để MutationObserver compare
        baoManChoBieuTuong(module);
        let payload = { module, context: {}, students: [], account: _vneduAccount };

        if (module === 'so-nhan-xet') {
            const context = window.VneduAdapter.getContext();
            const studentRows = window.VneduAdapter.getStudentRows();
            payload.context = Object.assign({}, context, { khongCoQuyenNhap: vneduBaoKhongCoQuyen() });
            payload.students = studentRows.map(r => ({
                stt: r.stt, hoVaTen: r.hoVaTen,
                diem: r.diem,
                mucDat: r.mucDat,  // v0.1.19: mức chữ T/H/C cho môn không có điểm
                daCoNhanXet: r.daCoNhanXet
            }));
        } else if (module === 'so-chu-nhiem') {
            payload.context = _scnState;
        } else if (module === 'nlpc') {
            const context = window.VneduAdapter.getNLPCContext();
            const list = window.VneduAdapter.getNLPCStudentList();
            payload.context = context;
            payload.students = list.map(s => ({
                stt: s.stt, hoVaTen: s.hoVaTen, isSelected: s.isSelected
            }));
        }

        console.log('[Sổ nhận xét - AI] Gửi context sang sidebar:', {
            module: payload.module, context: payload.context, studentCount: payload.students.length
        });

        iframe.contentWindow.postMessage({ type: 'VNEDU_CONTEXT', payload }, '*');

        // Cập nhật baseline chữ ký dữ liệu để watcher so sánh lần sau
        _lastDataSignature = computeDataSignature(module);

        // Phase 1: SILENT cache điểm khi detect Sổ NX môn
        triggerSilentCacheIfSoNX();
    }

    /**
     * v0.1.15: 2 cơ chế song song để bắt SPA navigation của Vnedu Ext.js:
     *   - MutationObserver: response NHANH (~600ms debounce) khi DOM thay đổi
     *   - Polling 1.5s: BACKUP catch case observer miss (Ext.js cardpanel
     *     swap z-index có thể không trigger childList mutation đáng kể)
     */
    let _mutationDebounce = null;
    function setupModuleWatcher() {
        if (window._cogiaoWatcherActive) return;
        window._cogiaoWatcherActive = true;

        // 1) Observer cho response NHANH (V.05: 600 → 1000ms để chờ Ext.js animation xong)
        const observer = new MutationObserver(() => {
            clearTimeout(_mutationDebounce);
            _mutationDebounce = setTimeout(checkModuleChange, 1000);
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class', 'hidden']
        });

        // 2) Polling backup (V.06: 3000 → 1500ms — auto-hide/auto-show cần nhanh hơn)
        setInterval(checkModuleChange, 1500);

        // 3) Bắt GV nhập/sửa điểm trực tiếp trên Vnedu (V.05: 600 → 1000ms debounce).
        ['input', 'change'].forEach(evt => {
            document.addEventListener(evt, (e) => {
                const t = e.target;
                if (!t || (t.closest && t.closest('#cogiao-ai-sidebar'))) return;
                clearTimeout(_mutationDebounce);
                _mutationDebounce = setTimeout(checkModuleChange, 1000);
            }, true);
        });

        console.log('[Sổ nhận xét - AI] Watcher active — MutationObserver(1s) + polling(3s) + input/change(1s)');
    }

    let _suppressUpdatesUntil = 0;  // BUG-010: suppress watcher updates trong 3s sau Lưu
    let _aiPaused = false;  // V.05: user toggle "Tạm dừng AI"

    // V.05: Đọc setting tạm dừng từ chrome.storage để khôi phục sau reload
    try {
        chrome.storage.local.get('ai_paused_v1', (r) => {
            _aiPaused = !!(r && r.ai_paused_v1);
            if (_aiPaused) console.log('[Sổ nhận xét - AI] AI đang tạm dừng (đã lưu từ phiên trước)');
        });
        chrome.storage.onChanged?.addListener((changes, area) => {
            if (area === 'local' && changes.ai_paused_v1) {
                _aiPaused = !!changes.ai_paused_v1.newValue;
                console.log('[Sổ nhận xét - AI] AI ' + (_aiPaused ? 'TẠM DỪNG' : 'BẬT LẠI'));
            }
        });
    } catch (e) { /* silent */ }

    /**
     * V.05: Detect Vnedu đang busy (Ext.js loading mask, spinner). Khi busy → pause
     * watcher để không cạnh tranh CPU với Vnedu's rendering.
     */
    function isVneduBusy() {
        const masks = document.querySelectorAll('.x-mask, .x-mask-loading, .x-mask-msg, .x-loading');
        for (const m of masks) {
            if (m.closest('#cogiao-ai-sidebar')) continue;
            const s = window.getComputedStyle(m);
            if (s.display === 'none' || s.visibility === 'hidden') continue;
            const r = m.getBoundingClientRect();
            if (r.width > 50 && r.height > 50) return true;  // mask đáng kể đang hiển thị
        }
        return false;
    }

    // 6.3.2: vnEdu giữ bảng HS cũ (đổi lớp/kỳ/màn nhiều lần không dọn) → hay sinh lỗi nội bộ,
    // form đứng, phải F5. Thấy dấu hiệu này ở màn NL-PC thì nhắc GV làm mới trang TRƯỚC khi làm.
    let _bangCuDaBao = '';
    function baoBangCuNeuCo(module, contextKey) {
        try {
            if (module !== 'nlpc') return;
            const n = window.VneduAdapter._nlpcSoBangCu || 0;
            if (!n || _bangCuDaBao === contextKey) return;
            _bangCuDaBao = contextKey;
            console.log(`[Sổ nhận xét - AI] vnEdu đang giữ ${n} bảng HS cũ → nhắc làm mới trang`);
            document.getElementById(SIDEBAR_ID)?.contentWindow?.postMessage({
                type: 'COGIAO_VNEDU_HEALTH_BAD', payload: { lyDo: 'bang_cu', soBang: n }
            }, '*');
        } catch (e) { /* silent */ }
    }

    function checkModuleChange() {
        if (!window.VneduAdapter) return;
        // V.06: BỎ early return khi _aiPaused — detect cần chạy CẢ KHI sidebar ẩn,
        // để auto-show có cơ hội fire khi GV vào module NX (sidebar "thức dậy").
        // Tradeoff CPU rất nhỏ vì throttle 1200ms + detectModule chỉ tìm 1 text marker.
        //
        // V.05: Auto-pause khi Vnedu đang busy (loading mask, spinner)
        if (isVneduBusy()) return;
        // BUG-010: suppress sau autoSave
        if (Date.now() < _suppressUpdatesUntil) return;

        // V.05: Throttle min 1200ms giữa 2 lần check để tránh CPU spike khi Vnedu
        // animate (sau save / switch class). Mutation observer + polling + input/change
        // có thể fire 10+ lần trong 1s → mỗi lần checkModuleChange gọi getContext quét
        // 10k+ DOM elements → Vnedu lag.
        const now = Date.now();
        if (now - _lastCheckRunTime < _MIN_CHECK_INTERVAL_MS) return;
        _lastCheckRunTime = now;

        const current = detectCurrentModule();

        // V.05/V.06: Phân biệt popup/mask thoáng vs navigation thật.
        // - Null 1-2 lần liên tiếp (~2s) → có thể là popup/mask Vnedu sau save → giữ state cũ
        // - Null 3+ lần liên tiếp (~3-6s) → GV thực sự đã rời module NX → cho phép process
        //   (sẽ trigger auto-hide sidebar nếu module trước là NX)
        if (current === null) {
            _consecutiveNullCount++;
            // V6.0.2 compromise: threshold 3 (~3.6s) — giảm từ 4 theo yêu cầu user
            // "ẩn nhanh hơn", nhưng KHÔNG xuống 2 (2.4s) vì Vnedu Ext.js loading mask
            // có thể che detect ~2.5s gây show/hide loop → spam vendor exception khi
            // re-query DOM mỗi cycle.
            if (_lastDetectedModule !== null && _consecutiveNullCount < 3) {
                return;
            }
            // Null 3+ lần (~3.6s) → confirm navigation thật → fall through
        } else {
            _consecutiveNullCount = 0;
        }

        let contextKey = current || 'null';
        if (current === 'so-nhan-xet') {
            const ctx = window.VneduAdapter.getContext();
            contextKey += '|' + (ctx.lop || '') + '|' + (ctx.mon || '');
        } else if (current === 'nlpc') {
            const ctx = window.VneduAdapter.getNLPCContext();
            contextKey += '|' + (ctx.lop || '');
        } else if (current === 'so-chu-nhiem') {
            contextKey += '|' + [_scnState.mau, _scnState.section, _scnState.lop, _scnState.thang].join('|');
        }

        // Chữ ký dữ liệu — đổi khi GV nhập điểm / xếp loại mà KHÔNG đổi lớp/môn
        const dataSig = computeDataSignature(current);

        const moduleOrCtxChanged = current !== _lastDetectedModule || contextKey !== _lastContextKey;
        const dataChanged = dataSig !== _lastDataSignature;

        if (moduleOrCtxChanged || dataChanged) {
            console.log(`[Sổ nhận xét - AI] %cAuto-detect change%c: ${_lastDetectedModule}/${_lastContextKey} → ${current}/${contextKey}` +
                (dataChanged && !moduleOrCtxChanged ? ' (dữ liệu HS thay đổi)' : ''),
                'color:#2B4F9E;font-weight:bold', 'color:inherit');

            // V.06: Auto show/hide sidebar 2 chiều theo module Vnedu.
            //   - Rời NX → ẩn (giải phóng không gian khi GV làm việc khác)
            //   - Vào NX → hiện (sidebar "thức dậy" khi đến nhiệm vụ của nó)
            // KHÔNG persist vào chrome.storage — auto là ephemeral. Manual toggle vẫn persist.
            if (moduleOrCtxChanged) {
                const wasNX = AI_MODULES.includes(_lastDetectedModule);
                const isNX = AI_MODULES.includes(current);
                const iframe = document.getElementById(SIDEBAR_ID);

                if (wasNX && !isNX && iframe && !iframe.classList.contains('cogiao-ai-hidden')
                    && Date.now() - _moTayLuc > 6000) {   // 6.3.6: GV vừa tự bấm mở thì không đóng lại
                    // Auto-HIDE: rời NX → ẩn
                    iframe.classList.add('cogiao-ai-hidden');
                    _aiPaused = true;
                    capNhatGoiY();
                    console.log(`[Sổ nhận xét - AI] %cAuto-hide sidebar%c: rời module NX (${_lastDetectedModule} → ${current || 'khác'})`,
                        'color:#B65000;font-weight:bold', 'color:inherit');
                } else if (!wasNX && isNX && iframe && iframe.classList.contains('cogiao-ai-hidden')) {
                    // Auto-SHOW: vào NX → hiện (sidebar "thức dậy")
                    iframe.classList.remove('cogiao-ai-hidden');
                    _aiPaused = false;
                    capNhatGoiY();
                    console.log(`[Sổ nhận xét - AI] %cAuto-show sidebar%c: vào module NX (${_lastDetectedModule || 'khác'} → ${current})`,
                        'color:#1D9E75;font-weight:bold', 'color:inherit');
                }
            }

            _lastContextKey = contextKey;
            _lastDataSignature = dataSig;
            sendContextToSidebar();
            baoBangCuNeuCo(current, contextKey);
        }
    }

    /**
     * Nếu trang hiện tại là Sổ NX môn → tự lưu điểm vào CacheManager.
     * Dedupe theo URL trong 1 session (tránh sync nhiều lần khi rescan).
     */
    const _silentCacheSeen = new Set();
    function triggerSilentCacheIfSoNX() {
        try {
            if (!window.VneduAdapter?.detectSoNXMon?.()) return;

            // Dedupe key = URL + lớp + môn (để khi GV đổi môn vẫn sync lại)
            const ctx = window.VneduAdapter.getContext();
            const key = `${location.pathname}|${ctx.lop}|${ctx.mon}`;
            if (_silentCacheSeen.has(key)) return;
            _silentCacheSeen.add(key);

            // Async, không await — không chặn UI
            window.VneduAdapter.silentCacheScores().then(result => {
                if (result.success && result.synced > 0) {
                    console.log(`%c[Sổ nhận xét - AI] Silent cache OK`,
                        'color:#1D9E75', result);

                    // Notify sidebar refresh cache stats (nếu Tab 1 đang mở)
                    const iframe = document.getElementById(SIDEBAR_ID);
                    iframe?.contentWindow?.postMessage({
                        type: 'COGIAO_CACHE_UPDATED',
                        payload: {
                            className: result.className,
                            monKey: result.monKey,
                            synced: result.synced
                        }
                    }, '*');
                }
            });
        } catch (e) {
            console.error('[Sổ nhận xét - AI] triggerSilentCacheIfSoNX lỗi:', e);
        }
    }

    let _moTayLuc = 0;   // lúc GV tự bấm mở bảng bên
    function toggleSidebar() {
        const iframe = document.getElementById(SIDEBAR_ID);
        if (iframe) {
            iframe.classList.toggle('cogiao-ai-hidden');
            // V.05: Sidebar đóng = AI tạm dừng. Mở = chạy.
            const isHidden = iframe.classList.contains('cogiao-ai-hidden');
            if (!isHidden) _moTayLuc = Date.now();
            _aiPaused = isHidden;
            try {
                chrome.storage.local.set({ ai_paused_v1: isHidden });
            } catch (e) { /* silent */ }
            console.log('[Sổ nhận xét - AI] Sidebar ' + (isHidden ? 'ĐÓNG → AI TẠM DỪNG' : 'MỞ → AI BẬT'));
            capNhatGoiY();
        } else {
            mountSidebar();
            const moi = document.getElementById(SIDEBAR_ID);
            if (moi) {
                moi.classList.remove('cogiao-ai-hidden');
                _aiPaused = false;
                try { chrome.storage.local.set({ ai_paused_v1: false }); } catch (e) { /* silent */ }
            }
            capNhatGoiY();
        }
    }

    // V6.0.2: Bridge message từ page-error-bridge (page context) → đếm vendor errors
    window.addEventListener('message', (e) => {
        if (e.source !== window) return;
        const d = e.data;
        if (!d || d.type !== '__COGIAO_VENDOR_ERROR__') return;
        handleVendorError(d.filename || '', d.message || '');
    });

    // 6.2.0: tài khoản vnEdu đang đăng nhập (từ page-error-bridge) → chuyển cho sidebar
    window.addEventListener('message', (e) => {
        if (e.source !== window) return;
        const d = e.data;
        if (!d || d.type !== '__COGIAO_VNEDU_ACCOUNT__' || !d.account) return;
        const a = d.account;
        const acc = {
            userId: String(a.userId || '').slice(0, 20),
            siteId: String(a.siteId || '').slice(0, 20),
            isAdmin: a.isAdmin === true,
            gvId: Number(a.gvId) || 0,
            ten: String(a.ten || '').slice(0, 60)
        };
        // 6.3.1: khoá gồm cả cờ quản trị + mã GV → cờ đổi thì báo lại cho sidebar
        const keyOf = (x) => x.siteId + ':' + x.userId + ':' + (x.isAdmin ? 1 : 0) + ':' + x.gvId;
        if (_vneduAccount && keyOf(_vneduAccount) === keyOf(acc)) return;
        _vneduAccount = acc;
        const iframe = document.getElementById(SIDEBAR_ID);
        iframe?.contentWindow?.postMessage({ type: 'VNEDU_ACCOUNT', payload: acc }, '*');
    });

    window.addEventListener('message', (e) => {
        const data = e.data;
        if (!data || !data.type || !data.type.startsWith('COGIAO_')) return;

        switch (data.type) {
            case 'COGIAO_REQUEST_CONTEXT':
                if (!_vneduAccount) askVneduAccount();
                sendContextToSidebar();
                break;

            case 'COGIAO_RESCAN':
                sendContextToSidebar();
                break;

            case 'COGIAO_RELOAD_VNEDU':
                // V6.0.2: User bấm "F5 ngay" trên banner cảnh báo Vnedu lỗi nội bộ
                console.log('[Sổ nhận xét - AI] Reload Vnedu theo yêu cầu user');
                location.reload();
                break;

            case 'COGIAO_APPLY_NHAN_XET':
                applyNhanXetToVnedu(data.payload);
                break;

            case 'COGIAO_AUTO_SAVE':
                autoSaveVnedu();
                break;

            // 6.3.0 Sổ chủ nhiệm: chuyển lệnh sang cầu nối ở main world
            case 'COGIAO_SCN_FILL':
                _suppressUpdatesUntil = Date.now() + 2500;
                window.postMessage({ type: '__COGIAO_SCN_FILL__', reqId: data.payload && data.payload.reqId, payload: data.payload }, '*');
                break;

            case 'COGIAO_SCN_SYNC':
                window.postMessage({ type: '__COGIAO_SCN_SYNC__', reqId: data.payload && data.payload.reqId, expect: data.payload && data.payload.expect }, '*');
                break;

            case 'COGIAO_SCN_SODO':
                if (data.payload && data.payload.action === 'fill') _suppressUpdatesUntil = Date.now() + 2500;
                window.postMessage({ type: '__COGIAO_SCN_SODO__', reqId: data.payload && data.payload.reqId, payload: data.payload }, '*');
                break;

            case 'COGIAO_SCN_OPEN':
                window.postMessage({ type: '__COGIAO_SCN_OPEN__', reqId: data.payload && data.payload.reqId, section: data.payload && data.payload.section }, '*');
                break;

            case 'COGIAO_SCN_SAVE':
                window.postMessage({ type: '__COGIAO_SCN_SAVE__', reqId: data.payload && data.payload.reqId, expect: data.payload && data.payload.expect }, '*');
                break;

            case 'COGIAO_CLOSE_SIDEBAR':
                toggleSidebar();
                break;

            case 'COGIAO_OPEN_MODULE':   // 6.3.6
                handleOpenModule(data.payload);
                break;

            case 'COGIAO_REQUEST_CACHE_STATS':
                handleCacheStatsRequest();
                break;

            case 'COGIAO_CLEAR_CACHE':
                handleClearCache(data.payload);
                break;

            // v0.1.7 NLPC handlers
            case 'COGIAO_NLPC_SELECT_STUDENT':
                handleNLPCSelectStudent(data.payload);
                break;

            case 'COGIAO_APPLY_NLPC':
                handleApplyNLPC(data.payload);
                break;

            // V.06 NLPC Bulk: 1-chạm cả lớp — step per HS, sidebar điều phối queue
            case 'COGIAO_NLPC_BULK_STEP':
                handleNLPCBulkStep(data.payload);
                break;

            // V.06 Bulk Read: đọc T/Đ/C từ form Vnedu cho 1 HS (generate phase)
            case 'COGIAO_NLPC_BULK_READ':
                handleNLPCBulkRead(data.payload);
                break;
        }
    });

    function handleNLPCSelectStudent(payload) {
        const ok = window.VneduAdapter.selectNLPCStudent(payload.stt);
        const iframe = document.getElementById(SIDEBAR_ID);
        // Sau khi click chọn, đợi Vnedu re-render rồi gửi lại context
        setTimeout(() => {
            iframe?.contentWindow?.postMessage({
                type: 'COGIAO_NLPC_STUDENT_SELECTED',
                payload: { stt: payload.stt, hoVaTen: payload.hoVaTen, success: ok }
            }, '*');
        }, 300);
    }

    function handleApplyNLPC(payload) {
        const result = window.VneduAdapter.fillNLPCFields(payload);
        const iframe = document.getElementById(SIDEBAR_ID);
        iframe?.contentWindow?.postMessage({
            type: 'COGIAO_NLPC_APPLY_RESULT',
            payload: result
        }, '*');
    }

    /**
     * V.06 NLPC Bulk: 1 step = 1 HS (select → wait → fill → save → confirm).
     * Sidebar gửi step liên tục cho 35 HS, await response qua requestId.
     * Suppress watcher trong suốt step để Vnedu re-render không quấy rầy.
     */
    async function handleNLPCBulkRead(payload) {
        const { requestId, stt, expectedHS } = payload || {};
        _suppressUpdatesUntil = Date.now() + 15000; // 6.3.1: đọc mức chờ chữ T/Đ/C hiện đủ
        const iframe = document.getElementById(SIDEBAR_ID);
        try {
            const result = await window.VneduAdapter.readGradesForStudent(stt, expectedHS);
            iframe?.contentWindow?.postMessage({
                type: 'COGIAO_NLPC_BULK_READ_RESULT',
                payload: { requestId, ...result }
            }, '*');
        } catch (e) {
            console.error('[Sổ nhận xét - AI] handleNLPCBulkRead lỗi:', e);
            iframe?.contentWindow?.postMessage({
                type: 'COGIAO_NLPC_BULK_READ_RESULT',
                payload: { requestId, success: false, reason: e.message, stt, expectedHS }
            }, '*');
        }
    }

    async function handleNLPCBulkStep(payload) {
        const { requestId, stt, expectedHS, fillPayload, autoSave } = payload || {};
        _suppressUpdatesUntil = Date.now() + 45000; // V6.3.1: bước có thể chờ vnEdu nạp/lưu tới ~40 s
        const iframe = document.getElementById(SIDEBAR_ID);
        try {
            const result = await window.VneduAdapter.selectAndFillNLPC({
                stt, expectedHS, payload: fillPayload, autoSave: autoSave !== false
            });
            iframe?.contentWindow?.postMessage({
                type: 'COGIAO_NLPC_BULK_STEP_RESULT',
                payload: { requestId, ...result }
            }, '*');
            _suppressUpdatesUntil = Date.now() + 1500;
        } catch (e) {
            console.error('[Sổ nhận xét - AI] handleNLPCBulkStep lỗi:', e);
            iframe?.contentWindow?.postMessage({
                type: 'COGIAO_NLPC_BULK_STEP_RESULT',
                payload: { requestId, success: false, stage: 'exception', reason: e.message, stt, expectedHS }
            }, '*');
        }
    }

    async function handleCacheStatsRequest() {
        if (typeof window.CacheManager === 'undefined') return;
        try {
            const stats = await window.CacheManager.getCacheStats();
            const iframe = document.getElementById(SIDEBAR_ID);
            iframe?.contentWindow?.postMessage({
                type: 'COGIAO_CACHE_STATS',
                payload: stats
            }, '*');
        } catch (e) {
            console.error('[Sổ nhận xét - AI] handleCacheStatsRequest lỗi:', e);
        }
    }

    async function handleClearCache(payload) {
        if (typeof window.CacheManager === 'undefined') return;
        try {
            if (payload?.className) {
                await window.CacheManager.clearClass(payload.className);
            } else {
                await window.CacheManager.clearCache();
            }
            _silentCacheSeen.clear();
            handleCacheStatsRequest();
        } catch (e) {
            console.error('[Sổ nhận xét - AI] handleClearCache lỗi:', e);
        }
    }

    function autoSaveVnedu() {
        // BUG-010: Lock watcher trong 3s — tránh Vnedu navigate tạm sau save làm
        // sidebar nhảy sang lớp/module sai.
        _suppressUpdatesUntil = Date.now() + 3000;
        const result = window.VneduAdapter.clickLuuButton();
        const iframe = document.getElementById(SIDEBAR_ID);
        iframe?.contentWindow.postMessage({
            type: 'COGIAO_AUTO_SAVE_RESULT',
            payload: result
        }, '*');
    }

    function applyNhanXetToVnedu(payload) {
        // V6.1.0: đọc lại bảng ngay lúc ghi, khớp cả STT lẫn họ tên để không ghi nhầm người,
        // ghi xong đọc lại ô để chắc chắn chữ đã vào. Ai không ghi được thì báo đích danh.
        const items = payload.items || [];
        const rows = window.VneduAdapter.getStudentRows();
        const { matched, missing } = window.NhanXetEngineV2.matchApplyRows(rows, items);
        const failedNames = missing.map(i => i.hoVaTen);
        let success = 0;

        for (const { row, item } of matched) {
            const ok = window.VneduAdapter.fillTextarea(row.textarea, item.nhanXet)
                && row.textarea.isConnected
                && row.textarea.value === item.nhanXet;
            if (ok) success++; else failedNames.push(item.hoVaTen);
        }

        const iframe = document.getElementById(SIDEBAR_ID);
        iframe?.contentWindow.postMessage({
            type: 'COGIAO_APPLY_RESULT',
            payload: { success, failed: failedNames.length, total: items.length, failedNames }
        }, '*');
    }

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'TOGGLE_SIDEBAR') {
            toggleSidebar();
        }
    });

    function waitForVnedu() {
        let attempts = 0;
        const maxAttempts = 60;

        const checkInterval = setInterval(() => {
            attempts++;

            const hasTable = document.querySelector('textarea, table.x-grid, .x-grid-cell');
            const hasContent = document.body && document.body.innerText.length > 100;

            // 6.3.6: 10 → 3 lượt (~2 s): thẻ mở hiện sớm ở màn hình chính vnEdu
            if ((hasTable || attempts > 3) && hasContent) {
                clearInterval(checkInterval);
                setTimeout(mountSidebar, 500);
            }

            if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.warn('[Sổ nhận xét - AI] Không phát hiện Vnedu sau 30s. Có thể trang đang load chậm.');
            }
        }, 500);
    }

    if (document.readyState === 'complete') {
        waitForVnedu();
    } else {
        window.addEventListener('load', waitForVnedu);
    }
})();

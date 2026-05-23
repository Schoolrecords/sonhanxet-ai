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
            setTimeout(() => {
                sendContextToSidebar();
                setupModuleWatcher();  // v0.1.12: bắt SPA navigation
                // V6.0.2: Nếu GV reload page khi đang ở module NX, watcher chưa
                // fire kịp → check current ngay sau mount để auto-show không trễ.
                try {
                    const current = window.VneduAdapter.detectModule();
                    if (current === 'so-nhan-xet' || current === 'nlpc') {
                        iframe.classList.remove('cogiao-ai-hidden');
                        _aiPaused = false;
                        console.log(`[Sổ nhận xét - AI] Mount xong, đang ở module "${current}" → auto-show`);
                    }
                } catch (e) { /* silent */ }
            }, 300);
        });

        createToggleButton();
    }

    function createToggleButton() {
        if (document.getElementById(TOGGLE_BTN_ID)) return;
        const btn = document.createElement('button');
        btn.id = TOGGLE_BTN_ID;
        btn.title = 'Bấm để mở hoặc đóng Sổ nhận xét - AI';
        // V.05: inner span xoay -90deg → text hiển thị dọc
        const label = document.createElement('span');
        label.className = 'toggle-label';
        label.textContent = 'Đóng / Mở';
        btn.appendChild(label);
        btn.onclick = toggleSidebar;
        document.body.appendChild(btn);
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
        } catch (e) { /* im lặng — chữ ký rỗng coi như chưa có dữ liệu */ }
        return '';
    }

    function sendContextToSidebar() {
        const iframe = document.getElementById(SIDEBAR_ID);
        if (!iframe || !iframe.contentWindow) return;

        const module = window.VneduAdapter.detectModule();
        _lastDetectedModule = module;  // track để MutationObserver compare
        let payload = { module, context: {}, students: [] };

        if (module === 'so-nhan-xet') {
            const context = window.VneduAdapter.getContext();
            const studentRows = window.VneduAdapter.getStudentRows();
            payload.context = context;
            payload.students = studentRows.map(r => ({
                stt: r.stt, hoVaTen: r.hoVaTen,
                diem: r.diem,
                mucDat: r.mucDat,  // v0.1.19: mức chữ T/H/C cho môn không có điểm
                daCoNhanXet: r.daCoNhanXet
            }));
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

        const current = window.VneduAdapter.detectModule();

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
                const wasNX = _lastDetectedModule === 'so-nhan-xet' || _lastDetectedModule === 'nlpc';
                const isNX = current === 'so-nhan-xet' || current === 'nlpc';
                const iframe = document.getElementById(SIDEBAR_ID);

                if (wasNX && !isNX && iframe && !iframe.classList.contains('cogiao-ai-hidden')) {
                    // Auto-HIDE: rời NX → ẩn
                    iframe.classList.add('cogiao-ai-hidden');
                    _aiPaused = true;
                    console.log(`[Sổ nhận xét - AI] %cAuto-hide sidebar%c: rời module NX (${_lastDetectedModule} → ${current || 'khác'})`,
                        'color:#B65000;font-weight:bold', 'color:inherit');
                } else if (!wasNX && isNX && iframe && iframe.classList.contains('cogiao-ai-hidden')) {
                    // Auto-SHOW: vào NX → hiện (sidebar "thức dậy")
                    iframe.classList.remove('cogiao-ai-hidden');
                    _aiPaused = false;
                    console.log(`[Sổ nhận xét - AI] %cAuto-show sidebar%c: vào module NX (${_lastDetectedModule || 'khác'} → ${current})`,
                        'color:#1D9E75;font-weight:bold', 'color:inherit');
                }
            }

            _lastContextKey = contextKey;
            _lastDataSignature = dataSig;
            sendContextToSidebar();
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

    function toggleSidebar() {
        const iframe = document.getElementById(SIDEBAR_ID);
        if (iframe) {
            iframe.classList.toggle('cogiao-ai-hidden');
            // V.05: Sidebar đóng = AI tạm dừng. Mở = chạy.
            const isHidden = iframe.classList.contains('cogiao-ai-hidden');
            _aiPaused = isHidden;
            try {
                chrome.storage.local.set({ ai_paused_v1: isHidden });
            } catch (e) { /* silent */ }
            console.log('[Sổ nhận xét - AI] Sidebar ' + (isHidden ? 'ĐÓNG → AI TẠM DỪNG' : 'MỞ → AI BẬT'));
        } else {
            mountSidebar();
        }
    }

    // V6.0.2: Bridge message từ page-error-bridge (page context) → đếm vendor errors
    window.addEventListener('message', (e) => {
        if (e.source !== window) return;
        const d = e.data;
        if (!d || d.type !== '__COGIAO_VENDOR_ERROR__') return;
        handleVendorError(d.filename || '', d.message || '');
    });

    window.addEventListener('message', (e) => {
        const data = e.data;
        if (!data || !data.type || !data.type.startsWith('COGIAO_')) return;

        switch (data.type) {
            case 'COGIAO_REQUEST_CONTEXT':
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

            case 'COGIAO_CLOSE_SIDEBAR':
                toggleSidebar();
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
        _suppressUpdatesUntil = Date.now() + 4000;
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
        _suppressUpdatesUntil = Date.now() + 6000; // mỗi step ~3-4s, đệm 6s
        const iframe = document.getElementById(SIDEBAR_ID);
        try {
            const result = await window.VneduAdapter.selectAndFillNLPC({
                stt, expectedHS, payload: fillPayload, autoSave: autoSave !== false
            });
            iframe?.contentWindow?.postMessage({
                type: 'COGIAO_NLPC_BULK_STEP_RESULT',
                payload: { requestId, ...result }
            }, '*');
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
        const rows = window.VneduAdapter.getStudentRows();
        let success = 0, failed = 0;

        for (const item of payload.items || []) {
            const row = rows.find(r => r.stt === item.stt);
            if (row && row.textarea) {
                const ok = window.VneduAdapter.fillTextarea(row.textarea, item.nhanXet);
                if (ok) success++; else failed++;
            } else {
                failed++;
            }
        }

        const iframe = document.getElementById(SIDEBAR_ID);
        iframe?.contentWindow.postMessage({
            type: 'COGIAO_APPLY_RESULT',
            payload: { success, failed, total: payload.items.length }
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

            if ((hasTable || attempts > 10) && hasContent) {
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

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

    function mountSidebar() {
        if (document.getElementById(SIDEBAR_ID)) return;

        const iframe = document.createElement('iframe');
        iframe.id = SIDEBAR_ID;
        iframe.src = chrome.runtime.getURL('sidebar/sidebar.html');
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allow', 'clipboard-write');
        document.body.appendChild(iframe);

        iframe.addEventListener('load', () => {
            setTimeout(() => {
                sendContextToSidebar();
                setupModuleWatcher();  // v0.1.12: bắt SPA navigation
            }, 300);
        });

        createToggleButton();
    }

    function createToggleButton() {
        if (document.getElementById(TOGGLE_BTN_ID)) return;
        const btn = document.createElement('button');
        btn.id = TOGGLE_BTN_ID;
        btn.title = 'Mở/đóng Sổ nhận xét - AI';
        btn.textContent = 'CG';
        btn.onclick = toggleSidebar;
        document.body.appendChild(btn);
    }

    let _lastDetectedModule = null;
    let _lastContextKey = null;  // pathname|lop|mon (Sổ NX) hoặc pathname|lop (NLPC)
    let _lastDataSignature = null;  // chữ ký dữ liệu HS — đổi khi GV nhập/sửa điểm trên Vnedu

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

        // 1) Observer cho response NHANH
        const observer = new MutationObserver(() => {
            clearTimeout(_mutationDebounce);
            _mutationDebounce = setTimeout(checkModuleChange, 600);
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class', 'hidden']
        });

        // 2) Polling backup — đảm bảo dù Observer miss vẫn re-detect trong 1.5s
        setInterval(checkModuleChange, 1500);

        // 3) Bắt GV nhập/sửa điểm trực tiếp trên Vnedu.
        //    MutationObserver KHÔNG bắt được thay đổi .value của <input>/<textarea>,
        //    nên lắng nghe input/change ở capture phase. Fix: "Cần sinh" bị đứng số cũ
        //    cho tới khi GV bấm "Cập nhật dữ liệu" — nay tự rescan sau ~600ms.
        ['input', 'change'].forEach(evt => {
            document.addEventListener(evt, (e) => {
                const t = e.target;
                if (!t || (t.closest && t.closest('#cogiao-ai-sidebar'))) return;
                clearTimeout(_mutationDebounce);
                _mutationDebounce = setTimeout(checkModuleChange, 600);
            }, true);
        });

        console.log('[Sổ nhận xét - AI] Watcher active — MutationObserver + polling 1.5s + input/change');
    }

    let _suppressUpdatesUntil = 0;  // BUG-010: suppress watcher updates trong 3s sau Lưu

    function checkModuleChange() {
        if (!window.VneduAdapter) return;
        // BUG-010: Khi vừa autoSave, Vnedu có thể navigate tạm sang window khác
        // (Sổ NX môn cũ) trong DOM → tránh sidebar bị bouncing sang module/lớp sai
        // bằng cách suppress detection trong 3s.
        if (Date.now() < _suppressUpdatesUntil) return;
        const current = window.VneduAdapter.detectModule();

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
        } else {
            mountSidebar();
        }
    }

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

/**
 * V6.0.2 Page-context error bridge
 *
 * Chạy trong PAGE CONTEXT (main world) — được inject bởi content-script qua <script>
 * tag với src chrome.runtime.getURL(...). Mục đích: bắt uncaught exception từ Vnedu
 * Ext.js (ext-all.js, so_hoc_ba_c1.js) — content-script ở isolated world KHÔNG bắt
 * được lỗi page context, đó là cơ chế cách ly của Chrome Extension.
 *
 * Khi bắt được lỗi vendor → window.postMessage ra → content-script (cùng window) đọc
 * được và xử lý (đếm spam, hiện banner F5).
 */
(function () {
    'use strict';

    const VENDOR_PATTERN = /ext-all\.js|so_hoc_ba_c1\.js|StartMenu\.js/i;

    function postVendor(filename, message) {
        try {
            window.postMessage({
                type: '__COGIAO_VENDOR_ERROR__',
                filename: filename || '',
                message: message || ''
            }, '*');
        } catch (e) { /* silent */ }
    }

    window.addEventListener('error', (ev) => {
        const f = ev.filename || '';
        const stack = (ev.error && ev.error.stack) || '';
        if (!VENDOR_PATTERN.test(f) && !VENDOR_PATTERN.test(stack)) return;
        postVendor(f, ev.message || '');
        // KHÔNG preventDefault — để Vnedu vẫn nhận được lỗi như bình thường,
        // tránh che mất exception thật của extension hoặc tool khác.
    }, true);

    window.addEventListener('unhandledrejection', (ev) => {
        const stack = (ev.reason && ev.reason.stack) || '';
        const msg = (ev.reason && ev.reason.message) || String(ev.reason || '');
        if (!VENDOR_PATTERN.test(stack)) return;
        postVendor('promise', msg);
    });

    console.log('%c[Sổ nhận xét - AI] page-error-bridge ready', 'color:#1D9E75');
})();

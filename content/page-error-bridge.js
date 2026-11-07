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

    // 6.2.0: cho tiện ích biết TÀI KHOẢN vnEdu đang đăng nhập (để gắn bản quyền).
    // CHỈ đọc 5 thông tin dưới đây. TUYỆT ĐỐI không đọc mật khẩu, mã xác thực, mã phiên
    // (các khoá password, token2fa, session_id... cũng nằm trong phpviet_user).
    function docTaiKhoan() {
        try {
            const userId = window.phpviet_user_id;
            const u = window.phpviet_user;
            const siteId = u && typeof u === 'object' ? u.site_id : null;
            if (userId === undefined || userId === null || userId === '' || !siteId) return null;
            // 6.3.1: vnEdu gán cờ quản trị / mã GV SAU mã tài khoản. Đọc sớm → gvId=0 → tiện ích
            // tưởng là tài khoản quản trị (lỗi thật 07/11, tài khoản GV). Chưa có đủ thì chờ.
            const rawAdmin = window.phpviet_user_is_admin, rawGv = window.phpviet_gv_id;
            if (rawAdmin === undefined || rawAdmin === null || rawAdmin === '' ||
                rawGv === undefined || rawGv === null || rawGv === '') return null;
            return {
                userId: String(userId),
                siteId: String(siteId),
                isAdmin: String(window.phpviet_user_is_admin) === '1',
                gvId: Number(window.phpviet_gv_id) || 0,
                ten: u && typeof u.full_name === 'string' ? u.full_name.slice(0, 60) : ''
            };
        } catch (e) { return null; }
    }

    function guiTaiKhoan() {
        const acc = docTaiKhoan();
        if (!acc) return false;
        try { window.postMessage({ type: '__COGIAO_VNEDU_ACCOUNT__', account: acc }, '*'); } catch (e) { /* silent */ }
        return true;
    }

    // vnEdu gán các biến này sau khi tải xong → thử lại vài lần
    let soLanThu = 0;
    (function thu() {
        if (guiTaiKhoan() || ++soLanThu > 80) return;
        setTimeout(thu, 750);
    })();
    // Gửi lại sau khi vnEdu khởi động xong hẳn (phòng cờ đổi giá trị sau lần đọc đầu)
    setTimeout(guiTaiKhoan, 8000);
    setTimeout(guiTaiKhoan, 20000);
    window.addEventListener('message', (ev) => {
        if (ev.source === window && ev.data && ev.data.type === '__COGIAO_ASK_ACCOUNT__') guiTaiKhoan();
    });

    console.log('%c[Sổ nhận xét - AI] page-error-bridge ready', 'color:#1D9E75');
})();

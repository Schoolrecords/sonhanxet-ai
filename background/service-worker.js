/**
 * Service worker - chạy nền của extension Sổ nhận xét - AI
 *
 * Nhiệm vụ:
 *   1. Khi GV click icon extension trên thanh công cụ → toggle sidebar
 *   2. Kiểm tra xem tab hiện tại có phải Vnedu không
 *   3. Khởi tạo lần đầu sau khi cài extension
 *   4. (6.3.4) Phát hiện Chrome đang giữ quyền chạy trên vnEdu ("Khi bạn nhấp vào",
 *      chỉ vài trang) → hiện chữ BẬT trên biểu tượng; GV bấm biểu tượng → Chrome hỏi
 *      cho phép lại trên mọi trang vnedu.vn.
 */

const VNEDU = ['*://*.vnedu.vn/*'];
const TIEU_DE = 'Sổ nhận xét - AI · Click để mở/đóng bảng bên';
const TIEU_DE_CHAN = 'Sổ nhận xét - AI đang bị Chrome chặn trên vnEdu. Bấm vào đây rồi chọn Cho phép.';

async function coQuyenVnedu() {
    try { return await chrome.permissions.contains({ origins: VNEDU }); } catch (e) { return true; }
}

async function capNhatBieuTuong() {
    const ok = await coQuyenVnedu();
    try {
        await chrome.action.setBadgeText({ text: ok ? '' : 'BẬT' });
        if (!ok) await chrome.action.setBadgeBackgroundColor({ color: '#C62828' });
        await chrome.action.setTitle({ title: ok ? TIEU_DE : TIEU_DE_CHAN });
    } catch (e) { /* silent */ }
}

chrome.action.onClicked.addListener((tab) => {
    // Khi Chrome đang chặn, tab.url có thể không đọc được → vẫn xin quyền.
    if (tab.url && !tab.url.includes('vnedu.vn')) {
        chrome.action.setBadgeText({ text: '!', tabId: tab.id });
        chrome.action.setBadgeBackgroundColor({ color: '#D85A30', tabId: tab.id });

        setTimeout(() => {
            chrome.action.setBadgeText({ text: '', tabId: tab.id });
        }, 3000);
        return;
    }

    // Gọi ngay trong lúc GV bấm (cử chỉ người dùng). Đã có quyền thì Chrome trả true, không hỏi.
    chrome.permissions.request({ origins: VNEDU }).catch(() => false).then((duoc) => {
        capNhatBieuTuong();
        if (!duoc) return;
        chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' }).catch(() => {
            chrome.tabs.reload(tab.id);
        });
    });
});

chrome.permissions.onAdded.addListener(capNhatBieuTuong);
chrome.permissions.onRemoved.addListener(capNhatBieuTuong);
chrome.runtime.onStartup.addListener(capNhatBieuTuong);

chrome.runtime.onInstalled.addListener(({ reason }) => {
    capNhatBieuTuong();
    if (reason === 'install') {
        console.log('[Sổ nhận xét - AI] Đã cài đặt thành công. Mở https://vnedu.vn để bắt đầu.');
    }
});

capNhatBieuTuong();

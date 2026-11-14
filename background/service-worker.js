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
 *   5. (6.3.6) Cài mới → mở trang "Bắt đầu" (welcome/welcome.html) một lần; cập nhật thì KHÔNG mở.
 *      Bấm biểu tượng khi chưa ở vnEdu → mở trang đó (trước đây chỉ hiện dấu "!" 3 giây).
 *      Đang ở đúng màn làm việc → dấu xanh trên biểu tượng của tab đó.
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
        // 6.3.6: chỉ đường thay cho dấu "!" khó hiểu
        moTrangBatDau('bieutuong');
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

function moTrangBatDau(tu) {
    try {
        chrome.tabs.create({ url: chrome.runtime.getURL('welcome/welcome.html' + (tu ? '?tu=' + tu : '')) });
    } catch (e) { /* silent */ }
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
    capNhatBieuTuong();
    // Chỉ khi CÀI MỚI. Cập nhật chạy ngầm, không mở gì.
    if (reason === 'install') moTrangBatDau('caimoi');
});

// 6.3.6: content script báo màn đang mở → dấu xanh + tên màn trên biểu tượng của đúng tab đó.
const TEN_MAN = {
    'so-nhan-xet': 'Sổ nhận xét môn',
    'nlpc': 'Năng lực - Phẩm chất',
    'so-chu-nhiem': 'Sổ chủ nhiệm'
};
chrome.runtime.onMessage.addListener((msg, sender) => {
    if (!msg || msg.type !== 'SNX_MODULE' || !sender.tab || sender.tab.id === undefined) return;
    const tabId = sender.tab.id;
    const ten = TEN_MAN[msg.module];
    try {
        chrome.action.setBadgeText({ tabId, text: ten ? '✓' : '' });
        if (ten) chrome.action.setBadgeBackgroundColor({ tabId, color: '#1D7A55' });
        chrome.action.setTitle({
            tabId,
            title: ten ? ('Sổ nhận xét - AI · Đang ở: ' + ten + ' · Bấm để mở/đóng bảng bên') : TIEU_DE
        });
    } catch (e) { /* silent */ }
});

capNhatBieuTuong();

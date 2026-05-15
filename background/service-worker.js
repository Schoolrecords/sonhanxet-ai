/**
 * Service worker - chạy nền của extension Sổ nhận xét - AI
 *
 * Nhiệm vụ:
 *   1. Khi GV click icon extension trên thanh công cụ → toggle sidebar
 *   2. Kiểm tra xem tab hiện tại có phải Vnedu không
 *   3. Khởi tạo lần đầu sau khi cài extension
 */

chrome.action.onClicked.addListener((tab) => {
    if (!tab.url || !tab.url.includes('vnedu.vn')) {
        chrome.action.setBadgeText({ text: '!', tabId: tab.id });
        chrome.action.setBadgeBackgroundColor({ color: '#D85A30', tabId: tab.id });

        setTimeout(() => {
            chrome.action.setBadgeText({ text: '', tabId: tab.id });
        }, 3000);
        return;
    }

    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' }).catch(() => {
        chrome.tabs.reload(tab.id);
    });
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') {
        console.log('[Sổ nhận xét - AI] Đã cài đặt thành công. Mở https://vnedu.vn để bắt đầu.');
    }
});

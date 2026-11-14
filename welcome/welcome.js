// 6.3.6: trang Bắt đầu — mở từ biểu tượng khi chưa ở vnEdu thì hiện dòng nhắc.
(function () {
    try {
        var tu = new URLSearchParams(location.search).get('tu');
        if (tu === 'bieutuong') document.getElementById('notice-icon').hidden = false;
    } catch (e) { /* silent */ }
})();

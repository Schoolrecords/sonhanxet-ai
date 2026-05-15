# Permission Justifications

> Mỗi permission CWS bắt phải giải thích tại sao cần. Paste từng đoạn vào form tương ứng.
> **Quy tắc vàng**: giải thích **CỤ THỂ feature nào dùng permission đó**, không nói chung chung "để extension hoạt động".

---

## `storage` permission

```
Lưu cài đặt cá nhân của giáo viên (ngôn ngữ hiển thị, font-size sidebar, tuỳ chọn template ngắn/dài) và cache mã kích hoạt sau khi đăng nhập một lần để không phải nhập lại mỗi phiên. Không lưu bất kỳ thông tin học sinh nào.
```

---

## `host_permissions` cho `*://*.vnedu.vn/*`

```
Extension cần đọc DOM trang Sổ nhận xét / Phẩm chất - Năng lực của Vnedu để lấy danh sách học sinh và bảng điểm, đồng thời ghi văn bản nhận xét đã sinh vào các ô textarea của Vnedu. Đây là chức năng cốt lõi duy nhất của sản phẩm. Extension không truy cập bất kỳ trang nào khác của Vnedu ngoài hai trang trên.
```

---

## `host_permissions` cho `https://script.google.com/*` và `https://script.googleusercontent.com/*`

```
Extension gọi đến Google Apps Script (do tác giả tự host) để kiểm tra trạng thái kích hoạt license (đã thanh toán / còn hạn). Mỗi lần kiểm tra chỉ gửi: số điện thoại GV, mã kích hoạt, và device fingerprint (hash SHA-256 của browser fingerprint). KHÔNG gửi tên, điểm, hay bất kỳ dữ liệu học sinh nào. Mã nguồn server công khai trong thư mục `license/license-server.gs` của repository.
```

---

## `content_scripts` cho `*://*.vnedu.vn/*`

```
Inject script vào trang Vnedu để: (1) phát hiện GV đang ở trang Sổ nhận xét hay PCNL, (2) đọc danh sách học sinh và bảng điểm hiển thị trên trang, (3) hiển thị sidebar "Sổ nhận xét - AI" bên phải màn hình, (4) ghi văn bản nhận xét đã được GV duyệt vào các ô textarea tương ứng. Chỉ chạy trên domain vnedu.vn, không can thiệp vào trang khác.
```

---

## `background.service_worker`

```
Service worker xử lý sự kiện bấm icon extension trên thanh công cụ Chrome (toggle ẩn/hiện sidebar) và relay thông điệp giữa sidebar (iframe) và content script. Không chạy network request, không truy cập dữ liệu nhạy cảm.
```

---

## `web_accessible_resources`

```
Sidebar được nhúng dưới dạng iframe vào trang Vnedu (không phải popup) để GV vừa thấy bảng HS vừa thấy nhận xét. Vì vậy các file HTML/CSS/JS của sidebar và dữ liệu template (file .json) phải được khai báo web_accessible_resources để Vnedu có thể nạp iframe. Các tài nguyên này chỉ accessible từ domain vnedu.vn, không expose ra ngoài.
```

---

## Tóm tắt 1 câu (phòng khi CWS hỏi tổng quát)

```
Extension chỉ dùng permission cần thiết tối thiểu để: đọc DOM Vnedu (sinh nhận xét), ghi DOM Vnedu (áp dụng nhận xét), gọi license server (xác thực kích hoạt), và lưu setting cá nhân. Không thu thập, không gửi đi dữ liệu học sinh.
```

# Sổ nhận xét - AI — Chrome Extension v0.1.0

> Trợ lý sinh nhận xét cuối kỳ tự động cho giáo viên tiểu học, hoạt động trên Vnedu

## Cài đặt vào Chrome (chạy thử)

### Bước 1: Bật chế độ Developer cho Chrome Extension

1. Mở Chrome
2. Vào địa chỉ: `chrome://extensions/`
3. Bật công tắc **"Developer mode"** (Chế độ dành cho nhà phát triển) ở góc phải trên

### Bước 2: Load extension

1. Bấm nút **"Load unpacked"** (Tải tiện ích chưa đóng gói)
2. Chọn thư mục `cogiao-ai-extension` (thư mục chứa file `manifest.json`)
3. Extension "Sổ nhận xét - AI" sẽ xuất hiện trong danh sách

### Bước 3: Ghim icon lên thanh công cụ (tùy chọn)

1. Bấm icon mảnh ghép 🧩 ở góc phải trên Chrome
2. Tìm "Sổ nhận xét - AI" → bấm ghim 📌

## Cách sử dụng

### Cho Sổ nhận xét môn

1. Mở Vnedu, đăng nhập như bình thường
2. Vào: **Sổ điểm → Sổ nhận xét**
3. Chọn Khối / Lớp / Môn / Học kỳ
4. Đợi Vnedu load xong bảng danh sách HS
5. **Sidebar "Sổ nhận xét - AI" sẽ tự xuất hiện bên phải màn hình**
6. Bấm **"Sinh nhận xét cho N HS"**
7. Xem preview → bấm **"Áp dụng vào Vnedu"**
8. Bấm nút **"Lưu"** của Vnedu để hoàn tất

### Cho Form NLPC (Phẩm chất - Năng lực)

⚠ **V0.1 chưa hỗ trợ module này** — sẽ có ở V0.2.

## Kiểm tra extension hoạt động

Mở Console (F12) → tab Console. Khi vào trang Vnedu, anh sẽ thấy:

```
[Sổ nhận xét - AI] Content script loaded on https://...vnedu.vn/...
[Sổ nhận xét - AI] Gửi context sang sidebar: {module: "so-nhan-xet", studentCount: 30, ...}
```

## Xử lý sự cố

### Sidebar không hiện
- Refresh trang Vnedu (F5)
- Bấm icon Sổ nhận xét - AI trên thanh công cụ
- Vào `chrome://extensions/` → kiểm tra extension đã bật

### Sidebar hiện nhưng không phát hiện module
- Bấm nút "Quét lại" (icon mũi tên xoay) trong sidebar
- Đảm bảo đã vào đúng trang Sổ nhận xét hoặc PCNL

### Không sinh được nhận xét cho 1 môn
- Hiện tại Engine đã có data cho: Tiếng Việt, Toán, TNXH, Khoa học, Lịch sử-Địa lí, Đạo đức, Tin học, Tiếng Anh, GDTC, Âm nhạc, Mĩ thuật, Hoạt động trải nghiệm
- Môn khác sẽ dùng template chung (chất lượng thấp hơn)

### Nhận xét không ghi được vào textarea
- Đây có thể do Vnedu v5 thay đổi cấu trúc DOM
- Vui lòng gửi screenshot Console + cấu trúc DOM cho team Sổ nhận xét - AI để fine-tune selector

## Cấu trúc thư mục

```
cogiao-ai-extension/
├── manifest.json              # Khai báo extension
├── background/
│   └── service-worker.js      # Xử lý nền (toggle sidebar)
├── content/
│   ├── content-script.js      # Entry point trên Vnedu
│   ├── vnedu-adapter.js       # Đọc/ghi DOM Vnedu
│   └── sidebar-inject.css     # Style cho iframe
├── sidebar/
│   ├── sidebar.html           # UI sidebar
│   ├── sidebar.css            # Style
│   └── sidebar.js             # Logic UI
├── engine/
│   ├── engine.js              # Smart Rule-based Engine
│   └── data/
│       ├── nhanxet-tiengviet.json
│       ├── nhanxet-toan.json
│       ├── nhanxet-mon-khac.json
│       └── nhanxet-nangluc-phamchat-v2.json
└── README.md
```

## Cam kết bảo mật

- ✅ **Dữ liệu HS không rời máy của thầy/cô.** Mọi nhận xét được sinh hoàn toàn cục bộ trong trình duyệt.
- ✅ **Không có server, không có tài khoản.** Sổ nhận xét - AI không gửi tên, điểm hay bất kỳ thông tin HS nào đi đâu cả.
- ✅ **Mã nguồn mở.** Anh có thể đọc toàn bộ code trong các file trên.

## Phát triển

Phiên bản hiện tại: **v0.1.0**

Liên hệ phản hồi: Chung Trần — Phó Hiệu trưởng Trường Tiểu học Diễn Liên, xã Quảng Châu, tỉnh Nghệ An

---

*Phát triển bởi giáo viên cho giáo viên*

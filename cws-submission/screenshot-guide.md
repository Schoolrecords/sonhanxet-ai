# Hướng dẫn chụp ảnh cho Chrome Web Store

CWS yêu cầu **screenshot 1280×800** (hoặc 640×400). Phải đẹp, sạch, không có dữ liệu thật.

## Quy tắc chung

- **KHÔNG hiển thị tên HS thật** — dùng tên giả (HS01, HS02, hoặc tên dân tộc đa dạng giả định: Nguyễn Văn A, Lê Thị B...)
- **KHÔNG hiển thị thông tin trường thật** — che hoặc dùng "Trường Tiểu học Demo"
- **Mọi screenshot ở chế độ ban ngày** (light mode), zoom 100%, browser bar gọn (ẩn bookmarks)
- File output: PNG, kích thước **chính xác 1280×800px**

## 5 screenshot bắt buộc (xếp theo thứ tự đẩy lên CWS)

### Screenshot 1 — "Sidebar đang chờ"
- Trang Sổ nhận xét Vnedu đã load xong, có ~15-20 HS giả
- Sidebar bên phải hiển thị: "Đã phát hiện 30 HS — Bấm để sinh nhận xét"
- **Caption gợi ý**: "Sidebar tự xuất hiện khi vào đúng trang Sổ nhận xét"

### Screenshot 2 — "Preview nhận xét đã sinh"
- Sidebar đang hiển thị preview 3-4 nhận xét đã sinh
- Mỗi nhận xét hiển thị: tên HS giả, mức (T+/T/H/C), văn bản nhận xét
- Highlight 1 nhận xét đang được GV xem
- **Caption gợi ý**: "Preview trước khi áp dụng — sửa được nếu cần"

### Screenshot 3 — "Áp dụng vào Vnedu"
- Sau khi bấm "Áp dụng" — các ô textarea trên Vnedu đã có chữ
- Hiển thị toast "Đã áp dụng 30 nhận xét"
- **Caption gợi ý**: "1 click để ghi toàn bộ nhận xét vào Vnedu"

### Screenshot 4 — "Module NLPC + badge override"
- Form Phẩm chất - Năng lực, 13 trường đã được auto-fill
- Highlight 1 badge mà GV vừa click để override (đổi từ T → Đ)
- **Caption gợi ý**: "Tự suy NL/PC từ điểm môn — click badge để override"

### Screenshot 5 — "Cam kết bảo mật"
- Có thể là 1 trang riêng của sidebar hoặc 1 layout designed
- Hiển thị 3 dòng:
  - 🔒 Dữ liệu HS không rời máy
  - 🔓 Mã nguồn mở
  - 🚫 Không server, không account
- **Caption gợi ý**: "Dữ liệu học sinh tuyệt đối không rời máy của thầy/cô"

## Tile promo (2 ảnh)

### Small promo tile — 440×280 (BẮT BUỘC)
- Background: gradient `#2B4F9E` → `#1E3A7A` (xanh đậm hơn)
- Logo Sổ nhận xét - AI ở giữa-trái
- Text bên phải: "Nhận xét cuối kỳ\nXong trong 5 phút"
- Subtext: "Cho GV tiểu học · Vnedu"

### Marquee promo tile — 1400×560 (NÊN CÓ)
- Layout ngang
- Bên trái: tagline lớn "Sổ nhận xét cuối kỳ 30 HS trong 5 phút"
- Bên phải: ảnh sidebar đang hoạt động (mockup, không phải screenshot)
- Logo + tên ở góc trên trái
- CTA chip: "Cho giáo viên tiểu học · Tuân thủ TT27"

## Công cụ chụp ảnh đề xuất

- **Chụp trực tiếp trên Chrome**: F12 → Ctrl+Shift+M (device mode) → Custom 1280×800 → chụp full page
- **Edit / annotate**: Figma (miễn phí), Excalidraw, Canva
- **Mock data sạch**: tạo 1 lớp giả trên Vnedu sandbox (nếu có) hoặc Photoshop ghi đè tên HS thật

## Checklist trước khi upload

- [ ] Đúng kích thước 1280×800 cho từng screenshot
- [ ] Đúng 440×280 cho small tile
- [ ] Không có tên HS thật, không có tên trường thật, không có ảnh GV thật
- [ ] File PNG, < 5MB mỗi file
- [ ] Caption đã viết (CWS có ô caption riêng cho mỗi screenshot)
- [ ] Đã xem trên màn hình điện thoại để chắc rằng chữ vẫn đọc được khi bị scale xuống nhỏ

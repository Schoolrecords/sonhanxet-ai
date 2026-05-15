# Hướng dẫn cài License Server (v2 — self-serve)

Hệ thống bản quyền mô hình **tự phục vụ**:
- GV nhập [họ tên + SĐT] → hệ thống cấp mã 6 ký tự (vd `k7m3pr`)
- GV chuyển khoản 50k, nội dung CK = mã đó
- Thầy quản trị tick "đã thanh toán" trong Sheet (~10 giây/lần)
- GV đăng nhập bằng [SĐT + mã] → bind máy → mở khóa extension

Backend: 1 Google Apps Script bound vào 1 Google Sheet. Free, không cần host.

Tổng thời gian setup lần đầu: ~10 phút.

---

## Phần 1 · Setup Apps Script (lần đầu)

> **Quan trọng:** Apps Script phải **bound** vào 1 Sheet cụ thể, KHÔNG dùng `script.google.com → New project` (kiểu standalone sẽ lỗi).

### Bước 1: Tạo Google Sheet trống
1. Mở https://sheets.new
2. Đổi tên file → `SoNhanXetAI-License`

### Bước 2: Mở Apps Script gắn với Sheet
1. Trong Sheet → menu **Extensions** → **Apps Script**
2. Đổi tên project (góc trái trên) → `SoNhanXetAI-License`
3. Xóa toàn bộ code mẫu trong `Code.gs`
4. Copy toàn bộ nội dung file [`license-server.gs`](license-server.gs) → paste vào `Code.gs`
5. Bấm 💾 **Save** (Ctrl+S)

### Bước 3: Cấu hình bí mật
1. Bấm icon ⚙️ **Project Settings**
2. Cuộn xuống **Script Properties** → **Add script property**
3. Thêm:
   - Property: `ADMIN_KEY`
   - Value: chuỗi random 20+ ký tự (chỉ thầy biết)
4. **Save script properties**

### Bước 4: Tạo headers Sheet
1. Quay lại Editor → dropdown function → chọn **`setupSheet`**
2. Bấm **Run** ▶️
3. Lần đầu xin quyền: **Review permissions** → tài khoản → **Advanced** → **Go to ... (unsafe)** → **Allow**
4. Sau khi chạy: mở tab Sheet → sẽ thấy 13 cột header

### Bước 5: Deploy Web App
1. **Deploy** → **New deployment** → type **Web app**
2. Cấu hình:
   - Description: `License server v2`
   - Execute as: **Me**
   - Who has access: **Anyone**
3. **Deploy** → COPY URL `/exec`
4. Mở [`license/client.js`](client.js) → sửa dòng:
   ```js
   const LICENSE_API_URL = 'https://script.google.com/macros/s/.../exec';
   ```
5. Reload extension ở `chrome://extensions/`

### Bước 6: Đặt ảnh QR thanh toán
1. Lấy ảnh QR (VietQR) tài khoản nhận tiền của thầy — file PNG/JPG
2. Đổi tên thành `qr.png`
3. Copy vào thư mục **`D:\XebatcheoTrT\2\cogiao-ai-extension\license\qr.png`**
4. Reload extension. GV sẽ thấy ảnh QR khi đăng ký.

### Bước 7 (khuyến nghị): Auto dọn mã chưa thanh toán
1. Trong Apps Script Editor → ⏰ **Triggers** (cột trái) → **+ Add Trigger**
2. Cấu hình:
   - Function: `donDepMaCho`
   - Event source: **Time-driven**
   - Type: **Day timer** → giờ tùy ý (vd 2-3 AM)
3. **Save**

Hàm này tự xóa các mã `cho_thanh_toan` quá 7 ngày để sheet không phình.

✅ Xong setup!

---

## Phần 2 · Quy trình hằng ngày

### Khi GV chuyển khoản

1. Thầy mở app ngân hàng → thấy CK 50.000đ, nội dung VD `k7m3pr`
2. Mở Google Sheet `SoNhanXetAI-License`
3. Menu **🔑 Sổ NX - AI** → **💰 Tick đã thanh toán cho mã...**
4. Nhập 6 ký tự mã (`k7m3pr`) → OK
5. Hệ thống tự set: `da_thanh_toan=TRUE`, `ngay_thanh_toan=now`, `ngay_het_han=now+365`
6. GV mở extension → đăng nhập SĐT+mã → vào dùng được

### Khi GV đổi máy / cài lại Windows

GV nhắn Zalo cho thầy. Thầy:
- Menu **🔑 Sổ NX - AI** → **🔄 Reset thiết bị (theo SĐT)...**
- Nhập SĐT → GV đăng nhập lại trên máy mới với SĐT+mã cũ

### Khi nghi chia sẻ mã

- Menu **🔑 Sổ NX - AI** → **🔒 Khóa 1 SĐT (nghi share)...**

### Cấp mã vĩnh viễn / tặng dùng thử

Cấp mã bình thường rồi mở sheet → sửa cột `ngay_het_han` (cột I):
- Vĩnh viễn: `2099-01-01`
- Thử 30 ngày: ngày cách hôm nay 30 ngày

---

## Phần 3 · Cấu trúc Sheet `License` (13 cột)

| Cột | Tên | Mô tả |
|---|---|---|
| A | sdt | SĐT GV (`0912345678`) |
| B | gv_ho_ten | Họ tên GV nhập |
| C | ma_bi_mat | 6 ký tự — server sinh, = nội dung CK |
| D | ngay_dang_ky | Auto |
| E | so_tien | Auto = 50.000 |
| F | da_thanh_toan | Checkbox — thầy tick |
| G | ngay_thanh_toan | Auto khi tick |
| H | ngay_kich_hoat | Auto khi GV đăng nhập |
| I | ngay_het_han | Auto = ngày tick + 365 |
| J | device_fp | Hash thiết bị (auto bind) |
| K | last_check | Lần check gần nhất |
| L | trang_thai | `cho_thanh_toan` / `da_tra_tien` / `da_kich_hoat` / `het_han` / `khoa` |
| M | ghi_chu | Thiết bị info + note thủ công |

Thầy được sửa tay: B, F, G, I, M. KHÔNG nên sửa: A, C, D, E, H, J, K, L.

---

## Phần 4 · Khi sửa code Apps Script sau này

1. Sửa code trong Editor → Save
2. **Deploy** → **Manage deployments** → bút chì ✏️ ở deployment cũ → Version: **New version** → Deploy
3. URL `/exec` giữ nguyên → extension không cần update

**KHÔNG dùng "New deployment"** lần thứ 2 vì sẽ ra URL mới và extension phải đổi.

---

## Phần 5 · Khi từ v1 (mã `GV000001`) lên v2 (self-serve)

Nếu sheet đã có data v1 (cột `ma`, `email`):
1. Backup sheet (File → Make a copy)
2. Chạy lại `setupSheet()` — xóa data cũ và tạo schema mới
3. Hoặc tạo Sheet mới hoàn toàn

Sheet hiện tại của thầy chưa có data → chạy `setupSheet()` lại là an toàn.

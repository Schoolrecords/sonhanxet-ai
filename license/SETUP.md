# Hướng dẫn cài License Server v3 (V6.0 — Một-chạm)

Hệ thống bản quyền **một-chạm tự kích hoạt**:
- GV nhập [họ tên + SĐT] → hệ thống tự tạo tài khoản với **MÃ = chính SĐT của GV**
- GV chuyển khoản 30k, nội dung CK = **SĐT của chính cô** (không cần nhớ mã random)
- Thầy quản trị tick "đã thanh toán theo SĐT" trong Sheet (~5 giây/lần)
- Extension của GV **tự ping server mỗi 20-120s**, khi thấy đã tick là **tự kích hoạt** — GV KHÔNG cần thao tác lần 2

Backend: 1 Google Apps Script bound vào 1 Google Sheet. Free, không cần host.

Chính sách: **30.000đ cho 1 máy tính**. GV đổi máy → nhắn Zalo thầy, thầy reset trong Sheet.

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
   - Description: `License server v3 (V6.0 — Một-chạm)`
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
3. Copy vào thư mục **`D:\XebatcheoTrT\2\SoNhanXet_AI\license\qr.png`**
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

## Phần 2 · Quy trình hằng ngày (V6 — Một-chạm)

### Khi GV chuyển khoản (flow mới)

1. Thầy mở app ngân hàng → thấy CK 30.000đ, **nội dung CK = SĐT của GV** (vd `0913456789`)
2. Mở Google Sheet `SoNhanXetAI-License`
3. Menu **🔑 Sổ NX - AI** → **💰 Tick thanh toán theo SĐT... (V6 — khuyên dùng)**
4. Paste SĐT vào ô prompt (có thể có space/dấu chấm, hệ thống tự bỏ) → OK
5. Hệ thống tự set: `da_thanh_toan=TRUE`, `ngay_thanh_toan=now`, `ngay_het_han=now+365`
6. **Extension của GV tự ping server mỗi 20-120 giây → tự kích hoạt — GV không cần làm gì thêm**

**Tổng thao tác thầy: ~5 giây/ca** (nhanh hơn flow cũ vì SĐT copy thẳng từ sao kê NH).

### Khi GV v2 cũ (đăng ký trước 19/05/2026) chuyển khoản

1. Họ vẫn dùng mã 4 ký tự cũ (vd `k7m3`) làm nội dung CK
2. Menu **🔑 Sổ NX - AI** → **💰 Tick theo mã 4 ký tự... (GV v2 cũ)**
3. Nhập 4 ký tự → OK
4. GV cũ sẽ tự kích hoạt qua extension như flow mới (polling sẽ phát hiện)

### Khi GV đổi máy / cài lại Windows (chính sách 30k/1 máy)

GV nhắn Zalo cho thầy. Thầy:
- Menu **🔑 Sổ NX - AI** → **🔄 Reset thiết bị (theo SĐT)...**
- Nhập SĐT → cô vào extension trên máy mới, nhập SĐT + tên → tự kích hoạt lại (KHÔNG phải CK lại 30k)

**Nguyên tắc**: thầy tự đánh giá lý do (máy hỏng / cài lại Win / mua máy mới). Nếu nghi share → có thể từ chối hoặc khóa SĐT.

### Khi nghi chia sẻ tài khoản

- Menu **🔑 Sổ NX - AI** → **🔒 Khóa 1 SĐT (nghi share)...**

### Cấp tài khoản vĩnh viễn / tặng dùng thử

Cấp tài khoản bình thường (GV đăng ký + thầy tick), sau đó mở sheet → sửa cột `ngay_het_han` (cột I):
- Vĩnh viễn: `2099-01-01`
- Thử 30 ngày: ngày cách hôm nay 30 ngày

---

## Phần 3 · Cấu trúc Sheet `License` (13 cột)

Schema **KHÔNG đổi** từ v2 — GV cũ tiếp tục dùng bình thường.

| Cột | Tên | Mô tả |
|---|---|---|
| A | sdt | SĐT GV (`0912345678`) |
| B | gv_ho_ten | Họ tên GV nhập |
| C | ma_bi_mat | **V6: = SĐT** (cho user mới) / **V2: 4 ký tự** (cho GV cũ) — nội dung CK |
| D | ngay_dang_ky | Auto |
| E | so_tien | Auto = 30.000 |
| F | da_thanh_toan | Checkbox — thầy tick |
| G | ngay_thanh_toan | Auto khi tick |
| H | ngay_kich_hoat | Auto khi GV bind máy |
| I | ngay_het_han | Auto = ngày tick + 365 |
| J | device_fp | Hash thiết bị (auto bind, 1 SĐT = 1 máy) |
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

## Phần 5 · Migration từ v2 (5.x) lên v3 (V6.0)

**GV v2 cũ KHÔNG bị ảnh hưởng gì**:
- Sheet schema giữ nguyên 13 cột
- Mã 4 ký tự của GV cũ vẫn match khi bind device
- Extension V6.0 nhận diện cả 2 loại mã (SĐT 10 số HOẶC 4 ký tự)
- Menu Sheet giữ song song 2 tùy chọn tick: theo SĐT (mới) và theo mã (cũ)

**Khi GV v2 cũ đổi máy** sau khi đã update V6.0:
- Họ vào extension trên máy mới, nhập SĐT + tên (KHÔNG cần nhớ mã cũ)
- Server tự nhận diện qua SĐT, trả lại mã legacy
- Extension tự bind device (nếu thầy đã reset thiết bị trong Sheet)

**Lưu ý**: schema Sheet không đổi → KHÔNG cần chạy `setupSheet()` lại. Chỉ deploy New version của Apps Script là đủ.

---

## Phần 6 · Endpoint reference (cho dev)

Apps Script Web App accept POST với JSON body `{action, ...payload}`:

| Action | Payload | Trả về |
|---|---|---|
| `dangKy` | `{sdt, hoTen}` | `{ok, daDangKyTruoc?, alreadyPaid?, sdt, hoTen, ma, soTien}` |
| `checkPaymentStatus` | `{sdt}` | `{ok, status, sdt, hoTen, ma}` — V6 mới, dùng cho polling |
| `dangNhap` | `{sdt, ma, deviceFp, deviceInfo}` | `{ok, sdt, gv_ho_ten, validUntil, activatedAt}` |
| `checkLicense` | `{sdt, deviceFp}` | `{ok, sdt, validUntil, gv_ho_ten}` |
| `resetDevice` | `{sdt, adminKey}` | `{ok, message}` |

`status` (cho checkPaymentStatus): `cho_thanh_toan` / `da_tra_tien` / `da_kich_hoat` / `het_han` / `khoa` / `khong_ton_tai`

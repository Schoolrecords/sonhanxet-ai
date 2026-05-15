# Hồ sơ đăng Chrome Web Store — Sổ nhận xét - AI

Thư mục này chứa toàn bộ tài liệu cần để đăng extension lên Chrome Web Store (CWS).

## Checklist tổng quan

### Trước khi đăng

- [ ] **Đăng ký tài khoản Chrome Web Store Developer** — phí $5 một lần
      https://chrome.google.com/webstore/devconsole
- [ ] **Có thẻ Visa/Mastercard** để thanh toán $5 (hoặc nhờ người có thẻ)
- [ ] **Đóng gói extension thành file .zip**
      Nén toàn bộ thư mục gốc (chứa `manifest.json`) — KHÔNG nén thư mục cha
      Ví dụ đúng: zip chứa `manifest.json` ở root level, không phải `cogiao-ai-extension/manifest.json`
- [ ] **Kiểm tra `manifest.json` đã đúng version mới nhất** (hiện tại: `0.1.26`)
- [ ] **Privacy Policy đã được publish trên 1 URL công khai**
      → Sau khi launch website, dùng `https://<domain>/privacy`
- [ ] **Chuẩn bị hình ảnh** (xem `screenshot-guide.md`)

### Trong form Store Listing

- [ ] **Tên** (tối đa 75 ký tự): `Sổ nhận xét - AI` (hoặc xem `store-listing-vi.md`)
- [ ] **Mô tả ngắn** (tối đa 132 ký tự) — copy từ `store-listing-vi.md`
- [ ] **Mô tả chi tiết** (tối đa 16.000 ký tự) — copy từ `store-listing-vi.md`
- [ ] **Category**: `Productivity` (Hiệu suất)
- [ ] **Language**: `Tiếng Việt` (primary), có thể thêm `English` nếu muốn
- [ ] **Screenshots**: 3-5 ảnh, kích thước **1280×800** hoặc **640×400** PNG/JPEG
- [ ] **Small promo tile**: **440×280** (bắt buộc)
- [ ] **Marquee promo tile**: **1400×560** (tuỳ chọn — nên có để Google đẩy lên trang Editor's Pick)
- [ ] **Icon 128×128**: đã có ở `icons/icon-128.png`

### Privacy tab

- [ ] **Single Purpose**: copy từ `single-purpose-statement.md`
- [ ] **Permission justifications**: copy từng dòng từ `permission-justifications.md`
- [ ] **Remote code use**: chọn **"No, I am not using Remote code"**
- [ ] **Data usage disclosures** — đánh dấu các mục:
  - [x] Personally identifiable information — **KHÔNG** (extension không thu thập)
  - [x] Health information — KHÔNG
  - [x] Financial info — KHÔNG
  - [x] Authentication info — KHÔNG (license code không phải credential web)
  - [x] Personal communications — KHÔNG
  - [x] Location — KHÔNG
  - [x] Web history — KHÔNG
  - [x] User activity — KHÔNG
  - [x] Website content — **CÓ** (đọc DOM Vnedu) — đánh dấu mục này
- [ ] **Certifications** (3 ô tick):
  - [x] I do not sell or transfer user data to third parties...
  - [x] I do not use or transfer user data for purposes that are unrelated...
  - [x] I do not use or transfer user data to determine creditworthiness...
- [ ] **Privacy Policy URL**: dán URL trang privacy

### Distribution tab

- [ ] **Visibility**: chọn **Public** (sau khi test xong) hoặc **Unlisted** (chỉ ai có link mới cài được — phù hợp giai đoạn beta)
- [ ] **Regions**: chọn **Vietnam** trước. Có thể chọn All regions sau.
- [ ] **Pricing**: **Free** (license thu phí riêng qua chuyển khoản, không qua CWS Pay)

## Quy trình đăng (lần đầu)

1. Đăng nhập https://chrome.google.com/webstore/devconsole
2. Trả $5 phí 1 lần
3. Bấm **New Item** → upload file `.zip`
4. Điền 3 tab: **Store listing**, **Privacy**, **Distribution**
5. **Submit for review**
6. Chờ Google duyệt: **1-7 ngày** (lần đầu chậm nhất)
7. Khi được duyệt → có URL dạng `chrome.google.com/webstore/detail/abc123xyz...`
8. Dán URL này vào website (file `website/src/pages/index.astro` — biến `CHROME_STORE_URL`)

## Quy trình update sau này

1. Tăng version trong `manifest.json` (vd `0.1.26` → `0.1.27`)
2. Nén lại thành .zip
3. Vào CWS Console → extension → **Package** → **Upload new package**
4. **Submit for review** (update thường được duyệt trong vài giờ — 24h)

## File trong thư mục này

| File | Dùng cho |
|---|---|
| `README.md` | File này — checklist tổng quan |
| `store-listing-vi.md` | Mô tả ngắn + dài tiếng Việt — paste vào form CWS |
| `single-purpose-statement.md` | Mục "Single purpose" trong tab Privacy |
| `permission-justifications.md` | Giải trình từng permission (CWS bắt buộc) |
| `privacy-policy-vi.md` | Privacy Policy tiếng Việt — publish lên website |
| `privacy-policy-en.md` | Privacy Policy tiếng Anh — phòng khi CWS reviewer cần |
| `screenshot-guide.md` | Hướng dẫn chụp 5 screenshot và tile promo |

## Lưu ý khi bị reject

Google hay reject lần đầu vì:
1. **Permission justification quá chung chung** → mỗi permission phải giải thích **CỤ THỂ feature nào dùng nó**
2. **Privacy policy không match với data usage disclosure** → 2 thông tin phải khớp nhau
3. **Screenshot có watermark/logo bên thứ 3** → screenshot phải sạch
4. **Mô tả vi phạm spam policy** (lặp keyword) → viết tự nhiên, không nhồi nhét
5. **Tên trùng/giả mạo** — "Sổ nhận xét" không trùng với extension nào hiện có, OK

Khi bị reject sẽ có email nêu rõ lý do. Sửa rồi resubmit.

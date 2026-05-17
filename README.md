# Sổ nhận xét - AI · Chrome Extension v1.5

> Trợ lý sinh nhận xét cuối kỳ tự động cho giáo viên tiểu học trên Vnedu — theo Thông tư 27/2020.

[**🌐 Cài đặt từ Chrome Web Store**](https://chromewebstore.google.com/detail/sổ-nhận-xét-ai/hhiipgifeplegcejhpdmdbnbabjikllh) · [**📖 Website / Hướng dẫn**](https://sonhanxet-ai.vercel.app/cai-dat)

## Tính năng

- **Sinh nhận xét môn học** — 12 môn (TV, Toán, TNXH, Khoa học, Sử-Địa, ĐĐ, Tin học, TA, GDTC, ÂN, MT, HĐTN) · 4 mức **T+ / T / H / C** · văn bản đa dạng tránh trùng lặp.
- **Tự suy NL/PC** — 13–15 trường Năng lực · Phẩm chất auto-suggest từ điểm các môn (TT27/2020 + CT GDPT 2018). GV click badge để override.
- **Áp dụng 1 click** — preview trong sidebar → bấm Áp dụng → chữ tự ghi vào textarea Vnedu → GV bấm Lưu.
- **Riêng tư** — tên HS / điểm số chỉ ở trong tab Chrome. Không server, không database. Chỉ SĐT + mã kích hoạt + hash máy của GV rời máy (xác thực license).

## Cài đặt

**Khuyến nghị:** cài qua [Chrome Web Store](https://chromewebstore.google.com/detail/sổ-nhận-xét-ai/hhiipgifeplegcejhpdmdbnbabjikllh) — 1 click, tự cập nhật.

**Dev / load unpacked** (cho người maintain repo này):
1. Clone repo
2. Chrome → `chrome://extensions/` → bật **Developer mode**
3. **Load unpacked** → chọn thư mục chứa `manifest.json`

## Cách dùng

### Sinh nhận xét môn

1. Đăng nhập [vnedu.vn](https://vnedu.vn) → **Sổ điểm → Sổ nhận xét**
2. Chọn Khối · Lớp · Môn · Học kỳ
3. Đợi Vnedu load bảng HS → **sidebar tự xuất hiện bên phải**
4. Bấm **"Sinh nhận xét cho N HS"** → xem preview → **"Áp dụng vào Vnedu"** → **Lưu**

### Sinh NL/PC

1. Vào **Sổ điểm → Sổ nhận xét → Nhận xét NL/PC**
2. Sidebar đọc cache điểm các môn (đã tích lũy từ các lần mở Sổ nhận xét trước) → auto-suggest mức T/Đ/C cho 13–15 trường
3. Click badge để override mức nếu cần → **Áp dụng** → **Lưu**

**Số trường NL/PC theo lớp (V1.5):**
- **Lớp 1-2** — 15 trường: 4 NL chung + 5 NL đặc thù (Ngôn ngữ, Tính toán, Thẩm mĩ, Thể chất + Nhận xét chung) + 6 PC
- **Lớp 3** — 17 trường: thêm Công nghệ + Tin học
- **Lớp 4-5** — 18 trường: thêm Khoa học

> **V1.5 thay đổi:** Năng lực Khoa học chỉ áp dụng lớp 4-5 (CT GDPT 2018 — môn Khoa học bắt đầu từ lớp 4). Lớp 1-3 chỉ có TNXH.

## Cấu trúc thư mục

```
SoNhanXet_AI/
├── manifest.json              # MV3, version 1.5
├── background/
│   └── service-worker.js      # Toggle sidebar
├── content/
│   ├── content-script.js      # Entry point Vnedu
│   ├── vnedu-adapter.js       # Đọc/ghi DOM Vnedu
│   └── sidebar-inject.css
├── sidebar/
│   ├── sidebar.html / .css / .js
├── engine/
│   ├── engine.js              # Smart Rule-based + NLPCMapper
│   └── data/nhanxet-ngan.json
├── license/                   # Client license (gitignored)
├── icons/                     # 16/48/128
├── test/                      # Node-side tests
├── website/                   # Astro landing — sonhanxet-ai.vercel.app
├── cws-submission/            # Tài liệu submit Chrome Web Store
├── screenshots/, mockup/, videos/   # Asset marketing
└── BUGS.md                    # Bug log nội bộ
```

## Test

```bash
node test/run-node.js
```

## Bảo mật

- ✅ Dữ liệu HS **không rời máy GV** — sinh nhận xét cục bộ trong trình duyệt.
- ✅ **Không có server riêng cho HS data.** Chỉ license server xác thực mã kích hoạt.
- ✅ **Mã nguồn mở** — đọc toàn bộ code tại repo này.
- 📜 [Chính sách bảo mật đầy đủ](https://sonhanxet-ai.vercel.app/privacy)

## Liên hệ

**Chung Trần** — Phó Hiệu trưởng, Trường Tiểu học Diễn Liên, xã Quảng Châu, tỉnh Nghệ An.

- Zalo / điện thoại: **0913031073**
- Email: **chungsongthinh@gmail.com**

---

*Phát triển bởi giáo viên cho giáo viên.*

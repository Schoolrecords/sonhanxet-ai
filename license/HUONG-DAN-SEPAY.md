# Cài tự kích hoạt qua SePay cho Sổ nhận xét - AI (05/11/2026)

Sau khi cài: giáo viên quét QR, chuyển 30.000đ với nội dung `NX K7M3` (mã của từng người),
ngân hàng báo có, SePay gọi Worker, Worker chuyển tiếp vào máy chủ bản quyền, và tiện ích tự kích hoạt
sau khoảng 10 đến 30 giây. Thầy không phải bấm "Tick" nữa.
Bản 6.0.6 đang có trên Store cũng tự kích hoạt được (chỉ cần sửa máy chủ, không cần cập nhật tiện ích).

Đường thanh toán của Bút Xanh **không bị đụng tới**: Sổ nhận xét dùng Worker riêng, máy chủ riêng, tài khoản ngân hàng riêng.

## Bước 1. Liên kết tài khoản ngân hàng mới vào SePay
SePay ▸ Ngân hàng ▸ Thêm tài khoản (tài khoản nhận tiền Sổ nhận xét).

## Bước 2. Dán mã mới vào máy chủ bản quyền (Apps Script gắn Sheet "SoNhanXetAI-License")
1. Trên máy, chạy lệnh để chép mã:
   `Set-Clipboard -Value (Get-Content -Raw -Encoding UTF8 'J:\SoNhanXet-AI\license\license-server.gs')`
2. Mở Apps Script, vào Code.gs, bấm Ctrl+A rồi Ctrl+V, sau đó Ctrl+S.
3. **Triển khai ▸ Quản lý triển khai ▸ ✏️ Chỉnh sửa ▸ Phiên bản: Phiên bản mới ▸ Triển khai.**
   KHÔNG chọn "Triển khai mới", vì làm vậy địa chỉ /exec sẽ đổi và mọi tiện ích đang chạy mất kết nối.
4. Tải lại Sheet. Mở menu **🔑 Sổ NX - AI ▸ 🔗 Cài kết nối SePay**, nhập số tài khoản nhận tiền.
   Hộp thông báo sẽ hiện `?token=...`; chép lại chuỗi này cho bước 3.

## Bước 3. Tạo Worker cầu nối trên Cloudflare
1. Workers & Pages ▸ Create ▸ Worker, đặt tên `sonhanxet-sepay`. Dán nội dung tệp
   `license/worker-sepay-sonhanxet.js`, rồi Deploy.
2. Vào Settings ▸ Variables and Secrets, thêm:
   - `APPS_SCRIPT_URL` (Text) = `https://script.google.com/macros/s/AKfycbwkUaBdK2PJN61NipPDDklD1Lhs4xrpdrcmFjJJQc0W80kpw2KASKdmMTn-pjAHqZfw/exec?token=<chuỗi ở bước 2>`
   - `WEBHOOK_TOKEN` (Secret) = một chuỗi tự đặt, khác chuỗi trên
   Rồi bấm Deploy.
3. Mở địa chỉ Worker bằng trình duyệt. Phải thấy `daCaiAppsScript: true, daCaiToken: true`.

## Bước 4. Khai báo webhook trong SePay
SePay ▸ Tích hợp Webhooks ▸ Thêm:
- Sự kiện: Có tiền vào; Tài khoản: **chỉ chọn tài khoản Sổ nhận xét**
- URL: `https://sonhanxet-sepay.<tên>.workers.dev/?token=<WEBHOOK_TOKEN>`
- Kiểu chứng thực: Không cần (token đã nằm trên URL)

## Bước 5. Điền tài khoản vào tiện ích (để QR có sẵn số tiền và nội dung)
Mở tệp `license/client.js`, tìm dòng `const NGAN_HANG = {` rồi điền mã ngân hàng VietQR
(MB, VCB, ICB, BIDV, VBA...) và số tài khoản. Sau đó đóng gói lại ZIP.
Nếu chưa điền, tiện ích vẫn hiện ảnh `license/qr.png` như cũ.

## Nghiệm thu
- Tự chuyển thử 1.000đ với nội dung không có mã: tab **GiaoDich** phải có dòng "CHỜ XỬ LÝ TAY", không ai được mở khoá.
- Một giáo viên đăng ký thật rồi chuyển 30.000đ: tab GiaoDich phải có dòng "✓ ĐÃ MỞ KHOÁ" kèm tên giáo viên, và tiện ích của giáo viên tự kích hoạt.

## Vận hành
- Dòng **CHỜ XỬ LÝ TAY** (sai nội dung, khớp hai người, chuyển hai lần): dùng menu **🏦 Mở khoá tay...**, nhập SĐT của giáo viên. Hộp thông báo sẽ hiện mã đăng nhập của giáo viên đó.
- Dòng **THIẾU TIỀN**: nhắn giáo viên chuyển thêm, rồi mở khoá tay.
- Mỗi bản quyền dùng được **mọi máy**. Tab **ThietBi** ghi từng máy; cột N của tab License là số máy dùng trong 30 ngày, quá 5 máy thì ô tô đỏ. Menu **📊 Cập nhật cột số máy** tính lại cột này. Có thể đặt Trigger cho hàm `capNhatSoMayToanBo` chạy mỗi ngày.
- Hạn dùng: đến 31/8 cuối năm học (trả tiền từ tháng 6 trở đi thì tính cho năm học sau).
- Chạy thử máy chủ mà không đụng dữ liệu thật:
  `node tools/kiem-thu-license-sepay.js license/license-server.gs`

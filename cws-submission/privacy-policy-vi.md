# Chính sách Bảo mật — Sổ nhận xét - AI

**Hiệu lực từ:** 15/05/2026
**Phiên bản:** 1.0
**Áp dụng cho:** Chrome Extension "Sổ nhận xét - AI" (mọi phiên bản)

---

## Tóm tắt 30 giây

- Chúng tôi **KHÔNG thu thập** tên, điểm hay bất kỳ thông tin nào của học sinh.
- Dữ liệu học sinh **KHÔNG rời máy** của thầy/cô. Mọi nhận xét được sinh cục bộ trong trình duyệt.
- Chỉ có **3 thông tin** rời máy GV: số điện thoại GV, mã kích hoạt, và device fingerprint — tất cả chỉ để xác thực license.
- Extension là **mã nguồn mở** — bất kỳ ai cũng có thể kiểm tra code.

---

## 1. Chúng tôi là ai

"Sổ nhận xét - AI" được phát triển và vận hành bởi **Chung Trần** (Phó Hiệu trưởng Trường Tiểu học Diễn Liên, xã Quảng Châu, tỉnh Nghệ An), với tư cách cá nhân, phục vụ cộng đồng giáo viên tiểu học sử dụng hệ thống Vnedu.

Liên hệ: chungsongthinh@gmail.com (hoặc Zalo qua website).

## 2. Dữ liệu chúng tôi KHÔNG thu thập

Extension **không gửi đi** bất kỳ thông tin nào sau đây:

- Tên học sinh
- Điểm số, đánh giá học lực
- Tên lớp, tên trường, tên môn cụ thể của lớp
- Danh sách phụ huynh
- Bất kỳ nội dung nào hiển thị trên trang Vnedu

Tất cả việc đọc dữ liệu HS và sinh nhận xét diễn ra **hoàn toàn cục bộ** trong trình duyệt Chrome của giáo viên. Không có máy chủ trung gian nào nhận được dữ liệu này.

## 3. Dữ liệu chúng tôi CÓ thu thập (cho mục đích kích hoạt license)

Khi GV đăng ký và kích hoạt mã sử dụng, hệ thống license của chúng tôi (Google Apps Script + Google Sheet do tác giả tự host) lưu các thông tin sau:

| Trường | Mục đích | Ai thấy được |
|---|---|---|
| Họ tên GV (do GV tự nhập) | Hiển thị trong sheet quản trị để admin xác nhận đã chuyển khoản | Chỉ admin (tác giả) |
| Số điện thoại GV | Định danh GV để đăng nhập + reset thiết bị khi cần | Chỉ admin |
| Mã kích hoạt 6 ký tự (server sinh) | Khớp với nội dung chuyển khoản | Chỉ admin |
| Device fingerprint (hash SHA-256) | Chống chia sẻ mã giữa nhiều máy | Chỉ admin |
| Ngày đăng ký / thanh toán / kích hoạt / hết hạn | Quản lý vòng đời license | Chỉ admin |
| Lần check cuối | Phát hiện bất thường (ví dụ nhiều máy cùng mã) | Chỉ admin |

**Lưu ý:** Các thông tin này lưu trong Google Sheet riêng của tác giả, không chia sẻ cho bên thứ 3, không bán, không dùng cho mục đích quảng cáo. Sheet chỉ dùng để quản trị license — tương tự sổ đăng ký khách hàng của một cửa hàng nhỏ.

## 4. Quyền (permissions) extension yêu cầu

| Permission | Vì sao cần |
|---|---|
| `storage` | Lưu cài đặt cá nhân GV (font-size sidebar, tuỳ chọn template) và cache mã kích hoạt |
| `host_permissions: *.vnedu.vn` | Đọc/ghi DOM trang Vnedu để sinh và áp dụng nhận xét |
| `host_permissions: script.google.com` | Gọi license server để xác thực kích hoạt |

Extension **KHÔNG yêu cầu** các permission nhạy cảm như `tabs`, `cookies`, `webRequest`, `history`, hay `geolocation`.

## 5. Bên thứ 3

Extension không chia sẻ dữ liệu với bên thứ 3 nào.

Hạ tầng license sử dụng dịch vụ của Google (Google Apps Script, Google Sheets) — tức là chỉ Google (với tư cách nhà cung cấp hạ tầng) có thể về mặt kỹ thuật thấy traffic đến server. Vui lòng tham khảo [Chính sách Bảo mật của Google](https://policies.google.com/privacy) nếu quan tâm. Tác giả không có cơ chế nào để Google đọc nội dung Sheet ngoài việc lưu trữ.

## 6. Quyền của giáo viên

Bất kỳ lúc nào, GV có quyền:

- **Yêu cầu xoá toàn bộ thông tin** đăng ký license (số điện thoại, tên, mã) — gửi yêu cầu qua email; tác giả sẽ xoá trong vòng 7 ngày.
- **Yêu cầu export** dữ liệu liên quan đến mình.
- **Yêu cầu reset thiết bị** khi đổi máy hoặc cài lại Windows.
- **Gỡ extension** bất cứ lúc nào qua `chrome://extensions/` — sau khi gỡ, không còn bất kỳ kết nối nào từ máy GV đến hệ thống.

## 7. Trẻ em (COPPA)

Extension này dành cho **giáo viên** (người trưởng thành), **không** dành cho học sinh. Mặc dù extension đọc tên HS trên màn hình GV để sinh nhận xét, các thông tin đó:

- Không bao giờ rời máy của GV
- Không được lưu lại sau khi GV đóng tab Vnedu
- Không liên kết với bất kỳ định danh nào của HS

Vì không có dữ liệu trẻ em nào được thu thập hoặc truyền đi, sản phẩm tuân thủ tinh thần của COPPA và Luật An toàn Thông tin Trẻ em Việt Nam.

## 8. Bảo mật kỹ thuật

- Toàn bộ giao tiếp với license server qua **HTTPS**.
- Device fingerprint là **hash 1 chiều** (SHA-256) — không thể giải ngược ra thông tin nguyên gốc.
- Mã nguồn extension **mở** — bất kỳ ai cũng có thể audit.

## 9. Thay đổi chính sách

Khi có thay đổi chính sách, phiên bản mới sẽ được publish tại URL chính thức cùng với ngày hiệu lực. Thay đổi quan trọng (mở rộng phạm vi thu thập) sẽ được thông báo trực tiếp trong sidebar trước khi áp dụng.

## 10. Liên hệ

Mọi câu hỏi về Chính sách Bảo mật:

- Email: chungsongthinh@gmail.com
- Tác giả: Chung Trần — Trường Tiểu học Diễn Liên, xã Quảng Châu, tỉnh Nghệ An

---

*Tài liệu này được viết bằng ngôn ngữ đơn giản nhất có thể. Nếu thầy/cô đọc thấy đoạn nào khó hiểu, vui lòng phản hồi để cải thiện.*

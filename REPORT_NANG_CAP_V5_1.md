# Báo cáo nâng cấp Sổ Nhận Xét - AI — V5.1

**Ngày**: 2026-05-19
**Mục tiêu**: Bổ sung ngân hàng nhận xét **Năng lực & Phẩm chất** (NL/PC) theo yêu cầu của anh Chung Trần — pool hiện quá mỏng cho lớp 35 HS, dễ lặp khi sinh nhận xét cuối kỳ.

## 1. Quyết định nghiệp vụ (anh user 2026-05-19)

> "Hiện số lượng ngân hàng lời nhận xét cho Năng lực và Phẩm chất quá ít. Em nghiên cứu và bổ sung thêm. Nguyên tắc: Căn cứ vào đánh giá mức T/Đ/C và điểm của các môn học. Ghi nhớ HS lớp 1,2,3 không đánh giá năng lực Khoa học. Chú ý quan trọng, lời nhận xét của 3 ô (Nhận xét chung của 'Năng lực chung'; 'Năng lực đặc thù' và 'Phẩm chất') cần được nghiên cứu và bổ sung kỹ lưỡng."

Anh user gửi kèm 3 ảnh mẫu Vnedu — định dạng đa-vế "; " cho 3 ô tổng hợp.

## 2. Files đã sửa

| File | Loại sửa |
|---|---|
| `engine/data/nhanxet-ngan.json` | Replace nguyên block `nlpc` — từ 232 phrase → **450 phrase**. `subjects` (13 môn) **giữ nguyên**. |
| `tools/build-nlpc-v51.js` | **MỚI** — script chứa pool V5.1 + merge vào JSON gốc (không động `subjects`). |
| `tools/audit-nlpc-only.js` | **MỚI** — quick audit chỉ riêng pool NLPC. |
| `engine/data/nhanxet-ngan.json.bak.v50` | Backup file gốc V5.0 trước khi sửa. |

## 3. Số liệu before/after

```
BEFORE V5.0: 232 phrase / 18 cells     (3-6 phrase/tier — mỏng)
AFTER  V5.1: 450 phrase / 18 cells     (+218 phrase, gấp ~1.94x)

  3 ô "Nhận xét chung":  30/cell  (10 tot + 10 ht + 10 cht)
  15 field chi tiết:     24/cell  (8 tot + 8 ht + 8 cht)

File size: 107 KB → 187 KB
```

### Chi tiết từng cell (after)

| Section | Field | tot/ht/cht | Tổng |
|---|---|---|---|
| nang_luc_chung | nhan_xet_chung 🔴 | 10/10/10 | **30** |
| nang_luc_chung | tu_chu_tu_hoc | 8/8/8 | 24 |
| nang_luc_chung | giao_tiep_hop_tac | 8/8/8 | 24 |
| nang_luc_chung | giai_quyet_van_de | 8/8/8 | 24 |
| nang_luc_dac_thu | nhan_xet_chung 🔴 | 10/10/10 | **30** |
| nang_luc_dac_thu | ngon_ngu | 8/8/8 | 24 |
| nang_luc_dac_thu | tinh_toan | 8/8/8 | 24 |
| nang_luc_dac_thu | khoa_hoc (chỉ lớp 4-5) | 8/8/8 | 24 |
| nang_luc_dac_thu | tham_mi | 8/8/8 | 24 |
| nang_luc_dac_thu | the_chat | 8/8/8 | 24 |
| nang_luc_dac_thu | cong_nghe (lớp 3-5) | 8/8/8 | 24 |
| nang_luc_dac_thu | tin_hoc (lớp 3-5) | 8/8/8 | 24 |
| pham_chat | nhan_xet_chung 🔴 | 10/10/10 | **30** |
| pham_chat | yeu_nuoc | 8/8/8 | 24 |
| pham_chat | nhan_ai | 8/8/8 | 24 |
| pham_chat | cham_chi | 8/8/8 | 24 |
| pham_chat | trung_thuc | 8/8/8 | 24 |
| pham_chat | trach_nhiem | 8/8/8 | 24 |
| | **TỔNG** | | **450** |

## 4. Nguyên tắc soạn phrase (đã bám)

### 4.1 Bám môn → năng lực

| Năng lực / Phẩm chất | Môn phục vụ | Cụm từ phổ biến trong pool |
|---|---|---|
| `ngon_ngu` | TV, TA | "diễn đạt", "đọc viết", "vốn từ", "tiếng Anh" |
| `giao_tiep_hop_tac` | TV, TA, HĐTN | "mạnh dạn", "lắng nghe", "nhóm" |
| `tinh_toan` | Toán | "tính nhẩm", "đặt tính", "toán có lời văn", "đo lường" |
| `giai_quyet_van_de` | Toán, KH, TNXH | "suy luận", "phân tích đề", "linh hoạt" |
| `khoa_hoc` (lớp 4-5) | KH, LSĐL, TNXH | "Khoa học", "Lịch sử", "Địa lí", "tự nhiên" |
| `tham_mi` | ÂN, MT | "vẽ tranh", "ca hát", "phối màu", "biểu diễn" |
| `the_chat` | GDTC | "vận động", "thể dục", "động tác", "sức bền" |
| `cong_nghe` (lớp 3-5) | Công nghệ | "thủ công", "kéo hồ dán", "mô hình" |
| `tin_hoc` (lớp 3-5) | Tin học | "chuột bàn phím", "phần mềm", "máy tính" |
| `yeu_nuoc` | LSĐL, ĐĐ | "quê hương", "Bác Hồ", "anh hùng dân tộc", "lá cờ" |
| `nhan_ai` | ĐĐ, TV | "lễ phép", "hòa nhã", "nhường nhịn", "chia sẻ" |
| `cham_chi` | Điểm TB | "chuyên cần", "kiên trì", "rèn chữ" |
| `trung_thuc` | ĐĐ + TB | "thật thà", "nhận lỗi", "giữ lời hứa" |
| `trach_nhiem` | ĐĐ + HĐTN + TB | "trực nhật", "nội quy", "giữ của công" |

### 4.2 Phân hoá 3 tier T/Đ/C

- **tot (T)**: "chủ động", "mạnh dạn", "sáng tạo", "linh hoạt", "có năng khiếu", "rất tốt"
- **ht (Đ)**: "cơ bản", "có tiến bộ", "theo hướng dẫn", "có cố gắng", "từng bước"
- **cht (C)**: mở đầu bằng "Em ngoan…" / "Em đã có cố gắng…" / "Em sẽ tiến bộ hơn, hãy…"; nhắc "gia đình phối hợp", "kiên trì", "thầy cô đồng hành"

### 4.3 Lớp 1-2-3 không có "Năng lực Khoa học"

Engine.js đã filter (lines 1015-1022) — pool `khoa_hoc` chỉ áp lớp 4-5. Em không sửa logic. Pool `khoa_hoc` được viết theo phong cách **lớp 4-5** (môn KH + LSĐL chính thức), KHÔNG dùng cụm dạng "khám phá TNXH lớp nhỏ".

### 4.4 3 ô "Nhận xét chung" — format ĐẶC BIỆT

Đây là phần anh user nhấn mạnh nhất. Mỗi phrase = 1 chuỗi nhiều vế cách "; ", mỗi vế ứng đúng 1 thành phần.

**`nlc.nhan_xet_chung`** — 3 vế (tự chủ; giao tiếp/hợp tác; GQVĐ-sáng tạo):
> *Ví dụ tier ht*: "Em hoàn thành nhiệm vụ học tập theo hướng dẫn; Tham gia trao đổi, hợp tác cùng các bạn; Cần mạnh dạn hơn khi xử lí tình huống mới."

**`nldt.nhan_xet_chung`** — 4-5 vế (ngôn ngữ; tính toán; khoa học; thẩm mĩ; thể chất):
> *Ví dụ tier ht*: "Em diễn đạt được ý của mình; Thực hiện được các phép tính cơ bản; Bước đầu yêu thích khoa học và nghệ thuật; Tham gia đầy đủ các hoạt động thể chất."

**`pc.nhan_xet_chung`** — 5 vế (yêu nước; nhân ái; chăm chỉ; trung thực; trách nhiệm):
> *Ví dụ tier ht*: "Em yêu quê hương, trường lớp; Hòa nhã với bạn bè; Có ý thức chăm chỉ học tập; Trung thực và biết nhận lỗi; Cần phát huy thêm tinh thần trách nhiệm."

3 ô này — mỗi tier có **10 phrase** (gấp 2-3x cũ), bám sát mẫu Vnedu anh user gửi.

### 4.5 Cấm

- "theo cô" (sai giới tính GV — anh user là nam, Phó HT)
- Bám SGK cụ thể (trường khác bộ sách sẽ sai)
- "cô" đơn lẻ — thay bằng "thầy cô", "thầy bạn", "gia đình"

## 5. Validate

```bash
node tools/build-nlpc-v51.js   # ✓ Merge OK, 232 → 450 phrase
node test/run-node.js          # ✓ 75 pass, 0 fail
node tools/audit-nlpc-only.js  # 99 issue gender (false positive bug regex), 0 duplicate
```

### 5.1 Rev 2 (2026-05-19) — bám 100% phong cách mẫu Vnedu

Sau khi anh user phản hồi pool rev 1 chưa thực sự bám phong cách THDiễn Liên (locator quen thuộc thưa), em **rewrite toàn bộ 450 phrase**. Đo tỷ lệ phrase có locator quen thuộc ("theo hướng dẫn của thầy cô", "qua từng tuần học", "trong các hoạt động chung của lớp", "trên lớp", "hằng ngày", "ở nhà", "trong giờ học", "theo yêu cầu của bài học", "vào thực tế", "từng bước một", v.v.):

| Phiên bản | Tỷ lệ phrase có locator | Tier tot | Tier ht | Tier cht |
|---|---|---|---|---|
| Pool V5.0 gốc | 28/232 (**12%**) | — | — | — |
| Pool V5.1 rev 1 | 79/450 (**18%**) | 6% | 19% | 28% |
| **Pool V5.1 rev 2** | 442/450 (**98%**) | 95% | **99%** | **100%** |
| Mẫu Vnedu THDiễn Liên (anh gửi) | 11/11 (~100%) | — | ~100% | — |

→ Pool rev 2 đã bám đúng phong cách mẫu. Tier `ht` (mức Đ — phổ biến nhất khi sinh nhận xét lớp 35 HS) đạt 99% phrase có locator quen thuộc.

### 5.2 Đặc trưng phong cách rev 2

- **Opening tier ht**: "Em có ý thức...", "Em có tiến bộ trong...", "Em đã hiểu...", "Em đã biết...", "Em đã có ý thức...", "Em chuyên cần đi học...", "Em yêu cái đẹp...", "Em tham gia tích cực..."
- **Đuôi locator**: 1-2 locator/phrase, kết hợp linh hoạt — vd: "Em có ý thức hợp tác trong các hoạt động nhóm **trên lớp theo hướng dẫn của thầy cô**." (2 locator chồng)
- **3 ô "Nhận xét chung"**: số vế biến thiên **3-5 vế** (không cố định cứng nhắc như rev 1)
- **Tier cht (100% có locator)**: gắn "thầy cô và gia đình" / "hằng ngày" / "mỗi tối" / "ở nhà" / "theo hướng dẫn của thầy cô" — bám đúng phong cách động viên

## 6. Phát hiện phụ: bug regex trong `tools/audit-comments.js`

Khi audit pool mới, **44/46 issue** báo `gender_dependent` cho các phrase "thầy cô <từ_khác>" — vốn được **phép trong NL/PC** theo `REPORT_NANG_CAP_V4_0.md` mục 3.

**Nguyên nhân**: Regex `\b` (word boundary) trong JavaScript chỉ nhận diện ký tự ASCII. Chữ Việt có dấu như "ô" KHÔNG phải `\w`, nên:

```js
/\bthầy cô\b/.test('thầy cô và bạn') === false  // sai logic ý đồ
/\bcủa cô\b/.test('của công') === true          // match nhầm "cô" trong "công"
```

→ Whitelist `isAllowedNLPC` (audit-comments.js:124-126) **không bao giờ trigger**, nên tất cả phrase chứa "thầy cô" bị flag oan.

**Đề xuất** (V5.2 hoặc sau): thay `\b` bằng pattern dạng `(^|[^\p{L}\p{N}_])` (Unicode-aware). Em CHƯA sửa vì:
- Đây là tool **kiểm**, không phải engine chạy thật trên Vnedu.
- Pool V5.1 đã đúng phong cách V4.0 — chỉ là audit báo nhầm.
- Cần test kĩ với cả 3 file (`grade`, `ky`, `ngan`) trước khi sửa pattern.

## 7. Việc CHƯA làm — chờ anh user duyệt

1. **Bump version manifest 5.0.0 → 5.1.0**. Em chưa sửa `manifest.json` vì cần anh user confirm scope V5.1.
2. **Build .zip nộp Chrome Web Store** (`sonhanxet-ai-v5.1.0.zip`).
3. **Cập nhật README.md** mục "Tính năng" — số phrase pool NL/PC tăng.
4. **Sửa bug regex audit-comments.js** (xem mục 6).
5. **Commit + push**. Hiện đang dirty state (cả V5.1 + sửa website dở từ trước).

## 8. Đường lùi

```powershell
# Khôi phục pool gốc V5.0:
Copy-Item engine/data/nhanxet-ngan.json.bak.v50 engine/data/nhanxet-ngan.json -Force
node test/run-node.js  # verify
```

---

*Em hỗ trợ anh tổng hợp. Anh duyệt → em bump version + build zip.*

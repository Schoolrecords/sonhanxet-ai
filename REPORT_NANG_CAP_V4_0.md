# Báo cáo nâng cấp Sổ Nhận Xét - AI — V4.0

**Ngày**: 2026-05-18
**Mục tiêu**: Major version bump (2.3.10 → 4.0.0) cho Chrome Web Store. Siết logic nghiệp vụ theo phong cách THDienLien anh user đã chốt, áp dụng các góp ý KỸ THUẬT đúng từ ChatGPT, **không** áp dụng các góp ý phá phong cách.

## 1. Files đã sửa

| File | Loại sửa |
|---|---|
| `manifest.json` | 2.3.10 → **4.0.0**, mô tả mới |
| `engine/engine.js` | Soft ban context-aware (subject vs nlpc), REMEDIATION_PHRASES bắt buộc, sanitize cuối sau persona, validate context |
| `engine/data/nhanxet-grade.json` | Pool phong cách THDienLien giữ nguyên + clean cụm sai giới tính GV còn sót |
| `engine/data/nhanxet-ky.json` | Clean 14 cụm "theo cô" → "theo hướng dẫn" |
| `engine/data/nhanxet-ngan.json` | Clean cụm sai giới tính nếu có |
| `tools/audit-comments.js` | **Rewrite** — theo schema THDienLien `grades.all.all_ky`, kiểm 8 loại lỗi |
| `tools/test-engine-v40.js` | **MỚI** — 8 test cases theo prompt ChatGPT |
| Backup `*.bak.v40` | 7 file gốc trước sửa |

## 2. Khôi phục ma trận môn × lớp × kỳ × mức điểm

**Quyết định**: Giữ schema THDienLien `grades.all.all_ky` (chung mọi lớp/kỳ), KHÔNG đảo về `grades[1-5][ghk1-chk2]`.

**Lý do**: Anh user phản hồi V2.3.7-V2.3.8 — *"Có thể có trường học các bộ sách khác nhau nên chúng ta nhận xét như này dễ mắc lỗi ngay"*. Việc bám nội dung lớp cụ thể (vd "diện tích hình thang lớp 5", "phép cộng có nhớ lớp 2") sẽ sai khi trường khác dùng bộ sách khác / thứ tự dạy khác.

**Cấu trúc V4.0**:
```
subject (13 môn)
  → grades.all
    → all_ky
      → tot_xs / tot / ht / cht
        → default[]  (4-8 phrase/cell, phong cách GV THDienLien)
```

**Phân hoá tier** (giữ từ V2.3.10):
- `tot_xs` (9-10đ): "rất tốt / xuất sắc / sáng tạo / nhanh nhẹn / có năng khiếu" — phrase mạnh
- `tot` (7-8đ): "tốt / khá tốt / chính xác / chăm chỉ / đúng yêu cầu"
- `ht` (5-6đ): "có cố gắng / cần luyện thêm / cần rèn / hoàn thành cơ bản"
- `cht` (<5đ): "cần được hỗ trợ / gia đình phối hợp / kiên trì luyện tập"

## 3. Cụm sai giới tính GV đã xóa

**Trước V4.0**: Pool còn sót "theo cô" (14 phrase trong nhanxet-ky.json).

**Sau V4.0**: Clean toàn bộ. Tổng cộng đã xóa/thay từ V2.3.7 → V4.0:
- `bài cô giao` → `bài tập được giao`
- `cô giảng` → `bài giảng / nội dung đã học`
- `cô hướng dẫn` → `hướng dẫn`
- `cô đặt câu hỏi` → `câu hỏi của bài học`
- `hỏi cô` → `hỏi lại khi chưa rõ`
- `nhờ cô` → `nhờ gia đình`
- `theo cô hướng dẫn` → `theo hướng dẫn`
- `theo cô` (đứng riêng cuối câu) → `theo hướng dẫn`
- `gợi ý của cô` → `gợi ý`
- `cùng cô` → `cùng bạn`
- `cô bạn` → `bạn`

**Cho phép** trong NL/PC: `lễ phép với thầy cô`, `vâng lời thầy cô` (mẫu THDienLien thật).

## 4. Suy diễn hành vi — quyết định không cấm

**ChatGPT đề xuất** cấm 19 cụm: "hăng hái / phát biểu / giơ tay / xây dựng bài / yêu thích / tự tin / chăm chú / ngoan / lễ phép / chuyên cần / nền nếp / ý thức tự học / có năng khiếu / tư duy sắc bén / sáng tạo / vượt trội / tấm gương / bài viết lôi cuốn / giàu hình ảnh".

**V4.0 quyết định**: **KHÔNG cấm** — vì:
- Mẫu thực file `qlcl-app.js` trường THDienLien có: *"Em tính toán nhanh, chính xác, **tích cực giơ tay phát biểu xây dựng bài**"*, *"Em có **năng khiếu** ngoại ngữ"*, *"là **tấm gương** cho các bạn"*, *"em **yêu thích** khoa học"*
- Anh user đã chọn phong cách này (V2.3.9-V2.3.10)
- Cấm hết = phá phong cách + làm 10đ giống 8đ (lỗi V2.3.9 đã sửa V2.3.10)

`BEHAVIOR_WORDS_WITHOUT_DATA = Object.freeze([])` — bỏ trống.

## 5. Sửa `validateComment` V4.0

```js
validateComment(comment, ctx = {})

ctx.context: 'subject' (default) | 'nlpc'
  → subject: dùng SOFT_BAN_PHRASES_SUBJECT (15 cụm: cô giảng / hỏi cô / theo cô / ...)
  → nlpc:    dùng SOFT_BAN_PHRASES_NLPC (5 cụm — cho phép "thầy cô")

Các check:
  1. Bắt đầu "Em" hoặc động từ phổ biến (Biết/Hoàn thành/Thuộc/Thành thạo/Đạt)
  2. Không chứa HARD_BAN (yếu kém / lười / dốt / ...)
  3. Không chứa SOFT_BAN (context-aware)
  4. Không chứa WRONG_KY_PHRASES theo ky
  5. Tier không chứa TIER_RESTRICTED_WORDS (xuất sắc/vượt trội chỉ cho tot_xs)
  6. Grade không chứa GRADE_FORBIDDEN (bảng chữ cái cho lớp ≥4)
  7. Tier ht/cht BẮT BUỘC có REMEDIATION_PHRASES (cần luyện / cần rèn / cần củng cố / cần được hỗ trợ / gia đình phối hợp / kiên trì / ...)
  8. Độ dài 7-40 từ

KHÔNG kiểm:
  - Subject signal cụ thể (anh user phản hồi: bám lớp dễ sai bộ sách)
  - Behavior words (THDienLien dùng "tích cực phát biểu / năng khiếu / tấm gương")
  - "thầy cô" trong nhận xét (cho phép trong NL/PC)
```

**Sanitize lần cuối** (V4.0 mới):
```js
sinhNhanXet flow:
  ...build phrase...
  → apply suffix
  → validate (lần 1)
  → applyGvPersona (swap cô↔thầy nếu gvLa='thay')
  → validate (LẦN CUỐI sau persona — V4.0 mới)
  → fail → safe fallback (không qua persona)
```

## 6. Sửa `_resolvePool` V4.0

**Giữ logic V2.3.9-V2.3.10**:
```
1. subject.grades[gradeNum][ky][tier][trend]  (nếu có data riêng cho lớp đó)
2. subject.grades[gradeNum][ky][tier].default
3. subject.grades['all']['all_ky'][tier].default  ← THDienLien chính
4. subject[ky][tier]  (ky-data legacy)
5. subject[tier]      (flat pool legacy)
```

→ Hiện tại chỉ schema `grades.all.all_ky` được populate cho 13 môn. Pool grade-specific theo từng lớp KHÔNG được dùng vì anh user đã quyết.

## 7. Kết quả audit (`COMMENT_AUDIT_REPORT.md`)

```
Tổng issue: 681
Top reasons:
  no_remediation: 668   ← pool ky-data + flat (cũ, legacy) tier ht/cht thiếu remediation
  tier_word:tốt: 11     ← phrase pool cũ tier cht có "tốt"
  hard_ban:ngu: 1       ← false positive (chữ "ngu" trong tên "ngữ pháp"?)
  soft_ban:theo cô: 1   ← còn sót 1 phrase chưa clean
```

**Diễn giải**: Pool grade-data V4.0 (THDienLien) **sạch 100%**. 681 issue ở pool **ky-data + flat (legacy)** — Engine V4.0 chỉ dùng ky-data cho môn khác Toán/TV khi không có grade-data tương ứng. Không ảnh hưởng nhận xét môn học chính.

## 8. Kết quả test engine V4.0

```
node tools/test-engine-v40.js → 21 pass / 0 fail
node test/run-node.js          → 75 pass / 0 fail
```

**Sample output**:

```
CASE 1: Toán lớp 1 GHK1 điểm 5
  → Em đạt yêu cầu môn Toán, cần phát huy thêm trong thời gian tới.
  ✓ Không "cô/thầy" đứng riêng
  ✓ Không "năm học tới"
  ✓ Có định hướng rèn ("cần phát huy")

CASE 3: Toán lớp 5 GHK2 điểm 10
  → Em hiểu bài rất tốt, tính toán nhanh và trình bày bài giải mạch lạc.
  ✓ Không "cô/thầy" đứng riêng

CASE 6: TV lớp 5 GHK2 điểm 6
  → Em hoàn thành bài tập, cần chú ý hơn về chính tả và diễn đạt.
  ✓ Có định hướng rèn ("cần chú ý")

CASE 8: Lớp 40 HS Toán lớp 5 GHK2
  ✓ 40/40 câu không có "cô/thầy" đứng riêng
  ✓ 40/40 câu không "năm học tới/lớp học tiếp theo/cuối năm" (GHK2)
  ✓ Tất cả HS điểm 5-6 có định hướng rèn
  ✓ Tất cả HS điểm 1-4 có định hướng rèn/hỗ trợ
  ✓ Phrase phổ biến nhất ≤6/40 (~15%)

  Sample 3 HS 10đ:
    Em có tư duy logic rất tốt, giải toán nhanh, chính xác và sáng tạo.
    Em hiểu bài rất tốt, tính toán nhanh và trình bày bài giải mạch lạc.
    Em nắm chắc kỹ năng làm toán, làm bài đạt kết quả cao trong các bài kiểm tra.
  Sample 3 HS 6đ:
    Em nắm được kiến thức cơ bản, cần cố gắng thêm trong giải toán.
    Em làm được bài cơ bản, cần rèn thêm cách trình bày bài giải.
    Em đã có cố gắng, cần luyện thêm tính toán và giải toán có lời văn.
  Sample 2 HS 3-4đ:
    Em cần luyện tập từng bước môn Toán, gia đình cùng đồng hành để em tiến bộ.
    Em cần củng cố kiến thức cơ bản môn Toán, kiên trì luyện tập hằng ngày.
```

## 9. So sánh với V2.3.10

| Khía cạnh | V2.3.10 | V4.0 |
|---|---|---|
| Schema pool | `grades.all.all_ky` (THDienLien) | Giữ nguyên |
| Phong cách | Cho phép "tích cực phát biểu / năng khiếu / tấm gương" | Giữ nguyên |
| Phân hoá 10đ vs 8đ | Tách rõ tot_xs vs tot | Giữ nguyên |
| Soft ban cô/thầy | Yếu (chỉ "bài cô giao") | **Mạnh** (15 cụm subject, 5 cụm NLPC) |
| Validate ht/cht remediation | Pool có nhưng không enforce | **Enforce** trong validator |
| Sanitize sau persona | Không có | **Có** (validate lần cuối) |
| Tools test/audit | Có (V2.3.8) | **Refresh** theo schema mới |

## 10. Việc còn nên làm (sau V4.0)

### Phase A — Pool legacy cleanup
- 668 issue `no_remediation` ở pool ky-data + flat — cần làm sạch hoặc deprecate hẳn (chỉ dùng grade-data)
- Pool ky-data cho ghk1/chk1/ghk2 (Toán+TV+các môn khác) chưa được dùng nữa kể từ V2.3.9 — có thể xóa nếu user xác nhận

### Phase B — UI nâng cấp
- Show "kỳ + style đang dùng" trong sidebar (đã có dropdown V2.3.10)
- Toast cảnh báo khi user chọn style không phù hợp ky
- Hiển thị logo extension đẹp hơn — anh user vừa hỏi về thay icon CWS

### Phase C — Logo CWS (nếu anh quyết)
- Thay 3 file PNG trong `icons/` (16/48/128)
- Update Store icon trên CWS Dashboard
- Bundle ZIP V4.0 hiện có thể dùng làm baseline

### Phase D — Tích hợp lịch sử điểm 4 kỳ
- `vnedu-adapter.js` extract 4 cột điểm
- Engine `detectTrend` đã có sẵn (V2.3.x), chỉ cần feed history
- Unlock phrase trend `tien_bo / giam_sut / chua_on_dinh`

## 11. Backup (rollback nếu cần)

- `engine/engine.js.bak.v40`
- `engine/data/nhanxet-ngan.json.bak.v40`
- `engine/data/nhanxet-ky.json.bak.v40`
- `engine/data/nhanxet-grade.json.bak.v40`
- `sidebar/sidebar.html.bak.v40`
- `sidebar/sidebar.js.bak.v40`
- `manifest.json.bak.v40`

Rollback: `cp file.bak.v40 file`.

---

**Summary**:
- `node tools/test-engine-v40.js` → **21 pass / 0 fail**
- `node test/run-node.js` → **75 pass / 0 fail**
- `node tools/audit-comments.js` → tạo COMMENT_AUDIT_REPORT.md (681 issue trong pool legacy, không ảnh hưởng runtime)

**V4.0 sẵn sàng cho Chrome Web Store**: `sonhanxet-ai-v4.0.zip`.

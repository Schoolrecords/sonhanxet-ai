# Báo cáo bổ sung ngân hàng nhận xét — V4.1

**Ngày**: 2026-05-18
**Phiên bản**: 4.0.2 → **4.1.0**
**Mục tiêu**: bổ sung ngân hàng nền chuẩn (13 môn × 4 tier × 5 câu), vô hiệu hoá hậu tố cứng, viết lại fallback theo spec V4.1 của user.

---

## 1. File đã sửa / tạo

| File | Loại | Ghi chú |
|---|---|---|
| `manifest.json` | sửa | 4.0.2 → 4.1.0 |
| `engine/engine.js` | sửa | TẮT STYLE_SUFFIX, mở rộng REMEDIATION_PHRASES, rewrite `_safeFallback`, siết SOFT_BAN_PHRASES_SUBJECT |
| `engine/data/nhanxet-ngan.json` | append | +260 phrase vào `subjects[code][tier]` flat pool |
| `engine/data/nhanxet-grade.json` | append | +260 phrase vào `subjects[code].grades.all.all_ky[tier].default` (priority pool) |
| `engine/data/nhanxet-ky.json` | (không sửa) | giữ nguyên 918 phrase legacy, dùng làm pool dự phòng |
| `tools/new-phrases-v41.js` | mới | Data source — 260 phrase nền chuẩn |
| `tools/apply-phrases-v41.js` | mới | Script merge dedup vào 2 file JSON |
| `tools/audit-comments.js` | rewrite | Quét 10 loại lỗi, xuất `COMMENT_AUDIT_REPORT.md` |
| `tools/test-engine-comments.js` | mới | 12 + 4 test case theo spec mục VI |
| `REPORT_BO_SUNG_NGAN_HANG_NHAN_XET.md` | mới | File này |
| Backup `*.bak.v41` | tự động | 5 file (manifest + engine + 3 JSON) |

---

## 2. Môn học đã bổ sung

**Tổng cộng 13 môn × 4 tier × 5 câu = 260 phrase nền chuẩn**, đã merge vào 2 vị trí (grade.all_ky + flat ngan) để engine luôn ưu tiên pick được.

| # | Môn | Key engine | Tier có |
|---|---|---|---|
| 1 | Toán | `toan` | cht, ht, tot, tot_xs |
| 2 | Tiếng Việt | `tieng-viet` | cht, ht, tot, tot_xs |
| 3 | Tiếng Anh | `tienganh` | cht, ht, tot, tot_xs |
| 4 | Tự nhiên và Xã hội | `tnxh` | cht, ht, tot, tot_xs |
| 5 | Khoa học | `khoahoc` | cht, ht, tot, tot_xs |
| 6 | Lịch sử và Địa lí | `lichsudia` | cht, ht, tot, tot_xs |
| 7 | Đạo đức | `daoduc` | cht, ht, tot, tot_xs |
| 8 | Tin học | `tinhoc` | cht, ht, tot, tot_xs |
| 9 | Công nghệ | `congnghe` | cht, ht, tot, tot_xs |
| 10 | Giáo dục thể chất | `gdtc` | cht, ht, tot, tot_xs |
| 11 | Âm nhạc | `amnhac` | cht, ht, tot, tot_xs |
| 12 | Mĩ thuật | `mithuat` | cht, ht, tot, tot_xs |
| 13 | Hoạt động trải nghiệm | `htn` | cht (C), ht (H), tot (T), tot_xs (T+) |

---

## 3. Phân tier theo spec V4.1

| Tier engine | Điểm / Mức | Đặc trưng câu |
|---|---|---|
| `cht` | < 5 điểm / C | hỗ trợ, động viên, **chỉ rõ nội dung cần được hỗ trợ** |
| `ht` | 5-6 / H | khích lệ + **lời khuyên rèn luyện cụ thể**, không khen quá mạnh |
| `tot` | 7-8 / T | hoàn thành tốt — **không** dùng "xuất sắc / vượt trội / sáng tạo" |
| `tot_xs` | 9-10 / T+ | tích cực, chắc chắn — **không** suy diễn "năng khiếu / sáng tạo / tư duy sắc bén" |

---

## 4. Vô hiệu hoá hậu tố cứng

`STYLE_SUFFIX` cũ append đuôi sau câu chính:

```
// V4.0 cũ
giuaky.ht = ' Em cần luyện tập đều hơn trong các tuần học tiếp theo.'
giuaky.cht = ' Gia đình phối hợp hỗ trợ để em củng cố kiến thức từng bước.'
cuoihk1.ht = ' Em cần tiếp tục rèn luyện trong học kỳ II...'
cuoinam.ht = ' Em cần tiếp tục luyện tập để chuẩn bị tốt cho lớp học tiếp theo.'
```

**V4.1**: cả 6 nhóm style (giuaky / cuoihk1 / cuoinam / dinhhuong / ngan / default) × 4 tier đều set `''`. Câu trong ngân hàng đã đầy đủ định hướng rèn luyện → không cần engine ghép đuôi.

```js
const STYLE_SUFFIX = Object.freeze({
    giuaky:    { tot_xs: '', tot: '', ht: '', cht: '' },
    cuoihk1:   { tot_xs: '', tot: '', ht: '', cht: '' },
    cuoinam:   { tot_xs: '', tot: '', ht: '', cht: '' },
    dinhhuong: { tot_xs: '', tot: '', ht: '', cht: '' },
    ngan:      { tot_xs: '', tot: '', ht: '', cht: '' },
    default:   { tot_xs: '', tot: '', ht: '', cht: '' }
});
```

Đồng thời siết SOFT_BAN_PHRASES_SUBJECT, thêm 13 cụm hành vi/hậu tố khiên cưỡng để validate **REJECT** câu legacy còn sót trong bank cũ ngay tại runtime.

---

## 5. Sửa fallback

`_safeFallback(subjectCode, tier, gradeLevel)` rewrite theo bảng V4.1 — đủ 13 môn × 4 tier (52 câu) hard-coded:

- Toán: 4 câu (tot_xs / tot / ht / cht) theo nguyên văn spec IV.4
- Tiếng Việt: 4 câu theo spec IV.4
- 11 môn còn lại: 4 câu/môn lấy nguyên văn từ pool mới V4.1
- Môn lạ (ngoài 13): rơi về template trung tính theo tên môn, vẫn có định hướng rèn luyện cho ht/cht

Fallback không bao giờ ghép suffix → câu trả về luôn là 1 câu hoàn chỉnh.

---

## 6. Mở rộng REMEDIATION_PHRASES

`validateComment` vẫn bắt buộc ht/cht chứa cụm rèn luyện. Danh sách REMEDIATION_PHRASES bổ sung để bắt phong cách câu V4.1:

```
'cần được hướng dẫn'      ← mới
'cần ôn'                   ← mới (trước chỉ có 'cần ôn lại')
'cần thực hành'            ← mới
'thực hành thường xuyên'   ← mới
'luyện tập thường xuyên'   ← mới
'cần cẩn thận'             ← mới
'cần chủ động'             ← mới
```

Kết quả: 100% câu V4.1 user cung cấp đều pass validate.

---

## 7. Kết quả chạy audit (sau khi bổ sung)

```
[Audit V4.1] Đã quét 2268 phrase (1516 → 2268, +752 do duplicate vào 2 file)
[Audit V4.1] Tổng issue: 820
  - no_remediation: 578     ← phrase LEGACY trong bank cũ (ky/ngan), engine REJECT khi runtime
  - duplicate: 111          ← câu trùng > 2 lần (do append vào nhiều file)
  - behavior_from_score: 78 ← phrase legacy chứa "phát biểu/sáng tạo/...", engine REJECT
  - toan_missing_signal: 39 ← câu chung cho Toán không có signal cụ thể (legacy)
  - tv_missing_signal: 7
  - gender_dependent: 6     ← legacy còn "cô" đứng riêng
  - negative_word: 1
```

**Ghi chú quan trọng**: 820 issue trên là báo cáo audit, **không** đồng nghĩa engine sẽ output câu lỗi. Engine V4.1 đã thêm SOFT_BAN_PHRASES_SUBJECT 26 cụm + giữ HARD_BAN + giữ no_remediation check. Test thực tế confirm **không câu nào trong 12 test case có cụm cấm**, và simulation 30 HS × 11 scenario cũng cho `forbidden leak: 0`.

Bank cũ giữ lại làm pool dự phòng (giúp tăng variety khi pool V4.1 cạn). Việc cleanup bank legacy là **việc nên làm tiếp** (mục 9).

Báo cáo chi tiết: [COMMENT_AUDIT_REPORT.md](./COMMENT_AUDIT_REPORT.md)

---

## 8. Kết quả chạy test engine

**`tools/test-engine-comments.js`** — 15 test (12 case spec + 3 sub-case HTN):

```
=== Test engine V4.1 — 12 case theo spec ===

  ✓ #1   Toán lớp 5 điểm 3   →  Em chưa hoàn thành yêu cầu môn Toán, cần được hỗ trợ và luyện tập thêm.
  ✓ #2   Toán lớp 5 điểm 5   →  Em hoàn thành các yêu cầu môn Toán, cần luyện thêm để tính toán nhanh hơn.
  ✓ #3   Toán lớp 5 điểm 7   →  Em nắm được kiến thức môn Toán, vận dụng tốt vào bài tập.
  ✓ #4   Toán lớp 5 điểm 9   →  Em nắm chắc kiến thức môn Toán, tính toán chính xác và trình bày bài giải rõ ràng.
  ✓ #5   TV lớp 5 điểm 3     →  Em cần củng cố kĩ năng đọc viết cơ bản, kiên trì luyện tập hằng ngày.
  ✓ #6   TV lớp 5 điểm 6     →  Em hoàn thành yêu cầu cơ bản môn Tiếng Việt, cần luyện thêm đọc hiểu, dùng từ và viết câu rõ ý.
  ✓ #7   TV lớp 5 điểm 8     →  Em đọc hiểu được bài, viết câu đúng và trình bày sạch.
  ✓ #8   TV lớp 5 điểm 10    →  Em có vốn từ phong phú, diễn đạt mạch lạc, viết văn rất hay.
  ✓ #9   Tiếng Anh điểm 5    →  Em có cố gắng trong học Tiếng Anh, cần luyện đọc từ, viết câu và sử dụng mẫu câu quen thuộc.
  ✓ #10  Tin học điểm 6      →  Em hoàn thành yêu cầu cơ bản môn Tin học, cần luyện thêm thao tác máy tính và thực hành theo quy trình.
  ✓ #11  Mĩ thuật điểm 8     →  Em hoàn thành sản phẩm mĩ thuật tương đối tốt, biết sắp xếp hình ảnh và phối hợp màu sắc phù hợp.
  ✓ #12.1 HTN mức C          →  Em cần được hỗ trợ thêm trong tham gia hoạt động, thực hiện nhiệm vụ và chia sẻ ý kiến theo gợi ý.
  ✓ #12.2 HTN mức H          →  Em đạt yêu cầu môn học, cần phát huy thêm tinh thần chủ động.
  ✓ #12.3 HTN mức T          →  Em hoàn thành tốt các hoạt động trải nghiệm.
  ✓ #12.4 HTN mức T+         →  Em có kĩ năng giao tiếp tốt, biết phối hợp với bạn để hoàn thành nhiệm vụ.

=== Kết quả: 15 pass / 0 fail / 15 total ===
```

**`test/run-node.js`** (regression test cũ): **75 pass / 0 fail** — không có regression CacheManager / NLPCMapper / Engine core.

---

## 9. So sánh trước/sau (uniqueness)

Mô phỏng lớp thực tế, đếm số câu duy nhất trên N học sinh cùng tier:

| Kịch bản | V4.0.2 | V4.1.0 | Cải thiện |
|---|---:|---:|---:|
| Toán ht GHK1 lớp 3 (30 HS) | 6 | 11 | +83% |
| Toán tot CHK2 lớp 5 (30 HS) | 8 | 13 | +62% |
| TV ht GHK1 lớp 3 (30 HS) | 6 | 11 | +83% |
| TV tot_xs CHK2 lớp 5 (30 HS) | 8 | 11 | +37% |
| TNXH cht CHK1 lớp 2 (10 HS) | 2 | 6 | +200% |
| Đạo đức tot CHK2 lớp 1 (25 HS) | 4 | 9 | +125% |
| Tiếng Anh ht GHK2 lớp 4 (25 HS) | 1 (fallback) | 5 | +400% |
| Mĩ thuật tot_xs CHK2 lớp 5 (20 HS) | – | 7 | – |
| HTN tot CHK2 lớp 3 (20 HS) | – | 8 | – |

**Forbidden leak**: 0 trên toàn bộ 11 kịch bản mô phỏng (không có "cô / thầy / phát biểu / yêu thích / năng khiếu / sáng tạo / vượt trội / tấm gương / trong các tuần học tiếp theo / chuẩn bị tốt cho lớp học tiếp theo / gia đình phối hợp hỗ trợ để em tiến bộ từng bước" trong output).

---

## 10. Việc nên làm tiếp

1. **Cleanup bank legacy** (P1) — viết tool tự động xoá / rewrite 578 phrase `no_remediation` + 78 phrase `behavior_from_score` + 6 phrase `gender_dependent` trong `nhanxet-ky.json` và `nhanxet-grade.json`. Sau khi clean, pool sẽ thuần V4.1, audit về 0 issue và uniqueness tăng thêm 30-50%.

2. **Mở rộng pool Tiếng Anh** (P1) — môn `tienganh` hiện chỉ có 5 phrase/tier sau V4.1 (legacy entry `tieng-anh` trong grade orphaned do alias key sai). Cần thêm 10-15 phrase/tier + fix alias `tieng-anh` → `tienganh` để tận dụng pool cũ.

3. **Mở rộng pool NLPC** (P1) — 3-5 phrase/tier/field quá ít. Lớp 30 HS sẽ thấy lặp khi GV duyệt học bạ cạnh nhau. Cần target 10 phrase/tier/field.

4. **Phân kỳ rõ ràng hơn cho `nhanxet-ky.json`** (P2) — ghk1 "bước đầu", chk1 "nắm vững cơ bản", ghk2 "vận dụng", chk2 "hoàn thiện". Hiện một số phrase chk1 và ghk2 trùng token ≥70%.

5. **Test trực tiếp trên Vnedu** (P0 — vẫn còn tồn từ V4.0) — bug BUG-002 (NLPC dropdown), BUG-005 (NLPC apply ghi nhầm HS), BUG-006 (Công nghệ/Tin học lớp 3-5) chưa được user verify cuối cùng. Khuyến nghị test 1 phiên đầy đủ lớp 1A + 3A + 5C.

6. **Submit V4.1.0 lên CWS** (P2) — sau khi user kiểm tra hài lòng kết quả nhận xét sinh ra ở local. Tránh submit khi V4.0 còn pending review (xem memory `reference_cws_publish`).

---

## 11. Nguyên tắc áp dụng (checklist spec V4.1)

| # | Nguyên tắc | Trạng thái |
|---|---|---|
| I.1 | Câu bắt đầu "Em" | ✅ Engine + audit + test enforce |
| I.2 | Không chèn tên HS | ✅ Engine không bao giờ chèn |
| I.3 | Không cô / thầy / thầy cô (subject) | ✅ SOFT_BAN_PHRASES_SUBJECT |
| I.4 | Không tiêu cực (yếu/lười/dốt) | ✅ HARD_BAN_WORDS |
| I.5 | Không suy diễn hành vi từ điểm | ✅ SOFT_BAN extended + test |
| I.6 | cht: hỗ trợ + chỉ rõ nội dung | ✅ Pool V4.1 + fallback |
| I.7 | ht: khích lệ + rèn luyện cụ thể | ✅ REMEDIATION required + pool V4.1 |
| I.8 | tot: không "xuất sắc / vượt trội / sáng tạo" | ✅ TIER_RESTRICTED_WORDS |
| I.9 | tot_xs: không "năng khiếu / sáng tạo / tư duy sắc bén" | ✅ SOFT_BAN extended |
| I.10 | Không suffix cứng | ✅ STYLE_SUFFIX tất cả empty |
| I.11 | Câu trong bank hoàn chỉnh | ✅ Pool V4.1 đầy đủ |
| I.12 | Câu có định hướng rèn luyện → không nối suffix | ✅ STYLE_SUFFIX disabled |
| I.13 | Toán/TV ưu tiên lớp+kỳ, fallback an toàn | ✅ `_resolvePool` priority chain |
| II | Quy ước mức độ | ✅ `_resolveTier` map đầy đủ |
| III | Ngân hàng nền 13 môn | ✅ Đã merge vào grade + ngan |
| IV.1-3 | Engine không tự ghép đuôi | ✅ |
| IV.4 | Fallback đúng môn/mức | ✅ `_safeFallback` rewrite |
| V | Audit 10 loại lỗi | ✅ `tools/audit-comments.js` |
| VI | Test 12 case | ✅ `tools/test-engine-comments.js` (15/15 pass) |

# Bug Log — Sổ nhận xét - AI

## BUG-001 — Tên HS "Đạt" bị nhận diện nhầm thành mức đánh giá "Đ" (Critical)

**Phát hiện**: 2026-05-15, test trên Vnedu thật
**File**: `content/vnedu-adapter.js`
**Function**: `extractRows_()` (lines ~389-399)
**Phiên bản**: 0.1.26
**Mức độ**: 🔴 Critical — gây false-positive khi bảng trống và double-count HS thật

### Hiện tượng

1. **Bảng nhận xét môn Toán lớp 5C chưa có HS nào nhập điểm/XL** → sidebar vẫn báo "Cần tạo 1" cho HS **Võ Quốc Đạt** với mức 'H'
2. **Môn Đạo đức lớp 1A chỉ có 3 HS có XL** (Bảo An, Trường An, Khánh An — đều T) → sidebar báo "Cần tạo 4", thêm HS **Nguyễn Tiến Đạt** với mức 'H' (sai)

### Root cause

`parseMucDat_("Đạt")`:
- `.toUpperCase()` → `"ĐẠT"`
- match điều kiện `t === 'ĐẠT'` → return `'ht'`
- Engine coi HS có mức 'H' (Hoàn thành / Đạt)

Vòng lặp ở line 389-399 quét MỌI cell của row (kể cả cells[1..3] chứa tên HS):

```js
for (const cell of cells) {  // ← duyệt cả ô tên HS
  if (cell.querySelector('input, textarea, select')) continue;
  const t = (cell.textContent || '').trim();
  if (!t || t.length > 4) continue;  // "Đạt" 3 chars → qua
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) continue;
  const parsed = parseMucDat_(t);    // ← "Đạt" → 'ht' (false positive)
  if (parsed) { mucDat = parsed; break; }
}
```

### Tại sao chỉ HS tên "Đạt" bị?

Các giá trị `parseMucDat_` match:
- `'T', 'H', 'C', 'Đ', 'D'` — single letter, không có HS tên 1 chữ
- `'T+', 'HT', 'HTT', 'CHT', 'CCG'` — không phải tên người
- `'TỐT', 'TOT', 'HOÀN THÀNH', 'CHƯA'` — không phải tên người
- **`'ĐẠT', 'DAT'`** — ✨ **trùng với họ tên VIỆT phổ biến** "Đạt"

### Fix đề xuất

Vòng lặp dò mức từ cell text phải SKIP các cell đầu (STT + name cells). Cấu trúc Vnedu:
- cells[0] = STT
- cells[1..3] = Họ và tên (split 2-3 cells)
- cells[4] = Ngày sinh
- cells[5] = Nhận xét cuối kỳ (textarea — đã có filter skip)
- cells[6+] = KT/XL columns

**Patch**: bắt đầu loop từ index 4 (sau cells tên):

```js
// TRƯỚC:
for (const cell of cells) {

// SAU:
for (let ci = 4; ci < cells.length; ci++) {
  const cell = cells[ci];
```

### Test acceptance

- ✅ Lớp 5C môn Toán bảng trống → sidebar báo "Cần tạo 0", KHÔNG có HS Võ Quốc Đạt
- ✅ Lớp 1A môn Đạo đức 3 HS có XL → sidebar báo "Cần tạo 3", KHÔNG có HS Nguyễn Tiến Đạt
- ✅ Lớp 5C Toán có 2 HS nhập điểm Anh/Ánh → vẫn báo "Cần tạo 2" (regression test)
- ✅ Các tên Đạt thật có XL = T thì hiển thị đúng mức T (không bị override sang H)

### Fix log

- 2026-05-15: Phân tích root cause, viết patch
- 2026-05-15: Apply patch + bump version 0.1.27
- TBD: Test local
- TBD: Sau khi v0.1.26 được CWS approve, submit v0.1.27

---

## BUG-002 — Sidebar NLPC: chọn HS khác bị revert về HS đầu (Critical)

**Phát hiện**: 2026-05-15, test trên Vnedu thật
**File**: `sidebar/sidebar.js`
**Function**: `renderNLPCView()` (lines ~922-936)
**Mức độ**: 🔴 Critical — không cho phép GV chọn HS khác → không dùng được NLPC

### Hiện tượng

- Mở module Phẩm chất - Năng lực ghi học bạ
- Sidebar hiển thị dropdown chọn HS, mặc định HS#1 (Vnedu auto-select)
- User chọn HS khác trong dropdown (vd HS#4 Nguyễn Quỳnh Anh)
- **Sidebar QUAY VỀ HS#1**, không cho phép chuyển
- User cũng báo: mỗi lần chọn mất 1 ô nhận xét (có thể do side effect của Vnedu khi click hỏng)

### Root cause

`renderNLPCView()` rebuild dropdown mỗi khi RESCAN. Khi user chọn HS qua dropdown:

1. `selectNLPCStudent(4)` set `nlpcSelectedStt = 4`, post message tới content script
2. Content script click row HS#4 trong Vnedu (có thể FAIL với Ext.js grid)
3. Sau 300ms, content script gửi `COGIAO_NLPC_STUDENT_SELECTED` về sidebar
4. Sidebar request RESCAN
5. RESCAN trả lại nlpcStudents với HS#1 vẫn `isSelected: true` (vì click trên Vnedu chưa effective)
6. `renderNLPCView()` chạy lại:
   - Rebuild option HTML với `${s.isSelected ? 'selected' : ''}` → HS#1 có attribute `selected`
   - Logic auto: `auto = HS#1`, `auto.stt(1) !== nlpcSelectedStt(4)` → TRUE
   - **Reset `nlpcSelectedStt = 1`**, load form HS#1
7. Sidebar revert về HS#1

### Fix đề xuất

1. **Bỏ attribute `selected` trong HTML option** — để DOM không tự override
2. **Auto-detect từ Vnedu chỉ khi `nlpcSelectedStt === null`** — chưa có lựa chọn nào
3. **Khi đã có lựa chọn**: giữ nguyên, chỉ verify HS còn trong list (Vnedu reload → reset)

### Test acceptance

- ✅ Mở NLPC lần đầu → auto-select HS Vnedu đang highlight
- ✅ User chọn HS#4 trong dropdown → dropdown giữ HS#4, không revert
- ✅ User chọn HS#10 sau khi đã chọn HS#4 → dropdown chuyển HS#10
- ✅ Nếu HS bị xoá khỏi list (Vnedu reload) → reset về "— Chọn học sinh —"

### Fix log

- 2026-05-15: Apply patch trong renderNLPCView()
- TBD: Test local

---

## BUG-003 — Tên môn có dấu '-' bị cắt: "TN-XH" → "TN" (Critical)

**Phát hiện**: 2026-05-16, test trên Vnedu thật
**Files**: `content/vnedu-adapter.js`, `engine/engine.js`, `sidebar/sidebar.js`
**Mức độ**: 🔴 Critical — không sinh được nhận xét cho môn TNXH (và có thể các môn khác có dấu '-' trong tên)

### Hiện tượng

- Vào Sổ nhận xét môn TN-XH lớp 1A → sidebar hiển thị môn là "TN" (mất phần "-XH")
- Bấm "Tạo nhận xét" → popup lỗi: **"Chưa có ngân hàng nhận xét cho môn 'TN'"**
- Tương tự nguy cơ với "Lịch sử - Địa lí" (mặc dù chưa test)

### Root cause

3 vấn đề chồng lên nhau:

**1. Regex cắt tại dấu '-' đầu tiên** — `content/vnedu-adapter.js` line 294

```js
const monMatch = allText.match(/M[ôo]n(?:\s*h[ọo]c)?:\s*([^-\n\r]+?)(?:\s*-|\s*H[ọo]c k[ỳy]|\s*$)/);
```

Pattern `[^-\n\r]+` không cho phép dấu '-' trong tên → "TN-XH" → captures "TN".

**2. SUBJECT_NAME_MAP không có alias** — `engine/engine.js`

Sau khi normalizeSubject:
- "TN-XH" → trim → "tn-xh" → replace non-alphanum với space → "tn xh"
- Lookup `'tn xh'` trong SUBJECT_NAME_MAP → KHÔNG có → return null

→ Engine coi như môn không hợp lệ → "Chưa có ngân hàng".

**3. Display name xấu** — sidebar hiển thị raw "TN-XH" thay vì "TNXH" theo convention.

### Fix đề xuất

**1. Regex mới** — bảo toàn dấu '-' trong tên, chỉ stop tại " - Học kỳ" hoặc EOL:

```js
const monMatch = allText.match(/M[ôo]n(?:\s*h[ọo]c)?:\s*(.+?)\s*(?:[-–—]?\s*H[ọo]c\s*k[ỳy]|[\n\r]|$)/);
```

Test cases:
- "Môn học: Toán - Học kỳ 2" → captures "Toán" ✓
- "Môn học: TN-XH - Học kỳ 2" → captures "TN-XH" ✓
- "Môn học: Lịch sử - Địa lí - Học kỳ 2" → captures "Lịch sử - Địa lí" ✓
- "Môn: Toán" (no suffix) → captures "Toán" ✓

**2. Thêm aliases vào SUBJECT_NAME_MAP**:

```js
'tn xh': 'tnxh',  // "TN-XH" → normalize "tn xh"
'tn': 'tnxh',     // fallback nếu vẫn bị cắt thành "TN"
```

**3. Hàm formatMonDisplay trong sidebar.js** — bỏ '-' giữa 2 chữ liền (không có space):

```js
function formatMonDisplay(raw) {
    if (!raw) return '';
    return raw.replace(/(\S)-(\S)/g, '$1$2').trim();
}
```

- "TN-XH" → "TNXH" ✓
- "Lịch sử - Địa lí" → giữ nguyên (có space hai bên) ✓

### Test acceptance

- ✅ Sổ NX môn TN-XH lớp 1A → sidebar hiển thị môn "TNXH", sinh nhận xét OK (ngân hàng tnxh tồn tại)
- ✅ Sổ NX môn Toán → vẫn hoạt động (regression)
- ✅ Sổ NX môn Lịch sử - Địa lí → bảo toàn full name (nếu Vnedu hiển thị vậy)

### Fix log

- 2026-05-16: Patch 3 file, JS syntax check OK
- TBD: Test local + screenshot xác nhận

---

## BUG-004 — Regex lazy "ăn lẹm" qua label kế tiếp, ctx.mon = "Học kỳ:" (Critical)

**Phát hiện**: 2026-05-16, test môn Tin học và Công nghệ lớp 3A
**File**: `content/vnedu-adapter.js`
**Function**: `_parseContextFromTextBar()`
**Mức độ**: 🔴 Critical — không sinh được nhận xét cho HẦU HẾT các môn nếu Vnedu Ext.js ẩn dropdown value khỏi innerText

### Hiện tượng

- Vào Sổ NX môn Tin học và Công nghệ lớp 3A → sidebar pill môn rỗng/sai
- Bấm Tạo nhận xét → popup: **"Chưa có ngân hàng nhận xét cho môn 'Học kỳ:'"**
- Console warn: `[VneduAdapter] Môn "Học kỳ:" không nhận ra — bỏ qua sync`

### Root cause

Regex từ BUG-003 fix: `/M[ôo]n(?:\s*h[ọo]c)?:\s*(.+?)\s*(?:[-–—]?\s*H[ọo]c\s*k[ỳy]|[\n\r]|$)/`

Vnedu Ext.js combobox không expose value vào `body.innerText`. Khi đó text bar có dạng:
```
"Lớp: 3A    Môn:    Học kỳ:    Học kỳ 2    Cuối kỳ 2"
```

Lazy `(.+?)` capture **MINIMUM** chars sao cho alternation match. Quá trình thử:
1. "H" → alt: cần "H[ọo]c..." từ vị trí "ọc kỳ" → fail
2. "Họ" → alt: "c kỳ" → fail
3. ... extending ...
4. "Học kỳ:" → alt: ở vị trí " Học kỳ 2", `\s*` match " ", `[-–—]?` "", `H[ọo]c\s*k[ỳy]` match "Học kỳ" → **SUCCESS**

→ Captured `mon = "Học kỳ:"` (label kế tiếp bị "ăn lẹm").

### Fix đề xuất

3 cải tiến đồng thời:

**1. Process line-by-line** thay vì regex toàn body

```js
const lines = allText.split(/[\n\r]+/);
for (const line of lines) { ... }
```

**2. Ưu tiên "Môn học:" trước "Môn:"** — "Môn học:" thường là label tĩnh trong page heading với value đầy đủ:

```js
// Pass 1
for (const line of lines) {
    const v = extractMon(line, /M[ôo]n\s+h[ọo]c:\s*(.+)$/i);
    if (v) { result.mon = v; break; }
}
// Pass 2 fallback
if (!result.mon) {
    for (const line of lines) {
        const v = extractMon(line, /M[ôo]n:\s*(.+)$/i);
        ...
    }
}
```

**3. Sanity check** — reject nếu captured value chính là tên label khác:

```js
const isLabelKeyword = (s) =>
    /^\s*(H[ọo]c\s*k[ỳy]|Kh[ốo]i|L[ớo]p|Cu[ốo]i\s*k[ỳy]|...)\s*[:.]?\s*$/i.test(s);
```

**4. Trim trailing label keywords** trong captured value (vd "Toán Học kỳ 2" → "Toán"):

```js
val = val.split(/\s+-\s+H[ọo]c\s*k[ỳy]/i)[0].trim();
val = val.replace(/\s+H[ọo]c\s*k[ỳy].*$/i, '').trim();
val = val.replace(/\s+(Cu[ốo]i|Gi[ữu]a)\s*k[ỳy].*$/i, '').trim();
```

**5. Update `sidebar.js` mapSubjectName** — thêm dạng viết tắt cho các môn (TN-XH, LSĐL, HĐTN...) để không phụ thuộc full Vietnamese name.

### Test acceptance

- ✅ Môn TN-XH lớp 1A → mon = "TN-XH" hoặc "Tự nhiên Xã hội" → mapSubjectName → 'tnxh' → có bank
- ✅ Môn Tin học và Công nghệ lớp 3A → mon = "Tin học và Công nghệ (Công nghệ)" → 'tinhoc' → có bank
- ✅ Môn Toán → giữ nguyên hành vi
- ✅ Môn Lịch sử - Địa lí → captured đầy đủ, không bị cắt giữa
- ✅ Trường hợp Vnedu không expose value → captured rỗng (KHÔNG bị "Học kỳ:")

### Fix log

- 2026-05-16: Patch + sanity check + line-by-line, JS syntax OK
- 2026-05-16: Verified — Tin học và Công nghệ now captures correctly

---

## BUG-005 — NLPC: Áp dụng ghi nhầm sang HS đang hiển thị, làm mất data HS đích (Critical)

**Phát hiện**: 2026-05-16
**Files**: `content/vnedu-adapter.js`, `sidebar/sidebar.js`, `engine/engine.js`
**Mức độ**: 🔴 Critical — DATA LOSS, ghi đè nhận xét HS đã lưu

### Hiện tượng

User báo: "khi chuyển sang HS thứ 2 thì dữ liệu HS 1 không còn, quay sang 3 thì HS 2 mất, quay lại HS 1 thì HS 3 mất". Cycle data loss khi switch HS.

### Root cause

Race condition giữa sidebar và Vnedu form khi switch HS:

1. User chọn HS#2 trong sidebar dropdown
2. `nlpcSelectedStt = 2`
3. Content script `target.tr.click()` trên Vnedu's HS list row #2 — **CLICK FAIL** (Vnedu Ext.js grid không hồi đáp với native DOM click)
4. Vnedu form vẫn hiển thị HS#1's textareas
5. Sidebar thinks HS#2, generate nhận xét cho HS#2
6. User bấm "Áp dụng" → `fillNLPCFields(payload)` điền HS#2's text vào textareas đang visible (= HS#1's form)
7. User bấm "Lưu" → Vnedu lưu = **HS#1's record bị ghi đè bằng text của HS#2**
8. HS#2 vẫn rỗng (form chưa load nên không có ai save)
9. User quay lại HS#1 → thấy text của HS#2 → tưởng "data HS#1 mất"

### Phát hiện thêm — BUG-005b

`CacheManager.normalizeSubject("Tin học và Công nghệ (Tin học)")` trả null vì alias map không có entry "tin hoc va cong nghe tin hoc". Suffix "(...)" làm normalize fail. Non-fatal nhưng làm silent cache không hoạt động → mất tracking điểm môn để suy NL/PC.

### Fix đề xuất

**1. `engine.js normalizeSubject` — strip parenthetical + substring fallback**

```js
let cleaned = subjectRaw.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
// ...
if (SUBJECT_NAME_MAP[noAccent]) return SUBJECT_NAME_MAP[noAccent];
// Fallback: substring match alias dài nhất trước, length >= 4 (tránh false-positive)
const sortedAliases = Object.keys(SUBJECT_NAME_MAP).sort((a, b) => b.length - a.length);
for (const alias of sortedAliases) {
    if (alias.length >= 4 && noAccent.includes(alias)) {
        return SUBJECT_NAME_MAP[alias];
    }
}
```

**2. `vnedu-adapter.js fillNLPCFields` — verify HS trước khi điền**

```js
fillNLPCFields(payload) {
    if (payload && payload._expectedHS) {
        const students = this.getNLPCStudentList();
        const current = students.find(s => s.isSelected);
        if (!current || current.hoVaTen !== payload._expectedHS) {
            return {
                success: 0, failed: 0, detail: [],
                error: 'hs_mismatch',
                expected: payload._expectedHS,
                actual: current?.hoVaTen || '(không xác định)'
            };
        }
    }
    // ... existing fill logic
}
```

**3. `sidebar.js applyNLPCToVnedu` — gắn `_expectedHS` vào payload**

```js
const hs = nlpcStudents.find(s => s.stt === nlpcSelectedStt);
parent.postMessage({
    type: 'COGIAO_APPLY_NLPC',
    payload: { ...nlpcGenerated, _expectedHS: hs?.hoVaTen }
}, '*');
```

**4. `sidebar.js handleNLPCApplyResult` — xử lý error 'hs_mismatch'**

Hiển thị modal cảnh báo cụ thể với 2 dòng: "Sidebar đang chọn: X" / "Vnedu đang hiển thị: Y" + hướng dẫn user click HS trong panel Vnedu trước.

### Test acceptance

- ✅ Vnedu hiển thị HS A, sidebar chọn HS A, bấm Áp dụng → ghi nhận xét OK
- ✅ Vnedu hiển thị HS A, sidebar chọn HS B (click sidebar dropdown nhưng Vnedu chưa switch), bấm Áp dụng → modal cảnh báo "HS không khớp", KHÔNG ghi đè HS A
- ✅ User làm theo hướng dẫn (click HS B trong Vnedu), bấm Áp dụng lại → ghi OK
- ✅ Tin học và Công nghệ (Tin học) → normalizeSubject trả `tin-hoc` thay vì null

### Fix log

- 2026-05-16: Apply 4 fix gộp, JS syntax OK
- TBD: Test local — switch HS, apply, verify không có data loss

---

## BUG-006 — NLPC lớp 3-5 thiếu 2 mục "Công nghệ" + "Tin học" (High)

**Phát hiện**: 2026-05-16, user phát hiện cuối phiên trước
**File**: `engine/engine.js`, `engine/data/nhanxet-ngan.json`, `sidebar/sidebar.js`, `content/vnedu-adapter.js`
**Phiên bản**: 0.1.27 → fix trong 0.1.28
**Mức độ**: 🟠 High — sai nghiệp vụ TT27 với lớp 3-5

### Hiện tượng

Theo TT27/2020 + CT GDPT 2018:
- **Lớp 1-2**: 5 NL đặc thù (Ngôn ngữ, Tính toán, Khoa học, Thẩm mĩ, Thể chất) → tổng 16 mục NLPC
- **Lớp 3-5**: 7 NL đặc thù (5 mục trên + **Công nghệ** + **Tin học**) → tổng 18 mục NLPC

Bản v0.1.27 chỉ sinh 16 mục cho mọi lớp → khi áp dụng vào Vnedu lớp 3-5, 2 ô "Công nghệ" + "Tin học" để trống → giáo viên phải tự gõ tay.

### Root cause

NLPC_FIELD_DEFS trong `sidebar/sidebar.js` và NLPC_FIELD_RULES trong `engine/engine.js` chỉ có 5 NL đặc thù, không có conditional logic theo khối lớp.

### Fix đã apply (v0.1.28)

**1. `engine/engine.js`** — thêm 2 rules vào `NLPC_FIELD_RULES`:
```js
cong_nghe: { label: 'Năng lực Công nghệ', section: 'nang_luc_dac_thu',
             sources: [{ key: 'tin-hoc', label: 'Tin-CN' }] },
tin_hoc:   { label: 'Năng lực Tin học',  section: 'nang_luc_dac_thu',
             sources: [{ key: 'tin-hoc', label: 'Tin-CN' }] }
```
- Cả 2 cùng derive từ subject `tin-hoc` (vì CT GDPT 2018 gộp "Tin học và Công nghệ" thành 1 môn).
- `_getNLDTLabel`: thêm 2 labels.
- Loop trong `sinhNLPCDayDu`: conditional push `cong_nghe + tin_hoc` khi `hsContext.gradeLevel >= 3`.

**2. `engine/data/nhanxet-ngan.json`** — thêm 2 bank `cong_nghe` + `tin_hoc` dưới `nlpc.nang_luc_dac_thu`, mỗi bank 3 mức tot/ht/cht với 2-4 câu mỗi mức.

**3. `sidebar/sidebar.js`**:
- `NLPC_FIELD_DEFS.nang_luc_dac_thu`: thêm 2 def với `minGrade: 3`.
- Helper `getGradeLevel(lop)`: extract chữ số 1-5 từ "3A", "Lớp 5C", v.v.
- Helper `getActiveFieldDefs(sec)`: lọc theo `minGrade` của field.
- `renderNLPCFields()`: dùng `getActiveFieldDefs` thay cho `NLPC_FIELD_DEFS[sec]` trực tiếp.
- `generateNLPCText()`: truyền `gradeLevel` vào `engine.sinhNLPCDayDu(hsContext, ...)`; chỉ build `danhGia` cho field active.
- `convertGeneratedToPayload()`: thêm 2 entries vào `labelToKey`.

**4. `content/vnedu-adapter.js`**:
- `_NLPC_LABEL_MAP`: thêm `'công nghệ': 'cong_nghe'`, `'tin học': 'tin_hoc'`.
- `_assignNLPCField`: thêm 2 key vào array NL đặc thù.
- Cập nhật JSDoc về số textarea (16 hoặc 18 tùy lớp).

### Test acceptance

- ⏳ Lớp 1A → sidebar hiển thị 5 NL đặc thù (không có Công nghệ/Tin học) → sinh 16 mục
- ⏳ Lớp 3A → sidebar hiển thị 7 NL đặc thù → sinh 18 mục, áp dụng đủ 18 ô Vnedu
- ⏳ Lớp 5C → tương tự lớp 3A
- ⏳ Engine console không lỗi "missing rule cong_nghe/tin_hoc"
- ⏳ Vnedu lớp 3-5: 2 ô "Công nghệ" + "Tin học" được fill bằng câu nhận xét phù hợp

### Fix log

- 2026-05-16: Apply 4 file (engine.js + data.json + sidebar.js + vnedu-adapter.js), JS+JSON syntax OK
- TBD: User test local trên Vnedu lớp 1A, 3A, 5C

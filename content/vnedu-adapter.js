/**
 * VneduAdapter v0.1.2 - Lớp adapter giao tiếp với DOM Vnedu v5
 *
 * Mới ở v0.1.2 (Phase 1 caching):
 *   - detectSoNXMon(): nhận diện trang Sổ NX môn (URL + DOM)
 *   - extractSoNXData(): parse {className, monKey, students:[{hoVaTen, diem}]}
 *   - silentCacheScores(): tự lưu vào CacheManager, KHÔNG show toast
 *
 * Fix kế thừa từ v0.1.1:
 *   - Dedupe row theo (stt + tên)
 *   - Đọc Lớp/Môn từ text bar "Lớp: 1A    Môn học: Tiếng Việt..." nếu dropdown không đọc được
 *   - Skip row không có textarea hợp lệ
 */

/**
 * Parse mức đánh giá chữ → tier nội bộ ('tot'|'ht'|'cht').
 * TT27 dùng:
 *   - Môn học: T (Hoàn thành Tốt) · H (Hoàn thành) · C (Chưa hoàn thành)
 *   - Bản dài: HTT · HT · CHT
 *   - NL/PC: T · Đ · C (KHÔNG có H — Đ thay H)
 */
function parseMucDat_(raw) {
    if (!raw) return null;
    const t = String(raw).trim().toUpperCase();
    if (!t || t.length > 4) return null;
    if (t === 'T' || t === 'T+' || t === 'HTT' || t === 'TỐT' || t === 'TOT') return 'tot';
    if (t === 'H' || t === 'HT' || t === 'Đ' || t === 'D' || t === 'ĐẠT' || t === 'DAT' || t === 'HOÀN THÀNH') return 'ht';
    if (t === 'C' || t === 'CHT' || t === 'CCG' || t === 'CHƯA') return 'cht';
    return null;
}

window.VneduAdapter = {

    /**
     * Visibility check NGHIÊM NGẶT cho Vnedu Ext.js (giữ nhiều panel cũ trong DOM):
     *   - offsetWidth/Height > 0
     *   - offsetParent !== null (no ancestor display:none)
     *   - getComputedStyle visibility != hidden + display != none
     *   - rect intersect với viewport (Vnedu có thể đặt left:-9999px để ẩn panel cũ)
     *   - element TRÊN CÙNG tại vị trí của nó (catch z-index swap — panel cũ bị đè)
     */
    _isVisible(el) {
        if (!el) return false;
        if (el.offsetWidth <= 0 || el.offsetHeight <= 0) return false;
        if (el.offsetParent === null) return false;

        const style = window.getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') return false;

        const rect = el.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) return false;
        if (rect.right <= 0 || rect.left >= window.innerWidth) return false;

        // CRITICAL: check element thực sự ở trên cùng (không bị panel khác z-index đè).
        // Vnedu Ext.js dùng cardpanel — chuyển page = đổi z-index, panel cũ vẫn trong DOM.
        if (!this._isOnTop(el, rect)) return false;

        return true;
    },

    /**
     * Check element có thực sự là element TOP-MOST tại tâm của nó hay không
     * (dùng document.elementFromPoint).
     */
    _isOnTop(el, rect) {
        rect = rect || el.getBoundingClientRect();
        // Lấy điểm INSIDE rect, clamp vào viewport
        const cx = Math.max(0, Math.min(window.innerWidth - 1,
                            (rect.left + rect.right) / 2));
        const cy = Math.max(0, Math.min(window.innerHeight - 1,
                            (rect.top + rect.bottom) / 2));

        const top = document.elementFromPoint(cx, cy);
        if (!top) return false;
        // OK nếu top là chính nó, hoặc top là descendant/ancestor của nó
        return top === el || el.contains(top) || top.contains(el);
    },

    /**
     * Visibility check NỚI LỎNG — dùng cho ENUMERATION/FILL (khác _isVisible dùng cho detect).
     *   - Vẫn loại panel SPA bị ẩn: display:none (offsetParent null), left:-9999px (rect.right<=0)
     *   - NHƯNG KHÔNG đòi element nằm trong viewport.
     * Lý do: bảng Vnedu 35 HS chỉ ~12 dòng trong viewport cùng lúc; form NLPC phải cuộn mới
     * thấy hết 16 textarea. Nếu đòi viewport intersection thì chỉ đọc/ghi được phần đang hiển
     * thị → sót HS, sót ô Phẩm chất. Dùng check này cho getStudentRows / findNLPCFields.
     */
    _isInActivePanel(el) {
        if (!el) return false;
        if (el.offsetWidth <= 0 || el.offsetHeight <= 0) return false;
        if (el.offsetParent === null) return false;  // display:none ở tổ tiên

        const style = window.getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') return false;

        // Loại panel cũ Vnedu giấu bằng left:-9999px (vẫn có kích thước, offsetParent !== null).
        // KHÔNG loại theo trục dọc — dòng cuộn ra ngoài viewport vẫn hợp lệ.
        const rect = el.getBoundingClientRect();
        if (rect.right <= 0) return false;                     // nằm hẳn bên trái màn hình
        if (rect.left >= window.innerWidth * 3) return false;  // nằm quá xa bên phải

        return true;
    },

    detectModule() {
        // v0.1.25: Detect bằng MARKER ĐẶC TRƯNG strict-visible (top-most trong viewport).
        // Vnedu SPA Ext.js giữ panel cũ trong DOM, header chung "[2025-2026] Sổ điểm" hoặc
        // tương tự KHÔNG đủ phân biệt vì Sổ NX môn là tab CON trong Sổ điểm.
        //
        // Marker dùng:
        //   - NLPC: text "Phẩm chất - Năng lực ghi học bạ" hoặc "Năng lực ghi học bạ"
        //   - Sổ NX: cell header "Nhận xét cuối kỳ" (cột table)
        // Cả 2 đều phải vượt _isVisible (có _isOnTop kiểm element top-most) → card cũ
        // bị z-index dưới sẽ FAIL _isOnTop → không match.

        const nlpcMarker = this._findStrictVisibleText_(/Phẩm chất\s*[-–—]\s*Năng lực ghi học bạ|Năng lực ghi học bạ/i);
        if (nlpcMarker) {
            const r = this._isNLPCFormActive() ? 'nlpc' : null;
            this._logDetectOnce_('marker NLPC', nlpcMarker, r);
            return r;
        }

        const soNXMarker = this._findStrictVisibleText_(/^Nhận xét cuối kỳ$/i);
        if (soNXMarker) {
            const r = this._isSoNXActive() ? 'so-nhan-xet' : null;
            this._logDetectOnce_('marker SoNX', soNXMarker, r);
            return r;
        }

        // Fallback chỉ chạy nếu KHÔNG tìm thấy marker nào — rất ít khi cần.
        if (this._isSoNXActive()) {
            this._logDetectOnce_('fallback SoNX', '', 'so-nhan-xet');
            return 'so-nhan-xet';
        }
        if (this._isNLPCFormActive()) {
            this._logDetectOnce_('fallback NLPC', '', 'nlpc');
            return 'nlpc';
        }
        return null;
    },

    _findStrictVisibleText_(pattern) {
        const els = document.querySelectorAll('div, span, h1, h2, h3, h4, td, th, b, strong, a, label, legend, p');
        for (const el of els) {
            if (el.children.length > 0) continue;  // LEAF only
            const text = (el.textContent || '').trim();
            if (!text || text.length > 80) continue;
            if (!pattern.test(text)) continue;
            if (!this._isVisible(el)) continue;
            return text;
        }
        return '';
    },

    // Log chỉ khi kết quả detect đổi, tránh tràn console
    _lastLogState_: '',
    _logDetectOnce_(why, header, result) {
        const key = why + '|' + header + '|' + result;
        if (key === this._lastLogState_) return;
        this._lastLogState_ = key;
        console.log('[VneduAdapter] detectModule:', why, '·', 'header=', JSON.stringify(header), '·', 'result=', result);
    },

    /**
     * Tìm header trang Vnedu đang ACTIVE theo pattern [YYYY-YYYY] Tên trang.
     * QUAN TRỌNG:
     *   - Chỉ lấy LEAF element (không có child element) để tránh ancestor div chứa
     *     textContent gộp cả 2 header (NLPC + Sổ NX) khi Vnedu giữ panel cũ.
     *   - strict-visible (in viewport + top-most) — loại header của card cũ đã ẩn.
     *   - Pattern chấp nhận hyphen, en-dash, em-dash giữa 2 năm.
     */
    _getActiveVneduHeader() {
        const PATTERN = /\[\s*20\d{2}\s*[-–—]\s*20\d{2}\s*\]/;
        const els = document.querySelectorAll('div, span, h1, h2, h3, h4, td, b, strong, a');
        for (const el of els) {
            if (el.children.length > 0) continue;       // LEAF only
            const text = (el.textContent || '').trim();
            if (!text || text.length > 80) continue;
            if (!PATTERN.test(text)) continue;
            if (!this._isVisible(el)) continue;
            return text;
        }
        return '';
    },

    /**
     * NLPC active = có ≥4 label đặc trưng NLPC nằm GẦN textarea VISIBLE (cùng container).
     */
    _isNLPCFormActive() {
        const NLPC_LABELS = [
            'Tự chủ và tự học', 'Giao tiếp và hợp tác', 'GQVĐ', 'Giải quyết vấn đề',
            'Yêu nước', 'Nhân ái', 'Trung thực', 'Trách nhiệm',
            'Ngôn ngữ', 'Tính toán', 'Khoa học', 'Thẩm mĩ', 'Thẩm mỹ', 'Thể chất',
            'Năng lực đặc thù'
        ];

        // Lấy tất cả textarea VISIBLE (strict — bypass panel ẩn của tab cũ)
        const visibleTextareas = Array.from(document.querySelectorAll('textarea'))
            .filter(ta => this._isInActivePanel(ta))
            .filter(ta => !ta.closest('#cogiao-ai-sidebar'));

        if (visibleTextareas.length < 5) return false; // NLPC có 16 textarea, ít nhất phải >5

        // Đếm số label NLPC tìm thấy gần các textarea visible này
        let labelCount = 0;
        const seen = new Set();
        for (const ta of visibleTextareas) {
            // Lấy text trong vòng 2-3 element trước textarea (label thường đứng trên)
            let el = ta;
            for (let depth = 0; depth < 5; depth++) {
                el = el.previousElementSibling || el.parentElement;
                if (!el) break;
                const text = (el.textContent || '').trim();
                if (text.length > 200) continue;
                for (const label of NLPC_LABELS) {
                    if (!seen.has(label) && text.includes(label)) {
                        seen.add(label);
                        labelCount++;
                    }
                }
                if (labelCount >= 4) return true;
            }
        }
        return labelCount >= 4;
    },

    /**
     * Trả về <table> Sổ NX đang ACTIVE (chứa cell "Nhận xét cuối kỳ" + có textarea còn render).
     * Null nếu không có. Dùng để SCOPE việc đọc HS — đọc TẤT CẢ dòng trong bảng này, kể cả
     * dòng đang cuộn ngoài viewport.
     *
     * Dùng _isInActivePanel (nới lỏng viewport) thay vì _isVisible: khi GV cuộn xuống xem
     * cuối bảng thì header "Nhận xét cuối kỳ" có thể đã ra khỏi tầm nhìn — nhưng bảng vẫn active.
     */
    _getActiveSoNXTable() {
        const cells = Array.from(document.querySelectorAll('th, td'))
            .filter(el => /Nhận xét cuối kỳ/i.test(el.textContent || ''))
            .filter(el => this._isInActivePanel(el));

        for (const cell of cells) {
            const table = cell.closest('table');
            if (!table) continue;
            // Bảng active phải còn ≥1 textarea render (loại bảng của panel SPA đã ẩn).
            const hasTa = Array.from(table.querySelectorAll('textarea'))
                .some(ta => ta.offsetParent !== null);
            if (hasTa) return table;
        }
        return null;
    },

    /**
     * Sổ NX active = tìm được bảng Sổ NX active.
     */
    _isSoNXActive() {
        return !!this._getActiveSoNXTable();
    },

    getContext() {
        const ctx = { khoi: '', lop: '', mon: '', hocKy: '', kyDanhGia: '' };

        // BUG-007 fix: Vnedu Ext.js SPA giữ select của panel cũ trong DOM (vd "Sổ điểm
        // lớp 1A" còn nguyên sau khi đã chuyển sang "Học bạ lớp 5A"). Cần lọc bằng
        // _isInActivePanel để chỉ lấy select của panel ACTIVE.
        const allSelects = Array.from(document.querySelectorAll('select'));
        const activeSelects = allSelects.filter(s => this._isInActivePanel(s));

        for (const sel of activeSelects) {
            const label = this._findLabelFor(sel);
            const value = sel.options[sel.selectedIndex]?.textContent?.trim() || '';
            if (!value) continue;

            const labelLower = label.toLowerCase();
            if (/môn/i.test(labelLower)) ctx.mon = value;
            else if (/^lớp/i.test(labelLower)) ctx.lop = value;
            else if (/khối/i.test(labelLower)) ctx.khoi = value;
            else if (/học kỳ|^kỳ:/i.test(labelLower)) ctx.hocKy = value;
            else if (/cuối kỳ|giữa kỳ/i.test(value)) ctx.kyDanhGia = value;
        }

        // BUG-008 fix: Ext.js ẩn <select> thật (dùng dropdown ảo) → activeSelects rỗng.
        // Fallback dùng text scope theo ACTIVE PANEL (chứa marker NLPC hoặc Sổ NX),
        // tránh lấy text "Lớp: 1A" từ panel cũ ẩn của tab Sổ điểm.
        if (!ctx.lop || !ctx.mon) {
            const scoped = this._parseContextFromActivePanel();
            if (scoped) {
                ctx.lop = ctx.lop || scoped.lop;
                ctx.mon = ctx.mon || scoped.mon;
                ctx.hocKy = ctx.hocKy || scoped.hocKy;
                ctx.khoi = ctx.khoi || scoped.khoi;
            }
        }

        // Fallback cuối: parse toàn body (kém chính xác, chỉ dùng khi không tìm được panel)
        if (!ctx.lop || !ctx.mon) {
            const fallback = this._parseContextFromTextBar();
            if (fallback) {
                ctx.lop = ctx.lop || fallback.lop;
                ctx.mon = ctx.mon || fallback.mon;
                ctx.hocKy = ctx.hocKy || fallback.hocKy;
            }
        }

        // [NLPC-DBG] log context cuối cùng
        console.log('[NLPC-DBG] getContext result', ctx);

        return ctx;
    },

    /**
     * BUG-008: Parse Khối/Lớp/Học kỳ/Môn từ text của ACTIVE PANEL.
     *
     * Tìm element marker đặc trưng cho trang đang active (NLPC hoặc Sổ NX), đi lên
     * ancestor đến panel container đủ lớn, lấy innerText của panel đó (KHÔNG bao gồm
     * text của panel ẩn vì innerText skip element hidden) → parse Lớp/Khối/Học kỳ.
     */
    _parseContextFromActivePanel() {
        // 1. Tìm marker element NLPC hoặc Sổ NX đang VISIBLE
        const patterns = [
            /Phẩm chất\s*[-–—]\s*Năng lực ghi học bạ/i,
            /Năng lực ghi học bạ/i,
            /^Nhận xét cuối kỳ$/i
        ];
        const candidates = document.querySelectorAll('div, span, h1, h2, h3, h4, td, th, b, strong, a, label, legend, p');
        let markerEl = null;
        for (const el of candidates) {
            if (el.children.length > 0) continue;
            const text = (el.textContent || '').trim();
            if (!text || text.length > 80) continue;
            if (!patterns.some(p => p.test(text))) continue;
            if (!this._isVisible(el)) continue;
            markerEl = el;
            break;
        }
        if (!markerEl) {
            console.log('[NLPC-DBG] _parseContextFromActivePanel: không tìm thấy marker visible');
            return null;
        }

        // 2. Đi lên ancestor cho đến khi text container chứa cả marker và "Lớp:"
        let node = markerEl.parentElement;
        let foundText = '';
        while (node && node !== document.body) {
            const text = node.innerText || '';
            // Container active phải chứa marker và label "Lớp:" cùng dòng/cùng panel
            if (/L[ớo]p\s*:/i.test(text) && text.length < 50000) {
                foundText = text;
                break;
            }
            node = node.parentElement;
        }
        if (!foundText) {
            console.log('[NLPC-DBG] _parseContextFromActivePanel: không tìm thấy ancestor chứa "Lớp:"');
            return null;
        }

        // 3. Parse Khối / Lớp / Học kỳ / Môn từ text của panel active
        const result = { khoi: '', lop: '', mon: '', hocKy: '' };
        const khoiM = foundText.match(/Kh[ốo]i\s*:\s*Kh[ốo]i\s*(\d+)|Kh[ốo]i\s*:\s*(\d+)/i);
        if (khoiM) result.khoi = 'Khối ' + (khoiM[1] || khoiM[2]);
        const lopM = foundText.match(/L[ớo]p\s*:\s*([0-9]+[A-Za-zÀ-ỹ]?)/i);
        if (lopM) result.lop = lopM[1];
        const hkM = foundText.match(/H[ọo]c\s*k[ỳy]\s*:\s*H[ọo]c\s*k[ỳy]\s*(\d+)|H[ọo]c\s*k[ỳy]\s*:\s*(\d+)/i);
        if (hkM) result.hocKy = 'Học kỳ ' + (hkM[1] || hkM[2]);
        const monM = foundText.match(/M[ôo]n\s*(?:h[ọo]c)?\s*:\s*([^\n\r]+?)(?:\s+(?:H[ọo]c\s*k[ỳy]|Cu[ốo]i|Gi[ữu]a|\n|$))/i);
        if (monM) result.mon = monM[1].trim();

        console.log('[NLPC-DBG] _parseContextFromActivePanel result', result);
        return result;
    },

    _parseContextFromTextBar() {
        const allText = document.body.innerText || '';

        const result = { lop: '', mon: '', hocKy: '' };

        const lopMatch = allText.match(/L[ớo]p:\s*([0-9]+[A-Za-zÀ-ỹ]?)/);
        if (lopMatch) result.lop = lopMatch[1];

        // BUG-003 + BUG-004 fix: parse môn theo từng line riêng để tránh lazy regex
        // "ăn lẹm" qua label kế tiếp khi value rỗng. Ưu tiên "Môn học: ..." (specific)
        // trước "Môn: ..." (generic). Có sanity check rejects label keywords.
        const lines = allText.split(/[\n\r]+/);
        const isLabelKeyword = (s) =>
            /^\s*(H[ọo]c\s*k[ỳy]|Kh[ốo]i|L[ớo]p|Cu[ốo]i\s*k[ỳy]|Gi[ữu]a\s*k[ỳy]|M[ôo]n)\s*[:.]?\s*$/i.test(s);
        const extractMon = (line, pattern) => {
            const m = line.match(pattern);
            if (!m) return null;
            let val = m[1].trim();
            // Cắt tất cả phần trailing bắt đầu từ " - Học kỳ" hoặc " Học kỳ" (dù có số hay không)
            val = val.split(/\s+-\s+H[ọo]c\s*k[ỳy]/i)[0].trim();
            val = val.replace(/\s+H[ọo]c\s*k[ỳy].*$/i, '').trim();
            // Cắt phần trailing nếu có nhiều label trên cùng dòng (vd " Cuối kỳ", " Giữa kỳ")
            val = val.replace(/\s+(Cu[ốo]i|Gi[ữu]a)\s*k[ỳy].*$/i, '').trim();
            if (!val || val.length < 2) return null;
            if (isLabelKeyword(val)) return null;
            return val;
        };

        // Pass 1: "Môn học: ..." (specific — page heading thường dùng dạng này)
        for (const line of lines) {
            const v = extractMon(line, /M[ôo]n\s+h[ọo]c:\s*(.+)$/i);
            if (v) { result.mon = v; break; }
        }
        // Pass 2: "Môn: ..." fallback (header bar dropdown)
        if (!result.mon) {
            for (const line of lines) {
                const v = extractMon(line, /M[ôo]n:\s*(.+)$/i);
                if (v) { result.mon = v; break; }
            }
        }

        const hkMatch = allText.match(/H[ọo]c k[ỳy]\s*([12])/i);
        if (hkMatch) result.hocKy = 'Học kỳ ' + hkMatch[1];

        return result;
    },

    _findLabelFor(input) {
        let prev = input.previousElementSibling;
        while (prev) {
            const text = prev.textContent?.trim();
            if (text && text.length < 30) return text;
            prev = prev.previousElementSibling;
        }
        const td = input.closest('td');
        if (td && td.previousElementSibling) {
            return td.previousElementSibling.textContent?.trim() || '';
        }
        const label = input.closest('label');
        if (label) return label.textContent?.trim() || '';

        return '';
    },

    getStudentRows() {
        const rows = [];
        const seenKeys = new Set();

        // Scope vào ĐÚNG bảng Sổ NX đang active → đọc TẤT CẢ dòng trong bảng đó, kể cả
        // dòng đang cuộn ngoài viewport. Fix: lớp 35 HS trước đây chỉ đọc ~12 dòng đang
        // hiển thị vì _isVisible đòi element nằm trong viewport.
        const activeTable = this._getActiveSoNXTable();
        const allTextareas = activeTable
            ? activeTable.querySelectorAll('textarea')
            : document.querySelectorAll('textarea');

        for (const ta of allTextareas) {
            // Trong bảng đã xác định active: chỉ cần ô còn render (không bị display:none).
            // Trường hợp fallback (không thấy bảng): dùng check nới lỏng panel.
            if (activeTable) {
                if (ta.offsetParent === null) continue;
            } else if (!this._isInActivePanel(ta)) {
                continue;
            }
            if (ta.disabled || ta.readOnly) continue;

            const tr = ta.closest('tr');
            if (!tr) continue;

            const cells = tr.querySelectorAll('td');
            if (cells.length < 3) continue;

            const sttText = cells[0]?.textContent?.trim() || '';
            const stt = parseInt(sttText);
            if (isNaN(stt) || stt < 1 || stt > 100) continue;

            let hoVaTen = '';
            for (let i = 1; i < Math.min(cells.length, 4); i++) {
                const cellText = cells[i].textContent?.trim() || '';
                if (cellText && /^[A-ZĐĂÂÊÔƠƯ]/i.test(cellText) &&
                    cellText.length > 1 &&
                    !/\d{2}\/\d{2}\/\d{4}/.test(cellText) &&
                    !cells[i].querySelector('input, textarea')) {
                    hoVaTen += ' ' + cellText;
                }
            }
            hoVaTen = hoVaTen.replace(/\s+/g, ' ').trim();
            if (!hoVaTen || hoVaTen.length < 3) continue;

            const dedupeKey = `${stt}|${hoVaTen}`;
            if (seenKeys.has(dedupeKey)) continue;
            seenKeys.add(dedupeKey);

            const inputs = tr.querySelectorAll('input[type="text"], input:not([type])');
            let diem = null;
            let mucDat = null;  // 'tot' | 'ht' | 'cht' — cho môn đánh giá BẰNG CHỮ (TNXH, ĐĐ, MT...)

            // Đọc giá trị từ <input>
            for (const inp of inputs) {
                if (inp === ta) continue;
                const rawVal = String(inp.value || '').trim();
                if (!rawVal || rawVal.length > 4) continue;

                // Thử parse số 0-10 trước
                const v = parseFloat(rawVal.replace(',', '.'));
                if (!isNaN(v) && v >= 0 && v <= 10 && diem === null) {
                    diem = v;
                    continue;
                }
                // Mức chữ T/H/C hoặc HTT/HT/CHT (TT27)
                if (mucDat === null) mucDat = parseMucDat_(rawVal);
            }

            // Đọc mức chữ từ TD text trực tiếp (Vnedu đôi khi render mức không qua input)
            // BUG-001 fix: skip cells[0..3] vì là STT + Họ và tên — tránh tên HS "Đạt"
            // bị parseMucDat_ nhầm thành mức "Đ" (Đạt). Cells mục đánh giá nằm sau ngày sinh.
            if (mucDat === null) {
                for (let ci = 4; ci < cells.length; ci++) {
                    const cell = cells[ci];
                    if (cell.querySelector('input, textarea, select')) continue;
                    const t = (cell.textContent || '').trim();
                    if (!t || t.length > 4) continue;
                    if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) continue;  // ngày sinh
                    const parsed = parseMucDat_(t);
                    if (parsed) { mucDat = parsed; break; }
                }
            }

            rows.push({
                stt,
                hoVaTen,
                diem,
                mucDat,
                textarea: ta,
                tr,
                daCoNhanXet: !!(ta.value || '').trim()
            });
        }

        rows.sort((a, b) => a.stt - b.stt);

        return rows;
    },

    fillTextarea(textarea, value) {
        if (!textarea) return false;

        try {
            const nativeSetter = Object.getOwnPropertyDescriptor(
                HTMLTextAreaElement.prototype, 'value'
            ).set;
            nativeSetter.call(textarea, value);

            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
            textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
            textarea.dispatchEvent(new Event('blur', { bubbles: true }));

            textarea.classList.add('cogiao-ai-filled');

            return true;
        } catch (e) {
            console.error('[VneduAdapter] Lỗi khi ghi textarea:', e);
            return false;
        }
    },

    findLuuButton() {
        const all = document.querySelectorAll('button, input[type="button"], input[type="submit"], a, span, div');
        const candidates = [];

        for (const el of all) {
            if (el.closest('#cogiao-ai-sidebar')) continue;
            if (el.offsetWidth === 0 || el.offsetHeight === 0) continue;
            if (el.disabled) continue;

            const text = (el.value || el.textContent || el.title || '').trim();
            const lower = text.toLowerCase();

            if (lower === 'lưu' || lower === 'ghi' || lower === 'lưu lại' || lower === 'cập nhật') {
                candidates.push({ el, text, priority: 10 });
            } else if (/^(lưu|ghi)\s+(thông tin|nhận xét|điểm|dữ liệu|tất cả)/i.test(text)) {
                candidates.push({ el, text, priority: 8 });
            } else if (lower.includes('save') && lower.length < 10) {
                candidates.push({ el, text, priority: 5 });
            }
        }

        candidates.sort((a, b) => b.priority - a.priority);

        for (const c of candidates) {
            if (c.el.tagName === 'BUTTON' || c.el.tagName === 'INPUT' || c.el.tagName === 'A') {
                return c.el;
            }
            const parent = c.el.closest('button, a, [role="button"], .x-btn, .x-toolbar-item');
            if (parent && !parent.closest('#cogiao-ai-sidebar')) {
                return parent;
            }
        }

        return candidates.length > 0 ? candidates[0].el : null;
    },

    clickLuuButton() {
        const btn = this.findLuuButton();
        if (!btn) {
            console.warn('[VneduAdapter] Không tìm thấy nút Lưu trong Vnedu');
            return { success: false, reason: 'not_found' };
        }

        try {
            console.log('[VneduAdapter] Bấm nút Lưu Vnedu:', btn);
            btn.click();
            return { success: true, buttonText: btn.textContent?.trim() || btn.value || 'Lưu' };
        } catch (e) {
            console.error('[VneduAdapter] Lỗi khi bấm Lưu:', e);
            return { success: false, reason: 'click_failed', error: e.message };
        }
    },

    /* ====================================================================
     * PHASE 1 — Detect & extract Sổ NX môn để cache điểm SILENT
     * ================================================================== */

    /**
     * Nhận diện trang Sổ NX môn (khác với Form NLPC).
     * Heuristic kết hợp URL pattern + DOM signal:
     *   - URL chứa /so-nhan-xet, /sohoc, /nhat-ky, /diem-mon
     *   - HOẶC body có chữ "Sổ nhận xét" và bảng có cột điểm số
     *   - Loại trừ: title/text có "Phẩm chất", "Năng lực" → đó là Form NLPC
     *
     * Trả true nếu chắc chắn là Sổ NX môn, ngược lại false.
     */
    detectSoNXMon() {
        const url = (location.href || '').toLowerCase();
        const allText = document.body.innerText || '';
        const title = document.title || '';

        // Loại NLPC trước (để tránh false positive — NLPC cũng có table HS)
        if (/Phẩm chất.*Năng lực|Năng lực ghi học bạ/i.test(allText)) {
            return false;
        }

        // URL pattern thường gặp ở Vnedu
        const urlMatch = /(so[-_]?nhan[-_]?xet|sohoc|nhat[-_]?ky|diem[-_]?mon|so[-_]?diem)/.test(url);

        // DOM signal: text "Sổ nhận xét" + có cột Môn học + có textarea nhận xét
        const textMatch = /Sổ nhận xét|Nhận xét cuối kỳ|Nhận xét môn/i.test(allText) ||
                          /Sổ nhận xét/i.test(title);

        // Phải có ít nhất 1 textarea nhận xét HS hợp lệ (= có Sổ NX)
        const hasTextarea = !!document.querySelector('textarea');

        return (urlMatch || textMatch) && hasTextarea;
    },

    /**
     * Extract toàn bộ data Sổ NX hiện tại để feed cho CacheManager.
     *
     * Trả về:
     *   {
     *     className: "5A",
     *     monRaw: "Tiếng Việt",         // tên gốc từ Vnedu
     *     monKey: "tieng-viet",          // đã normalize
     *     students: [
     *       { stt: 1, hoVaTen: "Ngô Thị Bảo An", diem: 9 },
     *       ...
     *     ],
     *     hocKy: "Học kỳ 1"              // tham khảo
     *   }
     *
     * Trả null nếu không đủ info (thiếu lớp / thiếu môn / không có HS).
     */
    extractSoNXData() {
        try {
            const ctx = this.getContext();
            const className = ctx.lop;
            const monRaw = ctx.mon;

            if (!className || !monRaw) {
                console.warn('[VneduAdapter] extractSoNXData: thiếu className hoặc môn', ctx);
                return null;
            }

            // Normalize tên môn — lazy lookup window.CacheManager
            // (CacheManager được expose qua engine.js, load trước trong content_scripts)
            const monKey = (typeof window.CacheManager !== 'undefined')
                ? window.CacheManager.normalizeSubject(monRaw)
                : null;

            if (!monKey) {
                console.warn(`[VneduAdapter] Môn "${monRaw}" không nhận ra — bỏ qua sync`);
                return null;
            }

            const rows = this.getStudentRows();
            if (!rows || rows.length === 0) {
                console.warn('[VneduAdapter] extractSoNXData: không tìm thấy HS nào');
                return null;
            }

            // Map sang format gọn để cache (bỏ ref DOM textarea/tr)
            const students = rows.map(r => ({
                stt: r.stt,
                hoVaTen: r.hoVaTen,
                diem: r.diem
            }));

            return {
                className,
                monRaw,
                monKey,
                students,
                hocKy: ctx.hocKy || ''
            };
        } catch (e) {
            console.error('[VneduAdapter] extractSoNXData lỗi:', e);
            return null;
        }
    },

    /**
     * SILENT sync — gọi sau khi extract Sổ NX xong, chạy background.
     * KHÔNG show toast / notification cho GV.
     *
     * Trả Promise<{ success, synced, skipped, monKey, className }>
     */
    /* ====================================================================
     * v0.1.7 — NLPC FORM (Phẩm chất + Năng lực ghi học bạ)
     *
     * Form NLPC có 16 textarea (lớp 1-2) hoặc 18 textarea (lớp 3-5) cho 1 HS:
     *   NL chung (4): Nhận xét chung, Tự chủ và tự học, Giao tiếp và hợp tác, GQVĐ
     *   NL đặc thù (6 hoặc 8):
     *     - Lớp 1-2: Nhận xét chung, Ngôn ngữ, Tính toán, Khoa học, Thẩm mĩ, Thể chất
     *     - Lớp 3-5: thêm Công nghệ + Tin học (BUG-006, theo TT27/2020 + CT GDPT 2018)
     *   PC (6): Nhận xét chung, Yêu nước, Nhân ái, Chăm chỉ, Trung thực, Trách nhiệm
     *
     * UX Vnedu: GV chọn HS từ danh sách bên trái → các textarea bên phải hiển thị.
     * ================================================================== */

    /**
     * Map label Vnedu → field key chuẩn (đồng bộ với engine.js NLPC structure)
     */
    _NLPC_LABEL_MAP: {
        // Năng lực chung
        'nhận xét chung': 'nlc_chung',
        'tự chủ và tự học': 'tu_chu_tu_hoc',
        'giao tiếp và hợp tác': 'giao_tiep_hop_tac',
        'gqvđ và sáng tạo': 'giai_quyet_van_de',
        'giải quyết vấn đề và sáng tạo': 'giai_quyet_van_de',
        // Năng lực đặc thù
        'nhận xét năng lực đặc thù': 'nldt_chung',
        'ngôn ngữ': 'ngon_ngu',
        'tính toán': 'tinh_toan',
        'khoa học': 'khoa_hoc',
        'thẩm mĩ': 'tham_mi',
        'thẩm mỹ': 'tham_mi',
        'thể chất': 'the_chat',
        // BUG-006: Lớp 3-5 có thêm Công nghệ + Tin học (TT27)
        'công nghệ': 'cong_nghe',
        'tin học': 'tin_hoc',
        // Phẩm chất
        'yêu nước': 'yeu_nuoc',
        'nhân ái': 'nhan_ai',
        'chăm chỉ': 'cham_chi',
        'trung thực': 'trung_thuc',
        'trách nhiệm': 'trach_nhiem'
    },

    /**
     * Lấy context NLPC: lớp + học kỳ.
     */
    getNLPCContext() {
        const ctx = this.getContext();  // reuse logic detect lớp từ select/textbar
        return { lop: ctx.lop || '', hocKy: ctx.hocKy || '', khoi: ctx.khoi || '' };
    },

    /**
     * Lấy danh sách HS từ panel trái (form NLPC).
     * Vnedu render bảng [STT | Họ tên] bên trái cho phép GV click chọn HS.
     */
    getNLPCStudentList() {
        const students = [];
        const seen = new Set();

        // Tìm tất cả tr có cấu trúc STT + Tên (tương tự getStudentRows nhưng KHÔNG cần textarea trong row)
        const trs = document.querySelectorAll('tr');
        for (const tr of trs) {
            // Skip nếu tr nằm trong sidebar của extension
            if (tr.closest('#cogiao-ai-sidebar')) continue;

            const cells = tr.querySelectorAll('td');
            if (cells.length < 2) continue;

            const sttText = cells[0]?.textContent?.trim() || '';
            const stt = parseInt(sttText);
            if (isNaN(stt) || stt < 1 || stt > 100) continue;

            const nameText = cells[1]?.textContent?.trim() || '';
            if (!nameText || nameText.length < 3 || nameText.length > 60) continue;
            // Phải bắt đầu chữ hoa Việt
            if (!/^[A-ZĐĂÂÊÔƠƯ]/.test(nameText)) continue;
            // Không có ngày
            if (/\d{2}\/\d{2}\/\d{4}/.test(nameText)) continue;

            const key = `${stt}|${nameText}`;
            if (seen.has(key)) continue;
            seen.add(key);

            students.push({
                stt,
                hoVaTen: nameText.replace(/\s+/g, ' ').trim(),
                tr,  // ref để click chọn
                isSelected: tr.classList.contains('x-grid-row-selected') ||
                            tr.classList.contains('selected') ||
                            tr.style.background?.includes('rgb(')
            });
        }

        students.sort((a, b) => a.stt - b.stt);
        return students;
    },

    /**
     * Click chọn 1 HS trong danh sách trái (programmatic select).
     */
    selectNLPCStudent(stt) {
        const students = this.getNLPCStudentList();
        const target = students.find(s => s.stt === stt);
        if (!target?.tr) return false;
        try {
            target.tr.click();
            // Một số Vnedu cần thêm dblclick để load form
            target.tr.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
            return true;
        } catch (e) {
            console.warn('[VneduAdapter] selectNLPCStudent lỗi:', e);
            return false;
        }
    },

    /**
     * Tìm 16 textarea NLPC + map theo label.
     *
     * v0.1.8 GEOMETRIC MATCHING: Vnedu (Ext JS) wrap textarea trong nhiều layer
     * → previousSibling không trỏ đến label. Approach mới:
     *   1) Tìm tất cả LABEL visible khớp với pattern NLPC ("Tự chủ và tự học:", ...)
     *   2) Với mỗi label, tìm textarea visible NẰM NGAY DƯỚI (cùng cột X)
     *   3) Distinguish "Nhận xét chung" trong NLC vs PC bằng X-position
     */
    /** Tổ tiên chung gần nhất của 2 element (null nếu không có). */
    _commonAncestor(a, b) {
        const seen = new Set();
        let x = a;
        while (x) { seen.add(x); x = x.parentElement; }
        let y = b;
        while (y) { if (seen.has(y)) return y; y = y.parentElement; }
        return null;
    },

    /**
     * Tìm container của form NLPC đang active = tổ tiên chung của các textarea NLPC.
     * Dùng để SCOPE việc đọc 16 ô — đọc cả ô đang cuộn ngoài viewport (fix: cuộn xuống
     * Phẩm chất thì 6 ô PC trước đây bị _isVisible loại → no_textarea).
     */
    _getActiveNLPCContainer() {
        const tas = Array.from(document.querySelectorAll('textarea'))
            .filter(ta => !ta.closest('#cogiao-ai-sidebar'))
            .filter(ta => this._isInActivePanel(ta));
        if (tas.length < 3) return null;

        let common = tas[0].parentElement;
        for (let i = 1; i < tas.length && common; i++) {
            common = this._commonAncestor(common, tas[i]);
        }
        return common || null;
    },

    findNLPCFields() {
        const result = {
            nang_luc_chung: { fields: {} },
            nang_luc_dac_thu: { fields: {} },
            pham_chat: { fields: {} }
        };

        // 1. Scope vào container form NLPC đang active, lấy TẤT CẢ textarea trong đó
        //    (nới lỏng viewport — đọc được cả 16 ô dù đang cuộn ở section nào).
        const container = this._getActiveNLPCContainer();
        const scopeRoot = container || document.body;

        const visibleTas = Array.from(scopeRoot.querySelectorAll('textarea'))
            .filter(ta => !ta.closest('#cogiao-ai-sidebar'))
            .filter(ta => this._isInActivePanel(ta));

        if (visibleTas.length === 0) {
            console.warn('[VneduAdapter] findNLPCFields: 0 visible textarea');
            return result;
        }

        const taData = visibleTas.map(ta => {
            const r = ta.getBoundingClientRect();
            return { ta, rect: r, used: false, centerX: (r.left + r.right) / 2 };
        });

        // 2. Detect 2 cột (NL trái/giữa, PC phải) theo median X-center
        const xs = taData.map(t => t.centerX).sort((a, b) => a - b);
        const splitX = xs.length >= 2 ? (xs[Math.floor(xs.length / 2)] + xs[Math.floor((xs.length - 1) / 2)]) / 2 : Infinity;

        // 3. Tìm tất cả TEXT NODE match pattern NLPC (mạnh hơn leaf-element check)
        //    TreeWalker quét MỌI text node, không bị bypass nếu label wrap trong nested span
        const labels = [];
        const walker = document.createTreeWalker(scopeRoot, NodeFilter.SHOW_TEXT, {
            acceptNode: (n) => {
                const p = n.parentElement;
                if (!p) return NodeFilter.FILTER_REJECT;
                if (p.closest('#cogiao-ai-sidebar')) return NodeFilter.FILTER_REJECT;
                const tag = p.tagName;
                if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        let textNode;
        while ((textNode = walker.nextNode())) {
            const text = textNode.textContent.trim();
            if (!text || text.length > 60) continue;

            const clean = text.replace(/^[*:\s]+|[*:\s]+$/g, '').toLowerCase();
            const fieldKey = this._NLPC_LABEL_MAP[clean];
            if (!fieldKey) continue;

            const labelEl = textNode.parentElement;
            const r = labelEl.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;

            labels.push({
                el: labelEl, text, fieldKey, rect: r,
                centerX: (r.left + r.right) / 2,
                centerY: (r.top + r.bottom) / 2
            });
        }

        console.log(`[VneduAdapter] findNLPCFields: ${visibleTas.length} textarea, ${labels.length} label`,
            labels.map(l => `${l.fieldKey}@(${Math.round(l.rect.left)},${Math.round(l.rect.top)})`));

        // 4. Match label → textarea — score-based, RELAXED constraints
        for (const lbl of labels) {
            let best = null;
            let bestScore = Infinity;

            for (const t of taData) {
                if (t.used) continue;

                // Y-relation: textarea phải nằm dưới hoặc cùng dòng với label
                // (yDiff > 0 = textarea below label; -20 cho phép cùng dòng)
                const yDiff = t.rect.top - lbl.rect.bottom;
                const yDiffCenter = t.rect.top - lbl.rect.top;
                if (yDiffCenter < -30) continue;  // textarea ở TRÊN label nhiều → loại
                if (yDiff > 200) continue;        // textarea quá xa dưới → loại

                // X-relation: cho phép lệch khá rộng (Vnedu padding nhiều)
                const xCenterDist = Math.abs(t.centerX - lbl.centerX);
                if (xCenterDist > 250) continue;  // khác cột hẳn → loại

                // Score: ưu tiên Y-near + X-aligned. Y nặng hơn X.
                const score = Math.max(0, yDiff) * 1.5 + xCenterDist * 0.5;
                if (score < bestScore) {
                    bestScore = score;
                    best = t;
                }
            }

            if (best) {
                best.used = true;
                this._assignNLPCField(result, lbl.fieldKey, best.ta, lbl.centerX, splitX);
            } else {
                console.warn(`[VneduAdapter] không tìm được textarea cho label "${lbl.text}" (${lbl.fieldKey})`);
            }
        }

        const usedCount = taData.filter(t => t.used).length;
        console.log(`[VneduAdapter] mapped ${usedCount}/${visibleTas.length} textarea`, {
            nlc: Object.keys(result.nang_luc_chung.fields),
            nldt: Object.keys(result.nang_luc_dac_thu.fields),
            pc: Object.keys(result.pham_chat.fields)
        });

        return result;
    },

    /**
     * Tìm section header "NĂNG LỰC" và "PHẨM CHẤT" trong form NLPC.
     * Dùng làm anchor để distinguish 2 instance "Nhận xét chung".
     * Trả: { nlc: {rect, centerX, centerY}, pc: {...} }
     */
    _findNLPCSectionHeaders() {
        const headers = { nlc: null, pc: null };
        // NL section header thường viết HOA "NĂNG LỰC", PC là "PHẨM CHẤT"
        // Loại bỏ "Năng lực đặc thù" (chứa "Năng lực" nhưng không phải header chính)
        const allEls = document.querySelectorAll('div, span, h1, h2, h3, h4, td, p, label');
        for (const el of allEls) {
            if (el.children.length > 0) continue;  // leaf only
            if (!this._isInActivePanel(el)) continue;
            const text = (el.textContent || '').trim();
            if (text.length > 30) continue;

            const norm = text.replace(/[:\s]+$/, '').toUpperCase();
            if (!headers.nlc && (norm === 'NĂNG LỰC' || norm === 'NANG LUC')) {
                const r = el.getBoundingClientRect();
                headers.nlc = { rect: r, centerX: (r.left + r.right) / 2, centerY: (r.top + r.bottom) / 2 };
            }
            if (!headers.pc && (norm === 'PHẨM CHẤT' || norm === 'PHAM CHAT')) {
                const r = el.getBoundingClientRect();
                headers.pc = { rect: r, centerX: (r.left + r.right) / 2, centerY: (r.top + r.bottom) / 2 };
            }
        }
        return headers;
    },

    _assignNLPCField(result, fieldKey, ta, labelCenterX, splitX) {
        // "Nhận xét chung" có 2 instance (NL chung + PC chung).
        // Distinguish bằng KHOẢNG CÁCH đến section header "NĂNG LỰC" / "PHẨM CHẤT".
        if (fieldKey === 'nlc_chung') {
            const headers = this._findNLPCSectionHeaders();

            let assignTo = null;
            if (headers.nlc && headers.pc) {
                const distNLC = Math.abs(labelCenterX - headers.nlc.centerX);
                const distPC = Math.abs(labelCenterX - headers.pc.centerX);
                assignTo = distNLC <= distPC ? 'nang_luc_chung' : 'pham_chat';
            } else {
                // Fallback nếu không tìm được header: dùng splitX
                assignTo = labelCenterX > splitX ? 'pham_chat' : 'nang_luc_chung';
            }

            // Nếu slot đã chiếm thì bỏ vào slot còn lại (đảm bảo không mất textarea)
            if (result[assignTo].fields.chung) {
                const other = assignTo === 'nang_luc_chung' ? 'pham_chat' : 'nang_luc_chung';
                if (!result[other].fields.chung) result[other].fields.chung = ta;
            } else {
                result[assignTo].fields.chung = ta;
            }
        } else if (fieldKey === 'nldt_chung') {
            result.nang_luc_dac_thu.fields.chung = ta;
        } else if (['tu_chu_tu_hoc', 'giao_tiep_hop_tac', 'giai_quyet_van_de'].includes(fieldKey)) {
            result.nang_luc_chung.fields[fieldKey] = ta;
        } else if (['ngon_ngu', 'tinh_toan', 'khoa_hoc', 'tham_mi', 'the_chat', 'cong_nghe', 'tin_hoc'].includes(fieldKey)) {
            result.nang_luc_dac_thu.fields[fieldKey] = ta;
        } else if (['yeu_nuoc', 'nhan_ai', 'cham_chi', 'trung_thuc', 'trach_nhiem'].includes(fieldKey)) {
            result.pham_chat.fields[fieldKey] = ta;
        }
    },

    /**
     * Fill 16 (lớp 1-2) hoặc 18 (lớp 3-5) textarea NLPC từ payload do sidebar gửi sang.
     *
     * @param payload {
     *   nang_luc_chung: { chung, tu_chu_tu_hoc, giao_tiep_hop_tac, giai_quyet_van_de },
     *   nang_luc_dac_thu: { chung, ngon_ngu, tinh_toan, khoa_hoc, tham_mi, the_chat,
     *                       cong_nghe?, tin_hoc? },
     *   pham_chat: { chung, yeu_nuoc, nhan_ai, cham_chi, trung_thuc, trach_nhiem }
     * }
     */
    fillNLPCFields(payload) {
        // [NLPC-DBG] V.01 - log payload nhận được
        console.log('[NLPC-DBG] fillNLPCFields ENTRY', {
            expectedHS: payload?._expectedHS,
            payload_summary: {
                nlc_keys: Object.keys(payload?.nang_luc_chung || {}),
                nldt_keys: Object.keys(payload?.nang_luc_dac_thu || {}),
                pc_keys: Object.keys(payload?.pham_chat || {})
            }
        });

        // BUG-005 fix: Verify Vnedu's currently selected HS matches expected
        // Tránh lưu nhầm nhận xét của HS A vào form HS B do click Vnedu row fail
        if (payload && payload._expectedHS) {
            const students = this.getNLPCStudentList();
            const current = students.find(s => s.isSelected);
            if (!current) {
                console.warn('[NLPC-DBG] fillNLPCFields ABORT: no active HS in Vnedu', {
                    expected: payload._expectedHS, totalStudents: students.length
                });
                return {
                    success: 0, failed: 0, detail: [],
                    error: 'no_active_hs',
                    expected: payload._expectedHS,
                    actual: '(không xác định)'
                };
            }
            if (current.hoVaTen !== payload._expectedHS) {
                console.warn('[NLPC-DBG] fillNLPCFields ABORT: HS mismatch', {
                    expected: payload._expectedHS, actual: current.hoVaTen
                });
                return {
                    success: 0, failed: 0, detail: [],
                    error: 'hs_mismatch',
                    expected: payload._expectedHS,
                    actual: current.hoVaTen
                };
            }
        }

        const fields = this.findNLPCFields();
        // [NLPC-DBG] log textarea đã match được cho từng section
        console.log('[NLPC-DBG] findNLPCFields result', {
            nlc_fields: Object.keys(fields.nang_luc_chung.fields),
            nldt_fields: Object.keys(fields.nang_luc_dac_thu.fields),
            pc_fields: Object.keys(fields.pham_chat.fields)
        });

        let success = 0, failed = 0;
        const detail = [];

        for (const sec of ['nang_luc_chung', 'nang_luc_dac_thu', 'pham_chat']) {
            const secPayload = payload[sec] || {};
            const secFields = fields[sec].fields;
            for (const [key, text] of Object.entries(secPayload)) {
                if (!text) continue;
                const ta = secFields[key];
                if (!ta) {
                    failed++;
                    detail.push({ section: sec, key, status: 'no_textarea' });
                    console.warn(`[NLPC-DBG] no_textarea: ${sec}.${key} — không có textarea matching`);
                    continue;
                }
                const ok = this.fillTextarea(ta, text);
                if (ok) {
                    success++;
                    detail.push({ section: sec, key, status: 'ok' });
                } else {
                    failed++;
                    detail.push({ section: sec, key, status: 'fill_failed' });
                    console.warn(`[NLPC-DBG] fill_failed: ${sec}.${key}`);
                }
            }
        }

        console.log(`[NLPC-DBG] fillNLPCFields EXIT — success=${success} failed=${failed}`, detail);
        return { success, failed, detail };
    },

    async silentCacheScores() {
        try {
            if (typeof window.CacheManager === 'undefined') {
                console.warn('[VneduAdapter] CacheManager chưa load — bỏ qua silent cache');
                return { success: false, reason: 'no_cache_manager' };
            }

            const data = this.extractSoNXData();
            if (!data) {
                return { success: false, reason: 'no_data' };
            }

            // Chỉ cache HS có điểm hợp lệ (skip HS chưa nhập điểm)
            const entries = data.students
                .filter(s => s.diem !== null && s.diem !== undefined)
                .map(s => ({ studentId: s.hoVaTen, score: s.diem }));

            if (entries.length === 0) {
                console.log('[VneduAdapter] Silent cache: chưa có HS nào có điểm');
                return { success: true, synced: 0, skipped: [], monKey: data.monKey, className: data.className };
            }

            const result = await window.CacheManager.syncBatch(data.className, data.monRaw, entries);

            console.log(`[VneduAdapter] ✓ Silent cached lớp ${data.className} môn ${data.monKey}: ${result.synced} HS`);
            return {
                success: true,
                synced: result.synced,
                skipped: result.skipped,
                monKey: data.monKey,
                className: data.className
            };
        } catch (e) {
            console.error('[VneduAdapter] silentCacheScores lỗi:', e);
            return { success: false, reason: 'exception', error: e.message };
        }
    }
};

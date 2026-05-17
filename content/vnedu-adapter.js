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

    /**
     * BUG-009 fix: Kiểm tra element nằm trong CARD đang active (không thuộc card cũ
     * bị Ext.js giấu bằng position:absolute; left:-9999px).
     *
     * Khác với _isInActivePanel (chỉ check rect của BẢN THÂN element):
     *   - Walk UP toàn bộ ancestors
     *   - Với mỗi ancestor có kích thước đáng kể (>=100x100), kiểm tra có off-screen không
     *   - Một ancestor lệch trái (rect.right <= 0) → element thuộc card ẩn → false
     *
     * Cần thiết vì Ext.js thường giấu cả CARD ngoài chứ không giấu trực tiếp <select>:
     * <select> ở left:-1000px (textmetrics) bên trong card active vẫn coi là valid;
     * cùng <select> bên trong card ẩn ở left:-9999px thì KHÔNG valid.
     */
    _isInActiveCard(el) {
        if (!el) return false;
        let p = el.parentElement;
        let hops = 0;
        while (p && p !== document.body && hops < 30) {
            hops++;
            const style = window.getComputedStyle(p);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            const r = p.getBoundingClientRect();
            // Chỉ check ancestor "panel-like" có size đáng kể, bỏ qua các wrapper nhỏ
            if (r.width >= 100 && r.height >= 100) {
                if (r.right <= 0) return false;                       // lệch hẳn ra trái
                if (r.left >= window.innerWidth * 3) return false;    // lệch quá xa phải
            }
            p = p.parentElement;
        }
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

        // BUG-010 fix: TRUST marker visibility. Marker qua _findStrictVisibleText_ đã
        // pass _isVisible strict (gồm _isOnTop / elementFromPoint) → window đó đang
        // ACTIVE và TOP. Form active check (_isNLPCFormActive) chỉ dùng để LOG warning,
        // không gate. Lý do: Vnedu có nhiều version DOM khác nhau → form check brittle.
        const nlpcMarker = this._findStrictVisibleText_(/Phẩm chất\s*[-–—]\s*Năng lực ghi học bạ|Năng lực ghi học bạ/i);
        if (nlpcMarker) {
            // BUG-010: Trust marker visibility (đã pass _isVisible strict / _isOnTop).
            // Đổi console.warn → console.log để Chrome không đánh dấu "Lỗi" trong
            // chrome://extensions cho user.
            this._logDetectOnce_('marker NLPC', nlpcMarker, 'nlpc');
            return 'nlpc';
        }

        // V2.0: chấp nhận cả "Nhận xét giữa kỳ" (Giữa HK1/HK2) và "Nhận xét cuối kỳ" (Cuối HK1/HK2)
        const soNXMarker = this._findStrictVisibleText_(/^Nhận xét (cuối|giữa) kỳ$/i);
        if (soNXMarker) {
            this._logDetectOnce_('marker SoNX', soNXMarker, 'so-nhan-xet');
            return 'so-nhan-xet';
        }

        // V.05: XÓA fallback _isSoNXActive / _isNLPCFormActive. Vnedu's save popup mask
        // toàn màn → _isOnTop fail cho mọi element → marker invisible. Khi đó fallback
        // (không check visible) lại bắt được hidden Sổ NX môn 3A cache → trả về so-nhan-xet
        // SAI → sidebar nhảy sang lớp khác. Tốt hơn: trả null, watcher giữ nguyên state cũ.
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

    /**
     * BUG-009 helper: tìm phần tử LEAF đầu tiên VISIBLE chứa text match pattern.
     * Trả về element (khác _findStrictVisibleText_ chỉ trả text string).
     */
    _findVisibleLeafByText_(textOrPattern) {
        const pattern = textOrPattern instanceof RegExp
            ? textOrPattern
            : new RegExp(String(textOrPattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const els = document.querySelectorAll('div, span, h1, h2, h3, h4, td, th, b, strong, a, label, legend, p');
        for (const el of els) {
            if (el.children.length > 0) continue;
            const text = (el.textContent || '').trim();
            if (!text || text.length > 80) continue;
            if (!pattern.test(text)) continue;
            if (!this._isVisible(el)) continue;
            return el;
        }
        return null;
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
     * NLPC active = ≥4 label đặc trưng NLPC VISIBLE leaf (strict _isOnTop check)
     *
     * BUG-010 fix: Cách cũ đếm textarea + walk previousElementSibling tìm label →
     * brittle với Vnedu version có cấu trúc DOM khác (ví dụ NLPC fields render bằng
     * Ext.js component thay vì <textarea> trần). Cách mới đếm leaf elements visible
     * (qua _isVisible strict — pass _isOnTop → loại label của window minimized).
     */
    _isNLPCFormActive() {
        const NLPC_LABELS = [
            'Tự chủ và tự học', 'Giao tiếp và hợp tác', 'GQVĐ', 'Giải quyết vấn đề',
            'Yêu nước', 'Nhân ái', 'Trung thực', 'Trách nhiệm',
            'Ngôn ngữ', 'Tính toán', 'Khoa học', 'Thẩm mĩ', 'Thẩm mỹ', 'Thể chất',
            'Năng lực đặc thù', 'Năng lực chung', 'GQVĐ và sáng tạo'
        ];

        const seen = new Set();
        let labelCount = 0;
        const els = document.querySelectorAll('div, span, label, td, th, b, strong, p, legend');
        for (const el of els) {
            if (el.children.length > 0) continue;
            const text = (el.textContent || '').trim();
            if (!text || text.length > 50) continue;
            // Match label cho phép có/không có colon, có/không space
            for (const label of NLPC_LABELS) {
                if (seen.has(label)) continue;
                if (text === label
                    || text === label + ':'
                    || text === label + ': '
                    || text.replace(/[:：]\s*$/, '') === label) {
                    if (this._isVisible(el)) {
                        seen.add(label);
                        labelCount++;
                        if (labelCount >= 4) return true;
                    }
                    break;
                }
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
        // V2.0: chấp nhận cả "Nhận xét giữa kỳ" lẫn "Nhận xét cuối kỳ"
        const cells = Array.from(document.querySelectorAll('th, td'))
            .filter(el => /Nhận xét (cuối|giữa) kỳ/i.test(el.textContent || ''))
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

    // V.05: Cache getContext result để tránh quét DOM 10k+ elements lặp lại khi
    // watcher fire liên tục trong lúc Vnedu animate.
    _ctxCache: { value: null, time: 0 },
    _CTX_CACHE_MS: 500,

    getContext() {
        // V.05: dùng cache nếu < 500ms
        const cacheNow = Date.now();
        if (this._ctxCache.value && cacheNow - this._ctxCache.time < this._CTX_CACHE_MS) {
            return this._ctxCache.value;
        }

        const ctx = { khoi: '', lop: '', mon: '', hocKy: '', kyDanhGia: '' };

        // BUG-009 v2 PRIMARY: Vnedu Ext.js dùng <input> + combobox ảo, không phải
        // <select>. Tìm <input>/leaf text VISIBLE (qua _isOnTop check via
        // elementFromPoint) khớp pattern lớp/khối/học kỳ. Card ẩn (visibility:hidden,
        // display:none, hoặc nằm dưới z-index) sẽ FAIL _isVisible → bị loại tự nhiên.
        const visibleVals = this._parseContextFromVisibleValues();
        ctx.lop = ctx.lop || visibleVals.lop;
        ctx.khoi = ctx.khoi || visibleVals.khoi;
        ctx.hocKy = ctx.hocKy || visibleVals.hocKy;
        ctx.mon = ctx.mon || visibleVals.mon;

        // BUG-007/008/009 fallback: <select> based detection (cho trường hợp Vnedu
        // version cũ vẫn dùng <select>). Lọc bằng _isInActiveCard.
        if (!ctx.lop || !ctx.mon) {
            const allSelects = Array.from(document.querySelectorAll('select'));
            const activeSelects = allSelects.filter(s => this._isInActiveCard(s));

            for (const sel of activeSelects) {
                const label = this._findLabelFor(sel);
                const value = sel.options[sel.selectedIndex]?.textContent?.trim() || '';
                if (!value) continue;

                const labelLower = label.toLowerCase();
                if (/môn/i.test(labelLower)) ctx.mon = ctx.mon || value;
                else if (/^lớp/i.test(labelLower)) ctx.lop = ctx.lop || value;
                else if (/khối/i.test(labelLower)) ctx.khoi = ctx.khoi || value;
                else if (/học kỳ|^kỳ:/i.test(labelLower)) ctx.hocKy = ctx.hocKy || value;
                else if (/cuối kỳ|giữa kỳ/i.test(value)) ctx.kyDanhGia = ctx.kyDanhGia || value;
            }
        }

        // Fallback: scope theo panel chứa marker visible (NLPC hoặc Sổ NX).
        if (!ctx.lop || !ctx.mon) {
            const scoped = this._parseContextFromActivePanel();
            if (scoped) {
                ctx.lop = ctx.lop || scoped.lop;
                ctx.mon = ctx.mon || scoped.mon;
                ctx.hocKy = ctx.hocKy || scoped.hocKy;
                ctx.khoi = ctx.khoi || scoped.khoi;
            }
        }

        // Fallback cuối: parse innerText nhưng SCOPE theo active card.
        if (!ctx.lop || !ctx.mon) {
            const fallback = this._parseContextFromTextBar();
            if (fallback) {
                ctx.lop = ctx.lop || fallback.lop;
                ctx.mon = ctx.mon || fallback.mon;
                ctx.hocKy = ctx.hocKy || fallback.hocKy;
            }
        }

        // V2.0: Detect kyDanhGia (Giữa kỳ / Cuối kỳ) từ cột marker nếu chưa có.
        //   - GV chọn Giữa kỳ trong Vnedu → cột table thành "Nhận xét giữa kỳ"
        //   - GV chọn Cuối kỳ → "Nhận xét cuối kỳ"
        if (!ctx.kyDanhGia) {
            const marker = this._findStrictVisibleText_(/^Nhận xét (cuối|giữa) kỳ$/i);
            if (marker) {
                if (/giữa/i.test(marker)) ctx.kyDanhGia = 'Giữa kỳ';
                else if (/cuối/i.test(marker)) ctx.kyDanhGia = 'Cuối kỳ';
            }
        }
        // V2.0: Suy ra ky code (ghk1/chk1/ghk2/chk2) để engine pick pool đúng kỳ.
        ctx.kyCode = this.deriveKyCode(ctx.hocKy, ctx.kyDanhGia);

        // [NLPC-DBG] log context cuối cùng + source — chỉ log khi có thay đổi để giảm noise
        const sig = `${ctx.khoi}|${ctx.lop}|${ctx.mon}|${ctx.hocKy}|${ctx.kyDanhGia}|${ctx.kyCode}`;
        if (sig !== this._lastCtxLogSig) {
            this._lastCtxLogSig = sig;
            console.log('[NLPC-DBG] getContext result', ctx, '· primary(visibleVals):', visibleVals);
        }

        // V.05: save cache
        this._ctxCache.value = ctx;
        this._ctxCache.time = Date.now();

        return ctx;
    },

    /**
     * V2.0: Suy ra ky code từ context.
     *   hocKy: "Học kỳ 1" | "Học kỳ 2" | ""
     *   kyDanhGia: "Cuối kỳ" | "Giữa kỳ" | ""
     * Trả 'ghk1' | 'chk1' | 'ghk2' | 'chk2' | null.
     * Fallback: nếu thiếu kyDanhGia mà có hocKy → mặc định 'cuối kỳ' (engine fallback flat pool).
     */
    deriveKyCode(hocKy, kyDanhGia) {
        const isHK1 = /1/.test(hocKy || '');
        const isHK2 = /2/.test(hocKy || '');
        const isGiua = /giữa/i.test(kyDanhGia || '');
        const isCuoi = /cuối/i.test(kyDanhGia || '');
        if (isHK1 && isGiua) return 'ghk1';
        if (isHK1 && isCuoi) return 'chk1';
        if (isHK2 && isGiua) return 'ghk2';
        if (isHK2 && isCuoi) return 'chk2';
        if (isHK1) return 'chk1';
        if (isHK2) return 'chk2';
        return null;
    },

    /**
     * BUG-009 v2: Tìm Lớp/Khối/Học kỳ/Môn bằng cách scan <input>/leaf text VISIBLE
     * khớp pattern. Đây là cách reliable nhất cho Vnedu Ext.js vì:
     *   - Ext.js render dropdown bằng <input readonly> + combobox ảo, value hiển thị
     *     LIVE → input.value của combobox active luôn đúng giá trị đang chọn
     *   - _isVisible dùng _isOnTop (elementFromPoint) → loại element của card ẩn dù
     *     ẩn bằng visibility:hidden, display:none, z-index hoặc left:-9999px
     *
     * Pattern:
     *   - lop: "5C", "1A", ... (số 1-5 + 1 chữ cái)
     *   - khoi: "Khối 5", "Khối 1", ...
     *   - hocKy: "Học kỳ 2", "Học kỳ 1"
     *   - mon: "Toán", "Tiếng Việt", "TNXH", ... (cần label context để khớp đúng)
     */
    _parseContextFromVisibleValues() {
        const result = { lop: '', khoi: '', hocKy: '', mon: '' };

        const patterns = {
            lop: /^[1-5][A-ZĐĂÂÊÔƠƯa-zđăâêôơư][0-9]?$/,
            khoi: /^Kh[ốo]i\s+[1-5]$/i,
            hocKy: /^H[ọo]c\s+k[ỳy]\s+[12]$/i
        };

        // 1. <input> visible với value khớp pattern
        const inputs = document.querySelectorAll('input');
        for (const inp of inputs) {
            const val = (inp.value || '').trim();
            if (!val || val.length > 15) continue;
            for (const key of Object.keys(patterns)) {
                if (result[key]) continue;
                if (!patterns[key].test(val)) continue;
                if (!this._isVisible(inp)) continue;
                result[key] = val;
            }
            if (result.lop && result.khoi && result.hocKy) break;
        }

        // 2. Leaf text element visible với text khớp pattern (Ext.js đôi khi render
        // value bằng <div class="x-btn-inner"> thay vì <input>)
        if (!result.lop || !result.khoi || !result.hocKy) {
            const els = document.querySelectorAll('div, span, td, b, strong, button, a');
            for (const el of els) {
                if (el.children.length > 0) continue;
                const text = (el.textContent || '').trim();
                if (!text || text.length > 15) continue;
                for (const key of Object.keys(patterns)) {
                    if (result[key]) continue;
                    if (!patterns[key].test(text)) continue;
                    if (!this._isVisible(el)) continue;
                    result[key] = text;
                }
                if (result.lop && result.khoi && result.hocKy) break;
            }
        }

        return result;
    },

    /**
     * BUG-008 v2: Scope <select> theo PANEL chứa marker visible.
     *
     * Vnedu Ext.js ẩn panel cũ bằng position:absolute + left:-9999px → innerText vẫn
     * include text panel ẩn (KHÁC với display:none). Vì vậy không thể parse innerText
     * an toàn. Cách clean: tìm marker visible → đi UP ancestor đến panel Ext.js đủ
     * lớn → trong panel đó scope querySelectorAll('select') (panel ẩn không chứa
     * marker visible nên không bị scan).
     */
    _parseContextFromActivePanel() {
        // 1. Tìm marker element NLPC hoặc Sổ NX đang VISIBLE (strict _isOnTop check)
        const patterns = [
            /Phẩm chất\s*[-–—]\s*Năng lực ghi học bạ/i,
            /Năng lực ghi học bạ/i,
            /^Nhận xét (cuối|giữa) kỳ$/i
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

        // 2. Đi UP ancestor tìm PANEL CONTAINER đủ lớn (chứa marker + header Lớp/Khối)
        // Strategy: panel đủ lớn để chứa cả header bar và form body (>= 600x400 px),
        // và KHÔNG nằm ngoài viewport (loại panel cũ left:-9999px).
        let panel = markerEl.parentElement;
        let bestPanel = null;
        while (panel && panel !== document.body) {
            const r = panel.getBoundingClientRect();
            // Panel candidate: đủ lớn + nằm trong/gần viewport
            if (r.width >= 600 && r.height >= 400 && r.right > 0 && r.left < window.innerWidth * 2) {
                // Có chứa select không? Nếu có thì là panel chứa header
                const hasSelect = panel.querySelector('select');
                if (hasSelect) {
                    bestPanel = panel;
                    break;
                }
            }
            panel = panel.parentElement;
        }

        if (!bestPanel) {
            console.log('[NLPC-DBG] _parseContextFromActivePanel: không tìm thấy panel ancestor có select');
            return null;
        }

        // 3. Scope select trong panel active. BUG-009: bestPanel có thể là ancestor
        // chứa CẢ card active (1A) và card ẩn (5A) — Ext.js wrap nhiều cardpanel ở
        // cùng container. Phải filter từng select bằng _isInActiveCard để bỏ select
        // của card ẩn left:-9999px.
        const result = { khoi: '', lop: '', mon: '', hocKy: '' };
        const allSelects = bestPanel.querySelectorAll('select');
        const selects = Array.from(allSelects).filter(s => this._isInActiveCard(s));
        for (const sel of selects) {
            const label = this._findLabelFor(sel);
            const value = sel.options[sel.selectedIndex]?.textContent?.trim() || '';
            if (!value) continue;
            const labelLower = label.toLowerCase();
            if (/môn/i.test(labelLower)) result.mon = result.mon || value;
            else if (/^lớp/i.test(labelLower)) result.lop = result.lop || value;
            else if (/khối/i.test(labelLower)) result.khoi = result.khoi || value;
            else if (/học kỳ|^kỳ:/i.test(labelLower)) result.hocKy = result.hocKy || value;
        }

        // BUG-009 fallback: nếu select trong active card không cho ra kết quả
        // (Ext.js có thể không có <select> ở mọi card), parse innerText của
        // CARD ACTIVE thay vì toàn document. Cần tìm ancestor "card active" sát
        // nhất quanh marker (size đủ chứa header + body, KHÔNG ancestor lớn quá
        // gom luôn card ẩn).
        if (!result.lop || !result.mon || !result.hocKy) {
            const activeCard = this._findActiveCardAround(markerEl);
            if (activeCard) {
                const cardText = activeCard.innerText || '';
                const fromText = this._parseLopKhoiHocKyFromText_(cardText);
                result.lop = result.lop || fromText.lop;
                result.mon = result.mon || fromText.mon;
                result.hocKy = result.hocKy || fromText.hocKy;
                result.khoi = result.khoi || fromText.khoi;
            }
        }

        console.log('[NLPC-DBG] _parseContextFromActivePanel result', {
            panelSize: { w: Math.round(bestPanel.getBoundingClientRect().width), h: Math.round(bestPanel.getBoundingClientRect().height) },
            activeSelectCount: selects.length,
            totalSelectCount: allSelects.length,
            result
        });
        return result;
    },

    /**
     * BUG-009 helper: từ marker visible, đi UP tìm ancestor "card active":
     *   - Là phần tử có rect.width >= 600 (đủ chứa toolbar Lớp/Khối)
     *   - KHÔNG chứa card ẩn nào ở left:-9999px bên trong nó
     *   - Vẫn pass _isInActiveCard (mọi ancestor visible)
     * Đây là ancestor "đủ nhỏ" để innerText chỉ bao trùm card hiện tại.
     */
    _findActiveCardAround(markerEl) {
        if (!markerEl) return null;
        let p = markerEl.parentElement;
        let candidate = null;
        let hops = 0;
        while (p && p !== document.body && hops < 30) {
            hops++;
            const r = p.getBoundingClientRect();
            if (r.width >= 600 && r.height >= 200 && r.right > 0 && r.left < window.innerWidth * 2) {
                // Kiểm tra: ancestor này có bao trùm card ẩn không?
                const hiddenSibling = Array.from(p.querySelectorAll('[id^="ext-"], div, section'))
                    .some(c => {
                        if (c === p) return false;
                        const cr = c.getBoundingClientRect();
                        // Phần tử con đáng kể nằm hẳn bên trái → là card ẩn
                        return cr.width >= 400 && cr.height >= 200 && cr.right <= 0;
                    });
                if (!hiddenSibling) {
                    candidate = p;
                    // tiếp tục đi lên, nếu ancestor lớn hơn cũng "sạch" thì lấy
                } else {
                    // ancestor này đã gom card ẩn → dừng, lấy candidate trước đó
                    break;
                }
            }
            p = p.parentElement;
        }
        return candidate;
    },

    /**
     * BUG-009 helper: parse Lớp / Khối / Học kỳ / Môn từ text string (đã scope sẵn).
     */
    _parseLopKhoiHocKyFromText_(text) {
        const result = { lop: '', khoi: '', hocKy: '', mon: '' };
        if (!text) return result;
        const lopMatch = text.match(/L[ớo]p:\s*([0-9]+[A-Za-zÀ-ỹ]?)/);
        if (lopMatch) result.lop = lopMatch[1];
        const khoiMatch = text.match(/Kh[ốo]i:?\s*(Kh[ốo]i\s*[0-9]+|[0-9]+)/i);
        if (khoiMatch) result.khoi = khoiMatch[1].trim();
        const hkMatch = text.match(/H[ọo]c\s*k[ỳy]\s*([12])/i);
        if (hkMatch) result.hocKy = 'Học kỳ ' + hkMatch[1];
        return result;
    },

    _parseContextFromTextBar() {
        // BUG-009: document.body.innerText INCLUDE text của panel ẩn (Ext.js
        // dùng position:absolute; left:-9999px, KHÔNG dùng display:none) → regex
        // có thể match "Lớp: 5A" stale của card cũ trước "Lớp: 1A" hiện tại.
        // Fix: ưu tiên scope vào active card (tìm qua marker visible). Nếu không
        // có marker (chưa vào NLPC/Sổ NX), fall back document.body.innerText —
        // chấp nhận rủi ro vì lúc này thường ở trang khác chưa cần context lớp.
        let allText = '';
        const marker = this._findStrictVisibleText_(
            /Phẩm chất\s*[-–—]\s*Năng lực ghi học bạ|Năng lực ghi học bạ|^Nhận xét cuối kỳ$/i
        );
        if (marker) {
            // marker là string đã visible; tìm element của nó qua _findStrictVisibleElement_
            const markerEl = this._findVisibleLeafByText_(marker);
            const activeCard = markerEl ? this._findActiveCardAround(markerEl) : null;
            if (activeCard) allText = activeCard.innerText || '';
        }
        if (!allText) allText = document.body.innerText || '';

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

    /**
     * V.05 BUG-011: Tìm window Ext.js chứa marker visible (NLPC hoặc Sổ NX môn).
     * Walk up từ leaf marker để tìm ancestor có class x-window. Trả null nếu không
     * tìm thấy → caller fall back tìm toàn document.
     */
    _findActiveModuleWindow_() {
        // Tìm marker visible (NLPC hoặc Sổ NX)
        let markerEl = this._findVisibleLeafByText_(
            /Phẩm chất\s*[-–—]\s*Năng lực ghi học bạ|Năng lực ghi học bạ/i
        );
        if (!markerEl) {
            markerEl = this._findVisibleLeafByText_(/^Nhận xét (cuối|giữa) kỳ$/i);
        }
        if (!markerEl) return null;

        let el = markerEl;
        for (let i = 0; i < 20; i++) {
            if (!el) break;
            if (el.classList && el.classList.contains('x-window')) return el;
            el = el.parentElement;
        }
        return null;
    },

    findLuuButton() {
        // V.05 BUG-011: Scope tìm "Lưu" vào WINDOW của module đang active (NLPC hoặc
        // Sổ NX môn). Vnedu Ext.js có thể có nhiều window mở cùng lúc, mỗi window có
        // toolbar "Lưu" riêng. Trước đây quét toàn document → click NHẦM nút Lưu của
        // window Sổ điểm thay vì NLPC → Vnedu báo "Đã lưu dữ liệu điểm" + data NLPC
        // không được lưu.
        const moduleWindow = this._findActiveModuleWindow_();
        const searchRoot = moduleWindow || document;

        const all = searchRoot.querySelectorAll('button, input[type="button"], input[type="submit"], a, span, div');
        const candidates = [];

        for (const el of all) {
            if (el.closest('#cogiao-ai-sidebar')) continue;
            if (el.offsetWidth === 0 || el.offsetHeight === 0) continue;
            if (el.disabled) continue;
            if (!this._isInActiveCard(el)) continue;

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

        // Ưu tiên topMost (visible strict)
        candidates.forEach(c => {
            c.topMost = this._isVisible(c.el);
            // V.05: bonus điểm nếu nút nằm trong x-toolbar (header toolbar của window)
            c.inToolbar = !!c.el.closest('.x-toolbar');
        });
        candidates.sort((a, b) => {
            if (a.topMost !== b.topMost) return a.topMost ? -1 : 1;
            if (a.inToolbar !== b.inToolbar) return a.inToolbar ? -1 : 1;
            return b.priority - a.priority;
        });

        if (moduleWindow) {
            console.log(`[VneduAdapter] findLuuButton: scope = window ${moduleWindow.id || '(no-id)'}, ${candidates.length} candidates`);
        } else {
            console.log(`[VneduAdapter] findLuuButton: scope = document (no active module window), ${candidates.length} candidates`);
        }

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
        const textMatch = /Sổ nhận xét|Nhận xét (cuối|giữa) kỳ|Nhận xét môn/i.test(allText) ||
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
     * Form NLPC có 15–18 textarea cho 1 HS (V1.5):
     *   NL chung (4): Nhận xét chung, Tự chủ và tự học, Giao tiếp và hợp tác, GQVĐ
     *   NL đặc thù (5, 7 hoặc 8):
     *     - Lớp 1-2: Nhận xét chung, Ngôn ngữ, Tính toán, Thẩm mĩ, Thể chất (5 ô)
     *     - Lớp 3:   thêm Công nghệ + Tin học (7 ô — vẫn KHÔNG có Khoa học)
     *     - Lớp 4-5: thêm Khoa học (8 ô — CT GDPT 2018: môn Khoa học bắt đầu từ lớp 4)
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
    },

    /* ====================================================================
     * V.05 — Action Launcher: navigate Vnedu Ext.js Start menu programmatically
     * ================================================================== */

    /**
     * Mở module Vnedu bằng cách click theo menu:
     *   Start → Quản lý nhà trường → Quản lý học tập → [Nhập sổ điểm | Phẩm chất - Năng lực ghi học bạ]
     *
     * @param {string} module - 'so-diem' hoặc 'nlpc'
     * @returns {Promise<{success, reason?, missing?, step?}>}
     */
    async openVneduModule(module) {
        // V.05: Hiển thị overlay che animation menu (UX nhẹ nhàng, không "robot")
        const moduleLabel = module === 'nlpc' ? 'Phẩm chất - Năng lực' : 'Sổ nhận xét môn';
        const overlay = this._showLoadingOverlay_(`Đang mở ${moduleLabel}...`);

        try {
            // Step 0: Thử click DESKTOP ICON trước (đơn giản, reliable hơn navigate menu)
            const desktopIcon = this._findDesktopIcon_(module);
            if (desktopIcon) {
                console.log('[VneduAdapter] openVneduModule: tìm thấy desktop icon, dblclick trực tiếp');
                const rect = desktopIcon.getBoundingClientRect();
                const opts = { bubbles: true, cancelable: true, view: window, button: 0, clientX: rect.left + rect.width/2, clientY: rect.top + rect.height/2 };
                desktopIcon.dispatchEvent(new MouseEvent('mousedown', opts));
                desktopIcon.dispatchEvent(new MouseEvent('mouseup', opts));
                desktopIcon.dispatchEvent(new MouseEvent('click', opts));
                desktopIcon.dispatchEvent(new MouseEvent('dblclick', opts));
                await this._sleep_(500);
                return { success: true, via: 'desktop_icon' };
            }

            // Fallback: navigate qua Start menu
            const TARGET_PATH = module === 'nlpc'
                ? ['Quản lý nhà trường', 'Quản lý học tập', 'Phẩm chất - Năng lực ghi học bạ']
                : ['Quản lý nhà trường', 'Quản lý học tập', 'Nhập số điểm'];

            // Bước 0: Click Start button — chỉ làm nếu menu Start chưa mở
            const startMenu = document.getElementById('startmenu_container');
            const startMenuOpen = startMenu && this._isMenuOpen_(startMenu);
            if (!startMenuOpen) {
                const startBtn = this._findStartButton_();
                if (!startBtn) {
                    return { success: false, reason: 'no_start_btn' };
                }
                startBtn.click();
                await this._sleep_(400);
            }

            // Bước 1..N: Hover non-leaf, click leaf
            for (let i = 0; i < TARGET_PATH.length; i++) {
                const text = TARGET_PATH[i];
                const isLeaf = i === TARGET_PATH.length - 1;
                const item = this._findVisibleMenuItem_(text);
                if (!item) {
                    console.warn(`[VneduAdapter] openVneduModule: không tìm thấy "${text}" ở bước ${i + 1}`);
                    return { success: false, reason: 'menu_item_not_found', missing: text, step: i + 1 };
                }

                if (isLeaf) {
                    item.click();
                    await this._sleep_(500);
                } else {
                    const rect = item.getBoundingClientRect();
                    const cx = rect.left + rect.width / 2;
                    const cy = rect.top + rect.height / 2;
                    const opts = { bubbles: true, cancelable: true, view: window, button: 0, clientX: cx, clientY: cy };
                    item.dispatchEvent(new MouseEvent('mousemove', opts));
                    item.dispatchEvent(new MouseEvent('mouseover', opts));
                    item.dispatchEvent(new MouseEvent('mouseenter', opts));
                    await this._sleep_(700);
                }
            }

            console.log(`[VneduAdapter] openVneduModule(${module}) success — đã mở module`);
            return { success: true };
        } catch (e) {
            console.error('[VneduAdapter] openVneduModule lỗi:', e);
            return { success: false, reason: 'exception', error: e.message };
        } finally {
            // Wait nhẹ cho Vnedu render window xong rồi mới gỡ overlay → tránh flash
            await this._sleep_(250);
            this._hideLoadingOverlay_(overlay);
        }
    },

    /**
     * V.05: Overlay full-screen che animation menu Vnedu, hiển thị spinner + message
     * thân thiện. pointer-events: auto chặn user click linh tinh trong lúc automation.
     * Synthetic events vẫn dispatch trực tiếp tới target element nên không bị overlay chặn.
     */
    _showLoadingOverlay_(message) {
        // Inject keyframes nếu chưa có
        if (!document.getElementById('cogiao-spin-kf')) {
            const style = document.createElement('style');
            style.id = 'cogiao-spin-kf';
            style.textContent = '@keyframes cogiaoSpin { to { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }

        const overlay = document.createElement('div');
        overlay.id = 'cogiao-loading-overlay';
        overlay.style.cssText = [
            'position:fixed', 'top:0', 'left:0',
            'width:100vw', 'height:100vh',
            'background:rgba(248,250,252,0.92)',
            'backdrop-filter:blur(2px)',
            '-webkit-backdrop-filter:blur(2px)',
            'z-index:2147483600',  // tối đa, đảm bảo trên mọi window Ext.js
            'display:flex', 'flex-direction:column',
            'align-items:center', 'justify-content:center',
            'gap:18px',
            'font-family:"Segoe UI",Tahoma,Arial,sans-serif',
            'pointer-events:auto',
            'opacity:0',
            'transition:opacity 0.15s ease-out'
        ].join(';');

        overlay.innerHTML = `
            <div style="width:56px;height:56px;border:4px solid #e2e8f0;border-top-color:#2B4F9E;border-radius:50%;animation:cogiaoSpin 0.8s linear infinite"></div>
            <div style="font-size:17px;font-weight:600;color:#0C447C">${message}</div>
            <div style="font-size:13px;color:#64748b">Sổ nhận xét - AI đang điều hướng Vnedu giúp thầy/cô</div>
        `;
        document.body.appendChild(overlay);
        // Fade-in
        requestAnimationFrame(() => { overlay.style.opacity = '1'; });
        return overlay;
    },

    _hideLoadingOverlay_(overlay) {
        if (!overlay || !overlay.parentNode) return;
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 180);
    },

    /**
     * V.05: Tìm desktop icon trên Ext.js Desktop của Vnedu. Trả về element click-able
     * (icon container) cho module. Icon Vnedu render bằng <div class="ux-desktop-shortcut">
     * hoặc tương tự, có text label bên dưới.
     */
    _findDesktopIcon_(module) {
        // Tên icon trên desktop theo module.
        // NLPC: KHÔNG có desktop icon riêng — phải vào qua Start menu
        // (Quản lý nhà trường → Quản lý học tập → Phẩm chất - Năng lực ghi học bạ).
        // Trước đây có thêm "Học bạ số" làm fallback nhưng nó match nhầm icon
        // "Học bạ số - Học bạ điện tử" → mở sai module.
        const targets = module === 'nlpc'
            ? []  // chuyển thẳng qua Start menu nav
            : ['Sổ nhận xét'];  // Sổ NX môn: icon trên desktop

        // Search ALL leaf elements với text khớp, scope desktop area (top of body)
        const els = document.querySelectorAll('div, span, a, td');
        for (const el of els) {
            if (el.children.length > 0) continue;
            const text = (el.textContent || '').trim();
            if (text.length > 50 || text.length < 3) continue;
            // Match exact hoặc startsWith với target
            const matches = targets.some(t => text === t || text.startsWith(t));
            if (!matches) continue;
            const r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) continue;
            const s = window.getComputedStyle(el);
            if (s.display === 'none' || s.visibility === 'hidden') continue;
            // Phải nằm trong viewport (icon desktop visible)
            if (r.top > window.innerHeight - 30 || r.bottom < 30) continue;
            // KHÔNG nằm trong menu (loại false positive từ Start menu)
            if (el.closest('.x-menu, .x-window, #cogiao-ai-sidebar')) continue;
            // Walk up tìm icon container (div cha có hình ảnh + text)
            let icon = el;
            for (let i = 0; i < 4; i++) {
                if (!icon || !icon.parentElement) break;
                const pr = icon.parentElement.getBoundingClientRect();
                if (pr.width >= 50 && pr.width <= 150 && pr.height >= 50 && pr.height <= 150) {
                    icon = icon.parentElement;
                    break;
                }
                icon = icon.parentElement;
            }
            console.log(`[VneduAdapter] _findDesktopIcon_: tìm thấy "${text}"`, icon);
            return icon;
        }
        return null;
    },

    _isMenuOpen_(menuEl) {
        if (!menuEl) return false;
        const s = window.getComputedStyle(menuEl);
        if (s.display === 'none' || s.visibility === 'hidden') return false;
        const r = menuEl.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth;
    },

    /**
     * Tìm nút Start ở góc dưới trái viewport. Vnedu Ext.js Desktop dùng class
     * "ux-start-btn" hoặc tương tự, nhưng để robust em search theo text "Start".
     */
    _findStartButton_() {
        // Strategy 1: class chứa "start"
        const byClass = document.querySelectorAll(
            '.ux-start-btn, [class*="start-btn"], #start_btn, [id*="start_btn"]'
        );
        for (const el of byClass) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && r.top > window.innerHeight - 80) return el;
        }

        // Strategy 2: text "Start" ở góc dưới
        const els = document.querySelectorAll('button, div, span, a, [role="button"]');
        for (const el of els) {
            const text = (el.textContent || '').trim();
            if (text.length > 15) continue;
            if (!/^start$/i.test(text)) continue;
            const r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) continue;
            // Nút Start ở bottom-left: top phải gần bottom của viewport
            if (r.top < window.innerHeight - 80) continue;
            if (r.left > 200) continue;
            return el;
        }
        return null;
    },

    /**
     * Tìm menu item visible khớp text. Scope vào .x-menu visible để tránh false match.
     */
    _findVisibleMenuItem_(targetText) {
        const visibleMenus = Array.from(document.querySelectorAll('.x-menu')).filter(m => this._isMenuOpen_(m));

        // Sort: menu mới mở (top z-index cao) ưu tiên trước
        visibleMenus.sort((a, b) => {
            const za = parseInt(window.getComputedStyle(a).zIndex) || 0;
            const zb = parseInt(window.getComputedStyle(b).zIndex) || 0;
            return zb - za;
        });

        for (const menu of visibleMenus) {
            const candidates = menu.querySelectorAll(
                '.x-menu-item, [role="menuitem"], a.x-menu-item-link, span.x-menu-item-text, .x-menu-item-text-default'
            );
            for (const el of candidates) {
                const text = (el.textContent || '').trim();
                if (text !== targetText && !text.endsWith(targetText)) continue;
                const r = el.getBoundingClientRect();
                if (r.width <= 0 || r.height <= 0) continue;
                // Walk up nếu cần — find clickable container
                let clickable = el;
                for (let depth = 0; depth < 4; depth++) {
                    if (!clickable) break;
                    if (clickable.matches && (
                        clickable.matches('.x-menu-item') ||
                        clickable.matches('[role="menuitem"]')
                    )) {
                        return clickable;
                    }
                    clickable = clickable.parentElement;
                }
                return el;
            }
        }
        return null;
    },

    _sleep_(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

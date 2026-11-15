/**
 * 6.4.0 — Cầu nối "Sổ theo dõi chất lượng" (chạy trong PAGE CONTEXT / main world).
 *
 * Màn vnEdu: cửa sổ ExtJS "[năm học] Sổ theo dõi chất lượng". Bên trái là danh sách học sinh
 * (grid), bên phải là phiếu của MỘT em: 3 ô nhận xét (Môn học và HĐGD; Năng lực; Phẩm chất),
 * kỳ Giữa kỳ / Cuối kỳ có thêm bảng điểm KT, mức XL từng môn. Nút "Lưu" chỉ lưu em đang chọn
 * (gọi edu.so_diem.saveSoChuNhiem, chỉ gửi ô có thay đổi so với attr value0).
 *
 * Việc của cầu nối:
 *   - đẩy trạng thái (lớp, kỳ, danh sách HS) cho content-script;
 *   - READ: lần lượt chọn từng em → đọc bảng điểm + chữ đang có trong 3 ô;
 *   - SAVE: lần lượt chọn từng em → điền 3 ô → bấm Lưu của vnEdu → đọc kết quả.
 *
 * Giao tiếp (window.postMessage):
 *   ra:  __COGIAO_STCL_STATE__ {state}
 *        __COGIAO_STCL_PROGRESS__ {reqId, kind, i, n, item}
 *        __COGIAO_STCL_RESULT__ {reqId, kind, result}
 *   vào: __COGIAO_STCL_ASK__ | __COGIAO_STCL_READ__ {reqId, expect, ids}
 *        __COGIAO_STCL_SAVE__ {reqId, expect, items, overwrite} | __COGIAO_STCL_STOP__
 *        __COGIAO_STCL_OPEN_KY__ {reqId, ky}
 *
 * KHÔNG đọc thông tin đăng nhập. Không đụng ô điểm KT, XL (chỉ đọc).
 */
(function () {
    'use strict';
    if (window.__cogiaoStclBridge) return;
    window.__cogiaoStclBridge = true;

    const TITLE_RE = /Sổ theo dõi chất lượng/i;
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function visible(el) {
        if (!el || !el.isConnected) return false;
        if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }
    function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

    /** Cửa sổ Sổ theo dõi chất lượng đang nằm trên cùng (bỏ qua hộp thông báo nhỏ). */
    function activeWin() {
        try {
            if (!window.Ext || !Ext.ComponentQuery) return null;
            const wins = Ext.ComponentQuery.query('window').filter(w =>
                w.isVisible() && w.el && w.el.dom && visible(w.el.dom) && (w.getWidth ? w.getWidth() > 420 : true));
            if (!wins.length) return null;
            wins.sort((a, b) => (parseInt(b.el.dom.style.zIndex, 10) || 0) - (parseInt(a.el.dom.style.zIndex, 10) || 0));
            return TITLE_RE.test(wins[0].title || '') ? wins[0] : null;
        } catch (e) { return null; }
    }

    function combos(win) {
        try { return Ext.ComponentQuery.query('combobox', win); } catch (e) { return []; }
    }
    function comboBy(win, re) {
        return combos(win).find(c => re.test(clean(c.fieldLabel || ''))) || null;
    }
    function comboText(c) {
        if (!c) return '';
        try { return clean(c.getRawValue()); } catch (e) { return ''; }
    }

    /** "Giữa kỳ 1" → ghk1 … Tháng thì null (tiện ích chỉ làm 4 kỳ đánh giá). */
    function kyCodeOf(text) {
        const t = clean(text).toLowerCase();
        const so = /(\b2\b|\bii\b)\s*$/.test(t) ? 2 : (/(\b1\b|\bi\b)\s*$/.test(t) ? 1 : 0);
        if (/giữa\s*(học\s*)?kỳ|giữa\s*kì/.test(t) && so) return 'ghk' + so;
        if (/cuối\s*(học\s*)?kỳ|cuối\s*kì/.test(t) && so) return 'chk' + so;
        if (/cuối\s*năm/.test(t)) return 'chk2';
        return null;
    }

    function grid(win) {
        try { return Ext.ComponentQuery.query('gridpanel', win)[0] || null; } catch (e) { return null; }
    }

    function students(win) {
        const g = grid(win);
        if (!g || !g.store) return [];
        let nameKey = null;
        try {
            const cols = g.headerCt.getGridColumns();
            const c = cols.find(x => /họ\s*và\s*tên|họ\s*tên/i.test(clean(x.text)));
            nameKey = c && c.dataIndex;
        } catch (e) { /* silent */ }
        return g.store.getRange().map((r, i) => {
            const d = r.data || {};
            let ten = nameKey ? d[nameKey] : '';
            if (!ten) ten = Object.values(d).find(v => typeof v === 'string' && /\s/.test(v) && /[A-Za-zÀ-ỹ]/.test(v)) || '';
            return { id: String(d.id != null ? d.id : r.getId()), stt: i + 1, ten: clean(ten) };
        });
    }

    function hidden(win, name) {
        const el = win.el.dom.querySelector('input[name="' + name + '"]');
        return el ? String(el.value || '') : '';
    }

    function quyenNhap(win) {
        const t = clean(win.el.dom.innerText || '');
        const m = t.match(/Quyền hạn:\s*([^\n]{0,60}?)(?:\s{2,}|$|Thời gian)/i);
        if (/không có quyền/i.test(t)) return false;
        if (m && /có quyền nhập/i.test(m[1])) return true;
        return /có quyền nhập/i.test(t);
    }

    function readState() {
        const win = activeWin();
        if (!win) return { active: false };
        const thang = comboBy(win, /^Tháng/i);
        const thangText = comboText(thang);
        let tCode = '';
        try {
            const rec = thang && thang.store.findRecord('id', thang.getValue());
            tCode = rec ? String(rec.get('t') || '') : '';
        } catch (e) { /* silent */ }
        const khoiC = comboBy(win, /khối/i);
        const lopC = comboBy(win, /lớp/i);
        const hk = comboBy(win, /học\s*kỳ/i);
        const khoi = parseInt(hidden(win, 'iKhoi') || (comboText(khoiC).match(/\d/) || [''])[0], 10) || null;
        return {
            active: true,
            lop: comboText(lopC),
            lopId: hidden(win, 'iLopId'),
            khoi,
            hocKy: comboText(hk),
            gv: comboText(comboBy(win, /giáo\s*viên/i)),
            thangText,
            tCode,
            ky: kyCodeOf(thangText),
            quyenNhap: quyenNhap(win),
            curId: hidden(win, 'iHocSinhId'),
            students: students(win),
            busy: !!running
        };
    }

    function signature(s) {
        if (!s.active) return 'off';
        return [s.lop, s.lopId, s.thangText, s.hocKy, s.gv, s.quyenNhap ? 1 : 0, s.students.length,
            s.students.map(x => x.id).join(',').length, s.busy ? 1 : 0].join('|');
    }

    let lastSig = null;
    function push(force) {
        let s;
        try { s = readState(); } catch (e) { s = { active: false }; }
        const sig = signature(s);
        if (!force && sig === lastSig) return;
        lastSig = sig;
        s.sig = sig;
        try { window.postMessage({ type: '__COGIAO_STCL_STATE__', state: s }, '*'); } catch (e) { /* silent */ }
    }
    setInterval(() => { if (!document.hidden) push(false); }, 1500);

    function sameContext(s, expect) {
        if (!s.active || !expect) return false;
        return s.lop === expect.lop && s.thangText === expect.thangText;
    }

    // ---------- phiếu của một học sinh ----------
    const BOX_CLASS = ['nhanxet_sochunhiem', 'nhanxet_nangluc_sochunhiem', 'nhanxet_phamchat_sochunhiem'];

    function boxes(win, hsId) {
        const tas = [...win.el.dom.querySelectorAll('textarea')]
            .filter(t => !hsId || String(t.name || '').indexOf('txt_' + hsId + '_') === 0);
        const out = BOX_CLASS.map(cls => tas.find(t => t.classList.contains(cls)) || null);
        // dự phòng: tên ô kết thúc _0/_1/_2
        for (let k = 0; k < 3; k++) {
            if (!out[k]) out[k] = tas.find(t => new RegExp('_' + k + '$').test(t.name || '')) || null;
        }
        return out;
    }

    function maskShown(win) {
        return [...win.el.dom.querySelectorAll('.x-mask, .ext-el-mask')].some(visible);
    }

    function cellVal(td) {
        if (!td) return '';
        const inp = td.querySelector('input, select');
        return clean(inp ? inp.value : td.innerText);
    }

    /** Bảng điểm giữa kỳ / cuối kỳ: [{mon, kt, xl}] — đọc số, chữ đang hiện (kể cả trong ô nhập). */
    function readScores(win) {
        const out = [];
        const tables = [...win.el.dom.querySelectorAll('table')].filter(t => /Môn học/i.test(t.innerText || '') && /(KT|XL)/.test(t.innerText || ''));
        // lấy bảng trong cùng có dòng tiêu đề "Môn học"
        const tb = tables.sort((a, b) => a.querySelectorAll('table').length - b.querySelectorAll('table').length)[0];
        if (!tb) return out;
        let kIdx = -1, xIdx = -1, nHead = 0;
        for (const tr of tb.rows) {
            const cells = [...tr.cells].map(c => clean(c.innerText));
            if (cells.some(c => /^Môn học$/i.test(c))) {
                // Cuối kỳ có thể hiện cả cột giữa kỳ → lấy cột KT, XL cuối cùng (kỳ đang mở)
                cells.forEach((c, j) => { if (/^KT/i.test(c)) kIdx = j; if (/^XL/i.test(c)) xIdx = j; });
                nHead = cells.length;
                continue;
            }
            if (cells.length < 3 || !/^\d+$/.test(cells[0]) || !cells[1]) continue;
            let kt = '', xl = '';
            if (nHead && tr.cells.length === nHead) {
                kt = kIdx >= 0 ? cellVal(tr.cells[kIdx]) : '';
                xl = xIdx >= 0 ? cellVal(tr.cells[xIdx]) : '';
            } else {
                // tiêu đề gộp ô (colspan) → lấy 2 ô nhập cuối dòng: [KT, XL] của kỳ đang mở
                const inps = [...tr.querySelectorAll('input[type="text"], input:not([type])')].map(x => clean(x.value));
                if (inps.length >= 2) { kt = inps[inps.length - 2]; xl = inps[inps.length - 1]; }
                else if (inps.length === 1) { if (/^\d/.test(inps[0])) kt = inps[0]; else xl = inps[0]; }
            }
            out.push({ mon: cells[1], kt, xl: xl.toUpperCase() });
        }
        return out;
    }

    function readForm(win, hsId) {
        const b = boxes(win, hsId);
        return {
            texts: b.map(t => (t ? String(t.value || '') : null)),
            max: b.map(t => (t && t.maxLength > 0 ? t.maxLength : 500)),
            scores: readScores(win)
        };
    }

    function msgBoxes(win) {
        try {
            return Ext.ComponentQuery.query('window').filter(w => w !== win && w.isVisible() && w.el && w.el.dom && visible(w.el.dom)
                && (!w.getWidth || w.getWidth() <= 620));
        } catch (e) { return []; }
    }
    function closeMsg(win) {
        let closed = '';
        for (const m of msgBoxes(win)) {
            const tx = clean(m.el.dom.innerText || '');
            if (!/Thông báo|Lỗi|Error/i.test(tx) && !(Ext.Msg && m === Ext.Msg)) continue;
            closed = tx;
            try {
                if (Ext.Msg && (m === Ext.Msg || m.id === Ext.Msg.id)) Ext.Msg.hide(); else m.close();
            } catch (e) { /* silent */ }
        }
        return closed;
    }

    /** Chọn một em trên danh sách → chờ phiếu của em đó hiện xong. */
    async function selectStudent(win, hsId) {
        const g = grid(win);
        if (!g) return { ok: false, error: 'no_grid' };
        const rec = g.store.getRange().find(r => String(r.data && r.data.id != null ? r.data.id : r.getId()) === String(hsId));
        if (!rec) return { ok: false, error: 'no_student' };
        const already = hidden(win, 'iHocSinhId') === String(hsId) && boxes(win, hsId)[0];
        if (!already) {
            try { g.getView().focusRow && g.getView().focusRow(rec); } catch (e) { /* silent */ }
            try { g.getSelectionModel().select(rec); } catch (e) { return { ok: false, error: 'select_failed' }; }
        }
        for (let i = 0; i < 60; i++) {
            await sleep(i < 4 ? 120 : 200);
            if (activeWin() !== win) return { ok: false, error: 'window_changed' };
            if (hidden(win, 'iHocSinhId') === String(hsId) && boxes(win, hsId)[0] && !maskShown(win)) {
                await sleep(80);
                return { ok: true };
            }
        }
        return { ok: false, error: 'load_timeout' };
    }

    function setTextarea(ta, value) {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        setter.call(ta, value);
        ['input', 'change', 'keyup', 'blur'].forEach(t => {
            const ev = t === 'keyup' ? new KeyboardEvent(t, { bubbles: true }) : new Event(t, { bubbles: true });
            ta.dispatchEvent(ev);
        });
        return ta.value === value;
    }

    // Bắt kết quả lệnh lưu của vnEdu (chỉ trong lúc tiện ích đang lưu).
    let lastSave = null;
    let ajaxGoc = null;
    function hookAjax() {
        const jq = window.jQuery || window.$;
        if (!jq || !jq.ajax || ajaxGoc) return;
        ajaxGoc = jq.ajax;
        jq.ajax = function (opts) {
            try {
                const o = (typeof opts === 'object' && opts) || arguments[1] || {};
                const url = String((typeof opts === 'string' ? opts : o.url) || '');
                if (/saveSoChuNhiem/i.test(url)) {
                    const ok0 = o.success, er0 = o.error;
                    o.success = function (rs) {
                        lastSave = { ok: true, rs, t: Date.now() };
                        if (ok0) return ok0.apply(this, arguments);
                    };
                    o.error = function (xhr, st) {
                        lastSave = { ok: false, http: xhr && xhr.status, st, t: Date.now() };
                        if (er0) return er0.apply(this, arguments);
                    };
                }
            } catch (e) { /* silent */ }
            return ajaxGoc.apply(this, arguments);
        };
    }
    function unhookAjax() {
        const jq = window.jQuery || window.$;
        if (jq && ajaxGoc) jq.ajax = ajaxGoc;
        ajaxGoc = null;
    }

    function saveBtn(win) {
        try {
            return Ext.ComponentQuery.query('button', win).find(b => b.isVisible() && /^\s*Lưu\s*$/.test(b.text || '')) || null;
        } catch (e) { return null; }
    }

    async function saveOne(win, item, overwrite) {
        const sel = await selectStudent(win, item.id);
        if (!sel.ok) return { id: item.id, ok: false, error: sel.error };
        const b = boxes(win, item.id);
        let changed = 0;
        const skipped = [];
        for (let k = 0; k < 3; k++) {
            const want = item.texts && item.texts[k];
            if (want == null || !String(want).trim()) continue;
            const ta = b[k];
            if (!ta) { return { id: item.id, ok: false, error: 'no_box' }; }
            if (ta.readOnly || ta.disabled) return { id: item.id, ok: false, error: 'read_only' };
            const cur = String(ta.value || '');
            let v = String(want);
            const max = ta.maxLength > 0 ? ta.maxLength : 500;
            if (v.length > max) v = v.slice(0, max);
            if (cur.trim() && !overwrite) { skipped.push(k); continue; }
            if (cur === v) continue;
            if (!setTextarea(ta, v)) return { id: item.id, ok: false, error: 'set_failed' };
            changed++;
        }
        if (!changed) return { id: item.id, ok: true, unchanged: true, skipped };

        const btn = saveBtn(win);
        if (!btn || btn.disabled) return { id: item.id, ok: false, error: 'no_save_button' };
        closeMsg(win);
        lastSave = null;
        const t0 = Date.now();
        try { btn.el.dom.click(); } catch (e) { return { id: item.id, ok: false, error: 'click_failed' }; }
        for (let i = 0; i < 75; i++) {
            await sleep(200);
            if (lastSave && lastSave.t >= t0) break;
            // vnEdu từ chối ngay (sửa dữ liệu GV khác, chưa chọn GV) → hiện hộp thông báo, không gửi
            if (i >= 6 && !lastSave) {
                const m = msgBoxes(win).map(w => clean(w.el.dom.innerText || '')).find(t => /không được|phải chọn|chưa chọn/i.test(t));
                if (m) { closeMsg(win); return { id: item.id, ok: false, error: 'vnedu_refused', message: m.slice(0, 160), fatal: true }; }
            }
        }
        if (!lastSave) { await sleep(300); closeMsg(win); return { id: item.id, ok: false, error: 'save_timeout' }; }
        await sleep(250);
        const msg = closeMsg(win);
        const rs = lastSave.rs || {};
        const rsMsg = clean(typeof rs === 'object' ? (rs.msg || rs.message || '') : String(rs));
        if (!lastSave.ok) return { id: item.id, ok: false, error: 'http_' + (lastSave.http || 'loi'), message: msg.slice(0, 160) };
        const bad = (rs && (rs.success === false || rs.success === 'false')) || /lỗi|không thành công|thất bại|error/i.test(rsMsg);
        // đối chiếu: ô đã nhận chữ mới
        const after = boxes(win, item.id);
        const daGhi = after.every((ta, k) => {
            const want = item.texts && item.texts[k];
            if (!ta || want == null || !String(want).trim() || skipped.includes(k)) return true;
            return clean(ta.value) === clean(String(want).slice(0, ta.maxLength > 0 ? ta.maxLength : 500));
        });
        // Đã lưu thật → đánh dấu ô là "đã lưu" để khi đóng cửa sổ không bị coi là còn dữ liệu chưa lưu
        if (!bad && daGhi) after.forEach(ta => { if (ta) ta.defaultValue = ta.value; });
        return { id: item.id, ok: !bad && daGhi, changed, skipped, message: (rsMsg || msg).slice(0, 160) };
    }

    // ---------- chạy cả lớp ----------
    let running = null;   // {reqId, kind, stop}

    function progress(reqId, kind, i, n, item) {
        try { window.postMessage({ type: '__COGIAO_STCL_PROGRESS__', reqId, kind, i, n, item }, '*'); } catch (e) { /* silent */ }
    }

    async function runRead(reqId, expect, ids) {
        const win = activeWin();
        const s = readState();
        if (!sameContext(s, expect)) return { ok: false, error: 'context_changed' };
        const list = ids && ids.length ? s.students.filter(x => ids.includes(x.id)) : s.students;
        const items = [];
        for (let i = 0; i < list.length; i++) {
            if (running.stop) return { ok: true, stopped: true, items };
            if (activeWin() !== win) return { ok: false, error: 'window_changed', items };
            const st = list[i];
            const sel = await selectStudent(win, st.id);
            const it = sel.ok ? Object.assign({ id: st.id, ten: st.ten, stt: st.stt, ok: true }, readForm(win, st.id))
                : { id: st.id, ten: st.ten, stt: st.stt, ok: false, error: sel.error };
            items.push(it);
            progress(reqId, 'read', i + 1, list.length, it);
        }
        return { ok: true, items };
    }

    async function runSave(reqId, expect, items, overwrite) {
        const win = activeWin();
        const s = readState();
        if (!sameContext(s, expect)) return { ok: false, error: 'context_changed' };
        if (!s.quyenNhap) return { ok: false, error: 'no_permission' };
        const out = [];
        hookAjax();
        try {
            for (let i = 0; i < items.length; i++) {
                if (running.stop) return { ok: true, stopped: true, items: out };
                if (activeWin() !== win) return { ok: false, error: 'window_changed', items: out };
                let r;
                try { r = await saveOne(win, items[i], !!overwrite); } catch (e) { r = { id: items[i].id, ok: false, error: 'exception', message: String(e && e.message || e) }; }
                out.push(r);
                progress(reqId, 'save', i + 1, items.length, r);
                if (r.fatal) return { ok: false, error: r.error, message: r.message, items: out };
                // 3 em liền lỗi mạng/hết giờ → dừng, tránh lưu dở dang hàng loạt
                const tail = out.slice(-3);
                if (tail.length === 3 && tail.every(x => !x.ok && /timeout|http_/.test(x.error || ''))) {
                    return { ok: false, error: 'many_failures', items: out };
                }
            }
        } finally { unhookAjax(); }
        return { ok: true, items: out };
    }

    async function openKy(ky) {
        const win = activeWin();
        if (!win) return { ok: false, error: 'no_window' };
        if (readState().ky === ky) return { ok: true, already: true };
        const c = comboBy(win, /^Tháng/i);
        if (!c) return { ok: false, error: 'no_combo' };
        const timKy = () => c.store.getRange().find(r => kyCodeOf(r.get('value') || r.get('ten') || '') === ky);
        let rec = timKy();
        if (!rec) {
            // Giữa kỳ 2, Cuối kỳ 2 chỉ có khi ô Học kỳ là "Học kỳ 2" → đổi Học kỳ trước
            const hk = comboBy(win, /học\s*kỳ/i);
            const can = /2$/.test(ky) ? 2 : 1;
            const hkRec = hk && hk.store.getRange().find(r => String(r.get('id')) === String(can));
            if (!hkRec) return { ok: false, error: 'not_in_list' };
            try { hk.setValue(hkRec.get('id')); hk.fireEvent('select', hk, [hkRec]); } catch (e) { return { ok: false, error: 'select_failed' }; }
            for (let i = 0; i < 30 && !rec; i++) { await sleep(200); rec = timKy(); }
            if (!rec) return { ok: false, error: 'not_in_list' };
            await sleep(300);
        }
        try {
            c.setValue(rec.get('id'));
            c.fireEvent('select', c, [rec]);
        } catch (e) { return { ok: false, error: 'select_failed' }; }
        for (let i = 0; i < 25; i++) {
            await sleep(200);
            if (readState().ky === ky && !maskShown(win)) { lastSig = null; push(true); return { ok: true }; }
        }
        return { ok: false, error: 'not_opened' };
    }

    function reply(reqId, kind, result) {
        lastSig = null;
        push(true);
        window.postMessage({ type: '__COGIAO_STCL_RESULT__', reqId, kind, result }, '*');
    }

    /** 6.4.0: đóng các cửa sổ vnEdu đang mở (trước khi mở việc mới) cho máy đỡ nặng.
     *  Cửa sổ còn dữ liệu CHƯA LƯU thì giữ lại, báo tên cho thanh bên. */
    function chuaLuu(w) {
        try {
            const dom = w.el && w.el.dom;
            if (dom) {
                const els = dom.querySelectorAll('textarea, input[type=text], input:not([type])');
                for (const el of els) {
                    if (el.classList.contains('x-form-field') || el.readOnly || el.disabled) continue;
                    const goc = el.hasAttribute('value0') ? el.getAttribute('value0') : el.defaultValue;
                    if ((el.value || '').trim() !== (goc || '').trim()) return true;
                }
            }
            const grids = Ext.ComponentQuery.query('grid', w);
            return grids.some(g => g.store && g.store.getModifiedRecords && g.store.getModifiedRecords().length > 0);
        } catch (e) { return false; }
    }
    function dongCuaSo(giuTrenCung) {
        const giu = [], dong = [];
        try {
            if (!window.Ext || !Ext.ComponentQuery) return { ok: false, giu, dong };
            const wins = Ext.ComponentQuery.query('window').filter(w =>
                !w.isDestroyed && w.el && w.el.dom && (w.getWidth ? w.getWidth() > 420 : true) &&
                !(Ext.Msg && w === Ext.Msg) && !/messagebox/i.test(w.xtype || ''));
            // Việc đang làm chính là việc vừa bấm Mở → giữ cửa sổ trên cùng (không mất lớp đã chọn)
            const tren = giuTrenCung ? wins.filter(w => w.isVisible()).sort((a, b) =>
                (parseInt(b.el.dom.style.zIndex, 10) || 0) - (parseInt(a.el.dom.style.zIndex, 10) || 0))[0] : null;
            for (const w of wins) {
                if (w === tren) continue;
                const ten = clean(w.title || '');
                if (chuaLuu(w)) { giu.push(ten); continue; }
                try { w.close(); dong.push(ten); } catch (e) { giu.push(ten); }
            }
        } catch (e) { /* bỏ qua */ }
        return { ok: true, giu, dong };
    }

    window.addEventListener('message', async (ev) => {
        if (ev.source !== window || !ev.data || typeof ev.data.type !== 'string') return;
        const d = ev.data;
        if (d.type === '__COGIAO_CLOSE_WINS__') {
            const r = running ? { ok: false, busy: true, giu: [], dong: [] } : dongCuaSo(!!d.giuTrenCung);
            window.postMessage({ type: '__COGIAO_CLOSE_WINS_DONE__', reqId: d.reqId, result: r }, '*');
            return;
        }
        if (d.type === '__COGIAO_STCL_ASK__') { lastSig = null; push(true); return; }
        if (d.type === '__COGIAO_STCL_STOP__') { if (running) running.stop = true; return; }
        if (d.type === '__COGIAO_STCL_OPEN_KY__') {
            let result;
            try { result = await openKy(String(d.ky || '')); } catch (e) { result = { ok: false, error: 'exception' }; }
            reply(d.reqId, 'open', result);
            return;
        }
        if (d.type === '__COGIAO_STCL_READ__' || d.type === '__COGIAO_STCL_SAVE__') {
            const kind = d.type === '__COGIAO_STCL_READ__' ? 'read' : 'save';
            if (running) { reply(d.reqId, kind, { ok: false, error: 'busy' }); return; }
            running = { reqId: d.reqId, kind, stop: false };
            lastSig = null; push(true);
            let result;
            try {
                result = kind === 'read' ? await runRead(d.reqId, d.expect, d.ids)
                    : await runSave(d.reqId, d.expect, d.items || [], d.overwrite);
            } catch (e) { result = { ok: false, error: 'exception', message: String(e && e.message || e) }; }
            running = null;
            reply(d.reqId, kind, result);
        }
    });
})();

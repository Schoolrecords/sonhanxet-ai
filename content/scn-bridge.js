/**
 * 6.3.0 — Cầu nối Sổ chủ nhiệm (chạy trong PAGE CONTEXT / main world).
 *
 * Sổ chủ nhiệm trên vnEdu là cửa sổ ExtJS "Quản lý sổ chủ nhiệm cấp Tiểu học: <mục>" (Mẫu 1)
 * hoặc "Quản lý sổ chủ nhiệm(mẫu 2): <mục>" (Mẫu 2). Mẫu 2 dùng khung soạn thảo CKEditor 4,
 * chỉ đọc/ghi được từ main world → mọi việc đọc, ghi ô của sổ chủ nhiệm làm ở đây.
 *
 * Giao tiếp với content-script bằng window.postMessage:
 *   ra:  __COGIAO_SCN_STATE__        {state}       (tự đẩy khi màn hình đổi)
 *        __COGIAO_SCN_FILL_RESULT__  {reqId, result}
 *        __COGIAO_SCN_SAVE_RESULT__  {reqId, result}
 *   vào: __COGIAO_SCN_ASK__ | __COGIAO_SCN_FILL__ {reqId, payload} | __COGIAO_SCN_SAVE__ {reqId, expect}
 *
 * KHÔNG đọc thông tin đăng nhập. Chỉ đọc chữ, số trong cửa sổ sổ chủ nhiệm đang mở.
 */
(function () {
    'use strict';
    if (window.__cogiaoScnBridge) return;
    window.__cogiaoScnBridge = true;

    const TITLE_RE = /^Quản lý sổ chủ nhiệm/i;

    function visible(el) {
        if (!el || !el.isConnected) return false;
        if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }

    /** Cửa sổ sổ chủ nhiệm đang nằm trên cùng (bỏ qua hộp thông báo nhỏ). */
    function activeWin() {
        try {
            if (!window.Ext || !Ext.ComponentQuery) return null;
            const wins = Ext.ComponentQuery.query('window').filter(w =>
                w.isVisible() && w.el && w.el.dom && visible(w.el.dom) && (w.getWidth ? w.getWidth() > 420 : true));
            if (!wins.length) return null;
            wins.sort((a, b) => (parseInt(b.el.dom.style.zIndex, 10) || 0) - (parseInt(a.el.dom.style.zIndex, 10) || 0));
            const top = wins[0];
            return TITLE_RE.test(top.title || '') ? top : null;
        } catch (e) { return null; }
    }

    function rawOf(win, name) {
        try {
            const f = Ext.ComponentQuery.query('[name=' + name + ']', win).find(c => c.isVisible && c.isVisible());
            if (f) return String(f.getRawValue ? f.getRawValue() : (f.getValue ? f.getValue() : '') || '').trim();
        } catch (e) { /* silent */ }
        const el = [...win.el.dom.querySelectorAll('[name="' + name + '"]')].find(visible);
        return el ? String(el.value || '').trim() : '';
    }

    function cleanLabel(s) {
        return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    }

    /** Chữ tiêu đề nằm ngay trước ô (bỏ thanh công cụ CKEditor). */
    function labelBefore(el, stopAt) {
        let e = el;
        for (let k = 0; k < 12 && e && e !== stopAt; k++) {
            let s = e.previousElementSibling;
            while (s) {
                const tx = (s.innerText || '').trim();
                if (tx && !/^(Định dạng|Cỡ chữ|Số đoạn)/.test(tx)) {
                    const lines = tx.split('\n').map(x => x.trim()).filter(Boolean)
                        .filter(x => !/^(Định dạng|Cỡ chữ|Số đoạn)/.test(x));
                    if (lines.length) return cleanLabel(lines.slice(-1)[0]);
                }
                s = s.previousElementSibling;
            }
            e = e.parentElement;
        }
        return '';
    }

    function rowLabel(el) {
        const tr = el.closest && el.closest('tr');
        if (!tr || !tr.cells || !tr.cells.length) return '';
        return cleanLabel(tr.cells[0].innerText);
    }

    function ckInstancesIn(win) {
        if (!window.CKEDITOR || !CKEDITOR.instances) return [];
        return Object.values(CKEDITOR.instances).filter(i => {
            try {
                const c = i.container && i.container.$;
                return c && win.el.dom.contains(c) && visible(c);
            } catch (e) { return false; }
        });
    }

    function htmlToText(html) {
        const d = document.createElement('div');
        d.innerHTML = String(html || '').replace(/<\/(p|div|li|h\d)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n');
        return (d.textContent || '').replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    }

    /**
     * Danh sách ô chữ của mục đang mở. key ổn định: <tên ô>#<thứ tự trong cùng tên>.
     * kind 'ck' = khung CKEditor, 'ta' = ô chữ thường.
     */
    function listFields(win) {
        const out = [];
        const seen = {};
        const nextKey = (base) => { seen[base] = (seen[base] || 0); return base + '#' + (seen[base]++); };

        const cks = ckInstancesIn(win);
        const ckEls = new Set(cks.map(i => i.element && i.element.$).filter(Boolean));
        for (const inst of cks) {
            const el = inst.element.$;
            const base = el.name || el.id || inst.name;
            out.push({
                key: nextKey(base), kind: 'ck', ref: inst.name, name: el.name || '',
                label: labelBefore(inst.container.$, win.el.dom),
                rowLabel: rowLabel(inst.container.$),
                value: htmlToText(inst.getData()),
                readOnly: !!inst.readOnly,
                maxLength: 65535
            });
        }
        const tas = [...win.el.dom.querySelectorAll('textarea')].filter(t => !ckEls.has(t) && visible(t));
        for (const ta of tas) {
            const base = ta.name || ta.id || 'ta';
            out.push({
                key: nextKey(base), kind: 'ta', ref: '', name: ta.name || '', id: ta.id || '',
                label: labelBefore(ta, win.el.dom),
                rowLabel: rowLabel(ta),
                value: String(ta.value || ''),
                readOnly: ta.readOnly || ta.disabled,
                maxLength: ta.maxLength > 0 ? ta.maxLength : 0
            });
        }
        return out;
    }

    function findField(win, key) {
        return listFields(win).find(f => f.key === key) || null;
    }

    function fieldElement(win, f) {
        if (f.kind === 'ck') return (window.CKEDITOR && CKEDITOR.instances[f.ref]) || null;
        const base = f.key.replace(/#\d+$/, '');
        const idx = parseInt(f.key.split('#').pop(), 10) || 0;
        const ckEls = new Set(ckInstancesIn(win).map(i => i.element && i.element.$));
        const tas = [...win.el.dom.querySelectorAll('textarea')]
            .filter(t => !ckEls.has(t) && visible(t) && (t.name || t.id || 'ta') === base);
        return tas[idx] || null;
    }

    /** Các ô số (input) có tên — lấy giá trị ô đầu tiên của mỗi tên. */
    function readNumbers(win) {
        const nums = {};
        [...win.el.dom.querySelectorAll('input')].forEach(i => {
            if (!i.name || i.type === 'hidden' || !visible(i)) return;
            if (i.closest('table') && /^(nl_|pc_|\d+$)/.test(i.name)) return;   // ô bảng kết quả đọc riêng
            if (nums[i.name] !== undefined) return;
            nums[i.name] = String(i.value || '').trim();
        });
        return nums;
    }

    /** Các ô ngày/thời gian từng dòng của bảng kế hoạch tuần. */
    function readWeekRows(win) {
        const rows = [];
        [...win.el.dom.querySelectorAll('tr')].forEach(tr => {
            if (!visible(tr)) return;
            const ta = tr.querySelector('textarea[name="ke_hoach"]');
            if (!ta) return;
            const bd = tr.querySelector('input[name="bat_dau"]');
            const kt = tr.querySelector('input[name="ket_thuc"]');
            rows.push({
                label: cleanLabel(tr.cells[0] && tr.cells[0].innerText),
                batDau: bd ? String(bd.value || '').trim() : '',
                ketThuc: kt ? String(kt.value || '').trim() : ''
            });
        });
        return rows;
    }

    /** Hàng tiêu đề "lá" của bảng (gộp ô có colspan). */
    function leafHeaders(table) {
        const headRows = [...table.rows].filter(tr => !tr.querySelector('input'));
        if (!headRows.length) return [];
        const grid = [];
        headRows.forEach((tr, r) => {
            grid[r] = grid[r] || [];
            let c = 0;
            [...tr.cells].forEach(td => {
                while (grid[r][c]) c++;
                const cs = td.colSpan || 1, rs = td.rowSpan || 1;
                for (let dr = 0; dr < rs; dr++) {
                    grid[r + dr] = grid[r + dr] || [];
                    for (let dc = 0; dc < cs; dc++) {
                        grid[r + dr][c + dc] = { text: cleanLabel(td.innerText), leaf: cs === 1 };
                    }
                }
                c += cs;
            });
        });
        const width = Math.max(...grid.map(r => r.length));
        const leaves = [];
        for (let c = 0; c < width; c++) {
            let t = '';
            for (let r = grid.length - 1; r >= 0; r--) {
                const cell = grid[r] && grid[r][c];
                if (cell && cell.text) { t = cell.text; break; }
            }
            leaves.push(t);
        }
        return leaves;
    }

    /**
     * Bảng kết quả (Sơ kết HKI, Tổng kết năm): trả {kind:'nlpc'|'mon', cols:[...], rows:{nhãn:[số]}}.
     * Hàng "Tỷ lệ" gắn vào hàng ngay trên: "Tốt%".
     */
    function readResultTables(win) {
        const out = [];
        [...win.el.dom.querySelectorAll('table')].forEach(tb => {
            if (!visible(tb) || !tb.querySelector('input')) return;
            const txt = tb.innerText || '';
            const isNlpc = /Năng lực cốt lõi|Phẩm chất chủ yếu/.test(txt) && /Tốt/.test(txt);
            const isMon = /HTT/.test(txt) && /Tiếng Việt|Toán/.test(txt);
            if (!isNlpc && !isMon) return;
            const leaves = leafHeaders(tb);
            const rows = {};
            let prev = '';
            let cols = null;
            [...tb.rows].forEach(tr => {
                const ins = [...tr.querySelectorAll('input')];
                if (!ins.length) return;
                let lab = cleanLabel(tr.cells[0] && tr.cells[0].innerText);
                if (/^Tỷ lệ$/i.test(lab)) lab = prev + '%'; else prev = lab;
                rows[lab] = ins.map(i => String(i.value || '').trim());
                if (!cols) {
                    if (isNlpc) cols = ins.map(i => i.name);
                    else {
                        const firstInputCell = [...tr.cells].findIndex(td => td.querySelector('input'));
                        cols = leaves.slice(firstInputCell, firstInputCell + ins.length);
                    }
                }
            });
            out.push({ kind: isNlpc ? 'nlpc' : 'mon', cols: cols || [], rows });
        });
        return out;
    }

    // 6.3.1: nút "Đồng bộ thông tin lớp học" có sẵn của vnEdu (Mẫu 2). vnEdu tự hỏi Có/Không,
    // ghi số liệu thẳng vào sổ rồi tải lại trang. Tiện ích CHỈ bấm nút này; GV tự xác nhận.
    function findSyncBtn(win) {
        try {
            const b = Ext.ComponentQuery.query('button', win).find(x => x.isVisible() &&
                /đồng\s*bộ/i.test(String(x.text || '') + ' ' + String(x.tooltip || '')));
            if (b) return { ext: b };
        } catch (e) { /* silent */ }
        const el = [...win.el.dom.querySelectorAll('a, button, span, div')].find(x => visible(x) &&
            x.children.length <= 2 && /^\s*đồng\s*bộ thông tin lớp/i.test(x.textContent || ''));
        return el ? { dom: el } : null;
    }

    function readState() {
        const win = activeWin();
        if (!win) return { active: false };
        const title = String(win.title || '');
        const mau = /mẫu\s*2/i.test(title) ? 2 : 1;
        const section = cleanLabel(title.split(':').slice(1).join(':'));
        const lop = rawOf(win, 'class');
        const thang = rawOf(win, 'thang');
        const thoiGian = rawOf(win, 'thoi_gian');
        const text = (win.el.dom.innerText || '');
        const mSiSo = text.match(/Kỳ I:\s*(\d+)\s*học sinh/i);
        const laSoDo = /^sơ đồ lớp$/i.test(section);
        if (/^danh sách học sinh$/i.test(section)) { try { luuGioiTinh(win, lop); } catch (e) { /* silent */ } }
        const fields = laSoDo ? [] : listFields(win).map(f => ({
            key: f.key, kind: f.kind, name: f.name, label: f.label, rowLabel: f.rowLabel,
            hasValue: !!String(f.value || '').trim(), len: String(f.value || '').length,
            readOnly: f.readOnly, maxLength: f.maxLength
        }));
        const busy = !!win.el.dom.querySelector('.x-mask-msg') &&
            [...win.el.dom.querySelectorAll('.x-mask-msg')].some(visible);
        return {
            active: true,
            winId: win.id,
            mau, section, lop, thang, thoiGian,
            siSoKy1: mSiSo ? parseInt(mSiSo[1], 10) : null,
            heading: cleanLabel((text.match(/(KẾ HOẠCH[^\n]*|KẾT QUẢ THỰC HIỆN[^\n]*|SƠ KẾT[^\n]*|TỔNG KẾT[^\n]*|PHƯƠNG HƯỚNG[^\n]*|NỘI DUNG HỌP[^\n]*)/) || [])[0]),
            nums: readNumbers(win),
            weeks: readWeekRows(win),
            tables: readResultTables(win),
            fields,
            busy,
            dongBo: !!findSyncBtn(win),
            sodo: laSoDo ? tomTatSoDo(win) : null
        };
    }

    // ---------- 6.3.4: Sơ đồ lớp (Mẫu 2) ----------
    const GT_KEY = 'cogiao_scn_gt_';
    function seatEls(win) {
        return [...win.el.dom.querySelectorAll('.sodo .get-student')].filter(visible);
    }
    function readSeats(win) {
        return seatEls(win).map(td => {
            const ta = td.querySelector('textarea, input');
            return {
                c: parseInt(td.getAttribute('c'), 10) || 0, r: parseInt(td.getAttribute('r'), 10) || 0,
                stt: parseInt(td.getAttribute('stt'), 10) || 0,
                id: td.getAttribute('data-id') || '', name: ta ? String(ta.value || '').trim() : ''
            };
        });
    }
    function tomTatSoDo(win) {
        const s = readSeats(win);
        return { soCho: s.length, soDaXep: s.filter(x => x.id).length, hocKy: rawOf(win, 'hoc_ky') };
    }
    /** Đọc cột Nữ ở mục Danh sách học sinh, nhớ theo lớp (trong phiên trình duyệt). */
    function luuGioiTinh(win, lop) {
        const tb = [...win.el.dom.querySelectorAll('table')].filter(t => visible(t) && /Họ và tên học sinh/.test(t.innerText) && /Nữ/.test(t.innerText)).pop();
        if (!tb || !lop) return 0;
        const head = [...tb.rows].find(tr => /Họ và tên học sinh/.test(tr.innerText));
        const iNu = head ? [...head.cells].findIndex(c => /^\s*Nữ\s*$/.test(c.innerText)) : -1;
        if (iNu < 0) return 0;
        const map = {};
        [...tb.querySelectorAll('tr[data-id]')].forEach(tr => {
            const c = tr.cells[iNu];
            if (c) map[tr.getAttribute('data-id')] = /x/i.test(c.innerText);
        });
        const n = Object.keys(map).length;
        if (n) { try { sessionStorage.setItem(GT_KEY + lop, JSON.stringify(map)); } catch (e) { /* silent */ } }
        return n;
    }
    function docGioiTinh(lop) {
        try { return JSON.parse(sessionStorage.getItem(GT_KEY + lop) || 'null'); } catch (e) { return null; }
    }
    function layDanhSach(win) {
        const ta = win.el.dom.querySelector('.sodo .get-student textarea');
        const $ = window.jQuery;
        if (!ta || !$) return Promise.resolve(null);
        const ac = $(ta).data('ui-autocomplete') || $(ta).data('autocomplete');
        const url = ac && typeof ac.options.source === 'string' ? ac.options.source : '';
        if (!/getListStudentByLopSD/.test(url)) return Promise.resolve(null);
        return new Promise(res => $.ajax({
            url, data: { term: '' }, dataType: 'json', timeout: 15000,
            success: d => res(Array.isArray(d) ? d : (d && (d.aRoot || d.list || d.data)) || []),
            error: () => res(null)
        }));
    }
    async function soDo(d) {
        const win = activeWin();
        if (!win || !/^sơ đồ lớp$/i.test(tenMuc(win))) return { ok: false, error: 'wrong_page' };
        const lop = rawOf(win, 'class'), hocKy = rawOf(win, 'hoc_ky');
        if (d.action === 'read') {
            const ds = await layDanhSach(win);
            if (!ds) return { ok: false, error: 'no_list' };
            const gt = docGioiTinh(lop);
            const hs = ds.map(x => {
                const id = String(x.id || x.hoc_sinh_id);
                return { id, name: String(x.full_name || x.value || x.label || '').trim(), nu: gt && (id in gt) ? !!gt[id] : null };
            });
            return { ok: true, lop, hocKy, seats: readSeats(win), hs, coGioiTinh: !!gt };
        }
        if (d.action === 'gioiTinh') {
            const mo = await openSection('Danh sách học sinh');
            if (!mo.ok) return { ok: false, error: 'open_list_failed' };
            let n = 0;
            for (let i = 0; i < 20 && !n; i++) {
                await new Promise(r => setTimeout(r, 300));
                const w = activeWin();
                n = w ? luuGioiTinh(w, rawOf(w, 'class')) : 0;
            }
            const ve = await openSection('Sơ đồ lớp');
            return { ok: n > 0 && ve.ok, soEm: n, error: n ? (ve.ok ? '' : 'back_failed') : 'no_gender' };
        }
        if (d.action === 'fill') {
            const ex = d.expect || {};
            if (ex.lop !== lop || (ex.hocKy || '') !== (hocKy || '')) return { ok: false, error: 'context_changed' };
            const byKey = new Map((d.plan || []).map(p => [p.c + ':' + p.r + ':' + p.stt, p]));
            let dat = 0, xoa = 0;
            seatEls(win).forEach(td => {
                const p = byKey.get(td.getAttribute('c') + ':' + td.getAttribute('r') + ':' + td.getAttribute('stt'));
                if (!p || p.giu) return;
                const ta = td.querySelector('textarea, input');
                if (p.id) { td.setAttribute('data-id', p.id); if (ta) ta.value = p.name; dat++; }
                else if (td.getAttribute('data-id') || (ta && ta.value)) { td.removeAttribute('data-id'); if (ta) ta.value = ''; xoa++; }
            });
            const sau = readSeats(win);
            const sai = (d.plan || []).filter(p => !p.giu && p.id && !sau.some(x => x.c === p.c && x.r === p.r && x.stt === p.stt && x.id === p.id)).length;
            lastSig = null; push(true);
            return { ok: sai === 0, dat, xoa, sai, error: sai ? 'verify_failed' : '' };
        }
        return { ok: false, error: 'bad_action' };
    }

    function signature(s) {
        if (!s.active) return 'off';
        return [s.mau, s.section, s.lop, s.thang, s.thoiGian, s.busy ? 1 : 0,
            s.fields.map(f => f.key + ':' + (f.hasValue ? 1 : 0)).join(','), s.dongBo ? 1 : 0,
            JSON.stringify(s.nums).length, JSON.stringify(s.tables).length, JSON.stringify(s.sodo || '')].join('|');
    }

    let lastSig = null;
    function push(force) {
        let s;
        try { s = readState(); } catch (e) { s = { active: false }; }
        const sig = signature(s);
        if (!force && sig === lastSig) return;
        lastSig = sig;
        s.sig = sig;
        try { window.postMessage({ type: '__COGIAO_SCN_STATE__', state: s }, '*'); } catch (e) { /* silent */ }
    }

    setInterval(() => { if (!document.hidden) push(false); }, 1500);

    function sameContext(s, expect) {
        if (!s.active || !expect) return false;
        return s.mau === expect.mau && s.section === expect.section &&
            s.lop === expect.lop && (expect.thang || '') === (s.thang || '');
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

    function setCk(inst, html) {
        return new Promise(resolve => {
            let done = false;
            const finish = () => {
                if (done) return; done = true;
                try { inst.updateElement(); inst.fire('change'); } catch (e) { /* silent */ }
                resolve(true);
            };
            try { inst.setData(html, { callback: finish }); } catch (e) { resolve(false); return; }
            setTimeout(finish, 1500);
        });
    }

    async function fill(payload) {
        const s = readState();
        if (!sameContext(s, payload.expect)) return { ok: false, error: 'context_changed' };
        const win = activeWin();
        const filled = [], skipped = [], failed = [];
        for (const it of (payload.items || [])) {
            const f = findField(win, it.key);
            if (!f) { failed.push(it.key); continue; }
            if (f.readOnly) { failed.push(it.key); continue; }
            if (String(f.value || '').trim() && !payload.overwrite) { skipped.push(it.key); continue; }
            const el = fieldElement(win, f);
            if (!el) { failed.push(it.key); continue; }
            if (f.kind === 'ck') {
                // 6.3.6: bảng bên không gửi kèm html thì tự đổi chữ thường sang từng đoạn <p>;
                // trước đây đưa thẳng chữ thường vào CKEditor nên các gạch đầu dòng dồn thành một đoạn.
                const htmlCk = it.html || String(it.text || '').split('\n').map(l =>
                    '<p>' + l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>').join('');
                await setCk(el, htmlCk);
                const back = htmlToText(el.getData());
                const want = htmlToText(it.html || it.text || '');
                if (back.replace(/\s+/g, ' ') === want.replace(/\s+/g, ' ')) filled.push(it.key); else failed.push(it.key);
            } else {
                let v = String(it.text || '');
                if (f.maxLength && v.length > f.maxLength) v = v.slice(0, f.maxLength);
                if (setTextarea(el, v)) filled.push(it.key); else failed.push(it.key);
            }
        }
        lastSig = null;
        setTimeout(() => push(true), 300);
        return { ok: true, filled, skipped, failed };
    }

    async function save(expect) {
        const s = readState();
        if (!sameContext(s, expect)) return { ok: false, error: 'context_changed' };
        const win = activeWin();
        const btn = Ext.ComponentQuery.query('button', win).find(b => b.isVisible() && /^\s*Lưu\s*$/.test(b.text || ''));
        if (!btn || btn.disabled) return { ok: false, error: 'no_save_button' };
        try {
            if (btn.el && btn.el.dom) btn.el.dom.click();
        } catch (e) { return { ok: false, error: 'click_failed' }; }
        // chờ hộp "Thông báo" của vnEdu
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 400));
            const msg = Ext.ComponentQuery.query('window').filter(w => w.isVisible() && w !== win)
                .map(w => (w.el && w.el.dom && w.el.dom.innerText) || '').find(t => /thành công|lỗi|không/i.test(t));
            if (msg) return { ok: /thành công/i.test(msg), message: cleanLabel(msg).slice(0, 160) };
        }
        return { ok: true, message: '' };
    }

    function sync(expect) {
        const s = readState();
        if (!sameContext(s, expect)) return { ok: false, error: 'context_changed' };
        const win = activeWin();
        const t = findSyncBtn(win);
        if (!t) return { ok: false, error: 'no_sync_button' };
        try {
            if (t.ext) { if (t.ext.el && t.ext.el.dom) t.ext.el.dom.click(); else t.ext.fireHandler && t.ext.fireHandler(); }
            else t.dom.click();
        } catch (e) { return { ok: false, error: 'click_failed' }; }
        return { ok: true };
    }

    /** 6.3.4: tìm dòng mục trên cây bên trái cửa sổ sổ chủ nhiệm theo tên mục. */
    function chuanTen(s) { return cleanLabel(s).toLowerCase(); }
    function findTreeRow(win, name) {
        const want = chuanTen(name);
        const nodes = [...win.el.dom.querySelectorAll('.x-tree-node-text, .x-tree-panel .x-grid-cell-inner')]
            .filter(visible);
        const hit = nodes.find(n => chuanTen(n.textContent) === want);
        if (!hit) return null;
        return hit.closest('.x-grid-row, tr, .x-grid-item') || hit;
    }

    function mouseClick(el) {
        const r = el.getBoundingClientRect();
        const o = { bubbles: true, cancelable: true, view: window, clientX: r.left + Math.min(40, r.width / 2), clientY: r.top + r.height / 2, button: 0 };
        ['mouseover', 'mousedown', 'mouseup', 'click'].forEach(t => el.dispatchEvent(new MouseEvent(t, o)));
    }

    function tenMuc(w) { return w ? cleanLabel(String(w.title || '').split(':').slice(1).join(':')) : ''; }

    async function openSection(name) {
        const win = activeWin();
        if (!win) return { ok: false, error: 'no_window' };
        if (chuanTen(tenMuc(win)) === chuanTen(name)) return { ok: true, already: true };
        const row = findTreeRow(win, name);
        if (!row) return { ok: false, error: 'not_found' };
        try { row.scrollIntoView({ block: 'nearest' }); } catch (e) { /* silent */ }
        mouseClick(row);
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 250));
            if (chuanTen(tenMuc(activeWin())) === chuanTen(name)) { lastSig = null; push(true); return { ok: true }; }
        }
        return { ok: false, error: 'not_opened' };
    }

    window.addEventListener('message', async (ev) => {
        if (ev.source !== window || !ev.data || typeof ev.data.type !== 'string') return;
        const d = ev.data;
        if (d.type === '__COGIAO_SCN_ASK__') { lastSig = null; push(true); return; }
        if (d.type === '__COGIAO_SCN_SODO__') {
            let result;
            try { result = await soDo(d.payload || {}); } catch (e) { result = { ok: false, error: 'exception', message: String(e && e.message || e) }; }
            window.postMessage({ type: '__COGIAO_SCN_SODO_RESULT__', reqId: d.reqId, result }, '*');
            return;
        }
        if (d.type === '__COGIAO_SCN_OPEN__') {
            let result;
            try { result = await openSection(String(d.section || '')); } catch (e) { result = { ok: false, error: 'exception' }; }
            window.postMessage({ type: '__COGIAO_SCN_OPEN_RESULT__', reqId: d.reqId, result }, '*');
            return;
        }
        if (d.type === '__COGIAO_SCN_FILL__') {
            let result;
            try { result = await fill(d.payload || {}); } catch (e) { result = { ok: false, error: 'exception', message: String(e && e.message || e) }; }
            window.postMessage({ type: '__COGIAO_SCN_FILL_RESULT__', reqId: d.reqId, result }, '*');
            return;
        }
        if (d.type === '__COGIAO_SCN_SYNC__') {
            let result;
            try { result = sync(d.expect); } catch (e) { result = { ok: false, error: 'exception' }; }
            window.postMessage({ type: '__COGIAO_SCN_SYNC_RESULT__', reqId: d.reqId, result }, '*');
            return;
        }
        if (d.type === '__COGIAO_SCN_SAVE__') {
            let result;
            try { result = await save(d.expect); } catch (e) { result = { ok: false, error: 'exception' }; }
            window.postMessage({ type: '__COGIAO_SCN_SAVE_RESULT__', reqId: d.reqId, result }, '*');
        }
    });
})();

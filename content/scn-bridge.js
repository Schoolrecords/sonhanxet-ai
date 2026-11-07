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
        const fields = listFields(win).map(f => ({
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
            dongBo: !!findSyncBtn(win)
        };
    }

    function signature(s) {
        if (!s.active) return 'off';
        return [s.mau, s.section, s.lop, s.thang, s.thoiGian, s.busy ? 1 : 0,
            s.fields.map(f => f.key + ':' + (f.hasValue ? 1 : 0)).join(','), s.dongBo ? 1 : 0,
            JSON.stringify(s.nums).length, JSON.stringify(s.tables).length].join('|');
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
                await setCk(el, it.html || it.text || '');
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

    window.addEventListener('message', async (ev) => {
        if (ev.source !== window || !ev.data || typeof ev.data.type !== 'string') return;
        const d = ev.data;
        if (d.type === '__COGIAO_SCN_ASK__') { lastSig = null; push(true); return; }
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

/**
 * 6.3.0 — Màn Sổ chủ nhiệm trong bảng bên.
 * Luồng: đọc mục đang mở (từ content-script) → thầy cô chọn đặc điểm lớp → "Viết nháp" →
 * sửa trực tiếp từng ô → "Điền vào vnEdu" (không ghi đè ô đã có chữ, trừ khi chọn) →
 * đọc lại trên vnEdu → "Lưu vào vnEdu".
 */
(function () {
    'use strict';
    const E = window.SoChuNhiemEngine;
    const $ = id => document.getElementById(id);
    const TRAITS_KEY = 'scn_traits_v1';
    const DRAFTS_KEY = 'scn_drafts_v1';

    let state = null;          // state từ cầu nối
    let info = null;           // E.describe(state)
    let ctxKey = '';
    let drafts = {};           // key ô → {text, on, seed, canBoSung}
    let traitsByLop = {};
    let pending = null;        // {reqId, kind}
    let lastFilled = null;     // {keys, coChoTrong}

    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function store(get, key, val) {
        return new Promise(res => {
            try {
                if (get) chrome.storage.local.get([key], o => res(o ? o[key] : undefined));
                else chrome.storage.local.set({ [key]: val }, () => res());
            } catch (e) { res(undefined); }
        });
    }

    function keyOf(s) { return [s.mau, s.section, s.lop, s.thang].join('|'); }

    function traitsNow() {
        const lop = (state && state.lop) || '';
        if (traitsByLop[lop]) return traitsByLop[lop];
        return E.TRAITS.filter(t => t.macDinh).map(t => t.id);
    }

    // ---------- vẽ ----------
    function renderCtx() {
        const s = state || {};
        const parts = ['Mẫu ' + (s.mau || '?')];
        if (s.lop) parts.push('Lớp ' + s.lop);
        if (info && info.thang && /tháng/i.test(s.section || '')) parts.push('Tháng ' + info.thang);
        if (/họp/i.test(s.section || '') && info) parts.push('Lần ' + info.lanHop);
        $('scn-ctx').innerHTML =
            '<div class="scn-ctx-top">Sổ chủ nhiệm · ' + esc(parts.join(' · ')) + '</div>' +
            '<div class="scn-ctx-title">' + esc(s.section || '') + '</div>';
    }

    function renderNote() {
        const el = $('scn-note');
        const msgs = [];
        if (!info.supported) {
            msgs.push('Mục <strong>' + esc(state.section) + '</strong> chưa cần viết nháp (bảng số liệu hoặc danh sách). Các mục em viết được ở Mẫu ' +
                esc(state.mau) + ': ' + info.danhSachMuc.map(esc).join(', ') + '.');
        } else if (!info.fields.length) {
            msgs.push('Chưa thấy ô nào để viết. Thầy cô chọn lớp' + (/tháng|họp/i.test(state.section) ? ', chọn tháng (lần họp)' : '') + ' trên vnEdu rồi chờ trang tải xong.');
        }
        if (!state.lop && info.supported) msgs.push('Chưa đọc được lớp. Thầy cô chọn lớp trên vnEdu.');
        (info.thieu || []).forEach(t => msgs.push(esc(t)));
        el.innerHTML = msgs.map(m => '<div>' + m + '</div>').join('');
        el.style.display = msgs.length ? '' : 'none';
        $('scn-work').style.display = info.supported && info.fields.length ? '' : 'none';
    }

    function renderSync() {
        const box = $('scn-sync');
        if (!box) return;
        box.style.display = state && state.active !== false && state.dongBo ? '' : 'none';
    }

    let syncArmedUntil = 0;
    function sync() {
        const btn = $('scn-btn-sync');
        const msg = $('scn-sync-msg');
        // Đã điền mà chưa Lưu → đồng bộ (tải lại trang) sẽ làm mất chữ: bắt bấm 2 lần
        if (lastFilled && (!syncArmedUntil || Date.now() > syncArmedUntil)) {
            syncArmedUntil = Date.now() + 6000;
            msg.className = 'scn-sync-msg warn';
            msg.innerHTML = 'Thầy cô vừa điền chữ vào vnEdu. Nếu <strong>chưa Lưu</strong>, đồng bộ sẽ làm mất chữ đó. Bấm nút lần nữa nếu vẫn muốn đồng bộ.';
            msg.style.display = '';
            return;
        }
        syncArmedUntil = 0;
        btn.disabled = true;
        parent.postMessage({
            type: 'COGIAO_SCN_SYNC',
            payload: { reqId: newReq('sync'), expect: { mau: state.mau, section: state.section, lop: state.lop, thang: state.thang || '' } }
        }, '*');
    }

    function onSyncResult(p) {
        if (!pending || p.reqId !== pending.reqId) return;
        pending = null;
        const btn = $('scn-btn-sync');
        const msg = $('scn-sync-msg');
        btn.disabled = false;
        const r = p.result || {};
        msg.className = 'scn-sync-msg ' + (r.ok ? 'ok' : 'warn');
        msg.innerHTML = r.ok
            ? 'Đã bấm nút đồng bộ của vnEdu. Thầy cô chọn <strong>Có</strong> trên hộp hỏi của vnEdu. Trang tải lại xong thì mở lại mục này và bấm <strong>Viết nháp</strong>.'
            : r.error === 'context_changed' ? 'Trên vnEdu đã đổi lớp hoặc mục. Thầy cô kiểm tra rồi bấm lại.'
                : r.error === 'no_sync_button' ? 'Không thấy nút Đồng bộ thông tin lớp học trên mục này. Thầy cô mở mục có nút đó trên vnEdu.'
                    : 'Chưa bấm được nút đồng bộ (' + esc(r.error || 'lỗi') + '). Thầy cô tự bấm trên vnEdu.';
        msg.style.display = '';
        lastFilled = null;
    }

    function renderTraits() {
        const on = new Set(traitsNow());
        $('scn-chips').innerHTML = E.TRAITS.map(t =>
            '<label class="scn-chip' + (on.has(t.id) ? ' on' : '') + '"><input type="checkbox" data-trait="' + t.id + '"' +
            (on.has(t.id) ? ' checked' : '') + '> ' + esc(t.label) + '</label>').join('');
        $('scn-traits-sum').textContent = '(' + on.size + ' đã chọn)';
    }

    function autoH(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 420) + 'px'; }

    function renderList() {
        const list = $('scn-list');
        const fields = info.fields || [];
        const coNhap = fields.some(f => drafts[f.key]);
        if ($('scn-btn-xoa-nhap')) $('scn-btn-xoa-nhap').style.display = coNhap ? '' : 'none';
        if (!coNhap) {
            list.innerHTML = '<div class="scn-empty">Mục này có ' + fields.length + ' ô. Bấm nút trên để em viết nháp; thầy cô sửa lại trước khi điền.</div>';
            $('scn-bar').style.display = 'none';
            return;
        }
        list.innerHTML = fields.map(f => {
            const d = drafts[f.key];
            if (!d) return '';
            const badges = [];
            if (f.hasValue) badges.push('<span class="scn-badge co">Đã có chữ trên vnEdu</span>');
            if (d.text.includes('…')) badges.push('<span class="scn-badge bs">Còn chỗ … cần bổ sung</span>');
            return '<div class="scn-card' + (d.on ? '' : ' off') + '" data-key="' + esc(f.key) + '">' +
                '<div class="scn-card-head">' +
                '<label class="scn-card-pick"><input type="checkbox" data-pick="' + esc(f.key) + '"' + (d.on ? ' checked' : '') + '> ' + esc(f.label) + '</label>' +
                '<span class="scn-card-btns">' +
                '<button class="scn-redo" data-redo="' + esc(f.key) + '" title="Viết lại bản khác">Viết lại</button>' +
                '<button class="scn-redo scn-xoa" data-xoa="' + esc(f.key) + '" title="Xóa chữ trong khung nháp này để tự gõ">Xóa</button>' +
                '</span>' +
                '</div>' + (badges.length ? '<div class="scn-badges">' + badges.join('') + '</div>' : '') +
                '<textarea class="scn-text" data-edit="' + esc(f.key) + '" spellcheck="false">' + esc(d.text) + '</textarea>' +
                '</div>';
        }).join('');
        list.querySelectorAll('textarea.scn-text').forEach(autoH);
        $('scn-bar').style.display = '';
        updateFillBtn();
    }

    function updateFillBtn() {
        const n = (info.fields || []).filter(f => drafts[f.key] && drafts[f.key].on && drafts[f.key].text.trim()).length;
        const ow = $('scn-overwrite').checked;
        const coChu = (info.fields || []).filter(f => f.hasValue && drafts[f.key] && drafts[f.key].on).length;
        const btn = $('scn-btn-fill');
        btn.disabled = n === 0;
        btn.textContent = 'Điền ' + n + ' ô vào vnEdu' + (!ow && coChu ? ' (bỏ qua ' + coChu + ' ô đã có chữ)' : '');
    }

    function showResult(html, kind) {
        const el = $('scn-result');
        el.className = 'scn-result ' + (kind || '');
        el.innerHTML = html;
        el.style.display = html ? '' : 'none';
    }

    // ---------- việc ----------
    async function saveDrafts() {
        const all = (await store(true, DRAFTS_KEY)) || {};
        all[ctxKey] = { t: Date.now(), d: drafts };
        const keys = Object.keys(all).sort((a, b) => (all[b].t || 0) - (all[a].t || 0)).slice(0, 40);
        const out = {};
        keys.forEach(k => { out[k] = all[k]; });
        await store(false, DRAFTS_KEY, out);
    }

    function genOne(key, seed) {
        const g = E.generate(state, key, { traits: traitsNow(), seed });
        return g ? g.text : '';
    }

    async function generateAll() {
        const btn = $('scn-btn-gen');
        if (btn.disabled) return;
        btn.disabled = true;
        btn.textContent = 'Đang viết nháp…';
        try { await generateAllInner(); }
        finally { btn.disabled = false; btn.textContent = 'Viết nháp các ô của mục này'; }
    }

    /** Hỏi bản quyền; máy chủ chậm quá 6 giây thì vẫn cho viết (không bắt thầy cô chờ). */
    function hoiBanQuyen() {
        if (!window.LicenseClient) return Promise.resolve({ allowed: true });
        const hetGio = new Promise(res => setTimeout(() => res({ allowed: true, hetGio: true }), 6000));
        const hoi = window.LicenseClient.canUseFeature('sochunhiem', '', state.lop || '')
            .catch(() => ({ allowed: true, loiMang: true }));
        return Promise.race([hoi, hetGio]);
    }

    async function generateAllInner() {
        const gate = await hoiBanQuyen();
        if (!gate.allowed) {
            const lyDo = gate.reason === 'free_other_class' ? 'scn_other_class' : gate.reason;
            if (window.__snxShowLock) window.__snxShowLock(lyDo, gate);
            return;
        }
        for (const f of info.fields) {
            const old = drafts[f.key];
            const seed = old ? old.seed : 0;
            const text = genOne(f.key, seed);
            drafts[f.key] = { text, on: !!text && !f.hasValue, seed };
        }
        showResult('');
        renderList();
        saveDrafts();
        if (gate.dungThu && window.LicenseClient.commitFreeSubject) {
            window.LicenseClient.commitFreeSubject('', state.lop || '').catch(() => { /* silent */ });
        }
    }

    function redo(key) {
        const d = drafts[key] || { on: true, seed: 0 };
        d.seed = (d.seed || 0) + 1;
        d.text = genOne(key, d.seed);
        drafts[key] = d;
        renderList();
        saveDrafts();
    }

    function xoaNhap(key) {
        if (!drafts[key]) return;
        drafts[key].text = '';
        renderList();
        saveDrafts();
        const ta = document.querySelector('textarea[data-edit="' + key + '"]');
        if (ta) ta.focus();
    }

    let xoaNhapArmed = 0;
    function xoaToanBoNhap() {
        const btn = $('scn-btn-xoa-nhap');
        if (!xoaNhapArmed || Date.now() > xoaNhapArmed) {
            xoaNhapArmed = Date.now() + 5000;
            btn.textContent = 'Bấm lần nữa để xóa toàn bộ bản nháp';
            setTimeout(() => { if (Date.now() > xoaNhapArmed) btn.textContent = 'Xóa toàn bộ bản nháp'; }, 5200);
            return;
        }
        xoaNhapArmed = 0;
        btn.textContent = 'Xóa toàn bộ bản nháp';
        drafts = {};
        showResult('');
        renderList();
        saveDrafts();
    }

    let xoaVnArmed = 0;
    function xoaTrenVnedu() {
        const keys = info.fields.filter(f => drafts[f.key] && drafts[f.key].on).map(f => f.key);
        const btn = $('scn-btn-xoa-vn');
        if (!keys.length) { showResult('Đánh dấu ô cần xóa (ô vuông đầu mỗi khung) rồi bấm lại.', 'warn'); return; }
        if (!xoaVnArmed || Date.now() > xoaVnArmed) {
            xoaVnArmed = Date.now() + 6000;
            btn.textContent = 'Bấm lần nữa để xóa chữ ' + keys.length + ' ô trên vnEdu';
            btn.classList.add('armed');
            setTimeout(() => { if (Date.now() > xoaVnArmed) { btn.textContent = 'Xóa chữ trên vnEdu ở ô đã đánh dấu'; btn.classList.remove('armed'); } }, 6200);
            return;
        }
        xoaVnArmed = 0;
        btn.textContent = 'Xóa chữ trên vnEdu ở ô đã đánh dấu';
        btn.classList.remove('armed');
        const items = keys.map(k => {
            const f = info.fields.find(x => x.key === k);
            return { key: k, text: '', html: f && f.kind === 'ck' ? '' : undefined };
        });
        showResult('Đang xóa…');
        parent.postMessage({
            type: 'COGIAO_SCN_FILL',
            payload: {
                reqId: newReq('fill'),
                expect: { mau: state.mau, section: state.section, lop: state.lop, thang: state.thang || '' },
                items, overwrite: true
            }
        }, '*');
        lastFilled = { keys, coChoTrong: false, xoa: true };
    }

    function newReq(kind) {
        pending = { reqId: kind + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), kind };
        return pending.reqId;
    }

    function fill() {
        const items = info.fields.filter(f => drafts[f.key] && drafts[f.key].on && drafts[f.key].text.trim()).map(f => {
            const text = drafts[f.key].text.trim();
            return { key: f.key, text, html: f.kind === 'ck' ? E.toHtml(text) : undefined };
        });
        if (!items.length) return;
        const bad = items.map(i => E.validate(i.text)).flat();
        if (bad.length) { showResult('Cần sửa trước khi điền: ' + esc([...new Set(bad)].join('; ')) + '.', 'warn'); return; }
        $('scn-btn-fill').disabled = true;
        showResult('Đang điền…');
        parent.postMessage({
            type: 'COGIAO_SCN_FILL',
            payload: {
                reqId: newReq('fill'),
                expect: { mau: state.mau, section: state.section, lop: state.lop, thang: state.thang || '' },
                items, overwrite: $('scn-overwrite').checked
            }
        }, '*');
        lastFilled = { keys: items.map(i => i.key), coChoTrong: items.some(i => i.text.includes('…')) };
    }

    function save() {
        $('scn-save') && ($('scn-save').disabled = true);
        parent.postMessage({
            type: 'COGIAO_SCN_SAVE',
            payload: { reqId: newReq('save'), expect: { mau: state.mau, section: state.section, lop: state.lop, thang: state.thang || '' } }
        }, '*');
    }

    function onFillResult(p) {
        if (!pending || p.reqId !== pending.reqId) return;
        pending = null;
        updateFillBtn();
        const r = p.result || {};
        if (!r.ok) {
            showResult(r.error === 'context_changed'
                ? 'Trên vnEdu đã đổi lớp, mục hoặc tháng. Em chưa điền gì. Thầy cô kiểm tra lại rồi bấm điền lần nữa.'
                : 'Chưa điền được (' + esc(r.error || 'lỗi') + '). Thầy cô bấm F5 trang vnEdu rồi thử lại.', 'warn');
            return;
        }
        const ten = k => (info.fields.find(f => f.key === k) || {}).label || k;
        const laXoaTruoc = lastFilled && lastFilled.xoa;
        // ô vừa điền: bỏ chọn để không lỡ điền lần hai
        (r.filled || []).forEach(k => { if (drafts[k]) drafts[k].on = !!laXoaTruoc; });
        renderList();
        saveDrafts();
        const laXoa = lastFilled && lastFilled.xoa;
        let html = '<div><strong>' + (laXoa ? 'Đã xóa chữ ' : 'Đã điền ') + r.filled.length + ' ô trên vnEdu.</strong></div>';
        if (r.skipped.length) html += '<div>Bỏ qua ' + r.skipped.length + ' ô đã có chữ: ' + r.skipped.map(k => esc(ten(k))).join('; ') + '.</div>';
        if (r.failed.length) html += '<div class="bad">Chưa điền được: ' + r.failed.map(k => esc(ten(k))).join('; ') + '.</div>';
        if (r.filled.length) {
            const choTrong = lastFilled && lastFilled.coChoTrong;
            html += laXoa
                ? '<div>Ô đã trống. Thầy cô bấm <strong>Viết lại</strong> rồi điền, hoặc tự gõ; xong bấm Lưu. Muốn giữ ô trống thì bấm Lưu ngay.</div>'
                : choTrong
                ? '<div>Có ô còn dấu <strong>…</strong>: thầy cô sửa ngay trên vnEdu cho đúng thực tế lớp rồi mới Lưu.</div>'
                : '<div>Thầy cô đọc lại trên vnEdu rồi Lưu.</div>';
            html += '<button class="btn-secondary scn-save" id="scn-save">' + (choTrong ? 'Đã sửa xong, Lưu vào vnEdu' : 'Lưu vào vnEdu') + '</button>';
        }
        showResult(html, r.failed.length ? 'warn' : 'ok');
        const b = $('scn-save');
        if (b) b.addEventListener('click', save);
    }

    function onSaveResult(p) {
        if (!pending || p.reqId !== pending.reqId) return;
        pending = null;
        const r = p.result || {};
        if (r.ok) showResult('<strong>Đã lưu.</strong> ' + esc(r.message || ''), 'ok');
        else showResult(r.error === 'context_changed' ? 'Trên vnEdu đã đổi lớp hoặc mục nên em không bấm Lưu. Thầy cô tự bấm Lưu nếu cần.'
            : r.error === 'no_save_button' ? 'Không thấy nút Lưu. Thầy cô bấm Lưu trên vnEdu.'
                : 'vnEdu báo: ' + esc(r.message || r.error || 'chưa lưu được') + '.', 'warn');
    }

    // ---------- nhận dữ liệu ----------
    async function update(s) {
        const k = keyOf(s || {});
        const doiMuc = k !== ctxKey;
        state = s || {};
        info = E.describe(state);
        if (doiMuc) {
            ctxKey = k;
            const all = (await store(true, DRAFTS_KEY)) || {};
            drafts = (all[k] && all[k].d) || {};
            showResult('');
            $('scn-overwrite').checked = false;
        }
        renderCtx();
        renderNote();
        renderSync();
        renderTraits();
        renderList();
    }

    function bind() {
        $('scn-btn-gen').addEventListener('click', generateAll);
        $('scn-btn-fill').addEventListener('click', fill);
        if ($('scn-btn-sync')) $('scn-btn-sync').addEventListener('click', sync);
        if ($('scn-btn-xoa-nhap')) $('scn-btn-xoa-nhap').addEventListener('click', xoaToanBoNhap);
        if ($('scn-btn-xoa-vn')) $('scn-btn-xoa-vn').addEventListener('click', xoaTrenVnedu);
        $('scn-overwrite').addEventListener('change', updateFillBtn);
        $('scn-chips').addEventListener('change', e => {
            const id = e.target && e.target.dataset.trait;
            if (!id) return;
            const set = new Set(traitsNow());
            if (e.target.checked) set.add(id); else set.delete(id);
            traitsByLop[(state && state.lop) || ''] = [...set];
            store(false, TRAITS_KEY, traitsByLop);
            renderTraits();
        });
        $('scn-list').addEventListener('input', e => {
            const k = e.target && e.target.dataset.edit;
            if (!k || !drafts[k]) return;
            drafts[k].text = e.target.value;
            autoH(e.target);
            clearTimeout(bind._t);
            bind._t = setTimeout(saveDrafts, 600);
        });
        $('scn-list').addEventListener('change', e => {
            const k = e.target && e.target.dataset.pick;
            if (!k || !drafts[k]) return;
            drafts[k].on = e.target.checked;
            e.target.closest('.scn-card').classList.toggle('off', !e.target.checked);
            updateFillBtn();
            saveDrafts();
        });
        $('scn-list').addEventListener('click', e => {
            const k = e.target && e.target.dataset.redo;
            if (k) redo(k);
            const x = e.target && e.target.dataset.xoa;
            if (x) xoaNhap(x);
        });
        window.addEventListener('message', e => {
            const { type, payload } = e.data || {};
            if (type === 'COGIAO_SCN_FILL_RESULT') onFillResult(payload || {});
            if (type === 'COGIAO_SCN_SAVE_RESULT') onSaveResult(payload || {});
            if (type === 'COGIAO_SCN_SYNC_RESULT') onSyncResult(payload || {});
        });
    }

    (async function init() {
        if (!E || !$('view-so-chu-nhiem')) return;
        traitsByLop = (await store(true, TRAITS_KEY)) || {};
        bind();
    })();

    window.ScnView = { update };
})();

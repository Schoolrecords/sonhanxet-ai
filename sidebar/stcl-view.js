/**
 * 6.4.0 — Màn "Sổ theo dõi chất lượng" trong bảng bên (4 kỳ đánh giá).
 * Luồng: vnEdu mở Sổ theo dõi chất lượng ở một kỳ (Giữa kỳ / Cuối kỳ)
 *   → "Đọc điểm và viết nhận xét cả lớp": tiện ích lần lượt chọn từng em, đọc bảng điểm KT, mức XL
 *   → soạn 3 ô mỗi em (Môn học và HĐGD; Năng lực; Phẩm chất), thầy cô sửa, đổi mức NL/PC
 *   → "Lưu cả lớp vào vnEdu": lần lượt chọn từng em, điền, bấm Lưu của vnEdu (mặc định không ghi đè ô đã có chữ).
 */
(function () {
    'use strict';
    const S = window.SoTheoDoiEngine;
    const $ = id => document.getElementById(id);
    const DRAFTS_KEY = 'stcl_drafts_v1';
    const O_TEN = ['Môn học và hoạt động giáo dục', 'Năng lực', 'Phẩm chất'];
    const TIERS = ['tot', 'ht', 'cht'];

    let state = null;        // từ cầu nối
    let ctxKey = '';
    let hs = [];             // [{id, stt, ten, scores, cur:[3], texts:[3], nlTier, pcTier, seed, on, status, msg}]
    let running = null;      // {reqId, kind}
    let engine = null, nlpcData = null, engineReady = null;
    let saveArmed = 0;       // bấm "Lưu cả lớp" lần 1 → hỏi lại; lần 2 trong 6 giây mới chạy

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
    function newReq() { return 'stcl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
    function send(type, payload) { parent.postMessage({ type, payload }, '*'); }
    function expect() { return { lop: state.lop, thangText: state.thangText }; }

    function loadEngine() {
        if (engineReady) return engineReady;
        engineReady = (async () => {
            const get = async f => (await fetch(chrome.runtime.getURL('engine/data/' + f))).json();
            const e = new window.NhanXetEngineV2();
            e.loadData(await get('nhanxet-ngan.json'));
            try { e.loadKyData(await get('nhanxet-ky.json')); } catch (x) { /* chạy bằng câu chung */ }
            try { e.loadGradeData(await get('nhanxet-grade.json')); } catch (x) { /* như trên */ }
            const n = await get('nhanxet-nlpc-giuaky.json');
            engine = e; nlpcData = n.nlpc;
        })().catch(err => { engineReady = null; throw err; });
        return engineReady;
    }

    // ---------- vẽ ----------
    function renderCtx() {
        const s = state || {};
        const parts = [];
        if (s.lop) parts.push('Lớp ' + s.lop);
        if (s.hocKy) parts.push(s.hocKy);
        if (s.students) parts.push(s.students.length + ' học sinh');
        $('stcl-ctx').innerHTML =
            '<div class="scn-ctx-top">Sổ theo dõi chất lượng · ' + esc(parts.join(' · ')) + '</div>' +
            '<div class="scn-ctx-title">' + esc(s.ky ? S.KY_TEN[s.ky] : (s.thangText || '')) + '</div>';
    }

    function note(html, loai) {
        const el = $('stcl-note');
        el.className = 'scn-note' + (loai ? ' stcl-note-' + loai : '');
        el.innerHTML = html || '';
        el.style.display = html ? '' : 'none';
    }

    /** Kỳ đánh giá nên làm theo ngày hôm nay (năm học bắt đầu tháng 9). */
    function kyTheoNgay() {
        const m = new Date().getMonth() + 1;
        if (m >= 8 && m <= 11) return 'ghk1';
        if (m === 12 || m === 1) return 'chk1';
        if (m === 2 || m === 3) return 'ghk2';
        return 'chk2';
    }

    let dangMoKy = '';
    const daTuMo = new Set();   // lớp đã tự chuyển sang kỳ đánh giá một lần (không ép lại nếu thầy cô tự chọn tháng)
    function moKy(ky) {
        if (running || dangMoKy) return;
        dangMoKy = ky;
        renderKyPicker();
        send('COGIAO_STCL_OPEN_KY', { reqId: newReq(), ky });
        setTimeout(() => { if (dangMoKy === ky) { dangMoKy = ''; renderKyPicker(); } }, 12000);
    }

    function renderKyPicker() {
        const box = $('stcl-ky');
        const cur = state && state.ky;
        box.innerHTML = '<div class="stcl-kytabs">' + ['ghk1', 'chk1', 'ghk2', 'chk2'].map(k =>
            '<button type="button" data-ky="' + k + '" class="' + (k === cur ? 'on' : '') + (k === dangMoKy ? ' dang' : '') + '"' +
            (running ? ' disabled' : '') + '>' + (k === dangMoKy ? 'Đang mở…' : S.KY_TEN[k]) + '</button>').join('') + '</div>' +
            (cur ? '' : '<div class="stcl-ky-hint">vnEdu đang ở <b>' + esc((state && state.thangText) || 'một tháng') + '</b>. Chọn kỳ đánh giá ở trên.</div>');
        box.style.display = '';
    }

    function tierBtns(i, field, cur) {
        return '<span class="stcl-tier" data-i="' + i + '" data-f="' + field + '">' +
            TIERS.map(t => '<button type="button" class="' + (t === cur ? 'on t-' + t : '') + '" data-t="' + t + '">' + S.TIER_TEN[t] + '</button>').join('') +
            '</span>';
    }

    function statusHtml(h) {
        if (h.status === 'saved') return '<span class="stcl-st ok">Đã lưu</span>';
        if (h.status === 'same') return '<span class="stcl-st ok">Không đổi</span>';
        if (h.status === 'err') return '<span class="stcl-st bad" title="' + esc(h.msg || '') + '">Lỗi</span>';
        if (h.status === 'readerr') return '<span class="stcl-st bad">Chưa đọc được</span>';
        if (h.cur && h.cur.some(t => t && t.trim())) return '<span class="stcl-st had" title="vnEdu đã có chữ ở ' + h.cur.filter(t => t && t.trim()).length + ' ô">Đã có chữ</span>';
        return '';
    }

    function cardHtml(h, i) {
        const o = h.mo ? h.texts.map((t, k) => {
            const cu = h.cur && h.cur[k] && h.cur[k].trim()
                ? '<div class="stcl-cu" title="' + esc(h.cur[k]) + '">Trên vnEdu: ' + esc(h.cur[k].slice(0, 70)) + (h.cur[k].length > 70 ? '…' : '') + '</div>' : '';
            const tier = k === 1 ? tierBtns(i, 'nlTier', h.nlTier) : k === 2 ? tierBtns(i, 'pcTier', h.pcTier) : '';
            return '<div class="stcl-o"><div class="stcl-o-head"><span>' + O_TEN[k] + '</span>' + tier + '</div>' +
                '<textarea data-i="' + i + '" data-k="' + k + '" maxlength="500" rows="3">' + esc(t) + '</textarea>' +
                '<div class="stcl-o-foot"><span class="stcl-len" id="stcl-len-' + i + '-' + k + '">' + t.length + '/500</span></div>' + cu + '</div>';
        }).join('') + '<div class="stcl-card-foot"><button type="button" class="scn-redo" data-redo="' + i + '">Viết lại em này</button></div>' : '';
        const xem = !h.mo && h.texts[0] ? '<div class="stcl-xem">' + esc(h.texts[0]) + '</div>' : '';
        return '<div class="stcl-card' + (h.on ? '' : ' off') + (h.mo ? ' mo' : '') + '" id="stcl-card-' + i + '">' +
            '<div class="stcl-row"><input type="checkbox" data-pick="' + i + '"' + (h.on ? ' checked' : '') + ' title="Lưu em này">' +
            '<button type="button" class="stcl-name" data-mo="' + i + '"><span class="stcl-ten">' + esc(h.stt + '. ' + h.ten) + '</span>' +
            '<span class="stcl-tom">' + esc(h.tomTat || '') + '</span></button>' +
            '<span id="stcl-st-' + i + '">' + statusHtml(h) + '</span>' +
            '<button type="button" class="stcl-chev" data-mo="' + i + '" title="' + (h.mo ? 'Thu gọn' : 'Xem, sửa') + '">' + (h.mo ? '▴' : '▾') + '</button></div>' +
            xem + o + '</div>';
    }

    function veLaiThe(i) {
        const c = $('stcl-card-' + i);
        if (c) c.outerHTML = cardHtml(hs[i], i);
        const n = $('stcl-card-' + i);
        if (n) n.querySelectorAll('textarea').forEach(autoH);
    }

    function renderList() {
        $('stcl-list').innerHTML = hs.map(cardHtml).join('');
        $('stcl-list').querySelectorAll('textarea').forEach(autoH);
        updateBar();
    }
    function autoH(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 220) + 'px'; }

    function updateStatus(i) {
        const el = $('stcl-st-' + i);
        if (el) el.innerHTML = statusHtml(hs[i]);
    }

    function updateBar() {
        if (state && state.active) renderKyPicker();   // khóa, mở 4 nút kỳ theo lúc đang chạy
        const bar = $('stcl-bar');
        bar.style.display = hs.length ? '' : 'none';
        const n = hs.filter(h => h.on).length;
        const btn = $('stcl-btn-save');
        btn.disabled = !n || !!running || !(state && state.quyenNhap);
        btn.textContent = saveArmed && Date.now() - saveArmed < 6000
            ? 'Bấm lần nữa để lưu ' + n + ' em vào vnEdu'
            : 'Lưu ' + n + ' em vào vnEdu';
        const daCo = hs.filter(h => h.on && h.cur && h.cur.some(t => t && t.trim())).length;
        $('stcl-ow-hint').textContent = daCo && !$('stcl-overwrite').checked
            ? daCo + ' em đã có chữ trên vnEdu: chỉ điền ô còn trống, ô đã có chữ giữ nguyên.' : '';
        $('stcl-btn-read').disabled = !!running;
        $('stcl-btn-read').textContent = hs.length ? 'Đọc lại điểm và viết lại cả lớp' : 'Đọc điểm và viết nhận xét cả lớp';
    }

    function result(html, loai) {
        const el = $('stcl-result');
        el.className = 'scn-result' + (loai ? ' ' + loai : '');
        el.innerHTML = html || '';
        el.style.display = html ? '' : 'none';
    }

    function prog(text, i, n) {
        const box = $('stcl-prog');
        if (text == null) { box.hidden = true; return; }
        box.hidden = false;
        $('stcl-prog-text').textContent = text;
        $('stcl-prog-fill').style.width = (n ? Math.round(100 * i / n) : 0) + '%';
    }

    // ---------- soạn ----------
    function soanMot(h, used) {
        const r = S.soan({ id: h.id, ten: h.ten, stt: h.stt, scores: h.scores, nlTier: h.nlTierTay ? h.nlTier : null, pcTier: h.pcTierTay ? h.pcTier : null, seed: h.seed },
            { ky: state.ky, khoi: state.khoi, engine, nlpc: nlpcData, used });
        h.texts = r.texts; h.nlTier = r.nlTier; h.pcTier = r.pcTier; h.tomTat = r.tomTat; h.coDiem = r.coDiem;
    }
    function soanCaLop() {
        try { engine.resetUsedPhrases(); } catch (e) { /* silent */ }
        const used = { mon: new Map(), nl: new Map(), pc: new Map() };
        hs.forEach(h => soanMot(h, used));
    }

    async function saveDrafts() {
        if (!ctxKey) return;
        const all = (await store(true, DRAFTS_KEY)) || {};
        all[ctxKey] = { t: Date.now(), hs: hs.map(h => ({ id: h.id, stt: h.stt, ten: h.ten, scores: h.scores, cur: h.cur, texts: h.texts,
            nlTier: h.nlTier, pcTier: h.pcTier, nlTierTay: h.nlTierTay, pcTierTay: h.pcTierTay, seed: h.seed, on: h.on, tomTat: h.tomTat, status: h.status })) };
        // giữ 8 lớp-kỳ gần nhất
        const keys = Object.keys(all).sort((a, b) => (all[b].t || 0) - (all[a].t || 0));
        keys.slice(8).forEach(k => delete all[k]);
        await store(false, DRAFTS_KEY, all);
    }
    async function loadDrafts() {
        const all = (await store(true, DRAFTS_KEY)) || {};
        const d = all[ctxKey];
        const ids = new Set((state.students || []).map(x => x.id));
        hs = d && d.hs && d.hs.length && d.hs.every(h => ids.has(h.id)) ? d.hs : [];
    }

    // ---------- bản quyền: dùng thử 1 lớp (chung lớp dùng thử Sổ nhận xét, Sổ chủ nhiệm) ----------
    function hoiBanQuyen() {
        if (!window.LicenseClient) return Promise.resolve({ allowed: true });
        const hetGio = new Promise(res => setTimeout(() => res({ allowed: true, hetGio: true }), 6000));
        const hoi = window.LicenseClient.canUseFeature('sochunhiem', '', state.lop || '')
            .catch(() => ({ allowed: true, loiMang: true }));
        return Promise.race([hoi, hetGio]);
    }

    // ---------- đọc cả lớp ----------
    async function docCaLop() {
        if (running || !state || !state.active) return;
        if (!state.ky) { note('Hãy chọn một kỳ đánh giá (Giữa kỳ, Cuối kỳ) ở ô <b>Tháng</b> trên vnEdu.', 'warn'); return; }
        const gate = await hoiBanQuyen();
        if (!gate.allowed) {
            const lyDo = gate.reason === 'free_other_class' ? 'stcl_other_class' : gate.reason;
            if (window.__snxShowLock) window.__snxShowLock(lyDo, gate);
            return;
        }
        try { await loadEngine(); } catch (e) { result('<span class="bad">Không tải được ngân hàng câu nhận xét. Thầy cô tải lại trang (F5) rồi thử lại.</span>', 'warn'); return; }
        result('');
        const reqId = newReq();
        running = { reqId, kind: 'read' };
        updateBar();
        prog('Đang đọc điểm từng em trên vnEdu… (vnEdu sẽ tự chuyển qua từng học sinh)', 0, state.students.length);
        send('COGIAO_STCL_READ', { reqId, expect: expect() });
        if (gate.dungThu && window.LicenseClient && window.LicenseClient.commitFreeSubject) {
            window.LicenseClient.commitFreeSubject('', state.lop || '').catch(() => { /* silent */ });
        }
    }

    function onReadDone(res) {
        running = null;
        prog(null);
        if (!res || !res.items) { result(loiText(res), 'warn'); updateBar(); return; }
        const cu = new Map(hs.map(h => [h.id, h]));
        hs = res.items.map(it => {
            const old = cu.get(it.id) || {};
            return {
                id: it.id, stt: it.stt, ten: it.ten, scores: it.scores || [], cur: it.texts || [null, null, null],
                seed: old.seed || 0, nlTier: old.nlTier, pcTier: old.pcTier, nlTierTay: old.nlTierTay, pcTierTay: old.pcTierTay,
                on: it.ok, status: it.ok ? '' : 'readerr', texts: ['', '', '']
            };
        });
        soanCaLop();
        hs.forEach(h => { if (!h.coDiem && h.status !== 'readerr') h.on = false; });
        if (hs[0]) hs[0].mo = true;
        renderList();
        saveDrafts();
        const chuaDiem = hs.filter(h => !h.coDiem).length;
        const loiDoc = hs.filter(h => h.status === 'readerr').length;
        const parts = ['Đã đọc ' + (hs.length - loiDoc) + '/' + hs.length + ' em và viết nhận xét. Bấm tên em để xem, sửa; xong bấm <b>Lưu</b> ở cuối.'];
        if (chuaDiem) parts.push('<span class="bad">' + chuaDiem + ' em chưa có điểm, mức đạt trên vnEdu</span> — đã bỏ chọn; nhập điểm ở Sổ điểm rồi bấm Đọc lại.');
        if (loiDoc) parts.push('<span class="bad">' + loiDoc + ' em chưa đọc được</span> (vnEdu tải chậm) — bấm Đọc lại.');
        if (res.stopped) parts.unshift('Đã dừng giữa chừng.');
        if (!res.ok) parts.unshift('<span class="bad">' + loiText(res) + '</span>');
        result(parts.map(p => '<div>' + p + '</div>').join(''), chuaDiem || loiDoc ? 'warn' : 'ok');
    }

    // ---------- lưu cả lớp ----------
    function luuCaLop() {
        if (running || !state) return;
        if (!state.quyenNhap) { result('<span class="bad">vnEdu báo tài khoản này không có quyền nhập sổ của lớp.</span>', 'warn'); return; }
        if (!saveArmed || Date.now() - saveArmed > 6000) {
            saveArmed = Date.now();
            updateBar();
            setTimeout(() => { if (saveArmed && Date.now() - saveArmed >= 6000) { saveArmed = 0; updateBar(); } }, 6100);
            return;
        }
        saveArmed = 0;
        const overwrite = $('stcl-overwrite').checked;
        const items = hs.filter(h => h.on).map(h => ({ id: h.id, texts: h.texts.map(t => String(t || '').trim()) }));
        if (!items.length) return;
        hs.forEach((h, i) => { if (h.on) { h.status = ''; updateStatus(i); } });
        const reqId = newReq();
        running = { reqId, kind: 'save', n: items.length };
        updateBar();
        result('');
        prog('Đang lưu vào vnEdu… Thầy cô đừng bấm vào vnEdu cho đến khi xong.', 0, items.length);
        send('COGIAO_STCL_SAVE', { reqId, expect: expect(), items, overwrite });
    }

    function onSaveProgress(p) {
        const it = p.item || {};
        const i = hs.findIndex(h => h.id === it.id);
        if (i >= 0) {
            hs[i].status = it.ok ? (it.unchanged ? 'same' : 'saved') : 'err';
            hs[i].msg = it.ok ? '' : (it.message || it.error || '');
            if (it.ok && !it.unchanged) {
                hs[i].cur = hs[i].cur || [null, null, null];
                hs[i].texts.forEach((t, k) => { if (!(it.skipped || []).includes(k) && t.trim()) hs[i].cur[k] = t; });
            }
            updateStatus(i);
        }
        prog('Đang lưu vào vnEdu… ' + p.i + '/' + p.n + (it.ok ? '' : ' (em vừa rồi bị lỗi)'), p.i, p.n);
    }

    function onSaveDone(res) {
        running = null;
        prog(null);
        const items = (res && res.items) || [];
        const ok = items.filter(x => x.ok && !x.unchanged).length;
        const same = items.filter(x => x.ok && x.unchanged).length;
        const bad = items.filter(x => !x.ok);
        const giu = items.filter(x => x.ok && x.skipped && x.skipped.length).length;
        const parts = [];
        if (ok) parts.push('<div class="bulk-sum-xong">Đã lưu ' + ok + ' em vào vnEdu.</div>');
        if (same) parts.push('<div>' + same + ' em không cần lưu (vnEdu đã có chữ, giữ nguyên).</div>');
        if (giu) parts.push('<div>' + giu + ' em có ô đã có chữ từ trước nên giữ nguyên ô đó. Muốn thay, đánh dấu "Ghi đè" rồi lưu lại.</div>');
        if (bad.length) {
            const ten = bad.slice(0, 6).map(x => { const h = hs.find(y => y.id === x.id); return h ? h.ten : x.id; }).join(', ');
            parts.push('<div class="bad">' + bad.length + ' em chưa lưu được: ' + esc(ten) + (bad.length > 6 ? '…' : '') + '. Bấm Lưu lại để thử các em còn lỗi.</div>');
        }
        if (res && !res.ok) parts.push('<div class="bad">' + loiText(res) + '</div>');
        if (res && res.stopped) parts.push('<div>Đã dừng theo yêu cầu.</div>');
        // còn lỗi: chỉ giữ chọn các em lỗi để bấm lưu lại cho nhanh
        if (ok && bad.length) hs.forEach((h, i) => { h.on = h.status === 'err'; const c = $('stcl-card-' + i); if (c) { c.classList.toggle('off', !h.on); const cb = c.querySelector('[data-pick]'); if (cb) cb.checked = h.on; } });
        result(parts.join('') || 'Không có em nào được lưu.', bad.length || (res && !res.ok) ? 'warn' : 'ok');
        updateBar();
        saveDrafts();
    }

    function loiText(res) {
        const e = res && res.error;
        if (e === 'context_changed') return 'Lớp hoặc kỳ trên vnEdu vừa đổi. Bảng bên đã cập nhật, thầy cô bấm lại.';
        if (e === 'no_permission') return 'vnEdu báo tài khoản này không có quyền nhập sổ của lớp.';
        if (e === 'vnedu_refused') return 'vnEdu không cho lưu: ' + esc(res.message || '');
        if (e === 'window_changed') return 'Cửa sổ Sổ theo dõi chất lượng đã đóng hoặc bị che. Mở lại rồi bấm tiếp.';
        if (e === 'many_failures') return 'vnEdu không phản hồi nhiều lần liền, đã dừng để an toàn. Kiểm tra mạng, tải lại trang (F5) rồi lưu tiếp các em còn lỗi.';
        if (e === 'busy') return 'Tiện ích đang chạy việc khác, chờ xong rồi bấm lại.';
        return 'Chưa làm được (' + esc(e || 'không rõ') + '). Thầy cô tải lại trang (F5) rồi thử lại.';
    }

    // ---------- nhận trạng thái từ content-script ----------
    async function update(ctx) {
        state = ctx || {};
        if (!state.active) return;
        renderCtx();
        if (state.ky) dangMoKy = '';
        renderKyPicker();
        const lopKey = state.lopId || state.lop || '';
        if (!state.ky && !running && !dangMoKy && lopKey && !daTuMo.has(lopKey)) {
            daTuMo.add(lopKey);
            moKy(kyTheoNgay());
        }
        const key = [state.lop, state.lopId, state.thangText].join('|');
        if (!state.quyenNhap) note('vnEdu báo tài khoản này <b>chưa có quyền nhập</b> sổ của lớp ' + esc(state.lop || '') + '. Tiện ích vẫn viết nháp được nhưng không lưu được.', 'warn');
        else if (!state.ky) note('');
        else note('');
        $('stcl-work').style.display = state.ky ? '' : 'none';
        if (key !== ctxKey) {
            if (running) return;   // đang chạy thì không đổi danh sách dưới tay thầy cô
            ctxKey = key;
            saveArmed = 0;
            result('');
            if (state.ky) {
                await loadDrafts();
                if (hs.length) { try { await loadEngine(); } catch (e) { /* silent */ } }
                renderList();
                if (hs.length) result('Đang hiện bản nháp lần trước của lớp ' + esc(state.lop) + ', ' + esc(S.KY_TEN[state.ky]) + '. Bấm <b>Đọc lại</b> nếu điểm trên vnEdu đã đổi.');
            } else { hs = []; renderList(); }
        } else updateBar();
    }

    function bind() {
        $('stcl-btn-read').addEventListener('click', docCaLop);
        $('stcl-btn-save').addEventListener('click', luuCaLop);
        $('stcl-stop').addEventListener('click', () => { send('COGIAO_STCL_STOP', {}); $('stcl-prog-text').textContent = 'Đang dừng sau em hiện tại…'; });
        $('stcl-overwrite').addEventListener('change', updateBar);
        $('stcl-ky').addEventListener('click', e => {
            const b = e.target && e.target.closest && e.target.closest('[data-ky]');
            if (!b) return;
            moKy(b.dataset.ky);
        });
        $('stcl-all').addEventListener('click', () => {
            const on = !hs.every(h => h.on);
            hs.forEach((h, i) => { h.on = on && h.coDiem !== false; });
            renderList(); saveDrafts();
        });
        $('stcl-list').addEventListener('input', e => {
            const t = e.target;
            if (!t || t.tagName !== 'TEXTAREA') return;
            const i = +t.dataset.i, k = +t.dataset.k;
            if (!hs[i]) return;
            hs[i].texts[k] = t.value;
            const l = $('stcl-len-' + i + '-' + k);
            if (l) l.textContent = t.value.length + '/500';
            autoH(t);
            clearTimeout(bind._t);
            bind._t = setTimeout(saveDrafts, 600);
        });
        $('stcl-list').addEventListener('change', e => {
            const p = e.target && e.target.dataset.pick;
            if (p == null || !hs[+p]) return;
            hs[+p].on = e.target.checked;
            e.target.closest('.stcl-card').classList.toggle('off', !e.target.checked);
            updateBar(); saveDrafts();
        });
        $('stcl-list').addEventListener('click', e => {
            const mo = e.target && e.target.closest && e.target.closest('[data-mo]');
            if (mo) { const i = +mo.dataset.mo; if (hs[i]) { hs[i].mo = !hs[i].mo; veLaiThe(i); } return; }
            const r = e.target && e.target.dataset.redo;
            if (r != null && hs[+r] && engine) {
                const h = hs[+r];
                h.seed = (h.seed || 0) + 1;
                soanMot(h, null);
                veLaiThe(+r);
                saveDrafts();
                return;
            }
            const tb = e.target && e.target.closest && e.target.closest('.stcl-tier button');
            if (tb && engine) {
                const wrap = tb.parentElement;
                const i = +wrap.dataset.i, f = wrap.dataset.f;
                const h = hs[i];
                if (!h) return;
                h[f] = tb.dataset.t;
                h[f + 'Tay'] = true;
                if (f === 'nlTier' && !h.pcTierTay) h.pcTier = null;   // PC theo NL nếu thầy cô chưa tự chọn
                soanMot(h, null);
                veLaiThe(i);
                saveDrafts();
            }
        });
        window.addEventListener('message', e => {
            const { type, payload } = e.data || {};
            if (type === 'COGIAO_STCL_PROGRESS' && payload && running && payload.reqId === running.reqId) {
                if (payload.kind === 'read') prog('Đang đọc điểm từng em trên vnEdu… ' + payload.i + '/' + payload.n, payload.i, payload.n);
                else onSaveProgress(payload);
            }
            if (type === 'COGIAO_STCL_RESULT' && payload) {
                if (payload.kind === 'open') {
                    const r = payload.result || {};
                    dangMoKy = '';
                    renderKyPicker();
                    note(r.ok ? '' : (r.error === 'not_in_list'
                        ? 'vnEdu của trường chưa có kỳ này trong ô Tháng.'
                        : 'Chưa mở được kỳ này. Thầy cô chọn ở ô <b>Tháng</b> trên vnEdu.'), r.ok ? '' : 'warn');
                    return;
                }
                if (!running || payload.reqId !== running.reqId) return;
                if (payload.kind === 'read') onReadDone(payload.result);
                if (payload.kind === 'save') onSaveDone(payload.result);
            }
        });
    }

    (function init() {
        if (!S || !$('view-so-theo-doi')) return;
        bind();
    })();

    window.StclView = { update, isRunning: () => !!running };
})();

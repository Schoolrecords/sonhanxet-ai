/**
 * 6.4.0 — Soạn nhận xét "Sổ theo dõi chất lượng" (vnEdu) cho 4 kỳ đánh giá:
 * Giữa kỳ 1 (ghk1), Cuối kỳ 1 (chk1), Giữa kỳ 2 (ghk2), Cuối kỳ 2 (chk2).
 *
 * Mỗi học sinh 3 ô (tối đa 500 ký tự mỗi ô):
 *   [0] Môn học và hoạt động giáo dục (kiến thức, kĩ năng) — theo điểm KT, mức XL từng môn đọc từ vnEdu;
 *   [1] Năng lực   — theo mức GV chọn (mặc định suy từ kết quả môn học);
 *   [2] Phẩm chất  — theo mức GV chọn (mặc định Tốt).
 *
 * Dùng lại: NhanXetEngineV2 (câu từng môn theo điểm/mức, theo kỳ, theo khối)
 *           + ngân hàng nhanxet-nlpc-giuaky.json (câu năng lực, phẩm chất).
 * Không gọi mạng, không AI ngoài: cùng dữ liệu → cùng câu (có hạt giống để "viết lại").
 */
(function (root) {
    'use strict';

    const KY_TEN = { ghk1: 'Giữa kỳ 1', chk1: 'Cuối kỳ 1', ghk2: 'Giữa kỳ 2', chk2: 'Cuối kỳ 2' };
    const TIER_TEN = { tot: 'Tốt', ht: 'Đạt', cht: 'Cần cố gắng' };
    const MAX = 500;

    function mapMon(name) {
        const lower = String(name || '').toLowerCase();
        if (lower.includes('tiếng việt')) return 'tieng-viet';
        if (lower.includes('toán')) return 'toan';
        if (lower.includes('tự nhiên') || lower.includes('xã hội')) return 'tnxh';
        if (lower.includes('khoa học')) return 'khoahoc';
        if (lower.includes('lịch sử') || lower.includes('địa lí') || lower.includes('địa lý')) return 'lichsudia';
        if (lower.includes('đạo đức')) return 'daoduc';
        if (/\(\s*công nghệ\s*\)/.test(lower)) return 'congnghe';
        if (lower.includes('công nghệ') && !lower.includes('tin học')) return 'congnghe';
        if (lower.includes('tin học')) return 'tinhoc';
        if (lower.includes('tiếng anh') || lower.includes('ngoại ngữ')) return 'tienganh';
        if (lower.includes('thể chất')) return 'gdtc';
        if (lower.includes('âm nhạc')) return 'amnhac';
        if (lower.includes('mĩ thuật') || lower.includes('mỹ thuật')) return 'mithuat';
        if (lower.includes('trải nghiệm')) return 'htn';
        return null;
    }

    /** Tên môn gọn để đưa vào câu: "Tin học và Công nghệ (Tin học)" → "Tin học". */
    function tenGon(name) {
        const s = String(name || '').replace(/\s+/g, ' ').trim();
        const m = s.match(/\(([^)]+)\)\s*$/);
        if (m && /tin học|công nghệ/i.test(s)) return m[1].trim();
        if (/hoạt động trải nghiệm/i.test(s)) return 'Hoạt động trải nghiệm';
        return s;
    }

    /** Điểm KT (số 1-10) hoặc rỗng. */
    function diemOf(kt) {
        const s = String(kt == null ? '' : kt).replace(',', '.').trim();
        if (!/^\d{1,2}(\.\d+)?$/.test(s)) return null;
        const n = parseFloat(s);
        return n >= 0 && n <= 10 ? n : null;
    }

    /** Mức T/H/C: ưu tiên XL vnEdu; không có XL mà có điểm thì suy theo điểm (chỉ để chọn giọng câu). */
    function mucOf(row) {
        const x = String(row.xl || '').trim().toUpperCase();
        if (/^(T|HTT)$/.test(x)) return 'T';
        if (/^(H|HT)$/.test(x)) return 'H';
        if (/^(C|CHT)$/.test(x)) return 'C';
        const d = diemOf(row.kt);
        if (d == null) return null;
        return d >= 9 ? 'T' : d >= 5 ? 'H' : 'C';
    }

    /** Chuẩn hoá bảng điểm đọc từ vnEdu → [{mon, ten, code, diem, muc}] (bỏ môn chưa có gì). */
    function chuanBangDiem(scores) {
        return (scores || []).map(r => ({
            mon: r.mon, ten: tenGon(r.mon), code: mapMon(r.mon), diem: diemOf(r.kt), muc: mucOf(r)
        })).filter(r => r.muc);
    }

    /** Mức năng lực mặc định suy từ kết quả môn học (GV đổi được ở bảng xem trước). */
    function nlMacDinh(rows) {
        if (!rows.length) return 'ht';
        const nC = rows.filter(r => r.muc === 'C').length;
        const nT = rows.filter(r => r.muc === 'T').length;
        const coreC = rows.some(r => (r.code === 'tieng-viet' || r.code === 'toan') && r.muc === 'C');
        if (coreC || nC >= 2) return 'cht';
        if (nC === 0 && nT * 3 >= rows.length * 2) return 'tot';
        return 'ht';
    }
    function pcMacDinh(nl) { return nl === 'cht' ? 'ht' : 'tot'; }

    function boEm(s) {
        let t = String(s || '').trim();
        t = t.replace(/^Em\s+/, '');
        return t.charAt(0).toUpperCase() + t.slice(1);
    }
    function ketCau(s) {
        const t = String(s || '').trim();
        if (!t) return '';
        return /[.!?…]$/.test(t) ? t : t + '.';
    }
    function thuongDau(s) {
        const t = String(s || '').trim();
        return t.charAt(0).toLowerCase() + t.slice(1);
    }
    function lietKe(arr) {
        if (arr.length <= 1) return arr.join('');
        // tên môn có sẵn chữ "và" (Lịch sử và Địa lí) thì nối bằng dấu phẩy, tránh "… và Lịch sử và Địa lí"
        if (arr.some(x => / và /.test(x))) {
            const ds = arr.filter(x => !/ và /.test(x)).concat(arr.filter(x => / và /.test(x)));
            return ds.join(', ');
        }
        return arr.slice(0, -1).join(', ') + ' và ' + arr[arr.length - 1];
    }

    function hash(s) {
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }

    /** Chọn câu trong pool: bắt đầu từ vị trí theo hạt giống, ưu tiên câu ít dùng nhất trong lớp. */
    function chon(pool, seedText, used) {
        if (!pool || !pool.length) return '';
        const start = hash(seedText) % pool.length;
        let best = null, bestN = Infinity;
        for (let k = 0; k < pool.length; k++) {
            const p = pool[(start + k) % pool.length];
            const n = used ? (used.get(p) || 0) : 0;
            if (n < bestN) { best = p; bestN = n; }
            if (n === 0) break;
        }
        if (used) used.set(best, (used.get(best) || 0) + 1);
        return best;
    }

    const MO_DAU = {
        tatCaTot: [
            'Hoàn thành tốt các môn học và hoạt động giáo dục.',
            'Hoàn thành tốt tất cả các môn học và hoạt động giáo dục.',
            'Học tập tốt, hoàn thành tốt các môn học và hoạt động giáo dục.'
        ],
        coTot: [
            'Hoàn thành các môn học và hoạt động giáo dục; học tốt môn {T}.',
            'Hoàn thành các môn học và hoạt động giáo dục, nổi bật ở môn {T}.',
            'Hoàn thành các môn học và hoạt động giáo dục; có thế mạnh ở môn {T}.'
        ],
        hoanThanh: [
            'Hoàn thành các môn học và hoạt động giáo dục.',
            'Hoàn thành các môn học và hoạt động giáo dục theo yêu cầu.',
            'Đạt yêu cầu các môn học và hoạt động giáo dục.'
        ],
        coChua: [
            'Chưa hoàn thành môn {C}; các môn học và hoạt động giáo dục khác đạt yêu cầu.',
            'Chưa hoàn thành môn {C}, cần được hỗ trợ thêm; các môn khác hoàn thành.',
            'Các môn học và hoạt động giáo dục khác hoàn thành; môn {C} chưa hoàn thành.'
        ]
    };

    /**
     * Ô "Môn học và hoạt động giáo dục".
     * @param engine NhanXetEngineV2 đã nạp dữ liệu (có thể null → chỉ câu mở đầu)
     */
    function vietMonHoc(hs, rows, ky, khoi, seed, engine, used) {
        if (!rows.length) return '';
        const T = rows.filter(r => r.muc === 'T'), C = rows.filter(r => r.muc === 'C');
        const sd = (hs.ten || hs.id || '') + '|' + ky + '|' + seed;
        let mo;
        if (C.length) mo = chon(MO_DAU.coChua, sd + '|mo', used).replace('{C}', lietKe(C.map(r => r.ten)));
        else if (T.length === rows.length) mo = chon(MO_DAU.tatCaTot, sd + '|mo', used);
        else if (T.length) {
            const uuTien = T.slice().sort((a, b) => (b.diem || 0) - (a.diem || 0)).slice(0, 3);
            mo = chon(MO_DAU.coTot, sd + '|mo', used).replace('{T}', lietKe(uuTien.map(r => r.ten)));
        } else mo = chon(MO_DAU.hoanThanh, sd + '|mo', used);

        // Câu từng môn: Tiếng Việt, Toán trước; rồi môn chưa hoàn thành; rồi một môn tốt khác.
        const thuTu = [];
        const tv = rows.find(r => r.code === 'tieng-viet'), toan = rows.find(r => r.code === 'toan');
        if (tv) thuTu.push(tv);
        if (toan) thuTu.push(toan);
        C.filter(r => r !== tv && r !== toan).forEach(r => thuTu.push(r));
        const totKhac = T.filter(r => r !== tv && r !== toan && r.code)
            .sort((a, b) => (b.diem || 0) - (a.diem || 0));
        if (totKhac.length) thuTu.push(totKhac[hash(sd + '|tk') % Math.min(totKhac.length, 3)]);

        let out = mo;
        if (!engine) return out.slice(0, MAX);
        for (const r of thuTu) {
            if (!r.code) continue;
            let cau = '';
            try {
                const hsE = { hoVaTen: (hs.ten || '') + '#' + seed, stt: hs.stt };
                if (r.diem != null) hsE.diem = r.diem; else hsE.mucDat = r.muc;
                cau = engine.sinhNhanXet(hsE, r.code, ky, { gradeLevel: khoi || null });
            } catch (e) { cau = ''; }
            cau = String(cau || '').trim();
            if (!cau) continue;
            const coTenMon = cau.includes(r.ten);   // phân biệt hoa thường: "tính toán" không tính là có tên môn Toán
            const cauDu = ketCau(coTenMon ? boEm(cau) : r.ten + ': ' + thuongDau(boEm(cau)));
            if ((out + ' ' + cauDu).length > MAX) continue;
            out += ' ' + cauDu;
        }
        return out;
    }

    const DAC_THU_THEO_MON = {
        'tieng-viet': 'ngon_ngu', toan: 'tinh_toan', khoahoc: 'khoa_hoc', tnxh: 'khoa_hoc',
        amnhac: 'tham_mi', mithuat: 'tham_mi', gdtc: 'the_chat', tinhoc: 'tin_hoc', congnghe: 'cong_nghe'
    };
    const PC_RIENG = ['cham_chi', 'trach_nhiem', 'trung_thuc', 'nhan_ai', 'yeu_nuoc'];

    function hopKhoi(pool, khoi) {
        if (!pool) return [];
        if (khoi && khoi >= 3) return pool.filter(s => !/đọc trơn|đánh vần/i.test(s));
        return pool;
    }

    function vietNangLuc(hs, rows, tier, khoi, seed, nlpc, used) {
        if (!nlpc) return '';
        const sd = (hs.ten || hs.id || '') + '|nl|' + seed;
        const chung = chon(hopKhoi(nlpc.nang_luc_chung.nhan_xet_chung[tier], khoi), sd + '|c', used);
        // năng lực đặc thù: môn mạnh nhất (tier tốt) hoặc môn yếu nhất (cần cố gắng)
        let key = null;
        const theoMon = rows.filter(r => DAC_THU_THEO_MON[r.code]);
        if (tier === 'cht') {
            const yeu = theoMon.find(r => r.muc === 'C') || theoMon.find(r => r.code === 'tieng-viet' || r.code === 'toan');
            key = yeu && DAC_THU_THEO_MON[yeu.code];
        } else {
            const ung = theoMon.filter(r => (tier === 'tot' ? r.muc === 'T' : r.muc !== 'C'));
            const r = ung.length ? ung[hash(sd + '|k') % Math.min(ung.length, 3)] : null;
            key = r && DAC_THU_THEO_MON[r.code];
        }
        key = key || (hash(sd) % 2 ? 'ngon_ngu' : 'tinh_toan');
        const node = nlpc.nang_luc_dac_thu[key];
        const rieng = node ? chon(hopKhoi(node[tier], khoi), sd + '|r', used) : '';
        return [ketCau(boEm(chung)), ketCau(boEm(rieng))].filter(Boolean).join(' ').slice(0, MAX);
    }

    function vietPhamChat(hs, tier, khoi, seed, nlpc, used) {
        if (!nlpc) return '';
        const sd = (hs.ten || hs.id || '') + '|pc|' + seed;
        const chung = chon(nlpc.pham_chat.nhan_xet_chung[tier], sd + '|c', used);
        const key = PC_RIENG[hash(sd + '|k') % PC_RIENG.length];
        const rieng = chon(nlpc.pham_chat[key] && nlpc.pham_chat[key][tier], sd + '|r', used);
        return [ketCau(boEm(chung)), ketCau(boEm(rieng))].filter(Boolean).join(' ').slice(0, MAX);
    }

    /**
     * Soạn 3 ô cho một học sinh.
     * @param hs   {id, ten, stt, scores:[{mon,kt,xl}], nlTier?, pcTier?, seed?}
     * @param opt  {ky, khoi, engine, nlpc, used:{mon:Map, nl:Map, pc:Map}}
     */
    function soan(hs, opt) {
        const rows = chuanBangDiem(hs.scores);
        const seed = hs.seed || 0;
        const nlTier = hs.nlTier || nlMacDinh(rows);
        const pcTier = hs.pcTier || pcMacDinh(nlTier);
        const used = opt.used || {};
        return {
            texts: [
                vietMonHoc(hs, rows, opt.ky, opt.khoi, seed, opt.engine, used.mon),
                vietNangLuc(hs, rows, nlTier, opt.khoi, seed, opt.nlpc, used.nl),
                vietPhamChat(hs, pcTier, opt.khoi, seed, opt.nlpc, used.pc)
            ],
            nlTier, pcTier,
            coDiem: rows.length > 0,
            tomTat: tomTat(rows)
        };
    }

    /** "TV 7 · Toán 9 · 2 môn T · 1 môn C" — dòng tóm tắt trong bảng xem trước. */
    function tomTat(rows) {
        if (!rows.length) return 'Chưa có điểm, mức đạt';
        const parts = [];
        const tv = rows.find(r => r.code === 'tieng-viet'), toan = rows.find(r => r.code === 'toan');
        if (tv) parts.push('TV ' + (tv.diem != null ? tv.diem : tv.muc));
        if (toan) parts.push('Toán ' + (toan.diem != null ? toan.diem : toan.muc));
        const nT = rows.filter(r => r.muc === 'T').length, nC = rows.filter(r => r.muc === 'C').length;
        parts.push(nT + ' T');
        parts.push((rows.length - nT - nC) + ' H');
        if (nC) parts.push(nC + ' C');
        return parts.join(' · ');
    }

    const api = { KY_TEN, TIER_TEN, MAX, mapMon, tenGon, chuanBangDiem, nlMacDinh, pcMacDinh, soan, tomTat };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.SoTheoDoiEngine = api;
})(typeof window !== 'undefined' ? window : this);

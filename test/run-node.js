/**
 * Node QA runner cho v0.1.8 — verify CacheManager + NLPCMapper (3 mức T/Đ/C, 13 trường)
 */
const fs = require('fs');
const { CacheManager, NLPCMapper, NhanXetEngineV2 } = require('../engine/engine.js');

let pass = 0, fail = 0;
const fails = [];

function log(name, ok, detail) {
    if (ok) {
        pass++;
    } else {
        fail++;
        fails.push({ name, detail });
        console.log(`✗ ${name}`, detail !== undefined ? JSON.stringify(detail) : '');
    }
}

async function assertThrows(fn, name) {
    try {
        await fn();
        log(name, false, 'Expected throw');
    } catch (e) {
        log(name, true);
    }
}

(async () => {
    await CacheManager.clearCache();

    // ========== GROUP 1: CacheManager.normalizeSubject ==========
    log('Tiếng Việt → tieng-viet', CacheManager.normalizeSubject('Tiếng Việt') === 'tieng-viet');
    log('Toán → toan', CacheManager.normalizeSubject('Toán') === 'toan');
    log('Khoa học → khoa-hoc', CacheManager.normalizeSubject('Khoa học') === 'khoa-hoc');
    log('GDTC → gd-the-chap', CacheManager.normalizeSubject('GDTC') === 'gd-the-chap');
    log('Môn lạ → null', CacheManager.normalizeSubject('xyz') === null);

    // ========== GROUP 2: validateScore + syncScore ==========
    log('validateScore 9 → 9', CacheManager.validateScore(9) === 9);
    log('validateScore null → null', CacheManager.validateScore(null) === null);
    await assertThrows(() => CacheManager.validateScore(11), 'throw 11');

    await CacheManager.syncScore('5A', 'Ngô Thị Bảo An', 'Tiếng Việt', 9);
    const s1 = await CacheManager.getStudentScores('5A', 'Ngô Thị Bảo An');
    log('syncScore + getStudentScores', s1.diem['tieng-viet'] === 9);

    // ========== GROUP 3: NLPCMapper 3 mức T/Đ/C ==========
    log('avg=9 → tot (T)', NLPCMapper.avgToGrade(9) === 'tot');
    log('avg=8 → tot (T) - biên', NLPCMapper.avgToGrade(8) === 'tot');
    log('avg=7.99 → ht (Đ)', NLPCMapper.avgToGrade(7.99) === 'ht');
    log('avg=5 → ht (Đ) - biên', NLPCMapper.avgToGrade(5) === 'ht');
    log('avg=4.99 → cht (C)', NLPCMapper.avgToGrade(4.99) === 'cht');
    log('avg=null → null', NLPCMapper.avgToGrade(null) === null);

    log('badge tot → T', NLPCMapper.gradeToBadge('tot') === 'T');
    log('badge ht → Đ', NLPCMapper.gradeToBadge('ht') === 'Đ');
    log('badge cht → C', NLPCMapper.gradeToBadge('cht') === 'C');

    log('cycle tot → ht', NLPCMapper.cycleGrade('tot') === 'ht');
    log('cycle ht → cht', NLPCMapper.cycleGrade('ht') === 'cht');
    log('cycle cht → tot', NLPCMapper.cycleGrade('cht') === 'tot');

    // ========== GROUP 4: NLPCMapper 13 trường — Bảo An (HS giỏi) ==========
    const baoAn = {
        'tieng-viet': 9, 'toan': 10, 'tnxh': 8, 'khoa-hoc': 9, 'lich-su-dia': 7,
        'tin-hoc': 8, 'tieng-anh': 7, 'am-nhac': 8, 'mi-thuat': 9, 'dao-duc': 9,
        'gd-the-chap': 8
    };
    const sg = NLPCMapper.scoresToGrades(baoAn);

    // Verify đủ 15 trường (3 NLC + 7 NLDT + 5 PC — V1.5 / BUG-006)
    const expectedFields = [
        'tu_chu_tu_hoc', 'giao_tiep_hop_tac', 'giai_quyet_van_de',
        'ngon_ngu', 'tinh_toan', 'khoa_hoc', 'tham_mi', 'the_chat', 'cong_nghe', 'tin_hoc',
        'yeu_nuoc', 'nhan_ai', 'cham_chi', 'trung_thuc', 'trach_nhiem'
    ];
    log('có đủ 15 trường', expectedFields.every(k => sg[k] !== undefined),
        expectedFields.filter(k => !sg[k]));

    // NL Ngôn ngữ = avg(TV9, TA7) = 8 → tot (T)
    log('NL Ngôn ngữ avg(9,7)=8 → T', sg.ngon_ngu.grade === 'tot' && sg.ngon_ngu.badge === 'T');
    log('NL Ngôn ngữ hint chứa TV+TA',
        sg.ngon_ngu.hint.includes('TV:9') && sg.ngon_ngu.hint.includes('TA:7'));

    // NL Tính toán = Toán 10 → T
    log('NL Tính toán Toán 10 → T', sg.tinh_toan.grade === 'tot' && sg.tinh_toan.badge === 'T');
    log('NL Tính toán hint = "Toán:10 → T"', sg.tinh_toan.hint === 'Toán:10 → T');

    // 7 trường mới (anh yêu cầu thêm)
    log('NL Tự chủ - dùng diem-tb fallback all → có grade', !!sg.tu_chu_tu_hoc.grade);
    log('NL Giao tiếp dùng TV+TA(+HĐTN nếu có)',
        sg.giao_tiep_hop_tac.sources.some(s => s.key === 'tieng-viet'));
    log('NL GQVĐ dùng Toán+KH+TNXH',
        sg.giai_quyet_van_de.sources.length === 3);
    log('PC Yêu nước dùng LSĐL+ĐĐ',
        sg.yeu_nuoc.sources.some(s => s.key === 'lich-su-dia') &&
        sg.yeu_nuoc.sources.some(s => s.key === 'dao-duc'));
    log('PC Nhân ái dùng ĐĐ+TV',
        sg.nhan_ai.sources.some(s => s.key === 'dao-duc'));
    log('PC Chăm chỉ fallback all subjects', sg.cham_chi.sources.length > 1);
    log('PC Trung thực có cache → grade hợp lệ', !!sg.trung_thuc.grade);
    log('PC Trách nhiệm có cache → grade hợp lệ', !!sg.trach_nhiem.grade);

    // ========== GROUP 5: HS rỗng → tất cả default Đ (ht) ==========
    const sgE = NLPCMapper.scoresToGrades({});
    log('HS rỗng: tất cả 15 trường grade=ht (default Đ)',
        Object.values(sgE).every(f => f.grade === 'ht'));
    log('HS rỗng: tất cả badge="Đ"',
        Object.values(sgE).every(f => f.badge === 'Đ'));
    log('HS rỗng: tất cả isDefault=true',
        Object.values(sgE).every(f => f.isDefault === true));

    // ========== GROUP 6: HS yếu (Đức) ==========
    const sgD = NLPCMapper.scoresToGrades({ 'tieng-viet': 3, 'toan': 4, 'tnxh': 4 });
    log('Đức NL Ngôn ngữ chỉ TV=3 → cht (C)',
        sgD.ngon_ngu.grade === 'cht' && sgD.ngon_ngu.badge === 'C');
    log('Đức NL Tính toán Toán=4 → cht', sgD.tinh_toan.grade === 'cht');

    // ========== GROUP 7: fieldsBySection() ==========
    const grouped = NLPCMapper.fieldsBySection();
    log('fieldsBySection: 3 NL chung', grouped.nang_luc_chung.length === 3);
    log('fieldsBySection: 7 NL đặc thù', grouped.nang_luc_dac_thu.length === 7);
    log('fieldsBySection: 5 PC', grouped.pham_chat.length === 5);

    // ========== GROUP 8: autoSuggestForStudent ==========
    await CacheManager.clearCache();
    await CacheManager.syncBatch('5A', 'Tiếng Việt', [{ studentId: 'Ngô Thị Bảo An', score: 9 }]);
    await CacheManager.syncBatch('5A', 'Toán', [{ studentId: 'Ngô Thị Bảo An', score: 10 }]);
    const auto = await NLPCMapper.autoSuggestForStudent('5A', 'Ngô Thị Bảo An');
    log('autoSuggest found=true', auto.found === true);
    log('autoSuggest NL Tính toán = T', auto.suggestions.tinh_toan.badge === 'T');
    const nf = await NLPCMapper.autoSuggestForStudent('5A', 'Không tồn tại');
    log('autoSuggest HS không có cache: found=false nhưng suggestions vẫn render',
        nf.found === false && Object.keys(nf.suggestions).length === 15);
    log('autoSuggest HS không có: tất cả default Đ',
        Object.values(nf.suggestions).every(f => f.grade === 'ht'));

    // ========== GROUP 9: engine.sinhNLPCDayDu xuất đúng số keys theo lớp (V1.5) ==========
    const data = JSON.parse(fs.readFileSync('./engine/data/nhanxet-ngan.json', 'utf8'));
    const engine = new NhanXetEngineV2();
    engine.loadData(data);

    const danhGia = {
        nang_luc_chung: { tu_chu_tu_hoc: 'tot', giao_tiep_hop_tac: 'tot', giai_quyet_van_de: 'ht' },
        nang_luc_dac_thu: {
            ngon_ngu: 'tot', tinh_toan: 'tot', khoa_hoc: 'tot', tham_mi: 'tot', the_chat: 'ht',
            cong_nghe: 'tot', tin_hoc: 'tot'
        },
        pham_chat: { yeu_nuoc: 'tot', nhan_ai: 'tot', cham_chi: 'tot', trung_thuc: 'tot', trach_nhiem: 'tot' }
    };

    // Lớp 5: 4 NLC + 8 NLDT (Nhận xét chung + 5 NL + Khoa học + 2 CN/Tin) + 6 PC = 18
    const r5 = engine.sinhNLPCDayDu({ hoVaTen: 'Test HS lớp 5', gradeLevel: 5 }, danhGia);
    log('engine lớp 5: NL chung 4 keys', Object.keys(r5.nang_luc_chung).length === 4);
    log('engine lớp 5: NL đặc thù 8 keys (có Khoa học + CN + Tin)', Object.keys(r5.nang_luc_dac_thu).length === 8);
    log('engine lớp 5: có Năng lực khoa học', 'Năng lực khoa học' in r5.nang_luc_dac_thu);
    log('engine lớp 5: PC 6 keys', Object.keys(r5.pham_chat).length === 6);
    log('engine lớp 5: tổng 18 nhận xét',
        Object.keys(r5.nang_luc_chung).length + Object.keys(r5.nang_luc_dac_thu).length + Object.keys(r5.pham_chat).length === 18);

    // V1.5 — Lớp 3: 4 NLC + 7 NLDT (KHÔNG Khoa học, CÓ Công nghệ + Tin học) + 6 PC = 17
    const r3 = engine.sinhNLPCDayDu({ hoVaTen: 'Test HS lớp 3', gradeLevel: 3 }, danhGia);
    log('engine lớp 3: NL đặc thù 7 keys', Object.keys(r3.nang_luc_dac_thu).length === 7);
    log('engine lớp 3: KHÔNG có Năng lực khoa học', !('Năng lực khoa học' in r3.nang_luc_dac_thu));
    log('engine lớp 3: có Năng lực công nghệ + Tin học',
        'Năng lực công nghệ' in r3.nang_luc_dac_thu && 'Năng lực tin học' in r3.nang_luc_dac_thu);

    // V1.5 — Lớp 2: 4 NLC + 5 NLDT (chỉ Nhận xét chung + 4 NL cơ bản) + 6 PC = 15
    const r2 = engine.sinhNLPCDayDu({ hoVaTen: 'Test HS lớp 2', gradeLevel: 2 }, danhGia);
    log('engine lớp 2: NL đặc thù 5 keys', Object.keys(r2.nang_luc_dac_thu).length === 5);
    log('engine lớp 2: KHÔNG có Khoa học / Công nghệ / Tin học',
        !('Năng lực khoa học' in r2.nang_luc_dac_thu) &&
        !('Năng lực công nghệ' in r2.nang_luc_dac_thu) &&
        !('Năng lực tin học' in r2.nang_luc_dac_thu));

    // Verify mỗi nhận xét là string non-empty (lấy lớp 5 làm chuẩn)
    let allTextValid = true;
    for (const sec of Object.values(r5)) {
        for (const text of Object.values(sec)) {
            if (!text || typeof text !== 'string' || text.length < 5) {
                allTextValid = false;
            }
        }
    }
    log('engine lớp 5: tất cả 18 nhận xét là text non-empty', allTextValid);

    // Tổng kết
    console.log(`\n=== ${pass} pass, ${fail} fail ===`);
    if (fails.length) {
        console.log('\nFAILS:');
        fails.forEach(f => console.log(' -', f.name, f.detail !== undefined ? JSON.stringify(f.detail) : ''));
    }
    process.exit(fail > 0 ? 1 : 0);
})();

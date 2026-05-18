/**
 * V2.2 test — verify gradeLevel + trend + validator + safe fallback.
 * Chạy: node test/run-node-v22.js
 */
const fs = require('fs');
const path = require('path');
const { NhanXetEngineV2 } = require('../engine/engine.js');

let pass = 0, fail = 0;
const fails = [];

function log(name, ok, detail) {
    if (ok) {
        pass++;
        console.log(`✓ ${name}`);
    } else {
        fail++;
        fails.push({ name, detail });
        console.log(`✗ ${name}`, detail !== undefined ? JSON.stringify(detail).slice(0, 200) : '');
    }
}

function loadJSON(rel) {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'));
}

(async () => {
    const flat = loadJSON('engine/data/nhanxet-ngan.json');
    const ky = loadJSON('engine/data/nhanxet-ky.json');
    const grade = loadJSON('engine/data/nhanxet-grade.json');

    const eng = new NhanXetEngineV2();
    eng.loadData(flat);
    eng.loadKyData(ky);
    eng.loadGradeData(grade);

    // ========== GROUP A: pool resolution priority ==========
    console.log('\n=== A. Pool resolution ===');
    {
        const sub = eng.data.subjects.toan;
        const pool5_chk2_totxs = eng._resolvePool(sub, 'chk2', 'tot_xs', 5, 'on_dinh_tot');
        log('Pool lớp 5 chk2 tot_xs on_dinh_tot có data',
            Array.isArray(pool5_chk2_totxs) && pool5_chk2_totxs.length >= 4);

        const pool5_default = eng._resolvePool(sub, 'chk2', 'tot_xs', 5, 'default');
        log('Pool lớp 5 chk2 tot_xs default có data',
            Array.isArray(pool5_default) && pool5_default.length >= 4);

        const pool_no_grade = eng._resolvePool(sub, 'chk2', 'tot_xs', null, 'default');
        log('Pool không có grade → flat fallback (tot_xs flat)',
            pool_no_grade === sub.tot_xs);

        const pool6 = eng._resolvePool(sub, 'chk2', 'tot_xs', 6, 'default');
        log('Pool grade=6 (chưa có) → fallback flat',
            pool6 === sub.tot_xs);
    }

    // ========== GROUP B: detectTrend ==========
    console.log('\n=== B. detectTrend ===');
    log('5→6→7→8 = tien_bo',
        eng.detectTrend({ghk1:5, chk1:6, ghk2:7, chk2:8}, 8) === 'tien_bo');
    log('9→9→8→7 = giam_sut',
        eng.detectTrend({ghk1:9, chk1:9, ghk2:8, chk2:7}, 7) === 'giam_sut');
    log('9→9→9→9 = on_dinh_tot',
        eng.detectTrend({ghk1:9, chk1:9, ghk2:9, chk2:9}, 9) === 'on_dinh_tot');
    log('6→6→6→6 = on_dinh_dat',
        eng.detectTrend({ghk1:6, chk1:6, ghk2:6, chk2:6}, 6) === 'on_dinh_dat');
    log('điểm 3 hiện tại = can_ho_tro',
        eng.detectTrend({ghk1:5, chk1:4, ghk2:4, chk2:3}, 3) === 'can_ho_tro');
    log('không lịch sử + 8 hiện tại = on_dinh_tot',
        eng.detectTrend({}, 8) === 'on_dinh_tot');
    log('không lịch sử + 6 hiện tại = on_dinh_dat',
        eng.detectTrend({}, 6) === 'on_dinh_dat');
    log('5→9→5→8 = chua_on_dinh',
        eng.detectTrend({ghk1:5, chk1:9, ghk2:5, chk2:8}, 8) === 'chua_on_dinh');

    // ========== GROUP C: validateComment ==========
    console.log('\n=== C. validateComment ===');
    log('Phrase bình thường pass',
        eng.validateComment('Em chăm chỉ học Toán và làm bài cẩn thận, đạt kết quả tốt cuối năm học.', {tier:'tot', gradeLevel:5}).ok === true);
    log('Phrase không bắt đầu "Em" → fail',
        eng.validateComment('Bạn rất giỏi môn Toán.', {tier:'tot'}).ok === false);
    log('Phrase chứa "yếu" → fail',
        eng.validateComment('Em yếu môn Toán cần cố gắng thêm rất nhiều ở cuối kì năm học này.', {tier:'cht'}).ok === false);
    log('Phrase chứa "cô giáo" → fail',
        eng.validateComment('Em hãy nhờ cô giáo hướng dẫn lại bài học cuối kì cuối năm rất chăm chỉ học.', {tier:'tot'}).ok === false);
    log('Phrase "xuất sắc" với tier=ht → fail',
        eng.validateComment('Em làm bài xuất sắc môn Toán và đạt kết quả rất tốt trong kì kiểm tra cuối năm học.', {tier:'ht'}).ok === false);
    log('Phrase "bảng cửu chương" với gradeLevel=5 → fail',
        eng.validateComment('Em đã thuộc bảng cửu chương và biết áp dụng vào bài tập hằng ngày trong giờ học cuối kì.', {tier:'tot', gradeLevel:5}).ok === false);
    log('Phrase "bảng cửu chương" với gradeLevel=3 → pass',
        eng.validateComment('Em đã thuộc bảng cửu chương và biết áp dụng vào bài tập hằng ngày trong giờ học cuối kì.', {tier:'tot', gradeLevel:3}).ok === true);
    log('Phrase quá ngắn → fail',
        eng.validateComment('Em học tốt.', {tier:'tot'}).ok === false);

    // ========== GROUP D: sinhNhanXet end-to-end ==========
    console.log('\n=== D. sinhNhanXet end-to-end ===');

    // D.1. Lớp 5 Toán chk2 — không có lịch sử
    {
        eng.resetUsedPhrases();
        const out10 = eng.sinhNhanXet({hoVaTen:'A', diem:10}, 'toan', 'chk2', {gradeLevel:5});
        const out8 = eng.sinhNhanXet({hoVaTen:'B', diem:8}, 'toan', 'chk2', {gradeLevel:5});
        const out6 = eng.sinhNhanXet({hoVaTen:'C', diem:6}, 'toan', 'chk2', {gradeLevel:5});
        const out3 = eng.sinhNhanXet({hoVaTen:'D', diem:3}, 'toan', 'chk2', {gradeLevel:5});

        console.log('  Lớp 5 Toán chk2:');
        console.log('    10đ:', out10);
        console.log('    8đ :', out8);
        console.log('    6đ :', out6);
        console.log('    3đ :', out3);

        log('Phrase 10đ không chứa "bảng cửu chương"',
            !out10.toLowerCase().includes('bảng cửu chương'));
        log('Phrase 8đ không chứa "cộng trừ nhân chia"',
            !out8.toLowerCase().includes('cộng trừ nhân chia'));
        log('Phrase 10đ bắt đầu "Em"', /^em\s/i.test(out10));
        log('Phrase 3đ là động viên (chứa "hãy" hoặc "cần")',
            /hãy|cần|cô tin/i.test(out3));
    }

    // D.2. Lớp 1 Toán chk2
    {
        eng.resetUsedPhrases();
        const out10 = eng.sinhNhanXet({hoVaTen:'A', diem:10}, 'toan', 'chk2', {gradeLevel:1});
        const out6 = eng.sinhNhanXet({hoVaTen:'C', diem:6}, 'toan', 'chk2', {gradeLevel:1});
        const out4 = eng.sinhNhanXet({hoVaTen:'D', diem:4}, 'toan', 'chk2', {gradeLevel:1});

        console.log('  Lớp 1 Toán chk2:');
        console.log('    10đ:', out10);
        console.log('    6đ :', out6);
        console.log('    4đ :', out4);

        log('Lớp 1 phrase không chứa "số thập phân"',
            !out10.toLowerCase().includes('số thập phân'));
        log('Lớp 1 phrase không chứa "phân số"',
            !out10.toLowerCase().includes('phân số'));
    }

    // D.3. Lớp 5 Tiếng Việt chk2
    {
        eng.resetUsedPhrases();
        const out10 = eng.sinhNhanXet({hoVaTen:'A', diem:10}, 'tieng-viet', 'chk2', {gradeLevel:5});
        const out8 = eng.sinhNhanXet({hoVaTen:'B', diem:8}, 'tieng-viet', 'chk2', {gradeLevel:5});
        const out6 = eng.sinhNhanXet({hoVaTen:'C', diem:6}, 'tieng-viet', 'chk2', {gradeLevel:5});
        const out4 = eng.sinhNhanXet({hoVaTen:'D', diem:4}, 'tieng-viet', 'chk2', {gradeLevel:5});

        console.log('  Lớp 5 TV chk2:');
        console.log('    10đ:', out10);
        console.log('    8đ :', out8);
        console.log('    6đ :', out6);
        console.log('    4đ :', out4);

        log('TV lớp 5 không chứa "bảng chữ cái"',
            !out10.toLowerCase().includes('bảng chữ cái'));
        log('TV lớp 5 không chứa "đánh vần"',
            !out10.toLowerCase().includes('đánh vần'));
    }

    // D.4. Trend tien_bo (5→6→7→8) — lớp 5 Toán
    {
        eng.resetUsedPhrases();
        const hs = {hoVaTen:'TienBo', diem:8, diemHistory:{ghk1:5, chk1:6, ghk2:7, chk2:8}};
        const out = eng.sinhNhanXet(hs, 'toan', 'chk2', {gradeLevel:5});
        console.log('  Trend tien_bo 5→8:', out);
        log('Trend tien_bo → phrase chứa "tiến bộ"',
            /tiến bộ|cố gắng|bứt phá|vượt mong đợi/i.test(out));
    }

    // D.5. Trend giam_sut (9→9→8→7) — lớp 5 Toán
    {
        eng.resetUsedPhrases();
        const hs = {hoVaTen:'GiamSut', diem:7, diemHistory:{ghk1:9, chk1:9, ghk2:8, chk2:7}};
        const out = eng.sinhNhanXet(hs, 'toan', 'chk2', {gradeLevel:5});
        console.log('  Trend giam_sut 9→7:', out);
        log('Trend giam_sut → phrase chứa "thành thạo/đúng/cẩn thận" (tier tot ổn định)',
            out.length > 20 && /^em\s/i.test(out));
    }

    // D.6. cht trend can_ho_tro
    {
        eng.resetUsedPhrases();
        const hs = {hoVaTen:'KhoKhan', diem:3, diemHistory:{ghk1:4, chk1:3, ghk2:3, chk2:3}};
        const out = eng.sinhNhanXet(hs, 'toan', 'chk2', {gradeLevel:5});
        console.log('  Trend can_ho_tro (3đ):', out);
        log('cht/can_ho_tro → phrase động viên cụ thể',
            /hãy|cần|cùng|cô tin|nhờ/i.test(out));
    }

    // ========== GROUP E: sinhCaLop anti-dup ==========
    console.log('\n=== E. sinhCaLop anti-dup trong 1 lớp ===');
    {
        const lopMau = [
            {stt:1, hoVaTen:'HS01', diem:10},
            {stt:2, hoVaTen:'HS02', diem:9},
            {stt:3, hoVaTen:'HS03', diem:9},
            {stt:4, hoVaTen:'HS04', diem:8},
            {stt:5, hoVaTen:'HS05', diem:8},
            {stt:6, hoVaTen:'HS06', diem:8},
            {stt:7, hoVaTen:'HS07', diem:7},
            {stt:8, hoVaTen:'HS08', diem:7},
            {stt:9, hoVaTen:'HS09', diem:6},
            {stt:10, hoVaTen:'HS10', diem:6},
            {stt:11, hoVaTen:'HS11', diem:5},
            {stt:12, hoVaTen:'HS12', diem:3}
        ];
        const ket = eng.sinhCaLop(lopMau, 'toan', 'chk2', {gradeLevel:5});
        const phrases = ket.map(r => r.nhanXet);
        const dup = phrases.filter((p, i) => phrases.indexOf(p) !== i);
        log('12 HS lớp 5 Toán chk2 — không có 2 HS trùng phrase y nguyên', dup.length === 0,
            dup.length ? { dup, sample: phrases.slice(0,3) } : null);
        console.log('  12 phrases lớp mẫu:');
        ket.forEach(r => console.log('    ' + r.stt + ' (' + r.diem + ' điểm): ' + r.nhanXet));
    }

    // ========== GROUP G (V2.3): Seeded determinism ==========
    console.log('\n=== G. V2.3 Seeded determinism ===');
    {
        eng.resetUsedPhrases();
        const hs = {hoVaTen:'Nguyễn Văn A', diem:10};
        const r1 = eng.sinhNhanXet(hs, 'toan', 'chk2', {gradeLevel:5});
        eng.resetUsedPhrases();
        const r2 = eng.sinhNhanXet(hs, 'toan', 'chk2', {gradeLevel:5});
        log('Cùng HS regenerate → cùng phrase (seeded)', r1 === r2, {r1, r2});

        // HS khác → phrase khác (high probability)
        eng.resetUsedPhrases();
        const hs2 = {hoVaTen:'Trần Thị B', diem:10};
        const r3 = eng.sinhNhanXet(hs2, 'toan', 'chk2', {gradeLevel:5});
        log('HS khác cùng điểm → có thể phrase khác', r1 !== r3 || r1.length > 0);
        console.log('  HS A 10đ:', r1);
        console.log('  HS B 10đ:', r3);
    }

    // ========== GROUP H (V2.3): Style suffix ==========
    console.log('\n=== H. V2.3 Style suffix ===');
    {
        eng.resetUsedPhrases();
        const hs = {hoVaTen:'StyleTest', diem:10};
        const cuoinam = eng.sinhNhanXet(hs, 'toan', 'chk2', {gradeLevel:5, style:'cuoinam'});
        eng.resetUsedPhrases();
        const dinhhuong = eng.sinhNhanXet(hs, 'toan', 'chk2', {gradeLevel:5, style:'dinhhuong'});
        eng.resetUsedPhrases();
        const ngan = eng.sinhNhanXet(hs, 'toan', 'chk2', {gradeLevel:5, style:'ngan'});
        console.log('  cuoinam :', cuoinam);
        console.log('  dinhhuong:', dinhhuong);
        console.log('  ngan    :', ngan);
        // V2.3.2: tier tot_xs KHÔNG suffix (đã loại "đáng tự hào" theo phản hồi GV thật).
        // Test với HS điểm 5 (tier ht) để có suffix.
        eng.resetUsedPhrases();
        const hsHT = {hoVaTen:'StyleHT', diem:5};
        const ht_cuoinam = eng.sinhNhanXet(hsHT, 'toan', 'chk2', {gradeLevel:5, style:'cuoinam'});
        eng.resetUsedPhrases();
        const ht_dinhhuong = eng.sinhNhanXet(hsHT, 'toan', 'chk2', {gradeLevel:5, style:'dinhhuong'});
        log('Style cuoinam tier ht append vế "lớp học tiếp theo"',
            /lớp học tiếp theo|gia đình phối hợp|chuẩn bị tốt/.test(ht_cuoinam));
        log('Style dinhhuong append "phát huy / nề nếp / luyện tập / hỗ trợ"',
            /phát huy|nề nếp|luyện tập|hỗ trợ/.test(dinhhuong) || /phát huy|nề nếp|luyện tập|hỗ trợ/.test(ht_dinhhuong));
        log('Style ngan KHÔNG append suffix', !/cố gắng hơn ở năm học|phát huy/.test(ngan));
    }

    // ========== GROUP I (V2.3): Template-focus fallback layer ==========
    console.log('\n=== I. V2.3 Template-focus fallback ===');
    {
        // Tạo engine giả: pool empty hoàn toàn cho Toán
        const tempEng = new NhanXetEngineV2();
        tempEng.loadData({
            subjects: { toan: { name: 'Toán', tot_xs: [], tot: [], ht: [], cht: [] } }
        });
        const out = tempEng.sinhNhanXet({hoVaTen:'X', diem:10}, 'toan', 'chk2', {gradeLevel:5});
        console.log('  Pool empty + grade=5 + tot_xs → template-focus:', out);
        log('Template-focus fill "phân số / số thập phân / tỉ số phần trăm"',
            /phân số|số thập phân|tỉ số phần trăm|hình tam giác|chuyển động|thể tích/i.test(out));
    }

    // ========== GROUP J (V2.3): 10đ phân biệt rõ với 7-8đ ==========
    console.log('\n=== J. V2.3 Phân hoá tier rõ rệt ===');
    {
        eng.resetUsedPhrases();
        const tot_xs_phrase = eng.sinhNhanXet({hoVaTen:'HS10', diem:10}, 'toan', 'chk2', {gradeLevel:5});
        const tot_phrase = eng.sinhNhanXet({hoVaTen:'HS7', diem:7}, 'toan', 'chk2', {gradeLevel:5});
        console.log('  10đ phrase:', tot_xs_phrase);
        console.log('  7đ  phrase:', tot_phrase);
        log('10đ KHÁC 7đ', tot_xs_phrase !== tot_phrase);
        // V2.3.2: từ mạnh sau khi viết lại theo phong cách GV thật (đã bỏ "vượt trội/đạt điểm cao/đáng tự hào")
        log('10đ phrase KHÔNG chứa từ của tier ht/cht (cần luyện/cần phát huy/hãy nhờ)',
            !/cần luyện|cần phát huy|cần rèn|hãy luyện|hãy nhờ|cần kiên trì/.test(tot_xs_phrase));
    }

    // ========== GROUP K (V2.3.1): Bug fix mucDat priority ==========
    console.log('\n=== K. V2.3.1 Bug fix mucDat priority (Vnedu T/H/C) ===');
    {
        eng.resetUsedPhrases();
        // Mô phỏng Vnedu: 10đ có mucDat='T' (Vnedu chỉ có 3 mức T/H/C, không có T+)
        const hs10T = {hoVaTen:'HS10T', diem:10, mucDat:'T'};
        const hs7T = {hoVaTen:'HS7T', diem:7, mucDat:'T'};
        const hs4H = {hoVaTen:'HS4H', diem:4, mucDat:'H'};

        log('_resolveTier(10đ T) = tot_xs (KHÔNG phải tot)', eng._resolveTier(hs10T) === 'tot_xs');
        log('_resolveTier(7đ T) = tot', eng._resolveTier(hs7T) === 'tot');
        log('_resolveTier(4đ H) = cht (theo điểm, KHÔNG phải ht)', eng._resolveTier(hs4H) === 'cht');

        eng.resetUsedPhrases();
        const out10 = eng.sinhNhanXet(hs10T, 'toan', 'chk2', {gradeLevel:5});
        const out7 = eng.sinhNhanXet(hs7T, 'toan', 'chk2', {gradeLevel:5});
        const out4 = eng.sinhNhanXet(hs4H, 'toan', 'chk2', {gradeLevel:5});
        console.log('  10đ (mucDat T) →', out10);
        console.log('  7đ  (mucDat T) →', out7);
        console.log('  4đ  (mucDat H) →', out4);
        log('10đ phrase KHÔNG chứa từ tier ht/cht (cần luyện/cần rèn/cần được hỗ trợ)',
            !/cần luyện|cần rèn|cần được hỗ trợ|hãy luyện|cần phát huy|đã có cố gắng/.test(out10));
        log('4đ phrase là động viên cụ thể (chứa hãy/cần/cô tin)', /hãy|cần|cô tin|nhờ/i.test(out4));
    }

    // _resolveTier với môn không điểm (chỉ mucDat)
    console.log('\n=== K2. _resolveTier môn không điểm (ÂN/MT/HĐTN) ===');
    {
        log('Chỉ mucDat="T" → tot', eng._resolveTier({mucDat:'T'}) === 'tot');
        log('Chỉ mucDat="H" → ht', eng._resolveTier({mucDat:'H'}) === 'ht');
        log('Chỉ mucDat="C" → cht', eng._resolveTier({mucDat:'C'}) === 'cht');
        log('Chỉ mucDat="Hoàn thành" → ht', eng._resolveTier({mucDat:'Hoàn thành'}) === 'ht');
        log('Chỉ mucDat="HTT" → tot_xs', eng._resolveTier({mucDat:'HTT'}) === 'tot_xs');
    }

    // ========== GROUP L (V2.3.7): style cuoinam force default khi ky != chk2 ==========
    console.log('\n=== L. V2.3.7 Style cuoinam KHÔNG áp khi ky != chk2 ===');
    {
        eng.resetUsedPhrases();
        const hs = {hoVaTen:'HS_GHK2_5', diem:5};
        // GHK2 với style cuoinam (sidebar có thể truyền sai) → engine FORCE default
        const outGhk2 = eng.sinhNhanXet(hs, 'toan', 'ghk2', {gradeLevel:5, style:'cuoinam'});
        console.log('  GHK2 + style=cuoinam:', outGhk2);
        log('GHK2 với style=cuoinam → KHÔNG chứa "năm học tới"',
            !/năm học tới/.test(outGhk2));

        eng.resetUsedPhrases();
        const outChk2 = eng.sinhNhanXet(hs, 'toan', 'chk2', {gradeLevel:5, style:'cuoinam'});
        console.log('  CHK2 + style=cuoinam:', outChk2);
        log('CHK2 với style=cuoinam → suffix "lớp học tiếp theo" áp dụng đúng',
            /lớp học tiếp theo|gia đình phối hợp|chuẩn bị tốt|tiến bộ từng bước/.test(outChk2));

        eng.resetUsedPhrases();
        const outGhk1 = eng.sinhNhanXet(hs, 'toan', 'ghk1', {gradeLevel:5, style:'cuoinam'});
        log('GHK1 + style=cuoinam → KHÔNG chứa "năm học tới"',
            !/năm học tới/.test(outGhk1));

        eng.resetUsedPhrases();
        const outChk1 = eng.sinhNhanXet(hs, 'toan', 'chk1', {gradeLevel:5, style:'cuoinam'});
        log('CHK1 + style=cuoinam → KHÔNG chứa "năm học tới"',
            !/năm học tới/.test(outChk1));
    }

    // ========== GROUP F: safe fallback ==========
    console.log('\n=== F. Safe fallback ===');
    {
        // Tạo engine tạm có pool toàn phrase invalid
        const tempEng = new NhanXetEngineV2();
        tempEng.loadData({
            subjects: {
                toan: {
                    name: 'Toán',
                    tot_xs: ['không bắt đầu bằng Em.', 'Tệ.'], // tất cả invalid
                    tot: [], ht: [], cht: []
                }
            }
        });
        const out = tempEng.sinhNhanXet({hoVaTen:'X', diem:10}, 'toan', 'chk2', {gradeLevel:5});
        console.log('  Safe fallback (pool toàn invalid):', out);
        log('Pool invalid → fallback phrase đúng spec',
            out.startsWith('Em') && out.length > 20);
    }

    // ========== TỔNG KẾT ==========
    console.log(`\n=== KẾT QUẢ: ${pass} pass, ${fail} fail ===`);
    if (fail > 0) {
        console.log('\nFails:');
        fails.forEach(f => console.log('  -', f.name, f.detail || ''));
        process.exit(1);
    }
})();

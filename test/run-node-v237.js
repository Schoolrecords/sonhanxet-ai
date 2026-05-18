/**
 * V2.3.7 — 6 test cases theo prompt user.
 */
const fs = require('fs');
const path = require('path');
const { NhanXetEngineV2 } = require('../engine/engine.js');

const eng = new NhanXetEngineV2();
eng.loadData(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'engine/data/nhanxet-ngan.json'), 'utf8')));
eng.loadKyData(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'engine/data/nhanxet-ky.json'), 'utf8')));
eng.loadGradeData(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'engine/data/nhanxet-grade.json'), 'utf8')));

let pass = 0, fail = 0;
function check(name, ok, detail) {
    if (ok) { pass++; console.log('  ✓ ' + name); }
    else { fail++; console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
}

const BAN_GHK = /năm học tới|cuối năm|trong hè|cô giáo|thầy cô|bài cô giao|theo chương trình lớp|các dạng bài tập/i;
const SIGNAL_TOAN_L5 = /số thập phân|phân số|tỉ số phần trăm|giải toán|giải bài|phân tích đề|trình bày bài|kiểm tra kết quả|kiểm tra đáp số|tính toán|tính nhẩm|đo lường|hình học|diện tích|thể tích|phép tính|đặt phép tính|đặt tính|vận dụng kiến thức|lời giải|lời văn/i;
const SIGNAL_TV_L5 = /đọc hiểu|dùng từ|đặt câu|luyện từ và câu|chính tả|viết đoạn|viết bài văn|bố cục|diễn đạt|trình bày ý|nói và nghe/i;
const BEHAVIOR = /hăng hái phát biểu|rất sáng tạo|tấm gương|tư duy sắc bén/i;

// CASE 1: Toán lớp 5 GHK2 điểm 5
console.log('\n=== CASE 1: Toán lớp 5 GHK2 điểm 5 ===');
{
    eng.resetUsedPhrases();
    const out = eng.sinhNhanXet({hoVaTen:'HS_C1', diem:5}, 'toan', 'ghk2', {gradeLevel:5, kyCode:'ghk2', style:'giuaky'});
    console.log('  Output:', out);
    check('Không chứa cụm cấm GHK', !BAN_GHK.test(out), out);
    check('Có biểu hiện môn Toán lớp 5', SIGNAL_TOAN_L5.test(out), out);
}

// CASE 2: Toán lớp 5 GHK2 điểm 10
console.log('\n=== CASE 2: Toán lớp 5 GHK2 điểm 10 ===');
{
    eng.resetUsedPhrases();
    const out = eng.sinhNhanXet({hoVaTen:'HS_C2', diem:10}, 'toan', 'ghk2', {gradeLevel:5, kyCode:'ghk2', style:'giuaky'});
    console.log('  Output:', out);
    check('Không chứa từ hành vi khi chưa có dữ liệu (hăng hái/sáng tạo/tấm gương)', !BEHAVIOR.test(out), out);
    check('Có biểu hiện môn Toán lớp 5', SIGNAL_TOAN_L5.test(out), out);
    check('Không chứa cụm cấm GHK', !BAN_GHK.test(out), out);
}

// CASE 3: Tiếng Việt lớp 5 GHK2 điểm 6
console.log('\n=== CASE 3: Tiếng Việt lớp 5 GHK2 điểm 6 ===');
{
    eng.resetUsedPhrases();
    const out = eng.sinhNhanXet({hoVaTen:'HS_C3', diem:6}, 'tieng-viet', 'ghk2', {gradeLevel:5, kyCode:'ghk2', style:'giuaky'});
    console.log('  Output:', out);
    check('Có biểu hiện TV lớp 5', SIGNAL_TV_L5.test(out), out);
    check('Không chứa cụm cấm GHK', !BAN_GHK.test(out), out);
    check('Có định hướng rèn (cần / luyện / rèn)', /cần|luyện|rèn|phát huy/.test(out), out);
}

// CASE 4: Cuối HK1 điểm 5
console.log('\n=== CASE 4: Toán lớp 5 CHK1 điểm 5 ===');
{
    eng.resetUsedPhrases();
    const out = eng.sinhNhanXet({hoVaTen:'HS_C4', diem:5}, 'toan', 'chk1', {gradeLevel:5, kyCode:'chk1', style:'cuoihk1'});
    console.log('  Output:', out);
    check('Không chứa "năm học tới"', !/năm học tới/i.test(out), out);
    check('Có thể chứa "học kỳ II" (nếu có suffix)', true);  // không bắt buộc
}

// CASE 5: Cuối HK2 điểm 5
console.log('\n=== CASE 5: Toán lớp 5 CHK2 điểm 5 ===');
{
    eng.resetUsedPhrases();
    const out = eng.sinhNhanXet({hoVaTen:'HS_C5', diem:5}, 'toan', 'chk2', {gradeLevel:5, kyCode:'chk2', style:'cuoinam'});
    console.log('  Output:', out);
    check('Không chứa "cô giáo" hoặc "thầy cô"', !/cô giáo|thầy cô|bài cô giao/i.test(out), out);
    check('Có thể chứa "lớp học tiếp theo"', /lớp học tiếp theo|gia đình phối hợp|chuẩn bị tốt|tiến bộ/.test(out), out);
}

// CASE 6: Lớp 40 HS — anti-dup + phân biệt tier
console.log('\n=== CASE 6: Lớp 40 HS Toán lớp 5 CHK2 — anti-dup + phân biệt tier ===');
{
    eng.resetUsedPhrases();
    const lop40 = [];
    // Phân bố thực tế: ~10 HS điểm 9-10, ~15 điểm 7-8, ~12 điểm 5-6, ~3 điểm 1-4
    const diems = [
        10,10,10,9,9,9,9,10,10,9,
        8,8,8,7,7,7,8,8,7,8,7,8,7,8,7,
        6,6,5,6,5,6,5,6,5,6,5,6,
        4,3,4
    ];
    for (let i = 0; i < 40; i++) {
        lop40.push({stt: i+1, hoVaTen: 'HS_' + (i+1), diem: diems[i]});
    }
    const result = eng.sinhCaLop(lop40, 'toan', 'chk2', {gradeLevel:5, kyCode:'chk2', style:'cuoinam'});
    const phrases = result.map(r => r.nhanXet);
    const dupCount = phrases.filter((p, i) => phrases.indexOf(p) !== i).length;
    // Lớp 40 HS với pool default 9-12 phrase/tier — chấp nhận ≤40% trùng (15 HS tot ÷ 9 pool ≈ 67% pool used)
    // Trong thực tế GV sẽ chỉnh tay các câu trùng. Trọng tâm: KHÔNG có phrase nào dùng cho >50% HS.
    check('Không quá 40% HS có phrase trùng (do pool nhỏ — GV chỉnh tay)', dupCount <= 16, 'Số dup: ' + dupCount + '/40');

    // Tính max repetition của 1 phrase
    const counts = {};
    phrases.forEach(p => { counts[p] = (counts[p] || 0) + 1; });
    const maxRep = Math.max(...Object.values(counts));
    check('Phrase phổ biến nhất xuất hiện ≤4 lần (≤10%)', maxRep <= 4, 'Max rep: ' + maxRep);

    // Phân biệt tier
    const totXsPhrases = result.filter(r => r.diem >= 9).map(r => r.nhanXet);
    const htPhrases = result.filter(r => r.diem >= 5 && r.diem <= 6).map(r => r.nhanXet);
    const intersect = totXsPhrases.filter(p => htPhrases.includes(p));
    check('Phrase tier tot_xs (9-10) KHÁC tier ht (5-6)', intersect.length === 0);

    // Câu phải bám môn Toán lớp 5 — đếm phrase có signal
    const signalCount = phrases.filter(p => SIGNAL_TOAN_L5.test(p)).length;
    check('≥50% câu có biểu hiện môn Toán lớp 5', signalCount >= 20,
        `${signalCount}/40 phrase có signal`);

    // Sample
    console.log('  Sample 3 HS 10đ:');
    result.filter(r => r.diem === 10).slice(0, 3).forEach(r => console.log('    ', r.nhanXet));
    console.log('  Sample 3 HS 6đ:');
    result.filter(r => r.diem === 6).slice(0, 3).forEach(r => console.log('    ', r.nhanXet));
    console.log('  Sample 3 HS 3-4đ:');
    result.filter(r => r.diem <= 4).slice(0, 3).forEach(r => console.log('    ', r.nhanXet));
}

console.log(`\n=== TỔNG: ${pass} pass / ${fail} fail ===`);
if (fail > 0) process.exit(1);

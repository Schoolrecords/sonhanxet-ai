/**
 * V2.3.8 — 12 test cases theo prompt user.
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

// Regex chung
const TEACHER_RE = /(?:^|[^a-zA-ZÀ-ỹ0-9])(cô|thầy|thầy cô|cô giáo|thầy giáo)(?:[^a-zA-ZÀ-ỹ0-9]|$)/i;
const YEAR_FORBID = /năm học tới|trong hè|lớp học tiếp theo/i;
const CUOI_NAM = /cuối năm/i;
const BEHAVIOR = /hăng hái phát biểu|có năng khiếu|tư duy sắc bén|tấm gương|rất sáng tạo/i;
const SIGNAL_TOAN = /số|phép tính|tính toán|cộng trừ|nhân chia|phân số|số thập phân|tỉ số phần trăm|đo lường|hình học|diện tích|thể tích|chu vi|giải toán|lời giải|phân tích đề|trình bày bài giải|kiểm tra kết quả|đại lượng|đặt tính|biểu thức|bài toán|đếm|đọc viết số|nhận biết hình|hình vuông|hình tam giác|hình tròn/i;
const SIGNAL_TV = /đọc|đọc hiểu|chính tả|viết|viết câu|viết đoạn|viết bài|dùng từ|đặt câu|luyện từ và câu|bố cục|diễn đạt|trình bày ý|nói và nghe|kể chuyện|văn bản|đoạn văn|bài văn|từ loại|đại từ|quan hệ từ/i;
const REMEDIATION = /cần luyện|cần rèn|cần củng cố|cần được hỗ trợ|cần chú ý|nên luyện|gia đình phối hợp|hãy luyện|cần tiếp tục|kiên trì/i;

function caseAssert(label, params) {
    console.log('\n=== ' + label + ' ===');
    eng.resetUsedPhrases();
    const out = eng.sinhNhanXet(
        { hoVaTen: params.name || 'HS', diem: params.diem, mucDat: params.mucDat },
        params.subjectCode, params.ky,
        { gradeLevel: params.gradeLevel, kyCode: params.ky, style: params.style }
    );
    console.log('  Output:', out);
    check('Không chứa cô/thầy/cô giáo (word-boundary)', !TEACHER_RE.test(out), out);
    if (params.ky === 'ghk1' || params.ky === 'ghk2' || params.ky === 'chk1') {
        check('Không "năm học tới/trong hè/lớp học tiếp theo"', !YEAR_FORBID.test(out));
        check('Không "cuối năm"', !CUOI_NAM.test(out));
    }
    check('Không suy diễn hành vi (hăng hái/năng khiếu/tấm gương)', !BEHAVIOR.test(out), out);
    if (params.subjectCode === 'toan') {
        check('Toán: có subject signal', SIGNAL_TOAN.test(out), out);
    } else if (params.subjectCode === 'tieng-viet') {
        check('TV: có subject signal', SIGNAL_TV.test(out), out);
    }
    if (params.diem >= 5 && params.diem <= 6 || params.diem < 5) {
        check('Tier ht/cht có định hướng rèn luyện', REMEDIATION.test(out), out);
    }
    return out;
}

// 1. Toán lớp 5 GHK1 điểm 5
caseAssert('CASE 1: Toán lớp 5 GHK1 điểm 5', { name:'HS1', diem:5, subjectCode:'toan', ky:'ghk1', gradeLevel:5, style:'auto' });
// 2. Toán lớp 5 CHK1 điểm 5
caseAssert('CASE 2: Toán lớp 5 CHK1 điểm 5', { name:'HS2', diem:5, subjectCode:'toan', ky:'chk1', gradeLevel:5, style:'auto' });
// 3. Toán lớp 5 GHK2 điểm 5
caseAssert('CASE 3: Toán lớp 5 GHK2 điểm 5', { name:'HS3', diem:5, subjectCode:'toan', ky:'ghk2', gradeLevel:5, style:'auto' });
// 4. Toán lớp 5 CHK2 điểm 5
caseAssert('CASE 4: Toán lớp 5 CHK2 điểm 5', { name:'HS4', diem:5, subjectCode:'toan', ky:'chk2', gradeLevel:5, style:'auto' });
// 5. Toán lớp 5 GHK2 điểm 10
caseAssert('CASE 5: Toán lớp 5 GHK2 điểm 10', { name:'HS5', diem:10, subjectCode:'toan', ky:'ghk2', gradeLevel:5, style:'auto' });
// 6. Toán lớp 5 GHK2 điểm 7
caseAssert('CASE 6: Toán lớp 5 GHK2 điểm 7', { name:'HS6', diem:7, subjectCode:'toan', ky:'ghk2', gradeLevel:5, style:'auto' });
// 7. Toán lớp 5 GHK2 điểm 3
caseAssert('CASE 7: Toán lớp 5 GHK2 điểm 3', { name:'HS7', diem:3, subjectCode:'toan', ky:'ghk2', gradeLevel:5, style:'auto' });
// 8. TV lớp 5 GHK2 điểm 6
caseAssert('CASE 8: TV lớp 5 GHK2 điểm 6', { name:'HS8', diem:6, subjectCode:'tieng-viet', ky:'ghk2', gradeLevel:5, style:'auto' });
// 9. TV lớp 5 CHK2 điểm 9
caseAssert('CASE 9: TV lớp 5 CHK2 điểm 9', { name:'HS9', diem:9, subjectCode:'tieng-viet', ky:'chk2', gradeLevel:5, style:'auto' });
// 10. Toán lớp 1 GHK1 điểm 5
caseAssert('CASE 10: Toán lớp 1 GHK1 điểm 5', { name:'HS10', diem:5, subjectCode:'toan', ky:'ghk1', gradeLevel:1, style:'auto' });
// 11. TV lớp 1 GHK1 điểm 5
caseAssert('CASE 11: TV lớp 1 GHK1 điểm 5', { name:'HS11', diem:5, subjectCode:'tieng-viet', ky:'ghk1', gradeLevel:1, style:'auto' });

// 12. Lớp 40 HS Toán lớp 5 GHK2
console.log('\n=== CASE 12: Lớp 40 HS Toán lớp 5 GHK2 ===');
{
    eng.resetUsedPhrases();
    const lop40 = [];
    const diems = [3,4,5,5,6,6,6,7,7,7,7,7,8,8,8,8,8,8,8,8,9,9,9,9,9,9,9,9,9,9,10,10,10,10,5,6,7,8,9,10];
    for (let i = 0; i < 40; i++) {
        lop40.push({ stt: i+1, hoVaTen: 'HS_'+(i+1), diem: diems[i] });
    }
    const result = eng.sinhCaLop(lop40, 'toan', 'ghk2', { gradeLevel:5, kyCode:'ghk2', style:'auto' });
    const phrases = result.map(r => r.nhanXet);

    // Check không có cô/thầy
    const hasCo = phrases.some(p => TEACHER_RE.test(p));
    check('Tất cả 40 câu không có cô/thầy', !hasCo);
    // Check không có "năm học tới"
    const hasYear = phrases.some(p => YEAR_FORBID.test(p));
    check('Tất cả 40 câu không có "năm học tới/lớp học tiếp theo"', !hasYear);
    // Check không hành vi
    const hasBeh = phrases.some(p => BEHAVIOR.test(p));
    check('Tất cả 40 câu không suy diễn hành vi', !hasBeh);
    // Phrase trùng nhiều nhất
    const counts = {};
    phrases.forEach(p => counts[p] = (counts[p]||0) + 1);
    const maxRep = Math.max(...Object.values(counts));
    check('Phrase phổ biến nhất ≤5/40 (≤12.5%)', maxRep <= 5, 'Max rep: ' + maxRep);
    // Tier phân biệt
    const totXs = result.filter(r => r.diem >= 9).map(r => r.nhanXet);
    const htP = result.filter(r => r.diem >= 5 && r.diem <= 6).map(r => r.nhanXet);
    const intersect = totXs.filter(p => htP.includes(p));
    check('tot_xs khác ht (không trùng phrase)', intersect.length === 0);

    console.log('  Sample 3 HS 10đ:');
    result.filter(r => r.diem === 10).slice(0,3).forEach(r => console.log('    ', r.nhanXet));
    console.log('  Sample 3 HS 6đ:');
    result.filter(r => r.diem === 6).slice(0,3).forEach(r => console.log('    ', r.nhanXet));
    console.log('  Sample 1 HS 3đ:');
    result.filter(r => r.diem === 3).slice(0,1).forEach(r => console.log('    ', r.nhanXet));
}

console.log(`\n=== TỔNG: ${pass} pass / ${fail} fail ===`);
if (fail > 0) process.exit(1);

/**
 * V4.0 test — 8 cases theo prompt ChatGPT (VII), nhưng quy tắc theo phong cách
 * THDienLien anh user đã chọn:
 * - KHÔNG bắt regex "phát biểu / năng khiếu / tấm gương" (cho phép — mẫu THDienLien có)
 * - GIỮ bắt: cô/thầy không kèm "thầy cô", năm học tới cho GHK, định hướng rèn cho ht/cht
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

// Word-boundary cho "cô"/"thầy" — bắt khi đứng riêng (vd "cô giảng"), KHÔNG bắt
// khi đứng trong cụm "thầy cô" (mẫu THDienLien cho phép cụm này trong NL/PC).
const TEACHER_BAN_RE = /(?:^|[^a-zA-ZÀ-ỹ0-9])(cô|thầy)(?:\s+(?!cô\b))/i;
const YEAR_FORBID = /năm học tới|trong hè|lớp học tiếp theo|cuối năm/i;
const REMEDIATION_RE = /cần luyện|cần rèn|cần củng cố|cần được hỗ trợ|cần chú ý|gia đình phối hợp|gia đình cùng|cần phát huy|cần tiếp tục|hãy luyện|kiên trì|cần cố gắng|phát huy thêm|nên luyện|cần ôn/i;

function caseAssert(label, params) {
    console.log('\n=== ' + label + ' ===');
    eng.resetUsedPhrases();
    const out = eng.sinhNhanXet(
        { hoVaTen: params.name || 'HS', diem: params.diem, mucDat: params.mucDat },
        params.subjectCode, params.ky,
        { gradeLevel: params.gradeLevel, kyCode: params.ky, style: params.style || 'auto' }
    );
    console.log('  Output:', out);
    check('Không "cô/thầy" đứng riêng (cô giảng/hỏi cô...)', !TEACHER_BAN_RE.test(out), out);
    if (params.ky === 'ghk1' || params.ky === 'ghk2' || params.ky === 'chk1') {
        check('Không "năm học tới/trong hè/lớp học tiếp theo/cuối năm"', !YEAR_FORBID.test(out));
    }
    if (params.diem >= 5 && params.diem <= 6) {
        check('Tier ht (5-6) có định hướng rèn luyện', REMEDIATION_RE.test(out), out);
    }
    if (params.diem < 5) {
        check('Tier cht (<5) có định hướng rèn/hỗ trợ', REMEDIATION_RE.test(out), out);
    }
    return out;
}

// 8 cases theo prompt ChatGPT
caseAssert('CASE 1: Toán lớp 1 GHK1 điểm 5', { name:'HS1', diem:5, subjectCode:'toan', ky:'ghk1', gradeLevel:1 });
caseAssert('CASE 2: Toán lớp 5 GHK2 điểm 5', { name:'HS2', diem:5, subjectCode:'toan', ky:'ghk2', gradeLevel:5 });
caseAssert('CASE 3: Toán lớp 5 GHK2 điểm 10', { name:'HS3', diem:10, subjectCode:'toan', ky:'ghk2', gradeLevel:5 });
caseAssert('CASE 4: Toán lớp 5 CHK2 điểm 9', { name:'HS4', diem:9, subjectCode:'toan', ky:'chk2', gradeLevel:5 });
caseAssert('CASE 5: TV lớp 1 GHK1 điểm 5', { name:'HS5', diem:5, subjectCode:'tieng-viet', ky:'ghk1', gradeLevel:1 });
caseAssert('CASE 6: TV lớp 5 GHK2 điểm 6', { name:'HS6', diem:6, subjectCode:'tieng-viet', ky:'ghk2', gradeLevel:5 });
caseAssert('CASE 7: TV lớp 5 CHK2 điểm 9', { name:'HS7', diem:9, subjectCode:'tieng-viet', ky:'chk2', gradeLevel:5 });

// CASE 8: Lớp 40 HS Toán lớp 5 GHK2
console.log('\n=== CASE 8: Lớp 40 HS Toán lớp 5 GHK2 ===');
{
    eng.resetUsedPhrases();
    const lop40 = [];
    const diems = [3,4,5,5,6,6,6,7,7,7,7,7,8,8,8,8,8,8,8,8,9,9,9,9,9,9,9,9,9,9,10,10,10,10,5,6,7,8,9,10];
    for (let i = 0; i < 40; i++) {
        lop40.push({ stt: i+1, hoVaTen: 'HS_'+(i+1), diem: diems[i] });
    }
    const result = eng.sinhCaLop(lop40, 'toan', 'ghk2', { gradeLevel:5, kyCode:'ghk2', style:'auto' });
    const phrases = result.map(r => r.nhanXet);

    check('40/40 câu không có "cô/thầy" đứng riêng', !phrases.some(p => TEACHER_BAN_RE.test(p)));
    check('40/40 câu không có "năm học tới/lớp học tiếp theo/cuối năm" (GHK2)', !phrases.some(p => YEAR_FORBID.test(p)));

    // Tier ht/cht phải có remediation
    const htFail = result.filter(r => (r.diem >= 5 && r.diem <= 6) && !REMEDIATION_RE.test(r.nhanXet));
    const chtFail = result.filter(r => r.diem < 5 && !REMEDIATION_RE.test(r.nhanXet));
    check('Tất cả HS điểm 5-6 có định hướng rèn', htFail.length === 0, 'Fail ' + htFail.length);
    check('Tất cả HS điểm 1-4 có định hướng rèn/hỗ trợ', chtFail.length === 0, 'Fail ' + chtFail.length);

    const counts = {};
    phrases.forEach(p => counts[p] = (counts[p]||0) + 1);
    const maxRep = Math.max(...Object.values(counts));
    check('Phrase phổ biến nhất ≤6/40 (~15%)', maxRep <= 6, 'Max rep: ' + maxRep);

    // Sample
    console.log('  Sample 3 HS 10đ:');
    result.filter(r => r.diem === 10).slice(0,3).forEach(r => console.log('    ', r.nhanXet));
    console.log('  Sample 3 HS 6đ:');
    result.filter(r => r.diem === 6).slice(0,3).forEach(r => console.log('    ', r.nhanXet));
    console.log('  Sample 2 HS 3-4đ:');
    result.filter(r => r.diem <= 4).slice(0,2).forEach(r => console.log('    ', r.nhanXet));
}

console.log(`\n=== TỔNG: ${pass} pass / ${fail} fail ===`);
if (fail > 0) process.exit(1);

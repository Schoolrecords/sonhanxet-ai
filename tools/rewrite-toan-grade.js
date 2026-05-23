// V6.1.2 — Rewrite ngân hàng Toán × 5 lớp × 3 kỳ × 4 tier theo TT27 + CT GDPT 2018.
// Dạng HỌC BẠ trực tiếp (KHÔNG xưng "Em"), band 80-115 ký tự, mô tả biểu hiện.
//
// CT GDPT 2018 môn Toán:
//   Lớp 1: số trong 100, cộng trừ không nhớ, nhận biết hình đơn giản, đo độ dài bằng đơn vị quen
//   Lớp 2: cộng trừ có nhớ trong 1000, nhân chia bước đầu, đo đại lượng, chu vi hình tứ giác
//   Lớp 3: nhân chia với số có 2 chữ số, biểu thức, chu vi/diện tích HCN/HV, đo thời gian
//   Lớp 4: 4 phép tính số tự nhiên lớn, phân số bước đầu, diện tích bình hành/thoi, đổi đơn vị
//   Lớp 5: phân số/số thập phân/tỉ số %, diện tích tam giác/thang/tròn, thể tích hộp, chuyển động
//
// Spirit kỳ: ghk1=bước đầu/cơ bản | chk1=nắm vững/tiến bộ | ghk2=vận dụng/phối hợp.

const fs = require('fs');
const path = 'engine/data/nhanxet-grade.json';
const TOAN = require('./data/toan-v61.js');

// VERIFY: band 80-115 ký tự + không xưng Em.
let total = 0, ok = 0, bad = [];
for (const g of Object.keys(TOAN)) {
    for (const k of Object.keys(TOAN[g])) {
        for (const tier of Object.keys(TOAN[g][k])) {
            for (const s of TOAN[g][k][tier]) {
                total++;
                const L = s.length;
                if (L >= 80 && L <= 115) ok++;
                else bad.push({g, k, tier, L, s});
                if (/^Em\s/i.test(s)) bad.push({g, k, tier, L: 'XƯNG EM!', s});
            }
        }
    }
}
console.log(`TỔNG: ${total} câu | OK band 80-115 + không xưng Em: ${ok}/${total}`);
if (bad.length) {
    console.log('\nVI PHẠM:');
    for (const b of bad.slice(0, 20)) console.log(`  L${b.g}.${b.k}.${b.tier} [${b.L}] ${b.s}`);
    if (bad.length > 20) console.log(`  ... +${bad.length-20} câu khác`);
    console.log('\n⛔ KHÔNG patch — sửa câu trước rồi chạy lại');
    process.exit(1);
}

// VERIFY validator
const eng = require('../engine/engine.js');
const ngan = JSON.parse(fs.readFileSync('engine/data/nhanxet-ngan.json', 'utf8'));
const ky = JSON.parse(fs.readFileSync('engine/data/nhanxet-ky.json', 'utf8'));
const gradeOld = JSON.parse(fs.readFileSync(path, 'utf8'));
const e = new eng.NhanXetEngineV2();
e.loadData(ngan).loadKyData(ky).loadGradeData(gradeOld);

let validatorFails = [];
for (const g of Object.keys(TOAN)) {
    for (const k of Object.keys(TOAN[g])) {
        for (const tier of Object.keys(TOAN[g][k])) {
            for (const s of TOAN[g][k][tier]) {
                const v = e.validateComment(s, {tier, kyCode: k, gradeLevel: parseInt(g)});
                if (!v.ok) validatorFails.push({g, k, tier, reason: v.reason, s});
            }
        }
    }
}
if (validatorFails.length) {
    console.log(`\n⚠ Validator V6.1.2 reject ${validatorFails.length}/${total} câu:`);
    for (const f of validatorFails.slice(0, 30)) {
        console.log(`  L${f.g}.${f.k}.${f.tier} [${f.reason}] ${f.s}`);
    }
    if (validatorFails.length > 30) console.log(`  ... +${validatorFails.length-30} fail khác`);
    console.log('\n⛔ KHÔNG patch — sửa phrase để pass validator rồi chạy lại');
    process.exit(1);
}
console.log(`✓ Validator V6.1.2: ${total}/${total} pass`);

// PATCH grade-data
const json = gradeOld;
if (!json.subjects.toan.grades) json.subjects.toan.grades = {};
for (const g of Object.keys(TOAN)) {
    json.subjects.toan.grades[g] = {};
    for (const k of Object.keys(TOAN[g])) {
        json.subjects.toan.grades[g][k] = {};
        for (const tier of Object.keys(TOAN[g][k])) {
            json.subjects.toan.grades[g][k][tier] = { default: TOAN[g][k][tier] };
        }
    }
}
json.meta.note_v612_toan = 'V6.1.2 (2026-05-23): rewrite Toán grade-data theo CT GDPT 2018 — 5 lớp × 3 kỳ × 4 tier = 60 cell × 4 phrase = 240 phrase, dạng học bạ TT27 (không xưng Em), band 80-115 ký tự.';
fs.writeFileSync(path, JSON.stringify(json, null, 2) + '\n', 'utf8');
console.log('\n✅ Đã patch ' + path);

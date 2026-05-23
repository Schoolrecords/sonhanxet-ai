// V6.1.x — Rewrite Công nghệ ky-data.
const fs = require('fs');
const path = 'engine/data/nhanxet-ky.json';
const CN = require('./data/congnghe-v61.js');

let total = 0, ok = 0, bad = [];
for (const k of Object.keys(CN)) {
    for (const tier of Object.keys(CN[k])) {
        for (const s of CN[k][tier]) {
            total++;
            const L = s.length;
            if (L >= 90 && L <= 110) ok++;
            else bad.push({k, tier, L, s});
            if (/^Em\s/i.test(s)) bad.push({k, tier, L: 'XƯNG EM!', s});
        }
    }
}
console.log(`TỔNG: ${total} câu | OK band 90-110 + không xưng Em: ${ok}/${total}`);
if (bad.length) {
    console.log('\nVI PHẠM:');
    for (const b of bad.slice(0, 20)) console.log(`  ${b.k}.${b.tier} [${b.L}] ${b.s}`);
    if (bad.length > 20) console.log(`  ... +${bad.length-20} câu khác`);
    process.exit(1);
}

const eng = require('../engine/engine.js');
const ngan = JSON.parse(fs.readFileSync('engine/data/nhanxet-ngan.json', 'utf8'));
const ky = JSON.parse(fs.readFileSync(path, 'utf8'));
const grade = JSON.parse(fs.readFileSync('engine/data/nhanxet-grade.json', 'utf8'));
const e = new eng.NhanXetEngineV2();
e.loadData(ngan).loadKyData(ky).loadGradeData(grade);

let validatorFails = [];
for (const k of Object.keys(CN)) {
    for (const tier of Object.keys(CN[k])) {
        for (const s of CN[k][tier]) {
            const v = e.validateComment(s, {tier, kyCode: k, gradeLevel: 5});
            if (!v.ok) validatorFails.push({k, tier, reason: v.reason, s});
        }
    }
}
if (validatorFails.length) {
    console.log(`\n⚠ Validator reject ${validatorFails.length}/${total} câu:`);
    for (const f of validatorFails.slice(0, 30)) {
        console.log(`  ${f.k}.${f.tier} [${f.reason}] ${f.s}`);
    }
    if (validatorFails.length > 30) console.log(`  ... +${validatorFails.length-30} fail khác`);
    process.exit(1);
}
console.log(`✓ Validator: ${total}/${total} pass`);

const subj = ky.subjects.congnghe;
if (!subj) { console.log('⛔ Không tìm thấy subjects.congnghe'); process.exit(1); }
for (const k of Object.keys(CN)) {
    subj[k] = {};
    for (const tier of Object.keys(CN[k])) subj[k][tier] = CN[k][tier];
}
ky.meta.note_v61x_congnghe = 'V6.1.x (2026-05-23): rewrite Công nghệ ky-data — 3 kỳ × 4 tier, dạng học bạ TT27, band 90-110.';
fs.writeFileSync(path, JSON.stringify(ky, null, 2) + '\n', 'utf8');
console.log('\n✅ Đã patch ' + path + ' (congnghe ky-data)');

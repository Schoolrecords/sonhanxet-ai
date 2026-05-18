#!/usr/bin/env node
/**
 * test-engine-comments.js — V4.1
 * Test 12 case theo spec V4.1 mục VI.
 *
 * Output kiểm tra:
 *   - Câu sinh ra không chứa: cô, thầy, thầy cô, phát biểu, yêu thích, tự tin,
 *     năng khiếu, sáng tạo, vượt trội, tấm gương, chuẩn bị tốt cho lớp học tiếp theo,
 *     trong các tuần học tiếp theo, Gia đình phối hợp hỗ trợ để em tiến bộ từng bước
 *   - Câu bắt đầu bằng "Em"
 *   - Bám môn, đúng tier
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const { NhanXetEngineV2 } = require(path.join(ROOT, 'engine', 'engine.js'));

const ngan = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine/data/nhanxet-ngan.json'), 'utf8'));
const ky   = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine/data/nhanxet-ky.json'), 'utf8'));
const grade = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine/data/nhanxet-grade.json'), 'utf8'));

const BLACKLIST = [
    /\bcô\b/i, /\bthầy\b/i, /\bthầy cô\b/i,
    /\bphát biểu\b/i, /\byêu thích\b/i, /\btự tin\b/i,
    /\bnăng khiếu\b/i, /\bsáng tạo\b/i, /\bvượt trội\b/i, /\btấm gương\b/i,
    /chuẩn bị tốt cho lớp học tiếp theo/i,
    /trong các tuần học tiếp theo/i,
    /Gia đình phối hợp hỗ trợ để em tiến bộ từng bước/i
];

// "thầy cô" được phép trong NLPC bank nhưng KHÔNG xuất hiện trong subject NX → blacklist trên áp dụng cho subject.
// Vì "cô" ban đứng riêng có thể false positive với "công nghệ", "công việc" → dùng word-boundary \bcô\b kiểm chính xác.

const CASES = [
    { id: 1,  desc: 'Toán lớp 5 điểm 3', hs: { stt: 1, hoVaTen: 'HS', diem: 3 }, code: 'toan', ky: 'chk2', grade: 5, expectTier: 'cht' },
    { id: 2,  desc: 'Toán lớp 5 điểm 5', hs: { stt: 1, hoVaTen: 'HS', diem: 5 }, code: 'toan', ky: 'chk2', grade: 5, expectTier: 'ht' },
    { id: 3,  desc: 'Toán lớp 5 điểm 7', hs: { stt: 1, hoVaTen: 'HS', diem: 7 }, code: 'toan', ky: 'chk2', grade: 5, expectTier: 'tot' },
    { id: 4,  desc: 'Toán lớp 5 điểm 9', hs: { stt: 1, hoVaTen: 'HS', diem: 9 }, code: 'toan', ky: 'chk2', grade: 5, expectTier: 'tot_xs' },
    { id: 5,  desc: 'Tiếng Việt lớp 5 điểm 3', hs: { stt: 1, hoVaTen: 'HS', diem: 3 }, code: 'tieng-viet', ky: 'chk2', grade: 5, expectTier: 'cht' },
    { id: 6,  desc: 'Tiếng Việt lớp 5 điểm 6', hs: { stt: 1, hoVaTen: 'HS', diem: 6 }, code: 'tieng-viet', ky: 'chk2', grade: 5, expectTier: 'ht' },
    { id: 7,  desc: 'Tiếng Việt lớp 5 điểm 8', hs: { stt: 1, hoVaTen: 'HS', diem: 8 }, code: 'tieng-viet', ky: 'chk2', grade: 5, expectTier: 'tot' },
    { id: 8,  desc: 'Tiếng Việt lớp 5 điểm 10', hs: { stt: 1, hoVaTen: 'HS', diem: 10 }, code: 'tieng-viet', ky: 'chk2', grade: 5, expectTier: 'tot_xs' },
    { id: 9,  desc: 'Tiếng Anh điểm 5', hs: { stt: 1, hoVaTen: 'HS', diem: 5 }, code: 'tienganh', ky: 'chk2', grade: 4, expectTier: 'ht' },
    { id: 10, desc: 'Tin học điểm 6', hs: { stt: 1, hoVaTen: 'HS', diem: 6 }, code: 'tinhoc', ky: 'chk2', grade: 4, expectTier: 'ht' },
    { id: 11, desc: 'Mĩ thuật điểm 8', hs: { stt: 1, hoVaTen: 'HS', diem: 8 }, code: 'mithuat', ky: 'chk2', grade: 3, expectTier: 'tot' },
    // 12 - HTN với 4 mức C/H/T/T+
    { id: 12.1, desc: 'HTN mức C', hs: { stt: 1, hoVaTen: 'HS', mucDat: 'C' }, code: 'htn', ky: 'chk2', grade: 3, expectTier: 'cht' },
    { id: 12.2, desc: 'HTN mức H', hs: { stt: 1, hoVaTen: 'HS', mucDat: 'H' }, code: 'htn', ky: 'chk2', grade: 3, expectTier: 'ht' },
    { id: 12.3, desc: 'HTN mức T', hs: { stt: 1, hoVaTen: 'HS', mucDat: 'T' }, code: 'htn', ky: 'chk2', grade: 3, expectTier: 'tot' },
    { id: 12.4, desc: 'HTN mức T+', hs: { stt: 1, hoVaTen: 'HS', mucDat: 'T+' }, code: 'htn', ky: 'chk2', grade: 3, expectTier: 'tot_xs' }
];

let pass = 0, fail = 0;
const failures = [];

function check(id, desc, phrase, expectTier, tierActual, hsLabel) {
    let ok = true;
    const errs = [];

    if (!phrase || !/^em\b/i.test(phrase.trim())) {
        ok = false; errs.push('Không bắt đầu bằng "Em"');
    }

    if (tierActual !== expectTier) {
        ok = false; errs.push(`Tier mismatch — expect ${expectTier}, got ${tierActual}`);
    }

    for (const re of BLACKLIST) {
        if (re.test(phrase)) {
            ok = false; errs.push(`Chứa từ cấm: ${re.source}`);
        }
    }

    if (ok) {
        pass++;
        console.log(`  ✓ #${id}  ${desc}  →  ${phrase}`);
    } else {
        fail++;
        failures.push({ id, desc, phrase, errs });
        console.log(`  ✗ #${id}  ${desc}`);
        console.log(`     Phrase: ${phrase}`);
        errs.forEach(e => console.log(`       - ${e}`));
    }
}

(function main() {
    const eng = new NhanXetEngineV2();
    eng.loadData(ngan).loadKyData(ky).loadGradeData(grade);

    console.log('=== Test engine V4.1 — 12 case theo spec ===\n');

    for (const c of CASES) {
        const phrase = eng.sinhNhanXet(c.hs, c.code, c.ky, { gradeLevel: c.grade });
        const tier = eng._resolveTier(c.hs);
        check(c.id, c.desc, phrase, c.expectTier, tier);
    }

    console.log(`\n=== Kết quả: ${pass} pass / ${fail} fail / ${pass + fail} total ===`);
    if (fail > 0) {
        console.log('\nDanh sách FAIL:');
        failures.forEach(f => console.log(`  #${f.id}  ${f.desc}: ${f.errs.join('; ')}`));
        process.exit(1);
    }
})();

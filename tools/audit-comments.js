/**
 * V2.3.8 audit — quét 3 file ngân hàng JSON, phát hiện lỗi:
 *   1. Câu không bắt đầu "Em"
 *   2. Chứa cô/thầy/thầy cô/cô giáo (word boundary)
 *   3. Hard ban (yếu kém/lười/...)
 *   4. Behavior without observation
 *   5. Sai kỳ (năm học tới cho ghk1, ghk2, chk1)
 *   6. Vague (chung chung)
 *   7. Toán/TV thiếu subject signal
 *   8. Lớp 4-5 dùng nội dung quá thấp
 *   9. Ht/Cht thiếu định hướng rèn luyện
 *  10. Câu trùng nhiều trong cùng pool
 *
 * Output: COMMENT_AUDIT_REPORT.md
 */
const fs = require('fs');
const path = require('path');
const { NhanXetEngineV2 } = require('../engine/engine.js');

const FILES = {
    flat: 'engine/data/nhanxet-ngan.json',
    ky:   'engine/data/nhanxet-ky.json',
    grade:'engine/data/nhanxet-grade.json'
};

const eng = new NhanXetEngineV2();
eng.loadData(JSON.parse(fs.readFileSync(path.join(__dirname, '..', FILES.flat), 'utf8')));
eng.loadKyData(JSON.parse(fs.readFileSync(path.join(__dirname, '..', FILES.ky), 'utf8')));
eng.loadGradeData(JSON.parse(fs.readFileSync(path.join(__dirname, '..', FILES.grade), 'utf8')));

const issues = [];

// Audit grade-data
function auditGrade() {
    const grade = JSON.parse(fs.readFileSync(path.join(__dirname, '..', FILES.grade), 'utf8'));
    for (const [subjCode, subj] of Object.entries(grade.subjects || {})) {
        for (const [g, gNode] of Object.entries(subj.grades || {})) {
            for (const [ky, kyNode] of Object.entries(gNode)) {
                for (const [tier, tierNode] of Object.entries(kyNode)) {
                    for (const [trend, phrases] of Object.entries(tierNode)) {
                        if (!Array.isArray(phrases)) continue;
                        const counts = {};
                        phrases.forEach((p, i) => {
                            counts[p] = (counts[p] || 0) + 1;
                            const ctx = {
                                tier, gradeLevel: parseInt(g), subjectCode: subjCode,
                                kyCode: ky, hasObservation: false, hasHistory: trend === 'tien_bo' || trend === 'giam_sut' || trend === 'chua_on_dinh'
                            };
                            const v = eng.validateComment(p, ctx);
                            if (!v.ok) {
                                issues.push({
                                    file: 'grade', path: `subjects.${subjCode}.grades.${g}.${ky}.${tier}.${trend}[${i}]`,
                                    phrase: p, reason: v.reason
                                });
                            }
                        });
                        // Trùng
                        for (const [p, c] of Object.entries(counts)) {
                            if (c > 1) {
                                issues.push({
                                    file: 'grade', path: `subjects.${subjCode}.grades.${g}.${ky}.${tier}.${trend}`,
                                    phrase: p, reason: `duplicate_x${c}`
                                });
                            }
                        }
                    }
                }
            }
        }
    }
}

// Audit ky-data (không có grade — skip grade-specific check)
function auditKy() {
    const kyData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', FILES.ky), 'utf8'));
    for (const [subjCode, subj] of Object.entries(kyData.subjects || {})) {
        for (const [ky, kyNode] of Object.entries(subj)) {
            for (const [tier, phrases] of Object.entries(kyNode)) {
                if (!Array.isArray(phrases)) continue;
                phrases.forEach((p, i) => {
                    const v = eng.validateComment(p, {
                        tier, subjectCode: subjCode, kyCode: ky, hasObservation: false
                    });
                    if (!v.ok) {
                        issues.push({
                            file: 'ky', path: `subjects.${subjCode}.${ky}.${tier}[${i}]`,
                            phrase: p, reason: v.reason
                        });
                    }
                });
            }
        }
    }
}

// Audit flat (nhanxet-ngan.json)
function auditFlat() {
    const flatData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', FILES.flat), 'utf8'));
    function walk(obj, pathStr) {
        for (const [k, v] of Object.entries(obj)) {
            if (Array.isArray(v)) {
                v.forEach((p, i) => {
                    if (typeof p !== 'string') return;
                    // Skip tier không phù hợp — chỉ check phrase basic
                    const ctx = { hasObservation: false };
                    // Detect tier from key
                    if (['tot_xs','tot','ht','cht'].includes(k)) ctx.tier = k;
                    // Detect subject
                    const subj = pathStr.match(/subjects\.([^.]+)/);
                    if (subj) {
                        const map = {'tieng-viet':'tieng-viet','toan':'toan'};
                        ctx.subjectCode = map[subj[1]];
                    }
                    const result = eng.validateComment(p, ctx);
                    if (!result.ok) {
                        issues.push({
                            file: 'flat', path: `${pathStr}.${k}[${i}]`,
                            phrase: p, reason: result.reason
                        });
                    }
                });
            } else if (v && typeof v === 'object') {
                walk(v, pathStr + '.' + k);
            }
        }
    }
    walk(flatData, 'root');
}

auditGrade();
auditKy();
auditFlat();

// Group by reason
const byReason = {};
for (const it of issues) {
    if (!byReason[it.reason]) byReason[it.reason] = [];
    byReason[it.reason].push(it);
}

// Output report
const lines = [];
lines.push('# Audit ngân hàng nhận xét — V2.3.8');
lines.push('');
lines.push(`**Ngày**: ${new Date().toISOString().slice(0,10)}`);
lines.push(`**Tổng số issue**: ${issues.length}`);
lines.push('');
lines.push('## Tóm tắt theo loại lỗi');
lines.push('');
lines.push('| Loại lỗi | Số issue |');
lines.push('|---|---|');
Object.entries(byReason).sort((a,b)=>b[1].length-a[1].length).forEach(([r, list]) => {
    lines.push(`| \`${r}\` | ${list.length} |`);
});
lines.push('');
lines.push('## Chi tiết (top 100)');
lines.push('');
lines.push('| File | Path | Lỗi | Câu |');
lines.push('|---|---|---|---|');
issues.slice(0, 100).forEach(it => {
    const phrase = it.phrase.length > 80 ? it.phrase.slice(0, 77) + '...' : it.phrase;
    lines.push(`| ${it.file} | \`${it.path}\` | \`${it.reason}\` | ${phrase.replace(/\|/g,'\\|')} |`);
});

if (issues.length > 100) {
    lines.push('');
    lines.push(`... và ${issues.length - 100} issue khác.`);
}

const outPath = path.join(__dirname, '..', 'COMMENT_AUDIT_REPORT.md');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log('✓ Đã ghi:', outPath);
console.log('  Tổng issue:', issues.length);
console.log('  Top reasons:');
Object.entries(byReason).sort((a,b)=>b[1].length-a[1].length).slice(0,8).forEach(([r,l]) => {
    console.log('    ' + r + ': ' + l.length);
});

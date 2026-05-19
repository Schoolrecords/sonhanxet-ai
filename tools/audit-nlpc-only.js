/**
 * audit-nlpc-only.js — Chạy audit-comments logic nhưng chỉ output NLPC issues.
 * Dùng để verify pool NLPC V5.1 sau khi merge.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NGAN_PATH = path.join(ROOT, 'engine', 'data', 'nhanxet-ngan.json');

const TEACHER_GENDER_PATTERNS = [
    /\bthầy cô\b/i,
    /\bcô giáo\b/i, /\bthầy giáo\b/i,
    /\bcô giảng\b/i, /\bcô hướng dẫn\b/i,
    /\bbài cô (giao|đã)\b/i,
    /\bcâu hỏi của cô\b/i, /\btheo cô\b/i, /\bhỏi cô\b/i, /\bnhờ cô\b/i,
    /\bcủa cô\b/i, /\bgợi ý của cô\b/i, /\bcùng cô\b/i,
    /(^|[^a-zA-ZÀ-ỹ0-9])cô(?:\s+(?!cô\b))/i,
    /(^|[^a-zA-ZÀ-ỹ0-9])thầy(?:\s+(?!cô\b))/i
];

const NEGATIVE_WORDS = [
    'học yếu', 'còn yếu', 'yếu kém', 'yếu môn', 'năng lực yếu',
    'lười', 'không biết', 'chưa ngoan', 'mất gốc',
    'rất tệ', ' tệ ', 'dốt', 'ngu', 'kinh khủng', 'không có ý thức'
];

const FORCED_SUFFIXES = [
    'trong các tuần học tiếp theo',
    'chuẩn bị tốt cho lớp học tiếp theo',
    'gia đình phối hợp hỗ trợ để em tiến bộ từng bước',
    'em cố gắng hơn ở năm học tới',
    'tiếp tục rèn luyện trong học kỳ ii để kết quả vững chắc hơn'
];

function findIssuesNLPC(phrase) {
    const issues = [];
    const lower = phrase.toLowerCase();

    if (!/^em\b/i.test(phrase.trim())) {
        issues.push('bad_start');
    }

    for (const re of TEACHER_GENDER_PATTERNS) {
        if (re.test(phrase)) {
            const isAllowedNLPC = /\bthầy cô\b/i.test(phrase)
                && !/(cô giảng|cô hướng dẫn|bài cô|hỏi cô|nhờ cô|theo cô|của cô|gợi ý của cô|câu hỏi của cô)/i.test(phrase);
            if (!isAllowedNLPC) {
                issues.push('gender_dependent: ' + re.source);
                break;
            }
        }
    }

    for (const w of NEGATIVE_WORDS) {
        if (lower.includes(w)) {
            issues.push('negative_word: ' + w.trim());
            break;
        }
    }

    for (const s of FORCED_SUFFIXES) {
        if (lower.includes(s)) {
            issues.push('forced_suffix: ' + s);
            break;
        }
    }

    return issues;
}

const ngan = JSON.parse(fs.readFileSync(NGAN_PATH, 'utf8'));
const nlpc = ngan.nlpc || {};

const allPhrases = [];
let problems = 0;

for (const [sec, fields] of Object.entries(nlpc)) {
    for (const [field, tiers] of Object.entries(fields)) {
        for (const [tier, arr] of Object.entries(tiers)) {
            if (!Array.isArray(arr)) continue;
            arr.forEach((p, i) => {
                const pathStr = `nlpc.${sec}.${field}.${tier}[${i}]`;
                allPhrases.push({ p, pathStr });
                const issues = findIssuesNLPC(p);
                if (issues.length) {
                    problems++;
                    console.log('!!', pathStr);
                    issues.forEach(iss => console.log('   -', iss));
                    console.log('   →', p);
                }
            });
        }
    }
}

const norm = s => s.trim().toLowerCase().replace(/\s+/g, ' ');
const seen = new Map();
for (const e of allPhrases) {
    const k = norm(e.p);
    if (!seen.has(k)) seen.set(k, []);
    seen.get(k).push(e.pathStr);
}
let dups = 0;
for (const [k, list] of seen) {
    if (list.length > 1) {
        dups++;
        console.log('-- DUP:', list.length, 'lần');
        list.forEach(p => console.log('   @', p));
    }
}

console.log('\n=== NLPC Audit Summary ===');
console.log('Total phrase:', allPhrases.length);
console.log('Issues (gender/negative/start/suffix):', problems);
console.log('Duplicates (>1 lần):', dups);
console.log(problems === 0 && dups === 0 ? '\n✓ NLPC pool CLEAN' : '\n✗ Cần sửa');

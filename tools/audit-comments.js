#!/usr/bin/env node
/**
 * audit-comments.js — V4.1
 * Quét 3 file ngân hàng và báo 10 loại lỗi, ghi COMMENT_AUDIT_REPORT.md.
 *
 * Loại lỗi:
 *   1. Câu không bắt đầu bằng "Em"
 *   2. Phụ thuộc giới tính GV: cô / thầy / thầy cô / cô giáo / thầy giáo (+ các cụm)
 *   3. Từ tiêu cực
 *   4. Suy diễn hành vi từ điểm số
 *   5. Câu ht/cht thiếu định hướng rèn luyện
 *   6. Toán thiếu tín hiệu môn Toán
 *   7. Tiếng Việt thiếu tín hiệu môn Tiếng Việt
 *   8. Câu quá chung chung (không có signal cho môn có signal-list)
 *   9. Câu chứa hậu tố khiên cưỡng
 *  10. Câu bị trùng lặp >2 lần across files
 *
 * NLPC bank được audit RIÊNG cho loại 1-3, 9, 10 (loại 4 cho phép "ngoan/lễ phép/...").
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GRADE_PATH = path.join(ROOT, 'engine', 'data', 'nhanxet-grade.json');
const KY_PATH    = path.join(ROOT, 'engine', 'data', 'nhanxet-ky.json');
const NGAN_PATH  = path.join(ROOT, 'engine', 'data', 'nhanxet-ngan.json');
const OUT_PATH   = path.join(ROOT, 'COMMENT_AUDIT_REPORT.md');

const NEGATIVE_WORDS = [
    'học yếu', 'còn yếu', 'yếu kém', 'yếu môn', 'năng lực yếu',
    'lười', 'không biết', 'chưa ngoan', 'mất gốc',
    'rất tệ', ' tệ ', 'dốt', 'ngu', 'kinh khủng', 'không có ý thức'
];

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

const BEHAVIOR_FROM_SCORE_PATTERNS = [
    /hăng hái phát biểu/i, /tích cực phát biểu/i, /xây dựng bài/i, /giơ tay phát biểu/i,
    /yêu thích/i, /tự tin/i, /chăm chú nghe giảng/i, /có ý thức tự học/i,
    /nền nếp học tập tốt/i, /học tập nghiêm túc/i, /có năng khiếu/i, /năng khiếu/i,
    /tư duy sắc bén/i, /vượt trội/i, /rất sáng tạo/i, /tấm gương/i,
    /bài viết lôi cuốn/i, /bài viết giàu hình ảnh/i
];

const REMEDIATION = [
    'cần luyện thêm', 'cần rèn thêm', 'cần củng cố',
    'cần được hỗ trợ', 'cần được hướng dẫn',
    'cần chú ý', 'cần ôn',
    'cần thực hành', 'thực hành thường xuyên', 'luyện tập thường xuyên',
    'cần cẩn thận', 'cần chủ động',
    'nên luyện tập', 'nên rèn', 'nên đọc thêm', 'nên cố gắng',
    'gia đình phối hợp', 'gia đình cùng', 'hỗ trợ thêm',
    'cần tiếp tục luyện', 'cần tiếp tục rèn',
    'hãy luyện', 'hãy rèn', 'hãy ôn', 'hãy đọc', 'hãy cùng',
    'cần dành thời gian', 'kiên trì', 'cần cố gắng',
    'cần phát huy thêm', 'cần luyện', 'cần rèn',
    'phát huy thêm', 'cố gắng thêm'
];

const TOAN_SIGNALS = [
    'toán', 'phép tính', 'phép cộng', 'phép trừ', 'phép nhân', 'phép chia',
    'tính toán', 'tính nhẩm', 'tính nhanh', 'biểu thức',
    'số thập phân', 'phân số', 'tỉ số', 'đo lường', 'đại lượng',
    'đo độ dài', 'đo khối lượng', 'đơn vị đo',
    'hình học', 'diện tích', 'thể tích', 'chu vi',
    'giải toán', 'bài toán', 'lời giải', 'đáp số', 'lời văn',
    'phân tích đề', 'kiểm tra kết quả', 'kiểm tra lại',
    'cộng trừ', 'nhân chia', 'bảng nhân', 'bảng chia',
    'số tự nhiên', 'so sánh số', 'đọc viết số', 'đặt tính', 'đặt phép tính',
    'hình vuông', 'hình tròn', 'hình tam giác', 'hình chữ nhật', 'hình thoi',
    'đường thẳng', 'biểu đồ', 'chuyển động'
];

const TV_SIGNALS = [
    'tiếng việt', 'đọc', 'viết', 'dùng từ', 'đặt câu',
    'chính tả', 'đoạn văn', 'bài văn', 'văn bản',
    'kể chuyện', 'kể lại', 'phát âm', 'vốn từ', 'luyện từ',
    'từ ngữ', 'ngữ pháp', 'dấu câu', 'âm vần', 'phụ âm',
    'diễn đạt', 'bố cục', 'trình bày ý', 'nói và nghe', 'nghe nói',
    'câu ghép', 'câu kể', 'câu hỏi', 'cảm thụ',
    'tả cảnh', 'tả người', 'miêu tả', 'câu chuyện', 'thuyết trình'
];

const FORCED_SUFFIXES = [
    'trong các tuần học tiếp theo',
    'chuẩn bị tốt cho lớp học tiếp theo',
    'gia đình phối hợp hỗ trợ để em tiến bộ từng bước',
    'em cố gắng hơn ở năm học tới',
    'tiếp tục rèn luyện trong học kỳ ii để kết quả vững chắc hơn',
    'gia đình phối hợp hỗ trợ để em củng cố kiến thức từng bước',
    'gia đình phối hợp hỗ trợ để em tiến bộ hơn trong học kỳ ii'
];

function startsWithEm(phrase) {
    return /^em\b/i.test(phrase.trim());
}

function hasRemediation(phrase) {
    const lower = phrase.toLowerCase();
    return REMEDIATION.some(r => lower.includes(r));
}

function findIssues(phrase, ctx) {
    const issues = [];
    const lower = phrase.toLowerCase();

    if (!startsWithEm(phrase)) {
        issues.push({ type: 1, label: 'bad_start', detail: 'Không bắt đầu bằng "Em"' });
    }

    for (const re of TEACHER_GENDER_PATTERNS) {
        if (re.test(phrase)) {
            const isAllowedNLPC = ctx.isNLPC
                && /\bthầy cô\b/i.test(phrase)
                && !/(cô giảng|cô hướng dẫn|bài cô|hỏi cô|nhờ cô|theo cô|của cô|gợi ý của cô|câu hỏi của cô)/i.test(phrase);
            if (!isAllowedNLPC) {
                issues.push({ type: 2, label: 'gender_dependent', detail: re.source });
                break;
            }
        }
    }

    for (const w of NEGATIVE_WORDS) {
        if (lower.includes(w)) {
            issues.push({ type: 3, label: 'negative_word', detail: w.trim() });
            break;
        }
    }

    if (!ctx.isNLPC) {
        for (const re of BEHAVIOR_FROM_SCORE_PATTERNS) {
            if (re.test(phrase)) {
                issues.push({ type: 4, label: 'behavior_from_score', detail: re.source });
                break;
            }
        }
    }

    if (!ctx.isNLPC && (ctx.tier === 'ht' || ctx.tier === 'cht')) {
        if (!hasRemediation(phrase)) {
            issues.push({ type: 5, label: 'no_remediation', detail: 'tier ' + ctx.tier });
        }
    }

    if (ctx.code === 'toan' && !TOAN_SIGNALS.some(s => lower.includes(s))) {
        issues.push({ type: 6, label: 'toan_missing_signal', detail: 'no Toán keyword' });
    }
    if (ctx.code === 'tieng-viet' && !TV_SIGNALS.some(s => lower.includes(s))) {
        issues.push({ type: 7, label: 'tv_missing_signal', detail: 'no TV keyword' });
    }

    if (!ctx.isNLPC && phrase.split(/\s+/).length <= 10) {
        if ((ctx.code === 'toan' && !TOAN_SIGNALS.some(s => lower.includes(s)))
            || (ctx.code === 'tieng-viet' && !TV_SIGNALS.some(s => lower.includes(s)))) {
            issues.push({ type: 8, label: 'too_vague', detail: 'ngắn + không signal' });
        }
    }

    for (const s of FORCED_SUFFIXES) {
        if (lower.includes(s)) {
            issues.push({ type: 9, label: 'forced_suffix', detail: s });
            break;
        }
    }

    return issues;
}

function scanGrade(grade, allEntries) {
    const issues = [];
    for (const [code, payload] of Object.entries(grade.subjects || {})) {
        const grades = payload.grades || {};
        for (const [g, kyMap] of Object.entries(grades)) {
            for (const [ky, tiers] of Object.entries(kyMap)) {
                for (const [tier, node] of Object.entries(tiers)) {
                    const buckets = Array.isArray(node) ? { default: node } : node;
                    for (const [sub, arr] of Object.entries(buckets)) {
                        if (!Array.isArray(arr)) continue;
                        arr.forEach((p, i) => {
                            const pathStr = `subjects.${code}.grades.${g}.${ky}.${tier}.${sub}[${i}]`;
                            allEntries.push({ phrase: p, file: 'grade', pathStr, code, tier });
                            const ctx = { file: 'grade', pathStr, code, tier, isNLPC: false };
                            findIssues(p, ctx).forEach(iss => issues.push({ file: 'grade', pathStr, phrase: p, ...iss }));
                        });
                    }
                }
            }
        }
    }
    return issues;
}

function scanKy(ky, allEntries) {
    const issues = [];
    for (const [code, kyMap] of Object.entries(ky.subjects || {})) {
        for (const [k, tiers] of Object.entries(kyMap)) {
            for (const [tier, arr] of Object.entries(tiers)) {
                if (!Array.isArray(arr)) continue;
                arr.forEach((p, i) => {
                    const pathStr = `subjects.${code}.${k}.${tier}[${i}]`;
                    allEntries.push({ phrase: p, file: 'ky', pathStr, code, tier });
                    const ctx = { file: 'ky', pathStr, code, tier, isNLPC: false };
                    findIssues(p, ctx).forEach(iss => issues.push({ file: 'ky', pathStr, phrase: p, ...iss }));
                });
            }
        }
    }
    return issues;
}

function scanNgan(ngan, allEntries) {
    const issues = [];
    for (const [code, payload] of Object.entries(ngan.subjects || {})) {
        for (const tier of ['tot_xs', 'tot', 'ht', 'cht']) {
            const arr = payload[tier];
            if (!Array.isArray(arr)) continue;
            arr.forEach((p, i) => {
                const pathStr = `subjects.${code}.${tier}[${i}]`;
                allEntries.push({ phrase: p, file: 'ngan', pathStr, code, tier });
                const ctx = { file: 'ngan', pathStr, code, tier, isNLPC: false };
                findIssues(p, ctx).forEach(iss => issues.push({ file: 'ngan', pathStr, phrase: p, ...iss }));
            });
        }
    }
    const nlpc = ngan.nlpc || {};
    for (const [sec, fields] of Object.entries(nlpc)) {
        for (const [field, tiers] of Object.entries(fields)) {
            for (const [tier, arr] of Object.entries(tiers)) {
                if (!Array.isArray(arr)) continue;
                arr.forEach((p, i) => {
                    const pathStr = `nlpc.${sec}.${field}.${tier}[${i}]`;
                    allEntries.push({ phrase: p, file: 'ngan(NLPC)', pathStr, code: sec, tier, isNLPC: true });
                    const ctx = { file: 'ngan(NLPC)', pathStr, code: sec, tier, isNLPC: true };
                    findIssues(p, ctx).forEach(iss => issues.push({ file: 'ngan(NLPC)', pathStr, phrase: p, ...iss }));
                });
            }
        }
    }
    return issues;
}

function main() {
    const grade = JSON.parse(fs.readFileSync(GRADE_PATH, 'utf8'));
    const ky    = JSON.parse(fs.readFileSync(KY_PATH, 'utf8'));
    const ngan  = JSON.parse(fs.readFileSync(NGAN_PATH, 'utf8'));

    const allEntries = [];
    const issues = [
        ...scanGrade(grade, allEntries),
        ...scanKy(ky, allEntries),
        ...scanNgan(ngan, allEntries)
    ];

    const norm = s => s.trim().toLowerCase().replace(/\s+/g, ' ');
    const dupMap = new Map();
    for (const e of allEntries) {
        const k = norm(e.phrase);
        if (!dupMap.has(k)) dupMap.set(k, []);
        dupMap.get(k).push(e);
    }
    for (const [k, list] of dupMap) {
        if (list.length > 2) {
            list.slice(2).forEach(e => issues.push({
                file: e.file, pathStr: e.pathStr, phrase: e.phrase,
                type: 10, label: 'duplicate', detail: `xuất hiện ${list.length} lần`
            }));
        }
    }

    const countByType = {};
    for (const iss of issues) {
        countByType[iss.label] = (countByType[iss.label] || 0) + 1;
    }

    const lines = [];
    lines.push('# Audit ngân hàng nhận xét — V4.1');
    lines.push('');
    lines.push(`**Ngày**: ${new Date().toISOString().slice(0, 10)}`);
    lines.push(`**Tổng phrase quét**: ${allEntries.length}`);
    lines.push(`**Tổng issue**: ${issues.length}`);
    lines.push('');
    lines.push('## Tóm tắt theo loại lỗi');
    lines.push('');
    lines.push('| Loại lỗi | Số issue |');
    lines.push('|---|---|');
    Object.entries(countByType).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => {
        lines.push(`| \`${t}\` | ${n} |`);
    });
    lines.push('');
    lines.push('## Chi tiết (top 200)');
    lines.push('');
    lines.push('| File | Path | Lỗi | Câu |');
    lines.push('|---|---|---|---|');
    issues.slice(0, 200).forEach(iss => {
        const phrasePart = iss.phrase.replace(/\|/g, '\\|').slice(0, 180);
        lines.push(`| ${iss.file} | \`${iss.pathStr}\` | \`${iss.label}\` | ${phrasePart} |`);
    });

    fs.writeFileSync(OUT_PATH, lines.join('\n'), 'utf8');

    console.log(`[Audit V4.1] Đã quét ${allEntries.length} phrase`);
    console.log(`[Audit V4.1] Tổng issue: ${issues.length}`);
    Object.entries(countByType).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => {
        console.log(`  - ${t}: ${n}`);
    });
    console.log(`[Audit V4.1] Báo cáo: ${path.relative(ROOT, OUT_PATH)}`);
}

main();

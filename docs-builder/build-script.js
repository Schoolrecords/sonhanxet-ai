/* eslint-disable */
/**
 * Build Word document từ videos/scripts.md
 * Output: videos/Kich-ban-3-video-So-nhan-xet-AI-V1.5.docx
 *
 * Hỗ trợ:
 *   - # H1, ## H2, ### H3, #### H4
 *   - Đoạn văn thường, bullet `- `, table với `|`
 *   - Blockquote `> ...`
 *   - Code block ```...```
 *   - Inline **bold**, *italic*, `code`
 */
const fs = require('fs');
const path = require('path');
const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
    Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType
} = require('docx');

const SRC = path.resolve(__dirname, '..', 'videos', 'scripts.md');
const OUT = path.resolve(__dirname, '..', 'videos', 'Kich-ban-3-video-So-nhan-xet-AI-V1.5.docx');

const FONT = 'Times New Roman';
const NAVY = '042C53';
const BRAND = '2B4F9E';
const INK = '1F2937';
const MUTED = '6B7280';
const GOLD = 'B58105';
const CODE_BG = 'F3F4F6';
const TABLE_HEADER_BG = 'E5E7EB';
const BORDER = 'D1D5DB';

// ---------- Inline parsing ----------
// Render markdown inline (**bold**, *italic*, `code`) thành mảng TextRun.
function inlineRuns(text, baseProps = {}) {
    const runs = [];
    // Tokenize: bold, italic, code, plain
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    let lastIdx = 0;
    let m;
    while ((m = regex.exec(text)) !== null) {
        if (m.index > lastIdx) {
            runs.push(new TextRun({ text: text.slice(lastIdx, m.index), font: FONT, size: 24, ...baseProps }));
        }
        const tok = m[0];
        if (tok.startsWith('**')) {
            runs.push(new TextRun({ text: tok.slice(2, -2), bold: true, font: FONT, size: 24, ...baseProps }));
        } else if (tok.startsWith('*')) {
            runs.push(new TextRun({ text: tok.slice(1, -1), italics: true, font: FONT, size: 24, ...baseProps }));
        } else if (tok.startsWith('`')) {
            runs.push(new TextRun({ text: tok.slice(1, -1), font: 'Consolas', size: 22, color: BRAND, ...baseProps }));
        }
        lastIdx = m.index + tok.length;
    }
    if (lastIdx < text.length) {
        runs.push(new TextRun({ text: text.slice(lastIdx), font: FONT, size: 24, ...baseProps }));
    }
    return runs.length ? runs : [new TextRun({ text, font: FONT, size: 24, ...baseProps })];
}

// ---------- Block builders ----------
function heading(level, text) {
    const sizeMap = { 1: 40, 2: 32, 3: 28, 4: 24 };
    const colorMap = { 1: NAVY, 2: BRAND, 3: BRAND, 4: INK };
    const levelMap = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4
    };
    return new Paragraph({
        heading: levelMap[level],
        spacing: { before: level === 1 ? 600 : 360, after: 200 },
        children: [new TextRun({ text, bold: true, font: FONT, size: sizeMap[level], color: colorMap[level] })]
    });
}

function paragraph(text, opts = {}) {
    return new Paragraph({
        spacing: { before: 100, after: 100 },
        ...opts,
        children: inlineRuns(text, opts.runProps || {})
    });
}

function bullet(text, level = 0) {
    return new Paragraph({
        bullet: { level },
        spacing: { before: 60, after: 60 },
        children: inlineRuns(text)
    });
}

function blockquote(text) {
    // Italic, hơi thụt vào, nền nhẹ
    const inner = text.replace(/^>\s*/, '').replace(/^\*(.+)\*$/, '$1');
    return new Paragraph({
        spacing: { before: 120, after: 120 },
        indent: { left: 360 },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FFF7E0' },
        border: { left: { style: BorderStyle.SINGLE, size: 18, color: GOLD, space: 8 } },
        children: inlineRuns(inner, { italics: true, color: INK })
    });
}

function codeBlock(text) {
    return new Paragraph({
        spacing: { before: 120, after: 120 },
        indent: { left: 240 },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: CODE_BG },
        children: [new TextRun({ text, font: 'Consolas', size: 20, color: INK })]
    });
}

function buildTable(rows) {
    const cellFor = (text, isHeader) => new TableCell({
        shading: isHeader ? { type: ShadingType.CLEAR, color: 'auto', fill: TABLE_HEADER_BG } : undefined,
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [new Paragraph({ children: inlineRuns(text, isHeader ? { bold: true } : {}) })]
    });
    const trs = rows.map((cells, idx) =>
        new TableRow({
            tableHeader: idx === 0,
            children: cells.map(c => cellFor(c, idx === 0))
        })
    );
    return new Table({
        rows: trs,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
            left: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
            right: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
            insideVertical: { style: BorderStyle.SINGLE, size: 2, color: BORDER }
        }
    });
}

function hr() {
    return new Paragraph({
        spacing: { before: 200, after: 200 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BORDER, space: 1 } },
        children: [new TextRun({ text: '' })]
    });
}

// ---------- Markdown parser ----------
function parseMd(md) {
    const lines = md.split(/\r?\n/);
    const blocks = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];

        // Code fence
        if (line.startsWith('```')) {
            const buf = [];
            i++;
            while (i < lines.length && !lines[i].startsWith('```')) {
                buf.push(lines[i]);
                i++;
            }
            i++; // skip closing ```
            blocks.push(codeBlock(buf.join('\n')));
            continue;
        }

        // HR
        if (/^---+\s*$/.test(line)) {
            blocks.push(hr());
            i++;
            continue;
        }

        // Headings
        const h = /^(#{1,4})\s+(.*)$/.exec(line);
        if (h) {
            blocks.push(heading(h[1].length, h[2]));
            i++;
            continue;
        }

        // Table — đảm bảo dòng tiếp theo là separator |---|---|
        if (line.startsWith('|') && i + 1 < lines.length && /^\|[\s\-:|]+\|\s*$/.test(lines[i + 1])) {
            const rows = [];
            // Header row
            rows.push(line.split('|').slice(1, -1).map(c => c.trim()));
            i += 2; // skip header + separator
            while (i < lines.length && lines[i].startsWith('|')) {
                rows.push(lines[i].split('|').slice(1, -1).map(c => c.trim()));
                i++;
            }
            blocks.push(buildTable(rows));
            continue;
        }

        // Blockquote
        if (line.startsWith('>')) {
            // Gom nhiều dòng quote liền nhau thành 1 paragraph
            const buf = [line];
            i++;
            while (i < lines.length && lines[i].startsWith('>')) {
                buf.push(lines[i]);
                i++;
            }
            const merged = buf.map(l => l.replace(/^>\s*/, '')).join(' ');
            blocks.push(blockquote(merged));
            continue;
        }

        // Bullet
        const bul = /^(\s*)[-*]\s+(.*)$/.exec(line);
        if (bul) {
            const indent = bul[1].length;
            const level = indent >= 2 ? 1 : 0;
            blocks.push(bullet(bul[2], level));
            i++;
            continue;
        }

        // Checkbox bullet (- [ ] / - [x])
        const chk = /^(\s*)-\s+\[([ xX])\]\s+(.*)$/.exec(line);
        if (chk) {
            const mark = chk[2].trim() ? '☒' : '☐';
            blocks.push(bullet(`${mark} ${chk[3]}`));
            i++;
            continue;
        }

        // Empty line — skip
        if (!line.trim()) {
            i++;
            continue;
        }

        // Regular paragraph
        blocks.push(paragraph(line));
        i++;
    }
    return blocks;
}

// ---------- Build doc ----------
function buildDoc(md) {
    const cover = [
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 80 },
            children: [new TextRun({ text: 'KỊCH BẢN VIDEO HƯỚNG DẪN', font: FONT, size: 32, color: MUTED, bold: true })]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 80 },
            children: [new TextRun({ text: 'Sổ nhận xét - AI', font: FONT, size: 56, color: NAVY, bold: true })]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 80 },
            children: [new TextRun({ text: 'Phiên bản 1.5 — Dành cho giáo viên Tiểu học trên Vnedu', font: FONT, size: 24, color: INK, italics: true })]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 400 },
            children: [new TextRun({ text: 'Chung Trần · Trường Tiểu học Diễn Liên · 0913031073', font: FONT, size: 22, color: MUTED })]
        }),
        hr()
    ];

    const body = parseMd(md);
    return new Document({
        creator: 'Chung Trần',
        title: 'Kịch bản 3 video — Sổ nhận xét - AI v1.5',
        description: 'Tutorial scripts for Sổ nhận xét - AI Chrome extension',
        styles: {
            default: {
                document: { run: { font: FONT, size: 24 } }
            }
        },
        sections: [{
            properties: {
                page: {
                    margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
                }
            },
            children: [...cover, ...body]
        }]
    });
}

// ---------- Main ----------
(async () => {
    const md = fs.readFileSync(SRC, 'utf8');
    const doc = buildDoc(md);
    const buf = await Packer.toBuffer(doc);
    fs.writeFileSync(OUT, buf);
    const sizeKB = (buf.length / 1024).toFixed(1);
    console.log(`Đã tạo: ${OUT}`);
    console.log(`Kích thước: ${sizeKB} KB`);
})();

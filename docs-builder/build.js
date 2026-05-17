const fs = require('fs');
const path = require('path');
const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
    ImageRun, PageBreak, Table, TableRow, TableCell, WidthType, BorderStyle,
    ShadingType, LevelFormat
} = require('docx');

const ROOT = path.resolve(__dirname, '..');
const SCREENSHOTS = path.join(ROOT, 'screenshots', 'out');
const ICONS = path.join(ROOT, 'icons');

function img(filename, w = 540) {
    const fullPath = filename.startsWith('/') ? filename : path.join(SCREENSHOTS, filename);
    return new ImageRun({
        data: fs.readFileSync(fullPath),
        transformation: { width: w, height: Math.round(w * 0.625) }
    });
}

function imgCustom(fullPath, width, height) {
    return new ImageRun({
        data: fs.readFileSync(fullPath),
        transformation: { width, height }
    });
}

const NAVY = '042C53';
const BRAND = '2B4F9E';
const INK = '374151';
const MUTED = '6B7280';
const GOLD = 'E0A800';

const fontBody = { font: 'Times New Roman' };

function h1(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 480, after: 240 },
        children: [new TextRun({ text, bold: true, size: 36, color: NAVY, ...fontBody })]
    });
}
function h2(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 360, after: 180 },
        children: [new TextRun({ text, bold: true, size: 28, color: BRAND, ...fontBody })]
    });
}
function h3(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text, bold: true, size: 24, color: NAVY, ...fontBody })]
    });
}
function p(runs, opts = {}) {
    const children = Array.isArray(runs) ? runs : [runs];
    return new Paragraph({
        spacing: { after: 120, line: 300 },
        alignment: opts.align || AlignmentType.JUSTIFIED,
        children: children.map(r => typeof r === 'string'
            ? new TextRun({ text: r, size: 24, color: INK, ...fontBody })
            : r)
    });
}
function bold(text, color = INK) {
    return new TextRun({ text, bold: true, size: 24, color, ...fontBody });
}
function tr(text, color = INK) {
    return new TextRun({ text, size: 24, color, ...fontBody });
}
function code(text) {
    return new TextRun({ text, size: 22, font: 'Consolas', color: BRAND, bold: true });
}
function bullet(text) {
    return new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text, size: 24, color: INK, ...fontBody })]
    });
}
function numbered(text, level = 0) {
    return new Paragraph({
        numbering: { reference: 'main-numbering', level },
        spacing: { after: 80 },
        children: [new TextRun({ text, size: 24, color: INK, ...fontBody })]
    });
}
function imageCenter(filename, w = 540) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 },
        children: [img(filename, w)]
    });
}
function caption(text) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [new TextRun({ text, italics: true, size: 20, color: MUTED, ...fontBody })]
    });
}
function imagePlaceholder(text) {
    // Hộp xám cho ảnh chèn sau
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 },
        shading: { type: ShadingType.CLEAR, fill: 'F1EFE8', color: 'auto' },
        border: {
            top: { style: BorderStyle.DASHED, size: 8, color: MUTED },
            bottom: { style: BorderStyle.DASHED, size: 8, color: MUTED },
            left: { style: BorderStyle.DASHED, size: 8, color: MUTED },
            right: { style: BorderStyle.DASHED, size: 8, color: MUTED }
        },
        children: [
            new TextRun({ text: '\n[ Hình minh họa: ' + text + ' ]\n', italics: true, size: 22, color: MUTED, ...fontBody })
        ]
    });
}
function spacer() { return new Paragraph({ spacing: { after: 120 }, children: [] }); }

function calloutBox(label, body, bg = 'FFF8DC', borderColor = GOLD) {
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
            left: { style: BorderStyle.SINGLE, size: 24, color: borderColor },
            right: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE }
        },
        rows: [
            new TableRow({
                children: [new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: bg },
                    margins: { top: 200, bottom: 200, left: 240, right: 240 },
                    children: [
                        new Paragraph({ children: [bold(label, NAVY)] }),
                        new Paragraph({
                            spacing: { line: 280 },
                            children: [tr(body)]
                        })
                    ]
                })]
            })
        ]
    });
}

// ============ DOC SECTIONS ============

const cover = [
    // Logo
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1200, after: 240 },
        children: [imgCustom(path.join(ICONS, 'icon-128.png'), 96, 96)]
    }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 },
        children: [new TextRun({ text: 'CT EduTech', bold: true, size: 22, color: GOLD, ...fontBody })]
    }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({
            text: 'HƯỚNG DẪN CÀI ĐẶT & SỬ DỤNG',
            bold: true, size: 44, color: NAVY, ...fontBody
        })]
    }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 360 },
        children: [new TextRun({
            text: 'SỔ NHẬN XÉT - AI',
            bold: true, size: 56, color: BRAND, ...fontBody
        })]
    }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 720 },
        children: [new TextRun({
            text: 'Phiên bản V.01',
            italics: true, size: 28, color: MUTED, ...fontBody
        })]
    }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [tr('Trợ lý tạo nhận xét cuối kỳ tự động cho giáo viên tiểu học')]
    }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [tr('Hoạt động trên hệ thống Vnedu · Theo Thông tư 27/2020/TT-BGDĐT')]
    }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 2400, after: 120 },
        children: [bold('Chung Trần', NAVY)]
    }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [tr('Phó Hiệu trưởng — Trường Tiểu học Diễn Liên')]
    }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [tr('Xã Quảng Châu, Tỉnh Nghệ An')]
    }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [tr('Điện thoại / Zalo: 0913031073 · Email: chungsongthinh@gmail.com')]
    }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 360 },
        children: [new TextRun({
            text: '© 2026 Bản quyền thuộc ChungTran · 0913031073',
            size: 20, color: MUTED, italics: true, ...fontBody
        })]
    }),
    new Paragraph({ children: [new PageBreak()] })
];

// ============ MỤC LỤC ============
const toc = [
    h1('MỤC LỤC'),
    p([bold('PHẦN 1. '), tr('GIỚI THIỆU ............................................................................ 3')]),
    p([bold('PHẦN 2. '), tr('CÀI ĐẶT EXTENSION (6 BƯỚC) ........................... 4')]),
    p([bold('PHẦN 3. '), tr('SỬ DỤNG SỔ NHẬN XÉT - AI .................................. 7')]),
    p([tr('     3.1. Tạo nhận xét môn học cho cả lớp ............................ 7')]),
    p([tr('     3.2. Tạo nhận xét Năng lực & Phẩm chất ..................... 10')]),
    p([tr('     3.3. Lưu nhận xét vào Vnedu ............................................ 12')]),
    p([bold('PHẦN 4. '), tr('KÍCH HOẠT BẢN QUYỀN ........................................... 13')]),
    p([bold('PHẦN 5. '), tr('KHẮC PHỤC SỰ CỐ THƯỜNG GẶP ........................ 14')]),
    p([bold('PHẦN 6. '), tr('BẢO MẬT & LIÊN HỆ HỖ TRỢ ................................ 15')]),
    new Paragraph({ children: [new PageBreak()] })
];

// ============ PHẦN 1: GIỚI THIỆU ============
const part1 = [
    h1('PHẦN 1. GIỚI THIỆU'),

    h2('Sổ nhận xét - AI là gì?'),
    p([
        tr('"'),
        bold('Sổ nhận xét - AI'),
        tr('" là một tiện ích (extension) miễn phí cho trình duyệt Chrome, được phát triển '),
        bold('bởi giáo viên — cho giáo viên'),
        tr('. Tiện ích này giúp thầy/cô '),
        bold('tự động sinh nhận xét cuối kỳ'),
        tr(' cho cả lớp 35 học sinh chỉ trong 5 phút, thay vì 3-4 giờ viết tay như trước.')
    ]),

    h2('Tiện ích này dành cho ai?'),
    bullet('Giáo viên đang dạy bậc Tiểu học (lớp 1 đến lớp 5)'),
    bullet('Trường có sử dụng hệ thống Vnedu để nhập điểm và nhận xét'),
    bullet('Giáo viên muốn tiết kiệm thời gian cuối kỳ cho việc khác (chấm thi, họp PHHS...)'),

    h2('Tính năng chính'),
    bullet('Sinh nhận xét cho 12 môn học (Tiếng Việt, Toán, TNXH, Khoa học, Lịch sử-Địa lí, Đạo đức, Tin học, Tiếng Anh, GDTC, Âm nhạc, Mĩ thuật, HĐTN)'),
    bullet('Tự động đề xuất 16-18 mục Năng lực & Phẩm chất theo Thông tư 27/2020 (16 mục cho lớp 1-2, 18 mục cho lớp 3-5)'),
    bullet('Áp dụng nhận xét vào Vnedu chỉ với 1 nút bấm'),
    bullet('Hỗ trợ giáo viên Nam và Nữ với cách xưng hô riêng (Thầy/Cô)'),
    bullet('Câu chữ đa dạng — không trùng lặp giữa các học sinh trong cùng lớp'),
    bullet('Thông tin học sinh chỉ ở máy thầy/cô, không gửi ra ngoài'),

    h2('Yêu cầu hệ thống'),
    bullet('Máy tính chạy Windows 10/11, macOS, hoặc Linux'),
    bullet('Trình duyệt Google Chrome (phiên bản từ 2024 trở lên — khuyến nghị cập nhật bản mới nhất)'),
    bullet('Tài khoản Vnedu của giáo viên (do nhà trường cấp)'),
    bullet('Kết nối Internet trong lúc cài đặt và kích hoạt bản quyền'),

    new Paragraph({ children: [new PageBreak()] })
];

// ============ PHẦN 2: CÀI ĐẶT ============
const part2 = [
    h1('PHẦN 2. CÀI ĐẶT EXTENSION (6 BƯỚC)'),
    p([
        tr('Phiên bản '),
        bold('V.01'),
        tr(' đang chờ Google duyệt trên Chrome Web Store. Trong thời gian chờ, thầy/cô cài đặt thủ công theo 6 bước dưới đây — chỉ mất khoảng '),
        bold('2 phút'),
        tr('.')
    ]),
    spacer(),
    calloutBox(
        '⚠ Lưu ý quan trọng',
        'Trước khi cài bản V.01, nếu máy đã có bản cũ "Cô Giáo AI" hoặc "Sổ nhận xét - AI" phiên bản trước, vui lòng GỠ HẾT các bản đó trước khi cài bản mới. Tránh chạy 2 bản cùng lúc gây xung đột.'
    ),

    h2('Bước 1. Tải file cài đặt'),
    p([
        tr('Truy cập website: '),
        code('https://sonhanxet-ai.vercel.app/'),
        tr(' bằng trình duyệt Chrome. Tại trang chủ, bấm nút '),
        bold('"⬇ Tải file cài đặt"'),
        tr(' (màu xanh đậm, ở giữa trang).')
    ]),
    p([
        tr('File '),
        code('sonhanxet-ai-v1.0.zip'),
        tr(' (khoảng 462 KB) sẽ được tải về thư mục '),
        code('Downloads'),
        tr(' của máy.')
    ]),
    imagePlaceholder('Trang chủ sonhanxet-ai.vercel.app với nút TẢI FILE CÀI ĐẶT nổi bật ở giữa'),

    h2('Bước 2. Giải nén file zip'),
    p([
        tr('Mở thư mục '),
        code('Downloads'),
        tr(', tìm file '),
        code('sonhanxet-ai-v1.0.zip'),
        tr(' vừa tải về.')
    ]),
    p([
        bold('Click chuột phải '),
        tr('vào file → chọn '),
        bold('"Giải nén tất cả..."'),
        tr(' (Extract All) → trong cửa sổ hiện ra, chọn nơi giải nén (khuyến nghị: '),
        bold('Desktop'),
        tr(' để dễ tìm) → bấm '),
        bold('"Giải nén"'),
        tr('.')
    ]),
    p([
        tr('Sau khi giải nén, sẽ xuất hiện một '),
        bold('FOLDER'),
        tr(' mới tên '),
        code('sonhanxet-ai-v1.0'),
        tr(' chứa các tệp tin của tiện ích.')
    ]),
    calloutBox(
        '⚠ Đừng xoá folder vừa giải nén',
        'Chrome đọc trực tiếp từ folder này khi chạy tiện ích. Nếu xoá folder, tiện ích sẽ ngừng hoạt động. Khuyến nghị: để folder cố định ở 1 chỗ (vd Desktop) và không di chuyển.'
    ),
    imagePlaceholder('Cửa sổ "Giải nén tất cả" của Windows + folder kết quả trên Desktop'),

    h2('Bước 3. Mở trang quản lý tiện ích Chrome'),
    p([
        tr('Mở trình duyệt Chrome. Copy đường dẫn sau và dán vào '),
        bold('thanh địa chỉ'),
        tr(' (chỗ gõ URL ở trên cùng), rồi nhấn '),
        code('Enter'),
        tr(':')
    ]),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 240 },
        shading: { type: ShadingType.CLEAR, fill: 'F4F6FB' },
        children: [code('chrome://extensions')]
    }),
    p([
        tr('Trang quản lý tiện ích sẽ hiện ra với tiêu đề '),
        bold('"Tiện ích"'),
        tr(' (Extensions). Đây là nơi quản lý tất cả tiện ích đã cài trong Chrome.')
    ]),

    h2('Bước 4. Bật "Chế độ nhà phát triển"'),
    p([
        tr('Nhìn lên '),
        bold('góc trên bên phải '),
        tr('của trang '),
        code('chrome://extensions'),
        tr('. Sẽ có một công tắc nhỏ ghi '),
        bold('"Chế độ nhà phát triển"'),
        tr(' (Developer mode).')
    ]),
    p([
        bold('Gạt công tắc'),
        tr(' sang phải để '),
        bold('BẬT'),
        tr(' (công tắc chuyển sang màu xanh). Khi bật xong, ở góc trên bên trái sẽ xuất hiện thêm 3 nút mới: '),
        bold('"Tải tiện ích đã giải nén"'),
        tr(', "Đóng gói tiện ích", "Cập nhật".')
    ]),
    imagePlaceholder('Trang chrome://extensions với công tắc "Chế độ nhà phát triển" được khoanh đỏ ở góc phải'),

    h2('Bước 5. Tải tiện ích đã giải nén'),
    p([
        tr('Bấm nút '),
        bold('"Tải tiện ích đã giải nén"'),
        tr(' (Load unpacked) ở góc trên bên trái. Cửa sổ chọn folder hiện ra.')
    ]),
    p([
        tr('Trỏ đến '),
        bold('FOLDER đã giải nén ở Bước 2'),
        tr(' (vd '),
        code('Desktop\\sonhanxet-ai-v1.0'),
        tr(') → bấm '),
        bold('"Chọn thư mục"'),
        tr('.')
    ]),
    calloutBox(
        '❗ Quan trọng',
        'Phải chọn FOLDER (thư mục) đã giải nén, KHÔNG phải file .zip. Nếu chọn nhầm file .zip, Chrome sẽ báo lỗi.'
    ),
    spacer(),
    p([
        tr('Sau khi chọn xong, tiện ích '),
        bold('"Sổ nhận xét - AI"'),
        tr(' sẽ xuất hiện trong danh sách với biểu tượng cuốn sách màu xanh và phiên bản '),
        bold('1.0'),
        tr('.')
    ]),
    imagePlaceholder('Tiện ích "Sổ nhận xét - AI · 1.0" hiển thị trong danh sách chrome://extensions'),

    h2('Bước 6. Kiểm tra cài đặt thành công'),
    p([
        tr('Mở '),
        bold('tab mới'),
        tr(' trong Chrome, đăng nhập trang '),
        code('https://vnedu.vn'),
        tr(' bằng tài khoản giáo viên.')
    ]),
    p([
        tr('Truy cập đường dẫn: '),
        bold('Sổ điểm → Sổ nhận xét'),
        tr(' → chọn lớp, môn, học kỳ. '),
        bold('Sidebar tiện ích sẽ tự xuất hiện bên phải màn hình'),
        tr(' với tiêu đề "Sổ nhận xét - AI".')
    ]),
    calloutBox(
        '✓ Cài đặt thành công',
        'Nếu thấy sidebar bên phải, tiện ích đã hoạt động bình thường. Tiến hành đăng ký bản quyền tại Phần 4 để dùng đầy đủ tính năng.',
        'D1FAE5', '059669'
    ),
    new Paragraph({ children: [new PageBreak()] })
];

// ============ PHẦN 3: SỬ DỤNG ============
const part3 = [
    h1('PHẦN 3. SỬ DỤNG SỔ NHẬN XÉT - AI'),

    h2('3.1. Tạo nhận xét môn học cho cả lớp'),

    h3('Bước 1. Mở trang Sổ nhận xét trên Vnedu'),
    p([
        tr('Đăng nhập '),
        code('vnedu.vn'),
        tr(' → vào menu '),
        bold('Sổ điểm → Sổ nhận xét'),
        tr('. Tại đây, chọn '),
        bold('Khối, Lớp, Môn, Học kỳ'),
        tr(' mà thầy/cô muốn tạo nhận xét.')
    ]),
    p([
        tr('Bảng danh sách học sinh hiện ra với các cột: STT, Mã HS, Họ tên, Mức (T+/T/H/C), Nhận xét. '),
        bold('Sidebar Sổ nhận xét - AI tự xuất hiện bên phải'),
        tr(' và phát hiện số lượng học sinh trong lớp.')
    ]),
    imageCenter('screenshot-01-discover.png', 540),
    caption('Hình 3.1 — Vnedu hiển thị danh sách 35 HS, sidebar tiện ích đã kết nối ở bên phải.'),

    h3('Bước 2. Nhập điểm hoặc xếp loại cho học sinh'),
    p([
        tr('Trong cột '),
        bold('Mức'),
        tr(' của Vnedu, đảm bảo từng học sinh đã được xếp loại '),
        code('T+'),
        tr(' (Hoàn thành tốt xuất sắc), '),
        code('T'),
        tr(' (Tốt), '),
        code('H'),
        tr(' (Hoàn thành), hoặc '),
        code('C'),
        tr(' (Cần cố gắng) theo Thông tư 27/2020.')
    ]),
    p([
        tr('Nếu có học sinh chưa xếp loại, tiện ích sẽ '),
        bold('bỏ qua'),
        tr(' học sinh đó (không tạo nhận xét) để tránh sinh nhầm.')
    ]),

    h3('Bước 3. Bấm "Sinh nhận xét"'),
    p([
        tr('Trên sidebar bên phải, bấm nút '),
        bold('"Sinh nhận xét cho 35 HS"'),
        tr(' (số HS tùy lớp). Tiện ích sẽ:')
    ]),
    numbered('Quét toàn bộ danh sách HS và mức đánh giá'),
    numbered('Sinh nhận xét phù hợp với từng mức (T+/T/H/C)'),
    numbered('Đảm bảo câu chữ đa dạng — không trùng lặp giữa các HS'),
    numbered('Hiển thị preview để giáo viên xem trước'),
    spacer(),

    h3('Bước 4. Xem trước và chỉnh sửa'),
    p([
        tr('Sidebar hiển thị '),
        bold('XEM TRƯỚC'),
        tr(' lần lượt các nhận xét. Thầy/cô có thể '),
        bold('click vào từng nhận xét'),
        tr(' để chỉnh sửa trực tiếp trước khi áp dụng — vd thêm chi tiết riêng cho 1 HS đặc biệt.')
    ]),
    imageCenter('screenshot-02-preview.png', 540),
    caption('Hình 3.2 — Xem trước nhận xét cho từng HS, có thể chỉnh sửa câu chữ trước khi áp dụng.'),

    h3('Bước 5. Áp dụng vào Vnedu'),
    p([
        tr('Sau khi hài lòng với toàn bộ nhận xét, bấm nút '),
        bold('"Áp dụng X nhận xét vào Vnedu"'),
        tr(' (màu vàng, ở cuối sidebar). Tiện ích sẽ tự động '),
        bold('điền nhận xét vào cột "Nhận xét"'),
        tr(' của Vnedu cho từng HS tương ứng.')
    ]),
    imageCenter('screenshot-03-apply.png', 540),
    caption('Hình 3.3 — Tiện ích đã ghi 35 nhận xét vào Vnedu. Cần bấm nút "Lưu" của Vnedu để hoàn tất.'),

    calloutBox(
        '⚠ Đừng quên bấm "Lưu"',
        'Sau khi tiện ích áp dụng nhận xét, dữ liệu mới chỉ nằm trong trang. Phải bấm nút "Lưu" của Vnedu (góc dưới bên trái) để ghi vào hệ thống. Tiện ích có thể tự bấm Lưu giúp thầy/cô — chỉ cần đồng ý ở popup hiện ra.'
    ),

    new Paragraph({ children: [new PageBreak()] }),

    h2('3.2. Tạo nhận xét Năng lực & Phẩm chất (NL/PC)'),

    h3('Bước 1. Mở trang Phẩm chất - Năng lực ghi học bạ'),
    p([
        tr('Trên Vnedu, vào menu '),
        bold('Hồ sơ HS → Phẩm chất - Năng lực ghi học bạ'),
        tr('. Chọn Khối, Lớp, Học kỳ. Bảng hiển thị 16-18 ô nhận xét cho mỗi HS (16 ô cho lớp 1-2, 18 ô cho lớp 3-5 — có thêm Công nghệ và Tin học).')
    ]),

    h3('Bước 2. Chọn học sinh từ danh sách'),
    p([
        tr('Trong cột bên trái Vnedu, '),
        bold('click chọn 1 học sinh'),
        tr('. Form 16-18 ô nhận xét sẽ hiển thị bên phải. Sidebar tiện ích cũng '),
        bold('tự sync theo HS đang chọn'),
        tr('.')
    ]),

    h3('Bước 3. Sidebar tự suy NL/PC từ điểm các môn'),
    p([
        tr('Tiện ích sẽ tự động '),
        bold('suy ra mức đánh giá T (Tốt), Đ (Đạt), C (Cần cố gắng)'),
        tr(' cho 16-18 mục NL/PC dựa vào điểm các môn của HS đã lưu trong cache. Mỗi mục có 1 huy hiệu màu hiển thị mức.')
    ]),
    imageCenter('screenshot-04-nlpc.png', 540),
    caption('Hình 3.4 — Form Phẩm chất - Năng lực với 16-18 mục, sidebar tự suy 13/13 hoặc 18/18 mục từ điểm.'),

    h3('Bước 4. Click huy hiệu để chỉnh mức (nếu cần)'),
    p([
        tr('Nếu thầy/cô không đồng ý với mức tự suy, '),
        bold('click vào huy hiệu '),
        tr('(T/Đ/C) của mục đó. Huy hiệu sẽ xoay vòng theo thứ tự T → Đ → C → T.')
    ]),

    h3('Bước 5. Bấm "Tạo nhận xét" và "Áp dụng"'),
    p([
        tr('Sau khi mức đánh giá đã đúng, bấm '),
        bold('"Tạo nhận xét"'),
        tr(' → tiện ích sinh ra văn bản nhận xét cho từng mục. Bấm '),
        bold('"Áp dụng vào Vnedu"'),
        tr(' để điền nhận xét vào form. '),
        bold('Quan trọng: bấm Lưu của Vnedu'),
        tr(' để hoàn tất.')
    ]),

    new Paragraph({ children: [new PageBreak()] }),

    h2('3.3. Lưu nhận xét vào Vnedu'),
    p([
        tr('Sau mỗi lần áp dụng nhận xét (môn học hoặc NL/PC), tiện ích sẽ hiển thị popup '),
        bold('"Đã áp dụng thành công"'),
        tr(' với 2 lựa chọn:')
    ]),
    bullet('Lưu vào Vnedu — tiện ích tự bấm nút Lưu của Vnedu thay thầy/cô (khuyến nghị)'),
    bullet('Để sau — đóng popup, thầy/cô tự kiểm tra và bấm Lưu sau'),
    spacer(),
    calloutBox(
        '💡 Mẹo nhỏ',
        'Nên kiểm tra lại 2-3 nhận xét đầu tiên trước khi bấm Lưu. Nếu thấy ổn thì các nhận xét khác cũng tương tự — tiết kiệm thời gian kiểm tra.'
    ),
    new Paragraph({ children: [new PageBreak()] })
];

// ============ PHẦN 4: KÍCH HOẠT ============
const part4 = [
    h1('PHẦN 4. KÍCH HOẠT BẢN QUYỀN'),
    p([
        tr('Bản miễn phí cho phép thầy/cô dùng thử '),
        bold('1 môn học'),
        tr(' để trải nghiệm. Mở khóa '),
        bold('toàn bộ 12 môn + 16-18 mục NL/PC'),
        tr(' với chi phí '),
        bold('50.000đ / máy / năm'),
        tr(' (đăng ký 1 lần, dùng 365 ngày trên máy đã kích hoạt).')
    ]),

    h2('Bước 1. Đăng ký nhận mã'),
    p([
        tr('Mở sidebar tiện ích trên Vnedu → bấm biểu tượng '),
        bold('⚙ Cài đặt'),
        tr(' (góc trên bên phải sidebar) → chọn mục '),
        bold('🔓 Bản quyền'),
        tr(' → bấm '),
        bold('"Đăng ký nhận mã"'),
        tr('.')
    ]),
    p('Điền họ tên + số điện thoại (đúng định dạng 10-11 chữ số). Sau khi gửi, hệ thống sinh ra 1 mã 4 ký tự dành riêng cho thầy/cô.'),

    h2('Bước 2. Chuyển khoản 50.000đ'),
    p([
        tr('Quét mã QR hiển thị trong sidebar bằng ứng dụng ngân hàng. Nội dung chuyển khoản: '),
        bold('ghi đúng MÃ 4 KÝ TỰ'),
        tr(' đã nhận. Số tiền: '),
        bold('50.000đ chẵn'),
        tr('.')
    ]),
    calloutBox(
        '⚠ Lưu ý',
        'Nội dung chuyển khoản BẮT BUỘC là mã 4 ký tự (không phải tên hay mã khác). Nếu ghi sai, admin sẽ liên hệ qua SĐT đã đăng ký để xác minh.'
    ),

    h2('Bước 3. Đợi xác nhận'),
    p('Admin sẽ xác nhận chuyển khoản trong 1-24 giờ làm việc. Sau khi xác nhận, mã sẽ chuyển trạng thái "Đã thanh toán" và sẵn sàng kích hoạt.'),

    h2('Bước 4. Kích hoạt trên máy'),
    p([
        tr('Quay lại sidebar tiện ích → '),
        bold('⚙ Cài đặt → Bản quyền'),
        tr(' → bấm '),
        bold('"Tôi đã chuyển khoản — đăng nhập"'),
        tr('. Nhập SĐT + mã 4 ký tự → bấm '),
        bold('"Đăng nhập / Kích hoạt"'),
        tr('.')
    ]),
    p('Hoàn tất! Tiện ích mở khóa toàn bộ tính năng cho 365 ngày.'),

    h2('Đổi máy / Cài lại Windows'),
    p([
        tr('Liên hệ admin qua Zalo '),
        bold('0913031073'),
        tr(' để '),
        bold('reset thiết bị'),
        tr(' miễn phí. Sau đó dùng lại mã cũ trên máy mới, không tốn thêm phí.')
    ]),
    new Paragraph({ children: [new PageBreak()] })
];

// ============ PHẦN 5: KHẮC PHỤC ============
const part5 = [
    h1('PHẦN 5. KHẮC PHỤC SỰ CỐ THƯỜNG GẶP'),

    h2('Lỗi 1. Chrome hiện cảnh báo "Vô hiệu hoá tiện ích chế độ nhà phát triển"'),
    p([
        bold('Nguyên nhân: '),
        tr('cảnh báo bình thường khi cài thủ công qua "Load unpacked". Chrome bảo vệ người dùng khỏi tiện ích chưa được Google duyệt.')
    ]),
    p([
        bold('Cách xử lý: '),
        tr('chọn '),
        bold('"Giữ tiện ích"'),
        tr(' (Keep extension). Sau khi V.01 được Google duyệt trên Chrome Web Store (1-7 ngày), cảnh báo này sẽ tự biến mất.')
    ]),

    h2('Lỗi 2. Không thấy biểu tượng tiện ích trên Vnedu'),
    p([
        bold('Kiểm tra: '),
        tr('vào '),
        code('chrome://extensions'),
        tr(' → tìm "Sổ nhận xét - AI" → đảm bảo '),
        bold('công tắc đã BẬT'),
        tr('. Nếu đã bật, thử F5 lại trang Vnedu.')
    ]),
    p([
        bold('Chắc chắn: '),
        tr('đang ở trang '),
        bold('Sổ điểm → Sổ nhận xét'),
        tr(' hoặc '),
        bold('Hồ sơ HS → Phẩm chất Năng lực'),
        tr('. Tiện ích chỉ hiện trên các trang này.')
    ]),

    h2('Lỗi 3. Tiện ích biến mất sau khi tắt Chrome'),
    p([
        bold('Nguyên nhân: '),
        tr('folder đã giải nén bị xoá hoặc di chuyển. Chrome cần folder gốc để chạy tiện ích.')
    ]),
    p([
        bold('Cách xử lý: '),
        tr('giải nén lại file zip → vào '),
        code('chrome://extensions'),
        tr(' → "Tải tiện ích đã giải nén" với folder mới.')
    ]),

    h2('Lỗi 4. Sinh nhận xét thiếu HS hoặc sai mức'),
    p([
        bold('Nguyên nhân: '),
        tr('HS chưa có xếp loại trong Vnedu (cột "Mức" trống) hoặc xếp loại không hợp lệ.')
    ]),
    p([
        bold('Cách xử lý: '),
        tr('kiểm tra lại cột "Mức" trong Vnedu, đảm bảo từng HS đã có 1 trong 4 mức: T+, T, H, C. Sau đó bấm '),
        bold('"Cập nhật dữ liệu từ Vnedu"'),
        tr(' trên sidebar để quét lại.')
    ]),

    h2('Lỗi 5. Áp dụng NL/PC nhưng ô Công nghệ + Tin học trống (lớp 3-5)'),
    p([
        bold('Nguyên nhân: '),
        tr('phiên bản cũ chưa hỗ trợ. Đã được sửa trong V.01.')
    ]),
    p([
        bold('Cách xử lý: '),
        tr('đảm bảo đang dùng bản '),
        bold('V.01 (phiên bản 1.0)'),
        tr('. Kiểm tra phiên bản ở '),
        code('chrome://extensions'),
        tr('. Nếu bản cũ, gỡ và cài lại theo Phần 2.')
    ]),

    h2('Cần hỗ trợ trực tiếp?'),
    calloutBox(
        '📞 Liên hệ ChungTran',
        'Gọi điện hoặc Zalo: 0913031073 (giờ hành chính). Email: chungsongthinh@gmail.com. Gửi kèm ảnh chụp màn hình để được hỗ trợ nhanh nhất.'
    ),
    new Paragraph({ children: [new PageBreak()] })
];

// ============ PHẦN 6: BẢO MẬT ============
const part6 = [
    h1('PHẦN 6. BẢO MẬT & LIÊN HỆ HỖ TRỢ'),

    h2('Cam kết bảo mật'),
    imageCenter('screenshot-05-security.png', 480),
    caption('Hình 6.1 — Cam kết bảo mật của Sổ nhận xét - AI: thông tin học sinh chỉ ở máy thầy cô.'),

    bullet('KHÔNG thu thập tên, điểm hay bất kỳ thông tin nào của học sinh'),
    bullet('Dữ liệu học sinh chỉ tồn tại trong trình duyệt — đóng tab là biến mất'),
    bullet('Mã nguồn mở — bất kỳ ai có kiến thức kỹ thuật đều có thể kiểm tra'),
    bullet('Chỉ 3 thông tin của GIÁO VIÊN rời máy: số điện thoại, mã kích hoạt, mã định danh thiết bị (hash) — chỉ dùng để xác thực bản quyền'),
    bullet('Tuân thủ tinh thần Luật An toàn Thông tin Trẻ em Việt Nam'),

    h2('Chính sách bảo mật đầy đủ'),
    p([
        tr('Xem chi tiết tại: '),
        code('https://sonhanxet-ai.vercel.app/privacy')
    ]),

    h2('Liên hệ tác giả'),
    p([bold('Họ tên: '), tr('Chung Trần')]),
    p([bold('Chức vụ: '), tr('Phó Hiệu trưởng — Trường Tiểu học Diễn Liên')]),
    p([bold('Địa chỉ: '), tr('Xã Quảng Châu, Tỉnh Nghệ An')]),
    p([bold('Điện thoại / Zalo: '), tr('0913031073')]),
    p([bold('Email: '), tr('chungsongthinh@gmail.com')]),
    p([bold('Website: '), code('https://sonhanxet-ai.vercel.app/')]),

    spacer(),
    spacer(),

    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 480 },
        children: [bold('— Hết hướng dẫn —', NAVY)]
    }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120 },
        children: [tr('Cảm ơn thầy/cô đã tin dùng Sổ nhận xét - AI!')]
    }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 360 },
        children: [new TextRun({
            text: '© 2026 Bản quyền thuộc ChungTran · 0913031073',
            size: 20, color: MUTED, italics: true, ...fontBody
        })]
    })
];

// ============ ASSEMBLE ============
const doc = new Document({
    creator: 'ChungTran',
    title: 'Hướng dẫn cài đặt và sử dụng Sổ nhận xét - AI V.01',
    description: 'Hướng dẫn chi tiết cho giáo viên tiểu học',
    styles: {
        default: {
            document: {
                run: { font: 'Times New Roman', size: 24 }
            }
        }
    },
    numbering: {
        config: [{
            reference: 'main-numbering',
            levels: [{
                level: 0,
                format: LevelFormat.DECIMAL,
                text: '%1.',
                alignment: AlignmentType.START
            }]
        }]
    },
    sections: [{
        properties: {
            page: {
                margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
            }
        },
        children: [
            ...cover,
            ...toc,
            ...part1,
            ...part2,
            ...part3,
            ...part4,
            ...part5,
            ...part6
        ]
    }]
});

Packer.toBuffer(doc).then(buf => {
    const out = path.join(ROOT, 'Huong_dan_So_Nhan_Xet_AI_V01.docx');
    fs.writeFileSync(out, buf);
    const sz = (buf.length / 1024).toFixed(1);
    console.log(`OK: ${out} (${sz} KB)`);
});

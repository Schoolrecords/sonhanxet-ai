/**
 * NhanXetEngine V4.1 — Câu nền chuẩn (TT27/2020 + CT GDPT 2018)
 *
 * Khác V4.0:
 *   - +260 phrase (5/tier × 4 tier × 13 môn) đưa vào grade.all_ky + ngan flat
 *   - TẮT toàn bộ STYLE_SUFFIX cứng (mục IV spec V4.1) — câu trong bank đã hoàn chỉnh
 *   - _safeFallback rewrite theo spec (13 môn × 4 tier)
 *   - REMEDIATION_PHRASES mở rộng (cần được hướng dẫn / cần ôn / cần thực hành / cần cẩn thận / cần chủ động)
 *
 * Nguyên tắc V4.1 (đọc thêm spec mục I):
 *   - Câu mở đầu "Em", không gắn tên HS
 *   - Không phụ thuộc giới tính GV (cô/thầy/thầy cô/cô giảng…)
 *   - Không suy diễn hành vi từ điểm số (yêu thích/phát biểu/năng khiếu/tấm gương…)
 *   - Tier ht/cht BẮT BUỘC có định hướng rèn luyện cụ thể
 *   - KHÔNG ghép suffix khiên cưỡng kiểu "trong các tuần học tiếp theo"
 */

// V4.0: HARD_BAN giữ nguyên (V2.3.9) — cấm cụm tiêu cực cụ thể.
const HARD_BAN_WORDS = Object.freeze([
    'học yếu', 'còn yếu', 'yếu kém', 'yếu môn', 'năng lực yếu',
    'lười', 'không biết', 'chưa ngoan', 'mất gốc',
    'rất tệ', 'tệ', 'dốt', 'ngu', 'kinh khủng', 'không có ý thức'
]);

// V4.1: SOFT_BAN_PHRASES_SUBJECT — cấm 3 nhóm trong NHẬN XÉT MÔN HỌC (subject):
//   (a) Phụ thuộc giới tính GV (cô/thầy/cô giảng/...)
//   (b) Suy diễn hành vi từ điểm số (phát biểu/yêu thích/năng khiếu/sáng tạo/tấm gương/...)
//       theo spec V4.1 mục I.5 + I.9
//   (c) Hậu tố khiên cưỡng (trong các tuần học tiếp theo / chuẩn bị tốt cho lớp học tiếp theo / ...)
//       theo spec V4.1 mục I.10 + IV.2
// NLPC dùng SOFT_BAN_PHRASES_NLPC riêng — vẫn cho phép "ngoan/lễ phép/chuyên cần/...".
const SOFT_BAN_PHRASES_SUBJECT = Object.freeze([
    // (a) Giới tính GV
    'bài cô giao', 'cô giao bài', 'bài cô đã hướng dẫn',
    'cô giảng', 'cô hướng dẫn', 'cô đặt câu hỏi',
    'hỏi cô', 'nhờ cô', 'theo cô', 'cùng cô',
    'của cô', 'gợi ý của cô', 'theo cô gợi ý',
    'cô bạn', 'cô và bạn',
    // (b) Suy diễn hành vi từ điểm số
    'hăng hái phát biểu', 'tích cực phát biểu', 'giơ tay phát biểu', 'phát biểu xây dựng bài',
    'xây dựng bài', 'yêu thích', 'tự tin', 'chăm chú nghe giảng',
    'có năng khiếu', 'năng khiếu', 'tư duy sắc bén', 'vượt trội',
    'rất sáng tạo', 'tấm gương',
    'bài viết lôi cuốn', 'bài viết giàu hình ảnh',
    // (c) Hậu tố khiên cưỡng (spec IV.2)
    'trong các tuần học tiếp theo',
    'chuẩn bị tốt cho lớp học tiếp theo',
    'gia đình phối hợp hỗ trợ để em tiến bộ từng bước',
    'gia đình phối hợp hỗ trợ để em củng cố kiến thức từng bước',
    'gia đình phối hợp hỗ trợ để em tiến bộ hơn trong học kỳ ii',
    'em cố gắng hơn ở năm học tới'
]);

// V4.0: SOFT_BAN cho NL/PC — cho phép "thầy cô" nhưng vẫn cấm cụm sai giới tính rõ ràng
const SOFT_BAN_PHRASES_NLPC = Object.freeze([
    'bài cô giao', 'cô giảng', 'cô hướng dẫn', 'cô đặt câu hỏi',
    'hỏi cô', 'nhờ cô riêng'
]);

// Backward compat — default vẫn dùng phiên bản subject (chặt hơn)
const SOFT_BAN_PHRASES = SOFT_BAN_PHRASES_SUBJECT;

// V4.0: TEACHER_PRONOUN — bắt "cô"/"thầy" đứng riêng (không kèm "thầy cô")
// để KHÔNG match "thầy cô" hợp lệ ở NL/PC nhưng vẫn bắt "cô giảng" ở subject.
// Áp dụng riêng cho subject comment (cho qua ở NLPC).
const TEACHER_PRONOUN_REGEX = /(?:^|[^a-zA-ZÀ-ỹ0-9])(cô|thầy)(?:\s+(?!cô\b))/i;

// V2.3.9: BỎ VAGUE_PHRASES check (vì pool THDienLien dùng cụm chung là OK)
const VAGUE_PHRASES = Object.freeze([]);

// V2.3.7: Biểu hiện môn học cụ thể — phrase VAGUE chỉ qua được validate nếu chứa ÍT NHẤT
// 1 trong các cụm sau (theo môn). Không có biểu hiện cụ thể → câu chung chung, loại.
const SUBJECT_SIGNALS = Object.freeze({
    toan: [
        'số thập phân', 'phân số', 'tỉ số phần trăm', 'tỉ số',
        'đo lường', 'đo đại lượng', 'đo độ dài', 'đo khối lượng', 'đại lượng',
        'đơn vị đo', 'đơn vị đại lượng', 'đổi đơn vị',
        'hình học', 'diện tích', 'thể tích', 'chu vi',
        'giải toán', 'bài toán', 'lời văn', 'lời giải', 'đáp số',
        'phân tích đề', 'trình bày bài giải', 'kiểm tra kết quả',
        'tính toán', 'tính nhẩm', 'tính nhanh', 'tính giá trị biểu thức', 'biểu thức',
        'phép cộng', 'phép trừ', 'phép nhân', 'phép chia',
        'cộng trừ', 'nhân chia', 'bảng nhân', 'bảng chia', 'phép tính',
        'số tự nhiên', 'so sánh số', 'đọc viết số', 'nhận biết số', 'đếm',
        'nhận biết hình', 'các hình', 'hình vuông', 'hình tròn', 'hình tam giác',
        'hình bình hành', 'hình thoi', 'hình thang', 'hình hộp', 'hình chữ nhật', 'hình tứ giác',
        'đường thẳng', 'đường cong', 'đường gấp khúc',
        'chuyển động', 'biểu đồ', 'đặt phép tính', 'đặt tính',
        'xem giờ', 'số có hai chữ số', 'số có ba chữ số', 'lớp triệu', 'phạm vi'
    ],
    'tieng-viet': [
        'đọc hiểu', 'đọc trơn', 'đọc thầm', 'đọc lưu loát', 'đọc to', 'đọc tiếng',
        'đọc âm', 'đọc bài', 'đọc văn bản',
        'dùng từ', 'đặt câu', 'luyện từ và câu', 'luyện từ',
        'chính tả', 'viết chữ', 'viết câu', 'viết đoạn', 'viết bài', 'viết đúng',
        'bài văn', 'đoạn văn', 'bố cục', 'diễn đạt', 'trình bày ý',
        'nói và nghe', 'kể chuyện', 'kể lại', 'phát âm', 'nghe nói',
        'vốn từ', 'mở rộng vốn từ', 'từ loại', 'từ đồng nghĩa', 'từ trái nghĩa', 'tiếng và câu',
        'đại từ', 'quan hệ từ', 'danh từ', 'động từ', 'tính từ',
        'câu ghép', 'câu kể', 'câu hỏi', 'câu cảm', 'dấu câu',
        'âm vần', 'phụ âm', 'ngữ pháp', 'thuyết trình', 'tô chữ', 'ghi âm',
        'văn bản', 'cảm thụ', 'tả cảnh', 'tả người', 'miêu tả', 'câu chuyện',
        'câu chào hỏi', 'chào hỏi'
    ]
});

// V4.0: GIỮ rỗng BEHAVIOR_WORDS — anh user OK phong cách THDienLien dùng
// "tích cực phát biểu / có năng khiếu / tấm gương".
const BEHAVIOR_WORDS_WITHOUT_DATA = Object.freeze([]);

// V4.1: REMEDIATION_PHRASES — tier ht/cht BẮT BUỘC có ≥1 cụm rèn luyện.
// Mở rộng cho phong cách câu nền chuẩn V4.1 (cần được hướng dẫn / cần ôn / cần thực hành...).
const REMEDIATION_PHRASES = Object.freeze([
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
]);

// V2.3.9: Giữ guard wrong-ky — đây vẫn là nghiệp vụ đúng (GHK2 không nói "năm học tới")
const WRONG_KY_PHRASES = Object.freeze({
    ghk1: ['năm học tới', 'năm sau', 'cuối năm', 'trong hè', 'lớp học tiếp theo', 'học kỳ ii', 'học kỳ 2'],
    chk1: ['năm học tới', 'năm sau', 'cuối năm', 'trong hè', 'lớp học tiếp theo'],
    ghk2: ['năm học tới', 'năm sau', 'cuối năm', 'trong hè', 'lớp học tiếp theo', 'sang học kỳ ii'],
    chk2: []
});

// Từ chỉ dùng cho tier tot_xs (9-10)
const TIER_RESTRICTED_WORDS = Object.freeze({
    tot_xs: [],
    tot: ['xuất sắc', 'vượt trội', 'sáng tạo vượt trội', 'nâng cao'],
    ht: ['xuất sắc', 'vượt trội', 'sáng tạo vượt trội', 'nâng cao', 'thành thạo'],
    cht: ['xuất sắc', 'vượt trội', 'sáng tạo vượt trội', 'nâng cao', 'thành thạo', 'tốt']
});

// V2.3.7: STYLE_SUFFIX viết lại theo KỲ NHẬN XÉT (không dùng "năm học tới" cho ghk*/chk1)
//   giuaky    : ghk1, ghk2  — chỉ nhắc "các tuần học tiếp theo"
//   cuoihk1   : chk1        — chỉ nhắc "học kỳ II"
//   cuoinam   : chk2        — có thể nhắc "lớp học tiếp theo"
//   dinhhuong : user chọn   — vế định hướng rèn luyện
//   ngan/default : không suffix
// V4.1: TẮT toàn bộ suffix cứng. Mỗi câu trong ngân hàng phải hoàn chỉnh
// (đã chứa định hướng rèn luyện cho ht/cht), không cần engine ghép thêm đuôi.
// Spec V4.1 yêu cầu: "Nếu câu đã có định hướng rèn luyện thì tuyệt đối không nối thêm suffix."
const STYLE_SUFFIX = Object.freeze({
    giuaky:    { tot_xs: '', tot: '', ht: '', cht: '' },
    cuoihk1:   { tot_xs: '', tot: '', ht: '', cht: '' },
    cuoinam:   { tot_xs: '', tot: '', ht: '', cht: '' },
    dinhhuong: { tot_xs: '', tot: '', ht: '', cht: '' },
    ngan:      { tot_xs: '', tot: '', ht: '', cht: '' },
    default:   { tot_xs: '', tot: '', ht: '', cht: '' }
});

// V2.3: Focus theo môn × lớp cho fallback template (port từ V3.0 ChatGPT, có chỉnh)
const FOCUS_BY_GRADE = Object.freeze({
    toan: {
        1: ['đếm, đọc viết số trong phạm vi 100 và phép cộng trừ không nhớ',
            'nhận biết hình khối, đo độ dài bằng đơn vị quen thuộc',
            'giải bài toán đơn giản và trình bày phép tính rõ ràng'],
        2: ['cộng trừ có nhớ trong phạm vi 1000 và nhân chia bước đầu',
            'đo đại lượng, tính chu vi hình tứ giác cơ bản',
            'giải bài toán có lời văn ngắn theo gợi ý'],
        3: ['nhân chia với số có hai chữ số và tính giá trị biểu thức',
            'tính chu vi và diện tích hình chữ nhật, hình vuông',
            'giải bài toán có lời văn nhiều bước trình bày khoa học'],
        4: ['bốn phép tính với số tự nhiên lớn và phân số bước đầu',
            'tính diện tích hình bình hành, hình thoi và đổi đơn vị đo',
            'giải bài toán nhiều bước, trình bày bài rõ ràng'],
        5: ['phân số, số thập phân và tỉ số phần trăm',
            'diện tích hình tam giác, hình thang, hình tròn và thể tích hình hộp',
            'bài toán chuyển động đều và toán tỉ số phần trăm']
    },
    'tieng-viet': {
        1: ['đọc trơn câu ngắn và viết chữ ghi vần quen thuộc',
            'viết chính tả các từ quen thuộc và nói câu chào hỏi',
            'nghe nói rõ ý và đọc bài tập đọc đúng yêu cầu'],
        2: ['đọc lưu loát đoạn văn và viết đoạn 3-4 câu theo chủ đề',
            'đặt câu đúng ngữ pháp và dùng dấu câu cơ bản',
            'kể lại câu chuyện ngắn theo chủ đề quen thuộc'],
        3: ['đọc hiểu đoạn dài và viết đoạn văn 4-5 câu mạch lạc',
            'mở rộng vốn từ và đặt câu theo các kiểu đã học',
            'kể chuyện trước lớp và viết chính tả đúng'],
        4: ['đọc hiểu văn bản và viết bài văn miêu tả theo chủ đề',
            'phân biệt từ loại danh từ, động từ, tính từ trong câu',
            'thuyết trình ngắn và viết chính tả phân biệt phụ âm'],
        5: ['đọc hiểu sâu văn bản và viết bài văn tả cảnh, tả người',
            'dùng đại từ, quan hệ từ và đặt câu ghép đúng cấu trúc',
            'trình bày ý kiến trong thảo luận và viết bài rõ bố cục']
    }
});

// V2.3: Template fallback — khi pool grade-data cạn nhưng vẫn còn slot trống.
// Câu ra có placeholder {focus} fill từ FOCUS_BY_GRADE.
const TEMPLATE_FALLBACK = Object.freeze({
    tot_xs: {
        default: [
            'Em nắm chắc kiến thức ở {focus}, trình bày bài giải khoa học và biết kiểm tra kết quả.',
            'Em vận dụng linh hoạt {focus}, làm bài chính xác và lập luận chặt chẽ.',
            'Em hiểu vững {focus}, trình bày bài giải rõ ràng và ít mắc sai sót.'
        ],
        tien_bo: [
            'Em tiến bộ rõ rệt ở {focus}, làm bài ngày càng chắc chắn và mạch lạc hơn.',
            'Em đã thành thạo {focus}, làm bài chính xác và biết kiểm tra lại kết quả.'
        ]
    },
    tot: {
        default: [
            'Em thực hiện thành thạo {focus}, làm bài cẩn thận và hoàn thành đúng yêu cầu.',
            'Em hiểu bài và làm tốt {focus}, trình bày bài rõ ràng và ít mắc sai sót.',
            'Em nắm chắc {focus}, biết áp dụng vào bài tập quen thuộc một cách thành thạo.'
        ],
        tien_bo: [
            'Em có nhiều tiến bộ ở {focus}, làm bài ngày càng cẩn thận và chính xác hơn.',
            'Em tiến bộ rõ ở {focus}, làm bài chắc chắn hơn và đáng được ghi nhận.'
        ]
    },
    ht: {
        default: [
            'Em đã thực hiện được {focus} ở mức cơ bản, cần luyện tập đều đặn để vững hơn.',
            'Em hoàn thành yêu cầu cơ bản ở {focus}, cần phát huy thêm trong thời gian tới.',
            'Em có cố gắng ở {focus}, cần rèn thêm để trình bày bài chắc chắn hơn.'
        ],
        tien_bo: [
            'Em có tiến bộ ở {focus}, cần tiếp tục luyện tập để kết quả vững chắc hơn.',
            'Em đã cố gắng hơn ở {focus}, cần duy trì nề nếp học tập và hỏi khi chưa rõ.'
        ]
    },
    cht: {
        default: [
            'Em cần củng cố {focus}, học chậm chắc và hỏi lại khi chưa hiểu để vững nền tảng.',
            'Em đã có cố gắng ở {focus}, cần được hỗ trợ thêm và luyện tập từng bước hằng ngày.',
            'Em hãy ôn lại {focus} đều đặn mỗi tối để củng cố kiến thức từng bước.'
        ],
        can_ho_tro: [
            'Em cần được hỗ trợ thường xuyên ở {focus}, kiên trì luyện tập mỗi ngày để tiến bộ.',
            'Em hãy luyện {focus} chậm và chắc, hỏi ngay khi chưa rõ để củng cố kiến thức.'
        ]
    }
});

// Nội dung sai cấp lớp — phrase chứa cụm này KHÔNG được dùng cho gradeLevel trong key
const GRADE_FORBIDDEN_CONTENT = Object.freeze({
    1: [], // lớp 1 không cấm gì — đặc thù lớp 1 OK
    2: ['phân số', 'số thập phân', 'tỉ số phần trăm'],
    3: ['số thập phân', 'tỉ số phần trăm'],
    4: ['bảng chữ cái', 'đánh vần', 'ghép vần', 'đếm xuôi đếm ngược'],
    5: [
        'bảng chữ cái', 'đánh vần', 'ghép vần',
        'đếm xuôi đếm ngược', 'đếm xuôi', 'đếm ngược',
        'bảng cửu chương', 'bảng cộng trừ', 'cộng trừ nhân chia',
        'di chuyển chuột', 'gõ bàn phím chậm',
        'thao tác di chuyển chuột', 'nét cơ bản: thẳng, cong'
        // V2.3.8: bỏ "phép tính cộng trừ" — vì "phép tính cộng trừ với phân số" hợp lệ cho L4-5
    ]
});

class NhanXetEngineV2 {
    constructor(options = {}) {
        this.options = {
            antiDupLevel: 'normal',
            // V6.1: vanPhong = 'hocba' (Văn phong học bạ/Vnedu — TT27 chuẩn, mặc định)
            //                 'thanthien' (Văn phong thân thiện — giữ xưng "Em")
            vanPhong: 'hocba',
            ...options
        };
        this.data = null;
        this.usedPhrases = new Set();
    }

    /**
     * V6.1: Chuyển câu sang Văn phong học bạ/Vnedu (TT27).
     * Nguyên tắc:
     *  - KHÔNG xưng "Em" / "con" / gọi tên HS trực tiếp
     *  - KHÔNG dùng "em hãy", "con nhé", "cô tin/thầy tin/thầy cô tin"
     *  - Mô tả khách quan: "Em đọc lưu loát..." → "Đọc lưu loát..."
     *  - "Em hãy luyện..." → "Cần luyện..."
     *  - "Em cần..." → "Cần..."
     *  - "Em biết..." → "Biết..."
     */
    _toHocBaStyle(text) {
        if (!text || typeof text !== 'string') return text;
        let s = text;

        // Step 1: Thay cụm "Em <động từ>" có ngữ nghĩa khuyến nghị/khách quan
        // (xử lý TRƯỚC khi bỏ "Em " trần để bảo toàn ngữ nghĩa)
        s = s.replace(/\bEm hãy\b/g, 'Cần');
        s = s.replace(/\bem hãy\b/g, 'cần');
        s = s.replace(/\bEm cần\b/g, 'Cần');
        s = s.replace(/\bem cần\b/g, 'cần');
        s = s.replace(/\bEm nên\b/g, 'Nên');
        s = s.replace(/\bem nên\b/g, 'nên');

        // Step 1b: "Em sẽ tiến bộ/tự tin/..." hơn, hãy/cần X — học bạ ưu tiên câu khuyến nghị trực tiếp
        // → bỏ vế đầu, giữ vế sau "X" (capitalize sau)
        // Match cả dấu "," (câu thường) và ";" (câu NLPC đa-vế)
        s = s.replace(/\bEm sẽ\s+[^,;]+\s+hơn[,;]\s+(hãy|cần|nên)?\s*/gi, '');

        // Step 2: Bỏ cụm xưng hô / tin tưởng cảm tính (TT27 cấm)
        s = s.replace(/\b(thầy cô tin|cô tin|thầy tin)\s+(tưởng\s+)?(rằng\s+|là\s+)?em\s+(sẽ\s+)?/gi, '');
        s = s.replace(/\b(thầy cô tin|cô tin|thầy tin)\s+(tưởng\s+)?(rằng|là)?\s*/gi, '');
        s = s.replace(/[,;]?\s*(con nhé|em nhé|nhé con|nhé em|con ạ|em ạ)\s*([.,;!?]|$)/gi, '$2');

        // Step 3: Bỏ "Em " ở đầu câu / đầu vế (sau ". ", "; ", "! ", "? ")
        s = s.replace(/(^|[.!?;]\s+)Em\s+/g, '$1');
        // Bỏ "em " mid-clause sau dấu phẩy (vế tiếp theo trong câu ghép)
        s = s.replace(/(,\s+)em\s+/g, '$1');

        // Step 4: "hãy" còn lại đầu vế (do bỏ "Em" mà ra) → "cần"
        s = s.replace(/(^|[.!?;]\s+)Hãy\s+/g, '$1Cần ');
        s = s.replace(/(,\s+)hãy\s+/gi, '$1cần ');

        // Step 5: Capitalize chữ đầu mỗi vế (sau khi bỏ "Em " có thể còn chữ thường)
        s = s.replace(/(^|[.!?]\s+)([a-zà-ỹ])/g, (m, p1, p2) => p1 + p2.toLocaleUpperCase('vi-VN'));

        // Step 6: Bỏ các đại từ tham chiếu HS còn sót (mid-clause)
        // "với em" / "cho em" / "của em" / "giúp em" — TT27 không xưng
        s = s.replace(/\b(với|cho|của|giúp|để|cùng|từ|về)\s+em\b/gi, '$1 học sinh');
        // Cuối cùng: cụm "em" độc lập còn sót → "học sinh"
        s = s.replace(/\bem\b/g, 'học sinh');
        s = s.replace(/\bEm\b/g, 'Học sinh');

        // Step 7: Dọn whitespace + dấu câu
        s = s.replace(/\s{2,}/g, ' ');
        s = s.replace(/\s+([,;.!?])/g, '$1');
        s = s.replace(/^[,;\s]+/, '');
        s = s.trim();

        // Step 8: Capitalize chữ cái đầu câu (sau dọn)
        if (s.length > 0) {
            s = s[0].toLocaleUpperCase('vi-VN') + s.slice(1);
        }

        return s;
    }

    loadData(data) {
        this.data = data;
        return this;
    }

    /**
     * V2.0: Load ky-specific data (Giữa HK1 / Cuối HK1 / Giữa HK2) từ
     * nhanxet-ky.json, merge vào this.data.subjects[code][ky].
     */
    loadKyData(kyData) {
        if (!this.data || !this.data.subjects) {
            console.warn('[Engine] loadKyData: chưa loadData() trước, bỏ qua');
            return this;
        }
        if (!kyData || !kyData.subjects) return this;
        for (const [subj, kyMap] of Object.entries(kyData.subjects)) {
            if (!this.data.subjects[subj]) continue;
            for (const [ky, pools] of Object.entries(kyMap)) {
                this.data.subjects[subj][ky] = pools;
            }
        }
        return this;
    }

    /**
     * V2.2: Load grade-specific data từ nhanxet-grade.json.
     * Cấu trúc gradeData.subjects[code].grades[gradeNum][ky][tier][trend] = [phrase...]
     * Merge vào this.data.subjects[code].grades — không ghi đè pool flat.
     */
    loadGradeData(gradeData) {
        if (!this.data || !this.data.subjects) {
            console.warn('[Engine] loadGradeData: chưa loadData() trước, bỏ qua');
            return this;
        }
        if (!gradeData || !gradeData.subjects) return this;
        for (const [subj, payload] of Object.entries(gradeData.subjects)) {
            if (!this.data.subjects[subj]) continue;
            if (!this.data.subjects[subj].grades) {
                this.data.subjects[subj].grades = {};
            }
            for (const [grade, kyMap] of Object.entries(payload.grades || {})) {
                this.data.subjects[subj].grades[grade] = kyMap;
            }
        }
        return this;
    }

    phanLoaiMuc(diem) {
        if (diem === null || diem === undefined) return 'ht';
        const d = parseFloat(diem);
        if (isNaN(d)) return 'ht';
        if (d >= 9) return 'tot_xs';
        if (d >= 7) return 'tot';
        if (d >= 5) return 'ht';
        return 'cht';
    }

    /**
     * V2.3.1: Chọn tier cho việc pick phrase.
     * Quy tắc:
     *   - Có điểm → dùng phanLoaiMuc(diem) (chi tiết hơn — phân biệt tot_xs vs tot).
     *     Vnedu chỉ có 3 mức T/H/C cho cột "Xếp loại", không có T+. Nếu trust mucDat
     *     thì 10đ và 7đ đều ra "T" → pick cùng pool tier `tot` → mất phân biệt.
     *   - Không có điểm (môn T/H/C: TNXH, ĐĐ, ÂN, MT, GDTC, HĐTN) → dùng mucDat
     *     normalize về key chuẩn.
     */
    _resolveTier(hs) {
        const d = parseFloat(hs && hs.diem);
        if (!isNaN(d)) return this.phanLoaiMuc(d);
        if (hs && hs.mucDat) {
            const m = String(hs.mucDat).trim().toLowerCase();
            // Map các biến thể về key chuẩn
            if (m === 'tot_xs' || m === 't+' || m === 'htt') return 'tot_xs';
            if (m === 'tot' || m === 't' || m === 'tốt' || m === 'hoan thanh tot') return 'tot';
            if (m === 'ht' || m === 'h' || m === 'đ' || m === 'd' || m === 'đạt' || m === 'dat' ||
                m === 'hoan thanh' || m === 'hoàn thành') return 'ht';
            if (m === 'cht' || m === 'c' || m === 'chua hoan thanh' || m === 'chưa hoàn thành') return 'cht';
        }
        return 'ht';
    }

    xepLoaiText(mucDo) {
        if (mucDo === 'tot_xs' || mucDo === 'tot') return 'T';
        if (mucDo === 'ht') return 'H';
        if (mucDo === 'cht') return 'C';
        return 'H';
    }

    xepLoaiBadge(mucDo) {
        if (mucDo === 'tot_xs') return 'T+';
        if (mucDo === 'tot') return 'T';
        if (mucDo === 'ht') return 'H';
        if (mucDo === 'cht') return 'C';
        return 'H';
    }

    randInt(max) {
        return Math.floor(Math.random() * max);
    }

    /**
     * V2.3: Seeded index — deterministic theo seedText, dùng FNV-1a hash.
     * Cùng seed + length → cùng index. Đảm bảo cùng HS regenerate ra cùng phrase.
     * Port từ V3.0 ChatGPT.
     */
    _seededIndex(seedText, length, salt = 0) {
        if (!length) return 0;
        const s = String(seedText || '') + '|' + salt;
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return Math.abs(h) % length;
    }

    chonNgauNhien(arr, seed) {
        if (!arr || arr.length === 0) return null;
        if (seed) return arr[this._seededIndex(seed, arr.length)];
        return arr[this.randInt(arr.length)];
    }

    /**
     * V2.3: Pick phrase từ pool, ưu tiên seeded (anti-flicker khi regenerate cùng HS),
     * fallback random nếu seed null. Anti-dup: nếu phrase seeded đã used → walk forward
     * tìm phrase chưa used.
     */
    chonKhongTrungLap(pool, seed) {
        if (!pool || pool.length === 0) return null;

        if (seed) {
            // Seeded mode: bắt đầu từ seeded index, walk forward tìm phrase chưa used
            const startIdx = this._seededIndex(seed, pool.length);
            for (let offset = 0; offset < pool.length; offset++) {
                const idx = (startIdx + offset) % pool.length;
                const phrase = pool[idx];
                if (!this.usedPhrases.has(phrase)) {
                    this.usedPhrases.add(phrase);
                    return phrase;
                }
            }
            // Mọi phrase đã used → reset, lấy đúng seeded index
            this.usedPhrases.clear();
            const phrase = pool[startIdx];
            this.usedPhrases.add(phrase);
            return phrase;
        }

        // Random mode (legacy)
        const available = pool.filter(p => !this.usedPhrases.has(p));
        if (available.length === 0) {
            this.usedPhrases.clear();
            return this.chonNgauNhien(pool);
        }
        const phrase = this.chonNgauNhien(available);
        this.usedPhrases.add(phrase);
        return phrase;
    }

    resetUsedPhrases() {
        this.usedPhrases.clear();
    }

    /**
     * V2.2: detect trend từ lịch sử điểm 4 kỳ.
     * Input: { ghk1, chk1, ghk2, chk2 } — có thể missing key nào cũng được.
     * Output: 'tien_bo' | 'on_dinh_tot' | 'on_dinh_dat' | 'giam_sut' | 'chua_on_dinh' | 'can_ho_tro' | 'default'
     *
     * Quy tắc:
     *   - Nếu kỳ hiện tại < 5 → can_ho_tro
     *   - ≥2 kỳ và tăng đơn điệu ≥1.5đ → tien_bo
     *   - ≥2 kỳ và giảm đơn điệu ≥1đ → giam_sut
     *   - Tất cả ≥8 → on_dinh_tot
     *   - Tất cả ≥5 và <8 → on_dinh_dat
     *   - Biến động ≥2đ giữa các kỳ → chua_on_dinh
     *   - Còn lại → default
     */
    detectTrend(history, currentDiem) {
        const cur = parseFloat(currentDiem);
        if (!isNaN(cur) && cur < 5) return 'can_ho_tro';

        const seq = ['ghk1', 'chk1', 'ghk2', 'chk2']
            .map(k => history && history[k])
            .filter(v => v !== null && v !== undefined && !isNaN(parseFloat(v)))
            .map(v => parseFloat(v));

        // 0 hoặc 1 kỳ trong history → không đủ để xác trend, suy từ điểm hiện tại.
        if (seq.length < 2) {
            if (!isNaN(cur) && cur >= 8) return 'on_dinh_tot';
            if (!isNaN(cur) && cur >= 5) return 'on_dinh_dat';
            return 'default';
        }

        // Tăng đơn điệu ≥1.5đ giữa đầu và cuối
        const first = seq[0];
        const last = seq[seq.length - 1];
        const allInc = seq.every((v, i) => i === 0 || v >= seq[i - 1] - 0.1);
        const allDec = seq.every((v, i) => i === 0 || v <= seq[i - 1] + 0.1);

        if (allInc && (last - first) >= 1.5) return 'tien_bo';
        if (allDec && (first - last) >= 1) return 'giam_sut';

        const maxDelta = Math.max(...seq) - Math.min(...seq);
        if (maxDelta >= 2 && !allInc && !allDec) return 'chua_on_dinh';

        const minScore = Math.min(...seq);
        const maxScore = Math.max(...seq);
        if (minScore >= 8) return 'on_dinh_tot';
        if (minScore >= 5 && maxScore < 8) return 'on_dinh_dat';
        return 'default';
    }

    /**
     * V2.2: Pool lookup chain.
     * Priority:
     *   1. subject.grades[grade][ky][tier][trend]
     *   2. subject.grades[grade][ky][tier].default
     *   3. subject.grades[grade][ky][tier] (array trực tiếp — chấp nhận structure cũ)
     *   4. subject[ky][tier]   (ky-data)
     *   5. subject[tier]        (flat pool — backward compat)
     */
    /**
     * V2.3.9: Pool lookup chain mới — phù hợp ngân hàng THDienLien (chung mọi lớp/kỳ).
     * Priority:
     *   1. subject.grades[grade][ky][tier][trend]
     *   2. subject.grades[grade][ky][tier].default
     *   3. subject.grades['all']['all_ky'][tier].default  ← THDienLien style (V2.3.9)
     *   4. subject.grades['all']['all_ky'][tier][trend]
     *   5. subject[ky][tier]  (ky-data)
     *   6. subject[tier]       (flat pool)
     */
    _resolvePool(subject, ky, tier, grade, trend, subjectCode) {
        if (!subject) return [];

        // 1-2. Grade-specific theo lớp (nếu có data riêng cho lớp đó)
        if (grade && subject.grades && subject.grades[grade]) {
            const gNode = subject.grades[grade];
            const kyKey = ky || 'chk2';
            if (gNode[kyKey] && gNode[kyKey][tier]) {
                const tierNode = gNode[kyKey][tier];
                if (Array.isArray(tierNode)) return tierNode;
                if (trend && Array.isArray(tierNode[trend]) && tierNode[trend].length > 0) {
                    return tierNode[trend];
                }
                if (Array.isArray(tierNode.default) && tierNode.default.length > 0) {
                    return tierNode.default;
                }
            }
        }

        // 3-4. V2.3.9: 'all' / 'all_ky' (THDienLien style — chung mọi lớp/kỳ)
        if (subject.grades && subject.grades['all'] && subject.grades['all']['all_ky']) {
            const allNode = subject.grades['all']['all_ky'];
            if (allNode[tier]) {
                const tierNode = allNode[tier];
                if (Array.isArray(tierNode)) return tierNode;
                if (trend && Array.isArray(tierNode[trend]) && tierNode[trend].length > 0) {
                    return tierNode[trend];
                }
                if (Array.isArray(tierNode.default) && tierNode.default.length > 0) {
                    return tierNode.default;
                }
            }
        }

        // 5-6. Fallback ky-data → flat (cho data cũ legacy)
        const isChk2 = !ky || ky === 'chk2';
        if (!isChk2 && subject[ky] && subject[ky][tier]) {
            return subject[ky][tier];
        }
        if (!isChk2 && subject[ky] && subject[ky].ht) {
            return subject[ky].ht;
        }
        return subject[tier] || subject.ht || [];
    }

    /**
     * V2.3.8: Kiểm chất lượng 1 phrase trong context cụ thể.
     * Trả { ok: true } hoặc { ok: false, reason }.
     *
     * Khác V2.3.7:
     *   - Toán/TV BẮT BUỘC có SUBJECT_SIGNAL (không chỉ khi có VAGUE)
     *   - Tier ht/cht BẮT BUỘC có REMEDIATION_PHRASE
     *   - Word-boundary cho "cô"/"thầy" (không match "công nghệ")
     *   - !ctx.hasHistory → reject "tiến bộ rõ rệt" / "giảm sút" / "chưa ổn định"
     */
    /**
     * V2.3.9: Validate đơn giản theo phong cách THDienLien:
     * - Bắt đầu "Em" hoặc "Biết" / "Hoàn thành" / "Thuộc" (động từ kĩ năng — câu mẫu có)
     * - Cấm cụm tiêu cực rõ ràng (học yếu/lười/dốt/...)
     * - Cấm "bài cô giao" cụ thể
     * - Wrong-ky guard giữ nguyên
     * - Tier word restriction (không "xuất sắc" cho tier <T+)
     * - Grade forbidden (không "bảng chữ cái" cho lớp ≥4)
     * - Độ dài 7-35 từ (cho phép câu ngắn)
     * KHÔNG còn: subject signal bắt buộc, behavior ban, remediation bắt buộc, teacher pronoun
     */
    /**
     * V4.0: Validate phong cách THDienLien + áp dụng quy tắc context-aware.
     * ctx.context: 'subject' (default) | 'nlpc' — quyết định soft-ban dùng phiên bản nào.
     */
    validateComment(comment, ctx = {}) {
        if (!comment || typeof comment !== 'string') {
            return { ok: false, reason: 'empty' };
        }
        const trimmed = comment.trim();
        const lower = trimmed.toLowerCase();
        const isNlpc = ctx.context === 'nlpc';

        // Câu phải bắt đầu bằng "Em" hoặc động từ phổ biến của GV
        if (!/^(em|biết|hoàn thành|thuộc|thành thạo|đạt)\b/i.test(trimmed)) {
            return { ok: false, reason: 'bad_start' };
        }

        // Hard ban (mọi context)
        for (const w of HARD_BAN_WORDS) {
            if (lower.includes(w)) return { ok: false, reason: `hard_ban:${w}` };
        }

        // V4.0: Soft ban context-aware — subject chặt hơn NL/PC
        const banList = isNlpc ? SOFT_BAN_PHRASES_NLPC : SOFT_BAN_PHRASES_SUBJECT;
        for (const p of banList) {
            if (lower.includes(p)) return { ok: false, reason: `soft_ban:${p}` };
        }

        // V4.0: Wrong-ky guard
        const ky = ctx.kyCode || ctx.ky;
        if (ky && WRONG_KY_PHRASES[ky]) {
            for (const w of WRONG_KY_PHRASES[ky]) {
                if (lower.includes(w)) return { ok: false, reason: `wrong_ky:${ky}:${w}` };
            }
        }

        // Tier word restriction
        if (ctx.tier && TIER_RESTRICTED_WORDS[ctx.tier]) {
            for (const w of TIER_RESTRICTED_WORDS[ctx.tier]) {
                if (lower.includes(w)) return { ok: false, reason: `tier_word:${w}` };
            }
        }

        // Grade forbidden content
        if (ctx.gradeLevel && GRADE_FORBIDDEN_CONTENT[ctx.gradeLevel]) {
            for (const w of GRADE_FORBIDDEN_CONTENT[ctx.gradeLevel]) {
                if (lower.includes(w)) return { ok: false, reason: `grade_forbidden:${w}` };
            }
        }

        // V4.0: Tier ht/cht BẮT BUỘC có cụm rèn luyện
        if (ctx.tier === 'ht' || ctx.tier === 'cht') {
            const hasReme = REMEDIATION_PHRASES.some(r => lower.includes(r));
            if (!hasReme) return { ok: false, reason: 'no_remediation' };
        }

        // Độ dài 7-35 từ
        const wordCount = trimmed.split(/\s+/).length;
        if (wordCount < 7) return { ok: false, reason: 'too_short' };
        if (wordCount > 40) return { ok: false, reason: 'too_long' };

        return { ok: true };
    }

    /**
     * V2.3: Template-focus fallback layer — port từ V3.0 ChatGPT.
     * Khi pool grade-data cạn nhưng còn TEMPLATE_FALLBACK + FOCUS_BY_GRADE → fill template.
     * Trả null nếu không có data tương ứng (để layer ngoài fallback xuống _safeFallback).
     */
    _tryTemplateFocus(subjectCode, tier, gradeLevel, trend, seed) {
        const focusBranch = FOCUS_BY_GRADE[subjectCode];
        if (!focusBranch) return null;
        const focusPool = focusBranch[gradeLevel] || focusBranch[5] || Object.values(focusBranch)[0];
        if (!focusPool || focusPool.length === 0) return null;

        const tmplBranch = TEMPLATE_FALLBACK[tier];
        if (!tmplBranch) return null;
        // Ưu tiên trend-specific template, fallback default
        let tmplPool = tmplBranch[trend] && tmplBranch[trend].length > 0
            ? tmplBranch[trend]
            : tmplBranch.default;
        if (!tmplPool || tmplPool.length === 0) return null;

        const focus = focusPool[this._seededIndex(seed, focusPool.length, 1)];
        const tmpl = tmplPool[this._seededIndex(seed, tmplPool.length, 2)];
        return tmpl.replace('{focus}', focus);
    }

    /**
     * V2.3.7: Safe fallback theo tier × subject — câu trung tính an toàn, KHÔNG có
     * "thầy cô và gia đình" / "tấm gương". Bám kỹ năng môn học cụ thể (Toán/TV).
     * Cho môn khác (TNXH/ĐĐ/...) dùng câu chung trung tính.
     */
    /**
     * V4.1: Safe fallback theo môn × tier — câu hoàn chỉnh đúng spec, đã có
     * định hướng rèn luyện cho ht/cht (đáp ứng validate no_remediation).
     * KHÔNG ghép suffix vì câu đã đầy đủ.
     */
    _safeFallback(subjectCode, tier, gradeLevel) {
        const TABLE = {
            toan: {
                tot_xs: 'Em nắm chắc kiến thức môn Toán, tính toán chính xác và trình bày bài giải rõ ràng.',
                tot:    'Em hoàn thành tốt yêu cầu môn Toán, biết vận dụng kiến thức vào bài tập quen thuộc.',
                ht:     'Em hoàn thành yêu cầu cơ bản môn Toán, cần rèn thêm kĩ năng phân tích đề và kiểm tra kết quả.',
                cht:    'Em cần được hỗ trợ thêm về kiến thức Toán cơ bản, luyện tính toán và trình bày bài giải từng bước.'
            },
            'tieng-viet': {
                tot_xs: 'Em đọc hiểu tốt văn bản, dùng từ phù hợp, viết bài có bố cục rõ và diễn đạt mạch lạc.',
                tot:    'Em hoàn thành tốt yêu cầu môn Tiếng Việt, đọc hiểu khá chắc và viết bài tương đối rõ.',
                ht:     'Em hoàn thành yêu cầu cơ bản môn Tiếng Việt, cần luyện thêm đọc hiểu, dùng từ và viết câu rõ ý.',
                cht:    'Em cần được hỗ trợ thêm về đọc hiểu, chính tả và viết câu; nên luyện đọc, viết đều đặn.'
            },
            tienganh: {
                tot_xs: 'Em nắm chắc từ vựng và mẫu câu Tiếng Anh, thực hiện tốt các yêu cầu nghe, nói, đọc, viết.',
                tot:    'Em hoàn thành tốt yêu cầu môn Tiếng Anh, nhận biết được từ vựng và sử dụng mẫu câu khá phù hợp.',
                ht:     'Em hoàn thành yêu cầu cơ bản môn Tiếng Anh, cần luyện thêm từ vựng và mẫu câu đã học.',
                cht:    'Em cần được hỗ trợ thêm về từ vựng, mẫu câu và kĩ năng nghe, nói, đọc, viết cơ bản.'
            },
            tnxh: {
                tot_xs: 'Em nắm chắc kiến thức môn Tự nhiên và Xã hội, biết quan sát và vận dụng vào tình huống thực tế.',
                tot:    'Em hoàn thành tốt yêu cầu môn Tự nhiên và Xã hội, biết quan sát và nêu được nội dung chính của bài học.',
                ht:     'Em hoàn thành yêu cầu cơ bản môn Tự nhiên và Xã hội, cần luyện thêm quan sát và trả lời câu hỏi rõ ý.',
                cht:    'Em cần được hỗ trợ thêm trong nhận biết sự vật, hiện tượng và nội dung gần gũi trong cuộc sống.'
            },
            khoahoc: {
                tot_xs: 'Em nắm chắc kiến thức môn Khoa học, biết giải thích hiện tượng đơn giản và vận dụng vào thực tế.',
                tot:    'Em hoàn thành tốt yêu cầu môn Khoa học, biết quan sát, nhận xét và vận dụng kiến thức vào bài tập quen thuộc.',
                ht:     'Em hoàn thành yêu cầu cơ bản môn Khoa học, cần luyện thêm quan sát và giải thích hiện tượng đơn giản.',
                cht:    'Em cần được hỗ trợ thêm trong ghi nhớ kiến thức khoa học và giải thích các hiện tượng đơn giản.'
            },
            lichsudia: {
                tot_xs: 'Em nắm chắc kiến thức Lịch sử và Địa lí, trình bày rõ sự kiện, nhân vật, địa danh và nội dung bài học.',
                tot:    'Em hoàn thành tốt yêu cầu môn Lịch sử và Địa lí, nắm được nội dung chính của bài học.',
                ht:     'Em hoàn thành yêu cầu cơ bản môn Lịch sử và Địa lí, cần luyện thêm ghi nhớ sự kiện và địa danh.',
                cht:    'Em cần được hỗ trợ thêm trong ghi nhớ sự kiện, nhân vật, địa danh và nội dung bài học cơ bản.'
            },
            daoduc: {
                tot_xs: 'Em nắm chắc nội dung môn Đạo đức, biết phân tích hành vi và lựa chọn cách ứng xử phù hợp.',
                tot:    'Em hoàn thành tốt yêu cầu môn Đạo đức, biết nhận xét hành vi và nêu cách ứng xử phù hợp.',
                ht:     'Em hoàn thành yêu cầu cơ bản môn Đạo đức, cần luyện thêm cách nhận xét hành vi và xử lí tình huống.',
                cht:    'Em cần được hỗ trợ thêm trong nhận biết hành vi đúng, chưa đúng và cách ứng xử phù hợp.'
            },
            tinhoc: {
                tot_xs: 'Em nắm chắc kiến thức môn Tin học, thao tác máy tính chính xác và hoàn thành tốt sản phẩm học tập.',
                tot:    'Em hoàn thành tốt yêu cầu môn Tin học, thực hiện được các thao tác cơ bản và sử dụng phần mềm phù hợp.',
                ht:     'Em hoàn thành yêu cầu cơ bản môn Tin học, cần luyện thêm thao tác máy tính và thực hành theo quy trình.',
                cht:    'Em cần được hỗ trợ thêm về thao tác máy tính, sử dụng phần mềm và thực hiện nhiệm vụ học tập cơ bản.'
            },
            congnghe: {
                tot_xs: 'Em nắm chắc kiến thức môn Công nghệ, thực hiện tốt quy trình và hoàn thành sản phẩm rõ yêu cầu.',
                tot:    'Em hoàn thành tốt yêu cầu môn Công nghệ, biết thực hiện nhiệm vụ theo quy trình và đảm bảo an toàn.',
                ht:     'Em hoàn thành yêu cầu cơ bản môn Công nghệ, cần rèn thêm thao tác thực hành và thực hiện đúng quy trình.',
                cht:    'Em cần được hỗ trợ thêm trong nhận biết sản phẩm công nghệ, quy trình thực hiện và thao tác an toàn.'
            },
            gdtc: {
                tot_xs: 'Em hoàn thành rất tốt yêu cầu môn Giáo dục thể chất, thực hiện động tác chính xác và phối hợp vận động tốt.',
                tot:    'Em hoàn thành tốt yêu cầu môn Giáo dục thể chất, thực hiện được động tác và phối hợp vận động khá tốt.',
                ht:     'Em hoàn thành yêu cầu cơ bản môn Giáo dục thể chất, cần luyện thêm động tác và phối hợp vận động.',
                cht:    'Em cần được hỗ trợ thêm trong thực hiện động tác, phối hợp vận động và luyện tập theo yêu cầu.'
            },
            amnhac: {
                tot_xs: 'Em hoàn thành rất tốt yêu cầu môn Âm nhạc, hát đúng giai điệu, rõ lời và giữ nhịp tốt.',
                tot:    'Em hoàn thành tốt yêu cầu môn Âm nhạc, hát tương đối đúng giai điệu và biết giữ nhịp cơ bản.',
                ht:     'Em hoàn thành yêu cầu cơ bản môn Âm nhạc, cần luyện thêm hát đúng lời, đúng nhịp và giai điệu.',
                cht:    'Em cần được hỗ trợ thêm trong hát đúng giai điệu, giữ nhịp và nhận biết nội dung âm nhạc cơ bản.'
            },
            mithuat: {
                tot_xs: 'Em hoàn thành rất tốt yêu cầu môn Mĩ thuật, sử dụng đường nét, màu sắc và bố cục hài hòa.',
                tot:    'Em hoàn thành tốt yêu cầu môn Mĩ thuật, biết sử dụng đường nét, màu sắc và bố cục tương đối phù hợp.',
                ht:     'Em hoàn thành yêu cầu cơ bản môn Mĩ thuật, cần rèn thêm cách sắp xếp bố cục và phối hợp màu sắc.',
                cht:    'Em cần được hỗ trợ thêm trong sử dụng đường nét, màu sắc, bố cục và hoàn thành sản phẩm tạo hình.'
            },
            htn: {
                tot_xs: 'Em hoàn thành rất tốt yêu cầu Hoạt động trải nghiệm, biết hợp tác, chia sẻ và thực hiện nhiệm vụ hiệu quả.',
                tot:    'Em hoàn thành tốt yêu cầu Hoạt động trải nghiệm, biết tham gia hoạt động và thực hiện nhiệm vụ được giao.',
                ht:     'Em hoàn thành yêu cầu cơ bản của Hoạt động trải nghiệm, cần rèn thêm kĩ năng hợp tác và thực hiện nhiệm vụ.',
                cht:    'Em cần được hỗ trợ thêm trong tham gia hoạt động, thực hiện nhiệm vụ và chia sẻ ý kiến theo gợi ý.'
            }
        };

        const row = TABLE[subjectCode];
        if (row && row[tier]) return row[tier];

        // Môn lạ chưa có trong TABLE → câu trung tính theo tên môn
        const subjName = (this.data && this.data.subjects[subjectCode] && this.data.subjects[subjectCode].name) || 'môn học';
        return {
            tot_xs: `Em hoàn thành rất tốt yêu cầu môn ${subjName}, thực hiện tốt các nội dung đã học.`,
            tot:    `Em hoàn thành tốt yêu cầu môn ${subjName}, thực hiện được các nội dung đã học phù hợp.`,
            ht:     `Em hoàn thành yêu cầu cơ bản môn ${subjName}, cần luyện thêm các nội dung bài học.`,
            cht:    `Em cần được hỗ trợ thêm về môn ${subjName}, luyện các nội dung cơ bản theo gợi ý từng bước.`
        }[tier] || `Em hoàn thành yêu cầu cơ bản môn ${subjName}, cần luyện thêm các nội dung đã học.`;
    }

    /**
     * V2.3.7: Sinh câu theo môn × lớp × tier × kỳ — fallback layer trên safe-fallback.
     * Dùng khi pool grade-data cạn nhưng cần ra câu bám đặc thù lớp + tier.
     * Câu trả ra ngắn gọn, không có vế suffix (suffix do _applyStyleSuffix thêm sau).
     */
    _tryGradeSubjectTemplate(subjectCode, tier, gradeLevel, ky, seed) {
        const focusBranch = FOCUS_BY_GRADE[subjectCode];
        if (!focusBranch) return null;
        const focusPool = focusBranch[gradeLevel] || focusBranch[5] || Object.values(focusBranch)[0];
        if (!focusPool || focusPool.length === 0) return null;

        const focus = focusPool[this._seededIndex(seed, focusPool.length, 11)];

        const templates = {
            toan: {
                tot_xs: `Em nắm chắc kiến thức ở ${focus}, làm bài chính xác và trình bày bài giải khoa học.`,
                tot: `Em hoàn thành tốt nội dung ${focus}, làm bài cẩn thận và biết vận dụng vào bài tập quen thuộc.`,
                ht: `Em đã thực hiện được nội dung ${focus} ở mức cơ bản, cần luyện thêm kĩ năng phân tích đề và kiểm tra kết quả.`,
                cht: `Em cần được hỗ trợ thêm về ${focus}, luyện tính toán và trình bày bài giải từng bước.`
            },
            'tieng-viet': {
                tot_xs: `Em vững kiến thức ở ${focus}, dùng từ phù hợp và diễn đạt rõ ý trong bài viết.`,
                tot: `Em hoàn thành tốt nội dung ${focus}, viết câu rõ ý và trình bày bài tương đối rõ ràng.`,
                ht: `Em đã thực hiện được nội dung ${focus} ở mức cơ bản, cần luyện thêm dùng từ và viết câu rõ ý.`,
                cht: `Em cần được hỗ trợ thêm về ${focus}, luyện đọc và viết câu từng bước đều đặn.`
            }
        };
        return (templates[subjectCode] && templates[subjectCode][tier]) || null;
    }

    /**
     * V2.3.8: Apply style suffix vào cuối phrase.
     * - Nếu !ky → coi là 'default' (KHÔNG coi là chk2 như V2.3.7)
     * - Nếu style='cuoinam' nhưng ky != chk2 → downgrade theo ky (giuaky/cuoihk1/default)
     */
    _applyStyleSuffix(phrase, tier, style, ky) {
        if (!phrase || !style) return phrase;
        let effectiveStyle = style;
        if (style === 'cuoinam' && ky && ky !== 'chk2') {
            if (ky === 'ghk1' || ky === 'ghk2') effectiveStyle = 'giuaky';
            else if (ky === 'chk1') effectiveStyle = 'cuoihk1';
            else effectiveStyle = 'default';
        }
        if (style === 'cuoinam' && !ky) {
            effectiveStyle = 'default';  // !ky không coi là chk2
        }
        const branch = STYLE_SUFFIX[effectiveStyle] || STYLE_SUFFIX.default;
        const suffix = branch[tier] || '';
        if (!suffix) return phrase;
        return phrase.replace(/[.\s]+$/, '') + '.' + suffix;
    }

    /**
     * V2.3.8: Resolve style theo ky chính thức. Caller phải dùng helper này hoặc
     * tự suy. Engine còn check thêm trong _applyStyleSuffix.
     */
    resolveStyleByKy(ky, selectedStyle) {
        if (!selectedStyle || selectedStyle === 'auto') {
            if (ky === 'ghk1' || ky === 'ghk2') return 'giuaky';
            if (ky === 'chk1') return 'cuoihk1';
            if (ky === 'chk2') return 'cuoinam';
            return 'default';
        }
        if (selectedStyle === 'cuoinam' && ky && ky !== 'chk2') {
            if (ky === 'ghk1' || ky === 'ghk2') return 'giuaky';
            if (ky === 'chk1') return 'cuoihk1';
            return 'default';
        }
        return selectedStyle;
    }

    sinhNhanXet(hs, subjectCode, ky, ctx = {}) {
        if (!this.data || !this.data.subjects) {
            return 'Em chăm chỉ học tập và có nhiều tiến bộ trong học kì này.';
        }

        const subject = this.data.subjects[subjectCode];
        if (!subject) {
            return 'Em chăm chỉ học tập và có nhiều tiến bộ trong học kì này.';
        }

        // V2.3.1: ưu tiên DIEM nếu có (chi tiết tot_xs/tot/ht/cht), fallback mucDat khi
        // không có điểm. Lý do: Vnedu chỉ có 3 mức T/H/C — nếu trust mucDat, 10đ và 7đ
        // đều ra "T" → pick cùng tier `tot`, mất phân biệt nổi trội cho HS điểm 9-10.
        const mucDo = this._resolveTier(hs);

        // V2.2: detect trend & grade context
        const gradeLevel = ctx.gradeLevel || hs.gradeLevel || null;
        const history = hs.diemHistory || ctx.diemHistory || null;
        const trend = ctx.trend || (history ? this.detectTrend(history, hs.diem) : 'default');

        // V2.3: seed deterministic theo HS → cùng HS regenerate ra cùng phrase
        const seed = `${hs.hoVaTen || hs.stt || ''}|${subjectCode}|${gradeLevel || 0}|${mucDo}|${ky || 'chk2'}`;

        // V2.3.7: style — chấp nhận giuaky/cuoihk1/cuoinam/dinhhuong/ngan/default từ caller.
        // Nếu caller không truyền, tự suy theo ky: ghk* → giuaky, chk1 → cuoihk1, chk2 → cuoinam
        const autoStyle = (() => {
            if (ky === 'ghk1' || ky === 'ghk2') return 'giuaky';
            if (ky === 'chk1') return 'cuoihk1';
            if (!ky || ky === 'chk2') return 'cuoinam';
            return 'default';
        })();
        const style = ctx.style || this.options.style || autoStyle;

        const pool = this._resolvePool(subject, ky, mucDo, gradeLevel, trend, subjectCode);

        // V2.3.7: validate ctx — kèm kyCode để check sai kỳ
        const validateCtx = {
            tier: mucDo, gradeLevel, subjectCode, ky,
            kyCode: ky,
            hasObservation: !!ctx.hasObservation
        };

        // V2.3.7: candidate-and-validate flow — pick candidate → apply suffix → validate
        // câu CUỐI cùng. Nếu fail → pick candidate khác (tối đa 10 lần).
        let phrase = null;
        const tryValidate = (raw) => {
            if (!raw) return null;
            const withSuffix = this._applyStyleSuffix(raw, mucDo, style, ky);
            const v = this.validateComment(withSuffix, validateCtx);
            return v.ok ? withSuffix : null;
        };

        for (let attempt = 0; attempt < 10; attempt++) {
            const candidate = this.chonKhongTrungLap(pool, seed ? seed + '|' + attempt : null);
            if (!candidate) break;
            const result = tryValidate(candidate);
            if (result) { phrase = result; break; }
        }

        // Pool grade-data cạn / fail toàn bộ → thử _tryGradeSubjectTemplate
        if (!phrase) {
            const tmpl = this._tryGradeSubjectTemplate(subjectCode, mucDo, gradeLevel, ky, seed);
            const result = tryValidate(tmpl);
            if (result) phrase = result;
        }

        // Tiếp theo: TEMPLATE_FALLBACK với {focus}
        if (!phrase) {
            const tmpl = this._tryTemplateFocus(subjectCode, mucDo, gradeLevel, trend, seed);
            const result = tryValidate(tmpl);
            if (result) phrase = result;
        }

        // Cuối cùng: safe fallback hardcode (đã có sẵn cho 4 tier × Toán/TV/khác)
        if (!phrase) {
            const safe = this._safeFallback(subjectCode, mucDo, gradeLevel);
            // Safe fallback luôn validate được (đã design an toàn) → apply suffix
            phrase = this._applyStyleSuffix(safe, mucDo, style, ky);
        }

        // V4.0: Apply persona + sanitize lần cuối (bắt edge case persona swap "cô↔thầy"
        // làm câu vi phạm soft ban). Nếu fail sau persona → quay lại safe fallback.
        const afterPersona = this.applyGvPersona(phrase);
        const finalCheck = this.validateComment(afterPersona, validateCtx);
        let finalText = afterPersona;
        if (!finalCheck.ok) {
            // Persona làm hỏng câu → dùng safe fallback (không qua persona)
            const safe = this._safeFallback(subjectCode, mucDo, gradeLevel);
            finalText = this._applyStyleSuffix(safe, mucDo, style, ky);
        }
        // V6.1: Áp văn phong cuối cùng — mặc định 'hocba' (TT27). Pool gốc giữ "Em..."
        // để chế độ 'thanthien' vẫn dùng nguyên si.
        if (this.options.vanPhong === 'hocba') {
            finalText = this._toHocBaStyle(finalText);
        }
        return finalText;
    }

    applyGvPersona(text) {
        if (!text) return text;
        if (this.options.gvLa !== 'thay') return text;

        const tokens = text.split(/(\s+|[.,!?;:\-\(\)])/);
        const result = [];

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (token === 'cô' || token === 'Cô') {
                let prevIdx = i - 1;
                while (prevIdx >= 0 && /^\s+$/.test(tokens[prevIdx])) prevIdx--;
                const prevToken = prevIdx >= 0 ? tokens[prevIdx] : null;

                if (prevToken === 'thầy' || prevToken === 'Thầy') {
                    result.push(token);
                } else {
                    result.push(token === 'cô' ? 'thầy' : 'Thầy');
                }
            } else {
                result.push(token);
            }
        }

        return result.join('');
    }

    sinhCaLop(danhSachHS, subjectCode, ky, ctx = {}) {
        this.resetUsedPhrases();

        return danhSachHS.map(hs => {
            const nhanXet = this.sinhNhanXet(hs, subjectCode, ky, ctx);
            // V2.3.1: dùng cùng logic _resolveTier như sinhNhanXet (ưu tiên điểm hơn mucDat)
            const mucDo = this._resolveTier(hs);

            return {
                stt: hs.stt,
                hoVaTen: hs.hoVaTen,
                diem: hs.diem,
                mucDat: hs.mucDat,
                mucDo: mucDo,
                xepLoai: this.xepLoaiText(mucDo),
                badge: this.xepLoaiBadge(mucDo),
                nhanXet: nhanXet
            };
        });
    }

    sinhNLPCDayDu(hsContext, danhGia) {
        if (!this.data || !this.data.nlpc) {
            throw new Error('Chưa có dữ liệu NLPC');
        }

        const result = {
            nang_luc_chung: {},
            nang_luc_dac_thu: {},
            pham_chat: {}
        };

        const tongHopMuc = (dgObj) => {
            const c = { tot: 0, ht: 0, cht: 0 };
            Object.values(dgObj).forEach(m => { if (c[m] !== undefined) c[m]++; });
            if (c.cht > 0) return 'cht';
            if (c.ht >= c.tot) return 'ht';
            return 'tot';
        };

        const pickFrom = (branch, mucDo) => {
            const pool = branch[mucDo] || branch.ht || [];
            const phrase = this.chonKhongTrungLap(pool) || '';
            const enriched = this._enrichNLPCPhrase(phrase, mucDo);
            // V6.1: NLPC cũng áp văn phong học bạ (TT27 — không xưng "Em")
            if (this.options.vanPhong === 'hocba') {
                return this._toHocBaStyle(enriched);
            }
            return enriched;
        };

        const nlpc = this.data.nlpc;

        const mucNLC = tongHopMuc(danhGia.nang_luc_chung || {});
        result.nang_luc_chung['Nhận xét chung'] = pickFrom(nlpc.nang_luc_chung.nhan_xet_chung, mucNLC);
        for (const key of ['tu_chu_tu_hoc', 'giao_tiep_hop_tac', 'giai_quyet_van_de']) {
            const mucDo = (danhGia.nang_luc_chung || {})[key] || 'ht';
            result.nang_luc_chung[this._getNLCLabel(key)] = pickFrom(nlpc.nang_luc_chung[key], mucDo);
        }

        const mucNLDT = tongHopMuc(danhGia.nang_luc_dac_thu || {});
        result.nang_luc_dac_thu['Nhận xét chung'] = pickFrom(nlpc.nang_luc_dac_thu.nhan_xet_chung, mucNLDT);
        // V1.5: Năng lực Khoa học chỉ áp dụng lớp 4-5 (CT GDPT 2018 — môn Khoa học bắt đầu từ
        // lớp 4; lớp 1-3 chỉ học TNXH). Lớp 3-5 thêm Công nghệ + Tin học (TT27 quy định).
        // Khi KHÔNG detect được gradeLevel → MẶC ĐỊNH thêm đủ (an toàn cho lớp 4-5).
        const nldtKeys = ['ngon_ngu', 'tinh_toan', 'tham_mi', 'the_chat'];
        const gradeLevel = hsContext?.gradeLevel;
        if (gradeLevel == null || gradeLevel >= 4) {
            nldtKeys.splice(2, 0, 'khoa_hoc');
        }
        if (gradeLevel == null || gradeLevel >= 3) {
            nldtKeys.push('cong_nghe', 'tin_hoc');
        }
        for (const key of nldtKeys) {
            const mucDo = (danhGia.nang_luc_dac_thu || {})[key] || 'ht';
            result.nang_luc_dac_thu[this._getNLDTLabel(key)] = pickFrom(nlpc.nang_luc_dac_thu[key], mucDo);
        }

        const mucPC = tongHopMuc(danhGia.pham_chat || {});
        result.pham_chat['Nhận xét chung'] = pickFrom(nlpc.pham_chat.nhan_xet_chung, mucPC);
        for (const key of ['yeu_nuoc', 'nhan_ai', 'cham_chi', 'trung_thuc', 'trach_nhiem']) {
            const mucDo = (danhGia.pham_chat || {})[key] || 'ht';
            result.pham_chat[this._getPCLabel(key)] = pickFrom(nlpc.pham_chat[key], mucDo);
        }

        return result;
    }

    _getNLCLabel(key) {
        return {
            tu_chu_tu_hoc: 'Tự chủ và tự học',
            giao_tiep_hop_tac: 'Giao tiếp và hợp tác',
            giai_quyet_van_de: 'Giải quyết vấn đề và sáng tạo'
        }[key] || key;
    }

    _getNLDTLabel(key) {
        return {
            ngon_ngu: 'Năng lực ngôn ngữ',
            tinh_toan: 'Năng lực tính toán',
            khoa_hoc: 'Năng lực khoa học',
            tham_mi: 'Năng lực thẩm mĩ',
            the_chat: 'Năng lực thể chất',
            cong_nghe: 'Năng lực công nghệ',
            tin_hoc: 'Năng lực tin học'
        }[key] || key;
    }

    _getPCLabel(key) {
        return {
            yeu_nuoc: 'Yêu nước',
            nhan_ai: 'Nhân ái',
            cham_chi: 'Chăm chỉ',
            trung_thuc: 'Trung thực',
            trach_nhiem: 'Trách nhiệm'
        }[key] || key;
    }

    /**
     * v0.1.11 — Enrich NLPC phrase: nếu câu < minLen ký tự thì append 1 vế bổ sung
     * cho đủ ý + dài đúng yêu cầu Vnedu (≥65 ký tự).
     *
     * Vế bổ sung pick từ NhanXetEngineV2.NLPC_ENRICH_BANK theo tier (tot/ht/cht).
     * Cách insert: bỏ dấu chấm cuối, append " " + enrich + ".".
     */
    _enrichNLPCPhrase(phrase, tier, minLen = 65) {
        if (!phrase || phrase.length >= minLen) return phrase;
        const bank = NhanXetEngineV2.NLPC_ENRICH_BANK;
        const pool = bank[tier] || bank.ht;
        const enrich = this.chonNgauNhien(pool);
        if (!enrich) return phrase;
        return phrase.replace(/[\.\s]+$/, '') + ' ' + enrich + '.';
    }
}

// Pool vế bổ sung để enrich câu NLPC < 65 ký tự lên ~75-95 ký tự.
// Mỗi vế ~10-25 ký tự, đa dạng để câu không bị lặp khi enrich nhiều HS.
NhanXetEngineV2.NLPC_ENRICH_BANK = Object.freeze({
    tot: [
        'rất tốt',
        'một cách chủ động',
        'thường xuyên trong lớp',
        'có hiệu quả cao',
        'đáng được tuyên dương',
        'trong mọi hoạt động chung',
        'rất xứng đáng được khen',
        'qua từng tuần học'
    ],
    ht: [
        'hằng ngày',
        'qua từng tuần học',
        'theo hướng dẫn của thầy cô',
        'trong các hoạt động chung của lớp',
        'dần dần qua thời gian',
        'từng bước một',
        'theo yêu cầu của bài học',
        'cùng các bạn trong lớp'
    ],
    cht: [
        'với sự hỗ trợ của thầy cô',
        'từng chút một',
        'mỗi ngày một ít',
        'theo hướng dẫn cụ thể',
        'cùng các bạn trong nhóm',
        'qua sự nhắc nhở của thầy cô'
    ]
});

/* ========================================================================
 * CacheManager v0.1.5 — Quản lý cache điểm môn vào chrome.storage.local
 *
 * Mục đích:
 *   - Tích lũy SILENT điểm các môn (TV, Toán, TNXH, KH, LSĐL, ÂN, MT, ...)
 *   - Mỗi lần GV mở Sổ NX 1 môn → tự lưu vào cache
 *   - Khi mở Form NLPC → đọc cache để auto-suggest 6 trường NL/PC
 *
 * Cấu trúc lưu chrome.storage.local:
 *   classCache: {
 *     "5A": {
 *       lastUpdated: ISO timestamp,
 *       students: {
 *         "Ngô Thị Bảo An": {
 *           id: "SV001",
 *           diem: { "tieng-viet": 9, "toan": 10, ... "diem-tb": 8.3 },
 *           lastSynced: ISO timestamp
 *         }
 *       }
 *     }
 *   }
 *
 * Performance target: cache lookup < 100ms (chrome.storage.local ~10-50ms).
 * ====================================================================== */

const CACHE_ROOT_KEY = 'classCache';

// Danh sách subject key chuẩn — KHÔNG được thêm key lạ ngoài danh sách này
// để giữ schema ổn định cho NLPCMapper (Phase 3)
const VALID_SUBJECTS = Object.freeze([
    'tieng-viet',
    'toan',
    'tnxh',
    'khoa-hoc',
    'lich-su-dia',
    'dao-duc',
    'tin-hoc',
    'cong-nghe',
    'tieng-anh',
    'gd-the-chap',
    'am-nhac',
    'mi-thuat',
    'htn',
    'diem-tb'
]);

// Map tên môn từ Vnedu (tự do, có dấu) → subject key chuẩn
// Khi Vnedu hiển thị "Tiếng Việt" → normalize thành "tieng-viet"
const SUBJECT_NAME_MAP = Object.freeze({
    'tieng viet': 'tieng-viet',
    'tv': 'tieng-viet',
    'toan': 'toan',
    'tu nhien va xa hoi': 'tnxh',
    'tu nhien xa hoi': 'tnxh',
    'tnxh': 'tnxh',
    'tn xh': 'tnxh',          // BUG-003 fix: "TN-XH" → normalize "tn xh"
    'tn': 'tnxh',             // BUG-003 fix: fallback nếu vẫn bị cắt thành "TN"
    'khoa hoc': 'khoa-hoc',
    'kh': 'khoa-hoc',
    'lich su va dia li': 'lich-su-dia',
    'lich su dia li': 'lich-su-dia',
    'lich su va dia ly': 'lich-su-dia',
    'lsdl': 'lich-su-dia',
    'dao duc': 'dao-duc',
    'dd': 'dao-duc',
    'tin hoc': 'tin-hoc',
    'tin hoc va cong nghe': 'tin-hoc',
    'cong nghe': 'cong-nghe',
    'tieng anh': 'tieng-anh',
    'ta': 'tieng-anh',
    'giao duc the chat': 'gd-the-chap',
    'the duc': 'gd-the-chap',
    'gdtc': 'gd-the-chap',
    'am nhac': 'am-nhac',
    'an': 'am-nhac',
    'mi thuat': 'mi-thuat',
    'my thuat': 'mi-thuat',
    'mt': 'mi-thuat',
    'hoat dong trai nghiem': 'htn',
    'htn': 'htn',
    'diem trung binh': 'diem-tb',
    'diem tb': 'diem-tb'
});

class CacheManager {
    /**
     * Chuẩn hóa tên môn từ Vnedu thành subject key.
     * Bỏ dấu, lowercase, trim, rồi tra SUBJECT_NAME_MAP.
     * Trả null nếu không tìm thấy (để caller log warning).
     */
    static normalizeSubject(subjectRaw) {
        if (!subjectRaw || typeof subjectRaw !== 'string') return null;

        // V1.7: phân biệt Tin học vs Công nghệ TRƯỚC khi strip parenthetical.
        // Vnedu thường hiện 2 cột con dưới "Tin học và Công nghệ":
        //   "Tin học và Công nghệ (Tin học)"  → 'tin-hoc'   (xử lý ở BUG-005 strip phía dưới)
        //   "Tin học và Công nghệ (Công nghệ)" → 'cong-nghe' (BẮT Ở ĐÂY)
        //   "Công nghệ" riêng                 → 'cong-nghe'
        const rawNoAccent = subjectRaw
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/đ/g, 'd');
        if (/\(\s*cong nghe\s*\)/.test(rawNoAccent)) return 'cong-nghe';
        if (rawNoAccent.includes('cong nghe') && !rawNoAccent.includes('tin hoc')) return 'cong-nghe';

        // BUG-005 fix: strip parenthetical suffix vd "Tin học và Công nghệ (Tin học)"
        // → "Tin học và Công nghệ" để match alias chuẩn
        let cleaned = subjectRaw.replace(/\s*\([^)]*\)\s*/g, ' ').trim();

        // Nếu đã là key chuẩn thì trả luôn
        const trimmed = cleaned.toLowerCase();
        if (VALID_SUBJECTS.includes(trimmed)) return trimmed;

        // Bỏ dấu tiếng Việt + ký tự đặc biệt
        const noAccent = trimmed
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/đ/g, 'd')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (SUBJECT_NAME_MAP[noAccent]) return SUBJECT_NAME_MAP[noAccent];

        // Fallback: substring match — ưu tiên alias dài nhất để tránh false-positive
        // (vd "tieng anh" includes "an" → tránh match nhầm "am-nhac")
        const sortedAliases = Object.keys(SUBJECT_NAME_MAP).sort((a, b) => b.length - a.length);
        for (const alias of sortedAliases) {
            if (alias.length >= 4 && noAccent.includes(alias)) {
                return SUBJECT_NAME_MAP[alias];
            }
        }
        return null;
    }

    /**
     * Validate điểm: phải là number 0-10 hoặc null (chưa có điểm).
     * Trả về điểm đã clean, hoặc throw nếu không hợp lệ.
     */
    static validateScore(score) {
        if (score === null || score === undefined || score === '') return null;

        const n = typeof score === 'number' ? score : parseFloat(String(score).replace(',', '.'));
        if (isNaN(n)) {
            throw new Error(`Điểm không hợp lệ: "${score}" — phải là số 0-10 hoặc null`);
        }
        if (n < 0 || n > 10) {
            throw new Error(`Điểm ngoài phạm vi: ${n} — phải nằm trong [0, 10]`);
        }
        return Math.round(n * 100) / 100;
    }

    /**
     * Validate className: non-empty, trim, max 20 ký tự.
     * Format chuẩn Vnedu: "5A", "1B", "4C"... nhưng có thể có biến thể.
     */
    static validateClassName(className) {
        if (!className || typeof className !== 'string') {
            throw new Error('className phải là chuỗi không rỗng');
        }
        const trimmed = className.trim();
        if (!trimmed) throw new Error('className rỗng sau khi trim');
        if (trimmed.length > 20) throw new Error(`className quá dài: "${trimmed}"`);
        return trimmed;
    }

    /**
     * Validate studentId: dùng tên HS làm key (vì Vnedu không expose stable id).
     * Tên phải có ít nhất 2 từ (họ + tên), tối đa 60 ký tự.
     */
    static validateStudentId(studentId) {
        if (!studentId || typeof studentId !== 'string') {
            throw new Error('studentId phải là chuỗi không rỗng');
        }
        const trimmed = studentId.replace(/\s+/g, ' ').trim();
        if (trimmed.length < 3 || trimmed.length > 60) {
            throw new Error(`studentId không hợp lệ: "${studentId}" — độ dài 3-60`);
        }
        return trimmed;
    }

    /**
     * Đọc toàn bộ classCache từ chrome.storage.local.
     * Trả {} nếu chưa có gì.
     */
    static async _readRoot() {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) {
            // Fallback memory cho Node test runner
            CacheManager._memFallback = CacheManager._memFallback || {};
            return CacheManager._memFallback;
        }
        return new Promise((resolve, reject) => {
            chrome.storage.local.get([CACHE_ROOT_KEY], (result) => {
                if (chrome.runtime.lastError) {
                    return reject(new Error(chrome.runtime.lastError.message));
                }
                resolve(result[CACHE_ROOT_KEY] || {});
            });
        });
    }

    static async _writeRoot(root) {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) {
            CacheManager._memFallback = root;
            return;
        }
        return new Promise((resolve, reject) => {
            chrome.storage.local.set({ [CACHE_ROOT_KEY]: root }, () => {
                if (chrome.runtime.lastError) {
                    return reject(new Error(chrome.runtime.lastError.message));
                }
                resolve();
            });
        });
    }

    /**
     * Khởi tạo cache cho 1 lớp (idempotent — không ghi đè dữ liệu cũ).
     * Dùng khi GV vừa mở Vnedu lần đầu trong session.
     */
    static async initCache(className) {
        try {
            const cls = CacheManager.validateClassName(className);
            const root = await CacheManager._readRoot();

            if (!root[cls]) {
                root[cls] = {
                    lastUpdated: new Date().toISOString(),
                    students: {}
                };
                await CacheManager._writeRoot(root);
                console.log(`[CacheManager] Đã khởi tạo cache cho lớp ${cls}`);
            }
            return root[cls];
        } catch (e) {
            console.error('[CacheManager] initCache lỗi:', e);
            throw e;
        }
    }

    /**
     * Lưu điểm 1 môn của 1 HS. Auto init nếu chưa có.
     * Trả về object student vừa update.
     */
    static async syncScore(className, studentId, subject, score) {
        try {
            const cls = CacheManager.validateClassName(className);
            const sid = CacheManager.validateStudentId(studentId);

            const subjectKey = CacheManager.normalizeSubject(subject);
            if (!subjectKey) {
                throw new Error(`Môn không nhận ra: "${subject}". Subject hợp lệ: ${VALID_SUBJECTS.join(', ')}`);
            }

            const cleanScore = CacheManager.validateScore(score);

            const root = await CacheManager._readRoot();
            if (!root[cls]) {
                root[cls] = { lastUpdated: new Date().toISOString(), students: {} };
            }
            if (!root[cls].students[sid]) {
                root[cls].students[sid] = {
                    id: sid,
                    diem: {},
                    lastSynced: new Date().toISOString()
                };
            }

            root[cls].students[sid].diem[subjectKey] = cleanScore;
            root[cls].students[sid].lastSynced = new Date().toISOString();
            root[cls].lastUpdated = new Date().toISOString();

            await CacheManager._writeRoot(root);

            return root[cls].students[sid];
        } catch (e) {
            console.error(`[CacheManager] syncScore(${className}, ${studentId}, ${subject}, ${score}) lỗi:`, e);
            throw e;
        }
    }

    /**
     * Sync nhiều HS cùng môn trong 1 lần ghi (gom batch để tránh nhiều
     * chrome.storage.set liên tiếp). Dùng khi extract xong cả bảng Sổ NX.
     *
     * @param className tên lớp
     * @param subject tên môn raw từ Vnedu
     * @param entries [{ studentId, score }]
     * @returns { synced: số HS lưu thành công, skipped: [{studentId, reason}] }
     */
    static async syncBatch(className, subject, entries) {
        try {
            const cls = CacheManager.validateClassName(className);
            const subjectKey = CacheManager.normalizeSubject(subject);
            if (!subjectKey) {
                throw new Error(`Môn không nhận ra: "${subject}"`);
            }
            if (!Array.isArray(entries)) {
                throw new Error('entries phải là array');
            }

            const root = await CacheManager._readRoot();
            if (!root[cls]) {
                root[cls] = { lastUpdated: new Date().toISOString(), students: {} };
            }

            const now = new Date().toISOString();
            const skipped = [];
            let synced = 0;

            for (const entry of entries) {
                try {
                    const sid = CacheManager.validateStudentId(entry.studentId);
                    const cleanScore = CacheManager.validateScore(entry.score);

                    if (!root[cls].students[sid]) {
                        root[cls].students[sid] = { id: sid, diem: {}, lastSynced: now };
                    }
                    root[cls].students[sid].diem[subjectKey] = cleanScore;
                    root[cls].students[sid].lastSynced = now;
                    synced++;
                } catch (e) {
                    skipped.push({ studentId: entry.studentId, reason: e.message });
                }
            }

            root[cls].lastUpdated = now;
            await CacheManager._writeRoot(root);

            console.log(`[CacheManager] syncBatch lớp ${cls} môn ${subjectKey}: ${synced} thành công, ${skipped.length} skip`);
            return { synced, skipped };
        } catch (e) {
            console.error(`[CacheManager] syncBatch(${className}, ${subject}) lỗi:`, e);
            throw e;
        }
    }

    /**
     * Lấy toàn bộ điểm của 1 HS (target < 100ms).
     * Trả null nếu chưa có cache.
     */
    static async getStudentScores(className, studentId) {
        try {
            const cls = CacheManager.validateClassName(className);
            const sid = CacheManager.validateStudentId(studentId);

            const root = await CacheManager._readRoot();
            const studentObj = root[cls]?.students?.[sid];
            if (!studentObj) return null;

            return {
                id: studentObj.id,
                diem: { ...studentObj.diem },
                lastSynced: studentObj.lastSynced
            };
        } catch (e) {
            console.error(`[CacheManager] getStudentScores lỗi:`, e);
            return null;
        }
    }

    /**
     * Lấy toàn bộ data của 1 lớp (cho Tab Cache Monitor — Phase 2).
     */
    static async getClassCache(className) {
        try {
            const cls = CacheManager.validateClassName(className);
            const root = await CacheManager._readRoot();
            return root[cls] || null;
        } catch (e) {
            console.error('[CacheManager] getClassCache lỗi:', e);
            return null;
        }
    }

    /**
     * Liệt kê tên các lớp đang có trong cache.
     */
    static async listClasses() {
        const root = await CacheManager._readRoot();
        return Object.keys(root);
    }

    /**
     * Thống kê cache (cho debug Tab Cache Monitor).
     * { totalClasses, totalStudents, totalScoreEntries, byClass: {...} }
     */
    static async getCacheStats() {
        const root = await CacheManager._readRoot();
        const stats = {
            totalClasses: 0,
            totalStudents: 0,
            totalScoreEntries: 0,
            byClass: {}
        };

        for (const [cls, data] of Object.entries(root)) {
            const studentCount = Object.keys(data.students || {}).length;
            let scoreCount = 0;
            for (const s of Object.values(data.students || {})) {
                scoreCount += Object.values(s.diem || {}).filter(v => v !== null && v !== undefined).length;
            }
            stats.totalClasses++;
            stats.totalStudents += studentCount;
            stats.totalScoreEntries += scoreCount;
            stats.byClass[cls] = {
                students: studentCount,
                scores: scoreCount,
                lastUpdated: data.lastUpdated
            };
        }
        return stats;
    }

    /**
     * Reset toàn bộ cache (debug). Dùng cho nút "Reset Cache" trong Tab 1.
     */
    static async clearCache() {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) {
            CacheManager._memFallback = {};
            return;
        }
        return new Promise((resolve, reject) => {
            chrome.storage.local.remove([CACHE_ROOT_KEY], () => {
                if (chrome.runtime.lastError) {
                    return reject(new Error(chrome.runtime.lastError.message));
                }
                console.log('[CacheManager] Đã xóa toàn bộ classCache');
                resolve();
            });
        });
    }

    /**
     * Xóa cache của 1 lớp cụ thể (giữ các lớp khác).
     */
    static async clearClass(className) {
        const cls = CacheManager.validateClassName(className);
        const root = await CacheManager._readRoot();
        if (root[cls]) {
            delete root[cls];
            await CacheManager._writeRoot(root);
            console.log(`[CacheManager] Đã xóa cache lớp ${cls}`);
        }
    }
}

// Expose constants để consumer (vnedu-adapter, sidebar) dùng được
CacheManager.VALID_SUBJECTS = VALID_SUBJECTS;
CacheManager.SUBJECT_NAME_MAP = SUBJECT_NAME_MAP;

/* ========================================================================
 * NLPCMapper v0.1.8 — Suy TỰ ĐỘNG cả 13 trường NL/PC từ điểm môn
 *
 * Theo TT27/2020 đánh giá HS Tiểu học, NL/PC dùng 3 MỨC:
 *   - T (Tốt)
 *   - Đ (Đạt)
 *   - C (Cần cố gắng)
 *
 * Quyết định nghiệp vụ (anh Chung TH Diễn Liên 2026-05-15):
 *   "Phần mềm phải hướng đến tự động hoá CẢ 16 trường, căn cứ điểm số +
 *    mức độ hoàn thành để có lời nhận xét đúng yêu cầu TT27."
 *   → 13 trường con đều suy auto. GV có thể click badge để override khi cần.
 *
 * Mapping cho 13 trường (3 NL chung + 5 NL đặc thù + 5 PC):
 *   NL chung:
 *     - tu_chu_tu_hoc          ← TB toàn bộ môn (HS tự học → điểm đều cao)
 *     - giao_tiep_hop_tac      ← TV + TA + HĐTN (môn cần kỹ năng giao tiếp)
 *     - giai_quyet_van_de      ← Toán + KH + TNXH (môn cần tư duy GQVĐ)
 *   NL đặc thù:
 *     - ngon_ngu               ← TV + TA
 *     - tinh_toan              ← Toán
 *     - khoa_hoc               ← TNXH + KH + LSĐL
 *     - tham_mi                ← ÂN + MT
 *     - the_chat               ← GDTC
 *   Phẩm chất:
 *     - yeu_nuoc               ← LSĐL + ĐĐ
 *     - nhan_ai                ← ĐĐ + TV
 *     - cham_chi               ← Điểm TB (fallback avg toàn bộ)
 *     - trung_thuc             ← ĐĐ + TB toàn bộ
 *     - trach_nhiem            ← ĐĐ + HĐTN + TB toàn bộ
 *
 * Tier theo avg:
 *   avg ≥ 8       → 'tot' (T - Tốt)
 *   avg 5–7.99    → 'ht'  (Đ - Đạt) — internal key 'ht' giữ tương thích nhanxet-ngan.json
 *   avg < 5       → 'cht' (C - Cần cố gắng)
 *   không cache   → 'ht'  (Đ default an toàn — TT27 ưu tiên không khắt khe)
 *
 * Output:
 *   { tu_chu_tu_hoc: { grade:'tot', badge:'T', avg:8.5,
 *                      sources:[{key,label,score},...],
 *                      hint: 'TB toàn bộ: 8.5 → T' }, ... }
 * ====================================================================== */

// Internal grade key: 'tot' | 'ht' | 'cht' (giữ tương thích nhanxet-ngan.json đã có)
// Display badge: T / Đ / C (TT27)

const NLPC_FIELD_RULES = Object.freeze({
    // NĂNG LỰC CHUNG (3 trường)
    tu_chu_tu_hoc: {
        label: 'Tự chủ và tự học',
        section: 'nang_luc_chung',
        // Tự học tốt → điểm đều cao → dùng TB toàn bộ
        sources: [{ key: 'diem-tb', label: 'Điểm TB' }],
        fallbackAllSubjects: true
    },
    giao_tiep_hop_tac: {
        label: 'Giao tiếp và hợp tác',
        section: 'nang_luc_chung',
        sources: [
            { key: 'tieng-viet', label: 'TV' },
            { key: 'tieng-anh', label: 'TA' },
            { key: 'htn', label: 'HĐTN' }
        ]
    },
    giai_quyet_van_de: {
        label: 'GQVĐ và sáng tạo',
        section: 'nang_luc_chung',
        sources: [
            { key: 'toan', label: 'Toán' },
            { key: 'khoa-hoc', label: 'KH' },
            { key: 'tnxh', label: 'TNXH' }
        ]
    },

    // NĂNG LỰC ĐẶC THÙ (5 trường)
    ngon_ngu: {
        label: 'Năng lực Ngôn ngữ',
        section: 'nang_luc_dac_thu',
        sources: [
            { key: 'tieng-viet', label: 'TV' },
            { key: 'tieng-anh', label: 'TA' }
        ]
    },
    tinh_toan: {
        label: 'Năng lực Tính toán',
        section: 'nang_luc_dac_thu',
        sources: [{ key: 'toan', label: 'Toán' }]
    },
    khoa_hoc: {
        label: 'Năng lực Khoa học',
        section: 'nang_luc_dac_thu',
        sources: [
            { key: 'tnxh', label: 'TNXH' },
            { key: 'khoa-hoc', label: 'KH' },
            { key: 'lich-su-dia', label: 'LSĐL' }
        ]
    },
    tham_mi: {
        label: 'Năng lực Thẩm mĩ',
        section: 'nang_luc_dac_thu',
        sources: [
            { key: 'am-nhac', label: 'ÂN' },
            { key: 'mi-thuat', label: 'MT' }
        ]
    },
    the_chat: {
        label: 'Năng lực Thể chất',
        section: 'nang_luc_dac_thu',
        sources: [{ key: 'gd-the-chap', label: 'GDTC' }]
    },
    // BUG-006/V1.7: Lớp 3-5 thêm Công nghệ + Tin học (TT27/2020 + CT GDPT 2018).
    // NL Công nghệ ưu tiên cache 'cong-nghe'; nếu trường chỉ cache combined "Tin học và
    // Công nghệ" (→ 'tin-hoc') thì fallback dùng điểm 'tin-hoc' để tránh default Đ.
    cong_nghe: {
        label: 'Năng lực Công nghệ',
        section: 'nang_luc_dac_thu',
        sources: [{ key: 'cong-nghe', label: 'CN' }, { key: 'tin-hoc', label: 'Tin' }]
    },
    tin_hoc: {
        label: 'Năng lực Tin học',
        section: 'nang_luc_dac_thu',
        sources: [{ key: 'tin-hoc', label: 'Tin' }]
    },

    // PHẨM CHẤT (5 trường)
    yeu_nuoc: {
        label: 'Yêu nước',
        section: 'pham_chat',
        sources: [
            { key: 'lich-su-dia', label: 'LSĐL' },
            { key: 'dao-duc', label: 'ĐĐ' }
        ]
    },
    nhan_ai: {
        label: 'Nhân ái',
        section: 'pham_chat',
        sources: [
            { key: 'dao-duc', label: 'ĐĐ' },
            { key: 'tieng-viet', label: 'TV' }
        ]
    },
    cham_chi: {
        label: 'Chăm chỉ',
        section: 'pham_chat',
        sources: [{ key: 'diem-tb', label: 'Điểm TB' }],
        fallbackAllSubjects: true
    },
    trung_thuc: {
        label: 'Trung thực',
        section: 'pham_chat',
        sources: [
            { key: 'dao-duc', label: 'ĐĐ' },
            { key: 'diem-tb', label: 'Điểm TB' }
        ],
        fallbackAllSubjects: true
    },
    trach_nhiem: {
        label: 'Trách nhiệm',
        section: 'pham_chat',
        sources: [
            { key: 'dao-duc', label: 'ĐĐ' },
            { key: 'htn', label: 'HĐTN' },
            { key: 'diem-tb', label: 'Điểm TB' }
        ],
        fallbackAllSubjects: true
    }
});

class NLPCMapper {
    /**
     * Phân tier 3 mức TT27/2020 cho NL/PC.
     *   avg ≥ 8       → 'tot' (T)
     *   avg 5–7.99    → 'ht'  (Đ)  ← internal key 'ht' giữ tương thích nhanxet-ngan.json
     *   avg < 5       → 'cht' (C)
     *   avg null      → null (caller quyết default; UI default 'ht' = Đ)
     */
    static avgToGrade(avg) {
        if (avg === null || avg === undefined || isNaN(avg)) return null;
        if (avg >= 8) return 'tot';
        if (avg >= 5) return 'ht';
        return 'cht';
    }

    /** Map grade key → badge text hiển thị UI (TT27 NL/PC: T / Đ / C) */
    static gradeToBadge(grade) {
        return { tot: 'T', ht: 'Đ', cht: 'C' }[grade] || 'Đ';
    }

    /** Cycle qua 3 mức khi GV click badge để override: T → Đ → C → T */
    static cycleGrade(currentGrade) {
        const order = ['tot', 'ht', 'cht'];
        const idx = order.indexOf(currentGrade);
        return order[(idx + 1) % order.length];
    }

    /** Tính trung bình các điểm hợp lệ; trả null nếu không có điểm nào */
    static _avgOf(scores) {
        const valid = scores.filter(s => s !== null && s !== undefined && !isNaN(s));
        if (valid.length === 0) return null;
        const sum = valid.reduce((a, b) => a + b, 0);
        return Math.round((sum / valid.length) * 100) / 100;
    }

    /**
     * Map 1 trường NLPC theo rule.
     * Trả: { grade, badge, avg, sources:[{key,label,score}], hint, isDefault }
     * - Có cache: grade theo avg (3 mức T/Đ/C)
     * - Không cache: grade='ht' (Đ — default an toàn TT27), isDefault=true
     */
    static _mapOneField(rule, diemObj) {
        let sources = rule.sources
            .map(s => ({ ...s, score: diemObj[s.key] }))
            .filter(s => s.score !== null && s.score !== undefined);

        // Fallback "tất cả môn" cho các trường tổng hợp (Tự chủ, Chăm chỉ, Trung thực, Trách nhiệm)
        if (sources.length === 0 && rule.fallbackAllSubjects) {
            sources = Object.entries(diemObj)
                .filter(([k, v]) => k !== 'diem-tb' && v !== null && v !== undefined)
                .map(([k, v]) => ({ key: k, label: this._shortLabel(k), score: v }));
        }

        // Default Đ khi không có cache (theo quyết định nghiệp vụ: tự động hoá toàn bộ,
        // GV xem lại nếu thấy không phù hợp)
        if (sources.length === 0) {
            return {
                grade: 'ht',
                badge: 'Đ',
                avg: null,
                sources: [],
                hint: '(chưa có cache → mặc định Đạt)',
                isDefault: true
            };
        }

        const avg = this._avgOf(sources.map(s => s.score));
        const grade = this.avgToGrade(avg);
        const badge = this.gradeToBadge(grade);

        // Hint format: "TV:9, TA:7 → Đ (8.0)" hoặc "Toán:10 → T"
        const srcText = sources.map(s => `${s.label}:${s.score}`).join(', ');
        const hint = sources.length === 1
            ? `${srcText} → ${badge}`
            : `${srcText} → ${badge} (${avg.toFixed(1)})`;

        return { grade, badge, avg, sources, hint, isDefault: false };
    }

    static _shortLabel(subjectKey) {
        return {
            'tieng-viet': 'TV', 'toan': 'Toán', 'tnxh': 'TNXH', 'khoa-hoc': 'KH',
            'lich-su-dia': 'LSĐL', 'dao-duc': 'ĐĐ', 'tin-hoc': 'Tin', 'cong-nghe': 'CN',
            'tieng-anh': 'TA', 'gd-the-chap': 'GDTC', 'am-nhac': 'ÂN', 'mi-thuat': 'MT',
            'htn': 'HĐTN', 'diem-tb': 'TB'
        }[subjectKey] || subjectKey;
    }

    /**
     * Map toàn bộ 6 trường auto từ object điểm 1 HS.
     *
     * @param diemObj { 'tieng-viet': 9, 'toan': 10, ... }
     * @returns { nl_ngon_ngu: {...}, nl_tinh_toan: {...}, ... }
     */
    static scoresToGrades(diemObj) {
        if (!diemObj || typeof diemObj !== 'object') {
            throw new Error('scoresToGrades: diemObj phải là object');
        }
        const result = {};
        for (const [field, rule] of Object.entries(NLPC_FIELD_RULES)) {
            result[field] = {
                label: rule.label,
                ...this._mapOneField(rule, diemObj)
            };
        }
        return result;
    }

    /**
     * Convenience: đọc cache + map. Dùng cho UI Form NLPC.
     *
     * @returns Promise<{
     *   className, studentId, found:boolean,
     *   diem: {...}, suggestions: { nl_ngon_ngu: {...}, ... }
     * }>
     */
    static async autoSuggestForStudent(className, studentId) {
        const scores = await CacheManager.getStudentScores(className, studentId);
        if (!scores) {
            return {
                className,
                studentId,
                found: false,
                diem: {},
                suggestions: this.scoresToGrades({})
            };
        }
        return {
            className,
            studentId,
            found: true,
            diem: scores.diem,
            suggestions: this.scoresToGrades(scores.diem),
            lastSynced: scores.lastSynced
        };
    }

    /** List 13 field — cho UI render thứ tự, grouped theo section */
    static listAutoFields() {
        return Object.entries(NLPC_FIELD_RULES).map(([key, r]) => ({
            key,
            label: r.label,
            section: r.section
        }));
    }

    /** Group 13 field theo section (cho UI render 3 cụm) */
    static fieldsBySection() {
        const out = { nang_luc_chung: [], nang_luc_dac_thu: [], pham_chat: [] };
        for (const [key, r] of Object.entries(NLPC_FIELD_RULES)) {
            out[r.section].push({ key, label: r.label });
        }
        return out;
    }
}

NLPCMapper.NLPC_FIELD_RULES = NLPC_FIELD_RULES;

if (typeof window !== 'undefined') {
    window.NhanXetEngineV2 = NhanXetEngineV2;
    window.CacheManager = CacheManager;
    window.NLPCMapper = NLPCMapper;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NhanXetEngineV2, CacheManager, NLPCMapper };
}

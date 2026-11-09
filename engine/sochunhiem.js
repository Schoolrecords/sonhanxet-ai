/**
 * 6.3.0 — Bộ soạn nội dung Sổ chủ nhiệm (tiểu học) cho vnEdu, chạy hoàn toàn trên máy.
 *
 * Nhận "state" do content/scn-bridge.js đọc từ cửa sổ sổ chủ nhiệm (mẫu, mục, lớp, tháng,
 * số liệu trên trang, danh sách ô) → trả bản nháp từng ô.
 * Nguyên tắc nội dung:
 *   - Bám khối lớp (nội dung học tập theo chương trình từng lớp), bám tháng (chủ điểm, ngày lễ),
 *     bám số liệu thật trên trang (sĩ số, hộ nghèo, khuyết tật, kết quả HKI...).
 *   - Không bịa kết quả: chỗ chỉ thầy cô biết (tên học sinh, số vở đạt...) để dấu "…" và báo.
 *   - Không nhắc cơ quan, tổ chức đã thôi hoạt động sau sắp xếp; không nhắc tên bộ sách.
 */
(function (root) {
    'use strict';

    // ---------- tiện ích ----------
    function hash(s) {
        let h = 2166136261;
        s = String(s);
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }
    function rng(seed) {
        let a = hash(seed) || 1;
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            let t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
    /** Chọn n phần tử, GIỮ thứ tự gốc (danh sách có trình tự hợp lí). */
    function pickN(r, arr, n) {
        if (arr.length <= n) return arr.slice();
        const idx = arr.map((_, i) => i).sort(() => r() - 0.5).slice(0, n).sort((a, b) => a - b);
        return idx.map(i => arr[i]);
    }
    function num(v) {
        if (v === null || v === undefined) return null;
        const s = String(v).trim();
        if (!s) return null;
        const n = parseInt(s.replace(/[^\d]/g, ''), 10);
        return isNaN(n) ? null : n;
    }
    function pct(a, b) {
        if (!b) return '';
        const v = Math.round(a * 1000 / b) / 10;
        return String(v).replace('.', ',') + '%';
    }
    function cham(s) { return /[.:;!?…)”]$/.test(s) ? s : s + '.'; }
    function lines(arr) {
        return arr.filter(Boolean).map(s => {
            s = String(s).trim();
            if (s.startsWith('* ')) return s;
            return cham(s.startsWith('- ') ? s : '- ' + s);
        }).join('\n');
    }

    // ---------- đặc điểm lớp do thầy cô chọn ----------
    const TRAITS = [
        { id: 'ph_quan_tam', label: 'Phụ huynh quan tâm, phối hợp tốt', macDinh: true },
        { id: 'hai_buoi', label: 'Học 2 buổi/ngày', macDinh: true },
        { id: 'nong_nghiep', label: 'Phần lớn gia đình làm nông, lao động tự do' },
        { id: 'di_lam_xa', label: 'Nhiều phụ huynh đi làm xa, con ở với ông bà' },
        { id: 'ban_tru', label: 'Có học sinh ăn bán trú' },
        { id: 'csvc_tot', label: 'Phòng học có ti vi hoặc máy chiếu' },
        { id: 'hoa_nhap', label: 'Có học sinh khuyết tật học hòa nhập' },
        { id: 'dan_toc', label: 'Có học sinh dân tộc thiểu số' }
    ];

    // ---------- chương trình từng lớp (nửa đầu / nửa sau năm học) ----------
    const HOC_TAP = {
        1: {
            hk1: ['Tiếng Việt: luyện đọc, viết âm, vần, tiếng, từ; rèn tư thế ngồi viết, cách cầm bút, viết đúng độ cao các con chữ',
                'Toán: đọc, viết, so sánh các số; cộng, trừ trong phạm vi 10; nhận biết hình phẳng, hình khối'],
            hk2: ['Tiếng Việt: luyện đọc trơn, đọc hiểu đoạn văn ngắn; nghe - viết chính tả, viết câu',
                'Toán: các số đến 100; cộng, trừ không nhớ trong phạm vi 100; đo độ dài, xem giờ đúng, xem lịch']
        },
        2: {
            hk1: ['Tiếng Việt: đọc lưu loát, hiểu nội dung bài đọc; viết chữ hoa đúng mẫu; viết đoạn văn ngắn 3 - 4 câu',
                'Toán: cộng, trừ có nhớ trong phạm vi 100; giải bài toán có lời văn; đơn vị đo ki-lô-gam, lít'],
            hk2: ['Tiếng Việt: đọc hiểu, viết đoạn văn ngắn theo gợi ý; nghe - viết chính tả đúng tốc độ',
                'Toán: phép nhân, phép chia (bảng nhân, bảng chia 2 và 5); các số trong phạm vi 1000; cộng, trừ trong phạm vi 1000']
        },
        3: {
            hk1: ['Tiếng Việt: đọc hiểu văn bản; viết đoạn văn kể, tả ngắn; mở rộng vốn từ, câu',
                'Toán: bảng nhân, bảng chia; nhân, chia số có hai, ba chữ số với số có một chữ số; làm quen hình học, đo lường'],
            hk2: ['Tiếng Việt: đọc hiểu, viết đoạn văn nêu cảm nghĩ, tả đồ vật, kể sự việc',
                'Toán: các số đến 10 000, 100 000; bốn phép tính; chu vi, diện tích hình chữ nhật, hình vuông']
        },
        4: {
            hk1: ['Tiếng Việt: đọc hiểu, đọc diễn cảm; viết đoạn văn, bài văn kể chuyện, miêu tả',
                'Toán: số có nhiều chữ số; cộng, trừ, nhân, chia số tự nhiên; đơn vị đo đại lượng'],
            hk2: ['Tiếng Việt: viết bài văn miêu tả, đoạn văn nêu ý kiến, nêu tình cảm, cảm xúc',
                'Toán: phân số và các phép tính với phân số; giải toán có lời văn']
        },
        5: {
            hk1: ['Tiếng Việt: đọc hiểu, đọc diễn cảm; viết bài văn tả người, tả phong cảnh',
                'Toán: số thập phân và các phép tính với số thập phân; giải toán có lời văn'],
            hk2: ['Tiếng Việt: viết bài văn kể chuyện sáng tạo, đoạn văn nêu ý kiến; ôn tập cuối cấp',
                'Toán: tỉ số phần trăm; diện tích, thể tích một số hình; số đo thời gian, chuyển động đều; ôn tập cuối cấp']
        }
    };

    function doiSao(khoi) {
        if (khoi <= 2) return 'Sao nhi đồng';
        if (khoi === 3) return 'Sao nhi đồng';
        return 'chi đội';
    }

    // ---------- chủ điểm, việc trọng tâm theo tháng ----------
    // tuan: việc đặc thù mỗi tuần trong tháng (dòng chung của tuần thêm tự động)
    const THANG = {
        8: {
            chuDiem: 'Chuẩn bị năm học mới',
            trongTam: ['Nhận bàn giao học sinh, nắm danh sách, hoàn cảnh, sức khỏe từng em',
                'Ổn định tổ chức lớp, xây dựng nề nếp học tập ban đầu',
                'Chuẩn bị chu đáo cho Lễ khai giảng năm học mới'],
            daoDuc: ['Phổ biến nội quy nhà trường, nội quy lớp học; hướng dẫn học sinh chào hỏi, xếp hàng ra vào lớp',
                'Giáo dục học sinh lễ phép với thầy cô, đoàn kết, giúp đỡ bạn bè'],
            hocTap: ['Kiểm tra sách giáo khoa, vở, đồ dùng học tập của từng học sinh',
                'Hướng dẫn cách giữ gìn sách vở, tư thế ngồi học, cách giơ tay phát biểu, cách làm việc nhóm'],
            hoatDong: ['Lao động vệ sinh, trang trí lớp học', 'Tập luyện nghi thức, văn nghệ chuẩn bị Lễ khai giảng',
                'Bầu ban cán sự lớp lâm thời'],
            tuan: [['Nhận lớp, nắm danh sách học sinh', 'Kiểm tra sách vở, đồ dùng học tập'],
                ['Ổn định chỗ ngồi, bầu ban cán sự lớp lâm thời', 'Phổ biến nội quy trường, lớp'],
                ['Lao động vệ sinh, trang trí lớp học', 'Tập nghi thức, văn nghệ chuẩn bị khai giảng'],
                ['Hoàn thiện hồ sơ lớp', 'Chuẩn bị chu đáo cho Lễ khai giảng']]
        },
        9: {
            chuDiem: 'Mái trường thân yêu',
            trongTam: ['Tổ chức tốt Lễ khai giảng; ổn định sĩ số, nề nếp lớp học',
                'Thực hiện chương trình, kế hoạch dạy học từ tuần đầu năm học',
                'Họp phụ huynh đầu năm, kiện toàn Ban đại diện cha mẹ học sinh của lớp'],
            daoDuc: ['Giáo dục học sinh yêu trường, yêu lớp, kính trọng thầy cô, đoàn kết với bạn',
                'Giáo dục an toàn giao thông, phòng tránh tai nạn thương tích, đuối nước',
                'Rèn thói quen giữ gìn vệ sinh cá nhân, vệ sinh lớp học'],
            hocTap: ['Nắm chắc năng lực học tập của từng học sinh qua các tiết học đầu năm để có biện pháp giúp đỡ kịp thời',
                'Xây dựng nề nếp học tập: chuẩn bị bài, giữ vở sạch, viết chữ đẹp'],
            hoatDong: ['Tham gia Lễ khai giảng, vui Tết Trung thu cùng nhà trường',
                'Kiện toàn ban cán sự lớp, hội đồng tự quản, chia nhóm học tập',
                'Trang trí lớp học theo hướng dẫn của nhà trường'],
            tuan: [['Tham gia Lễ khai giảng', 'Ổn định sĩ số, nề nếp, chỗ ngồi'],
                ['Bầu ban cán sự lớp, hội đồng tự quản; chia nhóm học tập', 'Giáo dục an toàn giao thông'],
                ['Họp phụ huynh đầu năm học', 'Chuẩn bị, tham gia vui Tết Trung thu'],
                ['Hoàn thành trang trí lớp học', 'Kiểm tra vở, chữ viết; sơ kết thi đua tháng']]
        },
        10: {
            chuDiem: 'Vòng tay bạn bè',
            trongTam: ['Duy trì sĩ số, nề nếp; thi đua học tốt chào mừng Ngày Phụ nữ Việt Nam 20/10',
                'Củng cố kiến thức, kĩ năng; chuẩn bị tốt cho đánh giá giữa học kì I',
                'Quan tâm giúp đỡ học sinh còn chậm, học sinh có hoàn cảnh khó khăn'],
            daoDuc: ['Giáo dục học sinh biết yêu thương, kính trọng bà, mẹ, cô giáo nhân Ngày 20/10',
                'Giáo dục tinh thần đoàn kết, giúp đỡ nhau trong học tập; nói lời hay, làm việc tốt',
                'Nhắc nhở học sinh giữ gìn sức khỏe khi thời tiết giao mùa'],
            hocTap: ['Tổ chức đôi bạn cùng tiến, nhóm học tập giúp nhau',
                'Ôn tập, củng cố kiến thức đã học; chuẩn bị tốt cho đánh giá giữa học kì I'],
            hoatDong: ['Làm thiệp, tặng hoa chúc mừng bà, mẹ, cô giáo nhân Ngày 20/10',
                'Tham gia các hoạt động trải nghiệm, múa hát sân trường, trò chơi dân gian',
                'Lao động vệ sinh lớp học, chăm sóc cây xanh'],
            tuan: [['Phát động thi đua học tốt chào mừng Ngày 20/10', 'Kiểm tra nề nếp, vở sạch chữ đẹp'],
                ['Thành lập đôi bạn cùng tiến', 'Làm thiệp chúc mừng bà, mẹ, cô giáo'],
                ['Tổ chức hoạt động chào mừng Ngày Phụ nữ Việt Nam 20/10', 'Phụ đạo học sinh còn chậm'],
                ['Ôn tập, củng cố kiến thức chuẩn bị đánh giá giữa học kì I', 'Sơ kết thi đua tháng']]
        },
        11: {
            chuDiem: 'Biết ơn thầy cô',
            trongTam: ['Thi đua dạy tốt, học tốt chào mừng Ngày Nhà giáo Việt Nam 20/11',
                'Hoàn thành đánh giá giữa học kì I; phân tích kết quả, có biện pháp giúp đỡ từng em',
                'Giữ vững nề nếp, sĩ số; rèn chữ viết, giữ vở sạch'],
            daoDuc: ['Giáo dục truyền thống “Tôn sư trọng đạo”, lòng biết ơn thầy cô giáo',
                'Giáo dục học sinh trung thực trong học tập, kiểm tra',
                'Giáo dục an toàn giao thông, phòng tránh tai nạn thương tích'],
            hocTap: ['Thi đua giành nhiều lời khen, hoa điểm tốt dâng tặng thầy cô',
                'Phụ đạo học sinh chưa hoàn thành nội dung bài học sau đánh giá giữa học kì I; bồi dưỡng học sinh có năng khiếu'],
            hoatDong: ['Tham gia văn nghệ, làm báo tường, thiệp chúc mừng Ngày 20/11',
                'Tham gia các hoạt động trải nghiệm theo chủ điểm của nhà trường',
                'Thông báo kết quả giữa học kì I tới phụ huynh qua sổ liên lạc điện tử'],
            tuan: [['Phát động thi đua “Hoa điểm tốt” chào mừng Ngày 20/11', 'Thông báo kết quả giữa học kì I tới phụ huynh'],
                ['Phụ đạo học sinh chưa hoàn thành sau giữa học kì I', 'Tập văn nghệ chào mừng Ngày 20/11'],
                ['Tham gia các hoạt động kỷ niệm Ngày Nhà giáo Việt Nam 20/11', 'Tổng kết đợt thi đua'],
                ['Rèn chữ viết, kiểm tra vở sạch chữ đẹp', 'Sơ kết thi đua tháng']]
        },
        12: {
            chuDiem: 'Uống nước nhớ nguồn',
            trongTam: ['Giáo dục truyền thống nhân Ngày thành lập Quân đội nhân dân Việt Nam 22/12',
                'Ôn tập, củng cố kiến thức, kĩ năng chuẩn bị đánh giá cuối học kì I',
                'Giữ vững sĩ số, nề nếp; giữ ấm, phòng bệnh mùa đông'],
            daoDuc: ['Giáo dục lòng biết ơn các anh hùng liệt sĩ, các chú bộ đội',
                'Giáo dục học sinh mặc ấm, giữ gìn sức khỏe, phòng bệnh khi trời rét',
                'Rèn ý thức tự giác, tự quản trong học tập và sinh hoạt'],
            hocTap: ['Hệ thống, ôn tập kiến thức học kì I theo từng môn; luyện kĩ năng làm bài',
                'Tập trung kèm cặp học sinh còn chậm, phấn đấu không có học sinh chưa hoàn thành'],
            hoatDong: ['Tham gia các hoạt động kỷ niệm Ngày 22/12 do nhà trường, Liên đội tổ chức',
                'Lao động vệ sinh lớp học, chăm sóc bồn hoa, cây xanh',
                'Hoàn thiện hồ sơ, sổ sách cuối học kì I'],
            tuan: [['Giáo dục truyền thống “Uống nước nhớ nguồn”', 'Kiểm tra nề nếp, sĩ số'],
                ['Tham gia hoạt động kỷ niệm Ngày thành lập Quân đội nhân dân Việt Nam 22/12', 'Ôn tập kiến thức học kì I'],
                ['Ôn tập theo từng môn, luyện kĩ năng làm bài', 'Kèm cặp học sinh còn chậm'],
                ['Ôn tập tổng hợp chuẩn bị đánh giá cuối học kì I', 'Sơ kết thi đua tháng']]
        },
        1: {
            chuDiem: 'Mừng Đảng, mừng xuân',
            trongTam: ['Tổ chức kiểm tra định kì, đánh giá cuối học kì I nghiêm túc, đúng quy định',
                'Hoàn thành nhận xét, đánh giá học sinh; sơ kết học kì I; thông báo kết quả tới phụ huynh',
                'Xây dựng kế hoạch giúp đỡ học sinh trong học kì II'],
            daoDuc: ['Giáo dục học sinh trung thực, tự giác trong kiểm tra, đánh giá',
                'Giáo dục học sinh đón Tết an toàn, tiết kiệm; không đốt pháo, không chơi các vật gây cháy nổ',
                'Rèn nề nếp học tập khi bắt đầu học kì II'],
            hocTap: ['Ôn tập, kiểm tra định kì cuối học kì I các môn theo quy định',
                'Nhận xét, đánh giá cuối học kì I; trao đổi với phụ huynh về tiến bộ và hạn chế của từng em',
                'Triển khai chương trình học kì II; phụ đạo học sinh còn chậm'],
            hoatDong: ['Họp phụ huynh sơ kết học kì I',
                'Tham gia các hoạt động mừng Đảng, mừng xuân của nhà trường',
                'Trang trí lớp học đón xuân'],
            tuan: [['Ôn tập tổng hợp, kiểm tra định kì cuối học kì I', 'Nhắc nhở trung thực trong kiểm tra'],
                ['Nhận xét, đánh giá cuối học kì I; hoàn thiện hồ sơ', 'Sơ kết học kì I của lớp'],
                ['Họp phụ huynh sơ kết học kì I', 'Bắt đầu chương trình học kì II'],
                ['Giáo dục đón Tết an toàn, tiết kiệm', 'Trang trí lớp học đón xuân; sơ kết thi đua tháng']]
        },
        2: {
            chuDiem: 'Mừng Đảng, mừng xuân',
            trongTam: ['Ổn định sĩ số, nề nếp sau kì nghỉ Tết Nguyên đán',
                'Thực hiện chương trình học kì II; giúp đỡ học sinh còn chậm theo kế hoạch',
                'Giáo dục truyền thống nhân Ngày thành lập Đảng Cộng sản Việt Nam 3/2'],
            daoDuc: ['Giáo dục học sinh lòng biết ơn Đảng, Bác Hồ; yêu quê hương, đất nước',
                'Giáo dục an toàn khi vui chơi ngày Tết, phòng tránh tai nạn thương tích',
                'Giáo dục ý thức bảo vệ môi trường, chăm sóc cây xanh'],
            hocTap: ['Kiểm tra lại kiến thức sau Tết, kịp thời củng cố cho học sinh',
                'Duy trì đôi bạn cùng tiến; bồi dưỡng học sinh có năng khiếu'],
            hoatDong: ['Tham gia “Tết trồng cây”, chăm sóc bồn hoa, cây xanh của lớp',
                'Tham gia các hoạt động mừng Đảng, mừng xuân',
                'Lao động vệ sinh lớp học sau kì nghỉ Tết'],
            tuan: [['Ổn định sĩ số, nề nếp sau nghỉ Tết', 'Giáo dục truyền thống Ngày thành lập Đảng 3/2'],
                ['Kiểm tra, củng cố kiến thức sau Tết', 'Lao động vệ sinh lớp học'],
                ['Tham gia Tết trồng cây, chăm sóc cây xanh', 'Duy trì đôi bạn cùng tiến'],
                ['Rèn chữ viết, kiểm tra vở', 'Sơ kết thi đua tháng']]
        },
        3: {
            chuDiem: 'Tiến bước lên Đoàn',
            trongTam: ['Thi đua học tốt chào mừng Ngày Quốc tế Phụ nữ 8/3 và Ngày thành lập Đoàn 26/3',
                'Duy trì sĩ số, nề nếp; tiếp tục giúp đỡ học sinh còn chậm',
                'Chuẩn bị tốt cho đánh giá giữa học kì II'],
            daoDuc: ['Giáo dục học sinh kính trọng, biết ơn bà, mẹ, cô giáo nhân Ngày 8/3',
                'Giáo dục truyền thống Đoàn Thanh niên Cộng sản Hồ Chí Minh; ý thức phấn đấu trở thành đội viên tốt',
                'Giáo dục an toàn giao thông, phòng tránh xâm hại'],
            hocTap: ['Ôn tập, củng cố kiến thức giữa học kì II', 'Phụ đạo học sinh còn chậm, bồi dưỡng học sinh có năng khiếu'],
            hoatDong: ['Làm thiệp, tặng hoa chúc mừng bà, mẹ, cô giáo nhân Ngày 8/3',
                'Tham gia các hoạt động chào mừng Ngày thành lập Đoàn 26/3',
                'Tham gia hoạt động trải nghiệm theo chủ điểm của nhà trường'],
            tuan: [['Phát động thi đua chào mừng Ngày 8/3 và 26/3', 'Làm thiệp chúc mừng bà, mẹ, cô giáo'],
                ['Tổ chức hoạt động chào mừng Ngày Quốc tế Phụ nữ 8/3', 'Kiểm tra nề nếp, vở sạch chữ đẹp'],
                ['Ôn tập chuẩn bị đánh giá giữa học kì II', 'Phụ đạo học sinh còn chậm'],
                ['Tham gia hoạt động chào mừng Ngày thành lập Đoàn 26/3', 'Sơ kết thi đua tháng']]
        },
        4: {
            chuDiem: 'Hòa bình và hữu nghị',
            trongTam: ['Giáo dục truyền thống nhân Ngày Giải phóng miền Nam 30/4 và Ngày Quốc tế Lao động 1/5',
                'Ôn tập, củng cố kiến thức, kĩ năng cả năm học',
                'Phòng chống đuối nước, giữ gìn sức khỏe khi trời nắng nóng'],
            daoDuc: ['Giáo dục học sinh yêu hòa bình, đoàn kết, thân thiện với bạn bè',
                'Giáo dục kĩ năng phòng chống đuối nước, phòng tránh tai nạn thương tích',
                'Giáo dục ý thức giữ gìn vệ sinh, bảo vệ môi trường'],
            hocTap: ['Ôn tập, hệ thống kiến thức theo từng môn', 'Tập trung giúp đỡ học sinh còn chậm, phấn đấu hoàn thành chương trình lớp học'],
            hoatDong: ['Tham gia các hoạt động kỷ niệm Ngày 30/4 và 1/5',
                'Tham gia hoạt động trải nghiệm, trò chơi dân gian, văn nghệ',
                'Lao động vệ sinh lớp học, chăm sóc cây xanh'],
            tuan: [['Giáo dục truyền thống Ngày Giải phóng miền Nam 30/4', 'Kiểm tra nề nếp, sĩ số'],
                ['Giáo dục kĩ năng phòng chống đuối nước', 'Ôn tập, hệ thống kiến thức'],
                ['Ôn tập theo từng môn; kèm cặp học sinh còn chậm', 'Lao động vệ sinh lớp học'],
                ['Tham gia hoạt động kỷ niệm Ngày 30/4 và 1/5', 'Sơ kết thi đua tháng']]
        },
        5: {
            chuDiem: 'Bác Hồ kính yêu',
            trongTam: ['Tổ chức kiểm tra định kì, đánh giá cuối năm học nghiêm túc, đúng quy định',
                'Xét hoàn thành chương trình lớp học; hoàn thiện học bạ, hồ sơ cuối năm',
                'Giáo dục truyền thống nhân kỷ niệm Ngày sinh Chủ tịch Hồ Chí Minh 19/5'],
            daoDuc: ['Giáo dục lòng kính yêu Bác Hồ; thực hiện tốt Năm điều Bác Hồ dạy thiếu niên, nhi đồng',
                'Giáo dục học sinh trung thực trong kiểm tra, đánh giá',
                'Giáo dục an toàn trong dịp hè: phòng chống đuối nước, tai nạn giao thông, tai nạn thương tích'],
            hocTap: ['Ôn tập tổng hợp, kiểm tra định kì cuối năm các môn theo quy định',
                'Nhận xét, đánh giá cuối năm; hoàn thiện học bạ và hồ sơ học sinh'],
            hoatDong: ['Tham gia các hoạt động kỷ niệm Ngày sinh Bác Hồ 19/5',
                'Họp phụ huynh cuối năm; đề nghị khen thưởng học sinh',
                'Bàn giao học sinh, hồ sơ cho giáo viên năm học sau'],
            tuan: [['Ôn tập tổng hợp chuẩn bị kiểm tra cuối năm', 'Giáo dục trung thực trong kiểm tra'],
                ['Kiểm tra định kì cuối năm', 'Nhận xét, đánh giá cuối năm'],
                ['Tham gia hoạt động kỷ niệm Ngày sinh Bác Hồ 19/5', 'Hoàn thiện học bạ, hồ sơ cuối năm'],
                ['Họp phụ huynh cuối năm, đề nghị khen thưởng', 'Giáo dục an toàn trong dịp hè; bàn giao học sinh']]
        }
    };

    function hk(thang) { return (thang >= 8 || thang === 1) ? 'hk1' : 'hk2'; }

    // ---------- đọc ngữ cảnh ----------
    const THU = ['NHẤT', 'HAI', 'BA', 'TƯ', 'NĂM', 'SÁU', 'BẢY', 'TÁM', 'CHÍN', 'MƯỜI'];

    function docThang(state) {
        const tg = String(state.thoiGian || '');
        let m = tg.match(/tháng\s*(\d{1,2})/i);
        if (m) return parseInt(m[1], 10);
        const th = String(state.thang || '').toUpperCase();
        m = th.match(/THÁNG\s*(\d{1,2})/);
        if (m) return parseInt(m[1], 10);
        m = th.match(/THÁNG THỨ\s*([A-ZĂÂĐÊÔƠƯÁÀẢÃẠẤẦẨẪẬẮẰẲẴẶÉÈẺẼẸẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌỐỒỔỖỘỚỜỞỠỢÚÙỦŨỤỨỪỬỮỰÝỲỶỸỴ]+)/);
        if (m) {
            const i = THU.indexOf(m[1]);
            if (i >= 0) { const v = 8 + i; return v > 12 ? v - 12 : v; }
        }
        return null;
    }

    function docLanHop(state) {
        const m = String(state.thang || '').match(/(\d+)/);
        return m ? parseInt(m[1], 10) : 1;
    }

    function docKhoi(lop) {
        const m = String(lop || '').match(/^\s*(\d)/);
        const k = m ? parseInt(m[1], 10) : null;
        return k >= 1 && k <= 5 ? k : null;
    }

    function docSo(state) {
        const n = state.nums || {};
        const g = (...names) => { for (const x of names) { const v = num(n[x]); if (v !== null) return v; } return null; };
        const kq = bangKetQua(state);
        return {
            tongSo: g('tong_so') ?? (kq.mon ? kq.siSo : null) ?? (state.siSoKy1 || null),
            nu: g('nu'),
            danToc: g('dan_toc'),
            khuyetTat: g('khuyet_tat'),
            hoNgheo: g('ho_ngheo'),
            hoCanNgheo: g('ho_can_ngheo'),
            khoKhan: g('hs_kho_khan', 'con_gddacbiet'),
            luuBan: g('luu_ban'),
            conLs: g('con_ls'),
            conTb: g('con_tb'),
            moCoi: g('con_mocoi')
        };
    }

    const NLPC_TEN = {
        nl_tcth: 'Tự chủ và tự học', nl_gtht: 'Giao tiếp và hợp tác', nl_gqvdst: 'Giải quyết vấn đề và sáng tạo',
        nl_nn: 'Ngôn ngữ', nl_tt: 'Tính toán', nl_kh: 'Khoa học', nl_tm: 'Thẩm mĩ', nl_tc: 'Thể chất',
        pc_yn: 'Yêu nước', pc_nhanai: 'Nhân ái', pc_chamchi: 'Chăm chỉ', pc_trungthuc: 'Trung thực', pc_trachnhiem: 'Trách nhiệm'
    };

    /** Gom số liệu bảng kết quả (Sơ kết HKI / Tổng kết năm) → {nlpc:{ten:{T,D,C}}, mon:{ten:{HTT,HT,CHT,TS}}, siSo}. */
    function bangKetQua(state) {
        const out = { nlpc: null, mon: null, siSo: null };
        for (const t of (state.tables || [])) {
            if (t.kind === 'nlpc') {
                const r = t.rows || {};
                const T = r['Tốt'] || [], D = r['Đạt'] || [], C = r['Cần cố gắng'] || [];
                const obj = {};
                let co = false;
                (t.cols || []).forEach((c, i) => {
                    const v = { T: num(T[i]), D: num(D[i]), C: num(C[i]) };
                    if (v.T !== null || v.D !== null || v.C !== null) co = true;
                    obj[c] = v;
                });
                if (co) out.nlpc = obj;
            } else if (t.kind === 'mon') {
                const r = t.rows || {};
                const TS = r['T.số'] || [], A = r['HTT'] || [], B = r['HT'] || [], C = r['CHT'] || [];
                const obj = {};
                let co = false;
                (t.cols || []).forEach((c, i) => {
                    const v = { TS: num(TS[i]), HTT: num(A[i]), HT: num(B[i]), CHT: num(C[i]) };
                    if ((v.HTT || 0) + (v.HT || 0) + (v.CHT || 0) > 0) co = true;
                    obj[c] = v;
                });
                if (co) {
                    out.mon = obj;
                    out.siSo = Math.max(...Object.values(obj).map(v => v.TS || ((v.HTT || 0) + (v.HT || 0) + (v.CHT || 0))));
                }
            }
        }
        return out;
    }

    function buildCtx(state, opts) {
        opts = opts || {};
        const khoi = docKhoi(state.lop) || 3;
        const traits = new Set(opts.traits || TRAITS.filter(t => t.macDinh).map(t => t.id));
        const so = docSo(state);
        if (so.danToc > 0) traits.add('dan_toc');
        if (so.khuyetTat > 0) traits.add('hoa_nhap');
        return {
            mau: state.mau, section: state.section, lop: state.lop || '', khoi,
            thang: docThang(state), lanHop: docLanHop(state),
            so, traits, kq: bangKetQua(state), weeks: state.weeks || [],
            seed: opts.seed || 0
        };
    }

    // ---------- các mục được hỗ trợ ----------
    const SECTIONS = {
        '1|Kế hoạch năm': 'm1_kh_nam',
        '1|Kế hoạch tháng': 'm1_kh_thang',
        '2|Đặc điểm tình hình': 'm2_dac_diem',
        '2|Nội dung kế hoạch': 'm2_nd_kh',
        '2|Nội dung hoạt động tháng': 'm2_thang',
        '2|Sơ kết học kỳ I': 'm2_so_ket',
        '2|Phương hướng HKII': 'm2_hk2',
        '2|Tổng kết năm học': 'm2_tong_ket',
        '2|Nội dung họp': 'm2_hop_ph'
    };

    const DANH_SACH_MUC = {
        1: ['Kế hoạch năm', 'Kế hoạch tháng'],
        2: ['Sơ đồ lớp', 'Đặc điểm tình hình', 'Nội dung kế hoạch', 'Nội dung hoạt động tháng', 'Sơ kết học kỳ I',
            'Phương hướng HKII', 'Tổng kết năm học', 'Nội dung họp']
    };

    function sectionId(state) {
        return SECTIONS[(state.mau || 1) + '|' + String(state.section || '').trim()] || null;
    }

    // Nhãn dễ hiểu cho các ô của "Nội dung kế hoạch" (Mẫu 2) theo thứ tự trên trang
    const ND_KH = {
        'chi_tieu#0': '1.1. Duy trì số lượng: chỉ tiêu',
        'giai_phap#0': '1.2. Duy trì số lượng: nhiệm vụ và giải pháp',
        'giai_phap#1': '2.1. Phẩm chất, năng lực: nhiệm vụ và giải pháp',
        'giai_phap#2': '2.2. Học tập: nhiệm vụ và giải pháp',
        'chi_tieu#1': '2.3. Vở sạch, chữ đẹp: chỉ tiêu',
        'giai_phap#3': '2.3. Vở sạch, chữ đẹp: nhiệm vụ và giải pháp',
        'chi_tieu#2': '3.1. Hoạt động ngoài giờ lên lớp: chỉ tiêu',
        'giai_phap#4': '3.1. Hoạt động ngoài giờ lên lớp: nhiệm vụ và giải pháp',
        'chi_tieu#3': '3.2. Trang trí lớp, bảo quản cơ sở vật chất: chỉ tiêu',
        'giai_phap#5': '3.2. Trang trí lớp, bảo quản cơ sở vật chất: nhiệm vụ và giải pháp',
        'chi_tieu#4': '3.3. Lao động, trường lớp xanh - sạch - đẹp: chỉ tiêu',
        'giai_phap#6': '3.3. Lao động, trường lớp xanh - sạch - đẹp: nhiệm vụ và giải pháp',
        'chi_tieu#5': '3.4. Xã hội hóa giáo dục: chỉ tiêu',
        'giai_phap#7': '3.4. Xã hội hóa giáo dục: nhiệm vụ và giải pháp',
        'chi_tieu#6': 'Lớp phấn đấu đạt danh hiệu'
    };

    const NHAN = {
        m1_kh_nam: { danhhieu_lop: 'Danh hiệu phấn đấu của lớp', danhhieu_chidoi: 'Danh hiệu phấn đấu của chi đội (hoặc sao)',
            tieu_chuan: 'IV. Các tiêu chuẩn khác (sức khỏe, thể chất...)', bien_phap: 'V. Các biện pháp thực hiện' },
        m1_kh_thang: { cong_viec: 'Những công việc cần thực hiện', bien_phap: 'Biện pháp tiến hành', ket_qua: 'Kết quả (cuối tháng)' },
        m2_dac_diem: { thuan_loi: '2.1. Thuận lợi', kho_khan: '2.2. Khó khăn' },
        m2_thang: { danh_gia: '1. Đánh giá công tác tháng trước', trong_tam: '2.1. Trọng tâm', gd_dao_duc: 'a. Giáo dục đạo đức',
            gd_hoc_tap: 'b. Giáo dục học tập', hoat_dong: 'c. Các hoạt động khác', ke_hoach: 'Kế hoạch tuần' },
        m2_so_ket: { si_so: '1. Công tác duy trì số lượng', gd_dao_duc: '2. Về năng lực, phẩm chất', gd_hoc_tap: '3. Về kiến thức, kĩ năng',
            chu_dep: '4. Phong trào vở sạch chữ đẹp', hoat_dong: '5. Các hoạt động khác' },
        m2_hk2: { hoat_dong: 'Phương hướng hoạt động học kì II' },
        m2_tong_ket: { nang_khieu: 'Thi học sinh năng khiếu', hoat_dong: '5. Các hoạt động khác' },
        m2_hop_ph: { noi_dung: 'Nội dung họp' }
    };

    // Ô không phải việc của giáo viên chủ nhiệm → không viết
    const BO_QUA = { m1_kh_nam: ['y_kien'] };

    function baseOf(key) { return String(key).replace(/#\d+$/, ''); }
    function idxOf(key) { return parseInt(String(key).split('#').pop(), 10) || 0; }

    /** Danh sách ô sẽ viết: [{key, label, kind, hasValue, note}] */
    function fieldsFor(state) {
        const id = sectionId(state);
        if (!id) return [];
        const skip = BO_QUA[id] || [];
        const nhan = NHAN[id] || {};
        return (state.fields || []).filter(f => {
            const b = baseOf(f.key);
            if (skip.includes(b) || f.readOnly) return false;
            if (id === 'm2_thang' && (b === 'ket_qua' || b === 'nguyen_nhan')) return false;   // cột kết quả tuần: ghi cuối tuần
            if (id === 'm2_nd_kh') return !!ND_KH[f.key];
            if (id === 'm2_thang' && b === 'ke_hoach') return true;
            return !!nhan[b];
        }).map(f => {
            const b = baseOf(f.key);
            let label = id === 'm2_nd_kh' ? ND_KH[f.key] : (nhan[b] || f.label || f.key);
            if (id === 'm2_thang' && b === 'ke_hoach') label = 'Kế hoạch ' + (f.rowLabel || ('tuần ' + (idxOf(f.key) + 1))).replace(/\s+/g, ' ').replace(/[\s\-–]+$/, '').replace(/^Tuần/, 'tuần');
            return { key: f.key, label, kind: f.kind, hasValue: f.hasValue, maxLength: f.maxLength || 0 };
        });
    }

    // ---------- soạn từng ô ----------
    function tenThang(m) { return 'tháng ' + m; }

    /** 6.3.1: giữ ĐỦ mọi ý; mỗi ý có thể có vài cách diễn đạt (mảng) — "Viết lại" chỉ đổi cách nói. */
    function du(r, arr) {
        return arr.filter(Boolean).map(x => Array.isArray(x) ? pick(r, x) : x);
    }

    function thuanLoi(c, r) {
        const k = c.khoi, t = c.traits, so = c.so;
        const out = [];
        out.push(pick(r, ['Lớp luôn được Ban giám hiệu nhà trường quan tâm, chỉ đạo sát sao; được tổ chuyên môn, giáo viên bộ môn và Tổng phụ trách Đội hỗ trợ trong công tác chủ nhiệm.',
            'Lớp được nhà trường quan tâm, tạo điều kiện thuận lợi; giáo viên chủ nhiệm nhận được sự hỗ trợ thường xuyên của tổ chuyên môn, giáo viên bộ môn và Tổng phụ trách Đội.']));
        out.push(pick(r, ['Giáo viên chủ nhiệm nhiệt tình, yêu nghề, nắm vững chương trình lớp ' + (k || '…') + '; luôn gần gũi, quan tâm đến từng học sinh.',
            'Giáo viên chủ nhiệm có tinh thần trách nhiệm, tâm huyết với nghề; nắm chắc đặc điểm tâm lí lứa tuổi và hoàn cảnh của từng học sinh.']));
        out.push(t.has('csvc_tot')
            ? 'Phòng học rộng rãi, thoáng mát, đủ ánh sáng; bàn ghế đúng quy cách; có ti vi (máy chiếu) và đồ dùng dạy học phục vụ tốt cho việc dạy và học.'
            : 'Phòng học đủ ánh sáng, thoáng mát; đủ bàn ghế cho học sinh ngồi học; đồ dùng dạy học cơ bản đáp ứng yêu cầu.');
        out.push('Học sinh có đủ sách giáo khoa, vở và đồ dùng học tập ngay từ đầu năm học.');
        if (k === 1) out.push('Phần lớn học sinh đã qua lớp mẫu giáo 5 tuổi nên mạnh dạn, hồn nhiên, có nề nếp ban đầu; nhiều em đã biết cầm bút, tô, vẽ.');
        else out.push(pick(r, ['Học sinh đã quen nề nếp học tập ở các lớp dưới; đa số các em ngoan, lễ phép, đoàn kết, có ý thức học tập tốt.',
            'Đa số học sinh ngoan, lễ phép, đoàn kết, biết giúp đỡ bạn; ban cán sự lớp, hội đồng tự quản hoạt động có nề nếp.']));
        if (k >= 2) out.push('Nhiều em có năng khiếu, ham học hỏi, tích cực tham gia các hoạt động của trường, lớp.');
        out.push(t.has('ph_quan_tam')
            ? 'Đa số phụ huynh quan tâm đến việc học của con; phối hợp chặt chẽ với giáo viên chủ nhiệm qua sổ liên lạc điện tử, điện thoại và các buổi họp phụ huynh.'
            : 'Phần lớn phụ huynh quan tâm đến việc học tập, rèn luyện của con và giữ liên lạc với giáo viên chủ nhiệm qua sổ liên lạc điện tử.');
        if (t.has('hai_buoi')) out.push('Lớp học 2 buổi/ngày nên có thêm thời gian củng cố kiến thức, rèn kĩ năng và tổ chức các hoạt động giáo dục cho học sinh.');
        if (t.has('ban_tru')) out.push('Học sinh ăn bán trú tại trường được chăm sóc chu đáo, có thời gian nghỉ trưa hợp lí, đảm bảo sức khỏe cho buổi học chiều.');
        if (so.tongSo !== null && so.tongSo !== undefined && !(so.hoNgheo || so.hoCanNgheo || so.khoKhan)) out.push('Lớp không có học sinh thuộc hộ nghèo; điều kiện học tập của các em tương đối đầy đủ.');
        return lines(out);
    }

    function khoKhan(c, r) {
        const k = c.khoi, t = c.traits, so = c.so;
        const out = [];
        const ngheoCa = (so.hoNgheo || 0) + (so.hoCanNgheo || 0);
        if (so.tongSo && ngheoCa >= so.tongSo) {
            // Số liệu vnEdu ghi cả lớp là hộ nghèo/cận nghèo — dễ là nhập nhầm, để thầy cô kiểm tra
            out.push('Lớp có … em thuộc hộ nghèo, … em thuộc hộ cận nghèo (thầy cô kiểm tra lại số liệu); điều kiện học tập ở nhà của các em còn thiếu thốn, cần được quan tâm, hỗ trợ.');
        } else if (ngheoCa > 0) {
            const a = [];
            if (so.hoNgheo) a.push(so.hoNgheo + ' em thuộc hộ nghèo');
            if (so.hoCanNgheo) a.push(so.hoCanNgheo + ' em thuộc hộ cận nghèo');
            out.push('Lớp có ' + a.join(', ') + '; điều kiện học tập ở nhà của các em còn thiếu thốn, cần được quan tâm, hỗ trợ.');
        } else if (so.khoKhan) {
            out.push('Lớp có ' + so.khoKhan + ' em có hoàn cảnh khó khăn, cần được quan tâm, động viên kịp thời.');
        }
        if (t.has('hoa_nhap') || so.khuyetTat) out.push(so.khuyetTat
            ? 'Lớp có ' + so.khuyetTat + ' em khuyết tật học hòa nhập, cần có kế hoạch giáo dục cá nhân và sự hỗ trợ riêng.'
            : 'Lớp có học sinh khuyết tật học hòa nhập, cần có kế hoạch giáo dục cá nhân và sự hỗ trợ riêng.');
        if (t.has('dan_toc')) out.push('Một số em là người dân tộc thiểu số, vốn tiếng Việt còn hạn chế, cần được hỗ trợ thêm về nghe, nói, đọc, viết.');
        if (t.has('di_lam_xa')) out.push('Một số phụ huynh đi làm ăn xa, học sinh ở với ông bà nên việc kèm cặp, nhắc nhở học bài ở nhà còn hạn chế.');
        out.push(t.has('nong_nghiep')
            ? 'Phần lớn gia đình làm nông nghiệp, lao động tự do, thời gian dành cho việc kèm cặp con học tập còn ít.'
            : pick(r, ['Một số phụ huynh bận công việc, chưa có nhiều thời gian kèm cặp, nhắc nhở con học bài ở nhà.',
                'Một số gia đình còn trông chờ vào nhà trường, chưa dành nhiều thời gian theo dõi việc học của con.']));
        if (k === 1) out.push('Học sinh mới chuyển từ mầm non lên tiểu học, chưa quen nề nếp học tập; nhiều em còn rụt rè, khả năng tập trung chưa lâu, cầm bút và ngồi viết chưa đúng tư thế.');
        else if (k <= 3) out.push(pick(r, ['Khả năng tiếp thu của học sinh chưa đồng đều; một số em đọc còn chậm, chữ viết chưa đúng mẫu, tính toán còn nhầm lẫn.',
            'Chất lượng học tập chưa đồng đều; một số em chưa tự giác học bài, kĩ năng đọc, viết, tính toán còn hạn chế.']));
        else out.push(pick(r, ['Kiến thức các môn ngày càng nhiều và khó; một số em kĩ năng tính toán, viết đoạn văn, bài văn còn hạn chế, chưa tự giác học bài.',
            'Một số em chưa có phương pháp tự học; kĩ năng trình bày, diễn đạt và giải toán có lời văn còn hạn chế.']));
        out.push(pick(r, ['Một số em còn ham chơi, mải xem điện thoại, ti vi; ý thức tự giác giữ gìn sách vở, đồ dùng chưa cao.',
            'Một số em còn nói chuyện riêng, chưa tập trung trong giờ học; việc giữ gìn sách vở, đồ dùng học tập chưa cẩn thận.']));
        if (so.tongSo && so.tongSo >= 35) out.push('Sĩ số lớp đông (' + so.tongSo + ' em) nên việc quan tâm, kèm cặp đến từng học sinh còn gặp khó khăn.');
        return lines(out);
    }

    function siSoChiTieu(c) {
        const n = c.so.tongSo;
        return lines([
            n ? 'Duy trì sĩ số: ' + n + '/' + n + ' em, đạt 100%.' : 'Duy trì sĩ số đạt 100%.',
            'Không có học sinh bỏ học; tỉ lệ đi học chuyên cần đạt từ 98% trở lên.',
            'Học sinh nghỉ học đều có lí do, có giấy phép hoặc được phụ huynh báo kịp thời.'
        ]);
    }

    function siSoGiaiPhap(c, r) {
        return lines(du(r, [
            ['Theo dõi chuyên cần hằng ngày; học sinh nghỉ học phải liên hệ ngay với phụ huynh để nắm rõ lí do.',
                'Điểm danh, theo dõi chuyên cần hằng ngày; khi học sinh nghỉ học, liên hệ ngay với gia đình để biết lí do.'],
            ['Xây dựng lớp học thân thiện, mỗi ngày đến trường là một ngày vui để học sinh thích đến lớp.',
                'Tạo không khí lớp học vui vẻ, thân thiện, tổ chức nhiều hoạt động hấp dẫn để học sinh thích đến trường.'],
            'Quan tâm, động viên học sinh có hoàn cảnh khó khăn; phối hợp với nhà trường, Ban đại diện cha mẹ học sinh hỗ trợ kịp thời.',
            'Thăm hỏi học sinh ốm đau; giúp các em học bù bài khi nghỉ học.',
            c.traits.has('di_lam_xa') ? 'Giữ liên lạc thường xuyên với ông bà, người trực tiếp chăm sóc học sinh có bố mẹ đi làm xa.' : null
        ]));
    }

    function giaiPhapPcNl(c, r) {
        return lines(du(r, [
            ['Giáo dục phẩm chất, năng lực cho học sinh qua từng môn học, hoạt động trải nghiệm, sinh hoạt dưới cờ và sinh hoạt lớp.',
                'Lồng ghép giáo dục phẩm chất, năng lực vào các môn học, hoạt động trải nghiệm, sinh hoạt dưới cờ và sinh hoạt lớp.'],
            c.khoi === 1
                ? 'Hướng dẫn học sinh từng bước làm quen nề nếp: chào hỏi, xếp hàng, giữ trật tự, tự sắp xếp đồ dùng học tập.'
                : ['Xây dựng nội quy lớp học cùng học sinh; duy trì hội đồng tự quản, phân công nhiệm vụ cụ thể để học sinh rèn tính tự chủ, trách nhiệm.',
                    'Cùng học sinh xây dựng nội quy lớp; phát huy vai trò hội đồng tự quản, giao việc cụ thể để các em rèn tính tự chủ, trách nhiệm.'],
            ['Tổ chức học nhóm, đôi bạn cùng tiến để học sinh rèn kĩ năng giao tiếp, hợp tác.',
                'Tăng cường hoạt động nhóm, đôi bạn cùng tiến giúp học sinh rèn kĩ năng giao tiếp, hợp tác, giải quyết vấn đề.'],
            ['Quan sát, nhận xét thường xuyên; động viên, khen ngợi kịp thời từng tiến bộ của học sinh.',
                'Thường xuyên quan sát, nhận xét bằng lời; khen ngợi kịp thời để học sinh tự tin, cố gắng hơn.'],
            'Giáo viên luôn gương mẫu trong lời nói, việc làm để học sinh noi theo.',
            'Phối hợp với phụ huynh rèn cho học sinh thói quen tự phục vụ, giúp đỡ gia đình những việc vừa sức.'
        ]));
    }

    function giaiPhapHocTap(c, r) {
        const ht = HOC_TAP[c.khoi];
        const out = du(r, [
            ['Nắm chắc năng lực của từng học sinh để dạy học phù hợp; quan tâm đặc biệt học sinh còn chậm, bồi dưỡng học sinh có năng khiếu.',
                'Khảo sát, nắm chắc năng lực từng học sinh ngay từ đầu năm để có biện pháp dạy học phù hợp; phụ đạo học sinh còn chậm, bồi dưỡng học sinh có năng khiếu.'],
            ['Đổi mới phương pháp dạy học, tăng cường đồ dùng trực quan và hoạt động thực hành để học sinh hứng thú.',
                'Vận dụng phương pháp dạy học tích cực, sử dụng đồ dùng trực quan, tăng cường thực hành để học sinh hứng thú học tập.'],
            'Kiểm tra, nhận xét vở và bài làm thường xuyên; chỉ rõ chỗ đúng, chỗ cần sửa để học sinh tiến bộ.',
            'Duy trì nề nếp truy bài đầu giờ, đôi bạn cùng tiến; ban cán sự lớp hỗ trợ kiểm tra bài.',
            'Phối hợp với giáo viên bộ môn và phụ huynh theo dõi, giúp đỡ học sinh học tập.',
            'Đánh giá học sinh theo đúng quy định hiện hành; thông tin kết quả học tập tới phụ huynh qua sổ liên lạc điện tử.'
        ]);
        out.push('Trọng tâm học kì I: ' + ht.hk1.join('; ') + '.');
        return lines(out);
    }

    function vsChiTieu(c) {
        const tl = c.khoi === 1 ? 60 : 70;
        return lines(['100% học sinh có đủ vở theo quy định, giữ vở sạch sẽ, có nhãn vở, bìa bọc.',
            '100% học sinh viết đúng mẫu chữ, đúng tư thế; phấn đấu từ ' + tl + '% học sinh trở lên đạt vở sạch, chữ đẹp.',
            'Lớp tham gia đầy đủ phong trào, hội thi viết chữ đẹp do nhà trường tổ chức.']);
    }

    function vsGiaiPhap(c, r) {
        return lines(du(r, [
            'Hướng dẫn học sinh tư thế ngồi viết, cách cầm bút, cách đặt vở đúng quy định.',
            ['Giáo viên viết mẫu chuẩn trên bảng; uốn nắn kịp thời từng nét chữ cho học sinh.',
                'Giáo viên luôn viết mẫu đúng, đẹp trên bảng và trong vở học sinh; sửa kịp thời từng nét chữ chưa đúng.'],
            'Kiểm tra vở hằng ngày, nhắc nhở học sinh giữ vở sạch, không tẩy xóa, không quăn góc.',
            ['Tổ chức thi đua vở sạch chữ đẹp hằng tháng; trưng bày, tuyên dương vở đẹp trước lớp.',
                'Hằng tháng chấm, trưng bày vở sạch chữ đẹp; tuyên dương học sinh có tiến bộ trong giờ sinh hoạt lớp.'],
            'Đề nghị phụ huynh nhắc nhở, kiểm tra việc luyện viết của con ở nhà.'
        ]));
    }

    function ngllChiTieu(c) {
        const ds = c.khoi <= 3 ? 'Sao nhi đồng' : 'Liên đội';
        return lines(['100% học sinh tham gia đầy đủ các hoạt động trải nghiệm, ngoại khóa, sinh hoạt tập thể do nhà trường và ' + ds + ' tổ chức.',
            'Lớp tham gia đầy đủ các hội thi, phong trào thi đua theo chủ điểm hằng tháng.',
            'Học sinh được giáo dục kĩ năng sống, an toàn giao thông, phòng tránh tai nạn thương tích, đuối nước.']);
    }

    function ngllGiaiPhap(c, r) {
        return lines(du(r, [
            ['Thực hiện tốt các chủ điểm hằng tháng gắn với các ngày lễ lớn trong năm.',
                'Tổ chức hoạt động theo chủ điểm hằng tháng, gắn với các ngày lễ lớn trong năm học.'],
            'Tổ chức múa hát sân trường, trò chơi dân gian, đọc sách thư viện vào các tiết hoạt động.',
            c.khoi <= 3 ? 'Hướng dẫn phụ trách Sao sinh hoạt Sao đúng nội dung, nề nếp.' : 'Phối hợp với Tổng phụ trách Đội tổ chức sinh hoạt chi đội đúng nội dung, nề nếp.',
            'Phát hiện, phân công học sinh có năng khiếu tham gia văn nghệ, thể thao của trường.',
            'Giáo dục kĩ năng sống, an toàn giao thông, phòng tránh tai nạn thương tích qua các hoạt động trải nghiệm.'
        ]));
    }

    function csvcChiTieu() {
        return lines(['Lớp học được trang trí đúng quy định, sạch đẹp, thân thiện.',
            '100% học sinh có ý thức giữ gìn, bảo quản bàn ghế, đồ dùng của lớp; không để hư hỏng do học sinh gây ra.',
            'Sách giáo khoa, đồ dùng học tập của học sinh được giữ gìn cẩn thận, dùng được lâu.']);
    }

    function csvcGiaiPhap(c, r) {
        return lines(du(r, [
            'Trang trí lớp học theo hướng dẫn của nhà trường: ảnh Bác Hồ, Năm điều Bác Hồ dạy, góc học tập, góc thư viện của lớp.',
            ['Phân công tổ trực nhật, kiểm tra vệ sinh và bàn ghế hằng ngày.',
                'Phân công học sinh trực nhật theo tổ; hằng ngày kiểm tra vệ sinh, sắp xếp bàn ghế ngay ngắn.'],
            'Giáo dục học sinh không viết, vẽ bậy lên bàn ghế, tường lớp; tắt điện, quạt khi ra về.',
            'Kịp thời báo cáo nhà trường khi cơ sở vật chất của lớp hư hỏng.'
        ]));
    }

    function laoDongChiTieu() {
        return lines(['100% học sinh tham gia trực nhật, lao động vệ sinh lớp học, khu vực được phân công.',
            'Lớp luôn sạch sẽ, có cây xanh hoặc chậu hoa; góp phần xây dựng trường lớp xanh - sạch - đẹp.']);
    }

    function laoDongGiaiPhap(c, r) {
        return lines(du(r, [
            ['Phân công trực nhật theo tổ, theo ngày; ban cán sự lớp kiểm tra, nhắc nhở.',
                'Lập lịch trực nhật theo tổ, theo ngày; ban cán sự lớp kiểm tra, nhắc nhở các bạn thực hiện.'],
            'Tổ chức lao động vệ sinh lớp học, chăm sóc cây xanh vào cuối tuần.',
            'Giáo dục học sinh bỏ rác đúng nơi quy định, tiết kiệm điện, nước.',
            'Phân công công việc vừa sức, đảm bảo an toàn cho học sinh khi lao động.'
        ]));
    }

    function xhhChiTieu() {
        return lines(['Phối hợp với Ban đại diện cha mẹ học sinh chăm lo điều kiện học tập, khen thưởng học sinh.',
            'Mọi khoản đóng góp (nếu có) đều trên tinh thần tự nguyện, công khai, đúng quy định.']);
    }

    function xhhGiaiPhap(c, r) {
        return lines(du(r, [
            'Họp phụ huynh đầu năm để thống nhất kế hoạch phối hợp giáo dục học sinh.',
            ['Vận động phụ huynh, các nhà hảo tâm hỗ trợ học sinh có hoàn cảnh khó khăn.',
                'Phối hợp Ban đại diện cha mẹ học sinh vận động hỗ trợ sách vở, đồ dùng cho học sinh có hoàn cảnh khó khăn.'],
            'Công khai, minh bạch các khoản thu, chi của lớp (nếu có) theo đúng quy định.',
            'Thường xuyên trao đổi với phụ huynh qua sổ liên lạc điện tử để cùng giáo dục học sinh.'
        ]));
    }

    function danhHieuLop() { return 'Tập thể lớp Tiên tiến.'; }

    function danhHieuDoi(c) {
        if (c.khoi <= 2) return 'Sao nhi đồng chăm ngoan.';
        if (c.khoi === 3) return 'Sao nhi đồng chăm ngoan; phấn đấu 100% học sinh đủ điều kiện được kết nạp vào Đội Thiếu niên Tiền phong Hồ Chí Minh.';
        return 'Chi đội vững mạnh.';
    }

    function danhHieuMau2(c) {
        return lines([danhHieuLop(), c.khoi <= 3 ? danhHieuDoi(c) : 'Chi đội vững mạnh.']);
    }

    function tieuChuanKhac(c, r) {
        return lines(du(r, [
            '100% học sinh được khám sức khỏe định kì, theo dõi cân nặng, chiều cao theo kế hoạch của nhà trường.',
            '100% học sinh giữ gìn vệ sinh cá nhân, ăn mặc gọn gàng, sạch sẽ khi đến lớp.',
            'Học sinh tập thể dục giữa giờ, tham gia các trò chơi vận động đều đặn.',
            'Không có học sinh bị tai nạn thương tích, đuối nước do thiếu sự quan tâm, nhắc nhở.',
            'Học sinh biết phòng tránh các bệnh thường gặp theo mùa.',
            c.traits.has('ban_tru') ? 'Học sinh ăn bán trú ăn uống đủ chất, ngủ trưa đúng giờ, đảm bảo vệ sinh an toàn thực phẩm.' : null
        ]));
    }

    function bienPhapNam(c, r) {
        const out = [];
        const nhom = (ten, arr) => { out.push('* ' + ten + ':'); out.push(...du(r, arr).map(s => '- ' + cham(s))); };
        nhom('Về dạy và học', [
            ['Nắm chắc năng lực từng học sinh để dạy học phù hợp; phụ đạo học sinh còn chậm, bồi dưỡng học sinh có năng khiếu.',
                'Khảo sát chất lượng đầu năm, nắm chắc từng đối tượng học sinh; phụ đạo học sinh còn chậm, bồi dưỡng học sinh có năng khiếu.'],
            'Đổi mới phương pháp, tăng cường hoạt động thực hành, đồ dùng trực quan.',
            'Duy trì truy bài đầu giờ, đôi bạn cùng tiến; kiểm tra, nhận xét vở thường xuyên.',
            'Đánh giá học sinh theo đúng quy định hiện hành; thông tin kịp thời tới phụ huynh.']);
        nhom('Về giáo dục đạo đức', [
            'Giáo dục học sinh thực hiện tốt Năm điều Bác Hồ dạy, nội quy nhà trường.',
            'Giáo dục qua các chủ điểm hằng tháng, sinh hoạt dưới cờ, sinh hoạt lớp.',
            ['Khen ngợi kịp thời việc tốt; nhắc nhở nhẹ nhàng, gần gũi khi học sinh mắc lỗi.',
                'Tuyên dương kịp thời việc làm tốt; uốn nắn nhẹ nhàng, kiên trì khi học sinh mắc lỗi.']]);
        nhom('Về hoạt động ngoài giờ lên lớp', [
            'Tổ chức múa hát sân trường, trò chơi dân gian, thể dục giữa giờ.',
            'Tham gia đầy đủ hoạt động trải nghiệm, ngoại khóa do nhà trường tổ chức; đảm bảo an toàn cho học sinh.']);
        nhom('Về xây dựng nề nếp', [
            'Xây dựng nội quy lớp, bầu ban cán sự lớp, hội đồng tự quản hoạt động hiệu quả.',
            'Duy trì nề nếp ra vào lớp, giữ trật tự, giữ vệ sinh chung.',
            'Phối hợp chặt chẽ với phụ huynh trong giáo dục học sinh.']);
        return out.join('\n');
    }

    // ----- theo tháng -----
    function thangData(c) {
        const m = c.thang && THANG[c.thang] ? c.thang : null;
        return m ? THANG[m] : null;
    }

    function hocTapThang(c, T) {
        const ht = HOC_TAP[c.khoi][hk(c.thang)];
        return T.hocTap.concat(ht);
    }

    function trongTam(c, r) {
        const T = thangData(c); if (!T) return '';
        const out = ['Chủ điểm: “' + T.chuDiem + '”.'].concat(T.trongTam);
        out.push(pick(r, ['Phối hợp chặt chẽ với phụ huynh, giáo viên bộ môn trong giáo dục học sinh',
            'Tăng cường trao đổi với phụ huynh qua sổ liên lạc điện tử về học tập, rèn luyện của học sinh']));
        out.push('Đảm bảo an toàn tuyệt đối cho học sinh trong các hoạt động của lớp, của trường');
        return lines(out);
    }

    function gdDaoDuc(c, r) {
        const T = thangData(c); if (!T) return '';
        const out = T.daoDuc.slice();
        out.push(pick(r, ['Nhắc nhở học sinh thực hiện tốt nội quy lớp, nói lời hay, làm việc tốt; tuyên dương kịp thời học sinh có việc làm tốt trong giờ sinh hoạt lớp',
            'Duy trì phong trào “Nói lời hay, làm việc tốt”; tuyên dương kịp thời học sinh có việc làm tốt trong giờ sinh hoạt lớp']));
        out.push(pick(r, ['Quan tâm, uốn nắn kịp thời học sinh còn vi phạm nội quy; trao đổi với gia đình để cùng giáo dục',
            'Gần gũi, nhắc nhở nhẹ nhàng học sinh còn mắc lỗi; phối hợp với gia đình để giúp các em tiến bộ']));
        return lines(out);
    }

    function gdHocTap(c, r) {
        const T = thangData(c); if (!T) return '';
        const out = hocTapThang(c, T);
        out.push(pick(r, ['Duy trì truy bài đầu giờ; ban cán sự lớp kiểm tra bài, vở của các bạn',
            'Duy trì truy bài đầu giờ, đôi bạn cùng tiến; nhóm trưởng kiểm tra việc chuẩn bị bài của các bạn']));
        out.push('Kiểm tra, nhận xét vở và bài làm hằng ngày; khen ngợi, động viên kịp thời từng tiến bộ của học sinh');
        out.push('Rèn chữ viết, giữ vở sạch; nhắc nhở học sinh chuẩn bị đầy đủ sách vở, đồ dùng trước khi đến lớp');
        if (c.traits.has('hai_buoi')) out.push('Buổi chiều tập trung củng cố kiến thức, rèn kĩ năng còn yếu cho từng nhóm học sinh');
        return lines(out);
    }

    function hoatDongThang(c, r) {
        const T = thangData(c); if (!T) return '';
        const out = T.hoatDong.slice();
        out.push(c.khoi <= 3 ? 'Duy trì sinh hoạt Sao nhi đồng theo chủ điểm tháng' : 'Duy trì sinh hoạt chi đội theo chủ điểm tháng');
        out.push('Thực hiện tốt thể dục giữa giờ, múa hát sân trường; trực nhật, giữ vệ sinh lớp học sạch sẽ');
        out.push('Sinh hoạt lớp cuối tuần: nhận xét thi đua, tuyên dương học sinh tiến bộ, phổ biến kế hoạch tuần sau');
        return lines(out);
    }

    /** Mẫu 1: "Những công việc cần thực hiện" gộp trọng tâm + các mặt giáo dục. */
    function congViecThang(c, r) {
        const T = thangData(c); if (!T) return '';
        const out = ['* Chủ điểm: “' + T.chuDiem + '”.'];
        out.push(...T.trongTam.map(s => '- ' + s + '.'));
        out.push('* Giáo dục đạo đức:');
        out.push(...T.daoDuc.map(s => '- ' + s + '.'));
        out.push('* Học tập:');
        out.push(...hocTapThang(c, T).map(s => '- ' + s + '.'));
        out.push('- Kiểm tra, nhận xét vở hằng ngày; rèn chữ viết, giữ vở sạch.');
        out.push('* Hoạt động khác:');
        out.push(...T.hoatDong.map(s => '- ' + s + '.'));
        out.push('- ' + (c.khoi <= 3 ? 'Duy trì sinh hoạt Sao nhi đồng' : 'Duy trì sinh hoạt chi đội') + '; thể dục giữa giờ, trực nhật vệ sinh lớp học.');
        out.push('* Phối hợp với phụ huynh:');
        out.push('- Trao đổi thường xuyên qua sổ liên lạc điện tử về học tập, rèn luyện, sức khỏe của học sinh.');
        return out.join('\n');
    }

    function bienPhapThang(c, r) {
        const T = thangData(c); if (!T) return '';
        return lines(du(r, [
            ['Phổ biến kế hoạch tháng tới toàn lớp trong tiết sinh hoạt đầu tháng; phân công cụ thể cho ban cán sự lớp, các tổ.',
                'Đầu tháng phổ biến kế hoạch tới học sinh; giao nhiệm vụ cụ thể cho ban cán sự lớp, hội đồng tự quản và các tổ.'],
            'Theo dõi chuyên cần, nề nếp hằng ngày; liên hệ phụ huynh ngay khi học sinh nghỉ học.',
            ['Dạy học phù hợp với từng đối tượng; dành thời gian kèm cặp học sinh còn chậm vào cuối buổi học.',
                'Dạy học sát đối tượng; kèm cặp học sinh còn chậm trong giờ học và cuối buổi; giao thêm bài cho học sinh có năng khiếu.'],
            'Nhận xét, động viên kịp thời từng tiến bộ của học sinh; tuyên dương trong giờ sinh hoạt lớp.',
            'Phối hợp với giáo viên bộ môn, Tổng phụ trách Đội và phụ huynh trong giáo dục học sinh.',
            'Lồng ghép giáo dục theo chủ điểm “' + T.chuDiem + '” vào các môn học, hoạt động trải nghiệm.',
            'Cuối tháng sơ kết thi đua, đánh giá việc thực hiện kế hoạch, rút kinh nghiệm cho tháng sau.'
        ]));
    }

    function siSoDong(c) {
        const n = c.so.tongSo;
        return n ? 'Duy trì sĩ số: ' + n + '/' + n + ' em, đạt 100%.' : 'Duy trì sĩ số: …/… em, đạt …%.';
    }

    /** Khung đánh giá cuối tháng — chỗ chỉ thầy cô biết để dấu "…". */
    function ketQuaThang(c, r) {
        const T = thangData(c); if (!T) return '';
        return [
            '- ' + siSoDong(c) + ' Chuyên cần: số lượt nghỉ học … (có phép …, không phép …).',
            '- Nề nếp: lớp thực hiện tốt nội quy, nề nếp ra vào lớp, truy bài đầu giờ; thực hiện tốt chủ điểm “' + T.chuDiem + '”.',
            '- Học tập: đa số học sinh hoàn thành nội dung học tập trong tháng; chữ viết, vở sạch có tiến bộ.',
            '- Phẩm chất, năng lực: học sinh ngoan, lễ phép, đoàn kết; tích cực tham gia hoạt động nhóm.',
            '- Hoạt động, phong trào: tham gia đầy đủ các hoạt động do nhà trường tổ chức; vệ sinh lớp học sạch sẽ.',
            '- Học sinh tiến bộ, được tuyên dương: …',
            '- Học sinh cần giúp đỡ thêm (học tập, nề nếp): …',
            '- Tồn tại và hướng khắc phục: …'
        ].join('\n');
    }

    function thangTruoc(m) { return m === 1 ? 12 : m - 1; }

    function danhGiaThangTruoc(c, r) {
        if (!c.thang) return '';
        const mt = thangTruoc(c.thang);
        const T = THANG[mt];
        if (!T) return '';
        const hd = T.hoatDong.map(x => x.charAt(0).toLowerCase() + x.slice(1)).join('; ');
        return [
            '* Những việc đã làm được:',
            '- ' + siSoDong(c),
            '- Thực hiện chủ điểm tháng ' + mt + ' “' + T.chuDiem + '”: ' + hd + '.',
            '- Học sinh thực hiện tốt nề nếp lớp học, truy bài đầu giờ; trực nhật, vệ sinh lớp học sạch sẽ.',
            '- Học tập: đa số học sinh hoàn thành nội dung học tập của tháng; đôi bạn cùng tiến duy trì đều đặn.',
            '- Phối hợp tốt với phụ huynh trong theo dõi, giáo dục học sinh.',
            '- Học sinh tiến bộ, được tuyên dương: …',
            '* Những việc chưa làm được:',
            '- Một số em còn chưa tập trung, chưa tự giác học bài: …',
            '- Chữ viết, vở sạch của một số em chưa tiến bộ: …',
            '* Nguyên nhân:',
            '- …',
            '* Biện pháp khắc phục trong tháng ' + c.thang + ':',
            '- Tiếp tục kèm cặp, nhắc nhở học sinh còn hạn chế; trao đổi với phụ huynh để cùng giúp đỡ các em.'
        ].join('\n');
    }

    /** Kế hoạch từng tuần (bảng "KẾ HOẠCH HÀNG TUẦN CỦA THÁNG"). */
    function keHoachTuan(c, r, key) {
        const T = thangData(c); if (!T) return '';
        const i = idxOf(key);
        const viec = T.tuan[i] || ['Ôn tập, củng cố kiến thức trong tháng', 'Sơ kết thi đua tháng, chuẩn bị kế hoạch tháng sau'];
        return lines(['Thực hiện chương trình theo kế hoạch dạy học của tuần.']
            .concat(viec.map(s => s + '.'))
            .concat(['Duy trì nề nếp, chuyên cần; kèm cặp học sinh còn chậm.',
                'Sinh hoạt lớp cuối tuần: nhận xét, tuyên dương; phổ biến kế hoạch tuần sau.']));
    }

    // ----- Sơ kết HKI / Tổng kết năm -----
    function nlpcTomTat(c, nhom) {
        const kq = c.kq.nlpc;
        if (!kq) return null;
        const keys = Object.keys(kq).filter(k => k.startsWith(nhom));
        const data = keys.map(k => {
            const v = kq[k];
            const tong = (v.T || 0) + (v.D || 0) + (v.C || 0);
            return { ten: NLPC_TEN[k] || k, T: v.T || 0, C: v.C || 0, tong };
        }).filter(x => x.tong > 0);
        if (!data.length) return null;
        const tl = data.map(x => ({ ...x, p: x.T / x.tong }));
        tl.sort((a, b) => a.p - b.p);
        const thap = tl[0], cao = tl[tl.length - 1];
        const ccg = data.filter(x => x.C > 0);
        let s = 'mức Tốt từ ' + pct(thap.T, thap.tong) + ' (' + thap.ten + ') đến ' + pct(cao.T, cao.tong) + ' (' + cao.ten + ')';
        if (thap.ten === cao.ten || pct(thap.T, thap.tong) === pct(cao.T, cao.tong)) s = 'mức Tốt đạt ' + pct(cao.T, cao.tong) + ' ở tất cả các nội dung';
        s += ccg.length
            ? '; còn học sinh cần cố gắng về ' + ccg.map(x => x.ten.toLowerCase() + ' (' + x.C + ' em)').join(', ')
            : '; không có học sinh xếp mức Cần cố gắng';
        return s;
    }

    function soKetNlpc(c, r, cuoiNam) {
        const pc = nlpcTomTat(c, 'pc_');
        const nl = nlpcTomTat(c, 'nl_');
        const out = [];
        out.push(pc ? 'Phẩm chất: ' + pc + '.' : 'Phẩm chất: mức Tốt … em (…%), mức Đạt … em (…%), Cần cố gắng … em.');
        out.push(nl ? 'Năng lực: ' + nl + '.' : 'Năng lực: mức Tốt … em (…%), mức Đạt … em (…%), Cần cố gắng … em.');
        out.push(pick(r, ['Đa số học sinh ngoan, lễ phép, đoàn kết, biết giúp đỡ bạn; có ý thức tự giác trong học tập và sinh hoạt.',
            'Học sinh chăm chỉ, trung thực, biết yêu thương, giúp đỡ bạn bè; nhiều em mạnh dạn, tự tin khi trình bày ý kiến.']));
        out.push(cuoiNam ? 'Một số em còn chưa tự giác, cần gia đình tiếp tục nhắc nhở trong dịp hè.'
            : 'Một số em còn chưa tập trung, chưa tự giác hoàn thành nhiệm vụ; cần tiếp tục rèn luyện trong học kì II.');
        return lines(out);
    }

    const MON_CHINH = ['Tiếng Việt', 'Toán'];

    function soKetMon(c, r, cuoiNam) {
        const kq = c.kq.mon;
        if (!kq) {
            return lines(['Tiếng Việt: Hoàn thành tốt … em (…%), Hoàn thành … em (…%), Chưa hoàn thành … em.',
                'Toán: Hoàn thành tốt … em (…%), Hoàn thành … em (…%), Chưa hoàn thành … em.',
                'Các môn học và hoạt động giáo dục khác: …',
                'Học sinh chưa hoàn thành: … (ghi tên, môn) — có kế hoạch phụ đạo.']);
        }
        const out = [];
        const tong = v => (v.HTT || 0) + (v.HT || 0) + (v.CHT || 0);
        const moTa = (ten, v) => {
            const n = tong(v);
            let s = ten + ': Hoàn thành tốt ' + (v.HTT || 0) + ' em (' + pct(v.HTT || 0, n) + '), Hoàn thành ' + (v.HT || 0) + ' em (' + pct(v.HT || 0, n) + ')';
            s += (v.CHT ? ', Chưa hoàn thành ' + v.CHT + ' em.' : '; không có học sinh chưa hoàn thành.');
            return s;
        };
        MON_CHINH.forEach(m => { if (kq[m] && tong(kq[m]) > 0) out.push(moTa(m, kq[m])); });
        const khac = Object.keys(kq).filter(m => !MON_CHINH.includes(m) && tong(kq[m]) > 0);
        const coCHT = khac.filter(m => kq[m].CHT > 0);
        if (khac.length) {
            out.push(coCHT.length
                ? 'Các môn học và hoạt động giáo dục khác: còn học sinh chưa hoàn thành ở ' + coCHT.map(m => m + ' (' + kq[m].CHT + ' em)').join(', ') + '; các môn còn lại 100% học sinh hoàn thành trở lên.'
                : 'Các môn học và hoạt động giáo dục khác: 100% học sinh hoàn thành trở lên.');
        }
        const coChua = Object.keys(kq).some(m => kq[m].CHT > 0);
        out.push(coChua
            ? (cuoiNam ? 'Học sinh chưa hoàn thành: … (ghi tên, môn) — lập kế hoạch rèn luyện trong hè, kiểm tra lại theo quy định.'
                : 'Học sinh chưa hoàn thành: … (ghi tên, môn) — có kế hoạch phụ đạo trong học kì II.')
            : (cuoiNam ? '100% học sinh hoàn thành các môn học và hoạt động giáo dục.' : 'Học sinh nắm được kiến thức, kĩ năng cơ bản của học kì I.'));
        if (!cuoiNam) out.push('Hạn chế: một số em ' + (c.khoi <= 2 ? 'đọc còn chậm, viết chưa đúng mẫu chữ' : c.khoi === 3 ? 'chưa thuộc bảng nhân, bảng chia, viết đoạn văn còn lủng củng' : 'kĩ năng giải toán có lời văn, viết bài văn còn hạn chế') + '.');
        return lines(out);
    }

    function soKetSiSo(c, cuoiNam) {
        const n = c.kq.siSo || c.so.tongSo;
        if (!n) return lines(['Đầu năm: … em; ' + (cuoiNam ? 'cuối năm' : 'cuối học kì I') + ': … em. Duy trì sĩ số đạt …%.', 'Chuyên cần: …']);
        return lines([(cuoiNam ? 'Cuối năm học' : 'Cuối học kì I') + ' lớp có ' + n + ' em. Duy trì sĩ số đạt 100%, không có học sinh bỏ học.',
            'Học sinh đi học chuyên cần, đúng giờ; học sinh nghỉ học đều có lí do và được phụ huynh báo kịp thời.']);
    }

    function chuDep(c, r, cuoiNam) {
        return lines([pick(r, ['Học sinh có đủ vở, đa số giữ vở sạch sẽ, viết đúng mẫu chữ, trình bày cẩn thận.',
            'Phần lớn học sinh có ý thức giữ gìn vở sạch, chữ viết tiến bộ rõ rệt so với đầu năm.']),
        'Số học sinh đạt vở sạch, chữ đẹp: … em (…%).',
        cuoiNam ? 'Một số em chữ viết chưa đều nét, cần tiếp tục luyện viết trong hè.' : 'Một số em chữ viết chưa đều nét, còn tẩy xóa; tiếp tục rèn luyện trong học kì II.']);
    }

    function hoatDongHk1(c) {
        return lines(['Tham gia đầy đủ Lễ khai giảng, vui Tết Trung thu; các hoạt động chào mừng Ngày 20/10, 20/11, 22/12.',
            'Lớp học được trang trí sạch đẹp, đúng quy định; học sinh giữ gìn tốt bàn ghế, đồ dùng của lớp.',
            'Thực hiện tốt trực nhật, lao động vệ sinh lớp học, chăm sóc cây xanh.',
            c.khoi <= 3 ? 'Sao nhi đồng sinh hoạt đều đặn theo chủ điểm.' : 'Chi đội sinh hoạt đều đặn, đúng nội dung theo hướng dẫn của Liên đội.',
            'Phối hợp tốt với Ban đại diện cha mẹ học sinh trong chăm lo, giáo dục học sinh.',
            'Học sinh được giáo dục an toàn giao thông, phòng tránh tai nạn thương tích; không có học sinh bị tai nạn.',
            'Hạn chế: một số hoạt động phong trào lớp tham gia chưa đều; cần phát huy hơn vai trò hội đồng tự quản trong học kì II.']);
    }

    function hoatDongNam(c) {
        return lines(['Tham gia đầy đủ các hoạt động theo chủ điểm hằng tháng và các ngày lễ lớn trong năm học.',
            'Lớp học luôn sạch đẹp; học sinh giữ gìn tốt bàn ghế, đồ dùng của lớp.',
            'Thực hiện tốt trực nhật, lao động vệ sinh, chăm sóc cây xanh.',
            c.khoi <= 2 ? 'Sao nhi đồng sinh hoạt đều đặn, có nề nếp.' : c.khoi === 3 ? 'Sao nhi đồng sinh hoạt đều đặn; học sinh đủ điều kiện được kết nạp vào Đội: … em.' : 'Chi đội sinh hoạt đều đặn, đúng nội dung theo hướng dẫn của Liên đội.',
            'Phối hợp tốt với Ban đại diện cha mẹ học sinh trong chăm lo, giáo dục học sinh.',
            'Học sinh được giáo dục an toàn giao thông, phòng chống đuối nước, tai nạn thương tích; không có học sinh bị tai nạn.',
            'Lớp được nhà trường xếp loại thi đua: … ; học sinh được khen thưởng: … em.']);
    }

    function nangKhieu() {
        return lines(['Cấp trường: … em đạt giải (ghi tên, môn/nội dung).', 'Cấp xã: …', 'Cấp tỉnh: …']);
    }

    function phuongHuongHk2(c, r) {
        const ht = HOC_TAP[c.khoi].hk2;
        const out = ['Duy trì sĩ số 100%, giữ vững nề nếp, chuyên cần.',
            'Phát huy những mặt đã làm được ở học kì I; khắc phục những tồn tại còn lại.',
            'Lập kế hoạch phụ đạo cụ thể cho học sinh chưa hoàn thành, học sinh còn chậm; bồi dưỡng học sinh có năng khiếu.',
            'Trọng tâm học tập - ' + ht.join('; ') + '.',
            'Thực hiện tốt các chủ điểm: “Mừng Đảng, mừng xuân” (tháng 2), “Tiến bước lên Đoàn” (tháng 3), “Hòa bình và hữu nghị” (tháng 4), “Bác Hồ kính yêu” (tháng 5).'];
        if (c.khoi >= 4) out.push('Ôn tập tốt để học sinh đạt kết quả cao trong kiểm tra giữa học kì II và cuối năm.');
        else out.push('Ôn tập tốt để học sinh đạt kết quả cao trong kiểm tra cuối năm học.');
        if (c.khoi === 5) out.push('Phấn đấu 100% học sinh hoàn thành chương trình tiểu học.');
        else out.push('Phấn đấu 100% học sinh hoàn thành chương trình lớp học.');
        if (c.khoi === 3) out.push('Chuẩn bị tốt để học sinh đủ điều kiện được kết nạp vào Đội Thiếu niên Tiền phong Hồ Chí Minh.');
        out.push('Tiếp tục rèn chữ viết, giữ vở sạch; duy trì đôi bạn cùng tiến, truy bài đầu giờ.');
        out.push('Giáo dục an toàn giao thông, phòng chống đuối nước, tai nạn thương tích; giữ gìn sức khỏe khi thời tiết thay đổi.');
        out.push('Tăng cường phối hợp với phụ huynh, nhất là gia đình học sinh còn chậm, học sinh có hoàn cảnh khó khăn.');
        out.push('Phấn đấu lớp đạt danh hiệu Tập thể lớp Tiên tiến.');
        return lines(out);
    }

    function hopPhuHuynh(c, r) {
        const n = c.lanHop;
        let ds;
        if (n === 1) {
            ds = ['Giáo viên chủ nhiệm báo cáo tình hình lớp đầu năm học: sĩ số, đặc điểm, thuận lợi, khó khăn.',
                'Phổ biến nội quy nhà trường, kế hoạch năm học của lớp; quy định về đánh giá học sinh tiểu học.',
                'Thống nhất cách liên lạc giữa gia đình và nhà trường qua sổ liên lạc điện tử; giờ đưa đón học sinh.',
                'Nhắc nhở phụ huynh chuẩn bị đủ sách vở, đồ dùng; tạo góc học tập cho con ở nhà.',
                'Phối hợp đảm bảo an toàn giao thông, phòng tránh tai nạn thương tích, đuối nước cho học sinh.',
                'Phổ biến về bảo hiểm y tế học sinh và các khoản thu (nếu có) theo đúng quy định, trên tinh thần tự nguyện.',
                'Bầu Ban đại diện cha mẹ học sinh của lớp.',
                'Phụ huynh phát biểu ý kiến; giáo viên chủ nhiệm giải đáp.',
                'Thống nhất các nội dung phối hợp; thông qua biên bản cuộc họp.'];
        } else if (n === 2) {
            ds = ['Giáo viên chủ nhiệm thông báo kết quả học tập, rèn luyện học kì I của lớp và của từng học sinh.',
                'Biểu dương học sinh có nhiều tiến bộ; trao đổi riêng với gia đình học sinh còn chậm.',
                'Thống nhất biện pháp phối hợp giúp đỡ học sinh trong học kì II.',
                'Nhắc nhở phụ huynh quản lí con đón Tết an toàn, tiết kiệm; không đốt pháo, không chơi các vật gây cháy nổ.',
                'Ban đại diện cha mẹ học sinh báo cáo hoạt động học kì I.',
                'Phụ huynh phát biểu ý kiến; giáo viên chủ nhiệm giải đáp.',
                'Thống nhất các nội dung phối hợp; thông qua biên bản cuộc họp.'];
        } else if (n === 3) {
            ds = ['Giáo viên chủ nhiệm thông báo kết quả học tập, rèn luyện cả năm học của lớp và của từng học sinh.',
                'Thông báo danh sách học sinh được khen thưởng, học sinh hoàn thành chương trình lớp học.',
                'Hướng dẫn phụ huynh kế hoạch ôn luyện, sinh hoạt hè cho con; phòng chống đuối nước, tai nạn thương tích.',
                'Nhắc nhở phụ huynh quản lí con trong dịp hè; khuyến khích con đọc sách, tham gia hoạt động hè tại địa phương.',
                'Chuẩn bị cho năm học mới.',
                'Phụ huynh phát biểu ý kiến; Ban đại diện cha mẹ học sinh tổng kết hoạt động năm học.',
                'Thống nhất các nội dung phối hợp; thông qua biên bản cuộc họp.'];
        } else {
            ds = ['Giáo viên chủ nhiệm thông báo tình hình học tập, rèn luyện của lớp thời gian qua.',
                'Trao đổi biện pháp phối hợp giữa gia đình và nhà trường.',
                'Phụ huynh phát biểu ý kiến; giáo viên chủ nhiệm giải đáp.'];
        }
        return ds.map((s, i) => (i + 1) + '. ' + s).join('\n');
    }

    // ---------- bảng điều phối ----------
    const GEN = {
        m1_kh_nam: { danhhieu_lop: danhHieuLop, danhhieu_chidoi: danhHieuDoi, tieu_chuan: tieuChuanKhac, bien_phap: bienPhapNam },
        m1_kh_thang: { cong_viec: congViecThang, bien_phap: bienPhapThang, ket_qua: ketQuaThang },
        m2_dac_diem: { thuan_loi: thuanLoi, kho_khan: khoKhan },
        m2_nd_kh: {
            'chi_tieu#0': siSoChiTieu, 'giai_phap#0': siSoGiaiPhap, 'giai_phap#1': giaiPhapPcNl, 'giai_phap#2': giaiPhapHocTap,
            'chi_tieu#1': vsChiTieu, 'giai_phap#3': vsGiaiPhap, 'chi_tieu#2': ngllChiTieu, 'giai_phap#4': ngllGiaiPhap,
            'chi_tieu#3': csvcChiTieu, 'giai_phap#5': csvcGiaiPhap, 'chi_tieu#4': laoDongChiTieu, 'giai_phap#6': laoDongGiaiPhap,
            'chi_tieu#5': xhhChiTieu, 'giai_phap#7': xhhGiaiPhap, 'chi_tieu#6': danhHieuMau2
        },
        m2_thang: { danh_gia: danhGiaThangTruoc, trong_tam: trongTam, gd_dao_duc: gdDaoDuc, gd_hoc_tap: gdHocTap, hoat_dong: hoatDongThang, ke_hoach: keHoachTuan },
        m2_so_ket: {
            si_so: c => soKetSiSo(c, false), gd_dao_duc: (c, r) => soKetNlpc(c, r, false), gd_hoc_tap: (c, r) => soKetMon(c, r, false),
            chu_dep: (c, r) => chuDep(c, r, false), hoat_dong: hoatDongHk1
        },
        m2_hk2: { hoat_dong: phuongHuongHk2 },
        m2_tong_ket: { nang_khieu: nangKhieu, hoat_dong: hoatDongNam },
        m2_hop_ph: { noi_dung: hopPhuHuynh }
    };

    /** Bản nháp một ô. Trả {text, html, canBoSung} hoặc null. */
    function generate(state, key, opts) {
        const id = sectionId(state);
        if (!id || !GEN[id]) return null;
        const c = buildCtx(state, opts);
        const fn = GEN[id][key] || GEN[id][baseOf(key)];
        if (!fn) return null;
        const r = rng([id, key, c.lop, c.thang, c.lanHop, (opts && opts.seed) || 0].join('|'));
        const text = String(fn(c, r, key) || '').trim();
        if (!text) return null;
        return { text, html: toHtml(text), canBoSung: text.includes('…') };
    }

    function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function toHtml(text) {
        return String(text).split('\n').map(l => '<p>' + escapeHtml(l) + '</p>').join('');
    }

    // ---------- soát chữ ----------
    const CAM = [
        { re: /\bhuyện\b/i, ly: 'Không còn cấp huyện' },
        { re: /Phòng\s+(GD|Giáo dục)/i, ly: 'Không còn Phòng Giáo dục và Đào tạo' },
        { re: /Công đoàn/i, ly: 'Không nhắc Công đoàn' },
        { re: /Kết nối tri thức|Chân trời sáng tạo|Cánh Diều/i, ly: 'Không nhắc tên bộ sách' },
        { re: /\bkỹ\b/i, ly: 'Dùng "kĩ"' }
    ];
    function validate(text) {
        return CAM.filter(c => c.re.test(text)).map(c => c.ly);
    }

    // ---------- 6.3.4: Sơ đồ lớp (Mẫu 2) ----------
    /**
     * Xếp học sinh vào chỗ ngồi. Không bịa gì: chỉ đặt đúng các em có trong danh sách lớp.
     * seats: [{c, r, stt, id, name}]  (c = dãy, r = hàng tính từ bàn giáo viên, stt = chỗ trong bàn)
     * hs:    [{id, name, nu}]         (nu: true/false/null, theo thứ tự danh sách lớp)
     * opt:   {thuTu: 'danh_sach' | 'ten', namNu: bool, giuCho: bool}
     */
    function tachTen(s) {
        const w = String(s || '').trim().split(/\s+/);
        return [w[w.length - 1] || '', w.slice(0, -1).join(' ')];
    }
    function xepSoDo(seats, hs, opt) {
        opt = opt || {};
        const order = (seats || []).slice().sort((a, b) => a.r - b.r || a.c - b.c || a.stt - b.stt);
        const hsById = new Map((hs || []).map(h => [String(h.id), h]));
        const daCo = new Set();
        const plan = order.map(s => {
            const giu = !!opt.giuCho && s.id && hsById.has(String(s.id)) && !daCo.has(String(s.id));
            if (giu) daCo.add(String(s.id));
            return giu ? { c: s.c, r: s.r, stt: s.stt, id: String(s.id), name: hsById.get(String(s.id)).name, giu: true }
                : { c: s.c, r: s.r, stt: s.stt, id: '', name: '', giu: false };
        });
        let list = (hs || []).filter(h => !daCo.has(String(h.id)));
        if (opt.thuTu === 'ten') {
            list = list.slice().sort((a, b) => {
                const A = tachTen(a.name), B = tachTen(b.name);
                return A[0].localeCompare(B[0], 'vi') || A[1].localeCompare(B[1], 'vi');
            });
        }
        const trong = plan.filter(p => !p.giu);
        if (opt.namNu) {
            const nam = list.filter(h => h.nu === false), nu = list.filter(h => h.nu === true), khac = list.filter(h => h.nu !== true && h.nu !== false);
            // theo từng bàn (cùng hàng, cùng dãy): bắt đầu bằng giới đang còn nhiều hơn, rồi xen kẽ
            const ban = new Map();
            trong.forEach(p => { const k = p.r + ':' + p.c; if (!ban.has(k)) ban.set(k, []); ban.get(k).push(p); });
            for (const [k, cho] of ban.entries()) {
                const giuO = plan.find(p => p.giu && (p.r + ':' + p.c) === k);
                const gGiu = giuO ? (hsById.get(giuO.id) || {}).nu : null;
                let luot = gGiu === true ? 'nam' : gGiu === false ? 'nu' : (nam.length >= nu.length ? 'nam' : 'nu');
                for (const p of cho) {
                    const q = luot === 'nam' ? (nam.length ? nam : nu.length ? nu : khac) : (nu.length ? nu : nam.length ? nam : khac);
                    const h = q.shift();
                    if (h) { p.id = String(h.id); p.name = h.name; }
                    luot = luot === 'nam' ? 'nu' : 'nam';
                }
            }
            list = nam.concat(nu, khac);
        } else {
            trong.forEach(p => { const h = list.shift(); if (h) { p.id = String(h.id); p.name = h.name; } });
        }
        return { plan, conThua: list, soCho: plan.length, soHS: (hs || []).length, soGiu: daCo.size };
    }

    /** Cho bảng bên: tình trạng mục đang mở. */
    function describe(state) {
        const id = sectionId(state);
        const c = buildCtx(state, {});
        const fields = id ? fieldsFor(state) : [];
        const thieu = [];
        if (id && /m1_kh_thang|m2_thang/.test(id) && !c.thang) thieu.push('Chưa đọc được tháng đang chọn.');
        if (id === 'm2_so_ket' && !c.kq.mon) thieu.push('Bảng kết quả học kì I còn trống. Bấm “Đồng bộ hệ thống” trên vnEdu trước để có số liệu thật.');
        if (id === 'm2_tong_ket' && !c.kq.mon) thieu.push('Bảng kết quả cuối năm còn trống. Bấm “Đồng bộ hệ thống” trên vnEdu trước.');
        if (id === 'm2_dac_diem' && c.so.tongSo === null) thieu.push('Ô số liệu còn trống. Bấm “Đồng bộ thông tin lớp học” trên vnEdu để có sĩ số, hộ nghèo…');
        return {
            id, supported: !!id, fields, khoi: c.khoi, thang: c.thang, lanHop: c.lanHop,
            danhSachMuc: DANH_SACH_MUC[state.mau || 1] || [], thieu
        };
    }

    const api = { TRAITS, THANG, HOC_TAP, sectionId, fieldsFor, generate, describe, validate, toHtml, buildCtx, DANH_SACH_MUC, xepSoDo };
    root.SoChuNhiemEngine = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

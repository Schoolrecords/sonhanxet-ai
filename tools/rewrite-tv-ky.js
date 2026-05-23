// V6.1.0 - Rewrite Tiếng Việt × 3 kỳ × 4 tier theo TT27 + band 90-110.
// V3: dạng HỌC BẠ (không Em) + ƯU TIÊN MÔ TẢ BIỂU HIỆN (không lời khuyên):
//   - T (tot_xs/tot): điểm nổi bật về tiến bộ / năng khiếu / hứng thú
//   - H (ht): biểu hiện cụ thể ở mức cơ bản hoàn thành
//   - C (cht): nội dung/kỹ năng chưa hoàn thành — mô tả, KHÔNG khuyên răn
// Spirit kỳ: ghk1=bước đầu/cơ bản | chk1=nắm vững/tiến bộ | ghk2=vận dụng/phối hợp.

const fs = require('fs');
const path = 'engine/data/nhanxet-ky.json';

const TV = {
    ghk1: {
        tot_xs: [
            "Có năng khiếu Tiếng Việt, đọc lưu loát rõ ràng, viết câu giàu hình ảnh và rất sáng tạo hay.",
            "Đọc trôi chảy có ngữ điệu, vốn từ phong phú, viết câu đúng ngữ pháp và diễn đạt rất mạch lạc.",
            "Tiến bộ rõ rệt về đọc viết, viết chữ đẹp đều nét, đặt câu mới lạ và sử dụng từ rất chính xác.",
            "Hứng thú học Tiếng Việt, nghe hiểu nhanh, nói lưu loát mạch lạc, viết câu sáng tạo sinh động."
        ],
        tot: [
            "Đọc rõ ràng, viết câu đúng ngữ pháp cơ bản, dùng dấu câu chính xác và trình bày bài rất sạch sẽ.",
            "Nghe hiểu tốt, kể được nội dung bài đọc bằng câu rõ ý, viết chính tả tương đối chính xác hay.",
            "Có tiến bộ về vốn từ, viết câu theo mẫu rõ ý, đọc bài rõ ràng và trình bày bài tương đối sạch.",
            "Chăm chỉ luyện viết, đọc to rõ từng tiếng, đặt câu đúng theo nội dung gợi ý và trả lời rất tốt."
        ],
        ht: [
            "Hoàn thành nội dung cơ bản môn học, đọc và viết được câu ngắn theo hướng dẫn, có nhiều cố gắng.",
            "Đọc được bài tập đọc cơ bản, viết câu ngắn theo gợi ý, làm bài tập trên lớp tương đối đầy đủ.",
            "Tham gia học tập đều đặn, đọc được bài và viết câu cơ bản, chăm chú lắng nghe và làm theo hướng dẫn.",
            "Viết được câu theo mẫu, đọc rõ ràng từng tiếng, trả lời được các câu hỏi đơn giản ở trong bài.",
            "Có ý thức học tập tốt, làm bài tương đối đầy đủ, viết được câu ngắn và đọc bài cơ bản rõ ý.",
            "Đọc thành tiếng được câu ngắn, viết câu theo gợi ý, có hứng thú nghe kể chuyện trong giờ học."
        ],
        cht: [
            "Đọc bài còn chậm và ngắt nghỉ chưa đúng, viết câu chưa rõ ý, vốn từ còn ở mức rất hạn chế.",
            "Kĩ năng đọc và viết chưa đạt yêu cầu cơ bản, viết chữ chưa đều nét, chính tả còn nhiều lỗi sai.",
            "Đọc còn ấp úng, viết câu ngắn chưa đầy đủ ý, chưa nắm vững các âm vần cơ bản trong bài học.",
            "Vốn từ còn ít, kĩ năng nghe nói chưa mạch lạc, viết chính tả còn sai nhiều ở các từ thường gặp.",
            "Chưa hoàn thành nội dung cơ bản môn học, kĩ năng đọc và viết câu còn ở mức rất hạn chế thiếu."
        ]
    },
    chk1: {
        tot_xs: [
            "Nắm vững kĩ năng đọc viết, vốn từ rất phong phú, viết câu giàu hình ảnh và rất sáng tạo hay.",
            "Tiến bộ rõ rệt cả 4 kĩ năng, đọc lưu loát có cảm xúc, viết câu sinh động và dùng từ chính xác.",
            "Có khả năng cảm thụ tốt, vốn từ rộng, viết câu rõ ý sáng tạo và trình bày bài rất đẹp đẽ hay.",
            "Hứng thú học Tiếng Việt, nghe hiểu nhanh, nói lưu loát, viết bài rõ ý dùng dấu câu rất đúng."
        ],
        tot: [
            "Đọc trôi chảy, viết câu đúng ngữ pháp, biết dùng dấu câu hợp lí và trình bày bài khá sạch đẹp.",
            "Viết chính tả khá đúng, kể được nội dung bài đọc bằng câu rõ ý và viết câu theo mẫu rất tốt.",
            "Có vốn từ khá, đặt câu rõ ý, biết viết đoạn ngắn và đọc trả lời câu hỏi tương đối đầy đủ ý.",
            "Chăm chỉ học tập, có tiến bộ về chính tả, viết câu đầy đủ ý và đọc bài rõ ràng từng tiếng hay.",
            "Nắm vững kĩ năng cơ bản, đọc lưu loát, viết câu rõ ý và biết dùng dấu câu khá chính xác hay."
        ],
        ht: [
            "Đã đọc và viết được nội dung cơ bản môn học, có ý thức học tập và làm bài đầy đủ theo yêu cầu lớp.",
            "Có tiến bộ trong đọc trôi chảy và viết câu đầy đủ ý, chăm chỉ học tập trên lớp và ở tại nhà.",
            "Đọc và viết bài tương đối rõ ràng, làm bài tập cơ bản đầy đủ, chú ý lắng nghe trong giờ học.",
            "Viết được câu theo mẫu, kể được nội dung chính của bài đọc, tham gia học tập đều đặn trên lớp.",
            "Đọc thành tiếng rõ ràng, viết câu ngắn theo gợi ý, có hứng thú với phần kể chuyện và đọc thơ.",
            "Hoàn thành bài tập ở mức cơ bản, đọc và viết được câu ngắn, viết chữ tương đối rõ và sạch sẽ."
        ],
        cht: [
            "Đọc bài còn chậm, viết câu chưa đúng ngữ pháp, chính tả còn sai nhiều ở các từ phổ biến hằng ngày.",
            "Kĩ năng đọc viết còn hạn chế, viết câu chưa rõ ý, chưa biết dùng dấu câu cơ bản khi viết bài.",
            "Vốn từ còn ít, viết câu ngắn chưa đầy đủ ý, đọc bài chưa lưu loát và còn ấp úng ở nhiều chỗ.",
            "Chưa nắm vững các kĩ năng cơ bản môn học, đọc bài còn vấp, viết chữ chưa đều nét và rõ ràng.",
            "Kĩ năng nghe nói đọc viết còn ở mức thấp, viết chính tả còn sai ở các từ thường gặp trong bài."
        ]
    },
    ghk2: {
        tot_xs: [
            "Vận dụng linh hoạt 4 kĩ năng, đọc hiểu sâu, viết đoạn văn có ý mới lạ và lập luận rất chặt chẽ.",
            "Có năng khiếu cảm thụ văn học, viết bài giàu cảm xúc, vốn từ phong phú và diễn đạt rất mạch lạc.",
            "Tiến bộ vượt bậc về viết văn, biết phối hợp tốt nghe nói đọc viết và sử dụng từ rất chính xác.",
            "Hứng thú học Tiếng Việt, đọc diễn cảm có ngữ điệu, viết đoạn văn có bố cục rõ ràng mạch lạc."
        ],
        tot: [
            "Vận dụng tốt kĩ năng đọc viết, viết đoạn văn rõ ý, biết phối hợp các kĩ năng cơ bản đầy đủ.",
            "Đọc trôi chảy hiểu bài tốt, viết câu đúng ngữ pháp và đoạn văn có bố cục tương đối rõ ý hay.",
            "Có vốn từ khá phong phú, viết được đoạn văn ngắn rõ ý và biết phối hợp đọc nghe nói rất tốt.",
            "Có tiến bộ về viết văn, vận dụng tốt vốn từ vào viết câu rõ ý và đặt câu khá hay đầy đủ ý.",
            "Chăm chỉ luyện viết, biết phối hợp các kĩ năng cơ bản, viết đoạn văn theo mẫu khá rõ ý mạch."
        ],
        ht: [
            "Vận dụng được kĩ năng cơ bản, viết được đoạn văn ngắn rõ ý theo hướng dẫn trên lớp đều đặn.",
            "Có tiến bộ trong viết câu và đọc hiểu, viết được đoạn văn có bố cục rõ ý ở mức cơ bản nhất.",
            "Đọc và viết đạt mức cơ bản, biết phối hợp nghe nói đọc viết, làm bài tập tương đối đầy đủ ý.",
            "Tham gia học tập đều đặn, viết câu rõ ý, đọc bài lưu loát hơn so với giai đoạn đầu năm học.",
            "Hoàn thành bài tập cơ bản, đọc hiểu được nội dung chính, viết câu đúng ngữ pháp và rõ ràng ý.",
            "Viết được câu đúng ngữ pháp, đọc bài rõ ý, biết kể lại nội dung bài đọc bằng câu đầy đủ rõ.",
            "Chăm chỉ luyện viết, đọc bài đầy đủ, viết chính tả tương đối đúng và dùng dấu câu khá hợp lí."
        ],
        cht: [
            "Kĩ năng đọc và viết còn hạn chế, viết đoạn văn chưa rõ ý, chính tả còn sai nhiều ở các từ phổ biến.",
            "Đọc bài còn chậm, viết câu chưa đúng ngữ pháp, chưa biết phối hợp các kĩ năng cơ bản hằng ngày.",
            "Vốn từ còn ít, viết đoạn văn chưa đầy đủ ý, chưa nắm vững cách dùng dấu câu và liên kết câu.",
            "Chưa vận dụng được các kĩ năng cơ bản môn học, đọc bài còn vấp, viết câu ngắn chưa đầy đủ ý.",
            "Kĩ năng nghe nói đọc viết còn yếu, viết bài chưa có bố cục rõ ràng, chính tả còn nhiều lỗi sai."
        ]
    }
};

// VERIFY: tất cả câu phải 90-110 ký tự (dạng học bạ - không "Em")
let total = 0, ok = 0, bad = [];
for (const ky of Object.keys(TV)) {
    for (const tier of Object.keys(TV[ky])) {
        for (const s of TV[ky][tier]) {
            total++;
            const L = s.length;
            if (L >= 90 && L <= 110) ok++;
            else bad.push({ky, tier, L, s});
            if (/^Em\s/i.test(s)) bad.push({ky, tier, L: 'XƯNG EM!', s});
        }
    }
}

console.log(`TỔNG: ${total} câu | OK band 90-110 + không xưng Em: ${ok}/${total}`);
if (bad.length) {
    console.log('\nVI PHẠM:');
    for (const b of bad) console.log(`  ${b.ky}.${b.tier} [${b.L}] ${b.s}`);
    console.log('\n⛔ KHÔNG patch — sửa câu trước rồi chạy lại');
    process.exit(1);
}

// PATCH
const json = JSON.parse(fs.readFileSync(path, 'utf8'));
json.subjects['tieng-viet'] = TV;
json.meta.version = '6.1.0';
json.meta.note_v610 = 'V6.1.0 (2026-05-23): rewrite ngân hàng câu theo TT27 chuẩn học bạ — dạng HỌC BẠ trực tiếp (KHÔNG xưng Em), band 90-110 ký tự, ƯU TIÊN MÔ TẢ BIỂU HIỆN (tiến bộ/năng khiếu/hứng thú ở T-H, kỹ năng chưa hoàn thành ở C), không chú trọng lời khuyên.';
fs.writeFileSync(path, JSON.stringify(json, null, 2) + '\n', 'utf8');
console.log('\n✅ Đã patch ' + path);

// V6.1.0 — Sửa ngân hàng câu Giữa HK1: viết lại Toán, bỏ các đuôi chêm cho đủ độ dài,
// sửa nội dung sai thời điểm. Chạy 1 lần: node tools/patch-giuaky-v610.js
// Mỗi cặp [cũ, mới] phải khớp ĐÚNG 1 câu trong đúng môn, nếu không thì dừng và không ghi gì.
const fs = require('fs');
const path = require('path');

const KY_FILE = path.join(__dirname, '../engine/data/nhanxet-ky.json');
const GRADE_FILE = path.join(__dirname, '../engine/data/nhanxet-grade.json');

const TOAN_GHK1 = {
    tot_xs: [
        'Tính toán nhanh và chính xác, biết phân tích đề bài, vận dụng linh hoạt kiến thức đã học vào bài tập.',
        'Làm bài cẩn thận, trình bày bài khoa học, biết tự kiểm tra lại kết quả trước khi nộp bài.',
        'Có năng khiếu môn Toán, nắm chắc kiến thức đã học và biết tìm cách giải phù hợp với từng bài.',
        'Phân tích đề bài kĩ, trình bày lời giải mạch lạc và làm đúng các dạng bài đã học trên lớp.',
        'Hứng thú học Toán, tích cực trong giờ học, vận dụng tốt kiến thức đã học vào các bài tập.'
    ],
    tot: [
        'Làm tính đúng, đặt phép tính rõ ràng và trình bày bài sạch sẽ, biết kiểm tra lại kết quả.',
        'Hiểu bài, làm được các bài tập trên lớp, ít mắc sai sót và trình bày bài tương đối khoa học.',
        'Có ý thức học tập tốt, làm bài đầy đủ, biết vận dụng kiến thức đã học vào bài tập quen thuộc.',
        'Vận dụng được kiến thức đã học vào giải bài tập theo hướng dẫn, tính toán tương đối chính xác.',
        'Làm bài cẩn thận, tính toán ít sai sót, biết đặt phép tính đúng và trình bày bài rõ ràng.',
        'Nắm được kiến thức đã học, làm tính đúng và biết viết câu trả lời đầy đủ khi giải bài tập.'
    ],
    ht: [
        'Đã làm được các phép tính đã học ở mức cơ bản, cần rèn thêm tính cẩn thận khi làm bài.',
        'Chăm chỉ làm bài, thực hiện đúng các phép tính cơ bản được giao, cần luyện thêm tính nhẩm.',
        'Có tiến bộ trong tính toán, giải được các bài tập đơn giản, cần đọc kĩ đề bài trước khi làm.',
        'Hiểu nội dung cơ bản của bài học, làm được bài trên lớp, cần luyện thêm cách trình bày bài.',
        'Có ý thức làm bài, trình bày bài tương đối rõ ràng, cần kiểm tra lại kết quả sau khi tính.',
        'Đã đặt được phép tính theo mẫu, làm được bài tập cơ bản, cần luyện thêm để tính đúng hơn.',
        'Tham gia học tập đều đặn, hoàn thành các bài tập cơ bản, cần cố gắng hơn khi giải bài tập.'
    ],
    cht: [
        'Cần luyện lại các phép tính đã học, đọc kĩ đề bài hơn và làm bài theo hướng dẫn từng bước.',
        'Kĩ năng tính toán còn hạn chế, chưa làm được một số bài tập cơ bản, cần được hỗ trợ thêm.',
        'Còn nhầm lẫn khi đặt phép tính và tính toán, cần luyện thêm các bài tập cơ bản đã học.',
        'Đã có cố gắng nhưng còn chậm khi làm tính, cần được hướng dẫn cách đọc đề và làm từng bước.',
        'Chưa nắm vững các phép tính đã học, gia đình cần phối hợp kèm thêm các bài tập cơ bản.',
        'Làm bài còn chậm và chưa đầy đủ, cần luyện thêm các bài tập trên lớp để củng cố kiến thức.',
        'Còn lúng túng khi giải bài tập, cần được hỗ trợ thêm khi gặp bài chưa hiểu trong giờ học.'
    ]
};

const KY_PATCH = {
    'tieng-viet': [
        ['viết câu giàu hình ảnh và rất sáng tạo hay.', 'viết câu giàu hình ảnh và diễn đạt sáng tạo.'],
        ['viết chữ đẹp đều nét, đặt câu mới lạ và sử dụng từ rất chính xác.', 'chữ viết đẹp đều nét, đặt câu có ý hay và dùng từ chính xác.'],
        ['viết chính tả tương đối chính xác hay.', 'viết chính tả tương đối chính xác.'],
        ['đặt câu đúng theo nội dung gợi ý và trả lời rất tốt.', 'đặt câu đúng theo gợi ý và trả lời câu hỏi rõ ràng.'],
        ['viết được câu ngắn và đọc bài cơ bản rõ ý.', 'viết được câu ngắn và đọc được bài theo hướng dẫn.'],
        ['còn ở mức rất hạn chế thiếu.', 'còn ở mức rất hạn chế.']
    ],
    tnxh: [
        ['biết giữ vệ sinh cá nhân và an toàn khi đến trường rất tự giác.', 'tự giác giữ vệ sinh cá nhân và an toàn khi đến trường.'],
        ['kể được về gia đình trường lớp ở mức cơ bản, có cố gắng', 'kể được về gia đình và trường lớp, có cố gắng'],
        ['Có vốn hiểu biết về môi trường còn ít,', 'Còn ít hiểu biết về môi trường xung quanh,']
    ],
    khoahoc: [
        ['vận dụng kiến thức vào thực tế và làm thí nghiệm đơn giản tốt.', 'vận dụng kiến thức vào thực tế và làm tốt thí nghiệm đơn giản.'],
        ['cần luyện thêm cách diễn đạt kết quả quan sát hằng ngày.', 'cần luyện thêm cách diễn đạt kết quả quan sát.'],
        ['cần luyện thêm kĩ năng quan sát hằng ngày.', 'cần luyện thêm kĩ năng quan sát.'],
        ['tìm hiểu hiện tượng quen.', 'tìm hiểu hiện tượng quen thuộc.'],
        ['Có vốn hiểu biết về môi trường còn ít,', 'Còn ít hiểu biết về môi trường xung quanh,']
    ],
    lichsudia: [
        ['vùng đất và con người rất rõ ràng mạch lạc.', 'vùng đất và con người rõ ràng, mạch lạc.'],
        ['Có vốn hiểu biết về địa phương còn ít,', 'Còn ít hiểu biết về địa phương,'],
        ['còn ở mức rất hạn chế cần hỗ trợ.', 'còn ở mức rất hạn chế, cần được hỗ trợ.']
    ],
    daoduc: [
        ['Có ý thức đạo đức rất tốt, trung thực và biết yêu thương bạn bè, luôn lễ phép với người lớn rất tự giác.', 'Có ý thức tốt trong rèn luyện, trung thực, biết yêu thương bạn bè và luôn lễ phép với người lớn.'],
        ['biết nhận lỗi sửa lỗi rất nghiêm túc thành thật.', 'biết nhận lỗi, sửa lỗi thành thật.'],
        ['có ý thức giữ gìn vệ sinh chung và biết giúp đỡ bạn bè trong lớp tự giác.', 'tự giác giữ gìn vệ sinh chung và biết giúp đỡ bạn bè trong lớp.'],
        ['và yêu thương bạn bè trong lớp một cách rất chân thành.', 'và chân thành yêu thương bạn bè trong lớp.'],
        ['đoàn kết với bạn bè trong lớp đều đặn.', 'đoàn kết với bạn bè trong lớp.'],
        ['biết giúp đỡ bạn bè và giữ gìn vệ sinh chung tương đối đầy đủ và đúng.', 'biết giúp đỡ bạn bè và có ý thức giữ gìn vệ sinh chung.'],
        ['tham gia hoạt động lớp đều đặn và biết yêu thương kính trọng người lớn rất chân thành.', 'tham gia hoạt động lớp đều đặn, biết kính trọng người lớn và yêu thương bạn bè.'],
        ['có ý thức nề nếp ở mức cơ bản,', 'đã có ý thức giữ nề nếp,'],
        ['cần rèn thêm nề nếp giữ gìn vệ sinh chung hằng ngày.', 'cần rèn thêm nề nếp giữ gìn vệ sinh chung.'],
        ['Có ý thức đoàn kết còn hạn chế,', 'Còn hạn chế về ý thức đoàn kết,']
    ],
    tinhoc: [
        ['làm bài thực hành đầy đủ theo hướng.', 'làm bài thực hành đầy đủ theo hướng dẫn.'],
        ['cần rèn thêm kĩ năng lưu trữ và mở tài liệu hằng ngày.', 'cần rèn thêm kĩ năng lưu trữ và mở tài liệu.'],
        ['cách tổ chức thông tin hằng ngày.', 'cách tổ chức thông tin.'],
        ['Có kĩ năng máy tính còn hạn chế,', 'Kĩ năng dùng máy tính còn hạn chế,'],
        ['cần luyện thêm thao tác cơ bản đều.', 'cần luyện thêm thao tác cơ bản.']
    ],
    congnghe: [
        ['biết hợp tác với bạn trong thực hành nhóm rất tự giác.', 'hợp tác tốt với bạn trong thực hành nhóm.'],
        ['làm sản phẩm thủ công đơn giản ở mức cơ bản và có cố gắng', 'làm được sản phẩm thủ công đơn giản và có cố gắng'],
        ['cần luyện thêm thao tác cắt gấp khéo.', 'cần luyện thêm thao tác cắt gấp cho khéo hơn.'],
        ['cần rèn thêm thao tác lắp ghép sản phẩm hằng ngày.', 'cần rèn thêm thao tác lắp ghép sản phẩm.'],
        ['cần luyện thêm cách phối hợp với bạn trong thực hành nhóm hơn.', 'cần luyện thêm cách phối hợp với bạn khi thực hành nhóm.'],
        ['cách bảo quản hằng ngày.', 'cách bảo quản đồ dùng.'],
        ['Có kĩ năng thủ công còn hạn chế,', 'Kĩ năng thủ công còn hạn chế,'],
        ['cần luyện thêm thao tác cơ bản đều.', 'cần luyện thêm thao tác cơ bản.']
    ],
    tienganh: [
        ['làm bài tập trên lớp khá đầy đủ và rất chính xác.', 'làm bài tập trên lớp khá đầy đủ, chính xác.'],
        ['tham gia luyện nói trên lớp đều.', 'tham gia luyện nói trên lớp đều đặn.'],
        ['cần luyện đọc thành tiếng đều.', 'cần luyện đọc thành tiếng thường xuyên.'],
        ['còn ở mức rất hạn chế cần hỗ trợ.', 'còn ở mức rất hạn chế, cần được hỗ trợ.']
    ],
    gdtc: [
        ['tham gia trò chơi vận động sôi nổi và hợp tác với bạn rất tự giác.', 'tham gia trò chơi vận động sôi nổi và hợp tác tốt với bạn.'],
        ['Có tiến bộ trong rèn sức bền, tham gia trò chơi vận động đầy đủ và biết hợp tác với bạn trong nhóm tự giác.', 'Có tiến bộ trong rèn sức bền, tự giác tham gia trò chơi vận động và biết hợp tác với bạn trong nhóm.'],
        ['cần luyện thêm sự khéo léo nhịp.', 'cần luyện thêm sự khéo léo, nhịp nhàng.'],
        ['cần rèn thêm sức bền và sự phối hợp động tác đều đặn.', 'cần rèn thêm sức bền và sự phối hợp động tác.'],
        ['trong việc rèn sức bền hằng ngày.', 'trong việc rèn sức bền.'],
        ['cần được hướng dẫn từng bước trên lớp đều.', 'cần được hướng dẫn từng bước trên lớp.'],
        ['Có kĩ năng vận động hạn chế,', 'Kĩ năng vận động còn hạn chế,'],
        ['cần luyện thêm động tác cơ bản đều.', 'cần luyện thêm động tác cơ bản.'],
        ['cần được hỗ trợ thêm hằng ngày.', 'cần được hỗ trợ thêm.']
    ],
    amnhac: [
        ['nghe cảm thụ âm nhạc nhanh và gõ đệm tiết tấu rất đúng và nhịp nhàng.', 'cảm thụ âm nhạc nhanh, gõ đệm tiết tấu đúng và nhịp nhàng.'],
        ['gõ đệm tiết tấu khá nhịp nhàng đều.', 'gõ đệm tiết tấu khá nhịp nhàng.'],
        ['tương đối nhịp nhàng và đầy đủ ý.', 'tương đối nhịp nhàng.'],
        ['trong việc gõ đệm tiết tấu cơ bản hơn.', 'trong việc gõ đệm tiết tấu.'],
        ['cần được hướng dẫn từng câu hát hằng ngày.', 'cần được hướng dẫn từng câu hát.'],
        ['cách hát đúng nhịp đơn.', 'cách hát đúng nhịp.'],
        ['Có kĩ năng âm nhạc còn hạn chế,', 'Kĩ năng âm nhạc còn hạn chế,'],
        ['cách hát theo nhịp đều đặn hơn.', 'cách hát theo nhịp.']
    ],
    mithuat: [
        ['biết thể hiện cảm xúc qua đường nét tự tin.', 'biết thể hiện cảm xúc qua đường nét.'],
        ['hoàn thành sản phẩm khá đầy đủ tự giác.', 'hoàn thành sản phẩm khá đầy đủ.'],
        ['phối màu khá hài hoà theo hướng dẫn lớp.', 'phối màu khá hài hoà theo hướng dẫn.'],
        ['làm bài thực hành đầy đủ theo hướng.', 'làm bài thực hành đầy đủ theo hướng dẫn.'],
        ['vẽ được tranh theo chủ đề ở mức cơ bản và có cố gắng trong thực hành lớp.', 'vẽ được tranh theo chủ đề và có cố gắng trong thực hành.'],
        ['phối màu hài hoà hơn nhiều.', 'phối màu hài hoà hơn.'],
        ['cần được hướng dẫn từng bước trên lớp hằng ngày.', 'cần được hướng dẫn từng bước trên lớp.'],
        ['Có kĩ năng mĩ thuật còn hạn chế,', 'Kĩ năng mĩ thuật còn hạn chế,'],
        ['cách vẽ tranh đơn giản hằng ngày.', 'cách vẽ tranh đơn giản.'],
        ['cần được hỗ trợ thêm đều.', 'cần được hỗ trợ thêm.']
    ],
    htn: [
        ['biết giữ gìn vệ sinh trường lớp và tham gia hoạt động cộng đồng tự giác.', 'tự giác giữ gìn vệ sinh trường lớp và tham gia hoạt động cộng đồng.'],
        ['biết hợp tác với bạn tương đối tự giác.', 'biết hợp tác với bạn.'],
        ['bày tỏ ý kiến tương đối rõ ràng tự tin.', 'bày tỏ ý kiến tương đối rõ ràng.'],
        ['và làm bài đầy đủ trên lớp đều.', 'và tham gia hoạt động đầy đủ.'],
        ['tham gia hoạt động trải nghiệm đều và biết yêu thương kính trọng người lớn rất chân thành.', 'tham gia hoạt động trải nghiệm đều đặn, biết kính trọng người lớn và yêu thương bạn bè.'],
        ['tham gia hoạt động trải nghiệm ở mức cơ bản và có cố gắng', 'đã tham gia hoạt động trải nghiệm và có cố gắng'],
        ['thói quen tự phục vụ hằng ngày hơn.', 'thói quen tự phục vụ hằng ngày.'],
        ['giữ gìn vệ sinh trường.', 'giữ gìn vệ sinh trường lớp.'],
        ['Còn chưa đều ý thức tự phục vụ,', 'Còn chưa có ý thức tự phục vụ đều đặn,'],
        ['cần được hỗ trợ thêm đều.', 'cần được hỗ trợ thêm.']
    ]
};

// Toán theo lớp (grades[lớp].ghk1). Lớp 2 giữa HK1 chưa học số trong 1000.
const GRADE_PATCH = {
    1: [
        ['làm phép cộng trừ không nhớ chính xác cao.', 'làm phép cộng trừ trong 10 chính xác.'],
        ['viết số rất rõ ràng, cẩn thận chính xác.', 'viết số rõ ràng, cẩn thận.'],
        ['làm phép cộng trừ không nhớ chính xác và viết số rõ ràng cẩn thận.', 'làm phép cộng trừ trong 10 chính xác và viết số rõ ràng, cẩn thận.'],
        ['làm phép cộng trừ trong 10 chắc chắn cơ bản.', 'làm phép cộng trừ trong 10 chắc chắn.'],
        ['làm phép cộng trừ không nhớ tương đối nhanh và trình bày bài sạch sẽ đầy đủ.', 'làm phép cộng trừ trong 10 tương đối nhanh và trình bày bài sạch sẽ.'],
        ['làm phép cộng trừ không nhớ ở mức cơ bản đầy đủ ý.', 'làm được phép cộng trừ trong phạm vi 10.'],
        ['làm phép cộng trừ không nhớ cơ bản và nhận biết được các hình đã học rõ.', 'làm được phép cộng trừ đơn giản và nhận biết được các hình đã học.'],
        ['đếm xuôi cơ bản và làm phép cộng trừ không nhớ tương đối đúng theo yêu cầu.', 'đếm được số theo thứ tự và làm phép cộng trừ trong 10 tương đối đúng.'],
        ['làm phép cộng trừ còn nhiều lỗi sai ở mức cơ bản.', 'làm phép cộng trừ còn nhiều lỗi sai.']
    ],
    2: [
        ['đo độ dài rất nhanh chính xác.', 'đo độ dài nhanh, chính xác.'],
        ['làm phép cộng trừ có nhớ chính xác cao và nhận biết hình tứ giác rất tốt, đầy đủ.', 'làm phép cộng trừ có nhớ chính xác và nhận biết tốt hình tứ giác.'],
        ['đo độ dài bằng đơn vị quen thuộc và trình bày sạch.', 'đo độ dài bằng đơn vị quen thuộc và trình bày bài sạch sẽ.'],
        ['ở mức cơ bản, có nhiều cố gắng học.', 'ở mức cơ bản, có nhiều cố gắng.'],
        ['Đọc viết số trong 1000 đúng,', 'Đọc viết số trong 100 đúng,'],
        ['nhận biết được hình cơ bản.', 'nhận biết được các hình đã học.'],
        ['đọc viết số trong 1000 chưa chắc,', 'đọc viết số trong 100 chưa chắc,'],
        ['cần luyện tính nhẩm và đọc số nhiều.', 'cần luyện thêm tính nhẩm và đọc số.']
    ],
    3: [
        ['tính giá trị biểu thức rất nhanh chính xác.', 'tính giá trị biểu thức nhanh, chính xác.'],
        ['làm bài cẩn thận và đạt kết quả chính xác cao trên các dạng quen thuộc.', 'làm bài cẩn thận và làm đúng các dạng bài quen thuộc.'],
        ['vận dụng vào bài toán có lời văn rất tốt cao.', 'vận dụng tốt vào bài toán có lời văn.'],
        ['biết kiểm tra kết quả khá cẩn thận đầy đủ.', 'biết kiểm tra kết quả khá cẩn thận.'],
        ['trình bày bài rất sạch sẽ đầy đủ.', 'trình bày bài sạch sẽ.'],
        ['biết đo độ dài cơ bản đầy đủ.', 'biết đo độ dài.']
    ],
    4: [
        ['tính giá trị biểu thức rất nhanh chính xác.', 'tính giá trị biểu thức nhanh, chính xác.'],
        ['làm bài cẩn thận và đạt kết quả chính xác cao trên nhiều dạng.', 'làm bài cẩn thận và làm đúng nhiều dạng bài.'],
        ['biết đổi đơn vị đo cơ bản rất tốt cao.', 'biết đổi đơn vị đo chính xác.'],
        ['trình bày bài rất rõ.', 'trình bày bài rõ ràng.'],
        ['trình bày bài giải sạch sẽ đầy đủ.', 'trình bày bài giải sạch sẽ.'],
        ['có ý thức học tập đều.', 'có ý thức học tập đều đặn.'],
        ['trình bày bài tương đối rõ.', 'trình bày bài tương đối rõ ràng.'],
        ['làm 4 phép tính số tự nhiên cơ bản và đo lường ở mức cơ bản,', 'làm được 4 phép tính số tự nhiên và đo lường ở mức cơ bản,']
    ],
    5: [
        ['tư duy toán rất nhanh chính xác.', 'tư duy toán nhanh, chính xác.'],
        ['Tiến bộ rõ rệt về phân số số thập phân, làm bài cẩn thận và đạt kết quả chính xác cao trên các dạng bài.', 'Tiến bộ rõ rệt về phân số, số thập phân, làm bài cẩn thận và làm đúng các dạng bài đã học.'],
        ['tính nhẩm phân số số thập phân nhanh và biết vận dụng vào tình huống thực tế đầy đủ.', 'tính nhẩm phân số, số thập phân nhanh và biết vận dụng vào tình huống thực tế.'],
        ['Có tiến bộ về tính phân số số thập phân,', 'Có tiến bộ về tính phân số, số thập phân,'],
        ['trình bày bài giải sạch sẽ đầy đủ.', 'trình bày bài giải sạch sẽ.'],
        ['có ý thức học tập và làm bài đầy đủ ý.', 'có ý thức học tập và làm bài đầy đủ.'],
        ['Có tiến bộ trong tính phân số số thập phân,', 'Có tiến bộ trong tính phân số, số thập phân,'],
        ['ở mức cơ bản, có nhiều cố gắng học.', 'ở mức cơ bản, có nhiều cố gắng.'],
        ['Kĩ năng tính phân số số thập phân còn hạn chế,', 'Kĩ năng tính phân số, số thập phân còn hạn chế,']
    ]
};

// Áp 1 cặp sửa vào danh sách câu [{arr, i}]; đòi khớp đúng 1 câu.
function applyPatch(slots, oldFrag, newFrag, where) {
    const hits = slots.filter(s => s.arr[s.i].includes(oldFrag));
    if (hits.length !== 1) throw new Error(`${where}: "${oldFrag}" khớp ${hits.length} câu (cần đúng 1)`);
    hits[0].arr[hits[0].i] = hits[0].arr[hits[0].i].replace(oldFrag, newFrag);
}

function slotsOf(tierMap) {
    const slots = [];
    for (const v of Object.values(tierMap)) {
        const arr = Array.isArray(v) ? v : v.default;
        arr.forEach((_, i) => slots.push({ arr, i }));
    }
    return slots;
}

const ky = JSON.parse(fs.readFileSync(KY_FILE, 'utf8'));
const grade = JSON.parse(fs.readFileSync(GRADE_FILE, 'utf8'));

ky.subjects.toan.ghk1 = TOAN_GHK1;
let count = 0;
for (const [subj, pairs] of Object.entries(KY_PATCH)) {
    // Có câu "cần được hỗ trợ thêm đều." xuất hiện ở một môn nhiều lần thì cặp đầu phải cụ thể.
    const slots = slotsOf(ky.subjects[subj].ghk1);
    for (const [a, b] of pairs) { applyPatch(slots, a, b, subj); count++; }
}
for (const [g, pairs] of Object.entries(GRADE_PATCH)) {
    const slots = slotsOf(grade.subjects.toan.grades[g].ghk1);
    for (const [a, b] of pairs) { applyPatch(slots, a, b, `toan lớp ${g}`); count++; }
}

const write = (file, obj) => {
    const eol = fs.readFileSync(file, 'utf8').includes('\r\n') ? '\r\n' : '\n';
    fs.writeFileSync(file, JSON.stringify(obj, null, 2).replace(/\n/g, eol) + eol, 'utf8');
};
write(KY_FILE, ky);
write(GRADE_FILE, grade);
console.log(`Xong: viết lại ${Object.values(TOAN_GHK1).flat().length} câu Toán, sửa ${count} chỗ.`);

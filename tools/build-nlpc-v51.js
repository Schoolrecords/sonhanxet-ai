/**
 * build-nlpc-v51.js — Bổ sung ngân hàng nhận xét NL/PC cho V5.1
 *
 * Rev 2 (2026-05-19): Rewrite TOÀN BỘ 450 phrase bám 100% phong cách
 * THDiễn Liên (theo 11 mẫu Vnedu thực anh user gửi).
 *
 * Đặc trưng phong cách mẫu:
 *   - Tier ht (Đ — phổ biến nhất): 90%+ phrase có locator quen thuộc:
 *     "theo hướng dẫn của thầy cô", "qua từng tuần học",
 *     "trong các hoạt động chung của lớp", "trên lớp", "hằng ngày",
 *     "ở nhà", "trong giờ học", "theo yêu cầu của bài học",
 *     "vào thực tế", "từng bước một", "đều đặn hơn".
 *   - Opening tier ht: "Em có ý thức...", "Em có tiến bộ trong...",
 *     "Em đã hiểu...", "Em đã biết...", "Em đã có ý thức...",
 *     "Em chuyên cần đi học...", "Em yêu cái đẹp...",
 *     "Em tham gia tích cực...".
 *   - 3 ô "Nhận xét chung" số vế BIẾN THIÊN 3-5 vế (không cố định),
 *     nội dung trộn linh hoạt như GV viết tay — kết bằng "Cần X" định
 *     hướng rèn luyện.
 *
 * Mục tiêu số liệu:
 *   - 3 ô "Nhận xét chung": 10 phrase × 3 tier = 30 phrase/ô (tổng 90)
 *   - 15 field chi tiết: 8 phrase × 3 tier = 24 phrase/field (tổng 360)
 *   - TỔNG: 450 phrase
 *   - Tier ht: 95%+ có locator (mục tiêu)
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'engine', 'data', 'nhanxet-ngan.json');

const NLPC_V51 = {
    nang_luc_chung: {
        nhan_xet_chung: {
            tot: [
                "Em chủ động tự học, mạnh dạn giao tiếp với bạn bè trên lớp; Hợp tác tốt trong các hoạt động chung; Biết suy nghĩ và giải quyết vấn đề linh hoạt theo yêu cầu của bài học.",
                "Em có ý thức tự học cao, hoàn thành nhiệm vụ không cần nhắc nhở; Mạnh dạn trao đổi với bạn trong nhóm; Linh hoạt khi gặp tình huống mới qua từng tuần học.",
                "Em chủ động lập kế hoạch học tập hằng ngày; Tích cực phối hợp với bạn trong các hoạt động chung của lớp; Sáng tạo trong cách giải quyết bài tập.",
                "Em tự giác trong học tập; Mạnh dạn nêu ý kiến trong giờ học; Có tư duy độc lập, cố gắng tự tìm câu trả lời cho bài tập qua từng tuần học.",
                "Em chủ động chuẩn bị bài trước khi đến lớp; Hợp tác hiệu quả với bạn trong nhóm; Phát hiện và giải quyết vấn đề nhanh nhạy theo yêu cầu của bài học.",
                "Em có tinh thần tự học cao, kiên trì với nhiệm vụ; Giao tiếp cởi mở, lắng nghe bạn trong các hoạt động chung của lớp; Linh hoạt và sáng tạo qua từng tuần học.",
                "Em độc lập trong học tập, biết kiểm soát công việc của mình; Mạnh dạn trình bày suy nghĩ với thầy cô và bạn; Suy luận tốt, đề xuất hướng giải quyết hợp lí.",
                "Em chủ động học hỏi, không ngại khó trong giờ học; Tích cực trao đổi cùng các bạn trong nhóm; Linh hoạt khi xử lí tình huống mới qua từng tuần học.",
                "Em tự quản lí việc học hằng ngày; Hòa nhã, tích cực với bạn bè trên lớp; Có tư duy sáng tạo trước các tình huống mới theo yêu cầu của bài học.",
                "Em chủ động hoàn thành nhiệm vụ học tập; Mạnh dạn hợp tác cùng các bạn trong các hoạt động chung của lớp; Biết phân tích và giải quyết vấn đề từng bước một."
            ],
            ht: [
                "Em có ý thức tự học, hoàn thành nhiệm vụ theo hướng dẫn của thầy cô; Tham gia hợp tác cùng các bạn trong nhóm; Bước đầu biết giải quyết vấn đề qua từng tuần học.",
                "Em hoàn thành nhiệm vụ học tập theo hướng dẫn; Tham gia trao đổi, hợp tác cùng các bạn; Cần mạnh dạn hơn khi xử lí tình huống mới.",
                "Em có ý thức tự học trên lớp; Đã biết hợp tác trong các hoạt động chung của lớp; Cần phát huy thêm khả năng tự giải quyết vấn đề từng bước một.",
                "Em chăm chỉ làm bài theo hướng dẫn của thầy cô; Hòa đồng trong các hoạt động chung của lớp; Bước đầu biết suy nghĩ tìm cách giải quyết bài tập.",
                "Em có nề nếp tự học hằng ngày; Tham gia hoạt động nhóm đầy đủ trên lớp; Cần luyện thêm tư duy sáng tạo qua từng tuần học.",
                "Em đã biết tự chuẩn bị bài ở nhà; Trao đổi với bạn khi cần trong giờ học; Đã giải quyết được các vấn đề học tập đơn giản theo yêu cầu của bài học.",
                "Em có tiến bộ trong việc tự học hằng ngày; Mạnh dạn hơn khi giao tiếp với bạn trong các hoạt động chung của lớp; Bước đầu biết tự tìm hướng giải quyết.",
                "Em hoàn thành nhiệm vụ ở mức đạt theo hướng dẫn; Hợp tác cùng bạn trong nhóm nhỏ trên lớp; Cần kiên trì hơn khi gặp bài khó qua từng tuần học.",
                "Em đã tự giác hơn trong học tập hằng ngày; Đã quen với hoạt động nhóm trên lớp; Cần mạnh dạn đề xuất ý tưởng riêng trong các hoạt động chung của lớp.",
                "Em có nề nếp học tập tương đối tốt theo hướng dẫn của thầy cô; Biết phối hợp với bạn cùng bàn trong giờ học; Bước đầu xử lí được các tình huống quen thuộc."
            ],
            cht: [
                "Em ngoan, lễ phép với thầy cô và bạn bè; Cần cố gắng tự giác hơn trong học tập hằng ngày; Thầy cô và gia đình cùng hỗ trợ em rèn kĩ năng giao tiếp, hợp tác qua từng tuần học.",
                "Em đã có cố gắng bước đầu; Cần chủ động hơn trong tự học ở nhà và mạnh dạn giao tiếp trên lớp; Rất cần sự động viên thường xuyên của thầy cô và người thân.",
                "Em đã có nỗ lực ban đầu; Cần rèn thói quen tự học hằng ngày và làm việc nhóm trong các hoạt động chung của lớp; Rất cần sự khích lệ của thầy cô, cha mẹ.",
                "Em ngoan và chuyên cần đi học; Cần luyện ý thức tự chuẩn bị bài ở nhà và mạnh dạn trao đổi với bạn trên lớp; Gia đình phối hợp cùng thầy cô nhắc nhở em mỗi ngày.",
                "Em hiền lành, biết nghe lời thầy cô; Cần kiên trì hơn trong tự học hằng ngày và mạnh dạn hơn khi nêu ý kiến trong giờ học; Thầy cô và gia đình đồng hành cùng em từng bước một.",
                "Em đã có tiến bộ nhỏ trên lớp; Cần luyện thói quen tự giác và kĩ năng hợp tác trong các hoạt động chung của lớp; Rất cần sự kiên trì hỗ trợ từ gia đình.",
                "Em ngoan và lễ phép với thầy cô; Cần rèn nề nếp tự học hằng ngày và mạnh dạn hơn khi giao tiếp với bạn; Thầy cô và bạn sẽ giúp em từng việc nhỏ.",
                "Em đã có cố gắng, hãy lập thời gian biểu để học đều đặn ở nhà; Hãy mạnh dạn cùng bạn tham gia hoạt động nhóm trên lớp; Gia đình động viên em mỗi ngày.",
                "Em hiền và chăm chỉ; Cần luyện sự tự tin khi nói trước nhóm và thói quen tự giải quyết bài tập qua từng tuần học; Rất cần sự kiên trì của thầy cô và gia đình.",
                "Em sẽ tiến bộ hơn, hãy chủ động làm bài tập về nhà hằng ngày; Mạnh dạn hỏi bạn khi chưa hiểu trong giờ học; Gia đình theo dõi và động viên em thường xuyên."
            ]
        },
        tu_chu_tu_hoc: {
            tot: [
                "Em chủ động học tập, có ý thức tự giác cao trong giờ học và ở nhà.",
                "Em biết tự lập kế hoạch và hoàn thành nhiệm vụ học tập tốt qua từng tuần học.",
                "Em tự tin trong học tập, biết quản lí thời gian hợp lí hằng ngày.",
                "Em có ý thức tự học cao, chủ động tìm tòi kiến thức mới theo yêu cầu của bài học.",
                "Em tự giác cao trong học tập, biết tự đặt mục tiêu và thực hiện đến cùng.",
                "Em chủ động chuẩn bị bài trước khi đến lớp và làm bài tập đầy đủ ở nhà.",
                "Em biết tự kiểm tra lại bài và sửa lỗi qua từng tuần học mà không cần nhắc nhở.",
                "Em có ý thức rất tốt trong việc tự học hằng ngày, luôn hoàn thành nhiệm vụ đúng hạn."
            ],
            ht: [
                "Em có tiến bộ trong việc tự giác học tập và rèn luyện hằng ngày.",
                "Em có ý thức tự học theo hướng dẫn của thầy cô, hoàn thành nhiệm vụ được giao.",
                "Em đã có nề nếp tự chuẩn bị bài và đồ dùng trước khi đến lớp qua từng tuần học.",
                "Em chăm chỉ học tập trên lớp, biết tự làm bài theo hướng dẫn từng bước một.",
                "Em đã tự giác làm bài tập về nhà hằng ngày theo yêu cầu của bài học.",
                "Em có ý thức học tập đều đặn, cần phát huy thêm tính chủ động qua từng tuần học.",
                "Em đã biết tự soạn sách vở theo thời khóa biểu, hoàn thành bài tập trên lớp.",
                "Em có thói quen học bài đều đặn ở nhà, cần cố gắng thêm khi gặp bài khó."
            ],
            cht: [
                "Em đã có cố gắng, cần rèn ý thức tự giác trong học tập hằng ngày theo hướng dẫn của thầy cô.",
                "Em ngoan và hiền, cần rèn thói quen tự soạn sách vở và làm bài đầy đủ ở nhà mỗi tối.",
                "Em đã có cố gắng, hãy lập thời gian biểu hằng ngày để học tập đều đặn hơn.",
                "Em sẽ tiến bộ hơn, hãy nhờ gia đình phối hợp hỗ trợ trong việc tự học ở nhà.",
                "Em ngoan và chuyên cần đi học, hãy luyện thói quen làm bài tập về nhà mỗi tối qua từng tuần học.",
                "Em đã có nỗ lực, hãy tự kiểm tra sách vở trước khi đến lớp theo hướng dẫn của thầy cô.",
                "Em hiền và lễ phép, cần kiên trì luyện nề nếp học bài đúng giờ hằng ngày.",
                "Em sẽ tiến bộ hơn, hãy bắt đầu từ những việc nhỏ ở nhà và làm đều đặn mỗi ngày."
            ]
        },
        giao_tiep_hop_tac: {
            tot: [
                "Em mạnh dạn tự tin khi giao tiếp với thầy cô và bạn bè trên lớp.",
                "Em có khả năng giao tiếp tốt, hợp tác hiệu quả trong các hoạt động chung của lớp.",
                "Em biết lắng nghe ý kiến của bạn, trình bày rõ ràng suy nghĩ trong giờ học.",
                "Em hòa nhã thân thiện với bạn bè, được mọi người yêu quý qua từng tuần học.",
                "Em giao tiếp cởi mở, biết tôn trọng và lắng nghe ý kiến của các bạn trong nhóm.",
                "Em chủ động phối hợp với bạn trong các hoạt động chung của lớp hằng ngày.",
                "Em biết cách thuyết phục bạn và cùng nhóm giải quyết nhiệm vụ theo yêu cầu của bài học.",
                "Em nói rõ ràng, lễ phép với thầy cô và thân thiện với bạn bè trên lớp."
            ],
            ht: [
                "Em đã biết giao tiếp lễ phép với thầy cô và hòa đồng với bạn trong giờ học.",
                "Em có ý thức hợp tác trong các hoạt động nhóm trên lớp theo hướng dẫn của thầy cô.",
                "Em đã mạnh dạn hơn trong giao tiếp với bạn bè qua từng tuần học.",
                "Em đã biết chào hỏi và tham gia trao đổi với bạn trong các hoạt động chung của lớp.",
                "Em hòa đồng với bạn cùng bàn, cần mạnh dạn hơn khi phát biểu trên lớp từng bước một.",
                "Em đã biết phối hợp với bạn để hoàn thành nhiệm vụ nhóm theo yêu cầu của bài học.",
                "Em có tiến bộ trong việc lắng nghe và đáp lời bạn lễ phép qua từng tuần học.",
                "Em đã quen với hoạt động nhóm trên lớp, cần chủ động chia sẻ ý kiến hằng ngày."
            ],
            cht: [
                "Em ngoan và hiền, cần mạnh dạn hơn khi giao tiếp với bạn và thầy cô trên lớp.",
                "Em đã có tiến bộ nhỏ, cần luyện thói quen hợp tác trong các hoạt động chung của lớp.",
                "Em đã có tiến bộ, hãy luyện cách lắng nghe bạn nói xong rồi mới trả lời trong giờ học.",
                "Em sẽ tiến bộ hơn, hãy cùng bạn thực hiện các nhiệm vụ học tập theo hướng dẫn của thầy cô.",
                "Em hiền lành, hãy mạnh dạn giơ tay phát biểu trong giờ học từng bước một.",
                "Em đã có cố gắng, hãy chủ động chào hỏi và bắt chuyện với bạn mỗi ngày trên lớp.",
                "Em ngoan và lễ phép với thầy cô, cần luyện cách trình bày ý kiến trước nhóm nhỏ qua từng tuần học.",
                "Em sẽ tự tin hơn, hãy nhờ gia đình cùng luyện trò chuyện ở nhà mỗi tối."
            ]
        },
        giai_quyet_van_de: {
            tot: [
                "Em có tư duy linh hoạt, biết tìm cách giải quyết vấn đề sáng tạo trong giờ học.",
                "Em phát hiện vấn đề nhanh, đưa ra giải pháp phù hợp theo yêu cầu của bài học.",
                "Em có khả năng tư duy sáng tạo, học hỏi linh hoạt và nhanh nhạy qua từng tuần học.",
                "Em biết suy luận logic, giải quyết tốt các tình huống học tập trên lớp.",
                "Em linh hoạt trước tình huống mới, biết phân tích và đề xuất hướng giải quyết.",
                "Em có óc quan sát tốt, thường tìm được cách làm hay khác bạn trong giờ học.",
                "Em chủ động đặt câu hỏi và tìm câu trả lời cho thắc mắc qua từng tuần học.",
                "Em biết vận dụng kiến thức đã học để giải quyết bài tập một cách thông minh."
            ],
            ht: [
                "Em có tư duy độc lập, cố gắng tự tìm câu trả lời cho bài tập qua từng tuần học.",
                "Em đã biết phát hiện vấn đề và tìm cách giải quyết đơn giản theo hướng dẫn của thầy cô.",
                "Em có tiến bộ trong việc suy nghĩ và giải quyết vấn đề trên lớp hằng ngày.",
                "Em đã biết suy nghĩ tìm cách làm khi gặp bài tập khó, cần phát huy thêm từng bước một.",
                "Em biết áp dụng cách giải quen thuộc vào bài tập tương tự theo yêu cầu của bài học.",
                "Em đã chịu khó suy nghĩ trước khi hỏi bạn hoặc thầy cô trong giờ học.",
                "Em có cố gắng phân tích đề bài qua từng tuần học, cần luyện thêm các tình huống mới.",
                "Em đã biết hỏi lại khi chưa hiểu và tự sửa lỗi cơ bản trên lớp."
            ],
            cht: [
                "Em ngoan và chăm chỉ, cần luyện thói quen suy nghĩ và đặt câu hỏi tích cực trong giờ học.",
                "Em đã có cố gắng, cần tự tin hơn khi giải quyết các tình huống học tập theo hướng dẫn của thầy cô.",
                "Em ngoan và chuyên cần, cần luyện đọc kĩ đề và suy nghĩ trước khi làm bài hằng ngày.",
                "Em đã có cố gắng, hãy mạnh dạn hỏi bạn khi chưa biết cách giải quyết trên lớp.",
                "Em sẽ tiến bộ hơn, hãy thử làm theo các bước nhỏ và kiên trì qua từng tuần học.",
                "Em hiền lành, hãy dành thêm thời gian suy nghĩ trước khi nhờ hỗ trợ trong giờ học.",
                "Em đã có nỗ lực, hãy luyện thói quen ghi nháp các bước trước khi làm bài ở nhà.",
                "Em sẽ tiến bộ hơn, hãy nhờ gia đình cùng suy nghĩ các bài tập khó tại nhà mỗi tối."
            ]
        }
    },
    nang_luc_dac_thu: {
        nhan_xet_chung: {
            tot: [
                "Em có năng lực ngôn ngữ tốt, diễn đạt rõ ràng trên lớp; Tính toán nhanh và chính xác; Hiểu biết khoa học, có óc thẩm mĩ; Tích cực rèn luyện thể chất hằng ngày.",
                "Em đọc viết lưu loát, dùng từ phong phú qua từng tuần học; Tư duy toán học tốt; Yêu khám phá khoa học và nghệ thuật; Khỏe mạnh, nhanh nhẹn trong giờ học.",
                "Em giao tiếp bằng ngôn ngữ mạch lạc; Vận dụng tính toán linh hoạt theo yêu cầu của bài học; Hiểu biết khoa học vững; Vận động khéo léo trong các hoạt động chung của lớp.",
                "Em phát triển toàn diện về ngôn ngữ, tính toán, khoa học, thẩm mĩ và thể chất qua từng tuần học.",
                "Em diễn đạt lưu loát trên lớp; Tính nhẩm và đặt tính chính xác; Yêu nghệ thuật; Năng động trong vận động hằng ngày.",
                "Em đọc to rõ ràng; Giải bài toán có lời văn tốt; Ham tìm hiểu tự nhiên; Vẽ hát có cảm xúc; Khéo léo trong giờ thể dục.",
                "Em viết câu mạch lạc, giàu hình ảnh; Tính toán nhanh, ít sai sót theo yêu cầu của bài học; Vận dụng kiến thức khoa học vào thực tế; Phối hợp vận động tốt.",
                "Em sử dụng tốt cả tiếng Việt và tiếng Anh trong giao tiếp; Tư duy toán học linh hoạt; Hiểu biết khoa học vững vàng qua từng tuần học; Bền bỉ trong vận động.",
                "Em diễn đạt suy nghĩ rõ ràng trên lớp; Tính toán cẩn thận; Hứng thú với các môn khoa học; Cảm thụ nghệ thuật tinh tế trong các hoạt động chung của lớp.",
                "Em có vốn ngôn ngữ phong phú; Vận dụng toán vào thực tế; Yêu khám phá khoa học; Sáng tạo trong sản phẩm nghệ thuật; Tích cực trong các giờ thể dục."
            ],
            ht: [
                "Em có tiến bộ về ngôn ngữ và tính toán; Biết quan sát, tìm hiểu khoa học; Cần phát huy thêm năng lực thẩm mĩ và thể chất.",
                "Em diễn đạt được ý của mình trong giờ học; Thực hiện được các phép tính cơ bản theo hướng dẫn của thầy cô; Bước đầu yêu thích khoa học và nghệ thuật; Tham gia đầy đủ các hoạt động thể chất.",
                "Em đạt yêu cầu cơ bản về ngôn ngữ, tính toán và các năng lực đặc thù khác qua từng tuần học.",
                "Em đọc viết được các câu đơn giản trên lớp; Làm được phép tính cơ bản; Biết quan sát tự nhiên; Tham gia vẽ hát; Vận động đúng động tác cơ bản hằng ngày.",
                "Em diễn đạt được ý chính bằng câu rõ ràng; Tính nhẩm các phép cơ bản; Có hứng thú với môn khoa học; Đã hoàn thành sản phẩm vẽ hát trên lớp.",
                "Em viết được câu đúng cấu trúc theo hướng dẫn của thầy cô; Thực hiện được các bài toán cơ bản; Biết liên hệ kiến thức khoa học với cuộc sống; Có ý thức thẩm mĩ; Khỏe mạnh.",
                "Em có tiến bộ trong giao tiếp tiếng Việt qua từng tuần học; Tính toán đúng các bài đơn giản; Quan sát được hiện tượng quen thuộc; Hoàn thành sản phẩm vẽ; Đạt các bài thể dục cơ bản.",
                "Em diễn đạt ý ngắn gọn rõ ràng trong giờ học; Đặt tính cẩn thận theo yêu cầu của bài học; Bước đầu tìm hiểu thế giới xung quanh; Vẽ hát theo yêu cầu; Tham gia thể dục đều đặn.",
                "Em đọc trôi chảy bài ngắn trên lớp; Làm đúng các phép tính chương trình; Có nhận thức cơ bản về tự nhiên - xã hội; Yêu thích hoạt động nghệ thuật trong các hoạt động chung của lớp.",
                "Em viết câu đúng chính tả cơ bản theo hướng dẫn; Tính nhẩm chính xác các phép cơ bản hằng ngày; Quan sát được sự vật quen thuộc; Tham gia thể dục có nề nếp."
            ],
            cht: [
                "Em ngoan và chăm chỉ; Cần luyện thêm kĩ năng đọc, viết và tính toán hằng ngày; Thầy cô và bạn đồng hành giúp em tiến bộ qua từng tuần học.",
                "Em đã có tiến bộ nhỏ trên lớp; Cần kiên trì rèn ngôn ngữ, tính toán và các kĩ năng đặc thù theo hướng dẫn của thầy cô; Rất cần sự hỗ trợ thường xuyên của gia đình.",
                "Em ngoan và chăm chỉ; Cần luyện thêm các kĩ năng đọc viết và tính toán ở nhà mỗi tối; Thầy cô và gia đình cùng em luyện tập từng kĩ năng nhỏ.",
                "Em đã có nỗ lực; Cần kiên trì rèn kĩ năng ngôn ngữ, tính toán và vận động hằng ngày; Thầy cô tin em sẽ vững vàng hơn qua từng tuần học.",
                "Em chuyên cần đi học; Cần tăng cường luyện tập các kĩ năng đặc thù dưới sự hướng dẫn của thầy cô; Rất cần sự đồng hành của gia đình ở nhà.",
                "Em hiền lành; Cần rèn thêm đọc viết, tính nhẩm và tham gia hoạt động nghệ thuật, thể chất trên lớp; Gia đình phối hợp luyện cùng em mỗi ngày.",
                "Em ngoan và lễ phép với thầy cô; Cần luyện kĩ năng đọc bài và làm phép tính cơ bản theo hướng dẫn; Thầy cô và bạn bè hỗ trợ em từng việc nhỏ.",
                "Em đã có cố gắng; Cần kiên trì luyện đọc viết, tính toán và rèn luyện thể chất hằng ngày; Gia đình theo dõi sát việc học của em ở nhà.",
                "Em chuyên cần và lễ phép; Cần luyện thêm kĩ năng đặt câu, làm tính và quan sát qua từng tuần học; Rất cần sự kiên trì khích lệ của người thân.",
                "Em sẽ tiến bộ hơn; Hãy luyện đọc và làm bài tập đều đặn ở nhà, mạnh dạn tham gia vẽ hát và thể dục trên lớp; Gia đình cùng em rèn từng bước một."
            ]
        },
        ngon_ngu: {
            tot: [
                "Em có vốn từ phong phú, diễn đạt mạch lạc và truyền cảm trong giờ học.",
                "Em sử dụng ngôn ngữ tốt cả trong nói và viết, lập luận rõ ràng trên lớp.",
                "Em đọc to rõ ràng, viết câu đúng và có hình ảnh sinh động qua từng tuần học.",
                "Em sử dụng từ ngữ phong phú, diễn đạt suy nghĩ trôi chảy và tự tin hằng ngày.",
                "Em viết đoạn văn mạch lạc, biết dùng từ gợi hình, gợi cảm theo yêu cầu của bài học.",
                "Em đọc diễn cảm, hiểu nội dung bài tốt và trả lời câu hỏi sâu sắc trên lớp.",
                "Em có khả năng giao tiếp tiếng Việt - tiếng Anh tự tin, phát âm rõ ràng trong giờ học.",
                "Em viết chính tả chính xác, trình bày bài đẹp và khoa học qua từng tuần học."
            ],
            ht: [
                "Em đã diễn đạt được ý chính bằng câu rõ ràng, cần phát huy thêm từng bước một.",
                "Em đã đạt được các kĩ năng ngôn ngữ cơ bản theo chương trình qua từng tuần học.",
                "Em biết diễn đạt ý của mình bằng câu nói rõ ràng và dễ hiểu trong giờ học.",
                "Em có tiến bộ trong việc sử dụng ngôn ngữ giao tiếp với thầy cô và bạn trên lớp.",
                "Em đọc đúng tốc độ, hiểu nội dung bài ở mức cơ bản theo hướng dẫn của thầy cô.",
                "Em viết câu đúng ngữ pháp theo yêu cầu của bài học, cần luyện thêm cách dùng từ phong phú.",
                "Em đã biết kể lại câu chuyện ngắn theo trình tự hợp lí trong giờ học.",
                "Em phát âm tiếng Anh được trên lớp, cần luyện thêm sự tự tin khi nói hằng ngày."
            ],
            cht: [
                "Em ngoan và hiền, cần luyện đọc to và viết các từ thường gặp ở nhà mỗi ngày.",
                "Em đã có cố gắng, hãy mạnh dạn kể chuyện hoặc đọc bài cho gia đình nghe mỗi tối.",
                "Em sẽ tiến bộ hơn, hãy luyện đặt câu ngắn với từ mới đã học trên lớp.",
                "Em chuyên cần đi học, hãy luyện viết chính tả mỗi ngày một đoạn ngắn theo hướng dẫn của thầy cô.",
                "Em hiền và lễ phép, hãy nhờ gia đình luyện đọc bài cùng em vào buổi tối qua từng tuần học.",
                "Em ngoan, hãy luyện phát âm rõ ràng từng từ trước khi đọc cả câu trong giờ học.",
                "Em đã có nỗ lực, hãy chép lại các từ khó và đọc lại nhiều lần ở nhà mỗi tối.",
                "Em sẽ tiến bộ hơn, hãy mạnh dạn trả lời câu hỏi của thầy cô bằng câu đầy đủ trên lớp."
            ]
        },
        tinh_toan: {
            tot: [
                "Em có tư duy toán học tốt, tính nhẩm nhanh và chính xác cao trong giờ học.",
                "Em vận dụng linh hoạt kiến thức toán vào giải bài tập theo yêu cầu của bài học.",
                "Em tính toán cẩn thận, ít sai sót và trình bày khoa học qua từng tuần học.",
                "Em tính nhẩm nhanh, vận dụng linh hoạt vào giải toán có lời văn trên lớp.",
                "Em đặt tính chính xác, hiểu nhanh các dạng toán mới hằng ngày.",
                "Em biết suy luận và tìm nhiều cách giải khác nhau cho cùng một bài toán.",
                "Em phân tích đề tốt, lập kế hoạch giải bài rõ ràng theo yêu cầu của bài học.",
                "Em vận dụng tốt phép tính vào tình huống thực tế trong cuộc sống hằng ngày."
            ],
            ht: [
                "Em có tiến bộ trong tính toán và giải các bài toán đơn giản theo yêu cầu của bài học.",
                "Em đã làm được các phép tính cơ bản theo hướng dẫn của thầy cô qua từng tuần học.",
                "Em chăm chỉ luyện tập, thực hiện đúng các phép tính theo yêu cầu của bài học hằng ngày.",
                "Em thực hiện được phép tính cơ bản và giải bài toán đơn giản trong giờ học.",
                "Em đã biết đặt tính và tính đúng các phép cộng, trừ, nhân, chia trên lớp.",
                "Em đọc hiểu đề toán có lời văn ở mức cơ bản theo hướng dẫn từng bước một.",
                "Em đã tính toán cẩn thận hơn qua từng tuần học, cần luyện thêm các bài có nhiều bước.",
                "Em có nề nếp trình bày bài toán rõ ràng, cần luyện tốc độ tính nhẩm hằng ngày."
            ],
            cht: [
                "Em ngoan và chăm chỉ, cần luyện thêm các phép tính cơ bản và tính nhẩm ở nhà mỗi tối.",
                "Em đã có cố gắng, cần luyện tính nhẩm và làm bài tập trong vở mỗi tối theo hướng dẫn của thầy cô.",
                "Em ngoan và chăm chỉ, cần ôn lại các phép tính cơ bản và luyện tính nhẩm mỗi ngày qua từng tuần học.",
                "Em đã có cố gắng, hãy đọc kĩ đề và đặt tính cẩn thận trước khi làm bài trên lớp.",
                "Em sẽ tiến bộ hơn, hãy nhờ thầy cô hướng dẫn từng dạng toán cơ bản trong giờ học.",
                "Em chuyên cần đi học, cần kiên trì làm bài tập về nhà và kiểm tra lại kết quả hằng ngày.",
                "Em hiền lành, hãy luyện bảng cộng - trừ - nhân - chia ở nhà mỗi ngày một ít.",
                "Em sẽ tiến bộ hơn, hãy nhờ gia đình cùng luyện toán vào giờ tối mỗi ngày."
            ]
        },
        khoa_hoc: {
            tot: [
                "Em yêu thích môn Khoa học, biết quan sát và đặt câu hỏi sâu sắc trong giờ học.",
                "Em có tư duy khoa học, biết suy luận và giải thích hiện tượng quanh mình qua từng tuần học.",
                "Em ham học hỏi, có hiểu biết rộng về tự nhiên, lịch sử và địa lí trên lớp.",
                "Em biết vận dụng kiến thức Khoa học - Lịch sử - Địa lí vào thực tế hằng ngày.",
                "Em quan sát tinh tế, liên hệ tốt kiến thức khoa học với thực tế cuộc sống.",
                "Em chủ động đọc thêm tài liệu ở nhà, mở rộng hiểu biết qua từng tuần học.",
                "Em có niềm say mê khám phá tự nhiên trong giờ học, kết nối được nhiều hiện tượng.",
                "Em ghi nhớ tốt các sự kiện lịch sử và đặc điểm địa lí Việt Nam theo yêu cầu của bài học."
            ],
            ht: [
                "Em đã hiểu các kiến thức khoa học cơ bản, cần vận dụng thêm vào thực tế.",
                "Em đã nắm được kiến thức Khoa học - Lịch sử - Địa lí cơ bản theo chương trình qua từng tuần học.",
                "Em có ý thức tìm hiểu thế giới xung quanh, đặt câu hỏi phù hợp trong giờ học.",
                "Em biết quan sát và mô tả các sự vật, hiện tượng đã học theo hướng dẫn của thầy cô.",
                "Em ghi nhớ được các sự kiện và mốc lịch sử cơ bản trên lớp.",
                "Em nhận biết được vị trí địa lí và một số đặc điểm tự nhiên Việt Nam theo yêu cầu của bài học.",
                "Em có tiến bộ trong việc liên hệ bài học với hiện tượng quen thuộc hằng ngày.",
                "Em đã biết phân biệt các hiện tượng tự nhiên thường gặp trong các hoạt động chung của lớp."
            ],
            cht: [
                "Em ngoan và chuyên cần, cần luyện quan sát và đặt câu hỏi về thế giới xung quanh trong giờ học.",
                "Em đã có cố gắng, cần chủ động tìm hiểu thêm kiến thức khoa học theo hướng dẫn của thầy cô.",
                "Em đã có cố gắng, hãy thử thí nghiệm đơn giản tại nhà cùng gia đình mỗi tối.",
                "Em sẽ tiến bộ hơn, hãy mạnh dạn đặt câu hỏi khi gặp hiện tượng lạ trên lớp.",
                "Em hiền lành, hãy luyện ghi nhớ các sự kiện lịch sử và địa danh đã học qua từng tuần học.",
                "Em ngoan, hãy chăm xem chương trình tìm hiểu thiên nhiên ở nhà hằng ngày.",
                "Em chuyên cần đi học, hãy đọc lại bài Khoa học và mô tả lại cho gia đình nghe mỗi tối.",
                "Em sẽ tiến bộ hơn, hãy quan sát kĩ một sự vật và viết ra điều em thấy theo hướng dẫn."
            ]
        },
        tham_mi: {
            tot: [
                "Em có óc thẩm mĩ tốt, biết cảm thụ cái đẹp trong cuộc sống hằng ngày.",
                "Em yêu nghệ thuật, sáng tạo trong vẽ tranh và ca hát trên lớp.",
                "Em biết tạo ra sản phẩm đẹp, có ý tưởng độc đáo qua từng tuần học.",
                "Em cảm thụ cái đẹp tinh tế, sáng tạo trong các hoạt động nghệ thuật theo yêu cầu của bài học.",
                "Em hát đúng giai điệu, biểu cảm tốt và tự tin biểu diễn trước lớp trong giờ học.",
                "Em vẽ tranh có bố cục cân đối, màu sắc hài hòa và giàu cảm xúc trên lớp.",
                "Em có gu thẩm mĩ riêng, biết chọn màu và phối hợp đường nét đẹp qua từng tuần học.",
                "Em biết trang trí sản phẩm thủ công khéo léo trong các hoạt động chung của lớp."
            ],
            ht: [
                "Em yêu cái đẹp, đã hoàn thành cơ bản các sản phẩm vẽ và hát trên lớp.",
                "Em đã đạt được các yêu cầu cơ bản về vẽ và ca hát theo chương trình qua từng tuần học.",
                "Em có tiến bộ trong các hoạt động nghệ thuật và thẩm mĩ trong giờ học.",
                "Em biết yêu cái đẹp, giữ gìn sản phẩm và đồ dùng cá nhân hằng ngày.",
                "Em đã hát đúng các bài hát ngắn theo yêu cầu của bài học trên lớp.",
                "Em vẽ được các sự vật quen thuộc theo hướng dẫn của thầy cô, cần luyện thêm cách phối màu.",
                "Em có ý thức giữ gìn vệ sinh và trang trí góc học tập gọn gàng ở nhà.",
                "Em tham gia đầy đủ các tiết Âm nhạc, Mĩ thuật trên lớp và có sản phẩm hoàn chỉnh."
            ],
            cht: [
                "Em ngoan và hiền, cần luyện thêm kĩ năng vẽ tranh và ca hát ở nhà mỗi tối.",
                "Em đã có cố gắng, cần mạnh dạn tham gia hoạt động nghệ thuật hơn trên lớp.",
                "Em ngoan và hiền, cần luyện hát đúng giai điệu và vẽ tranh đơn giản theo hướng dẫn của thầy cô.",
                "Em đã có cố gắng, hãy mạnh dạn biểu diễn và sáng tạo trong tranh vẽ qua từng tuần học.",
                "Em sẽ tiến bộ hơn, hãy quan sát cái đẹp xung quanh và tập diễn đạt bằng hình vẽ hằng ngày.",
                "Em chuyên cần, hãy luyện hát theo bài mẫu ở nhà mỗi ngày một lượt.",
                "Em hiền lành, hãy nhờ gia đình cùng vẽ tranh và trang trí góc học tập mỗi tối.",
                "Em sẽ tiến bộ hơn, hãy mạnh dạn nói lên điều em thấy đẹp trong giờ học."
            ]
        },
        the_chat: {
            tot: [
                "Em có thể lực tốt, nhanh nhẹn và khéo léo trong vận động trên lớp.",
                "Em yêu thể thao, thực hiện đúng các động tác và bài tập trong giờ học.",
                "Em có ý thức rèn luyện sức khỏe, chăm chỉ tập luyện hằng ngày.",
                "Em năng động trong các hoạt động thể chất, sức khỏe rất tốt qua từng tuần học.",
                "Em vận động khéo léo, có sức bền tốt và phối hợp nhịp nhàng với bạn trong các hoạt động chung của lớp.",
                "Em chơi tốt các trò chơi vận động, có tinh thần đồng đội cao trên lớp.",
                "Em chấp hành đúng kỉ luật giờ Thể dục theo hướng dẫn của thầy cô, luôn tích cực tập luyện.",
                "Em biết giữ vệ sinh cá nhân và chế độ ăn uống hợp lí hằng ngày."
            ],
            ht: [
                "Em tham gia tích cực các hoạt động thể chất trong giờ học trong các hoạt động chung của lớp.",
                "Em đã thực hiện được các động tác thể dục cơ bản theo yêu cầu của bài học.",
                "Em có sức khỏe ổn định, đã đạt các bài tập thể lực chương trình qua từng tuần học.",
                "Em có ý thức tập thể dục đều đặn theo hướng dẫn của thầy cô, cần luyện thêm sự dẻo dai.",
                "Em đã thuộc và làm đúng các động tác bài thể dục đầu giờ trên lớp.",
                "Em chơi được các trò chơi vận động, cần phối hợp tốt hơn với bạn trong giờ học.",
                "Em có nề nếp tập luyện đều đặn hằng ngày, cần luyện thêm sức bền từng bước một.",
                "Em đã chú ý hơn đến vệ sinh và rèn luyện sức khỏe ở nhà mỗi ngày."
            ],
            cht: [
                "Em hiền lành, cần chăm chỉ tập thể dục đều đặn hằng ngày để khỏe mạnh hơn.",
                "Em đã có cố gắng, hãy tham gia tích cực hơn vào các hoạt động vận động trên lớp.",
                "Em ngoan, hãy luyện các động tác thể dục đầu giờ cùng cả lớp theo hướng dẫn của thầy cô.",
                "Em sẽ khỏe hơn, hãy duy trì thói quen vận động mỗi ngày 15 - 20 phút ở nhà.",
                "Em chuyên cần, hãy cùng bạn chơi các trò vận động ngoài trời sau giờ học mỗi ngày.",
                "Em hiền và lễ phép, hãy nhờ gia đình cùng tập thể dục buổi sáng hằng ngày.",
                "Em đã có nỗ lực, hãy luyện đi đều và xếp hàng nhanh nhẹn trong giờ học từng bước một.",
                "Em sẽ tiến bộ hơn, hãy giữ vệ sinh cá nhân và ăn uống đủ chất ở nhà mỗi ngày."
            ]
        },
        cong_nghe: {
            tot: [
                "Em có tư duy công nghệ tốt, biết sử dụng đồ dùng học tập sáng tạo trong giờ học.",
                "Em khéo tay, tạo được các sản phẩm thủ công đẹp và chắc chắn trên lớp.",
                "Em biết vận dụng kiến thức công nghệ vào việc làm sản phẩm thực tế hằng ngày.",
                "Em có ý tưởng sáng tạo khi làm thủ công, đồ chơi và mô hình qua từng tuần học.",
                "Em sử dụng dụng cụ an toàn, làm việc cẩn thận theo yêu cầu của bài học.",
                "Em biết kết hợp vật liệu khác nhau để tạo sản phẩm thẩm mĩ trong các hoạt động chung của lớp.",
                "Em thực hiện đúng quy trình các bước làm sản phẩm thủ công theo hướng dẫn của thầy cô.",
                "Em quan tâm tìm hiểu các thiết bị quen thuộc trong gia đình hằng ngày."
            ],
            ht: [
                "Em đã làm được các sản phẩm công nghệ cơ bản theo hướng dẫn của thầy cô.",
                "Em có tiến bộ trong việc sử dụng dụng cụ thủ công an toàn qua từng tuần học.",
                "Em biết quan sát và làm theo các bước hướng dẫn của bài trong giờ học.",
                "Em hoàn thành sản phẩm ở mức đạt yêu cầu của bài học, cần phát huy sự khéo léo từng bước một.",
                "Em đã biết phân biệt và sử dụng đúng các vật liệu thủ công cơ bản trên lớp.",
                "Em có ý thức giữ gìn dụng cụ và làm vệ sinh sau khi học trong các hoạt động chung của lớp.",
                "Em đã làm được mô hình đơn giản theo mẫu trên lớp hằng ngày.",
                "Em có tiến bộ trong việc nhận biết các thiết bị công nghệ quen thuộc ở nhà."
            ],
            cht: [
                "Em ngoan và chăm chỉ, cần luyện kĩ năng làm thủ công đơn giản ở nhà mỗi tối.",
                "Em đã có cố gắng, hãy mạnh dạn sử dụng dụng cụ học tập theo hướng dẫn của thầy cô.",
                "Em hiền lành, hãy luyện cắt dán và gấp giấy theo các mẫu đơn giản qua từng tuần học.",
                "Em sẽ tiến bộ hơn, hãy nhờ gia đình cùng làm các sản phẩm thủ công hằng ngày.",
                "Em chuyên cần, hãy chú ý quan sát các bước trước khi bắt tay vào làm trong giờ học.",
                "Em đã có nỗ lực, hãy luyện sự tỉ mỉ và cẩn thận khi làm sản phẩm trên lớp.",
                "Em ngoan, hãy luyện cách sử dụng kéo, hồ dán an toàn theo hướng dẫn của thầy cô.",
                "Em sẽ tiến bộ hơn, hãy luyện làm theo từng bước nhỏ và kiên trì ở nhà mỗi ngày."
            ]
        },
        tin_hoc: {
            tot: [
                "Em có năng khiếu Tin học, sử dụng máy tính thành thạo cho việc học trên lớp.",
                "Em làm chủ các thao tác cơ bản với chuột, bàn phím và phần mềm học tập trong giờ học.",
                "Em biết tìm kiếm thông tin an toàn, có hiểu biết về tin học cơ bản qua từng tuần học.",
                "Em tư duy logic tốt, học các phần mềm và trò chơi giáo dục nhanh theo yêu cầu của bài học.",
                "Em biết soạn thảo văn bản đơn giản và trình bày khoa học hằng ngày.",
                "Em sử dụng phần mềm vẽ, trình chiếu sáng tạo và có ý tưởng riêng trên lớp.",
                "Em hiểu được nguyên tắc bảo mật thông tin cá nhân khi dùng máy tính trong giờ học.",
                "Em chấp hành tốt quy tắc sử dụng phòng máy và thiết bị chung theo hướng dẫn của thầy cô."
            ],
            ht: [
                "Em đã thực hiện được các thao tác Tin học cơ bản theo chương trình qua từng tuần học.",
                "Em biết sử dụng chuột, bàn phím và làm theo hướng dẫn của thầy cô trong giờ học.",
                "Em có tiến bộ trong việc thao tác với các phần mềm học tập đơn giản trên lớp.",
                "Em đã làm quen với máy tính, cần luyện thêm tốc độ thao tác hằng ngày.",
                "Em biết mở và đóng phần mềm cơ bản, lưu được file đơn giản theo yêu cầu của bài học.",
                "Em đã soạn thảo được câu ngắn trên lớp, cần luyện thêm cách trình bày từng bước một.",
                "Em chấp hành nội quy phòng máy tốt, giữ gìn thiết bị cẩn thận trong giờ học.",
                "Em đã biết cách tra cứu thông tin đơn giản theo hướng dẫn của thầy cô qua từng tuần học."
            ],
            cht: [
                "Em ngoan và chuyên cần, cần luyện các thao tác chuột, bàn phím cơ bản trong giờ học.",
                "Em đã có cố gắng, hãy luyện gõ phím và mở phần mềm theo hướng dẫn của thầy cô.",
                "Em hiền lành, hãy chú ý quan sát thầy cô trước khi thao tác trên máy trên lớp.",
                "Em sẽ tiến bộ hơn, hãy luyện đánh máy chậm mà chính xác ở nhà mỗi tối.",
                "Em chuyên cần đi học, hãy giữ gìn máy tính và làm theo từng bước nhỏ qua từng tuần học.",
                "Em đã có nỗ lực, hãy mạnh dạn hỏi bạn khi chưa biết thao tác trong giờ học.",
                "Em ngoan, hãy luyện sử dụng các phần mềm giáo dục thân thiện ở nhà hằng ngày.",
                "Em sẽ tiến bộ hơn, hãy nhờ gia đình hướng dẫn các thao tác đơn giản mỗi tối."
            ]
        }
    },
    pham_chat: {
        nhan_xet_chung: {
            tot: [
                "Em yêu quê hương, đất nước; Hòa nhã, nhân ái với bạn bè trên lớp; Chăm chỉ học tập hằng ngày; Trung thực, có trách nhiệm trong mọi nhiệm vụ.",
                "Em kính trọng thầy cô, biết ơn gia đình; Yêu thương bạn bè trong các hoạt động chung của lớp; Cần cù, chịu khó qua từng tuần học; Hoàn thành tốt mọi việc được giao.",
                "Em tự hào về truyền thống quê hương; Quan tâm giúp đỡ bạn trên lớp; Chăm chỉ rèn luyện hằng ngày; Có ý thức trách nhiệm cao với tập thể.",
                "Em yêu trường lớp, kính trên nhường dưới; Nhân ái với bạn bè; Cần cù học tập qua từng tuần học; Trung thực với thầy cô và gia đình.",
                "Em yêu Tổ quốc; Hòa đồng và yêu thương bạn bè trong các hoạt động chung của lớp; Chuyên cần học tập; Thẳng thắn, trung thực trong giờ học.",
                "Em yêu quê hương, tôn trọng truyền thống; Lễ phép với thầy cô, hòa đồng với bạn; Chăm chỉ, kiên trì qua từng tuần học; Có trách nhiệm với nhiệm vụ chung.",
                "Em yêu trường lớp, kính trọng thầy cô; Biết quan tâm, chia sẻ với bạn trên lớp; Có ý thức học tập đều đặn hằng ngày; Hoàn thành tốt mọi việc được giao.",
                "Em có lòng yêu nước; Sống nhân ái, hòa nhã với mọi người; Chăm chỉ trong học tập và lao động; Có ý thức trách nhiệm với tập thể qua từng tuần học.",
                "Em tự hào về truyền thống dân tộc; Yêu thương, giúp đỡ bạn bè trong các hoạt động chung của lớp; Cần cù học tập theo hướng dẫn của thầy cô; Đảm nhận tốt nhiệm vụ.",
                "Em yêu quê hương; Hòa nhã với mọi người trên lớp; Có ý thức học tập cao hằng ngày; Trung thực, biết nhận lỗi và có tinh thần trách nhiệm."
            ],
            ht: [
                "Em yêu quê hương, biết ơn gia đình; Hòa nhã với bạn bè trên lớp; Có ý thức chăm chỉ học tập theo hướng dẫn; Trung thực; Cần phát huy thêm tinh thần trách nhiệm trong các hoạt động chung của lớp.",
                "Em yêu quê hương, trường lớp; Hòa nhã với bạn bè trên lớp; Có ý thức chăm chỉ học tập; Trung thực và biết nhận lỗi; Cần phát huy thêm tinh thần trách nhiệm.",
                "Em lễ phép với thầy cô và người lớn; Đối xử tốt với bạn trong các hoạt động chung của lớp; Có nề nếp học tập theo hướng dẫn; Cần chủ động hơn trong nhiệm vụ.",
                "Em biết yêu trường lớp; Hòa đồng với bạn bè qua từng tuần học; Chăm chỉ ở mức cơ bản hằng ngày; Cần phát huy tinh thần trách nhiệm.",
                "Em yêu gia đình và trường lớp; Quan tâm bạn bè trên lớp; Có cố gắng trong học tập theo hướng dẫn của thầy cô; Cần nỗ lực hơn ở việc chung.",
                "Em tôn trọng thầy cô và bạn; Có nề nếp cơ bản qua từng tuần học; Học tập đều đặn hằng ngày; Cần chủ động hơn trong các hoạt động chung của lớp.",
                "Em yêu quê hương; Hòa nhã với bạn cùng lớp trong giờ học; Chăm chỉ học bài ở nhà; Trung thực với thầy cô; Đã hoàn thành nhiệm vụ được giao.",
                "Em kính trọng thầy cô trên lớp; Yêu mến bạn bè trong các hoạt động chung của lớp; Có ý thức học bài đều đặn hằng ngày; Cần phát huy tinh thần trách nhiệm.",
                "Em yêu trường lớp; Đối xử lễ phép với người lớn; Học tập đều đặn theo hướng dẫn của thầy cô; Trung thực; Cần cố gắng hơn ở việc chung qua từng tuần học.",
                "Em biết yêu quê hương; Hòa đồng với bạn trên lớp; Chăm chỉ làm bài hằng ngày; Biết nhận lỗi khi sai; Bước đầu có trách nhiệm với nhiệm vụ được giao."
            ],
            cht: [
                "Em ngoan và lễ phép với thầy cô; Hòa đồng với bạn trên lớp; Cần chăm chỉ hơn trong học tập hằng ngày và trung thực trong lời nói; Cần phát huy tinh thần trách nhiệm với nhiệm vụ chung.",
                "Em hiền lành, biết nghe lời thầy cô; Cần luyện thói quen chăm học mỗi tối và mạnh dạn nhận lỗi; Cần cố gắng hơn trong các hoạt động chung của lớp.",
                "Em yêu trường lớp và bạn bè; Cần kiên trì hơn trong học tập qua từng tuần học; Trung thực với thầy cô; Cần có trách nhiệm hơn với nhiệm vụ được giao.",
                "Em ngoan và hiền; Cần chăm chỉ học bài và làm bài ở nhà hằng ngày; Tập thói quen nói thật; Cần phát huy tinh thần trách nhiệm trong các hoạt động chung của lớp.",
                "Em lễ phép với thầy cô; Cần cố gắng học tập đều đặn theo hướng dẫn; Trung thực với gia đình; Có ý thức trách nhiệm hơn trong việc chung trên lớp.",
                "Em hiền lành; Hãy chăm học bài ở nhà mỗi tối; Mạnh dạn nhận lỗi khi sai trong giờ học; Hoàn thành nhiệm vụ được giao đúng hạn.",
                "Em ngoan; Cần luyện thói quen chăm chỉ qua từng tuần học; Trung thực với thầy cô và bạn; Cần có trách nhiệm hơn trong tập thể lớp.",
                "Em yêu gia đình và trường lớp; Hãy chăm chỉ học tập hơn ở nhà hằng ngày; Trung thực trong lời nói; Có trách nhiệm với nhiệm vụ được giao theo hướng dẫn của thầy cô.",
                "Em chuyên cần đi học; Cần luyện sự kiên trì khi làm bài ở nhà mỗi tối; Trung thực với thầy cô; Tích cực tham gia hoạt động chung của lớp.",
                "Em ngoan và lễ phép; Hãy chăm chỉ hơn trong học tập và rèn luyện hằng ngày; Trung thực với mọi người; Có trách nhiệm hoàn thành công việc được giao trên lớp."
            ]
        },
        yeu_nuoc: {
            tot: [
                "Em yêu quê hương, đất nước, tự hào về truyền thống dân tộc qua từng tuần học.",
                "Em kính trọng Bác Hồ, các anh hùng dân tộc và thầy cô trên lớp.",
                "Em yêu trường lớp, có ý thức giữ gìn cảnh quan nơi em sống hằng ngày.",
                "Em quan tâm tìm hiểu lịch sử, văn hóa và danh lam của quê hương qua các bài học trên lớp.",
                "Em chủ động tham gia các hoạt động kỉ niệm ngày lễ lớn trong các hoạt động chung của lớp.",
                "Em yêu thiên nhiên, có ý thức bảo vệ môi trường xung quanh ở nhà và trên lớp.",
                "Em tự hào khi nhắc đến quê hương và biết ơn các thế hệ đi trước qua từng tuần học.",
                "Em yêu lá cờ Tổ quốc, hát Quốc ca trang nghiêm và đầy cảm xúc trong giờ chào cờ."
            ],
            ht: [
                "Em đã hiểu về truyền thống dân tộc qua các bài học trên lớp qua từng tuần học.",
                "Em yêu quê hương, trường lớp và biết ơn gia đình hằng ngày.",
                "Em đã biết tôn trọng các biểu tượng của đất nước theo hướng dẫn của thầy cô.",
                "Em có ý thức giữ gìn vệ sinh trường lớp và môi trường xung quanh trên lớp.",
                "Em tham gia đầy đủ các hoạt động kỉ niệm ngày lễ ở trường trong các hoạt động chung của lớp.",
                "Em đã hát Quốc ca đúng giai điệu trong giờ chào cờ qua từng tuần học.",
                "Em biết tên các anh hùng dân tộc tiêu biểu đã học theo yêu cầu của bài học.",
                "Em đã quan tâm hơn đến các sự kiện văn hóa của quê hương qua các bài học trên lớp."
            ],
            cht: [
                "Em ngoan, hãy chú ý lắng nghe thầy cô kể chuyện về quê hương đất nước trong giờ học.",
                "Em hiền lành, cần luyện hát Quốc ca và đứng nghiêm trang khi chào cờ trên lớp.",
                "Em đã có cố gắng, hãy cùng gia đình tìm hiểu về lịch sử quê hương hằng ngày.",
                "Em chuyên cần, hãy giữ vệ sinh trường lớp và môi trường xung quanh theo hướng dẫn của thầy cô.",
                "Em sẽ tiến bộ hơn, hãy tham gia tích cực các hoạt động kỉ niệm ở trường qua từng tuần học.",
                "Em ngoan và lễ phép, hãy bày tỏ lòng kính trọng với Bác Hồ và các anh hùng trong giờ học.",
                "Em hiền, hãy chăm sóc cây xanh trong sân trường và sân nhà mỗi ngày.",
                "Em sẽ tiến bộ hơn, hãy đọc các câu chuyện về truyền thống quê hương ở nhà mỗi tối."
            ]
        },
        nhan_ai: {
            tot: [
                "Em yêu thương, sẵn sàng giúp đỡ bạn bè trong học tập và sinh hoạt trên lớp.",
                "Em lễ phép với thầy cô, hòa nhã với bạn bè và người xung quanh hằng ngày.",
                "Em biết quan tâm, sẻ chia với bạn có hoàn cảnh khó khăn trong các hoạt động chung của lớp.",
                "Em biết nhường nhịn em nhỏ và kính trọng người lớn tuổi ở nhà và trên lớp.",
                "Em chủ động bênh vực bạn yếu khi gặp tình huống bất công trong giờ học.",
                "Em đối xử tốt với mọi người, được bạn bè quý mến qua từng tuần học.",
                "Em biết động viên bạn khi bạn buồn và chia vui khi bạn vui trong các hoạt động chung của lớp.",
                "Em yêu thương vật nuôi, cây cối và biết chăm sóc thiên nhiên xung quanh ở nhà."
            ],
            ht: [
                "Em đã có ý thức giúp đỡ bạn bè trong học tập và sinh hoạt theo hướng dẫn của thầy cô.",
                "Em đã biết yêu thương và chia sẻ với bạn bè trong các hoạt động chung của lớp.",
                "Em hòa nhã với bạn, lễ phép với thầy cô và người lớn hằng ngày.",
                "Em đã quan tâm giúp đỡ bạn khi bạn gặp khó khăn trên lớp.",
                "Em biết nhường nhịn bạn và em nhỏ ở nhà qua từng tuần học.",
                "Em có ý thức cùng bạn giữ tình đoàn kết trong các hoạt động chung của lớp.",
                "Em đã biết hỏi thăm bạn khi bạn nghỉ học hoặc gặp chuyện buồn trên lớp.",
                "Em đã biết chia sẻ đồ dùng học tập với bạn cùng bàn trong giờ học."
            ],
            cht: [
                "Em ngoan, hãy luyện thói quen quan tâm hỏi han bạn bè trong lớp hằng ngày.",
                "Em hiền lành, cần mạnh dạn giúp đỡ bạn khi bạn gặp khó khăn trên lớp.",
                "Em đã có cố gắng, hãy lễ phép chào hỏi thầy cô và người lớn mỗi ngày.",
                "Em chuyên cần, hãy luyện cách hòa nhã và nhường nhịn bạn trong các hoạt động chung của lớp.",
                "Em sẽ tiến bộ hơn, hãy chia sẻ đồ dùng và niềm vui với bạn bè qua từng tuần học.",
                "Em ngoan và lễ phép, hãy mạnh dạn hỏi thăm bạn khi bạn nghỉ học theo hướng dẫn của thầy cô.",
                "Em hiền, hãy luyện thói quen nói lời cảm ơn và xin lỗi đúng lúc trong giờ học.",
                "Em sẽ tiến bộ hơn, hãy yêu thương vật nuôi và cây cối quanh nhà mỗi ngày."
            ]
        },
        cham_chi: {
            tot: [
                "Em chăm chỉ học tập, có ý thức rèn luyện cao trong giờ học và ở nhà.",
                "Em kiên trì, nhẫn nại và không ngại khó khi gặp bài tập khó qua từng tuần học.",
                "Em chuyên cần đi học, làm bài đầy đủ và đúng hạn theo yêu cầu của bài học.",
                "Em luôn cố gắng vượt qua khó khăn để hoàn thành tốt mọi nhiệm vụ hằng ngày.",
                "Em chăm chỉ rèn chữ, làm bài và chuẩn bị bài đầy đủ trước khi đến lớp.",
                "Em chủ động ôn bài, tự giác làm bài tập về nhà mỗi tối qua từng tuần học.",
                "Em không ngại làm việc nhà phụ giúp gia đình và việc lớp trên lớp.",
                "Em cần cù, chịu khó luyện tập từ những việc nhỏ nhất hằng ngày."
            ],
            ht: [
                "Em chuyên cần đi học, hoàn thành bài tập được giao và tự giác làm bài ở nhà.",
                "Em đã có ý thức chăm chỉ trong học tập và sinh hoạt qua từng tuần học.",
                "Em đi học đều đặn, làm bài tập đầy đủ theo hướng dẫn của thầy cô.",
                "Em có cố gắng trong việc rèn chữ và làm bài trên lớp hằng ngày.",
                "Em đã chuẩn bị bài và đồ dùng học tập trước khi đến lớp theo yêu cầu của bài học.",
                "Em có tiến bộ trong việc tự giác hoàn thành nhiệm vụ qua từng tuần học.",
                "Em đã chăm chỉ làm bài về nhà mỗi tối, cần phát huy thêm sự kiên trì.",
                "Em tham gia đầy đủ các hoạt động chung của lớp trong giờ học hằng ngày."
            ],
            cht: [
                "Em ngoan, hãy luyện thói quen làm bài tập về nhà mỗi tối qua từng tuần học.",
                "Em hiền lành, cần kiên trì hơn khi gặp các bài tập khó theo hướng dẫn của thầy cô.",
                "Em đã có cố gắng, hãy duy trì việc đi học đều đặn và làm bài đầy đủ trên lớp.",
                "Em chuyên cần đi học, hãy luyện thói quen chuẩn bị bài trước khi đến lớp hằng ngày.",
                "Em sẽ tiến bộ hơn, hãy đặt thời gian biểu học bài ở nhà mỗi ngày.",
                "Em ngoan và lễ phép, hãy nhờ gia đình theo dõi việc học mỗi tối qua từng tuần học.",
                "Em hiền, hãy chăm chỉ rèn chữ và làm toán mỗi ngày một ít theo hướng dẫn của thầy cô.",
                "Em sẽ tiến bộ hơn, hãy phụ giúp việc nhà phù hợp với sức của em hằng ngày."
            ]
        },
        trung_thuc: {
            tot: [
                "Em trung thực, thật thà trong học tập và sinh hoạt hằng ngày.",
                "Em mạnh dạn nhận lỗi và sửa lỗi khi mắc sai sót trong giờ học.",
                "Em luôn nói thật với thầy cô, cha mẹ và bạn bè qua từng tuần học.",
                "Em không gian lận trong học tập và kiểm tra trên lớp.",
                "Em biết bảo vệ lẽ phải, dám phê bình hành vi sai trái nhẹ nhàng trong các hoạt động chung của lớp.",
                "Em ngay thẳng, được thầy cô và bạn bè tin tưởng hằng ngày.",
                "Em luôn giữ lời hứa và làm đúng những gì đã hẹn trên lớp.",
                "Em biết trả lại đồ nhặt được cho người mất theo hướng dẫn của thầy cô."
            ],
            ht: [
                "Em đã biết nói thật, trung thực trong học tập và sinh hoạt trong các hoạt động chung của lớp.",
                "Em đã biết nói thật với thầy cô và gia đình hằng ngày.",
                "Em mạnh dạn nhận lỗi khi mắc sai sót trên lớp theo hướng dẫn của thầy cô.",
                "Em đã có ý thức làm bài trung thực trong giờ kiểm tra qua từng tuần học.",
                "Em biết phân biệt việc đúng và việc sai cơ bản theo yêu cầu của bài học.",
                "Em đã giữ lời hứa với thầy cô và bạn bè trong các hoạt động chung của lớp.",
                "Em đã biết trả lại đồ dùng mượn của bạn đúng hẹn trên lớp.",
                "Em có ý thức tôn trọng sự thật trong các tình huống quen thuộc hằng ngày."
            ],
            cht: [
                "Em ngoan, hãy luyện thói quen nói thật trong mọi tình huống hằng ngày.",
                "Em hiền lành, cần mạnh dạn nhận lỗi và sửa lỗi theo hướng dẫn của thầy cô.",
                "Em đã có cố gắng, hãy luyện cách trình bày đúng những việc em đã làm trên lớp.",
                "Em chuyên cần, hãy giữ lời hứa với thầy cô và gia đình qua từng tuần học.",
                "Em sẽ tiến bộ hơn, hãy tự giác làm bài kiểm tra mà không nhìn bài bạn trong giờ học.",
                "Em ngoan và lễ phép, hãy nói thật khi gia đình hỏi về việc học ở nhà.",
                "Em hiền, hãy luyện thói quen trả lại đồ mượn của bạn đúng hẹn trên lớp.",
                "Em sẽ tiến bộ hơn, hãy mạnh dạn xin lỗi khi em làm sai theo hướng dẫn của thầy cô."
            ]
        },
        trach_nhiem: {
            tot: [
                "Em có tinh thần trách nhiệm cao, hoàn thành tốt mọi việc được giao trên lớp.",
                "Em chủ động đảm nhận nhiệm vụ và làm đến nơi đến chốn qua từng tuần học.",
                "Em có ý thức giữ gìn tài sản của lớp và trường hằng ngày.",
                "Em là thành viên tích cực, đáng tin cậy trong các hoạt động chung của lớp.",
                "Em chấp hành tốt nội quy lớp học và các quy định chung theo hướng dẫn của thầy cô.",
                "Em chủ động dọn vệ sinh, sắp xếp lớp học gọn gàng mỗi ngày.",
                "Em sẵn sàng giúp đỡ tổ trưởng và bạn trong các nhiệm vụ chung trên lớp.",
                "Em hoàn thành nhiệm vụ học tập, lao động và phong trào đúng hạn qua từng tuần học."
            ],
            ht: [
                "Em đã có ý thức trách nhiệm với việc học và nhiệm vụ được giao theo hướng dẫn của thầy cô.",
                "Em chấp hành nội quy lớp học và làm theo hướng dẫn của thầy cô trong giờ học.",
                "Em có ý thức giữ gìn vệ sinh chung và đồ dùng học tập trên lớp hằng ngày.",
                "Em đã tham gia đầy đủ các hoạt động chung của lớp qua từng tuần học.",
                "Em biết hoàn thành công việc tổ trưởng giao đúng hạn theo yêu cầu của bài học.",
                "Em có cố gắng đảm nhận một vài việc nhỏ trong các hoạt động chung của lớp.",
                "Em đã biết giữ trật tự và làm theo lịch trực nhật của tổ trên lớp.",
                "Em đã tự giác hơn trong việc giữ gìn tài sản chung của lớp hằng ngày."
            ],
            cht: [
                "Em ngoan, hãy luyện tinh thần trách nhiệm khi được giao việc nhỏ trên lớp.",
                "Em hiền lành, cần cố gắng hoàn thành nhiệm vụ học tập đúng hạn theo hướng dẫn của thầy cô.",
                "Em đã có cố gắng, hãy giữ gìn đồ dùng học tập và tài sản chung hằng ngày.",
                "Em chuyên cần, hãy chấp hành nội quy lớp học và đi học đúng giờ qua từng tuần học.",
                "Em sẽ tiến bộ hơn, hãy chủ động tham gia trực nhật và hoạt động chung trong các hoạt động chung của lớp.",
                "Em ngoan và lễ phép, hãy luyện thói quen làm tròn việc được giao trên lớp.",
                "Em hiền, hãy nhờ gia đình nhắc nhở để chuẩn bị bài đầy đủ ở nhà mỗi tối.",
                "Em sẽ tiến bộ hơn, hãy giữ vệ sinh lớp học và sân trường cùng các bạn hằng ngày."
            ]
        }
    }
};

const LOCATORS = [
    'theo hướng dẫn của thầy cô', 'theo hướng dẫn', 'theo yêu cầu của bài học',
    'qua từng tuần học', 'qua các bài học trên lớp',
    'trong các hoạt động chung của lớp', 'trên lớp', 'ở lớp',
    'hằng ngày', 'mỗi ngày', 'mỗi tối', 'ở nhà',
    'trong giờ học', 'trong giờ', 'vào thực tế', 'vào cuộc sống',
    'từng bước một', 'đều đặn hơn', 'đều đặn', 'cùng các bạn',
    'cùng bạn', 'trong nhóm'
];

function hasLocator(s) {
    const lower = s.toLowerCase();
    return LOCATORS.some(l => lower.includes(l));
}

function countPhrase(nlpc) {
    let total = 0;
    let withLoc = 0;
    const byTier = { tot: { total: 0, loc: 0 }, ht: { total: 0, loc: 0 }, cht: { total: 0, loc: 0 } };
    for (const sec of Object.keys(nlpc)) {
        for (const field of Object.keys(nlpc[sec])) {
            const cell = nlpc[sec][field];
            for (const tier of ['tot', 'ht', 'cht']) {
                const arr = cell[tier] || [];
                arr.forEach(p => {
                    total++;
                    byTier[tier].total++;
                    if (hasLocator(p)) {
                        withLoc++;
                        byTier[tier].loc++;
                    }
                });
            }
        }
    }
    return { total, withLoc, byTier };
}

function main() {
    console.log('=== build-nlpc-v51 rev 2 — bám phong cách mẫu THDiễn Liên ===');
    console.log('File:', FILE);
    const before = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const beforeStats = countPhrase(before.nlpc || {});

    before.nlpc = NLPC_V51;
    fs.writeFileSync(FILE, JSON.stringify(before, null, 2) + '\n', 'utf8');

    const after = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const afterStats = countPhrase(after.nlpc || {});

    function fmtPct(stats) {
        const pct = stats.total ? Math.round(stats.loc * 100 / stats.total) : 0;
        return `${stats.loc}/${stats.total} (${pct}%)`;
    }

    console.log('\nBEFORE (V5.1 rev 1):');
    console.log('  Total:', beforeStats.total, '| Có locator:', fmtPct({ loc: beforeStats.withLoc, total: beforeStats.total }));
    console.log('  Tier tot:', fmtPct(beforeStats.byTier.tot));
    console.log('  Tier ht :', fmtPct(beforeStats.byTier.ht));
    console.log('  Tier cht:', fmtPct(beforeStats.byTier.cht));

    console.log('\nAFTER (V5.1 rev 2):');
    console.log('  Total:', afterStats.total, '| Có locator:', fmtPct({ loc: afterStats.withLoc, total: afterStats.total }));
    console.log('  Tier tot:', fmtPct(afterStats.byTier.tot));
    console.log('  Tier ht :', fmtPct(afterStats.byTier.ht));
    console.log('  Tier cht:', fmtPct(afterStats.byTier.cht));

    console.log('\nSubjects untouched:', Object.keys(after.subjects || {}).length, 'môn');
    console.log('DONE.');
}

main();

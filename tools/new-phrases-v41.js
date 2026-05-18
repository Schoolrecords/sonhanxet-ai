/**
 * Ngân hàng phrase nền chuẩn V4.1 — bám yêu cầu chuyên môn TT27/2020.
 * Mỗi câu hoàn chỉnh, không cần engine ghép thêm suffix.
 * Subject code map theo engine flat key (nhanxet-ngan.json).
 */
'use strict';

const NEW_PHRASES_V41 = {
    toan: {
        cht: [
            'Em cần được hỗ trợ thêm về kiến thức Toán cơ bản, nhất là tính toán, đọc đề và trình bày bài giải.',
            'Em cần củng cố các phép tính đã học, luyện làm bài từng bước để nắm chắc kiến thức hơn.',
            'Em còn gặp khó khăn khi vận dụng kiến thức Toán vào bài tập, cần được hướng dẫn và luyện tập thường xuyên.',
            'Em cần rèn thêm kĩ năng đọc đề, xác định phép tính và trình bày bài giải theo từng bước.',
            'Em cần được hỗ trợ thêm khi thực hiện phép tính và giải các bài toán quen thuộc.'
        ],
        ht: [
            'Em hoàn thành yêu cầu cơ bản môn Toán, cần rèn thêm kĩ năng phân tích đề và kiểm tra kết quả.',
            'Em đã có cố gắng trong học Toán, cần luyện thêm tính toán và trình bày bài giải rõ ràng hơn.',
            'Em làm được một số bài toán quen thuộc, cần cẩn thận hơn khi thực hiện phép tính và ghi lời giải.',
            'Em nắm được một số kiến thức Toán cơ bản, cần luyện thêm cách vận dụng vào bài tập.',
            'Em đã thực hiện được các yêu cầu cơ bản, cần rèn thêm sự chính xác khi tính toán.'
        ],
        tot: [
            'Em hoàn thành tốt yêu cầu môn Toán, biết vận dụng kiến thức vào bài tập quen thuộc.',
            'Em nắm khá chắc kiến thức Toán, tính toán tương đối chính xác và trình bày bài khá rõ ràng.',
            'Em biết lựa chọn phép tính phù hợp, giải được nhiều bài toán và cần tiếp tục rèn sự cẩn thận.',
            'Em thực hiện tốt nhiều yêu cầu môn Toán, biết trình bày lời giải tương đối đầy đủ.',
            'Em vận dụng được kiến thức Toán vào bài làm, kết quả học tập tương đối ổn định.'
        ],
        tot_xs: [
            'Em nắm chắc kiến thức môn Toán, tính toán chính xác và trình bày bài giải rõ ràng.',
            'Em vận dụng tốt kiến thức Toán vào bài tập, biết phân tích đề và kiểm tra kết quả.',
            'Em hoàn thành rất tốt yêu cầu môn Toán, làm bài chính xác và trình bày khoa học.',
            'Em thực hiện tốt các phép tính, giải toán chắc chắn và trình bày bài làm rõ ràng.',
            'Em nắm vững nội dung môn Toán, biết vận dụng kiến thức vào bài tập phù hợp.'
        ]
    },

    'tieng-viet': {
        cht: [
            'Em cần được hỗ trợ thêm về đọc hiểu, chính tả và viết câu; nên luyện đọc, viết đều đặn hơn.',
            'Em còn gặp khó khăn khi đọc văn bản và diễn đạt ý, cần được hướng dẫn từng bước trong học tập.',
            'Em cần củng cố kĩ năng đọc, dùng từ, đặt câu và trình bày ý theo gợi ý.',
            'Em cần rèn thêm kĩ năng đọc kĩ văn bản, trả lời câu hỏi và viết câu rõ ý.',
            'Em cần được hỗ trợ thêm khi đọc hiểu, viết chính tả và trình bày bài viết.'
        ],
        ht: [
            'Em hoàn thành yêu cầu cơ bản môn Tiếng Việt, cần luyện thêm đọc hiểu, dùng từ và viết câu rõ ý.',
            'Em đã có cố gắng trong học Tiếng Việt, cần rèn thêm chính tả và cách diễn đạt trong bài viết.',
            'Em thực hiện được một số yêu cầu đọc, viết, cần chú ý hơn khi trả lời câu hỏi và trình bày bài.',
            'Em đọc và viết được nội dung cơ bản, cần luyện thêm cách dùng từ và đặt câu phù hợp.',
            'Em cần rèn thêm kĩ năng đọc hiểu, viết câu và trình bày ý rõ ràng hơn.'
        ],
        tot: [
            'Em hoàn thành tốt yêu cầu môn Tiếng Việt, đọc hiểu khá chắc và viết bài tương đối rõ.',
            'Em biết dùng từ, đặt câu phù hợp, trình bày bài viết có bố cục tương đối rõ ràng.',
            'Em đọc hiểu được văn bản, trả lời câu hỏi đúng trọng tâm và diễn đạt ý khá mạch lạc.',
            'Em thực hiện tốt các yêu cầu đọc, viết và biết trình bày bài theo nội dung đã học.',
            'Em vận dụng được kiến thức Tiếng Việt vào đọc hiểu, luyện từ và câu, viết bài phù hợp.'
        ],
        tot_xs: [
            'Em đọc hiểu tốt văn bản, dùng từ phù hợp, viết bài có bố cục rõ và diễn đạt mạch lạc.',
            'Em vận dụng tốt kiến thức Tiếng Việt vào đọc hiểu, luyện từ và câu, viết bài rõ ý.',
            'Em hoàn thành rất tốt yêu cầu môn Tiếng Việt, trình bày ý rõ ràng và viết bài sạch đẹp.',
            'Em nắm chắc kiến thức Tiếng Việt, đọc hiểu tốt và diễn đạt nội dung bài viết rõ ràng.',
            'Em thực hiện tốt các yêu cầu đọc, viết, dùng từ, đặt câu và trình bày bài mạch lạc.'
        ]
    },

    tienganh: {
        cht: [
            'Em cần được hỗ trợ thêm về từ vựng, mẫu câu và kĩ năng nghe, nói, đọc, viết cơ bản.',
            'Em còn gặp khó khăn khi ghi nhớ từ vựng và sử dụng mẫu câu, cần luyện tập thường xuyên hơn.',
            'Em cần củng cố phát âm, nhận biết từ quen thuộc và thực hành các mẫu câu đơn giản.',
            'Em cần luyện thêm cách đọc từ, viết từ và sử dụng mẫu câu đã học.',
            'Em cần được hỗ trợ thêm để nhận biết từ vựng và hoàn thành các yêu cầu cơ bản.'
        ],
        ht: [
            'Em hoàn thành yêu cầu cơ bản môn Tiếng Anh, cần luyện thêm từ vựng và mẫu câu đã học.',
            'Em đã thực hiện được một số yêu cầu nghe, nói, đọc, viết, cần rèn thêm phát âm và ghi nhớ từ.',
            'Em có cố gắng trong học Tiếng Anh, cần luyện đọc từ, viết câu và sử dụng mẫu câu quen thuộc.',
            'Em nhận biết được một số từ vựng, cần luyện thêm cách vận dụng vào câu đơn giản.',
            'Em thực hiện được các bài tập cơ bản, cần rèn thêm phát âm và viết từ chính xác.'
        ],
        tot: [
            'Em hoàn thành tốt yêu cầu môn Tiếng Anh, nhận biết được từ vựng và sử dụng mẫu câu khá phù hợp.',
            'Em nghe, đọc và viết được các nội dung quen thuộc, cần tiếp tục rèn phát âm rõ hơn.',
            'Em nắm khá chắc từ vựng, mẫu câu đã học và vận dụng được vào bài tập phù hợp.',
            'Em thực hiện tốt một số yêu cầu nghe, nói, đọc, viết trong phạm vi bài học.',
            'Em sử dụng được từ vựng và mẫu câu quen thuộc để hoàn thành bài tập tương đối tốt.'
        ],
        tot_xs: [
            'Em nắm chắc từ vựng và mẫu câu Tiếng Anh, thực hiện tốt các yêu cầu nghe, nói, đọc, viết.',
            'Em vận dụng tốt kiến thức Tiếng Anh vào bài tập, đọc và viết câu tương đối chính xác.',
            'Em hoàn thành rất tốt yêu cầu môn Tiếng Anh, sử dụng từ vựng và mẫu câu phù hợp.',
            'Em ghi nhớ tốt từ vựng, mẫu câu và thực hiện bài tập Tiếng Anh chính xác.',
            'Em đọc, viết và vận dụng mẫu câu đã học tốt, hoàn thành bài học rõ yêu cầu.'
        ]
    },

    tnxh: {
        cht: [
            'Em cần được hỗ trợ thêm trong nhận biết sự vật, hiện tượng và nội dung gần gũi trong cuộc sống.',
            'Em còn gặp khó khăn khi quan sát, trả lời câu hỏi và vận dụng kiến thức vào tình huống quen thuộc.',
            'Em cần củng cố kiến thức về bản thân, gia đình, trường học, cộng đồng và môi trường xung quanh.',
            'Em cần luyện thêm cách quan sát, nhận xét và trình bày nội dung bài học rõ ràng.',
            'Em cần được hướng dẫn thêm để nhận biết nội dung chính của bài học.'
        ],
        ht: [
            'Em hoàn thành yêu cầu cơ bản môn Tự nhiên và Xã hội, cần luyện thêm quan sát và trả lời câu hỏi rõ ý.',
            'Em biết một số nội dung đã học, cần rèn thêm cách liên hệ kiến thức với cuộc sống hằng ngày.',
            'Em đã có cố gắng, cần củng cố thêm kiến thức về con người, sự vật và môi trường xung quanh.',
            'Em nêu được một số ý chính, cần luyện thêm cách trình bày hiểu biết của mình.',
            'Em nhận biết được nội dung cơ bản, cần rèn thêm cách vận dụng vào tình huống quen thuộc.'
        ],
        tot: [
            'Em hoàn thành tốt yêu cầu môn Tự nhiên và Xã hội, biết quan sát và nêu được nội dung chính của bài học.',
            'Em nắm khá chắc kiến thức đã học, biết liên hệ với một số tình huống gần gũi trong cuộc sống.',
            'Em nhận biết được sự vật, hiện tượng quen thuộc và trả lời câu hỏi tương đối rõ ràng.',
            'Em biết vận dụng kiến thức đã học để nhận xét một số tình huống gần gũi.',
            'Em trình bày được nội dung bài học và có cách liên hệ phù hợp với thực tế.'
        ],
        tot_xs: [
            'Em nắm chắc kiến thức môn Tự nhiên và Xã hội, biết quan sát và vận dụng vào tình huống thực tế.',
            'Em hoàn thành rất tốt yêu cầu môn học, trình bày được hiểu biết về con người và môi trường xung quanh.',
            'Em vận dụng tốt kiến thức đã học để nhận xét sự vật, hiện tượng gần gũi trong đời sống.',
            'Em trình bày rõ ràng nội dung bài học và biết liên hệ với cuộc sống hằng ngày.',
            'Em thực hiện tốt các yêu cầu quan sát, nhận biết và vận dụng kiến thức vào tình huống phù hợp.'
        ]
    },

    khoahoc: {
        cht: [
            'Em cần được hỗ trợ thêm trong ghi nhớ kiến thức khoa học và giải thích các hiện tượng đơn giản.',
            'Em còn gặp khó khăn khi quan sát, nêu nhận xét và vận dụng kiến thức vào bài học.',
            'Em cần củng cố kiến thức cơ bản, luyện trả lời câu hỏi và liên hệ với tình huống thực tế.',
            'Em cần luyện thêm cách quan sát hiện tượng, nêu ý chính và trình bày câu trả lời rõ hơn.',
            'Em cần được hướng dẫn thêm để hiểu và vận dụng kiến thức khoa học đã học.'
        ],
        ht: [
            'Em hoàn thành yêu cầu cơ bản môn Khoa học, cần luyện thêm quan sát và giải thích hiện tượng đơn giản.',
            'Em đã nắm được một số nội dung chính, cần rèn thêm cách trình bày và vận dụng kiến thức.',
            'Em có cố gắng trong học Khoa học, cần củng cố thêm kiến thức và trả lời câu hỏi rõ ý hơn.',
            'Em nhận biết được nội dung cơ bản, cần luyện thêm cách liên hệ với thực tế.',
            'Em thực hiện được một số yêu cầu môn học, cần rèn thêm cách diễn đạt kết quả quan sát.'
        ],
        tot: [
            'Em hoàn thành tốt yêu cầu môn Khoa học, biết quan sát, nhận xét và vận dụng kiến thức vào bài tập quen thuộc.',
            'Em nắm khá chắc nội dung đã học, trình bày được một số hiện tượng khoa học đơn giản.',
            'Em biết liên hệ kiến thức Khoa học với cuộc sống, trả lời câu hỏi tương đối đầy đủ.',
            'Em hiểu được nội dung bài học và vận dụng vào một số tình huống phù hợp.',
            'Em trình bày được kiến thức đã học, biết nêu nhận xét và giải thích hiện tượng đơn giản.'
        ],
        tot_xs: [
            'Em nắm chắc kiến thức môn Khoa học, biết giải thích hiện tượng đơn giản và vận dụng vào thực tế.',
            'Em hoàn thành rất tốt yêu cầu môn học, trình bày rõ ràng các nội dung khoa học đã học.',
            'Em vận dụng tốt kiến thức Khoa học vào quan sát, nhận xét và xử lí tình huống phù hợp.',
            'Em hiểu chắc nội dung bài học, biết liên hệ kiến thức với đời sống hằng ngày.',
            'Em thực hiện tốt các yêu cầu quan sát, giải thích và vận dụng kiến thức khoa học.'
        ]
    },

    lichsudia: {
        cht: [
            'Em cần được hỗ trợ thêm trong ghi nhớ sự kiện, nhân vật, địa danh và nội dung bài học cơ bản.',
            'Em còn gặp khó khăn khi trình bày kiến thức Lịch sử và Địa lí, cần ôn tập theo từng phần nhỏ.',
            'Em cần củng cố cách đọc thông tin, nhận biết bản đồ, mốc thời gian và nội dung trọng tâm.',
            'Em cần luyện thêm cách ghi nhớ kiến thức và trả lời câu hỏi theo nội dung bài học.',
            'Em cần được hướng dẫn thêm để nhận biết sự kiện, địa danh và thông tin trên bản đồ.'
        ],
        ht: [
            'Em hoàn thành yêu cầu cơ bản môn Lịch sử và Địa lí, cần luyện thêm ghi nhớ sự kiện và địa danh.',
            'Em đã nắm được một số nội dung chính, cần rèn thêm cách trình bày và liên hệ kiến thức.',
            'Em có cố gắng trong học tập, cần ôn thêm mốc thời gian, nhân vật, địa điểm và nội dung bài học.',
            'Em trả lời được một số câu hỏi cơ bản, cần luyện thêm cách trình bày rõ ý.',
            'Em cần củng cố thêm kiến thức trọng tâm và cách khai thác thông tin trong bài học.'
        ],
        tot: [
            'Em hoàn thành tốt yêu cầu môn Lịch sử và Địa lí, nắm được nội dung chính của bài học.',
            'Em biết trình bày sự kiện, nhân vật, địa danh và sử dụng thông tin bản đồ ở mức phù hợp.',
            'Em nắm khá chắc kiến thức đã học, trả lời câu hỏi tương đối rõ ràng và đúng trọng tâm.',
            'Em biết khai thác một số thông tin lịch sử, địa lí và trình bày nội dung bài học khá rõ.',
            'Em vận dụng được kiến thức đã học để trả lời câu hỏi và liên hệ với thực tế phù hợp.'
        ],
        tot_xs: [
            'Em nắm chắc kiến thức Lịch sử và Địa lí, trình bày rõ sự kiện, nhân vật, địa danh và nội dung bài học.',
            'Em vận dụng tốt kiến thức đã học để trả lời câu hỏi và liên hệ với thực tế phù hợp.',
            'Em hoàn thành rất tốt yêu cầu môn học, biết khai thác thông tin và trình bày bài rõ ràng.',
            'Em hiểu chắc nội dung bài học, biết sử dụng thông tin bản đồ, mốc thời gian và địa danh phù hợp.',
            'Em trình bày tốt kiến thức Lịch sử và Địa lí, trả lời câu hỏi đầy đủ và đúng trọng tâm.'
        ]
    },

    daoduc: {
        cht: [
            'Em cần được hỗ trợ thêm trong nhận biết hành vi đúng, chưa đúng và cách ứng xử phù hợp.',
            'Em cần củng cố các nội dung đạo đức đã học, luyện xử lí tình huống gần gũi trong cuộc sống.',
            'Em còn gặp khó khăn khi nêu ý kiến về hành vi đạo đức, cần được hướng dẫn qua các tình huống cụ thể.',
            'Em cần luyện thêm cách nhận xét hành vi và lựa chọn cách ứng xử phù hợp.',
            'Em cần được hướng dẫn thêm để hiểu và vận dụng nội dung bài học vào tình huống quen thuộc.'
        ],
        ht: [
            'Em hoàn thành yêu cầu cơ bản môn Đạo đức, cần luyện thêm cách nhận xét hành vi và xử lí tình huống.',
            'Em đã biết một số chuẩn mực hành vi, cần rèn thêm cách vận dụng vào việc làm hằng ngày.',
            'Em có cố gắng trong học Đạo đức, cần củng cố thêm nội dung bài học và liên hệ với bản thân.',
            'Em nhận biết được một số hành vi phù hợp, cần luyện thêm cách trình bày ý kiến rõ ràng.',
            'Em thực hiện được yêu cầu cơ bản, cần rèn thêm cách lựa chọn hành vi đúng trong tình huống cụ thể.'
        ],
        tot: [
            'Em hoàn thành tốt yêu cầu môn Đạo đức, biết nhận xét hành vi và nêu cách ứng xử phù hợp.',
            'Em nắm khá chắc nội dung bài học, biết liên hệ với một số tình huống trong cuộc sống.',
            'Em hiểu được các chuẩn mực hành vi đã học và trả lời câu hỏi tương đối rõ ràng.',
            'Em biết vận dụng nội dung bài học vào một số tình huống gần gũi.',
            'Em trình bày được hiểu biết về hành vi đúng và cách ứng xử phù hợp.'
        ],
        tot_xs: [
            'Em nắm chắc nội dung môn Đạo đức, biết phân tích hành vi và lựa chọn cách ứng xử phù hợp.',
            'Em hoàn thành rất tốt yêu cầu môn học, vận dụng được bài học vào các tình huống gần gũi.',
            'Em trình bày rõ hiểu biết về hành vi đúng, trách nhiệm và cách ứng xử trong cuộc sống.',
            'Em biết liên hệ nội dung bài học với việc làm phù hợp trong học tập và sinh hoạt.',
            'Em vận dụng tốt kiến thức Đạo đức vào nhận xét hành vi và xử lí tình huống.'
        ]
    },

    tinhoc: {
        cht: [
            'Em cần được hỗ trợ thêm về thao tác máy tính, sử dụng phần mềm và thực hiện nhiệm vụ học tập cơ bản.',
            'Em còn gặp khó khăn khi thao tác với máy tính, cần luyện lại các bước thực hành theo hướng dẫn.',
            'Em cần củng cố kĩ năng sử dụng thiết bị, lưu tệp, nhập dữ liệu và thực hiện thao tác an toàn.',
            'Em cần luyện thêm thao tác cơ bản trên máy tính để hoàn thành nhiệm vụ học tập.',
            'Em cần được hướng dẫn thêm khi sử dụng phần mềm và thực hiện bài thực hành.'
        ],
        ht: [
            'Em hoàn thành yêu cầu cơ bản môn Tin học, cần luyện thêm thao tác máy tính và thực hành theo quy trình.',
            'Em đã thực hiện được một số thao tác cơ bản, cần rèn thêm cách sử dụng phần mềm và lưu sản phẩm.',
            'Em có cố gắng trong học Tin học, cần thực hành thường xuyên hơn để thao tác chính xác.',
            'Em thực hiện được yêu cầu cơ bản, cần luyện thêm cách xử lí thông tin và hoàn thành sản phẩm.',
            'Em cần rèn thêm thao tác sử dụng thiết bị, phần mềm và lưu trữ tệp đúng cách.'
        ],
        tot: [
            'Em hoàn thành tốt yêu cầu môn Tin học, thực hiện được các thao tác cơ bản và sử dụng phần mềm phù hợp.',
            'Em nắm khá chắc nội dung đã học, biết thao tác với máy tính và hoàn thành sản phẩm theo yêu cầu.',
            'Em biết vận dụng kĩ năng Tin học vào bài thực hành, thao tác tương đối chính xác.',
            'Em sử dụng được phần mềm đã học, biết lưu sản phẩm và thực hiện nhiệm vụ tương đối tốt.',
            'Em hoàn thành bài thực hành Tin học khá tốt, cần tiếp tục rèn sự chính xác khi thao tác.'
        ],
        tot_xs: [
            'Em nắm chắc kiến thức môn Tin học, thao tác máy tính chính xác và hoàn thành tốt sản phẩm học tập.',
            'Em vận dụng tốt kĩ năng Tin học vào thực hành, biết lưu trữ và xử lí thông tin phù hợp.',
            'Em hoàn thành rất tốt yêu cầu môn học, thực hiện thao tác thành thạo và đảm bảo an toàn số.',
            'Em sử dụng tốt phần mềm đã học, hoàn thành sản phẩm thực hành rõ yêu cầu.',
            'Em thực hiện tốt các thao tác Tin học, biết vận dụng kiến thức vào nhiệm vụ học tập phù hợp.'
        ]
    },

    congnghe: {
        cht: [
            'Em cần được hỗ trợ thêm trong nhận biết sản phẩm công nghệ, quy trình thực hiện và thao tác an toàn.',
            'Em còn gặp khó khăn khi thực hành theo các bước, cần được hướng dẫn cụ thể và luyện tập thêm.',
            'Em cần củng cố kiến thức cơ bản về sản phẩm, vật liệu, công cụ và cách sử dụng an toàn.',
            'Em cần luyện thêm cách thực hiện nhiệm vụ công nghệ theo đúng quy trình.',
            'Em cần được hỗ trợ thêm khi sử dụng vật liệu, công cụ và hoàn thành sản phẩm.'
        ],
        ht: [
            'Em hoàn thành yêu cầu cơ bản môn Công nghệ, cần rèn thêm thao tác thực hành và thực hiện đúng quy trình.',
            'Em đã biết một số nội dung đã học, cần luyện thêm cách sử dụng công cụ và hoàn thành sản phẩm.',
            'Em có cố gắng trong học Công nghệ, cần chú ý hơn khi thực hành và kiểm tra sản phẩm.',
            'Em thực hiện được một số bước cơ bản, cần luyện thêm sự chính xác khi thao tác.',
            'Em cần củng cố thêm quy trình thực hiện và cách đảm bảo an toàn khi thực hành.'
        ],
        tot: [
            'Em hoàn thành tốt yêu cầu môn Công nghệ, biết thực hiện nhiệm vụ theo quy trình và đảm bảo an toàn.',
            'Em nắm khá chắc nội dung bài học, vận dụng được kiến thức vào sản phẩm thực hành phù hợp.',
            'Em biết sử dụng công cụ, vật liệu ở mức phù hợp và trình bày được sản phẩm theo yêu cầu.',
            'Em thực hiện được sản phẩm công nghệ tương đối tốt, biết kiểm tra và điều chỉnh khi cần.',
            'Em vận dụng được nội dung đã học vào thực hành, sản phẩm hoàn thành rõ yêu cầu.'
        ],
        tot_xs: [
            'Em nắm chắc kiến thức môn Công nghệ, thực hiện tốt quy trình và hoàn thành sản phẩm rõ yêu cầu.',
            'Em vận dụng tốt kiến thức vào thực hành, biết kiểm tra và điều chỉnh sản phẩm phù hợp.',
            'Em hoàn thành rất tốt yêu cầu môn học, thao tác chính xác và đảm bảo an toàn khi thực hành.',
            'Em thực hiện tốt các bước công nghệ, sử dụng vật liệu và công cụ phù hợp.',
            'Em hoàn thành sản phẩm thực hành tốt, biết vận dụng kiến thức để điều chỉnh sản phẩm.'
        ]
    },

    gdtc: {
        cht: [
            'Em cần được hỗ trợ thêm trong thực hiện động tác, phối hợp vận động và luyện tập theo yêu cầu.',
            'Em còn gặp khó khăn khi thực hiện một số động tác cơ bản, cần luyện tập từng bước để tiến bộ hơn.',
            'Em cần rèn thêm thể lực, sự phối hợp động tác và cách thực hiện bài tập đúng kĩ thuật.',
            'Em cần được hướng dẫn thêm để thực hiện động tác đúng nhịp và đúng yêu cầu.',
            'Em cần luyện thêm các động tác cơ bản để hoàn thành nhiệm vụ vận động tốt hơn.'
        ],
        ht: [
            'Em hoàn thành yêu cầu cơ bản môn Giáo dục thể chất, cần luyện thêm động tác và phối hợp vận động.',
            'Em đã thực hiện được một số bài tập, cần rèn thêm sự chính xác và đều đặn khi luyện tập.',
            'Em có cố gắng trong luyện tập, cần chú ý hơn đến kĩ thuật động tác và nhịp thực hiện.',
            'Em thực hiện được yêu cầu cơ bản, cần luyện thêm cách phối hợp động tác trong bài tập.',
            'Em cần rèn thêm sự linh hoạt và chính xác khi thực hiện các hoạt động vận động.'
        ],
        tot: [
            'Em hoàn thành tốt yêu cầu môn Giáo dục thể chất, thực hiện được động tác và phối hợp vận động khá tốt.',
            'Em nắm khá chắc các động tác đã học, luyện tập đúng yêu cầu và cần tiếp tục rèn thể lực.',
            'Em thực hiện bài tập tương đối chính xác, biết phối hợp động tác trong các hoạt động vận động.',
            'Em hoàn thành tốt nhiều nội dung luyện tập, giữ nhịp và thực hiện động tác khá ổn định.',
            'Em thực hiện được các bài tập vận động theo yêu cầu, cần tiếp tục rèn sự bền bỉ.'
        ],
        tot_xs: [
            'Em hoàn thành rất tốt yêu cầu môn Giáo dục thể chất, thực hiện động tác chính xác và phối hợp vận động tốt.',
            'Em nắm chắc kĩ thuật các động tác đã học, luyện tập đúng yêu cầu và đạt kết quả tốt.',
            'Em thực hiện tốt bài tập vận động, giữ nhịp và phối hợp động tác tương đối linh hoạt.',
            'Em thực hiện các động tác đã học rõ ràng, đúng kĩ thuật và hoàn thành tốt nội dung luyện tập.',
            'Em vận dụng tốt kĩ năng vận động vào bài tập, thực hiện động tác chính xác và phù hợp.'
        ]
    },

    amnhac: {
        cht: [
            'Em cần được hỗ trợ thêm trong hát đúng giai điệu, giữ nhịp và nhận biết nội dung âm nhạc cơ bản.',
            'Em còn gặp khó khăn khi hát, gõ đệm và thực hiện tiết tấu, cần luyện tập theo từng phần nhỏ.',
            'Em cần củng cố cách nghe nhạc, hát đúng lời và thể hiện nhịp điệu đơn giản.',
            'Em cần luyện thêm cách hát rõ lời, giữ nhịp và thực hiện tiết tấu theo yêu cầu.',
            'Em cần được hướng dẫn thêm để hoàn thành các hoạt động âm nhạc cơ bản.'
        ],
        ht: [
            'Em hoàn thành yêu cầu cơ bản môn Âm nhạc, cần luyện thêm hát đúng lời, đúng nhịp và giai điệu.',
            'Em đã thực hiện được một số yêu cầu âm nhạc, cần rèn thêm tiết tấu và cách thể hiện bài hát.',
            'Em có cố gắng trong học Âm nhạc, cần luyện hát rõ lời và giữ nhịp ổn định hơn.',
            'Em thực hiện được yêu cầu cơ bản, cần rèn thêm cách nghe, hát và gõ đệm.',
            'Em cần luyện thêm cách thể hiện giai điệu, tiết tấu và nội dung bài hát.'
        ],
        tot: [
            'Em hoàn thành tốt yêu cầu môn Âm nhạc, hát tương đối đúng giai điệu và biết giữ nhịp cơ bản.',
            'Em nắm khá chắc nội dung bài học, thực hiện được hát, gõ đệm và tiết tấu theo yêu cầu.',
            'Em thể hiện bài hát tương đối rõ lời, đúng nhịp và cần tiếp tục rèn cách biểu cảm.',
            'Em thực hiện tốt một số hoạt động âm nhạc, biết hát và gõ đệm theo nội dung đã học.',
            'Em hoàn thành bài học Âm nhạc khá tốt, giữ nhịp và thể hiện tiết tấu tương đối phù hợp.'
        ],
        tot_xs: [
            'Em hoàn thành rất tốt yêu cầu môn Âm nhạc, hát đúng giai điệu, rõ lời và giữ nhịp tốt.',
            'Em vận dụng tốt kiến thức âm nhạc vào hát, gõ đệm và thể hiện tiết tấu phù hợp.',
            'Em nắm chắc nội dung bài học, thực hiện bài hát và hoạt động âm nhạc rõ ràng, đúng yêu cầu.',
            'Em thể hiện tốt giai điệu, tiết tấu và nội dung bài hát theo yêu cầu.',
            'Em thực hiện tốt các hoạt động âm nhạc, hát rõ lời và giữ nhịp ổn định.'
        ]
    },

    mithuat: {
        cht: [
            'Em cần được hỗ trợ thêm trong sử dụng đường nét, màu sắc, bố cục và hoàn thành sản phẩm tạo hình.',
            'Em còn gặp khó khăn khi thực hiện sản phẩm mĩ thuật, cần luyện từng bước theo yêu cầu bài học.',
            'Em cần củng cố cách quan sát, sắp xếp hình ảnh và sử dụng màu sắc phù hợp hơn.',
            'Em cần luyện thêm cách thể hiện đường nét, lựa chọn màu sắc và hoàn thiện sản phẩm.',
            'Em cần được hướng dẫn thêm để trình bày sản phẩm mĩ thuật rõ yêu cầu.'
        ],
        ht: [
            'Em hoàn thành yêu cầu cơ bản môn Mĩ thuật, cần rèn thêm cách sắp xếp bố cục và phối hợp màu sắc.',
            'Em đã thực hiện được sản phẩm theo yêu cầu, cần chú ý hơn đến đường nét và sự cân đối.',
            'Em có cố gắng trong học Mĩ thuật, cần luyện thêm cách quan sát và hoàn thiện sản phẩm rõ hơn.',
            'Em thực hiện được nội dung cơ bản, cần rèn thêm cách dùng màu và trình bày sản phẩm.',
            'Em cần chú ý hơn đến bố cục, đường nét và sự chỉn chu khi hoàn thiện bài.'
        ],
        tot: [
            'Em hoàn thành tốt yêu cầu môn Mĩ thuật, biết sử dụng đường nét, màu sắc và bố cục tương đối phù hợp.',
            'Em thực hiện được sản phẩm tạo hình theo yêu cầu, trình bày khá rõ ý tưởng và hình ảnh.',
            'Em biết vận dụng kiến thức Mĩ thuật vào sản phẩm, cần tiếp tục rèn sự cẩn thận khi hoàn thiện.',
            'Em hoàn thành sản phẩm mĩ thuật tương đối tốt, biết sắp xếp hình ảnh và phối hợp màu sắc phù hợp.',
            'Em thể hiện được nội dung bài học qua sản phẩm, bố cục và màu sắc tương đối rõ ràng.'
        ],
        tot_xs: [
            'Em hoàn thành rất tốt yêu cầu môn Mĩ thuật, sử dụng đường nét, màu sắc và bố cục hài hòa.',
            'Em vận dụng tốt kiến thức Mĩ thuật vào sản phẩm, trình bày hình ảnh rõ ràng và cân đối.',
            'Em nắm chắc nội dung bài học, hoàn thành sản phẩm tạo hình đẹp, rõ yêu cầu và có sự chỉn chu.',
            'Em thực hiện tốt sản phẩm mĩ thuật, biết phối hợp màu sắc, đường nét và bố cục phù hợp.',
            'Em hoàn thành sản phẩm rõ nội dung, trình bày đẹp và thể hiện tốt yêu cầu bài học.'
        ]
    },

    htn: {
        cht: [
            'Em cần được hỗ trợ thêm trong tham gia hoạt động, thực hiện nhiệm vụ và chia sẻ ý kiến theo gợi ý.',
            'Em còn gặp khó khăn khi thực hiện nhiệm vụ trải nghiệm, cần được hướng dẫn từng bước để tham gia hiệu quả hơn.',
            'Em cần rèn thêm kĩ năng hợp tác, tự phục vụ và thực hiện nhiệm vụ trong các hoạt động chung.',
            'Em cần được hỗ trợ thêm để tham gia hoạt động, hoàn thành phần việc và tự nhận xét việc làm.',
            'Em cần luyện thêm cách thực hiện nhiệm vụ, chia sẻ ý kiến và phối hợp trong hoạt động.'
        ],
        ht: [
            'Em hoàn thành yêu cầu cơ bản của Hoạt động trải nghiệm, cần rèn thêm kĩ năng hợp tác và thực hiện nhiệm vụ.',
            'Em đã tham gia được một số hoạt động, cần chủ động hơn khi chia sẻ và hoàn thành phần việc được giao.',
            'Em có cố gắng trong hoạt động trải nghiệm, cần luyện thêm cách tự nhận xét và điều chỉnh việc làm của mình.',
            'Em thực hiện được nhiệm vụ cơ bản, cần rèn thêm cách phối hợp và chia sẻ trong hoạt động.',
            'Em cần chú ý hơn khi thực hiện nhiệm vụ, tham gia hoạt động và trình bày ý kiến.'
        ],
        tot: [
            'Em hoàn thành tốt yêu cầu Hoạt động trải nghiệm, biết tham gia hoạt động và thực hiện nhiệm vụ được giao.',
            'Em biết hợp tác với bạn, chia sẻ ý kiến và hoàn thành nhiệm vụ trong các hoạt động phù hợp.',
            'Em thực hiện tốt một số nhiệm vụ trải nghiệm, biết liên hệ bài học với việc làm trong cuộc sống.',
            'Em tham gia hoạt động phù hợp, biết thực hiện phần việc và tự nhận xét kết quả của mình.',
            'Em hoàn thành nhiệm vụ trải nghiệm khá tốt, biết phối hợp và chia sẻ trong hoạt động chung.'
        ],
        tot_xs: [
            'Em hoàn thành rất tốt yêu cầu Hoạt động trải nghiệm, biết hợp tác, chia sẻ và thực hiện nhiệm vụ hiệu quả.',
            'Em vận dụng tốt nội dung hoạt động vào việc tự phục vụ, giao tiếp và tham gia các hoạt động chung.',
            'Em thực hiện nhiệm vụ trải nghiệm rõ ràng, biết tự nhận xét và điều chỉnh việc làm phù hợp.',
            'Em tham gia hoạt động tốt, hoàn thành nhiệm vụ rõ yêu cầu và biết liên hệ với thực tế.',
            'Em thực hiện tốt các nhiệm vụ trải nghiệm, biết phối hợp, chia sẻ và tự đánh giá kết quả hoạt động.'
        ]
    }
};

module.exports = { NEW_PHRASES_V41 };

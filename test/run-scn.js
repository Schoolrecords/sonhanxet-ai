/**
 * Kiểm thử bộ soạn Sổ chủ nhiệm (engine/sochunhiem.js) — chạy: node test/run-scn.js
 * In mẫu: node test/run-scn.js --mau "2|Nội dung hoạt động tháng" --lop 3A --thang "THÁNG 11"
 */
const E = require('../engine/sochunhiem.js');

let pass = 0, fail = 0;
const loi = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; loi.push(msg); } }

function f(key, kind) { return { key, kind: kind || 'ta', name: key.replace(/#\d+$/, ''), label: '', rowLabel: '', hasValue: false, readOnly: false }; }

const BANG_KQ = [
    { kind: 'nlpc', cols: ['nl_tcth', 'nl_gtht', 'nl_gqvdst', 'nl_nn', 'nl_tt', 'nl_kh', 'nl_tm', 'nl_tc', 'pc_yn', 'pc_nhanai', 'pc_chamchi', 'pc_trungthuc', 'pc_trachnhiem'],
        rows: { 'Tốt': ['20', '22', '18', '21', '19', '20', '23', '25', '28', '27', '22', '29', '24'],
            'Đạt': ['10', '9', '12', '10', '11', '11', '8', '6', '3', '4', '9', '2', '7'],
            'Cần cố gắng': ['1', '0', '1', '0', '1', '0', '0', '0', '0', '0', '0', '0', '0'] } },
    { kind: 'mon', cols: ['Tiếng Việt', 'Toán', 'Tiếng Anh', 'Tin học', 'Đạo đức', 'TN-XH', 'Âm nhạc', 'Mĩ thuật', 'Giáo dục thể chất', 'Hoạt động trải nghiệm'],
        rows: { 'T.số': Array(10).fill('31'), 'HTT': ['15', '17', '12', '10', '20', '18', '14', '13', '16', '19'],
            'HT': ['15', '13', '19', '21', '11', '13', '17', '18', '15', '12'], 'CHT': ['1', '1', '0', '0', '0', '0', '0', '0', '0', '0'] } }
];

const MAU = {
    '1|Kế hoạch năm': { fields: ['danhhieu_lop#0', 'danhhieu_chidoi#0', 'tieu_chuan#0', 'bien_phap#0', 'y_kien#0'], nums: { tong_so: '31', nu: '15', dan_toc: '0' } },
    '1|Kế hoạch tháng': { fields: ['cong_viec#0', 'bien_phap#0', 'ket_qua#0'], thangs: ['THÁNG THỨ NHẤT', 'THÁNG THỨ BA', 'THÁNG THỨ SÁU', 'THÁNG THỨ MƯỜI'], tg: true },
    '2|Đặc điểm tình hình': { fields: ['thuan_loi#0', 'kho_khan#0'], nums: { tong_so: '38', nu: '18', ho_ngheo: '2', ho_can_ngheo: '1', khuyet_tat: '1' } },
    '2|Nội dung kế hoạch': { fields: [...Array(7).keys()].map(i => 'chi_tieu#' + i).concat([...Array(8).keys()].map(i => 'giai_phap#' + i)), ck: true },
    '2|Nội dung hoạt động tháng': { fields: ['danh_gia#0', 'trong_tam#0', 'gd_dao_duc#0', 'gd_hoc_tap#0', 'hoat_dong#0', 'ke_hoach#0', 'ke_hoach#1', 'ke_hoach#2', 'ke_hoach#3', 'ke_hoach#4', 'ket_qua#0'],
        ck: ['danh_gia', 'trong_tam', 'gd_dao_duc', 'gd_hoc_tap', 'hoat_dong'], thangs: ['THÁNG 9', 'THÁNG 10', 'THÁNG 11', 'THÁNG 12', 'THÁNG 1', 'THÁNG 2', 'THÁNG 3', 'THÁNG 4', 'THÁNG 5'] },
    '2|Sơ kết học kỳ I': { fields: ['si_so#0', 'gd_dao_duc#0', 'gd_hoc_tap#0', 'chu_dep#0', 'hoat_dong#0'], tables: true },
    '2|Phương hướng HKII': { fields: ['hoat_dong#0'], ck: true },
    '2|Tổng kết năm học': { fields: ['nang_khieu#0', 'hoat_dong#0'], tables: true },
    '2|Nội dung họp': { fields: ['noi_dung#0'], ck: true, thangs: ['Lần 1', 'Lần 2', 'Lần 3', 'Lần 4'] }
};

function makeState(k, khoi, thang, opts) {
    const m = MAU[k];
    const [mau, section] = k.split('|');
    const isCk = (key) => m.ck === true || (Array.isArray(m.ck) && m.ck.includes(key.replace(/#\d+$/, '')));
    return {
        active: true, mau: Number(mau), section, lop: khoi + 'A', thang: thang || '',
        thoiGian: m.tg && thang ? '' : '',
        nums: m.nums || {}, tables: (m.tables && !(opts && opts.noTable)) ? BANG_KQ : [], weeks: [],
        fields: m.fields.map(x => f(x, isCk(x) ? 'ck' : 'ta'))
    };
}

const MAU_IN = process.argv.indexOf('--mau');
if (MAU_IN > 0) {
    const k = process.argv[MAU_IN + 1];
    const lop = process.argv[process.argv.indexOf('--lop') + 1] || '3A';
    const ti = process.argv.indexOf('--thang');
    const st = makeState(k, parseInt(lop, 10), ti > 0 ? process.argv[ti + 1] : '');
    st.lop = lop;
    const d = E.describe(st);
    console.log('== ' + k + ' · lớp ' + lop + ' · tháng ' + d.thang + (d.thieu.length ? ' · ' + d.thieu.join(' ') : ''));
    for (const fl of d.fields) {
        const g = E.generate(st, fl.key, { traits: ['ph_quan_tam', 'hai_buoi', 'nong_nghiep'] });
        console.log('\n--- ' + fl.label + (g && g.canBoSung ? '  [cần bổ sung …]' : ''));
        console.log(g ? g.text : '(trống)');
    }
    process.exit(0);
}

// 1. Mọi mục × mọi khối × mọi tháng: có chữ, sạch
for (const k of Object.keys(MAU)) {
    const m = MAU[k];
    for (let khoi = 1; khoi <= 5; khoi++) {
        for (const th of (m.thangs || [''])) {
            for (const noTable of (m.tables ? [false, true] : [false])) {
                const st = makeState(k, khoi, th, { noTable });
                const d = E.describe(st);
                ok(d.supported, k + ': không nhận mục');
                for (const fl of d.fields) {
                    for (const seed of [0, 1, 2]) {
                        const g = E.generate(st, fl.key, { seed });
                        const tag = `${k} lớp ${khoi} ${th} ${fl.key} seed${seed}${noTable ? ' (bảng trống)' : ''}`;
                        ok(g && g.text.length > 10, tag + ': trống');
                        if (!g) continue;
                        ok(!/undefined|null|NaN|\[object/.test(g.text), tag + ': lộ giá trị lỗi');
                        ok(!/\.\.(?!\.)|\.\s*\./.test(g.text.replace(/…/g, '')), tag + ': hai dấu chấm');
                        ok(E.validate(g.text).length === 0, tag + ': ' + E.validate(g.text).join(', '));
                        ok(!/\s{2,}/.test(g.text.replace(/\n/g, ' ')), tag + ': thừa khoảng trắng');
                        ok(g.html.startsWith('<p>'), tag + ': html');
                        if (khoi <= 3) ok(!/chi đội/i.test(g.text) || /Liên đội/.test(g.text) && !/Chi đội/.test(g.text), tag + ': lớp ' + khoi + ' chưa có chi đội');
                    }
                }
                // ô không phải của GVCN không được viết
                ok(!d.fields.some(x => x.key.startsWith('y_kien')), k + ': viết vào ý kiến hiệu trưởng');
                ok(!d.fields.some(x => x.key.startsWith('ket_qua') && k.startsWith('2|')), k + ': viết vào cột kết quả tuần');
            }
        }
    }
}

// 2. Số liệu thật được dùng
{
    const st = makeState('2|Đặc điểm tình hình', 3, '');
    const g = E.generate(st, 'kho_khan#0', {});
    ok(/2 em thuộc hộ nghèo/.test(g.text) && /1 em thuộc hộ cận nghèo/.test(g.text), 'Khó khăn: không dùng số hộ nghèo');
    ok(/1 em khuyết tật/.test(g.text), 'Khó khăn: không dùng số khuyết tật');
    ok(/Sĩ số lớp đông \(38 em\)/.test(g.text), 'Khó khăn: không nêu sĩ số đông');
}
{
    const st = makeState('2|Sơ kết học kỳ I', 4, '');
    const a = E.generate(st, 'gd_hoc_tap#0', {}).text;
    ok(/Tiếng Việt: Hoàn thành tốt 15 em \(48,4%\)/.test(a), 'Sơ kết: sai số Tiếng Việt: ' + a.split('\n')[0]);
    ok(/Chưa hoàn thành 1 em/.test(a), 'Sơ kết: thiếu số chưa hoàn thành');
    const b = E.generate(st, 'gd_dao_duc#0', {}).text;
    ok(/Trung thực/.test(b) && /Chăm chỉ/.test(b), 'Sơ kết: phẩm chất cao/thấp chưa đúng: ' + b.split('\n')[0]);
    const s = E.generate(st, 'si_so#0', {}).text;
    ok(/31 em/.test(s), 'Sơ kết: sĩ số lấy từ bảng');
    const st2 = makeState('2|Sơ kết học kỳ I', 4, '', { noTable: true });
    ok(E.generate(st2, 'gd_hoc_tap#0', {}).canBoSung, 'Bảng trống phải để … cho thầy cô bổ sung');
    ok(E.describe(st2).thieu.length > 0, 'Bảng trống phải nhắc Đồng bộ hệ thống');
}
// 3. Tháng: đọc đúng, đúng chủ điểm
{
    const st = makeState('1|Kế hoạch tháng', 2, 'THÁNG THỨ TƯ');
    ok(E.describe(st).thang === 11, 'Mẫu 1: THÁNG THỨ TƯ phải là tháng 11');
    ok(/Biết ơn thầy cô/.test(E.generate(st, 'cong_viec#0', {}).text), 'Tháng 11 phải có chủ điểm Biết ơn thầy cô');
    const st2 = makeState('1|Kế hoạch tháng', 2, 'THÁNG THỨ SÁU');
    st2.thoiGian = 'tháng 1 năm 2027';
    ok(E.describe(st2).thang === 1, 'thoi_gian phải được ưu tiên');
    const st3 = makeState('2|Nội dung hoạt động tháng', 5, 'THÁNG 10');
    ok(/tháng 9/.test(E.generate(st3, 'danh_gia#0', {}).text), 'Đánh giá phải nói tháng trước (9)');
    ok(/số thập phân/.test(E.generate(st3, 'gd_hoc_tap#0', {}).text), 'Lớp 5 HKI phải có số thập phân');
    const st4 = makeState('2|Nội dung hoạt động tháng', 4, 'THÁNG 3');
    ok(/phân số/.test(E.generate(st4, 'gd_hoc_tap#0', {}).text), 'Lớp 4 HKII phải có phân số');
}
// 4. Viết lại cho câu khác
{
    const st = makeState('2|Nội dung kế hoạch', 3, '');
    const set = new Set([0, 1, 2, 3, 4, 5].map(s => E.generate(st, 'giai_phap#1', { seed: s }).text));
    ok(set.size >= 3, 'Viết lại phải ra bản khác (' + set.size + ')');
}
// 5. Mục không hỗ trợ
ok(!E.describe({ mau: 2, section: 'Sơ đồ lớp', fields: [] }).supported, 'Sơ đồ lớp không hỗ trợ');

console.log(`Sổ chủ nhiệm: ${pass} đạt, ${fail} lỗi`);
if (fail) { console.log(loi.slice(0, 30).join('\n')); process.exit(1); }

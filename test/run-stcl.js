/**
 * Kiểm thử bộ soạn Sổ theo dõi chất lượng (engine/sotheodoi.js) — chạy: node test/run-stcl.js
 * In mẫu: node test/run-stcl.js --in
 */
const { NhanXetEngineV2 } = require('../engine/engine.js');
const S = require('../engine/sotheodoi.js');

const e = new NhanXetEngineV2();
e.loadData(require('../engine/data/nhanxet-ngan.json'));
e.loadKyData(require('../engine/data/nhanxet-ky.json'));
e.loadGradeData(require('../engine/data/nhanxet-grade.json'));
const nlpc = require('../engine/data/nhanxet-nlpc-giuaky.json').nlpc;

let pass = 0, fail = 0;
const loi = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; loi.push(msg); } }

const MON = ['Tiếng Việt', 'Toán', 'Khoa học', 'Lịch sử và Địa lí', 'Tiếng Anh', 'Đạo đức', 'Âm nhạc', 'Mĩ thuật',
    'Tin học và Công nghệ (Tin học)', 'Tin học và Công nghệ (Công nghệ)', 'Giáo dục thể chất', 'Hoạt động trải nghiệm'];
const mk = (tv, toan, xl) => MON.map((m, i) => ({ mon: m, kt: i === 0 ? tv : i === 1 ? toan : '', xl: (xl[i] || 'H') }));
const CA = [
    ['A', mk('6', '7', 'HHHHHHHHHHHH')],
    ['B', mk('10', '9', 'TTTTTTTTTTTT')],
    ['C', mk('4', '5', 'CHHCHHHHHHHH')],
    ['D', mk('8', '9', 'HTTHTHHTHHTH')],
    ['E', MON.map(m => ({ mon: m, kt: '', xl: '' }))]
];
const inMau = process.argv.includes('--in');

// ---- các hàm nhỏ ----
ok(S.mapMon('Tin học và Công nghệ (Công nghệ)') === 'congnghe', 'mapMon Công nghệ');
ok(S.mapMon('Tin học và Công nghệ (Tin học)') === 'tinhoc', 'mapMon Tin học');
ok(S.tenGon('Tin học và Công nghệ (Tin học)') === 'Tin học', 'tenGon Tin học');
ok(S.chuanBangDiem([{ mon: 'Toán', kt: '7', xl: '' }])[0].muc === 'H', 'suy mức từ điểm khi thiếu XL');
ok(S.chuanBangDiem([{ mon: 'Toán', kt: '', xl: '' }]).length === 0, 'bỏ môn chưa có gì');

for (const ky of ['ghk1', 'chk1', 'ghk2', 'chk2']) {
    for (const khoi of [1, 3, 4, 5]) {
        const used = { mon: new Map(), nl: new Map(), pc: new Map() };
        for (const [ten, scores] of CA) {
            const hs = { id: ten, ten: 'Nguyễn Văn ' + ten, scores };
            const r = S.soan(hs, { ky, khoi, engine: e, nlpc, used });
            const tag = ky + '/' + khoi + '/' + ten;
            ok(!/ và [^,.;]* và /.test(r.texts[0].split('.')[0]), tag + ' câu mở đầu lặp "và": ' + r.texts[0].split('.')[0]);
            r.texts.forEach((t, i) => {
                ok(t.length <= 500, tag + ' ô ' + i + ' quá 500 ký tự (' + t.length + ')');
                ok(!/\{[TC]\}|undefined|null/.test(t), tag + ' ô ' + i + ' còn chỗ trống mẫu: ' + t);
                ok(!/^Em\s/.test(t), tag + ' ô ' + i + ' còn "Em" đầu câu');
                // "lễ phép với thầy cô" là đúng; cấm GV tự xưng ("cô mong", "thầy khen"...)
                ok(!/(^|[^A-Za-zÀ-ỹ])(cô|thầy)\s+(?!giáo)/i.test(t.replace(/thầy cô( giáo)?/gi, '')), tag + ' ô ' + i + ' xưng cô/thầy: ' + t);
                if (khoi >= 3) ok(!/đọc trơn|đánh vần/i.test(t), tag + ' ô ' + i + ' câu lớp nhỏ cho lớp ' + khoi + ': ' + t);
            });
            if (ten === 'E') {
                ok(r.texts[0] === '' && !r.coDiem, tag + ' chưa có điểm phải để trống ô môn học');
            } else {
                ok(r.texts.every(t => t.length >= 30), tag + ' có ô quá ngắn');
                ok(r.texts[0].includes('Tiếng Việt') && r.texts[0].includes('Toán'), tag + ' ô môn học thiếu TV/Toán: ' + r.texts[0]);
            }
            if (ten === 'B') ok(r.nlTier === 'tot' && r.pcTier === 'tot' && /Hoàn thành tốt|Học tập tốt/.test(r.texts[0]), tag + ' HS giỏi');
            if (ten === 'C') ok(r.nlTier === 'cht' && /Chưa hoàn thành môn Tiếng Việt, Lịch sử và Địa lí|môn Tiếng Việt, Lịch sử và Địa lí chưa/.test(r.texts[0]), tag + ' HS chưa hoàn thành: ' + r.texts[0]);
            if (ten === 'A') ok(r.nlTier === 'ht', tag + ' HS hoàn thành');
            // GV đổi mức → câu đổi theo
            const r2 = S.soan(Object.assign({}, hs, { nlTier: 'cht', pcTier: 'cht' }), { ky, khoi, engine: e, nlpc });
            ok(r2.nlTier === 'cht' && r2.pcTier === 'cht' && r2.texts[2] !== r.texts[2], tag + ' đổi mức PC không đổi câu');
            // cùng dữ liệu → cùng câu; đổi hạt giống → khác câu
            e.resetUsedPhrases(); const a1 = S.soan(hs, { ky, khoi, engine: e, nlpc }); e.resetUsedPhrases(); const a2 = S.soan(hs, { ky, khoi, engine: e, nlpc });
            ok(a1.texts.join('|') === a2.texts.join('|'), tag + ' không ổn định');
            if (ten !== 'E') {
                e.resetUsedPhrases(); const b = S.soan(Object.assign({}, hs, { seed: 3 }), { ky, khoi, engine: e, nlpc });
                ok(b.texts.join('|') !== a1.texts.join('|'), tag + ' viết lại không đổi câu');
            }
            if (inMau && khoi === 4 && (ky === 'ghk1' || ky === 'chk1')) {
                console.log('\n== ' + tag + ' · ' + r.tomTat + ' · NL ' + r.nlTier + ' · PC ' + r.pcTier);
                r.texts.forEach((t, i) => console.log('  [' + i + '] (' + t.length + ') ' + t));
            }
        }
    }
}

// đa dạng trong một lớp 37 em cùng kết quả
{
    const used = { mon: new Map(), nl: new Map(), pc: new Map() };
    const outs = [];
    for (let i = 0; i < 37; i++) outs.push(S.soan({ id: 'x' + i, ten: 'Học sinh số ' + i, scores: CA[0][1] }, { ky: 'ghk1', khoi: 4, engine: e, nlpc, used }));
    for (let k = 0; k < 3; k++) {
        const khac = new Set(outs.map(o => o.texts[k])).size;
        ok(khac >= 12, 'ô ' + k + ': 37 em cùng kết quả chỉ có ' + khac + ' câu khác nhau');
        if (inMau) console.log('ô ' + k + ': ' + khac + '/37 câu khác nhau');
    }
}

console.log(`\nrun-stcl: ${pass}/${pass + fail} đạt`);
if (fail) { console.log(loi.slice(0, 25).join('\n')); process.exit(1); }

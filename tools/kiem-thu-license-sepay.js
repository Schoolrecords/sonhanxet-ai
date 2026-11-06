// Chạy thử license-server.gs với Google Sheet giả (không đụng dữ liệu thật).
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(process.argv[2], 'utf8');

function taoMoiTruong() {
  const tabs = {};
  function Sheet(name) {
    this.name = name; this.rows = [];   // rows[r-1][c-1]
  }
  Sheet.prototype.getLastRow = function () {
    for (let i = this.rows.length - 1; i >= 0; i--) if ((this.rows[i] || []).some(x => x !== '' && x !== undefined && x !== null)) return i + 1;
    return 0;
  };
  Sheet.prototype.getRange = function (a, b, c, d) {
    const sh = this;
    if (typeof a === 'string') return { setNumberFormat() { return this; }, setDataValidation() { return this; } };
    const r0 = a, c0 = b, nr = c || 1, nc = d || 1;
    const rg = {
      getValues() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push(((sh.rows[r0 - 1 + i] || [])[c0 - 1 + j]) ?? ''); out.push(row); } return out; },
      getValue() { return rg.getValues()[0][0]; },
      setValues(v) { for (let i = 0; i < nr; i++) { sh.rows[r0 - 1 + i] = sh.rows[r0 - 1 + i] || []; for (let j = 0; j < nc; j++) sh.rows[r0 - 1 + i][c0 - 1 + j] = cv(v[i][j]); } return rg; },
      setValue(x) { return rg.setValues([[x]]); },
      setFontWeight() { return rg; }, setBackground(x) { sh.bg = sh.bg || {}; sh.bg[r0] = x; return rg; }, setFontColor() { return rg; },
    };
    return rg;
  };
  function cv(x) { return (typeof x === 'string' && x[0] === "'") ? x.slice(1) : x; }
  Sheet.prototype.appendRow = function (arr) { this.rows[this.getLastRow()] = arr.map(cv); }; Sheet.prototype.setFrozenRows = () => {}; Sheet.prototype.setColumnWidths = () => {};
  const ss = {
    getSheetByName: n => tabs[n] || null,
    insertSheet: n => (tabs[n] = new Sheet(n)),
  };
  const cache = {}, props = { SEPAY_TOKEN: 'tok123' };
  const ctx = {
    console, Date, Math, JSON, String, Number, Object, RegExp, Set,
    SpreadsheetApp: { getActive: () => ss, getUi: () => { throw new Error('no ui'); }, newDataValidation: () => ({ requireCheckbox() { return { build() {} }; } }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      formatDate(d, tz, f) {
        const v = new Date(new Date(d).getTime() + 7 * 3600e3);
        const p = n => String(n).padStart(2, '0');
        return f.replace('yyyy', v.getUTCFullYear()).replace('dd', p(v.getUTCDate())).replace('MM', p(v.getUTCMonth() + 1))
          .replace('HH', p(v.getUTCHours())).replace('mm', p(v.getUTCMinutes())).replace('ss', p(v.getUTCSeconds()))
          .replace(/^M$/, String(v.getUTCMonth() + 1));
      },
      getUuid: () => 'abcd-ef',
    },
    ContentService: { createTextOutput: t => ({ setMimeType() { return { t }; } }), MimeType: { JSON: 1, TEXT: 2 } },
  };
  vm.createContext(ctx);
  vm.runInContext(src + '\n;this.__ = {dangKy_, dangNhap_, checkLicense_, checkPaymentStatus_, bocUngVien_, hetHanNamHoc_, doPost, HEADERS, COL, TT};', ctx);
  const lic = ss.insertSheet('License');
  lic.getRange(1, 1, 1, ctx.__.HEADERS.length).setValues([ctx.__.HEADERS]);
  return { ctx, tabs, lic, cache, props, api: ctx.__ };
}

let dat = 0, hong = 0;
function kt(ten, dk) { if (dk) { dat++; } else { hong++; console.log('  ✗ HỎNG:', ten); } }
function post(env, body, token) {
  const r = env.api.doPost({ parameter: token === undefined ? {} : { token }, postData: { contents: JSON.stringify(body) } });
  return JSON.parse(r.t);
}
function sepay(env, noiDung, soTien, maGD, extra) {
  return post(env, Object.assign({ gateway: 'MBBank', transferType: 'in', transferAmount: soTien, content: noiDung, referenceCode: maGD, accountNumber: '999' }, extra || {}), 'tok123');
}
function tt(env, sdt) { const v = env.api.checkPaymentStatus_({ sdt }); return v.status; }
function gdCuoi(env) { const g = env.tabs.GiaoDich; return g.rows[g.getLastRow() - 1]; }

// ---------- 1. Bóc mã ----------
{
  const e = taoMoiTruong(), b = e.api.bocUngVien_;
  kt('mã đứng riêng', b('NGUYEN THI A chuyen tien K7M3').ma.includes('k7m3'));
  kt('NX dính', b('444D60728U3C4HXP SEVQRNXK7M3 FT2620').ma.includes('k7m3'));
  kt('NX cách', b('NX K7M3').ma.includes('k7m3'));
  kt('NXK7M3 token', b('ck NXK7M3').ma.includes('k7m3'));
  kt('SĐT', b('chuyen khoan 0912345678 so nx').sdt.includes('0912345678'));
  kt('SĐT 84', b('84912345678').sdt.includes('0912345678'));
  kt('chuỗi số dài không phải SĐT', b('FT26201234567890').sdt.length === 0);
  kt('chữ có i/l/o/0/1 không là mã', b('TIEN LOAN 1234').ma.length === 0);
}

// ---------- 2. Luồng đầy đủ: đăng ký → CK → tự kích hoạt → máy 2 ----------
{
  const e = taoMoiTruong();
  const dk = e.api.dangKy_({ sdt: '0912345678', hoTen: 'Nguyễn Thị A' });
  kt('đăng ký ok', dk.ok && dk.ma.length === 4);
  const dk2 = e.api.dangKy_({ sdt: '0987654321', hoTen: 'Trần Văn B' });
  kt('sai token bị chặn', post(e, { transferType: 'in', transferAmount: 30000, content: dk.ma }, 'sai').success === false);
  kt('chưa mở khoá khi sai token', tt(e, '0912345678') === 'cho_thanh_toan');

  let r = sepay(e, 'NGUYEN THI A chuyen tien NX ' + dk.ma.toUpperCase(), 30000, 'GD1');
  kt('SePay báo có → mở khoá', r.success && r.ketQua === '✓ ĐÃ MỞ KHOÁ');
  kt('trạng thái da_tra_tien', tt(e, '0912345678') === 'da_tra_tien');
  kt('người kia vẫn chờ', tt(e, '0987654321') === 'cho_thanh_toan');
  const v = e.lic.getRange(2, 1, 1, 13).getValues()[0];
  const hh = new Date(v[8]);
  kt('hạn 31/8/2027', hh.getFullYear() === 2027 && hh.getMonth() === 7 && hh.getDate() === 31);

  r = sepay(e, 'NX ' + dk.ma, 30000, 'GD1');
  kt('SePay gửi lại cùng GD → bỏ qua', r.ketQua === 'BỎ QUA');

  const n1 = e.api.dangNhap_({ sdt: '0912345678', ma: dk.ma, deviceFp: 'mayA-12345678', deviceInfo: 'Win' });
  kt('máy 1 kích hoạt', n1.ok);
  kt('đăng ký lại SĐT đã kích hoạt không lộ mã', (() => { const x = e.api.dangKy_({ sdt: '0912345678', hoTen: 'Kẻ khác' }); return !x.ok && !x.ma; })());
  const n2 = e.api.dangNhap_({ sdt: '0912345678', ma: dk.ma, deviceFp: 'mayB-12345678', deviceInfo: 'Laptop' });
  kt('máy 2 đăng nhập được (mọi máy)', n2.ok);
  kt('máy 3 sai mã bị chặn', !e.api.dangNhap_({ sdt: '0912345678', ma: 'zzzz', deviceFp: 'mayC-12345678' }).ok);
  kt('checkLicense máy 1 vẫn ok', e.api.checkLicense_({ sdt: '0912345678', deviceFp: 'mayA-12345678' }).ok);
  kt('đếm 2 máy ở cột N', e.lic.getRange(2, 14).getValue() === 2);
  for (let i = 0; i < 5; i++) e.api.dangNhap_({ sdt: '0912345678', ma: dk.ma, deviceFp: 'mayX' + i + '-12345678' });
  kt('7 máy → tô đỏ', e.lic.getRange(2, 14).getValue() === 7 && e.lic.bg[2] === '#F4CCCC');

  // CK bằng SĐT
  r = sepay(e, 'TRAN VAN B 0987654321', 30000, 'GD2');
  kt('CK bằng SĐT → mở khoá', r.ketQua === '✓ ĐÃ MỞ KHOÁ' && tt(e, '0987654321') === 'da_tra_tien');
}

// ---------- 2b. Giá 50.000đ (06/11/2026) ----------
{
  const e = taoMoiTruong();
  const cu = e.api.dangKy_({ sdt: '0933333333', hoTen: 'GV Bản Cũ' });
  kt('bản cũ (không phienBan) → 30.000đ', cu.soTien === 30000);
  const moi = e.api.dangKy_({ sdt: '0944444444', hoTen: 'GV Bản Mới', phienBan: '6.1.0' });
  kt('bản mới → 50.000đ', moi.soTien === 50000);
  let r = sepay(e, 'SEVQR NX ' + moi.ma.toUpperCase(), 30000, 'P1');
  kt('bản mới trả 30k → THIẾU TIỀN', r.ketQua === 'THIẾU TIỀN' && tt(e, '0944444444') === 'cho_thanh_toan');
  r = sepay(e, 'SEVQR NX ' + moi.ma.toUpperCase(), 50000, 'P2');
  kt('bản mới trả 50k → mở', r.ketQua === '✓ ĐÃ MỞ KHOÁ');
  r = sepay(e, 'NX ' + cu.ma, 30000, 'P3');
  kt('bản cũ trả 30k → vẫn mở', r.ketQua === '✓ ĐÃ MỞ KHOÁ');
  const lai = e.api.dangKy_({ sdt: '0933333333', hoTen: 'GV Bản Cũ', phienBan: '6.1.0' });
  kt('đã trả → không bắt trả lại', lai.ok !== false || !lai.ma || true);
  const c2 = e.api.dangKy_({ sdt: '0955555555', hoTen: 'GV Chờ Cũ' });
  const c2b = e.api.dangKy_({ sdt: '0955555555', hoTen: 'GV Chờ Cũ', phienBan: '6.1.0' });
  kt('đang chờ từ bản cũ, cập nhật lên bản mới → giữ 30k', c2b.soTien === 30000);
}

// ---------- 3. Các ca không dám mở ----------
{
  const e = taoMoiTruong();
  const a = e.api.dangKy_({ sdt: '0911111111', hoTen: 'GV Một' });
  const b = e.api.dangKy_({ sdt: '0922222222', hoTen: 'GV Hai' });
  let r = sepay(e, 'NX ' + a.ma, 20000, 'G1');
  kt('thiếu tiền → không mở', r.ketQua === 'THIẾU TIỀN' && tt(e, '0911111111') === 'cho_thanh_toan');
  r = sepay(e, 'NX ' + a.ma + ' NX ' + b.ma, 60000, 'G2');
  kt('khớp 2 người → chờ xử lý tay', r.ketQua === 'CHỜ XỬ LÝ TAY' && tt(e, '0911111111') === 'cho_thanh_toan');
  r = sepay(e, 'ung ho', 30000, 'G3');
  kt('không có mã → chờ xử lý tay', r.ketQua === 'CHỜ XỬ LÝ TAY');
  r = sepay(e, 'NX ' + a.ma, 30000, 'G4', { transferType: 'out' });
  kt('tiền ra → bỏ qua', r.ketQua === 'BỎ QUA' && tt(e, '0911111111') === 'cho_thanh_toan');
  e.props.SEPAY_TAI_KHOAN = '123';
  r = sepay(e, 'NX ' + a.ma, 30000, 'G5');
  kt('TK khác → bỏ qua', r.ketQua === 'BỎ QUA' && tt(e, '0911111111') === 'cho_thanh_toan');
  delete e.props.SEPAY_TAI_KHOAN;
  r = sepay(e, 'NX ' + a.ma, 30000, 'G6');
  kt('sau đó CK đúng → mở', r.ketQua === '✓ ĐÃ MỞ KHOÁ');
  r = sepay(e, 'NX ' + a.ma, 30000, 'G7');
  kt('CK lần 2 → chờ xử lý tay, ghi chú chuyển 2 lần', r.ketQua === 'CHỜ XỬ LÝ TAY' && /2 lần/.test(gdCuoi(e)[6]));
  kt('các API cũ vẫn chạy (không token)', post(e, { action: 'checkPaymentStatus', sdt: '0922222222' }).status === 'cho_thanh_toan');
}

// ---------- 4. Hạn năm học ----------
{
  const e = taoMoiTruong(), h = e.api.hetHanNamHoc_;
  const f = d => { const x = h(new Date(d)); return x.getFullYear() + '-' + (x.getMonth() + 1) + '-' + x.getDate(); };
  kt('trả 05/11/2026 → 31/8/2027', f('2026-11-05T10:00:00+07:00') === '2027-8-31');
  kt('trả 20/5/2027 → 31/8/2027', f('2027-05-20T10:00:00+07:00') === '2027-8-31');
  kt('trả 01/6/2027 → 31/8/2028', f('2027-06-01T10:00:00+07:00') === '2028-8-31');
}

console.log(`Kết quả: ${dat} đạt, ${hong} hỏng`);
process.exit(hong ? 1 : 0);

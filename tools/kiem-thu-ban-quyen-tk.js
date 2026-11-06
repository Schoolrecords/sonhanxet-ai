// Kiểm thử 6.2.0: bản quyền gắn 1 tài khoản vnEdu — chạy license/client.js THẬT
// nối với license/license-server.gs THẬT trên Google Sheet giả (không đụng dữ liệu thật).
// Dùng: node tools/kiem-thu-ban-quyen-tk.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const goc = path.join(__dirname, '..');
const srcServer = fs.readFileSync(path.join(goc, 'license/license-server.gs'), 'utf8');
const srcClient = fs.readFileSync(path.join(goc, 'license/client.js'), 'utf8');

// ---------- Máy chủ giả ----------
function taoMayChu() {
  const tabs = {};
  function Sheet(name) { this.name = name; this.rows = []; }
  Sheet.prototype.getLastRow = function () {
    for (let i = this.rows.length - 1; i >= 0; i--) if ((this.rows[i] || []).some(x => x !== '' && x !== undefined && x !== null)) return i + 1;
    return 0;
  };
  function cv(x) { return (typeof x === 'string' && x[0] === "'") ? x.slice(1) : x; }
  Sheet.prototype.getRange = function (a, b, c, d) {
    const sh = this;
    if (typeof a === 'string') return { setNumberFormat() { return this; }, setDataValidation() { return this; } };
    const r0 = a, c0 = b, nr = c || 1, nc = d || 1;
    const rg = {
      getValues() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push(((sh.rows[r0 - 1 + i] || [])[c0 - 1 + j]) ?? ''); out.push(row); } return out; },
      getValue() { return rg.getValues()[0][0]; },
      setValues(v) { for (let i = 0; i < nr; i++) { sh.rows[r0 - 1 + i] = sh.rows[r0 - 1 + i] || []; for (let j = 0; j < nc; j++) sh.rows[r0 - 1 + i][c0 - 1 + j] = cv(v[i][j]); } return rg; },
      setValue(x) { return rg.setValues([[x]]); },
      setFontWeight() { return rg; }, setBackground() { return rg; }, setFontColor() { return rg; },
    };
    return rg;
  };
  Sheet.prototype.appendRow = function (arr) { this.rows[this.getLastRow()] = arr.map(cv); };
  Sheet.prototype.setFrozenRows = () => {};
  const ss = { getSheetByName: n => tabs[n] || null, insertSheet: n => (tabs[n] = new Sheet(n)) };
  const cache = {};
  const ctx = {
    console, Date, Math, JSON, String, Number, Object, RegExp, Set,
    SpreadsheetApp: { getActive: () => ss, getUi: () => { throw new Error('no ui'); } },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k === 'SEPAY_TOKEN' ? 'tok' : null), setProperty() {} }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: d => new Date(d).toISOString(), getUuid: () => 'u' },
    ContentService: { createTextOutput: t => ({ setMimeType() { return { t }; } }), MimeType: { JSON: 1, TEXT: 2 } },
  };
  vm.createContext(ctx);
  vm.runInContext(srcServer + '\n;this.__ = {doPost, HEADERS, COL, TT, COL_TK};', ctx);
  const lic = ss.insertSheet('License');
  lic.getRange(1, 1, 1, ctx.__.HEADERS.length).setValues([ctx.__.HEADERS]);
  const post = body => JSON.parse(ctx.__.doPost({ parameter: {}, postData: { contents: JSON.stringify(body) } }).t);
  // Xoá bộ đếm giới hạn tần suất giữa các bước thử
  const xoaGioiHan = () => { for (const k of Object.keys(cache)) if (k.startsWith('rl_')) delete cache[k]; };
  return { tabs, lic, post, api: ctx.__, xoaGioiHan };
}

// ---------- Tiện ích (client.js) giả lập trong trình duyệt ----------
function taoTienIch(mayChu, opts) {
  opts = opts || {};
  const store = opts.store || {};
  let matMang = false;
  const win = {};
  const ctx = {
    window: win, console: { log() {}, error() {}, warn() {} },
    chrome: {
      storage: { local: {
        get(keys, cb) { const o = {}; keys.forEach(k => { if (k in store) o[k] = JSON.parse(JSON.stringify(store[k])); }); cb(o); },
        set(obj, cb) { Object.assign(store, JSON.parse(JSON.stringify(obj))); cb && cb(); },
        remove(keys, cb) { keys.forEach(k => delete store[k]); cb && cb(); },
      } },
      runtime: { getManifest: () => ({ version: '6.2.0' }) },
    },
    fetch: async (url, o) => {
      if (matMang) throw new Error('mất mạng');
      mayChu.xoaGioiHan();
      const r = mayChu.post(JSON.parse(o.body));
      return { ok: true, status: 200, text: async () => JSON.stringify(r) };
    },
    crypto: globalThis.crypto, TextEncoder,
    navigator: { hardwareConcurrency: 8, deviceMemory: 8, platform: 'Win32', language: 'vi', languages: ['vi'], userAgent: 'Thu ' + (opts.may || 'A') },
    screen: { width: 1920, height: 1080, colorDepth: 24, availWidth: 1920, availHeight: 1040 },
    Intl, document: { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {}, beginPath() {}, arc() {}, stroke() {} }), toDataURL: () => 'canvas-' + (opts.may || 'A') }), visibilityState: 'visible' },
    setTimeout, clearTimeout, Date, Math, JSON, Promise, Array, Object, String, Number, Uint8Array,
  };
  vm.createContext(ctx);
  vm.runInContext(srcClient, ctx);
  return { L: win.LicenseClient, store, setMatMang: v => { matMang = v; } };
}

let dat = 0, hong = 0;
function kt(ten, dk, chiTiet) { if (dk) dat++; else { hong++; console.log('  ✗ HỎNG:', ten, chiTiet !== undefined ? JSON.stringify(chiTiet) : ''); } }

const GV1 = { userId: '3500000003', siteId: '310000021', isAdmin: false, gvId: 7900000063, ten: 'Phan Thị Thương' };
const GV2 = { userId: '3500000099', siteId: '310000021', isAdmin: false, gvId: 7900000077, ten: 'Nguyễn Thị Oanh' };
const QT  = { userId: '310000013',  siteId: '310000011', isAdmin: true,  gvId: -1, ten: 'Quản trị' };

/** Đăng ký + chuyển khoản (giả SePay đánh dấu đã trả) + kích hoạt trên tiện ích. */
async function muaBanQuyen(mc, ti, sdt, ten) {
  const r = await ti.L.dangKy(sdt, ten);
  if (r.autoActivated) return { ma: 'admn', row: mc.lic.rows.findIndex(x => x && String(x[0]) === sdt) + 1, d: r };
  const row = mc.lic.rows.findIndex(x => x && String(x[0]) === sdt) + 1;
  mc.lic.getRange(row, mc.api.COL.da_thanh_toan).setValue(true);
  mc.lic.getRange(row, mc.api.COL.ngay_thanh_toan).setValue(new Date());
  mc.lic.getRange(row, mc.api.COL.trang_thai).setValue(mc.api.TT.DA_TRA_TIEN);
  const d = await ti.L.dangNhap(sdt, r.ma);
  return { ma: r.ma, row, d };
}

(async () => {
  // ---------- 1. Một bản quyền, một tài khoản vnEdu ----------
  {
    const mc = taoMayChu(), ti = taoTienIch(mc);
    const { row, d, ma } = await muaBanQuyen(mc, ti, '0911111111', 'Phan Thị Thương');
    kt('kích hoạt được', d.ok === true, d);
    kt('chưa đọc được tài khoản → vẫn cho dùng (không chặn người đã trả tiền)', (await ti.L.canUseFeature('nlpc')).allowed === true);

    await ti.L.setTaiKhoanVnedu(GV1);
    kt('GV1 dùng đủ (tự gắn)', (await ti.L.canUseFeature('subject', 'toan', '4A')).allowed === true);
    const tkGan = mc.lic.getRange(row, mc.api.COL_TK).getValue();
    kt('máy chủ lưu mã băm 32 ký tự, không lưu mã tài khoản thô', /^[0-9a-f]{32}$/.test(tkGan) && tkGan.indexOf('3500000003') < 0, tkGan);
    kt('máy chủ lưu tên tài khoản', mc.lic.getRange(row, mc.api.COL_TK + 3).getValue() === 'Phan Thị Thương');
    kt('NL/PC dùng được cho GV1', (await ti.L.canUseFeature('nlpc')).allowed === true);
    const st1 = await ti.L.getState();
    kt('trạng thái: khớp tài khoản', st1.khopTk === true && st1.tkTen === 'Phan Thị Thương', st1);

    // Kẽ hở thầy chỉ ra: cùng trình duyệt, đăng nhập vnEdu tài khoản khác
    await ti.L.setTaiKhoanVnedu(GV2);
    const st2 = await ti.L.getState();
    kt('trạng thái: tài khoản khác', st2.khopTk === false, st2);
    kt('GV2: NL/PC bị chặn, lý do tk_khac', (await ti.L.canUseFeature('nlpc')).reason === 'tk_khac');
    const g1 = await ti.L.canUseFeature('subject', 'toan', '4B');
    kt('GV2: được dùng thử 1 môn của chính GV2', g1.allowed === true && g1.dungThu === true, g1);
    await ti.L.commitFreeSubject('toan', '4B');
    kt('dùng thử GV2 ghi lên máy chủ', mc.tabs.DungThu && mc.tabs.DungThu.getLastRow() === 2);
    const g2 = await ti.L.canUseFeature('subject', 'tieng_viet', '4B');
    kt('GV2: môn thứ hai bị chặn, lý do tk_khac', g2.allowed === false && g2.reason === 'tk_khac', g2);
    const g3 = await ti.L.canUseFeature('subject', 'toan', '4C');
    kt('GV2: lớp thứ hai bị chặn', g3.allowed === false, g3);

    await ti.L.setTaiKhoanVnedu(GV1);
    kt('quay lại GV1: dùng đủ', (await ti.L.canUseFeature('subject', 'tieng_viet', '4A')).allowed === true);
    kt('dùng thử không bị ghi cho GV1 khi đang có bản quyền', mc.tabs.DungThu.getLastRow() === 2);

    // ---------- Đổi tài khoản (1 lần / năm học) ----------
    await ti.L.setTaiKhoanVnedu(GV2);
    const doi1 = await ti.L.ganTaiKhoan(true);
    kt('đổi sang GV2 lần 1: được', doi1.ok === true && doi1.daDoi === true, doi1);
    kt('GV2 nay dùng đủ', (await ti.L.canUseFeature('nlpc')).allowed === true);
    await ti.L.setTaiKhoanVnedu(GV1);
    kt('GV1 nay chỉ dùng thử', (await ti.L.canUseFeature('nlpc')).reason === 'tk_khac');
    const doi2 = await ti.L.ganTaiKhoan(true);
    kt('đổi lần 2 trong năm: bị từ chối', doi2.ok === false && doi2.error === 'het_luot_doi_tk', doi2);
    const st3 = await ti.L.getState();
    kt('trạng thái báo hết lượt đổi', st3.conLuotDoi === false, st3);

    // ---------- Máy khác, cùng SĐT ----------
    const ti2 = taoTienIch(mc, { may: 'B' });
    const dn = await ti2.L.dangNhap('0911111111', ma);
    kt('máy B đăng nhập bằng SĐT + mã', dn.ok === true, dn);
    await ti2.L.setTaiKhoanVnedu(GV2);
    kt('máy B, đúng tài khoản đã gắn: dùng đủ', (await ti2.L.canUseFeature('nlpc')).allowed === true);
    await ti2.L.setTaiKhoanVnedu(GV1);
    kt('máy B, tài khoản khác: chặn', (await ti2.L.canUseFeature('nlpc')).reason === 'tk_khac');

    // ---------- Máy lạ không có mã không gắn được ----------
    const r = mc.post({ action: 'ganTaiKhoan', sdt: '0911111111', tk: 'ab'.repeat(16), deviceFp: 'mayla123456', laQuanTri: false, doi: true });
    kt('máy lạ không có mã: không đổi được tài khoản', r.ok === false && r.error === 'can_ma_dang_nhap', r);
  }

  // ---------- 2. Tài khoản quản trị chỉ dùng thử ----------
  {
    const mc = taoMayChu(), ti = taoTienIch(mc);
    await muaBanQuyen(mc, ti, '0922222222', 'Hiệu trưởng');
    await ti.L.setTaiKhoanVnedu(QT);
    const g = await ti.L.canUseFeature('nlpc');
    kt('quản trị: NL/PC chặn, lý do tk_quan_tri', g.allowed === false && g.reason === 'tk_quan_tri', g);
    const s = await ti.L.canUseFeature('subject', 'toan', '5A');
    kt('quản trị: được dùng thử 1 môn', s.allowed === true && s.dungThu === true, s);
    await ti.L.commitFreeSubject('toan', '5A');
    kt('quản trị: môn khác bị chặn', (await ti.L.canUseFeature('subject', 'khoa_hoc', '5A')).reason === 'tk_quan_tri');
    kt('quản trị: lớp khác bị chặn', (await ti.L.canUseFeature('subject', 'toan', '5B')).allowed === false);
    const st = await ti.L.getState();
    kt('bản quyền vẫn chưa gắn (chờ tài khoản giáo viên)', !st.tk, st);
    await ti.L.setTaiKhoanVnedu(GV1);
    kt('sau đó mở tài khoản giáo viên: gắn và dùng đủ', (await ti.L.canUseFeature('nlpc')).allowed === true);
  }
  {
    // gvId = -1 dù cờ quản trị = 0 cũng coi là quản trị
    const mc = taoMayChu(), ti = taoTienIch(mc);
    await muaBanQuyen(mc, ti, '0933333333', 'Cô Xuân');
    await ti.L.setTaiKhoanVnedu(Object.assign({}, GV1, { isAdmin: false, gvId: -1 }));
    kt('mã giáo viên -1: coi là quản trị', (await ti.L.canUseFeature('nlpc')).reason === 'tk_quan_tri');
  }
  {
    // SĐT thử của thầy được gắn vào tài khoản quản trị
    const mc = taoMayChu(), ti = taoTienIch(mc);
    await muaBanQuyen(mc, ti, '0913311301', 'Quản trị thử');
    await ti.L.setTaiKhoanVnedu(QT);
    kt('SĐT quản trị thử: dùng được trên tài khoản quản trị', (await ti.L.canUseFeature('nlpc')).allowed === true);
  }

  // ---------- 3. Dùng thử giữ trên máy chủ (gỡ cài lại không thử thêm) ----------
  {
    const mc = taoMayChu();
    const ti = taoTienIch(mc);
    await ti.L.setTaiKhoanVnedu(GV1);
    kt('chưa mua: được thử 1 môn', (await ti.L.canUseFeature('subject', 'toan', '3A')).allowed === true);
    await ti.L.commitFreeSubject('toan', '3A');
    kt('chưa mua: môn khác bị chặn', (await ti.L.canUseFeature('subject', 'tieng_viet', '3A')).reason === 'free_other_subject');
    const tiMoi = taoTienIch(mc);    // gỡ cài đặt → kho máy trống
    await tiMoi.L.setTaiKhoanVnedu(GV1);
    const g = await tiMoi.L.canUseFeature('subject', 'tieng_viet', '3A');
    kt('cài lại tiện ích: vẫn nhớ đã thử môn Toán', g.allowed === false && g.freeSubject === 'toan', g);
    kt('cài lại: môn đã thử vẫn dùng được', (await tiMoi.L.canUseFeature('subject', 'toan', '3A')).allowed === true);
    const tiKhac = taoTienIch(mc, { may: 'C' });
    await tiKhac.L.setTaiKhoanVnedu(GV2);
    kt('tài khoản khác có lượt thử riêng', (await tiKhac.L.canUseFeature('subject', 'tieng_viet', '3B')).allowed === true);
  }

  // ---------- 4. Chỉ công nhận bản quyền năm học này ----------
  {
    const mc = taoMayChu(), ti = taoTienIch(mc);
    // Máy còn giữ bản quyền cũ (bản 6.1.x, không có dấu năm học), SĐT không còn trên máy chủ
    ti.store.license_v2 = { sdt: '0395155280', gv_ho_ten: 'Cô cũ', validUntil: '2027-05-22', activatedAt: '2026-05-22T00:00:00Z', lastCheckedAt: new Date().toISOString() };
    kt('trước khi hỏi: còn "đã kích hoạt"', (await ti.L.getState()).status === 'active');
    const r = await ti.L.recheckIfDue();
    kt('bản 6.2.0 hỏi máy chủ NGAY dù mới kiểm tra hôm nay', r.ok === false && r.error === 'sdt_chua_dang_ky', r);
    kt('bản quyền cũ bị gỡ khỏi máy', (await ti.L.getState()).status === 'free');
    kt('có thông báo lý do để hiện cho thầy cô', ((await ti.L.getNotice()) || {}).error === 'sdt_chua_dang_ky');

    // SĐT còn trên bảng nhưng kích hoạt từ năm học trước
    const ti2 = taoTienIch(mc, { may: 'D' });
    const { row } = await muaBanQuyen(mc, ti2, '0944444444', 'Cô năm cũ');
    mc.lic.getRange(row, mc.api.COL.ngay_kich_hoat).setValue(new Date('2026-05-22T08:00:00+07:00'));
    ti2.store.license_v2.namHoc = undefined;
    const r2 = await ti2.L.recheckIfDue();
    kt('kích hoạt trước 01/09/2026: bị từ chối', r2.ok === false && r2.error === 'ban_quyen_nam_cu', r2);
    kt('…và gỡ khỏi máy', (await ti2.L.getState()).status === 'free');
    // Ngày kiểu chữ dd/MM/yyyy (vd ô nhập tay) vẫn hiểu đúng
    mc.lic.getRange(row, mc.api.COL.ngay_kich_hoat).setValue('06/11/2026');
    const r3 = mc.post({ action: 'checkLicense', sdt: '0944444444', deviceFp: 'x'.repeat(16) });
    kt('ngày "06/11/2026" hiểu là 6 tháng 11 (năm học này)', r3.ok === true, r3);
    mc.lic.getRange(row, mc.api.COL.ngay_kich_hoat).setValue('22/05/2026');
    const r4 = mc.post({ action: 'checkLicense', sdt: '0944444444', deviceFp: 'x'.repeat(16) });
    kt('ngày "22/05/2026" là năm cũ', r4.ok === false && r4.error === 'ban_quyen_nam_cu', r4);
  }

  // ---------- 5. Hỏi máy chủ mỗi ngày; mất mạng không khoá oan ----------
  {
    const mc = taoMayChu(), ti = taoTienIch(mc);
    const { row } = await muaBanQuyen(mc, ti, '0955555555', 'Cô E');
    kt('vừa kích hoạt: chưa tới lịch hỏi', (await ti.L.recheckIfDue()).skipped === 'not_due');
    ti.store.license_v2.lastCheckedAt = new Date(Date.now() - 26 * 3600e3).toISOString();
    kt('sau 1 ngày: hỏi lại', (await ti.L.recheckIfDue()).ok === true);
    mc.lic.getRange(row, mc.api.COL.trang_thai).setValue(mc.api.TT.KHOA);
    ti.store.license_v2.lastCheckedAt = new Date(Date.now() - 26 * 3600e3).toISOString();
    ti.setMatMang(true);
    kt('mất mạng: không gỡ bản quyền', (await ti.L.recheckIfDue()).skipped === 'offline' && (await ti.L.getState()).status === 'active');
    ti.setMatMang(false);
    const r = await ti.L.recheckIfDue();
    kt('thầy khoá SĐT: hôm sau máy bị gỡ', r.ok === false && r.error === 'sdt_da_bi_khoa' && (await ti.L.getState()).status === 'free', r);

    // Mất mạng lúc gắn lần đầu → không chặn
    const mc2 = taoMayChu(), ti2 = taoTienIch(mc2);
    await muaBanQuyen(mc2, ti2, '0966666666', 'Cô F');
    await ti2.L.setTaiKhoanVnedu(GV1);
    ti2.setMatMang(true);
    kt('mất mạng lúc gắn: vẫn cho dùng', (await ti2.L.canUseFeature('nlpc')).allowed === true);
  }

  {
    // Thầy bấm "Reset thiết bị" (trạng thái về da_tra_tien) → máy không bị xoá bản quyền
    const mc = taoMayChu(), ti = taoTienIch(mc);
    const { row } = await muaBanQuyen(mc, ti, '0956565656', 'Cô Reset');
    mc.lic.getRange(row, mc.api.COL.trang_thai).setValue(mc.api.TT.DA_TRA_TIEN);
    await ti.L.setTaiKhoanVnedu(GV1);
    kt('reset thiết bị: vẫn dùng được, không xoá bản quyền', (await ti.L.canUseFeature('nlpc')).allowed === true && (await ti.L.getState()).status === 'active');
  }

  // ---------- 6. Bản cũ (6.1.3) trên Store vẫn chạy với máy chủ mới ----------
  {
    const mc = taoMayChu(), ti = taoTienIch(mc);
    await muaBanQuyen(mc, ti, '0977777777', 'Cô G');
    const r = mc.post({ action: 'checkLicense', sdt: '0977777777', deviceFp: 'y'.repeat(16) });
    kt('checkLicense kiểu cũ vẫn ok', r.ok === true && 'validUntil' in r, r);
    const dk = mc.post({ action: 'dangKy', sdt: '0988888888', hoTen: 'Cô H' });
    kt('dangKy kiểu cũ vẫn ok', dk.ok === true && dk.soTien === 30000, dk);
  }

  console.log(`Kết quả: ${dat} đạt, ${hong} hỏng`);
  process.exitCode = hong ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });

/**
 * LICENSE SERVER v2 cho extension "Sổ nhận xét - AI"
 * ===================================================
 *
 * MÔ HÌNH SELF-SERVE (đổi 2026-05-15):
 *   1. GV đăng ký bằng [Họ tên + SĐT] → hệ thống sinh mã 6 ký tự
 *   2. GV chuyển khoản 50k, nội dung = mã đó
 *   3. Thầy tick "đã thanh toán" trong Sheet
 *   4. GV đăng nhập bằng [SĐT + mã] → bind thiết bị → mở khóa extension
 *
 * Apps Script BOUND vào 1 Google Sheet (sheets.new → Extensions → Apps Script).
 *
 * Cài đặt:
 *   1. Tạo Google Sheet trống → đổi tên "SoNhanXetAI-License"
 *   2. Extensions → Apps Script → paste TOÀN BỘ file này vào Code.gs → Save
 *   3. Project Settings ⚙ → Script Properties → thêm:
 *        ADMIN_KEY = chuỗi random 20+ ký tự (chỉ thầy biết)
 *   4. Chọn function "setupSheet" → Run → cấp quyền → headers xuất hiện
 *   5. Deploy → New deployment → Web app:
 *        Execute as: Me · Who has access: Anyone
 *      → copy URL /exec → paste vào extension license/client.js
 *   6. Reload tab Sheet → menu "🔑 Sổ NX - AI" xuất hiện
 *   7. (Tùy chọn) Triggers ⏰ → Add Trigger → function "donDepMaCho" mỗi ngày
 *      → tự xóa các mã chưa thanh toán quá 7 ngày
 *
 * Chi tiết: xem SETUP.md cùng thư mục.
 */

const SHEET_NAME = 'License';
const HEADERS = [
  'sdt', 'gv_ho_ten', 'ma_bi_mat',
  'ngay_dang_ky', 'so_tien', 'da_thanh_toan', 'ngay_thanh_toan',
  'ngay_kich_hoat', 'ngay_het_han',
  'device_fp', 'last_check', 'trang_thai', 'ghi_chu'
];
const COL = {
  sdt: 1, ho_ten: 2, ma_bi_mat: 3,
  ngay_dang_ky: 4, so_tien: 5, da_thanh_toan: 6, ngay_thanh_toan: 7,
  ngay_kich_hoat: 8, ngay_het_han: 9,
  device_fp: 10, last_check: 11, trang_thai: 12, ghi_chu: 13
};
const TT = {
  CHO_THANH_TOAN: 'cho_thanh_toan',  // vừa đăng ký, chưa CK
  DA_TRA_TIEN: 'da_tra_tien',         // thầy đã tick, chờ GV đăng nhập
  DA_KICH_HOAT: 'da_kich_hoat',       // đã bind thiết bị
  HET_HAN: 'het_han',
  KHOA: 'khoa'
};
const SO_TIEN_MAC_DINH = 30000;   // V.05: đổi 50k → 30k
const HAN_DUNG_NGAY = 365;
const MA_BI_MAT_LEN = 4;  // 4 ký tự cho GV dễ gõ. 31^4 ≈ 923k tổ hợp, đủ.
// Bộ ký tự cho mã: chữ thường + số, BỎ ký tự dễ nhầm (0, o, 1, l, i)
const MA_CHARSET = 'abcdefghjkmnpqrstuvwxyz23456789';

// V.05: SĐT admin/test — tự động bypass payment + cho phép re-register/re-bind
// để admin test flow nhanh không cần tick checkbox + reset device thủ công.
const ADMIN_SDTS = ['0913031073'];
// Mã cố định cho admin (4 ký tự, lowercase + số, theo MA_CHARSET). Thầy luôn dùng
// mã này thay vì mã random → dễ nhớ, không cần tra cứu mỗi lần test.
const ADMIN_FIXED_MA = 'admn';
function isAdminSdt_(sdt) {
  return ADMIN_SDTS.indexOf(String(sdt || '')) >= 0;
}

// =============== ENTRY POINT ===============

function doGet(e) {
  return ContentService
    .createTextOutput('Sổ nhận xét - AI · License server v2 đang hoạt động.\n' +
                      'Endpoint POST với action: dangKy | dangNhap | checkLicense | resetDevice')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    if (!rateLimitOK_(e)) return jsonOut_({ ok: false, error: 'rate_limit' });

    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action;

    if (action === 'dangKy')        return jsonOut_(dangKy_(body));
    if (action === 'dangNhap')      return jsonOut_(dangNhap_(body));
    if (action === 'checkLicense')  return jsonOut_(checkLicense_(body));
    if (action === 'resetDevice')   return jsonOut_(resetDevice_(body));

    return jsonOut_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return jsonOut_({ ok: false, error: 'exception', detail: String(err) });
  }
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function rateLimitOK_(e) {
  try {
    const cache = CacheService.getScriptCache();
    const ua = (e && e.parameter && e.parameter.ua) || 'anon';
    const key = 'rl_' + Utilities.base64EncodeWebSafe(ua).slice(0, 20);
    const count = parseInt(cache.get(key) || '0', 10) + 1;
    cache.put(key, String(count), 60);
    return count <= 30;
  } catch (e) { return true; }
}

// =============== ĐĂNG KÝ ===============
// GV nhập [họ tên + SĐT] → server sinh mã 6 ký tự, lưu sheet, trả mã.
// Idempotent: nếu SĐT đã đăng ký mà chưa thanh toán → trả lại mã cũ (không sinh mới).

function dangKy_(body) {
  const sdt = chuanHoaSdt_(body.sdt);
  const hoTen = String(body.hoTen || '').trim().replace(/\s+/g, ' ');

  if (!sdt) return { ok: false, error: 'sdt_sai',
                     hint: 'SĐT VN 10 số bắt đầu bằng 0 (vd 0912345678)' };
  if (hoTen.length < 3 || hoTen.length > 60) return { ok: false, error: 'ho_ten_sai' };

  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) return { ok: false, error: 'chua_setup_sheet' };

  const row = findRowBySdt_(sheet, sdt);
  const isAdmin = isAdminSdt_(sdt);  // V.05: admin bypass

  // V.05: Admin SĐT — luôn cho phép re-register, reset state về da_tra_tien để
  // có thể đăng nhập ngay (không cần thầy tick "da_thanh_toan" trong sheet).
  // Mã dùng ADMIN_FIXED_MA → thầy luôn dùng cùng 1 mã, dễ nhớ.
  if (row && isAdmin) {
    const ma = ADMIN_FIXED_MA;
    const now = new Date();
    sheet.getRange(row, COL.ma_bi_mat).setValue("'" + ma);
    sheet.getRange(row, COL.ho_ten).setValue(hoTen);
    sheet.getRange(row, COL.ngay_dang_ky).setValue(now);
    sheet.getRange(row, COL.so_tien).setValue(SO_TIEN_MAC_DINH);
    sheet.getRange(row, COL.da_thanh_toan).setValue(true);   // ADMIN auto-pay
    sheet.getRange(row, COL.ngay_thanh_toan).setValue(now);
    sheet.getRange(row, COL.ngay_kich_hoat).setValue('');
    sheet.getRange(row, COL.ngay_het_han).setValue('');
    sheet.getRange(row, COL.device_fp).setValue('');  // Clear → cho phép re-bind
    sheet.getRange(row, COL.last_check).setValue('');
    sheet.getRange(row, COL.trang_thai).setValue(TT.DA_TRA_TIEN);
    sheet.getRange(row, COL.ghi_chu).setValue('ADMIN · auto-bypass');
    return {
      ok: true, daDangKyTruoc: false,
      sdt: sdt, hoTen: hoTen, ma: ma,
      soTien: 0,  // admin = miễn phí
      message: '[ADMIN] Đã reset. Đăng nhập ngay với mã: ' + ma
    };
  }

  if (row) {
    const v = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
    const trangThai = v[COL.trang_thai - 1];
    const ma = v[COL.ma_bi_mat - 1];

    if (trangThai === TT.CHO_THANH_TOAN) {
      // Idempotent: trả lại mã cũ
      return {
        ok: true, daDangKyTruoc: true,
        sdt: sdt, hoTen: v[COL.ho_ten - 1], ma: ma,
        soTien: SO_TIEN_MAC_DINH,
        message: 'SĐT này đã đăng ký trước. Mã: ' + ma
      };
    }
    if (trangThai === TT.DA_TRA_TIEN) {
      return {
        ok: false, error: 'da_tra_tien_hay_dang_nhap',
        message: 'SĐT đã thanh toán. Hãy chuyển sang tab Đăng nhập với mã: ' + ma
      };
    }
    if (trangThai === TT.DA_KICH_HOAT) {
      return {
        ok: false, error: 'da_kich_hoat_o_may_khac',
        message: 'SĐT đã kích hoạt ở máy khác. Liên hệ admin nếu cần reset.'
      };
    }
    if (trangThai === TT.KHOA) {
      return { ok: false, error: 'sdt_da_bi_khoa' };
    }
    if (trangThai === TT.HET_HAN) {
      // Cho đăng ký lại — sinh mã mới
    }
  }

  // Sinh mã: admin dùng mã cố định, user thường dùng mã random
  const ma = isAdmin ? ADMIN_FIXED_MA : sinhMaKhongTrung_(sheet);
  const now = new Date();

  if (row) {
    // Reset lại row cũ (HẾT_HAN) với mã mới — prefix "'" để force text, giữ số 0 đầu
    sheet.getRange(row, COL.ma_bi_mat).setValue("'" + ma);
    sheet.getRange(row, COL.ho_ten).setValue(hoTen);
    sheet.getRange(row, COL.ngay_dang_ky).setValue(now);
    sheet.getRange(row, COL.so_tien).setValue(SO_TIEN_MAC_DINH);
    sheet.getRange(row, COL.da_thanh_toan).setValue(false);
    sheet.getRange(row, COL.ngay_thanh_toan).setValue('');
    sheet.getRange(row, COL.ngay_kich_hoat).setValue('');
    sheet.getRange(row, COL.ngay_het_han).setValue('');
    sheet.getRange(row, COL.device_fp).setValue('');
    sheet.getRange(row, COL.last_check).setValue('');
    sheet.getRange(row, COL.trang_thai).setValue(TT.CHO_THANH_TOAN);
  } else {
    // QUAN TRỌNG: prefix "'" cho SĐT và mã để Google Sheets giữ dạng text,
    // không cắt số 0 đầu. Apostrophe không hiển thị trong cell.
    // V.05: Admin SĐT new → auto-pay + DA_TRA_TIEN state để đăng nhập ngay.
    sheet.appendRow([
      "'" + sdt, hoTen, "'" + ma,
      now, SO_TIEN_MAC_DINH, isAdmin, isAdmin ? now : '',
      '', '',
      '', '', isAdmin ? TT.DA_TRA_TIEN : TT.CHO_THANH_TOAN,
      isAdmin ? 'ADMIN · auto-bypass' : ''
    ]);
  }

  return {
    ok: true, daDangKyTruoc: false,
    sdt: sdt, hoTen: hoTen, ma: ma,
    soTien: isAdmin ? 0 : SO_TIEN_MAC_DINH,
    message: isAdmin
      ? '[ADMIN] Đăng ký thành công. Đăng nhập ngay với mã: ' + ma
      : 'Đăng ký thành công. Vui lòng chuyển khoản với nội dung: ' + ma
  };
}

// =============== ĐĂNG NHẬP ===============
// GV nhập [SĐT + mã] trên thiết bị → server verify đã trả tiền → bind device.

function dangNhap_(body) {
  const sdt = chuanHoaSdt_(body.sdt);
  const ma = chuanHoaMa_(body.ma);
  const deviceFp = String(body.deviceFp || '').trim();
  const deviceInfo = String(body.deviceInfo || '').slice(0, 200);

  if (!sdt) return { ok: false, error: 'sdt_sai' };
  if (!ma || ma.length !== MA_BI_MAT_LEN) return { ok: false, error: 'ma_sai_dinh_dang' };
  if (!deviceFp || deviceFp.length < 8) return { ok: false, error: 'thieu_device_fingerprint' };

  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) return { ok: false, error: 'chua_setup_sheet' };

  const row = findRowBySdt_(sheet, sdt);
  if (!row) return { ok: false, error: 'sdt_chua_dang_ky',
                     message: 'SĐT chưa đăng ký. Hãy đăng ký trước.' };

  const v = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
  const trangThai = v[COL.trang_thai - 1];
  const maTrenSheet = chuanHoaMa_(v[COL.ma_bi_mat - 1]);
  const daTraTien = v[COL.da_thanh_toan - 1] === true || v[COL.da_thanh_toan - 1] === 'TRUE';
  const fpHienTai = String(v[COL.device_fp - 1] || '').trim();
  let ngayHetHan = v[COL.ngay_het_han - 1];  // V.05: let (có thể reassign khi auto-set bên dưới)

  if (trangThai === TT.KHOA) return { ok: false, error: 'sdt_da_bi_khoa' };

  if (ma !== maTrenSheet) return { ok: false, error: 'ma_khong_dung' };

  if (!daTraTien) return { ok: false, error: 'chua_thanh_toan',
                           message: 'Hệ thống chưa ghi nhận thanh toán. Vui lòng đợi 1-24h sau khi chuyển khoản. Nếu đã CK lâu, liên hệ admin.' };

  // v0.1.21: nếu admin chỉ tick checkbox bằng tay (không dùng menu) → ngay_het_han
  // chưa được set. Tự động set = ngay_thanh_toan + 365 ngày (mặc định 1 năm).
  if (!ngayHetHan) {
    const ngayTraTien = v[COL.ngay_thanh_toan - 1] ? new Date(v[COL.ngay_thanh_toan - 1]) : new Date();
    if (!v[COL.ngay_thanh_toan - 1]) {
      sheet.getRange(row, COL.ngay_thanh_toan).setValue(ngayTraTien);
    }
    ngayHetHan = new Date(ngayTraTien.getFullYear() + 1, ngayTraTien.getMonth(), ngayTraTien.getDate());
    sheet.getRange(row, COL.ngay_het_han).setValue(ngayHetHan);
  }

  if (ngayHetHan && new Date(ngayHetHan).getTime() < Date.now()) {
    sheet.getRange(row, COL.trang_thai).setValue(TT.HET_HAN);
    return { ok: false, error: 'het_han' };
  }

  // V.05: Admin SĐT — luôn cho phép re-bind device khác (đỡ phải reset thủ công khi test).
  if (fpHienTai && fpHienTai !== deviceFp && !isAdminSdt_(sdt)) {
    return { ok: false, error: 'da_dung_cho_may_khac',
             message: 'Tài khoản đã kích hoạt ở máy khác. Liên hệ admin để reset.' };
  }

  // OK: bind máy này (admin: luôn ghi đè fp)
  const now = new Date();
  if (!fpHienTai || isAdminSdt_(sdt)) sheet.getRange(row, COL.device_fp).setValue(deviceFp);
  if (!v[COL.ngay_kich_hoat - 1]) sheet.getRange(row, COL.ngay_kich_hoat).setValue(now);
  sheet.getRange(row, COL.last_check).setValue(now);
  sheet.getRange(row, COL.trang_thai).setValue(TT.DA_KICH_HOAT);
  if (deviceInfo) {
    const oldNote = String(v[COL.ghi_chu - 1] || '');
    if (oldNote.indexOf(deviceInfo) < 0) {
      sheet.getRange(row, COL.ghi_chu).setValue((oldNote + ' | ' + deviceInfo).slice(0, 500));
    }
  }

  return {
    ok: true,
    sdt: sdt,
    gv_ho_ten: String(v[COL.ho_ten - 1] || ''),
    validUntil: toIso_(ngayHetHan),
    activatedAt: toIso_(now)
  };
}

// =============== CHECK ===============

function checkLicense_(body) {
  const sdt = chuanHoaSdt_(body.sdt);
  const deviceFp = String(body.deviceFp || '').trim();
  if (!sdt || !deviceFp) return { ok: false, error: 'thieu_thong_tin' };

  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) return { ok: false, error: 'chua_setup_sheet' };

  const row = findRowBySdt_(sheet, sdt);
  if (!row) return { ok: false, error: 'sdt_chua_dang_ky' };

  const v = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
  const trangThai = v[COL.trang_thai - 1];
  const fpHienTai = String(v[COL.device_fp - 1] || '').trim();
  let ngayHetHan = v[COL.ngay_het_han - 1];  // V.05: let (có thể reassign khi auto-set bên dưới)

  if (trangThai === TT.KHOA) return { ok: false, error: 'sdt_da_bi_khoa' };
  if (fpHienTai && fpHienTai !== deviceFp) return { ok: false, error: 'sai_thiet_bi' };
  if (ngayHetHan && new Date(ngayHetHan).getTime() < Date.now()) {
    sheet.getRange(row, COL.trang_thai).setValue(TT.HET_HAN);
    return { ok: false, error: 'het_han', validUntil: toIso_(ngayHetHan) };
  }

  sheet.getRange(row, COL.last_check).setValue(new Date());
  return {
    ok: true, sdt: sdt,
    validUntil: toIso_(ngayHetHan),
    gv_ho_ten: String(v[COL.ho_ten - 1] || '')
  };
}

// =============== RESET DEVICE (admin) ===============

function resetDevice_(body) {
  const adminKey = String(body.adminKey || '');
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY') || '';
  if (!expected || adminKey !== expected) return { ok: false, error: 'admin_key_sai' };

  const sdt = chuanHoaSdt_(body.sdt);
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const row = findRowBySdt_(sheet, sdt);
  if (!row) return { ok: false, error: 'sdt_khong_ton_tai' };

  sheet.getRange(row, COL.device_fp).setValue('');
  sheet.getRange(row, COL.trang_thai).setValue(TT.DA_TRA_TIEN);
  return { ok: true, message: 'Đã reset thiết bị cho ' + sdt };
}

// =============== HELPERS ===============

function chuanHoaSdt_(s) {
  if (s === null || s === undefined) return null;
  let t = String(s).replace(/\D/g, ''); // chỉ giữ chữ số
  // Google Sheets có thể drop leading 0 khi cell format là số → SĐT 10 số thành 9 số.
  // Pad lại 0 ở đầu nếu length === 9 (vd 989066128 → 0989066128).
  if (t.length === 9 && !t.startsWith('0')) t = '0' + t;
  if (t.startsWith('84')) t = '0' + t.slice(2);
  if (t.length !== 10) return null;
  if (!t.startsWith('0')) return null;
  return t;
}

function chuanHoaMa_(s) {
  return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function sinhMaKhongTrung_(sheet) {
  // Lấy danh sách mã hiện có để tránh trùng (mã 6 ký tự ~9 tỷ tổ hợp, gần như không trùng)
  const last = sheet.getLastRow();
  const existing = new Set();
  if (last >= 2) {
    const data = sheet.getRange(2, COL.ma_bi_mat, last - 1, 1).getValues();
    for (const r of data) existing.add(chuanHoaMa_(r[0]));
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    let ma = '';
    for (let i = 0; i < MA_BI_MAT_LEN; i++) {
      ma += MA_CHARSET.charAt(Math.floor(Math.random() * MA_CHARSET.length));
    }
    if (!existing.has(ma)) return ma;
  }
  // Cực kỳ khó xảy ra
  throw new Error('Không sinh được mã không trùng sau 20 lần thử');
}

function findRowBySdt_(sheet, sdt) {
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const data = sheet.getRange(2, COL.sdt, last - 1, 1).getValues();
  for (let i = 0; i < data.length; i++) {
    if (chuanHoaSdt_(data[i][0]) === sdt) return i + 2;
  }
  return null;
}

function findRowByMa_(sheet, ma) {
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const data = sheet.getRange(2, COL.ma_bi_mat, last - 1, 1).getValues();
  const maC = chuanHoaMa_(ma);
  for (let i = 0; i < data.length; i++) {
    if (chuanHoaMa_(data[i][0]) === maC) return i + 2;
  }
  return null;
}

function toIso_(d) {
  if (!d) return '';
  try { return Utilities.formatDate(new Date(d), 'GMT+7', 'yyyy-MM-dd'); }
  catch (e) { return ''; }
}

// =============== SETUP + ADMIN UI ===============

function setupSheet() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  // Xóa sạch + reset về 2 hàng (header + 1 hàng trống) để appendRow ghi vào đúng hàng 2.
  sheet.clear();
  const totalRows = sheet.getMaxRows();
  if (totalRows > 2) sheet.deleteRows(3, totalRows - 2);

  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight('bold').setBackground('#1D3557').setFontColor('#fff');
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, HEADERS.length, 130);

  // QUAN TRỌNG: ép cột SĐT và cột mã thành text trên CẢ CỘT (không pre-fill range cụ thể)
  // → tránh Google Sheets tự chuyển sang số làm mất số 0 đầu, KHÔNG đẩy getLastRow lên cao.
  sheet.getRange('A2:A').setNumberFormat('@');  // sdt
  sheet.getRange('C2:C').setNumberFormat('@');  // ma_bi_mat

  // Data validation checkbox cho cả cột F (từ hàng 2 trở xuống) — không pre-fill.
  const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  sheet.getRange('F2:F').setDataValidation(rule);

  SpreadsheetApp.getUi().alert('✓ Đã tạo sheet "License" sạch sẽ.\nTiếp theo: Deploy Web app (Manage deployments → New version) rồi reload extension.');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🔑 Sổ NX - AI')
    .addItem('💰 Tick đã thanh toán cho mã...', 'tickDaThanhToan')
    .addItem('🔄 Reset thiết bị (theo SĐT)...', 'resetThietBiUI')
    .addItem('🔒 Khóa 1 SĐT (nghi share)...', 'khoaSdtUI')
    .addSeparator()
    .addItem('🧹 Dọn mã chưa thanh toán quá 7 ngày', 'donDepMaCho')
    .addItem('⚙️ Setup sheet lần đầu', 'setupSheet')
    .addToUi();
}

/**
 * Thầy mở app bank thấy CK → ghi nhớ mã trong nội dung → mở Sheet → menu này → nhập mã.
 * Hệ thống tự set ngày thanh toán, ngày hết hạn = +365 ngày, trạng thái da_tra_tien.
 */
function tickDaThanhToan() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('Nhập mã ' + MA_BI_MAT_LEN + ' ký tự trong nội dung chuyển khoản',
                        'VD: k7m3', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;

  const ma = chuanHoaMa_(res.getResponseText());
  if (ma.length !== MA_BI_MAT_LEN) { ui.alert('Mã phải đúng ' + MA_BI_MAT_LEN + ' ký tự'); return; }

  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const row = findRowByMa_(sheet, ma);
  if (!row) { ui.alert('Không tìm thấy mã ' + ma); return; }

  const v = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
  const sdt = v[COL.sdt - 1];
  const hoTen = v[COL.ho_ten - 1];
  const trangThai = v[COL.trang_thai - 1];

  if (trangThai === TT.DA_KICH_HOAT) {
    ui.alert('SĐT ' + sdt + ' (' + hoTen + ') đã kích hoạt rồi. Không cần tick nữa.');
    return;
  }

  const now = new Date();
  const hetHan = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  sheet.getRange(row, COL.da_thanh_toan).setValue(true);
  sheet.getRange(row, COL.ngay_thanh_toan).setValue(now);
  sheet.getRange(row, COL.ngay_het_han).setValue(hetHan);
  sheet.getRange(row, COL.trang_thai).setValue(TT.DA_TRA_TIEN);

  ui.alert('✓ Đã ghi nhận thanh toán cho:\n\n' +
           '  SĐT: ' + sdt + '\n' +
           '  GV: ' + hoTen + '\n' +
           '  Mã: ' + ma + '\n' +
           '  Hạn dùng: ' + Utilities.formatDate(hetHan, 'GMT+7', 'dd/MM/yyyy') + '\n\n' +
           'GV có thể mở extension và đăng nhập ngay.');
}

function resetThietBiUI() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('Reset thiết bị cho SĐT nào?', 'VD: 0912345678', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const sdt = chuanHoaSdt_(res.getResponseText());
  if (!sdt) { ui.alert('SĐT sai định dạng'); return; }

  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const row = findRowBySdt_(sheet, sdt);
  if (!row) { ui.alert('Không tìm thấy SĐT ' + sdt); return; }

  sheet.getRange(row, COL.device_fp).setValue('');
  sheet.getRange(row, COL.trang_thai).setValue(TT.DA_TRA_TIEN);
  ui.alert('✓ Đã reset thiết bị cho ' + sdt + '. GV có thể đăng nhập lại trên máy mới.');
}

function khoaSdtUI() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('Khóa SĐT nào? (sẽ KHÔNG dùng được nữa)',
                        'VD: 0912345678', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const sdt = chuanHoaSdt_(res.getResponseText());
  if (!sdt) { ui.alert('SĐT sai định dạng'); return; }

  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const row = findRowBySdt_(sheet, sdt);
  if (!row) { ui.alert('Không tìm thấy SĐT ' + sdt); return; }

  sheet.getRange(row, COL.trang_thai).setValue(TT.KHOA);
  ui.alert('✓ Đã khóa SĐT ' + sdt);
}

/**
 * Dọn các mã `cho_thanh_toan` > 7 ngày. Có thể chạy thủ công từ menu
 * hoặc đặt Trigger ⏰ chạy mỗi ngày.
 */
function donDepMaCho() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) return;
  const last = sheet.getLastRow();
  if (last < 2) return;

  const data = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  const nguong = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const xoa = [];

  for (let i = data.length - 1; i >= 0; i--) {
    const v = data[i];
    if (v[COL.trang_thai - 1] !== TT.CHO_THANH_TOAN) continue;
    const ngayDangKy = v[COL.ngay_dang_ky - 1];
    if (!ngayDangKy) continue;
    if (new Date(ngayDangKy).getTime() < nguong) {
      xoa.push(i + 2);
    }
  }

  // Xóa từ dưới lên để index không lệch
  for (const r of xoa) sheet.deleteRow(r);

  try {
    SpreadsheetApp.getUi().alert('Đã dọn ' + xoa.length + ' mã chưa thanh toán quá 7 ngày.');
  } catch (e) { /* được gọi từ trigger, không có UI */ }
}

/**
 * V.05: Dồn dữ liệu lên đầu sheet bắt đầu từ A2.
 * Khi sheet có nhiều hàng trống xen kẽ (do user xóa nội dung), `appendRow` vẫn
 * append ở cuối sheet (vd row 1004) thay vì row 2. Hàm này quét toàn bộ data,
 * lọc hàng có SĐT, xóa hết hàng dưới header, ghi data nén liền mạch từ row 2.
 *
 * CÁCH CHẠY: Apps Script editor → Chọn function "donDepHangTrong" → bấm Run.
 */
function donDepHangTrong() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) {
    try { SpreadsheetApp.getUi().alert('Chưa setup sheet License'); } catch (e) {}
    return;
  }
  const last = sheet.getLastRow();
  if (last < 2) {
    try { SpreadsheetApp.getUi().alert('Sheet trống, không có gì để dồn.'); } catch (e) {}
    return;
  }

  // Đọc tất cả data dưới header
  const data = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  // Lọc hàng có SĐT (cột 1)
  const validRows = data.filter(r => r[0] && String(r[0]).trim() !== '');

  // Xóa hết hàng dưới header
  if (last > 1) {
    sheet.getRange(2, 1, last - 1, HEADERS.length).clearContent();
  }

  // Ghi lại data nén liền mạch
  if (validRows.length > 0) {
    sheet.getRange(2, 1, validRows.length, HEADERS.length).setValues(validRows);
  }

  try {
    SpreadsheetApp.getUi().alert(
      'Đã dồn ' + validRows.length + ' hàng dữ liệu lên đầu sheet (từ A2). ' +
      'Các hàng trống ở dưới đã được dọn sạch.'
    );
  } catch (e) { /* không có UI */ }
}

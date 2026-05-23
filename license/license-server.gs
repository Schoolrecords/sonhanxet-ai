/**
 * LICENSE SERVER v3 cho extension "Sổ nhận xét - AI"
 * ===================================================
 *
 * MÔ HÌNH "MỘT-CHẠM" (V6.0.0 — đổi 2026-05-19):
 *   1. GV nhập [Họ tên + SĐT] → server tạo row với MÃ = SĐT (không random).
 *   2. GV chuyển khoản, nội dung CK = SĐT của chính cô (cô đã thuộc).
 *   3. Thầy quản trị mở Sheet → menu "Tick theo SĐT" → paste SĐT từ sao kê.
 *   4. Extension cô tự ping server mỗi 20-120s → khi thấy đã tick, tự bind device,
 *      tự kích hoạt — cô KHÔNG cần thao tác lần 2.
 *
 * CHÍNH SÁCH 30k / 1 MÁY:
 *   - 1 SĐT bind 1 device cứng. Cô đổi máy/cài lại Windows → server từ chối,
 *     yêu cầu liên hệ Zalo thầy. Thầy mở Sheet → menu "Reset thiết bị" →
 *     cô đăng nhập lại trên máy mới.
 *
 * COMPAT GV V2 CŨ:
 *   - GV đã đăng ký trước 2026-05-19 với mã 4 ký tự (k7m3...) vẫn dùng bình thường.
 *   - Sheet schema KHÔNG đổi 1 cột nào. Menu "Tick theo mã" cũ vẫn giữ.
 *   - Endpoint dangNhap accept cả mã 4 ký tự cũ lẫn SĐT 10 số mới.
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
  DA_TRA_TIEN: 'da_tra_tien',         // thầy đã tick, chờ extension bind device
  DA_KICH_HOAT: 'da_kich_hoat',       // đã bind thiết bị
  HET_HAN: 'het_han',
  KHOA: 'khoa'
};
const SO_TIEN_MAC_DINH = 30000;
const HAN_DUNG_NGAY = 365;

// V6: tolerant — mã có thể là SĐT 10 số (flow mới) HOẶC 4 ký tự (flow cũ GV v2).
const MA_LEN_MIN = 4;
const MA_LEN_MAX = 10;
const MA_LEN_LEGACY = 4;  // cho GV v2 cũ (giữ tham chiếu)

// V6.1.3 HOTFIX (2026-05-20) — toggle chế độ cấp mã trong dangKy:
//   'v5' → cấp mã 4 ký tự random (tương thích V5.0 trên CWS: form Đăng nhập maxlength=4).
//   'v6' → cấp mã = SĐT (flow "Một-chạm" gốc V6: cô CK với SĐT, dễ nhớ).
// Khi nào Google CWS duyệt V6 → đổi thành 'v6' + redeploy (cùng URL, New version)
// để khôi phục UX gốc. Không ảnh hưởng GV đã active (chỉ tác động dangKy mới).
const MA_GEN_MODE = 'v5';

// Bộ ký tự cho mã LEGACY: chữ thường + số, BỎ ký tự dễ nhầm (0, o, 1, l, i)
const MA_CHARSET = 'abcdefghjkmnpqrstuvwxyz23456789';

// SĐT admin/test — tự động bypass payment + cho phép re-register/re-bind
// để admin test flow nhanh không cần tick checkbox + reset device thủ công.
// LƯU Ý BẢO MẬT: SĐT này KHÔNG được công khai ở bất kỳ đâu (website, docs,
// README, error messages…) vì ai biết SĐT này nhập vào form sẽ được kích hoạt
// MIỄN PHÍ. Số liên hệ hỗ trợ public dùng SĐT KHÁC.
const ADMIN_SDTS = ['0913311301'];
// Mã cố định cho admin (4 ký tự, lowercase + số, theo MA_CHARSET). Thầy luôn dùng
// mã này thay vì mã random → dễ nhớ, không cần tra cứu mỗi lần test.
const ADMIN_FIXED_MA = 'admn';
function isAdminSdt_(sdt) {
  return ADMIN_SDTS.indexOf(String(sdt || '')) >= 0;
}

// =============== ENTRY POINT ===============

function doGet(e) {
  return ContentService
    .createTextOutput('Sổ nhận xét - AI · License server v3 đang hoạt động.\n' +
                      'Endpoint POST với action: dangKy | dangNhap | checkPaymentStatus | checkLicense | resetDevice')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (!rateLimitOK_(body)) return jsonOut_({ ok: false, error: 'rate_limit' });
    const action = body.action;

    if (action === 'dangKy')              return jsonOut_(dangKy_(body));
    if (action === 'dangNhap')            return jsonOut_(dangNhap_(body));
    if (action === 'checkPaymentStatus')  return jsonOut_(checkPaymentStatus_(body));
    if (action === 'checkLicense')        return jsonOut_(checkLicense_(body));
    if (action === 'resetDevice')         return jsonOut_(resetDevice_(body));

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

// V6.1.4 HOTFIX (2026-05-21): rate limit PER-SĐT thay vì global.
// Bug cũ: dùng e.parameter.ua nhưng extension POST không gửi ?ua=... → key luôn
// = 'anon' → 60/phút share GLOBAL cho TẤT CẢ cô → ~20 cô polling concurrent đã
// chạm trần → cô khác bấm "Đăng ký" thấy "Quá nhiều yêu cầu. Đợi 1 phút".
// Fix: key theo SĐT, mỗi cô có quota riêng (60/phút đủ thoải mái cho polling
// 20s + dangKy + dangNhap + recheck cùng lúc). Request không có sdt (vd resetDevice
// với adminKey) dùng key 'anon' với quota 120/phút.
function rateLimitOK_(body) {
  try {
    const cache = CacheService.getScriptCache();
    const rawSdt = String((body && body.sdt) || '').replace(/\D/g, '');
    const sdt = rawSdt.length >= 9 ? rawSdt.slice(-10) : '';
    const key = sdt ? ('rl_sdt_' + sdt) : 'rl_anon';
    const count = parseInt(cache.get(key) || '0', 10) + 1;
    cache.put(key, String(count), 60);
    const limit = sdt ? 60 : 120;
    return count <= limit;
  } catch (e) { return true; }
}

// =============== ĐĂNG KÝ ===============
// V6 flow "Một-chạm":
//   - GV nhập [Họ tên + SĐT] → server tạo row với MÃ = SĐT (không random).
//   - Nếu SĐT đã có row chưa kích hoạt → trả lại pending (idempotent).
//   - Nếu SĐT đã `da_tra_tien` (thầy đã tick) → trả {ok:true, alreadyPaid:true, ma:...}
//     để client tự gọi dangNhap ngay → bind device → kích hoạt liền (không cần CK lại).
//   - Nếu SĐT đã `da_kich_hoat` ở máy khác → từ chối (chính sách 30k/1 máy).

function dangKy_(body) {
  const sdt = chuanHoaSdt_(body.sdt);
  const hoTen = String(body.hoTen || '').trim().replace(/\s+/g, ' ');

  if (!sdt) return { ok: false, error: 'sdt_sai',
                     hint: 'SĐT VN 10 số bắt đầu bằng 0 (vd 0912345678)' };
  if (hoTen.length < 3 || hoTen.length > 60) return { ok: false, error: 'ho_ten_sai' };

  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) return { ok: false, error: 'chua_setup_sheet' };

  const row = findRowBySdt_(sheet, sdt);
  const isAdmin = isAdminSdt_(sdt);

  // ADMIN: luôn cho phép re-register, reset state về da_tra_tien để có thể bind ngay.
  // Mã dùng ADMIN_FIXED_MA → thầy luôn dùng cùng 1 mã, dễ nhớ.
  if (row && isAdmin) {
    const ma = ADMIN_FIXED_MA;
    const now = new Date();
    sheet.getRange(row, COL.ma_bi_mat).setValue("'" + ma);
    sheet.getRange(row, COL.ho_ten).setValue(hoTen);
    sheet.getRange(row, COL.ngay_dang_ky).setValue(now);
    sheet.getRange(row, COL.so_tien).setValue(SO_TIEN_MAC_DINH);
    sheet.getRange(row, COL.da_thanh_toan).setValue(true);
    sheet.getRange(row, COL.ngay_thanh_toan).setValue(now);
    sheet.getRange(row, COL.ngay_kich_hoat).setValue('');
    sheet.getRange(row, COL.ngay_het_han).setValue('');
    sheet.getRange(row, COL.device_fp).setValue('');
    sheet.getRange(row, COL.last_check).setValue('');
    sheet.getRange(row, COL.trang_thai).setValue(TT.DA_TRA_TIEN);
    sheet.getRange(row, COL.ghi_chu).setValue('ADMIN · auto-bypass');
    return {
      ok: true, alreadyPaid: true,
      sdt: sdt, hoTen: hoTen, ma: ma,
      soTien: 0,
      message: '[ADMIN] Đã reset. Tự bind máy ngay.'
    };
  }

  if (row) {
    const v = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
    autoUpgradePaid_(sheet, row, v);  // tick tay cột F → tự đồng bộ G+I+L
    const trangThai = v[COL.trang_thai - 1];
    const maCu = chuanHoaMa_(v[COL.ma_bi_mat - 1]);  // có thể là SĐT (mới) hoặc mã 4 ký tự (cũ)

    if (trangThai === TT.CHO_THANH_TOAN) {
      // Idempotent: trả lại pending cũ (mã có thể là sdt hoặc legacy)
      return {
        ok: true, daDangKyTruoc: true,
        sdt: sdt, hoTen: v[COL.ho_ten - 1], ma: maCu,
        soTien: SO_TIEN_MAC_DINH,
        message: 'SĐT này đã đăng ký trước. Vui lòng chuyển khoản với nội dung: ' + maCu
      };
    }

    if (trangThai === TT.DA_TRA_TIEN) {
      // V6: thầy đã tick → client tự bind device ngay, không cần GV CK lại.
      // Trả mã (sdt mới hoặc legacy 4 ký tự) để client gọi tiếp dangNhap.
      return {
        ok: true, alreadyPaid: true,
        sdt: sdt, hoTen: v[COL.ho_ten - 1], ma: maCu,
        message: 'Đã ghi nhận thanh toán. Đang kích hoạt máy này...'
      };
    }

    if (trangThai === TT.DA_KICH_HOAT) {
      // CHÍNH SÁCH 30k/1 MÁY: từ chối, yêu cầu Zalo thầy reset.
      return {
        ok: false, error: 'da_kich_hoat_o_may_khac',
        message: 'SĐT này đã kích hoạt ở máy khác. Theo chính sách 1 license cho 1 máy, vui lòng nhắn Zalo thầy Chung 0913031073 để được hỗ trợ.'
      };
    }

    if (trangThai === TT.KHOA) {
      return {
        ok: false, error: 'sdt_da_bi_khoa',
        message: 'SĐT đã bị khóa. Liên hệ Zalo thầy Chung 0913031073.'
      };
    }

    if (trangThai === TT.HET_HAN) {
      // Cho đăng ký lại — reset row với mã mới (= SĐT, theo flow V6)
    }
  }

  // Sinh mã:
  //   - admin → ADMIN_FIXED_MA (cố định, dễ nhớ khi test)
  //   - user thường → tùy MA_GEN_MODE:
  //       'v5' (HOTFIX hiện tại): mã 4 ký tự random — V5.0 CWS gõ được.
  //       'v6': mã = SĐT — flow "Một-chạm" gốc, đổi khi V6 được duyệt.
  const ma = isAdmin
    ? ADMIN_FIXED_MA
    : (MA_GEN_MODE === 'v5' ? sinhMaLegacyKhongTrung_(sheet) : sdt);
  const now = new Date();

  if (row) {
    // Reset lại row cũ (HET_HAN) với mã mới
    // Prefix "'" cho ma_bi_mat để Google Sheets giữ dạng text (giữ số 0 đầu của SĐT)
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
    alreadyPaid: !!isAdmin,
    message: isAdmin
      ? '[ADMIN] Đăng ký thành công. Tự bind máy ngay.'
      : 'Đăng ký thành công. Vui lòng chuyển khoản với nội dung: ' + ma
  };
}

// =============== CHECK PAYMENT STATUS (V6 mới) ===============
// Client poll endpoint này để biết khi nào thầy đã tick. KHÔNG cần device fingerprint.
// Khi server trả 'da_thanh_toan' → client gọi tiếp dangNhap để bind device.

function checkPaymentStatus_(body) {
  const sdt = chuanHoaSdt_(body.sdt);
  if (!sdt) return { ok: false, error: 'sdt_sai' };

  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) return { ok: false, error: 'chua_setup_sheet' };

  const row = findRowBySdt_(sheet, sdt);
  if (!row) return { ok: true, status: 'khong_ton_tai', sdt: sdt };

  const v = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
  autoUpgradePaid_(sheet, row, v);  // tick tay cột F → tự đồng bộ G+I+L
  const trangThai = v[COL.trang_thai - 1];
  const ma = chuanHoaMa_(v[COL.ma_bi_mat - 1]);

  return {
    ok: true,
    status: trangThai,
    sdt: sdt,
    hoTen: String(v[COL.ho_ten - 1] || ''),
    ma: ma
  };
}

// =============== ĐĂNG NHẬP (bind device) ===============
// GV nhập [SĐT + mã] trên thiết bị → server verify đã trả tiền → bind device.
// V6: mã có thể là SĐT 10 số (mới) HOẶC 4 ký tự (legacy GV v2).

function dangNhap_(body) {
  const sdt = chuanHoaSdt_(body.sdt);
  const ma = chuanHoaMa_(body.ma);
  const deviceFp = String(body.deviceFp || '').trim();
  const deviceInfo = String(body.deviceInfo || '').slice(0, 200);

  if (!sdt) return { ok: false, error: 'sdt_sai' };
  if (!ma || ma.length < MA_LEN_MIN || ma.length > MA_LEN_MAX) {
    return { ok: false, error: 'ma_sai_dinh_dang' };
  }
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
  let ngayHetHan = v[COL.ngay_het_han - 1];

  if (trangThai === TT.KHOA) return { ok: false, error: 'sdt_da_bi_khoa' };

  if (ma !== maTrenSheet) return { ok: false, error: 'ma_khong_dung' };

  if (!daTraTien) return { ok: false, error: 'chua_thanh_toan',
                           message: 'Hệ thống chưa ghi nhận thanh toán. Vui lòng đợi sau khi chuyển khoản. Nếu đã CK lâu, liên hệ Zalo thầy Chung.' };

  // Nếu admin chỉ tick checkbox bằng tay (không dùng menu) → ngay_het_han chưa được set.
  // Tự động set = ngay_thanh_toan + 365 ngày (mặc định 1 năm).
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

  // CHÍNH SÁCH 30k/1 MÁY: nếu đã bind máy khác, từ chối (trừ admin).
  if (fpHienTai && fpHienTai !== deviceFp && !isAdminSdt_(sdt)) {
    return { ok: false, error: 'da_dung_cho_may_khac',
             message: 'Tài khoản đã kích hoạt ở máy khác. Theo chính sách 1 license cho 1 máy, vui lòng nhắn Zalo thầy Chung 0913031073.' };
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
  let ngayHetHan = v[COL.ngay_het_han - 1];

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

/**
 * Tự nâng cấp row khi thầy quản trị tick tay cột F (da_thanh_toan) thay vì
 * dùng menu "Tick thanh toán theo SĐT...". Tick tay chỉ đổi cột F = TRUE,
 * KHÔNG đụng cột G (ngay_thanh_toan), I (ngay_het_han), L (trang_thai)
 * → client polling thấy trang_thai vẫn 'cho_thanh_toan' nên quay mãi.
 *
 * Hàm này mutate v in place + update sheet → caller dùng v ngay sau khi gọi
 * sẽ thấy giá trị mới. Idempotent: chạy nhiều lần không tạo side effect.
 */
function autoUpgradePaid_(sheet, row, v) {
  const daTraTien = v[COL.da_thanh_toan - 1] === true || v[COL.da_thanh_toan - 1] === 'TRUE';
  const trangThai = v[COL.trang_thai - 1];
  if (!daTraTien || trangThai !== TT.CHO_THANH_TOAN) return v;

  const now = new Date();
  if (!v[COL.ngay_thanh_toan - 1]) {
    sheet.getRange(row, COL.ngay_thanh_toan).setValue(now);
    v[COL.ngay_thanh_toan - 1] = now;
  }
  if (!v[COL.ngay_het_han - 1]) {
    const ngayTraTien = new Date(v[COL.ngay_thanh_toan - 1] || now);
    const hetHan = new Date(ngayTraTien.getFullYear() + 1, ngayTraTien.getMonth(), ngayTraTien.getDate());
    sheet.getRange(row, COL.ngay_het_han).setValue(hetHan);
    v[COL.ngay_het_han - 1] = hetHan;
  }
  sheet.getRange(row, COL.trang_thai).setValue(TT.DA_TRA_TIEN);
  v[COL.trang_thai - 1] = TT.DA_TRA_TIEN;

  // Đánh dấu để thầy biết row này được auto-upgrade (debug/audit)
  const oldNote = String(v[COL.ghi_chu - 1] || '');
  const tag = 'auto-upgrade (tick tay F)';
  if (oldNote.indexOf(tag) < 0) {
    const newNote = ((oldNote ? oldNote + ' | ' : '') + tag).slice(0, 500);
    sheet.getRange(row, COL.ghi_chu).setValue(newNote);
    v[COL.ghi_chu - 1] = newNote;
  }
  return v;
}

function sinhMaLegacyKhongTrung_(sheet) {
  // V6: chỉ dùng để test/debug — flow mới mã = sdt, không gọi hàm này.
  // Giữ để fallback nếu cần sinh mã random sau này.
  const last = sheet.getLastRow();
  const existing = new Set();
  if (last >= 2) {
    const data = sheet.getRange(2, COL.ma_bi_mat, last - 1, 1).getValues();
    for (const r of data) existing.add(chuanHoaMa_(r[0]));
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    let ma = '';
    for (let i = 0; i < MA_LEN_LEGACY; i++) {
      ma += MA_CHARSET.charAt(Math.floor(Math.random() * MA_CHARSET.length));
    }
    if (!existing.has(ma)) return ma;
  }
  throw new Error('Không sinh được mã legacy không trùng sau 20 lần thử');
}

/**
 * V6.1.3 HOTFIX — Khôi phục mã 4 ký tự cho các row đã đăng ký bằng flow V6 (mã = SĐT).
 * Lý do: V5.0 trên CWS có form Đăng nhập maxlength=4 → cô không gõ được mã 10 số.
 *
 * Cách chạy: Apps Script editor → dropdown function → chọn "khoiPhucMaNgan_V5Compat"
 *            → Run. Cấp quyền nếu hỏi. Đọc alert → copy danh sách → Zalo từng cô.
 *
 * Idempotent: chỉ regen mã cho row có ma_bi_mat === sdt. Skip row admin, row đã KHÓA,
 * và row đã có mã ngắn ≠ sdt (vd GV v2 cũ).
 */
function khoiPhucMaNgan_V5Compat() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) { ui.alert('Chưa setup sheet License'); return; }

  const last = sheet.getLastRow();
  if (last < 2) { ui.alert('Sheet trống.'); return; }

  const data = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();

  // Pre-load mã đã có để tránh va chạm trong cùng batch
  const usedMas = new Set();
  for (const v of data) {
    const m = chuanHoaMa_(v[COL.ma_bi_mat - 1]);
    if (m) usedMas.add(m);
  }
  function sinhMaUnique_() {
    for (let attempt = 0; attempt < 50; attempt++) {
      let ma = '';
      for (let i = 0; i < MA_LEN_LEGACY; i++) {
        ma += MA_CHARSET.charAt(Math.floor(Math.random() * MA_CHARSET.length));
      }
      if (!usedMas.has(ma)) { usedMas.add(ma); return ma; }
    }
    throw new Error('Không sinh được mã 4 ký tự không trùng sau 50 lần');
  }

  const updates = [];
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    const sdt = chuanHoaSdt_(v[COL.sdt - 1]);
    const ma = chuanHoaMa_(v[COL.ma_bi_mat - 1]);
    const trangThai = v[COL.trang_thai - 1];
    if (!sdt || !ma) continue;
    if (ma !== sdt) continue;             // mã đã ≠ sdt → skip
    if (trangThai === TT.KHOA) continue;
    if (isAdminSdt_(sdt)) continue;

    const newMa = sinhMaUnique_();
    const row = i + 2;
    sheet.getRange(row, COL.ma_bi_mat).setValue("'" + newMa);
    updates.push({
      sdt: sdt,
      hoTen: String(v[COL.ho_ten - 1] || ''),
      maMoi: newMa,
      trangThai: trangThai
    });
  }

  if (updates.length === 0) {
    ui.alert('Không có row nào cần khôi phục (mã của mọi GV đều ≠ SĐT).');
    return;
  }

  const lines = updates.map(u =>
    u.sdt + ' — ' + u.hoTen + ' — MÃ MỚI: ' + u.maMoi + ' (TT: ' + u.trangThai + ')'
  );
  const msg = '✓ Đã khôi phục ' + updates.length + ' mã 4 ký tự:\n\n' +
              lines.join('\n') + '\n\n' +
              'Thầy Zalo từng cô với template:\n' +
              '"Cô vào extension Sổ NX-AI → tab Đăng nhập → nhập SĐT của cô + mã 4 ký tự: XXXX.\n' +
              ' (Mã 10 số trước đó cô có thể bỏ qua.)"';
  Logger.log(msg);
  ui.alert(msg);
}

/**
 * V6.1.4 FIX (2026-05-21) — Batch xử lý các row đã tick TAY checkbox cột F
 * nhưng cột L trang_thai vẫn `cho_thanh_toan`. Bình thường khi cô polling
 * ping server, hàm `autoUpgradePaid_` tự đồng bộ cột G + I + L. Nhưng nếu
 * cô đã đóng sidebar (polling stop) thì không bao giờ trigger → cô không active.
 *
 * Hàm này quét toàn Sheet, gọi `autoUpgradePaid_` cho mọi row F=TRUE + L=cho_thanh_toan.
 * Sau khi chạy, trạng thái = `da_tra_tien` ngay → cô next polling sẽ bind device.
 * Nếu cô đã đóng sidebar → bảo cô mở lại tab Vnedu để polling restart.
 *
 * Idempotent: chạy nhiều lần OK (chỉ xử lý row CHO_THANH_TOAN).
 */
function dongBoTrangThaiTickTay() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) { ui.alert('Chưa setup sheet License'); return; }
  const last = sheet.getLastRow();
  if (last < 2) { ui.alert('Sheet trống.'); return; }

  const data = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  const updated = [];
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (!v[COL.sdt - 1]) continue;
    const daTraTien = v[COL.da_thanh_toan - 1] === true || v[COL.da_thanh_toan - 1] === 'TRUE';
    const trangThai = v[COL.trang_thai - 1];
    if (daTraTien && trangThai === TT.CHO_THANH_TOAN) {
      const row = i + 2;
      autoUpgradePaid_(sheet, row, v);
      updated.push({
        sdt: chuanHoaSdt_(v[COL.sdt - 1]),
        hoTen: String(v[COL.ho_ten - 1] || ''),
        ma: chuanHoaMa_(v[COL.ma_bi_mat - 1])
      });
    }
  }
  if (updated.length === 0) {
    ui.alert('Không có row nào cần đồng bộ. (Mọi row đã đúng trạng thái.)');
    return;
  }
  const lines = updated.map(u => u.sdt + ' — ' + u.hoTen + ' (mã ' + u.ma + ')');
  ui.alert(
    '✓ Đã đồng bộ ' + updated.length + ' row sang da_tra_tien:\n\n' +
    lines.join('\n') + '\n\n' +
    'Cô nào còn mở sidebar → sẽ tự kích hoạt trong 20-120 giây tới.\n' +
    'Cô đã đóng sidebar → bảo cô MỞ LẠI tab Vnedu (extension tự polling lại).'
  );
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
    .addItem('💰 Tick thanh toán theo SĐT... (V6 — khuyên dùng)', 'tickThanhToanTheoSdt')
    .addItem('💰 Tick theo mã 4 ký tự... (GV v2 cũ)', 'tickDaThanhToan')
    .addSeparator()
    .addItem('🔧 Khôi phục mã ngắn V5 (HOTFIX — chạy 1 lần)', 'khoiPhucMaNgan_V5Compat')
    .addItem('⚡ Đồng bộ trạng thái các row tick tay cột F (FIX 21/5)', 'dongBoTrangThaiTickTay')
    .addItem('🧹 Dồn dữ liệu lên đầu sheet (xoá dòng trống)', 'donDepHangTrong')
    .addSeparator()
    .addItem('🔄 Reset thiết bị (theo SĐT)...', 'resetThietBiUI')
    .addItem('🔒 Khóa 1 SĐT (nghi share)...', 'khoaSdtUI')
    .addSeparator()
    .addItem('🧹 Dọn mã chưa thanh toán quá 7 ngày', 'donDepMaCho')
    .addItem('⚙️ Setup sheet lần đầu', 'setupSheet')
    .addToUi();
}

/**
 * V6 — flow MỘT-CHẠM: thầy nhập SĐT từ sao kê NH (= chính nội dung CK của cô).
 * Hệ thống tự set ngày thanh toán, ngày hết hạn = +365 ngày, trạng thái da_tra_tien.
 * Cô KHÔNG cần thao tác — extension tự ping server mỗi 20-120s, sẽ tự bind máy.
 */
function tickThanhToanTheoSdt() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('Nhập SĐT trong nội dung chuyển khoản',
                        'VD: 0912345678 (có thể có space/dấu chấm, hệ thống tự bỏ)',
                        ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;

  const sdt = chuanHoaSdt_(res.getResponseText());
  if (!sdt) { ui.alert('SĐT sai định dạng. Đúng dạng: 10 số bắt đầu bằng 0.'); return; }

  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const row = findRowBySdt_(sheet, sdt);
  if (!row) {
    ui.alert('Không tìm thấy SĐT ' + sdt + ' trong sheet. Cô có thể chưa bấm "Bắt đầu" trong extension.');
    return;
  }

  const v = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
  const hoTen = v[COL.ho_ten - 1];
  const trangThai = v[COL.trang_thai - 1];

  if (trangThai === TT.DA_KICH_HOAT) {
    ui.alert('SĐT ' + sdt + ' (' + hoTen + ') đã kích hoạt rồi. Không cần tick nữa.');
    return;
  }
  if (trangThai === TT.DA_TRA_TIEN) {
    ui.alert('SĐT ' + sdt + ' (' + hoTen + ') đã được tick trước đó. Đang chờ cô bind máy.');
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
           '  Hạn dùng: ' + Utilities.formatDate(hetHan, 'GMT+7', 'dd/MM/yyyy') + '\n\n' +
           'Extension của cô sẽ tự kích hoạt trong 20-120 giây tới.\n' +
           '(Cô KHÔNG cần thao tác thêm gì.)');
}

/**
 * LEGACY V2 — tick theo mã 4 ký tự cho GV cũ.
 * Giữ để không phá flow của 41 GV đã đăng ký trước 2026-05-19.
 */
function tickDaThanhToan() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('Nhập mã 4 ký tự trong nội dung chuyển khoản (GV v2 cũ)',
                        'VD: k7m3 — chỉ dùng cho GV đăng ký trước 19/05/2026',
                        ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;

  const ma = chuanHoaMa_(res.getResponseText());
  if (ma.length !== MA_LEN_LEGACY) { ui.alert('Mã phải đúng ' + MA_LEN_LEGACY + ' ký tự'); return; }

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
  const res = ui.prompt('Reset thiết bị cho SĐT nào?\n(Cô đã liên hệ Zalo, máy hỏng/đổi máy)',
                        'VD: 0912345678', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const sdt = chuanHoaSdt_(res.getResponseText());
  if (!sdt) { ui.alert('SĐT sai định dạng'); return; }

  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const row = findRowBySdt_(sheet, sdt);
  if (!row) { ui.alert('Không tìm thấy SĐT ' + sdt); return; }

  sheet.getRange(row, COL.device_fp).setValue('');
  sheet.getRange(row, COL.trang_thai).setValue(TT.DA_TRA_TIEN);
  ui.alert('✓ Đã reset thiết bị cho ' + sdt + '.\n\nCô có thể vào extension trên máy mới, nhập SĐT + tên → tự kích hoạt.');
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
 * Dồn dữ liệu lên đầu sheet bắt đầu từ A2.
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

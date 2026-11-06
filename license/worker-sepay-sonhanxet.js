/* ============================================================
   SỔ NHẬN XÉT - AI — Cầu nối SePay  ▸  Cloudflare Worker
   ------------------------------------------------------------
   Vì sao cần: Apps Script luôn trả mã 302 rồi mới đưa kết quả.
   SePay không đi theo chuyển hướng nên ghi nhận là LỖI và gửi lại
   nhiều lần, dù đã mở khoá. Worker này nhận báo có của SePay,
   chuyển tiếp sang Apps Script (đi theo chuyển hướng), rồi trả 200.
   (Cách làm giống cầu nối Bút Xanh, nhưng KHÔNG có đường ghi Firebase.)

   BIẾN MÔI TRƯỜNG (Settings ▸ Variables and Secrets):
     APPS_SCRIPT_URL = URL /exec của máy chủ bản quyền Sổ nhận xét,
                       KÈM ?token=<SEPAY_TOKEN> (menu "Cài kết nối SePay" trong Sheet hiện sẵn)
     WEBHOOK_TOKEN   = (Secret) mật khẩu SePay phải gửi kèm: <địa chỉ Worker>?token=...
   ============================================================ */

const TEN_DICH_VU = 'So nhan xet AI - cau noi SePay';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET') {
      return traLoi({
        success: true,
        service: TEN_DICH_VU,
        daCaiAppsScript: Boolean(env.APPS_SCRIPT_URL),
        daCaiToken: Boolean(env.WEBHOOK_TOKEN)
      });
    }
    if (request.method !== 'POST') return traLoi({ success: false, message: 'Chi nhan POST' }, 405);

    if (!env.WEBHOOK_TOKEN || (url.searchParams.get('token') || '') !== env.WEBHOOK_TOKEN) {
      return traLoi({ success: false, message: 'Sai token' }, 401);
    }
    if (!env.APPS_SCRIPT_URL) return traLoi({ success: false, message: 'Chua cai APPS_SCRIPT_URL' }, 500);

    let body;
    try { body = await request.text(); }
    catch (e) { return traLoi({ success: false, message: 'Khong doc duoc noi dung' }, 400); }

    try {
      const res = await fetch(env.APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        redirect: 'follow'            // mấu chốt: tự đi theo chuyển hướng của Google
      });
      const text = await res.text();
      let kq = null;
      try { kq = JSON.parse(text); } catch (e) { /* không phải JSON */ }
      if (res.ok && kq && kq.success === true) {
        return traLoi({ success: true, service: TEN_DICH_VU, appsScript: kq }, 200);
      }
      return traLoi({ success: false, message: 'Apps Script khong bao thanh cong',
                      maHttp: res.status, traVe: text.slice(0, 300) }, 502);
    } catch (e) {
      return traLoi({ success: false, message: 'Loi goi Apps Script: ' + (e && e.message ? e.message : String(e)) }, 502);
    }
  }
};

function traLoi(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

# Sổ nhận xét - AI — Website

Landing page giới thiệu Chrome Extension "Sổ nhận xét - AI".

Tech: **Astro 5** (zero JavaScript framework, output HTML tĩnh, deploy được lên GitHub Pages / Vercel / Netlify miễn phí).

## Chạy thử trên máy

```bash
cd website
npm install
npm run dev
```

Mở http://localhost:4321 trên trình duyệt.

## Build cho production

```bash
npm run build
```

Output ra thư mục `dist/`. Upload thư mục này lên hosting bất kỳ — không cần server, chỉ HTML/CSS tĩnh.

## Deploy lên Vercel (đề xuất)

1. Push thư mục `website/` lên 1 GitHub repo
2. Vào https://vercel.com → Import repo → Vercel tự nhận diện Astro
3. Bấm Deploy → có URL dạng `xxx.vercel.app` trong 1-2 phút
4. (Tuỳ chọn) Mua domain riêng và trỏ vào Vercel

## Deploy lên GitHub Pages

1. Push thư mục lên GitHub repo (vd `sonhanxet-ai-web`)
2. Vào repo Settings → Pages → Source: **GitHub Actions**
3. Tạo file `.github/workflows/deploy.yml` (xem doc Astro)

## Cấu trúc

```
website/
├── src/
│   ├── layouts/
│   │   └── BaseLayout.astro       # Header + footer chung
│   ├── pages/
│   │   ├── index.astro            # Trang chủ — landing
│   │   └── privacy.astro          # Chính sách bảo mật
│   └── styles/
│       └── global.css             # CSS toàn cục, palette
├── public/                        # Asset tĩnh (favicon, OG image)
├── astro.config.mjs
└── package.json
```

## Cần làm khi đã có link Chrome Web Store

Mở `src/pages/index.astro`, tìm:

```astro
const CHROME_STORE_URL = "#";
```

Đổi thành URL thật từ CWS, ví dụ:

```astro
const CHROME_STORE_URL = "https://chrome.google.com/webstore/detail/abc123xyz...";
```

Rebuild + redeploy là xong.

## Asset cần bổ sung

- `public/og-image.png` (1200×630) — ảnh share lên Facebook/Zalo
- `public/favicon.svg` hoặc `favicon.ico`
- `public/screenshots/` — 3-5 ảnh sidebar đang chạy (xem `cws-submission/screenshot-guide.md`)

Hiện tại các phần này dùng placeholder hoặc CSS-only mockup.

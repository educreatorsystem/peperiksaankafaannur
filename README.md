# Sistem Analisis Markah KAFA An Nur

Fail ini disediakan untuk deploy sebagai laman statik di GitHub Pages.

## Cara Deploy Di GitHub Pages

1. Cipta repository baharu di GitHub.
2. Upload semua fail dan folder dalam pakej ini ke root repository:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `manifest.webmanifest`
   - `sw.js`
   - folder `icons`
   - folder `apps-script`
3. Pergi ke `Settings` > `Pages`.
4. Pada `Build and deployment`, pilih:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Tekan `Save`.

GitHub akan beri URL seperti:

`https://nama-akaun.github.io/nama-repository/`

## Nota Apps Script

Sistem web ini sudah disambungkan kepada URL Apps Script yang dimasukkan dalam `app.js`.

Fail `apps-script/Code.gs` disertakan sebagai salinan kod backend sekiranya perlu dipasang semula atau dikemas kini di Google Apps Script.

## Nota PWA

Fail PWA telah disertakan:

- `manifest.webmanifest`
- `sw.js`
- ikon dalam folder `icons`

Selepas deploy, buka laman melalui URL GitHub Pages dan gunakan fungsi `Pasang aplikasi` jika browser/peranti menyokong PWA.

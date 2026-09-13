# Sistem Analisis Peperiksaan KAFA AN NUR

Fail dalam folder ini ialah versi yang boleh dipublish di GitHub Pages.

## Fail

- `index.html` - laman utama untuk GitHub Pages.
- `apps-script-backend.gs` - kod backend Google Apps Script untuk login, simpan markah, dan ambil data Google Sheet.
- `.nojekyll` - memastikan GitHub Pages publish fail statik tanpa proses Jekyll.

## Cara Publish Ke GitHub Pages

1. Buat repository baharu di GitHub.
2. Upload semua fail dalam folder ini ke repository tersebut.
3. Pergi ke `Settings` > `Pages`.
4. Pada `Build and deployment`, pilih:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Simpan dan tunggu GitHub beri URL Pages.

## Cara Setup Backend Apps Script

1. Buka projek Google Apps Script.
2. Gantikan kandungan `Code.gs` dengan kandungan `apps-script-backend.gs`.
3. Pastikan Google Sheet ID dalam kod ialah:
   `1WGO43JvYJBDpUvT9jU5VN8sApkAIY4Newa4Ldo23qis`
4. Deploy sebagai Web App:
   - Execute as: `Me`
   - Who has access: `Anyone`
5. Jika URL deployment baharu berbeza, buka `index.html` dan ubah nilai `APP_SCRIPT_URL` kepada URL `/exec` baharu.

## Login

- Guru: password `Gurukafaannur123`
- Ibu bapa: masukkan No. Kad Pengenalan murid yang wujud dalam CSV murid.

## Nota Penting

GitHub Pages hanya host frontend. Simpan dan ambil data tetap dibuat melalui Google Apps Script dan Google Sheet.

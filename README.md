# Sistem Analisis Peperiksaan KAFA

Sistem web app Google Apps Script untuk analisis peperiksaan KAFA AN NUR.

## Fungsi

- Login guru menggunakan password.
- Login ibu bapa menggunakan no kad pengenalan murid.
- Input markah akademik maksimum 70 markah.
- Input markah sahsiah maksimum 30 markah.
- Analisis individu mengikut kelas dan pentaksiran.
- Kedudukan murid dalam kelas berdasarkan jumlah keseluruhan.
- Analisis mengikut subjek dengan taburan gred, carta bar dan statistik.
- Slip pencapaian murid dalam tulisan Jawi.
- Data disimpan dan dibaca semula daripada Google Sheet.
- Tab data akan dicipta automatik jika belum wujud.

## Fail

- `Code.gs` - backend Google Apps Script.
- `Index.html` - antaramuka web app.
- `appsscript.json` - manifest projek Apps Script.

## Google Sheet

Sistem menggunakan Google Sheet berikut sebagai pangkalan data:

```text
13gq0_w4zk03Imy8U6hQQ8GYKrPBpSY4S5HrQhW4AcA
```

Tab yang akan digunakan:

- `MarkahAkademik`
- `MarkahSahsiah`

Jika tab belum wujud, sistem akan menciptanya secara automatik.

## Sumber Data CSV

Senarai murid, kelas dan no kad pengenalan:

```text
https://docs.google.com/spreadsheets/d/e/2PACX-1vQAPisKp7T1wtaGs2pncolfMICzOsoOXYOGyXH5BTjNl_WhclbXDI00dzSZPFE6e_WJjdPhv1LNbD3T/pub?gid=0&single=true&output=csv
```

Senarai subjek dan pentaksiran:

```text
https://docs.google.com/spreadsheets/d/e/2PACX-1vQAPisKp7T1wtaGs2pncolfMICzOsoOXYOGyXH5BTjNl_WhclbXDI00dzSZPFE6e_WJjdPhv1LNbD3T/pub?gid=1037190385&single=true&output=csv
```

## Gred

Gred akademik:

- `A`: 53-70
- `B`: 35-52
- `C`: 17-34
- `D`: 0-16

Gred sahsiah dan keseluruhan menggunakan skala yang sama secara nisbah mengikut markah maksimum.

## Cara Upload Ke GitHub

1. Buka GitHub.
2. Cipta repository baharu, contohnya `sistem-analisis-peperiksaan-kafa`.
3. Upload semua fail dalam folder ini:
   - `Code.gs`
   - `Index.html`
   - `appsscript.json`
   - `README.md`
4. Commit fail tersebut.

## Cara Pasang Ke Google Apps Script

1. Buka [Google Apps Script](https://script.google.com/).
2. Cipta projek baharu.
3. Padam kod asal dalam `Code.gs`.
4. Tampal kandungan `Code.gs` daripada repository ini.
5. Cipta fail HTML bernama `Index`.
6. Tampal kandungan `Index.html`.
7. Buka `Project Settings` dan pastikan runtime ialah V8.
8. Klik `Deploy` > `New deployment`.
9. Pilih `Web app`.
10. Tetapkan:
    - `Execute as`: `Me`
    - `Who has access`: `Anyone with the link`
11. Klik `Deploy`.
12. Buka URL web app yang diberi.

## Login

Password guru:

```text
Gurukafaannur123
```

Ibu bapa login menggunakan no kad pengenalan murid.

## Nota Penting

Fail `Index.html` tidak boleh digunakan terus sebagai laman GitHub Pages kerana ia bergantung kepada `google.script.run`. Sistem mesti dibuka melalui URL deployment Google Apps Script.

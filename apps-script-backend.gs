const CONFIG = {
  SHEET_ID: '1WGO43JvYJBDpUvT9jU5VN8sApkAIY4Newa4Ldo23qis',
  GURU_PASSWORD: 'Gurukafaannur123',
  SCHOOL_NAME: 'KAFA AN NUR',
  LOGO_URL: 'https://iili.io/nqIgmR2.md.jpg',
  URL_STUDENTS_CSV: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSYeADjY6U7CEDdwhq-E2QXyO8tXORTtZSz96q805619gfOg0qWbxt2DjFPteKBOYmIF03pcPnJhyYo/pub?gid=0&single=true&output=csv',
  URL_SUBJECTS_CSV: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSYeADjY6U7CEDdwhq-E2QXyO8tXORTtZSz96q805619gfOg0qWbxt2DjFPteKBOYmIF03pcPnJhyYo/pub?gid=1914855142&single=true&output=csv',
  SESSION_SECONDS: 21600
};

const MARKAH_HEADERS = [
  'Tarikh Kemaskini',
  'StudentID',
  'Nama',
  'Kelas',
  'NoKP',
  'Pentaksiran',
  'Subjek',
  'Markah',
  'Gred',
  'Key'
];

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = params.action || '';

  if (action) {
    try {
      if (action === 'ping') return output_(params, { ok: true, status: 'success', message: 'KAFA AN NUR app aktif' });
      if (action === 'loginGuru') return output_(params, loginGuru(params.password));
      if (action === 'loginIbuBapa') return output_(params, loginIbuBapa(params.noKadPengenalan || params.nokp));
      if (action === 'refreshData') return output_(params, refreshData(params.sessionToken));
      return output_(params, { ok: false, message: 'Action tidak dikenali.' });
    } catch (err) {
      return output_(params, { ok: false, message: err.message || String(err) });
    }
  }

  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('Sistem Analisis Peperiksaan KAFA AN NUR')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  const params = (e && e.parameter) || {};
  try {
    if (params.action === 'simpanMarkah') {
      const records = JSON.parse(params.records || '[]');
      return json_({ ok: true, result: simpanMarkah(params.sessionToken, records) });
    }
    return json_({ ok: false, message: 'Action POST tidak dikenali.' });
  } catch (err) {
    return json_({ ok: false, message: err.message || String(err) });
  }
}

function loginGuru(password) {
  if (String(password || '') !== CONFIG.GURU_PASSWORD) {
    return { ok: false, message: 'Password guru tidak tepat.' };
  }

  const token = createSession_({ role: 'guru' });
  const data = getTeacherData_();
  data.sessionToken = token;
  data.role = 'guru';
  data.ok = true;
  return data;
}

function loginIbuBapa(noKadPengenalan) {
  const nokp = cleanIc_(noKadPengenalan);
  if (!nokp) return { ok: false, message: 'Sila masukkan No. Kad Pengenalan murid.' };

  const meta = getMetaData_();
  const student = meta.students.find(function (s) {
    return cleanIc_(s.noKp) === nokp;
  });

  if (!student) {
    return { ok: false, message: 'No. Kad Pengenalan tidak ditemui dalam senarai murid.' };
  }

  const token = createSession_({ role: 'ibu_bapa', studentId: student.id });
  const data = getParentData_(student.id);
  data.sessionToken = token;
  data.role = 'ibu_bapa';
  data.ok = true;
  return data;
}

function refreshData(sessionToken) {
  const session = requireSession_(sessionToken);
  if (session.role === 'guru') return Object.assign({ ok: true, role: 'guru' }, getTeacherData_());
  return Object.assign({ ok: true, role: 'ibu_bapa' }, getParentData_(session.studentId));
}

function simpanMarkah(sessionToken, records) {
  const session = requireSession_(sessionToken);
  if (session.role !== 'guru') throw new Error('Hanya guru boleh menyimpan markah.');
  if (!Array.isArray(records)) throw new Error('Format rekod tidak sah.');

  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ensureSheet_(ss, 'Markah', MARKAH_HEADERS);
  const existing = getExistingMarkahIndex_(sheet);
  const now = new Date();

  records.forEach(function (record) {
    const studentId = String(record.studentId || '').trim();
    const pentaksiran = String(record.pentaksiran || '').trim();
    const subjek = String(record.subjek || '').trim();
    const rawMarkah = String(record.markah || '').trim().toUpperCase();
    if (!studentId || !pentaksiran || !subjek) return;

    const key = makeMarkKey_(studentId, pentaksiran, subjek);
    const existingRow = existing[key];

    const markah = rawMarkah ? sanitizeMarkah_(rawMarkah) : '';
    const gred = rawMarkah ? getGredAkademik_(markah).gred : '';
    const row = [
      now,
      studentId,
      String(record.nama || '').trim(),
      String(record.kelas || '').trim(),
      cleanIc_(record.noKp || ''),
      pentaksiran,
      subjek,
      markah,
      gred,
      key
    ];

    if (existingRow) {
      sheet.getRange(existingRow, 1, 1, MARKAH_HEADERS.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
  });

  return { ok: true, message: 'Markah berjaya disimpan.', savedAt: now.toISOString() };
}

function getTeacherData_() {
  const meta = getMetaData_();
  return Object.assign(meta, {
    marks: getSavedMarks_(),
    settings: getSettings_()
  });
}

function getParentData_(studentId) {
  const meta = getMetaData_();
  const student = meta.students.find(function (s) { return s.id === studentId; });
  const marks = getSavedMarks_().filter(function (m) { return m.studentId === studentId; });

  return {
    students: student ? [student] : [],
    kelasList: student ? [student.kelas] : [],
    subjects: meta.subjects,
    pentaksiranList: meta.pentaksiranList,
    marks: marks,
    settings: getSettings_()
  };
}

function getMetaData_() {
  const students = fetchStudents_();
  const setup = fetchSubjectsAndAssessments_();
  return {
    students: students,
    kelasList: unique_(students.map(function (s) { return s.kelas; })).sort(sortKelas_),
    subjects: setup.subjects,
    pentaksiranList: setup.pentaksiranList
  };
}

function fetchStudents_() {
  const rows = fetchCsv_(CONFIG.URL_STUDENTS_CSV);
  if (rows.length < 2) return [];

  const first = rows[0].map(function (h) { return normalizeHeader_(h); });
  const hasHeader = first.some(function (h) {
    return ['kelas', 'class', 'nama', 'nama murid', 'murid', 'no kad pengenalan', 'nokp', 'no kp', 'ic', 'mykid'].indexOf(h) !== -1;
  });

  const start = hasHeader ? 1 : 0;
  const idx = hasHeader ? {
    kelas: findHeaderIndex_(first, ['kelas', 'class', 'darjah', 'tahun'], 0),
    nama: findHeaderIndex_(first, ['nama murid', 'nama', 'murid', 'name'], 1),
    noKp: findHeaderIndex_(first, ['no kad pengenalan', 'no kp', 'nokp', 'ic', 'mykid', 'kad pengenalan'], -1)
  } : null;

  return rows.slice(start).map(function (row, i) {
    const parsed = hasHeader ? parseStudentWithHeader_(row, idx) : parseStudentWithoutHeader_(row);
    if (!parsed.nama || !parsed.kelas) return null;
    parsed.noKp = cleanIc_(parsed.noKp || '');
    parsed.id = parsed.noKp ? 'KP' + parsed.noKp : 'M' + Utilities.base64EncodeWebSafe(parsed.kelas + '|' + parsed.nama).replace(/=/g, '').slice(0, 16);
    parsed.bil = i + 1;
    return parsed;
  }).filter(Boolean);
}

function fetchSubjectsAndAssessments_() {
  const rows = fetchCsv_(CONFIG.URL_SUBJECTS_CSV);
  if (rows.length < 2) return { subjects: [], pentaksiranList: [] };

  const first = rows[0].map(function (h) { return normalizeHeader_(h); });
  const hasHeader = first.some(function (h) {
    return ['pentaksiran', 'ujian', 'peperiksaan', 'subjek', 'mata pelajaran', 'subject'].indexOf(h) !== -1;
  });

  const start = hasHeader ? 1 : 0;
  const penIndex = hasHeader ? findHeaderIndex_(first, ['pentaksiran', 'ujian', 'peperiksaan', 'assessment'], 0) : 0;
  const subIndex = hasHeader ? findHeaderIndex_(first, ['subjek', 'mata pelajaran', 'subject'], 1) : 1;
  const penSet = [];
  const subSet = [];

  rows.slice(start).forEach(function (row) {
    const pentaksiran = String(row[penIndex] || '').trim();
    const subjek = String(row[subIndex] || '').trim();
    if (pentaksiran) penSet.push(pentaksiran);
    if (subjek) subSet.push(subjek);
  });

  return {
    pentaksiranList: unique_(penSet),
    subjects: unique_(subSet)
  };
}

function fetchCsv_(url) {
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Gagal membaca CSV: ' + url);
  }
  return Utilities.parseCsv(response.getContentText()).filter(function (row) {
    return row.some(function (cell) { return String(cell || '').trim() !== ''; });
  });
}

function parseStudentWithHeader_(row, idx) {
  return {
    kelas: String(row[idx.kelas] || '').trim(),
    nama: String(row[idx.nama] || '').trim(),
    noKp: idx.noKp >= 0 ? String(row[idx.noKp] || '').trim() : ''
  };
}

function parseStudentWithoutHeader_(row) {
  const c0 = String(row[0] || '').trim();
  const c1 = String(row[1] || '').trim();
  const c2 = String(row[2] || '').trim();
  if (looksLikeKelas_(c0)) return { kelas: c0, nama: c1, noKp: c2 };
  return { nama: c0, kelas: c1, noKp: c2 };
}

function getSavedMarks_() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ensureSheet_(ss, 'Markah', MARKAH_HEADERS);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  return values.slice(1).filter(function (row) {
    return row[1] && row[5] && row[6];
  }).map(function (row) {
    return {
      updatedAt: row[0] instanceof Date ? row[0].toISOString() : String(row[0] || ''),
      studentId: String(row[1] || ''),
      nama: String(row[2] || ''),
      kelas: String(row[3] || ''),
      noKp: cleanIc_(row[4] || ''),
      pentaksiran: String(row[5] || ''),
      subjek: String(row[6] || ''),
      markah: String(row[7] || ''),
      gred: String(row[8] || '')
    };
  });
}

function getExistingMarkahIndex_(sheet) {
  const values = sheet.getDataRange().getValues();
  const index = {};
  for (var r = 1; r < values.length; r++) {
    const key = String(values[r][9] || '').trim();
    if (key) index[key] = r + 1;
  }
  return index;
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const needsHeaders = headers.some(function (header, i) {
    return String(firstRow[i] || '') !== header;
  });

  if (needsHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getGredAkademik_(markah) {
  const value = String(markah || '').trim().toUpperCase();
  if (!value) return { gred: '', tafsiran: '' };
  if (value === 'TH') return { gred: 'TH', tafsiran: 'TIDAK HADIR' };

  const n = Number(value);
  if (isNaN(n)) return { gred: '', tafsiran: '' };
  if (n >= 53 && n <= 70) return { gred: 'A', tafsiran: 'CEMERLANG' };
  if (n >= 35 && n <= 52) return { gred: 'B', tafsiran: 'BAIK' };
  if (n >= 17 && n <= 34) return { gred: 'C', tafsiran: 'MEMUASKAN' };
  if (n >= 1 && n <= 16) return { gred: 'D', tafsiran: 'PERLU BIMBINGAN' };
  if (n === 0) return { gred: 'D', tafsiran: 'PERLU BIMBINGAN' };
  return { gred: 'A', tafsiran: 'CEMERLANG' };
}

function sanitizeMarkah_(markah) {
  const value = String(markah || '').trim().toUpperCase();
  if (value === 'TH') return 'TH';
  const n = Number(value);
  if (isNaN(n)) throw new Error('Markah tidak sah: ' + markah);
  return String(Math.max(0, Math.min(70, Math.round(n))));
}

function getSettings_() {
  return {
    schoolName: CONFIG.SCHOOL_NAME,
    logoUrl: CONFIG.LOGO_URL,
    gradeScale: [
      { gred: 'A', min: 53, max: 70 },
      { gred: 'B', min: 35, max: 52 },
      { gred: 'C', min: 17, max: 34 },
      { gred: 'D', min: 1, max: 16 },
      { gred: 'TH', label: 'Tidak Hadir' }
    ]
  };
}

function createSession_(payload) {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(token, JSON.stringify(payload), CONFIG.SESSION_SECONDS);
  return token;
}

function requireSession_(token) {
  const raw = CacheService.getScriptCache().get(String(token || ''));
  if (!raw) throw new Error('Sesi telah tamat. Sila login semula.');
  return JSON.parse(raw);
}

function findHeaderIndex_(headers, candidates, defaultIndex) {
  for (var i = 0; i < candidates.length; i++) {
    const idx = headers.indexOf(candidates[i]);
    if (idx !== -1) return idx;
  }
  return defaultIndex;
}

function normalizeHeader_(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function cleanIc_(value) {
  return String(value || '').replace(/\D/g, '');
}

function looksLikeKelas_(value) {
  return /kelas|tahun|darjah|^[1-6]\b/i.test(String(value || '').trim());
}

function unique_(arr) {
  const seen = {};
  return arr.map(function (x) { return String(x || '').trim(); })
    .filter(function (x) {
      if (!x || seen[x]) return false;
      seen[x] = true;
      return true;
    });
}

function sortKelas_(a, b) {
  const na = Number(String(a).match(/\d+/));
  const nb = Number(String(b).match(/\d+/));
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
  return String(a).localeCompare(String(b));
}

function makeMarkKey_(studentId, pentaksiran, subjek) {
  return [studentId, pentaksiran, subjek].map(function (part) {
    return String(part || '').trim().toLowerCase();
  }).join('|');
}

function output_(params, obj) {
  if (params && params.callback) {
    const callback = String(params.callback).replace(/[^\w.$]/g, '');
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(obj) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(obj);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

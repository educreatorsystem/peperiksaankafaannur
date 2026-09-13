const CONFIG = {
  SCHOOL_NAME: 'KAFA AN NUR',
  TEACHER_PASSWORD: 'Gurukafaannur123',
  SPREADSHEET_ID: '13gq0_w4zk03Imy8U6hQQ8GYKrPBpSY4S5HrQhW4AcA',
  STUDENTS_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQAPisKp7T1wtaGs2pncolfMICzOsoOXYOGyXH5BTjNl_WhclbXDI00dzSZPFE6e_WJjdPhv1LNbD3T/pub?gid=0&single=true&output=csv',
  SUBJECTS_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQAPisKp7T1wtaGs2pncolfMICzOsoOXYOGyXH5BTjNl_WhclbXDI00dzSZPFE6e_WJjdPhv1LNbD3T/pub?gid=1037190385&single=true&output=csv',
  LOGO_URL: 'https://iili.io/nqIgmR2.md.jpg',
  SHEETS: {
    ACADEMIC: 'MarkahAkademik',
    SAHSIAH: 'MarkahSahsiah'
  },
  HEADERS: {
    ACADEMIC: ['Timestamp', 'Pentaksiran', 'Kelas', 'NoKP', 'Nama', 'Subjek', 'Markah', 'Gred', 'DikemaskiniOleh'],
    SAHSIAH: ['Timestamp', 'Pentaksiran', 'Kelas', 'NoKP', 'Nama', 'MarkahSahsiah', 'GredSahsiah', 'DikemaskiniOleh']
  },
  DEFAULT_SUBJECTS: ['Al-Quran', 'Ibadah', 'Akidah', 'Lughah Al-Quran', 'Adab', 'Sirah', 'Jawi dan Khat']
};

function doGet() {
  ensureDatabase_();
  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('Sistem Analisis Peperiksaan KAFA')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getPublicConfig() {
  return {
    schoolName: CONFIG.SCHOOL_NAME,
    logoUrl: CONFIG.LOGO_URL
  };
}

function loginTeacher(password) {
  ensureDatabase_();
  if (String(password || '') !== CONFIG.TEACHER_PASSWORD) {
    throw new Error('Password guru tidak tepat.');
  }
  const token = issueToken_({ role: 'teacher' });
  return {
    token,
    role: 'teacher',
    config: getPublicConfig(),
    master: getMasterData_()
  };
}

function loginParent(noKP) {
  ensureDatabase_();
  const cleanIc = normalizeIc_(noKP);
  if (!cleanIc) {
    throw new Error('Sila masukkan nombor kad pengenalan murid.');
  }

  const students = getStudents_();
  const student = students.find(row => normalizeIc_(row.noKP) === cleanIc);
  if (!student) {
    throw new Error('No kad pengenalan tidak dijumpai dalam senarai murid.');
  }

  const token = issueToken_({ role: 'parent', noKP: student.noKP });
  const master = getMasterData_();
  return {
    token,
    role: 'parent',
    config: getPublicConfig(),
    student,
    pentaksiran: master.pentaksiran
  };
}

function getTeacherData(token) {
  assertTeacher_(token);
  ensureDatabase_();
  return {
    config: getPublicConfig(),
    master: getMasterData_()
  };
}

function getAcademicInput(token, kelas, pentaksiran, subjek) {
  assertTeacher_(token);
  ensureDatabase_();
  const selectedStudents = filterStudents_(kelas);
  const marks = getAcademicMap_(kelas, pentaksiran, subjek);

  return selectedStudents.map(student => ({
    nama: student.nama,
    kelas: student.kelas,
    noKP: student.noKP,
    markah: marks[student.noKP] === undefined ? '' : marks[student.noKP],
    gred: marks[student.noKP] === undefined ? '' : gradeByScale_(marks[student.noKP], 70)
  }));
}

function saveAcademicMarks(token, payload) {
  assertTeacher_(token);
  ensureDatabase_();

  const data = payload || {};
  const kelas = required_(data.kelas, 'Kelas');
  const pentaksiran = required_(data.pentaksiran, 'Pentaksiran');
  const subjek = required_(data.subjek, 'Subjek');
  const marks = Array.isArray(data.marks) ? data.marks : [];
  const sheet = getSheet_(CONFIG.SHEETS.ACADEMIC, CONFIG.HEADERS.ACADEMIC);
  const existing = getDataRows_(sheet);
  const indexMap = {};

  existing.forEach((row, i) => {
    const key = academicKey_(row.Pentaksiran, row.Kelas, row.NoKP, row.Subjek);
    if (indexMap[key] === undefined) indexMap[key] = i + 2;
  });

  let saved = 0;
  marks.forEach(item => {
    if (!item || item.markah === '' || item.markah === null || item.markah === undefined) return;
    const markah = boundedNumber_(item.markah, 0, 70, 'Markah akademik');
    const noKP = required_(item.noKP, 'No kad pengenalan');
    const nama = required_(item.nama, 'Nama murid');
    const rowValues = [
      new Date(),
      pentaksiran,
      kelas,
      noKP,
      nama,
      subjek,
      markah,
      gradeByScale_(markah, 70),
      'Guru'
    ];
    const key = academicKey_(pentaksiran, kelas, noKP, subjek);
    upsertRow_(sheet, indexMap[key], rowValues);
    saved += 1;
  });

  return { ok: true, saved, message: `${saved} rekod markah akademik disimpan.` };
}

function getSahsiahInput(token, kelas, pentaksiran) {
  assertTeacher_(token);
  ensureDatabase_();
  const selectedStudents = filterStudents_(kelas);
  const marks = getSahsiahMap_(kelas, pentaksiran);

  return selectedStudents.map(student => ({
    nama: student.nama,
    kelas: student.kelas,
    noKP: student.noKP,
    markah: marks[student.noKP] === undefined ? '' : marks[student.noKP],
    gred: marks[student.noKP] === undefined ? '' : gradeByScale_(marks[student.noKP], 30)
  }));
}

function saveSahsiahMarks(token, payload) {
  assertTeacher_(token);
  ensureDatabase_();

  const data = payload || {};
  const kelas = required_(data.kelas, 'Kelas');
  const pentaksiran = required_(data.pentaksiran, 'Pentaksiran');
  const marks = Array.isArray(data.marks) ? data.marks : [];
  const sheet = getSheet_(CONFIG.SHEETS.SAHSIAH, CONFIG.HEADERS.SAHSIAH);
  const existing = getDataRows_(sheet);
  const indexMap = {};

  existing.forEach((row, i) => {
    const key = sahsiahKey_(row.Pentaksiran, row.Kelas, row.NoKP);
    if (indexMap[key] === undefined) indexMap[key] = i + 2;
  });

  let saved = 0;
  marks.forEach(item => {
    if (!item || item.markah === '' || item.markah === null || item.markah === undefined) return;
    const markah = boundedNumber_(item.markah, 0, 30, 'Markah sahsiah');
    const noKP = required_(item.noKP, 'No kad pengenalan');
    const nama = required_(item.nama, 'Nama murid');
    const rowValues = [
      new Date(),
      pentaksiran,
      kelas,
      noKP,
      nama,
      markah,
      gradeByScale_(markah, 30),
      'Guru'
    ];
    const key = sahsiahKey_(pentaksiran, kelas, noKP);
    upsertRow_(sheet, indexMap[key], rowValues);
    saved += 1;
  });

  return { ok: true, saved, message: `${saved} rekod markah sahsiah disimpan.` };
}

function getIndividualAnalysis(token, kelas, pentaksiran) {
  assertTeacher_(token);
  ensureDatabase_();
  return buildClassAnalysis_(kelas, pentaksiran);
}

function getSubjectAnalysis(token, kelas, subjek, pentaksiran) {
  assertTeacher_(token);
  ensureDatabase_();
  return buildSubjectAnalysis_(kelas, subjek, pentaksiran);
}

function getTeacherSlip(token, noKP, pentaksiran) {
  assertTeacher_(token);
  ensureDatabase_();
  return buildSlip_(noKP, pentaksiran);
}

function getParentSlip(token, pentaksiran) {
  const session = assertParent_(token);
  ensureDatabase_();
  return buildSlip_(session.noKP, pentaksiran);
}

function buildClassAnalysis_(kelas, pentaksiran) {
  kelas = required_(kelas, 'Kelas');
  pentaksiran = required_(pentaksiran, 'Pentaksiran');

  const master = getMasterData_();
  const subjects = master.subjects;
  const students = filterStudents_(kelas);
  const academicRows = getDataRows_(getSheet_(CONFIG.SHEETS.ACADEMIC, CONFIG.HEADERS.ACADEMIC));
  const sahsiahMap = getSahsiahMap_(kelas, pentaksiran);
  const academicByStudent = {};

  academicRows.forEach(row => {
    if (same_(row.Kelas, kelas) && same_(row.Pentaksiran, pentaksiran)) {
      if (!academicByStudent[row.NoKP]) academicByStudent[row.NoKP] = {};
      academicByStudent[row.NoKP][row.Subjek] = Number(row.Markah || 0);
    }
  });

  const maxTotal = (subjects.length * 70) + 30;
  const rows = students.map(student => {
    const subjectMarks = subjects.map(subject => {
      const mark = academicByStudent[student.noKP] && academicByStudent[student.noKP][subject] !== undefined
        ? Number(academicByStudent[student.noKP][subject])
        : '';
      return {
        subjek: subject,
        markah: mark,
        gred: mark === '' ? '' : gradeByScale_(mark, 70)
      };
    });
    const academicTotal = subjectMarks.reduce((sum, row) => sum + (row.markah === '' ? 0 : Number(row.markah)), 0);
    const sahsiah = sahsiahMap[student.noKP] === undefined ? '' : Number(sahsiahMap[student.noKP]);
    const total = academicTotal + (sahsiah === '' ? 0 : sahsiah);
    const percent = maxTotal ? (total / maxTotal) * 100 : 0;

    return {
      kedudukan: 0,
      nama: student.nama,
      kelas: student.kelas,
      noKP: student.noKP,
      subjek: subjectMarks,
      jumlahAkademik: academicTotal,
      sahsiah,
      jumlah: total,
      peratus: round2_(percent),
      gredKeseluruhan: gradeByScale_(total, maxTotal)
    };
  });

  rows.sort((a, b) => {
    if (b.peratus !== a.peratus) return b.peratus - a.peratus;
    if (b.jumlah !== a.jumlah) return b.jumlah - a.jumlah;
    return String(a.nama).localeCompare(String(b.nama));
  });

  rows.forEach((row, i) => row.kedudukan = i + 1);

  return {
    kelas,
    pentaksiran,
    subjects,
    maxTotal,
    count: rows.length,
    rows
  };
}

function buildSubjectAnalysis_(kelas, subjek, pentaksiran) {
  kelas = required_(kelas, 'Kelas');
  subjek = required_(subjek, 'Subjek');
  pentaksiran = required_(pentaksiran, 'Pentaksiran');

  const students = filterStudents_(kelas);
  const marksMap = getAcademicMap_(kelas, pentaksiran, subjek);
  const rows = students.map(student => {
    const markah = marksMap[student.noKP] === undefined ? '' : Number(marksMap[student.noKP]);
    return {
      nama: student.nama,
      noKP: student.noKP,
      kelas: student.kelas,
      markah,
      gred: markah === '' ? '' : gradeByScale_(markah, 70)
    };
  }).filter(row => row.markah !== '');

  const distribution = { A: 0, B: 0, C: 0, D: 0 };
  rows.forEach(row => distribution[row.gred] += 1);

  const markValues = rows.map(row => Number(row.markah));
  const total = markValues.reduce((sum, value) => sum + value, 0);
  const average = markValues.length ? total / markValues.length : 0;
  const highest = markValues.length ? Math.max.apply(null, markValues) : 0;
  const lowest = markValues.length ? Math.min.apply(null, markValues) : 0;
  const passed = rows.filter(row => row.gred !== 'D').length;

  return {
    kelas,
    subjek,
    pentaksiran,
    rows: rows.sort((a, b) => Number(b.markah) - Number(a.markah)),
    distribution,
    stats: {
      bilMurid: students.length,
      bilAdaMarkah: rows.length,
      purata: round2_(average),
      tertinggi: highest,
      terendah: lowest,
      bilMenguasai: passed,
      peratusMenguasai: rows.length ? round2_((passed / rows.length) * 100) : 0
    }
  };
}

function buildSlip_(noKP, pentaksiran) {
  noKP = required_(noKP, 'No kad pengenalan');
  pentaksiran = required_(pentaksiran, 'Pentaksiran');

  const student = getStudents_().find(row => normalizeIc_(row.noKP) === normalizeIc_(noKP));
  if (!student) throw new Error('Murid tidak dijumpai.');

  const analysis = buildClassAnalysis_(student.kelas, pentaksiran);
  const row = analysis.rows.find(item => normalizeIc_(item.noKP) === normalizeIc_(noKP));
  if (!row) throw new Error('Rekod murid tidak dijumpai untuk pentaksiran ini.');

  return {
    config: getPublicConfig(),
    student,
    kelas: student.kelas,
    pentaksiran,
    subjects: analysis.subjects,
    maxTotal: analysis.maxTotal,
    bilMuridKelas: analysis.count,
    result: row,
    jawiSubjects: getJawiSubjectMap_()
  };
}

function ensureDatabase_() {
  getSheet_(CONFIG.SHEETS.ACADEMIC, CONFIG.HEADERS.ACADEMIC);
  getSheet_(CONFIG.SHEETS.SAHSIAH, CONFIG.HEADERS.SAHSIAH);
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getSheet_(name, headers) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeader = firstRow.some(value => String(value || '').trim() !== '');
  if (!hasHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getDataRows_(sheet) {
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(value => String(value || '').trim());

  return values.slice(1)
    .filter(row => row.some(value => value !== '' && value !== null))
    .map(row => {
      const obj = {};
      headers.forEach((header, i) => obj[header] = row[i]);
      return obj;
    });
}

function upsertRow_(sheet, rowNumber, values) {
  if (rowNumber) {
    sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }
}

function getMasterData_() {
  const students = getStudents_();
  const subjectData = getSubjectsAndAssessments_();
  const savedAssessments = getSavedPentaksiran_();
  const classes = unique_(students.map(row => row.kelas)).sort(naturalSort_);
  const pentaksiran = unique_(subjectData.pentaksiran.concat(savedAssessments)).sort(naturalSort_);

  return {
    students,
    classes,
    subjects: subjectData.subjects,
    pentaksiran
  };
}

function getStudents_() {
  const rows = fetchCsvRows_(CONFIG.STUDENTS_CSV_URL);
  if (!rows.length) return [];

  const parsed = parseTable_(rows, {
    nama: ['nama', 'nama murid', 'murid', 'name'],
    kelas: ['kelas', 'darjah', 'class'],
    noKP: ['no kad pengenalan', 'no kp', 'nokp', 'no ic', 'ic', 'kad pengenalan', 'nric']
  }, ['nama', 'kelas', 'noKP']);

  return parsed
    .map(row => ({
      nama: clean_(row.nama),
      kelas: clean_(row.kelas),
      noKP: clean_(row.noKP)
    }))
    .filter(row => row.nama && row.kelas && row.noKP)
    .sort((a, b) => naturalSort_(a.kelas, b.kelas) || String(a.nama).localeCompare(String(b.nama)));
}

function getSubjectsAndAssessments_() {
  const rows = fetchCsvRows_(CONFIG.SUBJECTS_CSV_URL);
  const fallback = {
    subjects: CONFIG.DEFAULT_SUBJECTS.slice(),
    pentaksiran: ['Pentaksiran 1']
  };
  if (!rows.length) return fallback;

  const parsed = parseTable_(rows, {
    subjek: ['subjek', 'mata pelajaran', 'matapelajaran', 'subject'],
    pentaksiran: ['pentaksiran', 'penilaian', 'ujian', 'peperiksaan', 'assessment']
  }, ['subjek', 'pentaksiran']);

  const subjects = unique_(parsed.map(row => clean_(row.subjek)).filter(Boolean));
  const pentaksiran = unique_(parsed.map(row => clean_(row.pentaksiran)).filter(Boolean));

  return {
    subjects: subjects.length ? subjects : fallback.subjects,
    pentaksiran: pentaksiran.length ? pentaksiran : fallback.pentaksiran
  };
}

function fetchCsvRows_(url) {
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() >= 400) return [];
    const text = response.getContentText();
    return Utilities.parseCsv(text).filter(row => row.some(cell => String(cell || '').trim() !== ''));
  } catch (error) {
    return [];
  }
}

function parseTable_(rows, aliases, fallbackOrder) {
  const first = rows[0].map(clean_);
  const normalizedFirst = first.map(normalizeHeader_);
  const headerFound = Object.keys(aliases).some(key =>
    aliases[key].some(alias => normalizedFirst.indexOf(normalizeHeader_(alias)) !== -1)
  );

  let headers;
  let dataRows;
  if (headerFound) {
    headers = {};
    Object.keys(aliases).forEach(key => {
      const foundIndex = normalizedFirst.findIndex(header =>
        aliases[key].map(normalizeHeader_).indexOf(header) !== -1
      );
      headers[key] = foundIndex;
    });
    dataRows = rows.slice(1);
  } else {
    headers = {};
    fallbackOrder.forEach((key, i) => headers[key] = i);
    dataRows = rows;
  }

  return dataRows.map(row => {
    const obj = {};
    Object.keys(headers).forEach(key => {
      obj[key] = headers[key] >= 0 ? row[headers[key]] : '';
    });
    return obj;
  });
}

function getSavedPentaksiran_() {
  const academic = getDataRows_(getSheet_(CONFIG.SHEETS.ACADEMIC, CONFIG.HEADERS.ACADEMIC)).map(row => row.Pentaksiran);
  const sahsiah = getDataRows_(getSheet_(CONFIG.SHEETS.SAHSIAH, CONFIG.HEADERS.SAHSIAH)).map(row => row.Pentaksiran);
  return unique_(academic.concat(sahsiah).map(clean_).filter(Boolean));
}

function filterStudents_(kelas) {
  kelas = required_(kelas, 'Kelas');
  return getStudents_().filter(row => same_(row.kelas, kelas));
}

function getAcademicMap_(kelas, pentaksiran, subjek) {
  const rows = getDataRows_(getSheet_(CONFIG.SHEETS.ACADEMIC, CONFIG.HEADERS.ACADEMIC));
  const map = {};
  rows.forEach(row => {
    if (same_(row.Kelas, kelas) && same_(row.Pentaksiran, pentaksiran) && same_(row.Subjek, subjek)) {
      map[row.NoKP] = Number(row.Markah || 0);
    }
  });
  return map;
}

function getSahsiahMap_(kelas, pentaksiran) {
  const rows = getDataRows_(getSheet_(CONFIG.SHEETS.SAHSIAH, CONFIG.HEADERS.SAHSIAH));
  const map = {};
  rows.forEach(row => {
    if (same_(row.Kelas, kelas) && same_(row.Pentaksiran, pentaksiran)) {
      map[row.NoKP] = Number(row.MarkahSahsiah || 0);
    }
  });
  return map;
}

function gradeByScale_(mark, maxMark) {
  if (mark === '' || mark === null || mark === undefined) return '';
  const scaled = Number(mark) / Number(maxMark || 70) * 70;
  if (scaled >= 53) return 'A';
  if (scaled >= 35) return 'B';
  if (scaled >= 17) return 'C';
  return 'D';
}

function boundedNumber_(value, min, max, label) {
  const number = Number(value);
  if (value === '' || value === null || value === undefined || isNaN(number)) {
    throw new Error(`${label} mesti nombor.`);
  }
  if (number < min || number > max) {
    throw new Error(`${label} mesti antara ${min} hingga ${max}.`);
  }
  return number;
}

function required_(value, label) {
  const text = clean_(value);
  if (!text) throw new Error(`${label} diperlukan.`);
  return text;
}

function issueToken_(payload) {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(`kafa-token-${token}`, JSON.stringify(payload), 21600);
  return token;
}

function readToken_(token) {
  const raw = CacheService.getScriptCache().get(`kafa-token-${token}`);
  if (!raw) throw new Error('Sesi telah tamat. Sila log masuk semula.');
  return JSON.parse(raw);
}

function assertTeacher_(token) {
  const session = readToken_(token);
  if (session.role !== 'teacher') throw new Error('Akses guru diperlukan.');
  return session;
}

function assertParent_(token) {
  const session = readToken_(token);
  if (session.role !== 'parent') throw new Error('Akses ibu bapa diperlukan.');
  return session;
}

function academicKey_(pentaksiran, kelas, noKP, subjek) {
  return [pentaksiran, kelas, normalizeIc_(noKP), subjek].map(normalizeKey_).join('|');
}

function sahsiahKey_(pentaksiran, kelas, noKP) {
  return [pentaksiran, kelas, normalizeIc_(noKP)].map(normalizeKey_).join('|');
}

function normalizeKey_(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeHeader_(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeIc_(value) {
  return String(value || '').replace(/[^0-9a-z]/gi, '').toUpperCase();
}

function clean_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

function same_(a, b) {
  return normalizeKey_(a) === normalizeKey_(b);
}

function unique_(values) {
  const seen = {};
  const output = [];
  values.forEach(value => {
    const cleanValue = clean_(value);
    const key = normalizeKey_(cleanValue);
    if (cleanValue && !seen[key]) {
      seen[key] = true;
      output.push(cleanValue);
    }
  });
  return output;
}

function naturalSort_(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' });
}

function round2_(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function getJawiSubjectMap_() {
  return {
    'Al-Quran': 'القرآن',
    'Quran': 'القرآن',
    'Ibadah': 'عباده',
    'Akidah': 'عقيده',
    'Aqidah': 'عقيده',
    'Lughah Al-Quran': 'لغة القرآن',
    'Lughatul Quran': 'لغة القرآن',
    'Bahasa Arab': 'بهاس عرب',
    'Adab': 'ادب',
    'Sirah': 'سيره',
    'Jawi dan Khat': 'جاوي دان خط',
    'Jawi': 'جاوي',
    'Khat': 'خط'
  };
}

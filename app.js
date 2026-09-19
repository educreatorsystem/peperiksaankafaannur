'use strict';

const CONFIG = {
  schoolName: 'سكوله رنده اݢام رعيت النور',
  crestUrl: 'https://iili.io/nqIgmR2.md.jpg',
  teacherPassword: 'Gurukafaannur123',
  appScriptUrl: 'https://script.google.com/macros/s/AKfycbxCLROvIwqGbeSmjBCHduRtJ7Mg-0ibAqsWWcZXxrRpqf9nobncJFyOp9wFVdRh7bkSIA/exec',
  studentsCsv: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQAPisKp7T1wtaGs2pncolfMICzOsoOXYOGyXH5BTjNl_WhclbXDI00dzSZPFE6e_WJjdPhv1LNbD3T/pub?gid=0&single=true&output=csv',
  configCsv: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQAPisKp7T1wtaGs2pncolfMICzOsoOXYOGyXH5BTjNl_WhclbXDI00dzSZPFE6e_WJjdPhv1LNbD3T/pub?gid=1037190385&single=true&output=csv'
};

const STORAGE_KEYS = {
  static: 'sam_static_v2',
  records: 'sam_records_v3',
  signatures: 'sam_signatures_v1'
};

const state = {
  role: null,
  parentStudent: null,
  students: [],
  assessments: [],
  subjects: [],
  assessmentSubjects: {},
  marks: [],
  attendance: [],
  signatures: {
    headTeacher: '',
    teacher: '',
    headTeacherName: '',
    teacherName: ''
  }
};

const GRADE_KEYS = ['A', 'B', 'C', 'D', 'TH'];
const CURRENT_REPORT_YEAR = '2026';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

document.addEventListener('DOMContentLoaded', () => {
  bindAuth();
  bindNavigation();
  bindInputs();
  bindStatusPopup();
  bindPwaInstall();
  registerServiceWorker();
  hydrateLocalData();
  loadInitialData();
});

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => null);
  });
}

function bindPwaInstall() {
  const installButton = $('#installAppBtn');
  if (!installButton) return;
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installButton.classList.remove('hidden');
  });

  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => null);
    deferredPrompt = null;
    installButton.classList.add('hidden');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installButton.classList.add('hidden');
    showToast('Aplikasi berjaya dipasang pada peranti.');
  });
}

function bindAuth() {
  $('#teacherLoginForm').addEventListener('submit', (event) => {
    event.preventDefault();
    if ($('#teacherPassword').value === CONFIG.teacherPassword) {
      state.role = 'teacher';
      state.parentStudent = null;
      enterApp('Guru');
      return;
    }
    showToast('Password guru tidak tepat.', 'error');
  });

  $('#parentLoginForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const ic = normalizeIc($('#parentIc').value);
    const student = state.students.find((item) => normalizeIc(item.ic) === ic);
    if (!student) {
      showToast('No kad pengenalan murid tidak ditemui.', 'error');
      return;
    }
    state.role = 'parent';
    state.parentStudent = student;
    enterApp(student.name);
  });

  $('#logoutBtn').addEventListener('click', () => {
    state.role = null;
    state.parentStudent = null;
    $('#appShell').classList.add('hidden');
    $('#loginScreen').classList.remove('hidden');
  });
}

function enterApp(label) {
  $('#loginScreen').classList.add('hidden');
  $('#appShell').classList.remove('hidden');
  $('#syncLabel').textContent = `Log masuk: ${label}`;

  $$('.tab-btn').forEach((button) => {
    const teacherOnly = ['marksTab', 'attendanceTab', 'individualTab', 'subjectTab', 'overallTab'];
    button.hidden = state.role === 'parent' && teacherOnly.includes(button.dataset.tab);
  });

  const firstTab = state.role === 'parent' ? 'reportTab' : 'marksTab';
  activateTab(firstTab);
  renderAll();
}

function bindNavigation() {
  $$('.tab-btn').forEach((button) => {
    button.addEventListener('click', () => activateTab(button.dataset.tab));
  });
  $('#refreshDataBtn').addEventListener('click', loadInitialData);
  $$('.print-trigger').forEach((button) => button.addEventListener('click', printReport));
}

function bindInputs() {
  [
    'marksClass', 'marksAssessment', 'marksSubject',
    'attendanceClass', 'attendanceAssessment',
    'individualClass', 'individualAssessment',
    'subjectAssessment', 'subjectClass', 'subjectName',
    'overallAssessment', 'overallStream',
    'reportClass', 'reportAssessment'
  ].forEach((id) => {
    $(`#${id}`).addEventListener('change', renderAll);
  });

  $('#saveMarksBtn').addEventListener('click', saveMarks);
  $('#saveAttendanceBtn').addEventListener('click', saveAttendance);
  $('#headSignatureInput').addEventListener('change', (event) => saveSignatureFromInput(event, 'headTeacher'));
  $('#teacherSignatureInput').addEventListener('change', (event) => saveSignatureFromInput(event, 'teacher'));
  $('#headTeacherNameInput').addEventListener('input', (event) => saveSignatureText('headTeacherName', event.target.value));
  $('#teacherNameInput').addEventListener('input', (event) => saveSignatureText('teacherName', event.target.value));
}

function bindStatusPopup() {
  const modal = $('#statusModal');
  const closeButton = $('#statusModalClose');
  if (!modal || !closeButton) return;

  closeButton.addEventListener('click', hideStatusPopup);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) hideStatusPopup();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideStatusPopup();
  });
}

function saveSignatureFromInput(event, key) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.signatures[key] = String(reader.result || '');
    localStorage.setItem(STORAGE_KEYS.signatures, JSON.stringify(state.signatures));
    showToast('Tandatangan berjaya dimasukkan ke slip.');
    renderReports();
  };
  reader.readAsDataURL(file);
}

function saveSignatureText(key, value) {
  state.signatures[key] = value.trim();
  localStorage.setItem(STORAGE_KEYS.signatures, JSON.stringify(state.signatures));
  renderReports();
}

async function loadInitialData() {
  $('#syncLabel').textContent = 'Memuatkan data Google Sheet...';
  try {
    const [students, configRows] = await Promise.all([
      fetchCsv(CONFIG.studentsCsv),
      fetchCsv(CONFIG.configCsv)
    ]);

    state.students = students
      .map((row, index) => {
        const firstLooksClass = looksLikeClass(row[0]);
        const classIndex = firstLooksClass ? 0 : 1;
        const nameIndex = firstLooksClass ? 1 : 0;
        const icIndex = 2;
        return {
          id: normalizeIc(row[icIndex]) || `${clean(row[nameIndex]).toLowerCase()}-${clean(row[classIndex]).toLowerCase()}-${index + 1}`,
          name: clean(row[nameIndex]),
          className: clean(row[classIndex]),
          ic: clean(row[icIndex])
        };
      })
      .filter((student) => student.name && student.className);

    const pairs = configRows.map((row) => ({ assessment: clean(row[0]), subject: clean(row[1]) }));

    state.assessments = unique(pairs.map((row) => row.assessment));
    state.subjects = unique(pairs.map((row) => row.subject));
    state.assessmentSubjects = state.assessments.reduce((map, assessment) => {
      const pairedSubjects = pairs.filter((row) => row.assessment === assessment && row.subject).map((row) => row.subject);
      map[assessment] = pairedSubjects.length > 1 ? unique(pairedSubjects) : state.subjects;
      return map;
    }, {});
    persistStaticData();
    hydrateSelectors();
    await loadRemoteRecords();
    $('#syncLabel').textContent = `Data siap: ${state.students.length} murid`;
    renderAll();
  } catch (error) {
    $('#syncLabel').textContent = 'Menggunakan data simpanan setempat';
    showToast('Data Google Sheet tidak dapat dimuatkan. Sistem menggunakan data setempat dahulu.', 'error');
    hydrateSelectors();
    renderAll();
  }
}

async function loadRemoteRecords() {
  try {
    const data = await apiGet('getRecords');
    if (Array.isArray(data.marks)) state.marks = mergeByKey(state.marks, data.marks, markKey);
    if (Array.isArray(data.attendance)) state.attendance = mergeByKey(state.attendance, data.attendance, attendanceKey);
    persistRecords();
  } catch {
    hydrateLocalData();
  }
}

function hydrateSelectors() {
  const classes = unique(state.students.map((student) => student.className)).sort(classSorter);
  const streams = unique(classes.map((className) => String(className).match(/^\d+/)?.[0]).filter(Boolean));

  fillSelect('#marksClass', classes);
  fillSelect('#attendanceClass', classes);
  fillSelect('#individualClass', classes);
  fillSelect('#subjectClass', classes);
  fillSelect('#reportClass', state.role === 'parent' ? [state.parentStudent?.className].filter(Boolean) : classes);
  fillSelect('#overallStream', streams.map((year) => `Tahun ${year}`), streams);

  fillSelect('#marksAssessment', state.assessments);
  fillSelect('#individualAssessment', state.assessments);
  fillSelect('#subjectAssessment', state.assessments);
  fillSelect('#overallAssessment', state.assessments);
  fillSelect('#reportAssessment', state.assessments);
  fillSelect('#attendanceAssessment', state.assessments);

  updateSubjectSelectors();
}

function fillSelect(selector, labels, values = labels) {
  const select = $(selector);
  const current = select.value;
  select.innerHTML = '';
  labels.forEach((label, index) => {
    const option = document.createElement('option');
    option.value = values[index] ?? label;
    option.textContent = label;
    select.append(option);
  });
  if (values.includes(current)) select.value = current;
}

function activateTab(tabId) {
  $$('.tab-btn').forEach((button) => button.classList.toggle('active', button.dataset.tab === tabId));
  $$('.tab-page').forEach((page) => page.classList.toggle('active', page.id === tabId));
  $('#pageTitle').textContent = $(`.tab-btn[data-tab="${tabId}"]`)?.textContent || 'Sistem Analisis Markah';
  renderAll();
}

function renderAll() {
  if (!state.students.length) return;
  updateSubjectSelectors();
  renderMarksInput();
  renderAttendanceInput();
  renderIndividualAnalysis();
  renderSubjectAnalysis();
  renderOverallAnalysis();
  renderReports();
}

function updateSubjectSelectors() {
  preserveSelect('#marksSubject', selectedSubjects($('#marksAssessment')?.value));
  preserveSelect('#subjectName', selectedSubjects($('#subjectAssessment')?.value));
}

function preserveSelect(selector, labels) {
  const select = $(selector);
  if (!select) return;
  const current = select.value;
  fillSelect(selector, labels);
  if (labels.includes(current)) select.value = current;
}

function renderMarksInput() {
  const className = $('#marksClass').value;
  const assessment = $('#marksAssessment').value;
  const subject = $('#marksSubject').value;
  const students = studentsInClass(className);

  if (!className || !assessment || !subject) {
    $('#marksTableWrap').innerHTML = empty('Sila pilih kelas, pentaksiran dan subjek.');
    return;
  }

  $('#marksTableWrap').innerHTML = `
    <table>
      <thead>
        <tr>
          <th class="number">Bil</th>
          <th>Nama Murid</th>
          <th>Markah</th>
          <th>TD / TH</th>
          <th>Gred</th>
          <th>Tafsiran</th>
        </tr>
      </thead>
      <tbody>
        ${students.map((student, index) => {
          const record = getMark(student.id, assessment, subject);
          return `
            <tr data-student-id="${escapeHtml(student.id)}">
              <td class="number">${index + 1}</td>
              <td>${escapeHtml(student.name)}</td>
              <td><input class="mark-input" type="number" min="0" max="70" value="${record.score ?? ''}" aria-label="Markah ${escapeHtml(student.name)}"></td>
              <td>
                <div class="status-controls">
                  <button type="button" class="mini-btn status-btn ${record.status === 'TD' ? 'active' : ''}" data-status="TD">TD</button>
                  <button type="button" class="mini-btn status-btn ${record.status === 'TH' ? 'active' : ''}" data-status="TH">TH</button>
                </div>
              </td>
              <td class="grade-cell">${gradeBadge(record.grade)}</td>
              <td class="interpret-cell">${escapeHtml(interpretGrade(record.grade, record.status))}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  $$('.mark-input', $('#marksTableWrap')).forEach((input) => input.addEventListener('input', updateMarkPreview));
  $$('.status-btn', $('#marksTableWrap')).forEach((button) => button.addEventListener('click', toggleStatusButton));
}

function toggleStatusButton(event) {
  const button = event.currentTarget;
  const row = button.closest('tr');
  $$('.status-btn', row).forEach((item) => {
    if (item !== button) item.classList.remove('active');
  });
  button.classList.toggle('active');
  if (button.classList.contains('active')) {
    $('.mark-input', row).value = '';
  }
  updateRowGrade(row);
}

function updateMarkPreview(event) {
  const row = event.currentTarget.closest('tr');
  $$('.status-btn', row).forEach((button) => button.classList.remove('active'));
  updateRowGrade(row);
}

function updateRowGrade(row) {
  const activeStatus = $('.status-btn.active', row)?.dataset.status || '';
  const score = $('.mark-input', row).value;
  const grade = activeStatus ? activeStatus : gradeFromScore(score);
  $('.grade-cell', row).innerHTML = gradeBadge(grade);
  $('.interpret-cell', row).textContent = interpretGrade(grade, activeStatus);
}

async function saveMarks() {
  const assessment = $('#marksAssessment').value;
  const subject = $('#marksSubject').value;
  const className = $('#marksClass').value;
  const rows = $$('tbody tr', $('#marksTableWrap'));
  const payload = rows.map((row) => {
    const student = state.students.find((item) => item.id === row.dataset.studentId);
    const status = $('.status-btn.active', row)?.dataset.status || '';
    const rawScore = $('.mark-input', row).value;
    const score = status ? '' : clampScore(rawScore);
    const grade = status || gradeFromScore(score);
    return {
      studentId: student.id,
      name: student.name,
      className,
      assessment,
      subject,
      score,
      status,
      grade,
      interpretation: interpretGrade(grade, status),
      timestamp: new Date().toISOString()
    };
  });

  state.marks = mergeByKey(state.marks, payload, markKey);
  persistRecords();
  await apiPost('saveMarks', { marks: payload });
  showToast('Status penyimpanan: markah berjaya dihantar dan disimpan setempat.');
  showStatusPopup('Markah berjaya disimpan', `${payload.length} rekod markah untuk ${className} (${assessment} - ${subject}) telah disimpan.`);
  renderAll();
}

function renderAttendanceInput() {
  const className = $('#attendanceClass').value;
  const assessment = $('#attendanceAssessment').value;
  const students = studentsInClass(className);
  if (!className || !assessment) {
    $('#attendanceTableWrap').innerHTML = empty('Sila pilih kelas dan pentaksiran.');
    return;
  }
  $('#attendanceTableWrap').innerHTML = `
    <table>
      <thead>
        <tr>
          <th class="number">Bil</th>
          <th>Nama Murid</th>
          <th>Peratus Kehadiran</th>
        </tr>
      </thead>
      <tbody>
        ${students.map((student, index) => {
          const record = getAttendance(student.id, assessment);
          return `
            <tr data-student-id="${escapeHtml(student.id)}">
              <td class="number">${index + 1}</td>
              <td>${escapeHtml(student.name)}</td>
              <td><input class="attendance-input" type="number" min="0" max="100" value="${record.percentage ?? ''}" aria-label="Peratus kehadiran ${escapeHtml(student.name)}"> %</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

async function saveAttendance() {
  const className = $('#attendanceClass').value;
  const assessment = $('#attendanceAssessment').value;
  const payload = $$('tbody tr', $('#attendanceTableWrap')).map((row) => {
    const student = state.students.find((item) => item.id === row.dataset.studentId);
    return {
      studentId: student.id,
      name: student.name,
      className,
      assessment,
      percentage: clamp($('.attendance-input', row).value, 0, 100),
      timestamp: new Date().toISOString()
    };
  });

  state.attendance = mergeByKey(state.attendance, payload, attendanceKey);
  persistRecords();
  await apiPost('saveAttendance', { attendance: payload });
  showToast('Status penyimpanan: kehadiran berjaya dihantar dan disimpan setempat.');
  showStatusPopup('Kehadiran berjaya disimpan', `${payload.length} rekod kehadiran untuk ${className} (${assessment}) telah disimpan.`);
  renderAll();
}

function renderIndividualAnalysis() {
  const className = $('#individualClass').value;
  const assessment = $('#individualAssessment').value;
  const rows = buildClassPerformance(className, assessment);
  const subjects = selectedSubjects(assessment);
  const topBySubject = subjects.map((subject) => bestForSubject(className, assessment, subject)).filter(Boolean);

  $('#individualPrint').innerHTML = `
    ${reportHeader('Analisis Individu', `${className || '-'} | ${assessment || '-'}`)}
    <table>
      <thead>
        <tr>
          <th rowspan="2" class="number">Kedudukan</th>
          <th rowspan="2">Nama Murid</th>
          ${subjects.map((subject) => `<th colspan="2">${escapeHtml(subject)}</th>`).join('')}
          <th rowspan="2" class="number">Jumlah Markah</th>
          <th rowspan="2" class="number">Purata</th>
          <th rowspan="2" class="number">Gred Purata</th>
        </tr>
        <tr>${subjects.map(() => '<th>Markah</th><th>Gred</th>').join('')}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td class="number">${row.rank}</td>
            <td>${escapeHtml(row.student.name)}</td>
            ${subjects.map((subject) => {
              const mark = getMark(row.student.id, assessment, subject);
              return `<td class="number">${displayScore(mark)}</td><td class="number">${gradeBadge(mark.grade || mark.status)}</td>`;
            }).join('')}
            <td class="number">${row.total}</td>
            <td class="number">${row.average.toFixed(1)}</td>
            <td class="number">${gradeBadge(row.averageGrade)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <h3 style="margin-top:18px">Murid Terbaik Mengikut Subjek</h3>
    <table>
      <thead>
        <tr>
          <th class="number">Bil</th>
          <th>Subjek</th>
          <th>Nama Murid</th>
          <th class="number">Markah</th>
          <th class="number">Gred</th>
          <th>Pencapaian</th>
        </tr>
      </thead>
      <tbody>
        ${topBySubject.map((item, index) => `
          <tr>
            <td class="number">${index + 1}</td>
            <td>${escapeHtml(item.subject)}</td>
            <td>${escapeHtml(item.student.name)}</td>
            <td class="number">${item.score}</td>
            <td class="number">${gradeBadge(item.grade)}</td>
            <td>${escapeHtml(interpretGrade(item.grade))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderSubjectAnalysis() {
  const assessment = $('#subjectAssessment').value;
  const className = $('#subjectClass').value;
  const subject = $('#subjectName').value;
  const classes = allClasses();
  const years = allStreams();
  const records = studentsInClass(className).map((student) => getMark(student.id, assessment, subject));
  const selectedDistribution = gradeDistribution(records);
  const classBreakdown = classes.map((itemClass) => ({
    label: itemClass,
    distribution: gradeDistribution(studentsInClass(itemClass).map((student) => getMark(student.id, assessment, subject)))
  }));
  const yearBreakdown = years.map((year) => {
    const yearStudents = state.students.filter((student) => student.className.startsWith(year));
    return {
      label: `Tahun ${year}`,
      distribution: gradeDistribution(yearStudents.map((student) => getMark(student.id, assessment, subject)))
    };
  });
  const assessed = records.filter((record) => isNumeric(record.score));
  const stats = {
    pass: percentage(assessed.filter((record) => Number(record.score) >= 17).length, assessed.length),
    fail: percentage(assessed.filter((record) => Number(record.score) < 17).length, assessed.length),
    excellent: selectedDistribution.A.percent,
    absent: selectedDistribution.TH.percent
  };

  $('#subjectPrint').innerHTML = `
    ${reportHeader('Analisis Subjek', `${assessment || '-'} | ${className || '-'} | ${subject || '-'}`)}
    <div class="stats-grid grid grid-cols-2">
      ${statBox('Peratus Lulus', `${stats.pass}%`)}
      ${statBox('Peratus Gagal', `${stats.fail}%`)}
      ${statBox('Gred A', `${stats.excellent}%`)}
      ${statBox('Gred TH', `${stats.absent}%`)}
    </div>
    <h3>Taburan Gred Kelas Dipilih</h3>
    <table>
      <thead>
        <tr>
          <th>Gred</th>
          <th class="number">Bilangan</th>
          <th class="number">Peratus</th>
        </tr>
      </thead>
      <tbody>
        ${distributionSummary(selectedDistribution).map((item) => `
          <tr>
            <td>${gradeBadge(item.grade)}</td>
            <td class="number">${item.count}</td>
            <td class="number">${item.percent}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <h3 style="margin-top:18px">Analisis Mengikut Kelas</h3>
    ${distributionTable(classBreakdown, 'Kelas')}
    <h3 style="margin-top:18px">Analisis Mengikut Tahun</h3>
    ${distributionTable(yearBreakdown, 'Tahun')}
    <h3 style="margin-top:18px">Carta Gred Subjek Kelas Dipilih</h3>
    ${barChart(distributionSummary(selectedDistribution).map((item) => ({ label: item.grade, value: item.count, percent: item.percent })))}
    <h3 style="margin-top:18px">Carta Mengikut Kelas</h3>
    ${stackedDistributionChart(classBreakdown)}
  `;
}

function renderOverallAnalysis() {
  const assessment = $('#overallAssessment').value;
  const stream = $('#overallStream').value;
  const classes = allClasses().filter((className) => className.startsWith(stream));
  const subjects = selectedSubjects(assessment);
  const rows = subjects.map((subject) => {
    const records = state.students
      .filter((student) => classes.includes(student.className))
      .map((student) => getMark(student.id, assessment, subject));
    const assessed = records.filter((record) => isNumeric(record.score));
    const average = assessed.length ? assessed.reduce((sum, record) => sum + Number(record.score), 0) / assessed.length : 0;
    return {
      subject,
      average,
      grade: assessed.length ? gradeFromScore(average) : 'TH',
      distribution: gradeDistribution(records)
    };
  });
  const classRows = classes.map((itemClass) => {
    const records = studentsInClass(itemClass).flatMap((student) => subjects.map((subject) => getMark(student.id, assessment, subject)));
    return { label: itemClass, distribution: gradeDistribution(records) };
  });

  $('#overallPrint').innerHTML = `
    ${reportHeader('Analisis Keseluruhan', `${assessment || '-'} | Aliran Tahun ${stream || '-'}`)}
    <h3>Analisis Nilai Gred Setiap Subjek</h3>
    <table>
      <thead>
        <tr>
          <th>Subjek</th>
          <th class="number">Purata</th>
          <th class="number">Gred Nilai</th>
          ${GRADE_KEYS.map((grade) => `<th class="number">${grade}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${escapeHtml(row.subject)}</td>
            <td class="number">${row.average.toFixed(1)}</td>
            <td class="number">${gradeBadge(row.grade)}</td>
            ${distributionCountCells(row.distribution)}
          </tr>
        `).join('')}
      </tbody>
    </table>
    <h3 style="margin-top:18px">Analisis Mengikut Kelas Dalam Tahun ${escapeHtml(stream || '-')}</h3>
    ${distributionTable(classRows, 'Kelas')}
    <h3 style="margin-top:18px">Carta Taburan Gred Mengikut Subjek</h3>
    ${stackedDistributionChart(rows.map((row) => ({ label: row.subject, distribution: row.distribution })))}
    <h3 style="margin-top:18px">Carta Taburan Gred Mengikut Kelas</h3>
    ${stackedDistributionChart(classRows)}
  `;
}

function renderReports() {
  const className = state.role === 'parent' ? state.parentStudent.className : $('#reportClass').value;
  const assessment = $('#reportAssessment').value;
  if (state.role === 'parent') $('#reportClass').value = className;
  const students = state.role === 'parent' ? [state.parentStudent] : studentsInClass(className);
  const classRows = buildClassPerformance(className, assessment);
  const streamRows = buildStreamPerformance(className, assessment);
  const subjects = selectedSubjects(assessment);

  $('#reportPrint').innerHTML = students.map((student) => {
    const classPerf = classRows.find((row) => row.student.id === student.id) || blankPerformance(student);
    const streamPerf = streamRows.find((row) => row.student.id === student.id) || blankPerformance(student);
    const attendance = getAttendance(student.id, assessment).percentage ?? '';
    const availableSubjects = subjects
      .map((subject) => ({ subject, mark: getMark(student.id, assessment, subject) }))
      .filter((item) => isNumeric(item.mark.score) || item.mark.status);
    const percentMark = availableSubjects.length ? (classPerf.total / (availableSubjects.length * 70)) * 100 : 0;

    return `
      <article class="slip jawi">
        <div class="slip-header text-center">
          <img src="${CONFIG.crestUrl}" alt="Lencana سكوله رنده اݢام رعيت النور">
          <h2>${toJawi(CONFIG.schoolName)}</h2>
          <h3>${toJawi(assessment)}</h3>
        </div>
        <table class="slip-info-table">
          <tbody>
            <tr>
              <td><span>نام موريد</span><strong>${toJawi(student.name)}</strong></td>
              <td><span>كلس</span><strong>${toJawi(className)}</strong></td>
              <td><span>تاهون</span><strong>${CURRENT_REPORT_YEAR}</strong></td>
            </tr>
          </tbody>
        </table>
        <h3>معلومت ڤنچاڤاين</h3>
        <table>
          <thead>
            <tr>
              <th class="number">بيل</th>
              <th>مات ڤلاجرن</th>
              <th class="number">مركه</th>
              <th class="number">ڬريد</th>
            </tr>
          </thead>
          <tbody>
            ${availableSubjects.map((item, index) => `
              <tr>
                <td class="number">${index + 1}</td>
                <td>${toJawi(item.subject)}</td>
                <td class="number">${displayScore(item.mark)}</td>
                <td class="number">${item.mark.grade || item.mark.status || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <h3>ڤنچاڤاين كسلوروهن</h3>
        <table class="overall-slip-table">
          <tbody>
            <tr>
              <th>كدودوقن دالم كلس</th>
              <td>${classPerf.rank || '-'}</td>
              <th>كدودوقن دالم درجه</th>
              <td>${streamPerf.rank || '-'}</td>
            </tr>
            <tr>
              <th>كحاضيرن</th>
              <td>${attendance === '' ? '-' : `${attendance}%`}</td>
              <th>جومله مركه</th>
              <td>${classPerf.total}</td>
            </tr>
            <tr>
              <th>ڤراتوس</th>
              <td>${percentMark.toFixed(1)}%</td>
              <th>ڬريد</th>
              <td>${classPerf.averageGrade || '-'}</td>
            </tr>
          </tbody>
        </table>
        <div class="teacher-comment">
          <strong>اولسن ڬورو:</strong>
          <span>${autoCommentJawi(classPerf.averageGrade, classPerf.average)}</span>
        </div>
        <table class="signature-table">
          <tbody>
            <tr>
              <td>${signatureBlock(state.signatures.headTeacher, 'تندا تاڠن ڬورو بسر', state.signatures.headTeacherName)}</td>
              <td>${signatureBlock(state.signatures.teacher, 'تندا تاڠن ڬورو', state.signatures.teacherName)}</td>
              <td>${signatureBlock('', 'تندا تاڠن ڤنجاڬ', '')}</td>
            </tr>
          </tbody>
        </table>
      </article>
    `;
  }).join('') || empty('Tiada slip untuk dipaparkan.');
}

function buildClassPerformance(className, assessment) {
  const subjects = selectedSubjects(assessment);
  const rows = studentsInClass(className).map((student) => {
    const scores = subjects.map((subject) => getMark(student.id, assessment, subject).score).filter(isNumeric).map(Number);
    const total = scores.reduce((sum, score) => sum + score, 0);
    const average = scores.length ? total / scores.length : 0;
    return { student, total, average, averageGrade: scores.length ? gradeFromScore(average) : '', rank: '-' };
  });
  return rankRows(rows);
}

function buildStreamPerformance(className, assessment) {
  const stream = String(className || '').match(/^\d+/)?.[0] || '';
  const subjects = selectedSubjects(assessment);
  const rows = state.students
    .filter((student) => student.className.startsWith(stream))
    .map((student) => {
      const scores = subjects.map((subject) => getMark(student.id, assessment, subject).score).filter(isNumeric).map(Number);
      const total = scores.reduce((sum, score) => sum + score, 0);
      const average = scores.length ? total / scores.length : 0;
      return { student, total, average, averageGrade: scores.length ? gradeFromScore(average) : '', rank: '-' };
    });
  return rankRows(rows);
}

function rankRows(rows) {
  const sorted = [...rows].sort((a, b) => b.average - a.average || b.total - a.total || a.student.name.localeCompare(b.student.name));
  sorted.forEach((row, index) => {
    row.rank = row.average > 0 ? index + 1 : '-';
  });
  return sorted;
}

function bestForSubject(className, assessment, subject) {
  const candidates = studentsInClass(className)
    .map((student) => ({ student, subject, ...getMark(student.id, assessment, subject) }))
    .filter((item) => isNumeric(item.score))
    .sort((a, b) => Number(b.score) - Number(a.score));
  return candidates[0] || null;
}

function selectedSubjects(assessment) {
  if (assessment && state.assessmentSubjects[assessment]?.length) return state.assessmentSubjects[assessment];
  return state.subjects.length ? state.subjects : unique(state.marks.filter((mark) => mark.assessment === assessment).map((mark) => mark.subject));
}

function studentsInClass(className) {
  return state.students.filter((student) => student.className === className).sort((a, b) => a.name.localeCompare(b.name));
}

function allClasses() {
  return unique(state.students.map((student) => student.className)).sort(classSorter);
}

function allStreams() {
  return unique(allClasses().map((className) => String(className).match(/^\d+/)?.[0]).filter(Boolean)).sort();
}

function getMark(studentId, assessment, subject) {
  return state.marks.find((mark) => mark.studentId === studentId && mark.assessment === assessment && mark.subject === subject) || {};
}

function getAttendance(studentId, assessment = '') {
  return state.attendance.find((item) => item.studentId === studentId && item.assessment === assessment)
    || state.attendance.find((item) => item.studentId === studentId && !item.assessment)
    || {};
}

function gradeFromScore(score) {
  if (!isNumeric(score)) return '';
  const value = Number(score);
  if (value >= 53) return 'A';
  if (value >= 35) return 'B';
  if (value >= 17) return 'C';
  return 'D';
}

function interpretGrade(grade, status = '') {
  if (status === 'TD' || grade === 'TD') return 'Tidak Daftar';
  if (status === 'TH' || grade === 'TH') return 'Tidak Hadir';
  return { A: 'Cemerlang', B: 'Baik', C: 'Memuaskan', D: 'Perlu Bimbingan' }[grade] || 'Belum Ditaksir';
}

function gradeBadge(grade) {
  if (!grade) return '<span class="pill">-</span>';
  const css = String(grade).toLowerCase().replace('/', '');
  return `<span class="pill ${css}">${escapeHtml(grade)}</span>`;
}

function gradeDistribution(records) {
  const base = Object.fromEntries(GRADE_KEYS.map((grade) => [grade, 0]));
  records.forEach((record) => {
    base[recordGrade(record)] += 1;
  });
  const total = records.length || 1;
  return Object.fromEntries(Object.entries(base).map(([grade, count]) => [grade, { count, percent: percentage(count, total) }]));
}

function recordGrade(record = {}) {
  if (record.status === 'TH' || record.status === 'TD') return 'TH';
  if (['A', 'B', 'C', 'D'].includes(record.grade)) return record.grade;
  if (isNumeric(record.score)) return gradeFromScore(record.score);
  return 'TH';
}

function distributionSummary(distribution) {
  return GRADE_KEYS.map((grade) => ({
    grade,
    count: distribution[grade]?.count || 0,
    percent: distribution[grade]?.percent || 0
  }));
}

function reportHeader(title, subtitle) {
  return `
    <div class="report-title mb-4">
      <div>
        <p class="eyebrow">${CONFIG.schoolName}</p>
        <h2>${escapeHtml(title)}</h2>
        <small>${escapeHtml(subtitle)}</small>
      </div>
      <img src="${CONFIG.crestUrl}" alt="Lencana سكوله رنده اݢام رعيت النور">
    </div>
  `;
}

function statBox(label, value) {
  return `<div class="stat-box"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function barChart(items) {
  return `
    <div class="chart">
      ${items.map((item) => `
        <div class="bar-row">
          <strong>${escapeHtml(item.label)}</strong>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, Number(item.percent) || 0))}%"></div></div>
          <span>${escapeHtml(item.value)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function distributionTable(rows, firstColumnLabel) {
  return `
    <table>
      <thead>
        <tr>
          <th>${escapeHtml(firstColumnLabel)}</th>
          ${GRADE_KEYS.map((grade) => `<th class="number">${grade}</th>`).join('')}
          <th class="number">Jumlah</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${escapeHtml(row.label)}</td>
            ${distributionCountCells(row.distribution)}
            <td class="number">${distributionTotal(row.distribution)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function distributionCountCells(distribution) {
  return GRADE_KEYS.map((grade) => {
    const item = distribution[grade] || { count: 0, percent: 0 };
    return `<td class="number">${item.count}<br><small>${item.percent}%</small></td>`;
  }).join('');
}

function distributionTotal(distribution) {
  return GRADE_KEYS.reduce((total, grade) => total + (distribution[grade]?.count || 0), 0);
}

function stackedDistributionChart(rows) {
  return `
    <div class="stacked-chart">
      ${rows.map((row) => {
        const total = distributionTotal(row.distribution) || 1;
        return `
          <div class="stacked-row">
            <div class="stacked-label">${escapeHtml(row.label)}</div>
            <div class="stacked-track">
              ${GRADE_KEYS.map((grade) => {
                const count = row.distribution[grade]?.count || 0;
                if (!count) return '';
                const width = (count / total) * 100;
                const label = count > 0 ? `${grade} ${count}` : '';
                return `<div class="stack-segment grade-${grade.toLowerCase()}" style="width:${width}%" title="${grade}: ${count}">${label}</div>`;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function printReport() {
  const activePage = $('.tab-page.active');
  const source = $('.print-content', activePage) || $('.print-content');
  if (!source) {
    showToast('Tiada kandungan untuk dicetak.', 'error');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showToast('Popup cetakan disekat oleh pelayar.', 'error');
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html lang="ms">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Laporan سكوله رنده اݢام رعيت النور</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
        * { box-sizing: border-box; }
        body { margin: 0; background: #f3f4f6; color: #111827; font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.45; }
        .a4-container { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 16mm; background: #fff; }
        h1, h2, h3 { margin: 0 0 10px; line-height: 1.2; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; page-break-inside: auto; }
        th, td { border: 1px solid #d1d5db; padding: 7px 8px; text-align: left; vertical-align: top; }
        th { background: #eef7f5; font-weight: 700; }
        tr { page-break-inside: avoid; page-break-after: auto; }
        .text-center { text-align: center; }
        .mb-4 { margin-bottom: 1rem; }
        .mt-4 { margin-top: 1rem; }
        .grid { display: grid; gap: 12px; }
        .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .report-title { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f766e; padding-bottom: 10px; margin-bottom: 16px; }
        .report-title img { width: 52px; height: 52px; object-fit: contain; }
        .pill { display: inline-block; min-width: 34px; border-radius: 999px; padding: 2px 7px; text-align: center; background: #eef2f7; font-weight: 700; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 12px 0; }
        .stat-box { border: 1px solid #d1d5db; padding: 10px; }
        .chart { display: grid; gap: 7px; }
        .bar-row { display: grid; grid-template-columns: 95px 1fr 55px; gap: 8px; align-items: center; }
        .bar-track { height: 18px; background: #e5e7eb; }
        .bar-fill { height: 100%; background: #0f766e; }
        .stacked-chart { display: grid; gap: 9px; margin: 12px 0; }
        .stacked-row { display: grid; grid-template-columns: 120px 1fr; gap: 8px; align-items: center; }
        .stacked-track { display: flex; min-height: 22px; overflow: hidden; background: #e5e7eb; }
        .stack-segment { display: grid; place-items: center; min-width: 18px; color: #fff; font-size: 9pt; font-weight: 700; }
        .grade-a { background: #047857; } .grade-b { background: #2563eb; } .grade-c { background: #b7791f; } .grade-d { background: #dc2626; } .grade-th { background: #64748b; }
        .slip { page-break-after: always; min-height: 270mm; padding: 0; margin-bottom: 18mm; }
        .slip-header { display: grid; justify-items: center; gap: 5px; border-bottom: 2px solid #0f766e; padding-bottom: 10px; margin-bottom: 14px; }
        .slip-header img { width: 54px; height: 54px; object-fit: contain; }
        .slip table { min-width: 0; }
        .slip-info-table { table-layout: fixed; }
        .slip-info-table td { text-align: center; }
        .slip-info-table span { display: block; color: #6b7280; font-weight: 700; margin-bottom: 3px; }
        .slip-info-table strong { display: block; color: #111827; line-height: 1.35; }
        .jawi { direction: rtl; text-align: right; font-family: "Noto Naskh Arabic", "Geeza Pro", "Al Bayan", serif; font-feature-settings: "liga" 1, "calt" 1; }
        .slip-meta, .signature-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; }
        .signature-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 36px; }
        .signature-table { min-width: 0; margin-top: 26px; }
        .signature-table td { width: 33.333%; text-align: center; vertical-align: bottom; height: 86px; }
        .signature-preview { display: block; max-width: 130px; max-height: 54px; object-fit: contain; margin: 0 auto 5px; }
        .teacher-comment { border: 1px solid #d1d5db; padding: 9px 10px; margin-top: 10px; }
        .signature-line { border-top: 1px solid #111827; padding-top: 8px; text-align: center; min-height: 48px; }
        .signature-line strong, .signature-line span { display: block; }
        .signature-line strong { min-height: 18px; font-family: Arial, sans-serif; font-size: 10pt; }
        .signature-line span { margin-top: 3px; }
        @page { size: A4; margin: 12mm; }
        @media print {
          body { background: #fff; }
          .a4-container { width: 210mm; min-height: 297mm; margin: 0; padding: 0; box-shadow: none; }
          .grid, .grid-cols-2, .grid-cols-3, .stats-grid, .slip-meta, .signature-grid { grid-template-columns: 1fr; }
          .slip { page-break-after: always; }
        }
        @media (max-width: 720px) {
          .a4-container { width: 100%; min-height: auto; padding: 18px; }
          .grid-cols-2, .grid-cols-3, .stats-grid, .slip-meta, .signature-grid { grid-template-columns: 1fr; }
          table { font-size: 0.9rem; }
        }
      </style>
    </head>
    <body>
      <main class="a4-container">${source.innerHTML}</main>
    </body>
    </html>
  `);
  printWindow.document.close();
  const fontsReady = printWindow.document.fonts?.ready || Promise.resolve();
  fontsReady.finally(() => setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 150));
}

window.printReport = printReport;
globalThis.printReport = printReport;

async function fetchCsv(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`CSV gagal dimuatkan: ${response.status}`);
  return parseCsv(await response.text());
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((item) => item.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((item) => item.trim() !== '')) rows.push(row);
  return stripHeader(rows);
}

function stripHeader(rows) {
  const first = rows[0]?.map((cell) => clean(cell).toLowerCase()) || [];
  if (first.some((cell) => cell.includes('nama') || cell.includes('kelas') || cell.includes('pentaksiran'))) {
    return rows.slice(1);
  }
  return rows;
}

async function apiGet(action) {
  const url = `${CONFIG.appScriptUrl}?action=${encodeURIComponent(action)}&t=${Date.now()}`;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('Apps Script GET gagal');
  return response.json();
}

async function apiPost(action, payload) {
  const body = JSON.stringify({ action, ...payload });
  try {
    const response = await fetch(CONFIG.appScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body
    });
    if (response.ok) return response.json().catch(() => ({ ok: true }));
  } catch {
    await fetch(CONFIG.appScriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body
    }).catch(() => null);
  }
  return { ok: true, localOnly: true };
}

function hydrateLocalData() {
  const staticData = readJson(STORAGE_KEYS.static);
  const records = readJson(STORAGE_KEYS.records);
  const signatures = readJson(STORAGE_KEYS.signatures);
  if (staticData.students?.length) state.students = staticData.students;
  if (staticData.assessments?.length) state.assessments = staticData.assessments;
  if (staticData.subjects?.length) state.subjects = staticData.subjects;
  if (staticData.assessmentSubjects) state.assessmentSubjects = staticData.assessmentSubjects;
  if (records.marks?.length) state.marks = records.marks;
  if (records.attendance?.length) state.attendance = records.attendance;
  if (signatures.headTeacher || signatures.teacher) state.signatures = { ...state.signatures, ...signatures };
  if (signatures.headTeacherName || signatures.teacherName) state.signatures = { ...state.signatures, ...signatures };
  if ($('#headTeacherNameInput')) $('#headTeacherNameInput').value = state.signatures.headTeacherName || '';
  if ($('#teacherNameInput')) $('#teacherNameInput').value = state.signatures.teacherName || '';
}

function persistStaticData() {
  localStorage.setItem(STORAGE_KEYS.static, JSON.stringify({
    students: state.students,
    assessments: state.assessments,
    subjects: state.subjects,
    assessmentSubjects: state.assessmentSubjects
  }));
}

function persistRecords() {
  localStorage.setItem(STORAGE_KEYS.records, JSON.stringify({
    marks: state.marks,
    attendance: state.attendance
  }));
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

function mergeByKey(existing, incoming, keyFn) {
  const map = new Map(existing.map((item) => [keyFn(item), item]));
  incoming.forEach((item) => map.set(keyFn(item), item));
  return Array.from(map.values());
}

function markKey(mark) {
  return `${mark.studentId}|${mark.assessment}|${mark.subject}`;
}

function attendanceKey(attendance) {
  return `${attendance.studentId}|${attendance.assessment || ''}`;
}

function displayScore(mark) {
  if (mark.status) return mark.status;
  if (isNumeric(mark.score)) return mark.score;
  return '-';
}

function signatureImage(source) {
  if (!source) return '';
  return `<img class="signature-preview" src="${escapeHtml(source)}" alt="Tandatangan">`;
}

function signatureBlock(source, label, name) {
  const displayName = clean(name);
  return `
    ${signatureImage(source)}
    <div class="signature-line">
      <strong>${escapeHtml(displayName || '-')}</strong>
      <span>${label}</span>
    </div>
  `;
}

function blankPerformance(student) {
  return { student, total: 0, average: 0, averageGrade: '', rank: '-' };
}

function autoComment(grade, average) {
  if (grade === 'A') return 'Tahniah atas pencapaian cemerlang. Teruskan usaha dan kekalkan disiplin pembelajaran.';
  if (grade === 'B') return 'Pencapaian baik. Tingkatkan latihan supaya keputusan menjadi lebih mantap.';
  if (grade === 'C') return 'Pencapaian memuaskan. Perlu lebih fokus dan bimbingan berterusan.';
  if (grade === 'D' || average > 0) return 'Murid perlu bimbingan rapi dan latihan tambahan secara konsisten.';
  return 'Keputusan belum lengkap untuk ulasan menyeluruh.';
}

function autoCommentJawi(grade, average) {
  if (grade === 'A') return 'تهنيه اتس ڤنچاڤاين چمرلڠ. تروسكن اوسها دان ككلكن ديسيڤلين ڤمبلاجرن.';
  if (grade === 'B') return 'ڤنچاڤاين باءيق. تيڠكتكن لاتيهن سوڤايا كڤوتوسن منجادي لبيه منتڤ.';
  if (grade === 'C') return 'ڤنچاڤاين ممواسكن. ڤرلو لبيه فوكوس دان بيمبيڠن برتروسن.';
  if (grade === 'D' || average > 0) return 'موريد ڤرلو بيمبيڠن راڤي دان لاتيهن تمبهن سچارا كونسستن.';
  return 'كڤوتوسن بلوم لڠكڤ اونتوق اولسن منيلوروه.';
}

function toJawi(text) {
  const value = String(text || '-').trim();
  const dictionary = {
    'SEKOLAH RENDAH AGAMA RAKYAT AN NUR': 'سكوله رنده اݢام رعيت النور',
    'AL-QURAN': 'القرءان',
    'AL QURAN': 'القرءان',
    'JAWI': 'جاوي',
    'JAWI / KHAT': 'جاوي / خط',
    'BAHASA MELAYU': 'بهاس ملايو',
    'BAHASA INGGERIS': 'بهاس ايڠݢريس',
    'BAHASA ARAB': 'بهاس عرب',
    'MATEMATIK': 'ماتماتيك',
    'SAINS': 'ساءينس',
    'SEJARAH': 'سجاره',
    'TAHFIZ': 'تحفيظ',
    'HADIS': 'حديث',
    'TAFSIR': 'تفسير',
    'FEKAH': 'فقه',
    'FIQH': 'فقه',
    'TAUHID': 'توحيد',
    'SIRAH': 'سيره',
    'AKHLAK': 'اخلاق',
    'ADAB': 'ادب',
    'TAJWID': 'تجويد',
    'TAHUN': 'تاهون'
  };
  const upper = value.toUpperCase();
  if (dictionary[upper]) return dictionary[upper];
  return value
    .replace(/nya/gi, 'ڽ')
    .replace(/Tahun/gi, 'تاهون')
    .replace(/Kelas/gi, 'كلس')
    .replace(/Pentaksiran/gi, 'ڤنتكسيرن')
    .replace(/Ujian/gi, 'اوجين')
    .replace(/Peperiksaan/gi, 'ڤڤريقساءن')
    .replace(/Akhir/gi, 'اخير')
    .replace(/Pertengahan/gi, 'ڤرتڠهن');
}

function yearFromClass(className) {
  const year = String(className || '').match(/^\d+/)?.[0] || '-';
  return year === '-' ? '-' : `Tahun ${year}`;
}

function normalizeIc(value) {
  return String(value || '').replace(/\D/g, '');
}

function looksLikeClass(value) {
  return /^\s*\d+\s+[A-Z0-9]/i.test(String(value || ''));
}

function clean(value) {
  return String(value || '').trim();
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => value !== undefined && value !== null && String(value).trim() !== '')));
}

function classSorter(a, b) {
  return String(a).localeCompare(String(b), 'ms', { numeric: true });
}

function isNumeric(value) {
  return value !== '' && value !== null && value !== undefined && !Number.isNaN(Number(value));
}

function clampScore(value) {
  if (!isNumeric(value)) return '';
  return clamp(value, 0, 70);
}

function clamp(value, min, max) {
  if (!isNumeric(value)) return '';
  return Math.max(min, Math.min(max, Number(value)));
}

function percentage(count, total) {
  if (!total) return 0;
  return Number(((count / total) * 100).toFixed(1));
}

function empty(message) {
  return `<div class="empty">${escapeHtml(message)}</div>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function showToast(message, type = 'success') {
  const toast = $('#toast');
  toast.textContent = message;
  toast.style.background = type === 'error' ? '#7f1d1d' : '#12201d';
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 3600);
}

function showStatusPopup(title, message, type = 'success') {
  const modal = $('#statusModal');
  if (!modal) return;

  $('#statusModalTitle').textContent = title;
  $('#statusModalMessage').textContent = message;
  const icon = $('#statusModalIcon');
  icon.textContent = type === 'error' ? '!' : '✓';
  icon.classList.toggle('error', type === 'error');
  modal.classList.remove('hidden');
}

function hideStatusPopup() {
  const modal = $('#statusModal');
  if (modal) modal.classList.add('hidden');
}

const SHEET_ID = '1pQcV5ixSCcM9HbWfzbRrksyptETGBsHow05-2q_lVKI';
const SHEET_MARKAH = 'MARKAH';
const SHEET_KEHADIRAN = 'KEHADIRAN';

function doGet(e) {
  const action = (e.parameter.action || '').trim();
  if (action === 'getRecords') {
    return jsonOutput({
      ok: true,
      marks: readObjects_(SHEET_MARKAH),
      attendance: readObjects_(SHEET_KEHADIRAN)
    });
  }
  return jsonOutput({ ok: true, message: 'Sistem Analisis Markah API aktif.' });
}

function doPost(e) {
  const body = JSON.parse((e.postData && e.postData.contents) || '{}');
  if (body.action === 'saveMarks') {
    upsertObjects_(SHEET_MARKAH, body.marks || [], ['studentId', 'assessment', 'subject']);
    return jsonOutput({ ok: true, saved: (body.marks || []).length });
  }
  if (body.action === 'saveAttendance') {
    upsertObjects_(SHEET_KEHADIRAN, body.attendance || [], ['studentId', 'assessment']);
    return jsonOutput({ ok: true, saved: (body.attendance || []).length });
  }
  return jsonOutput({ ok: false, error: 'Action tidak dikenali.' });
}

function jsonOutput(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function readObjects_(sheetName) {
  const sheet = ensureSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(row => row.some(cell => cell !== '')).map(row => {
    const object = {};
    headers.forEach((header, index) => object[header] = row[index]);
    return object;
  });
}

function upsertObjects_(sheetName, records, keyFields) {
  if (!records.length) return;
  const sheet = ensureSheet_(sheetName);
  const existing = readObjects_(sheetName);
  const headers = Array.from(new Set([
    ...keyFields,
    ...Object.keys(records[0]),
    ...Object.keys(existing[0] || {})
  ]));

  const byKey = new Map(existing.map(record => [buildKey_(record, keyFields), record]));
  records.forEach(record => byKey.set(buildKey_(record, keyFields), record));

  const output = [headers].concat(Array.from(byKey.values()).map(record => headers.map(header => record[header] ?? '')));
  sheet.clearContents();
  sheet.getRange(1, 1, output.length, headers.length).setValues(output);
  sheet.setFrozenRows(1);
}

function buildKey_(record, keyFields) {
  return keyFields.map(field => String(record[field] || '').trim()).join('|');
}

function ensureSheet_(sheetName) {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
  return sheet;
}

const XLSX = require('xlsx');
const { extractEmails } = require('./extractEmails');

/**
 * Scan all cells across all sheets for email addresses.
 * @param {Buffer} buffer
 * @returns {{ found: string[], count: number }}
 */
const parseExcel = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const chunks = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    for (const row of rows) {
      for (const cell of row) {
        if (cell != null && cell !== '') {
          chunks.push(String(cell));
        }
      }
    }
  }

  return extractEmails(chunks.join(' '));
};

module.exports = { parseExcel };

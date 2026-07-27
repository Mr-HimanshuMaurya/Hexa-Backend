const { parse } = require('csv-parse/sync');
const { extractEmails } = require('./extractEmails');

/**
 * Parse CSV buffer and extract emails from all cells.
 * @param {Buffer} buffer
 * @returns {{ found: string[], count: number }}
 */
const parseCsv = (buffer) => {
  const text = buffer.toString('utf-8');
  let records;

  try {
    records = parse(text, {
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch {
    // Fall back to raw text extraction if CSV parse fails
    return extractEmails(text);
  }

  const chunks = [];
  for (const row of records) {
    for (const cell of row) {
      if (cell != null && cell !== '') {
        chunks.push(String(cell));
      }
    }
  }

  return extractEmails(chunks.join(' '));
};

module.exports = { parseCsv };

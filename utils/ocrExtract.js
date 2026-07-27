const Tesseract = require('tesseract.js');
const { extractEmails } = require('./extractEmails');

/**
 * OCR an image buffer and extract emails from recognized text.
 * @param {Buffer} buffer
 * @returns {Promise<{ found: string[], count: number, rawText: string }>}
 */
const ocrExtract = async (buffer) => {
  const { data } = await Tesseract.recognize(buffer, 'eng', {
    logger: () => {},
  });

  const rawText = data.text || '';
  const result = extractEmails(rawText);
  return { ...result, rawText };
};

module.exports = { ocrExtract };

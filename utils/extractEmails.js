const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Extract unique emails from raw text via regex.
 * @param {string} text
 * @returns {{ found: string[], count: number }}
 */
const extractEmails = (text = '') => {
  const matches = text.match(EMAIL_REGEX) || [];
  const found = [...new Set(matches.map((e) => e.toLowerCase().trim()))];
  return { found, count: found.length };
};

module.exports = { extractEmails, EMAIL_REGEX };

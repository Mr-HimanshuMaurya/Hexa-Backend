const crypto = require('crypto');
const axios = require('axios');
const ApiKey = require('../models/ApiKey');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

const getEncryptionKey = () => {
  const raw = process.env.ENCRYPTION_KEY || 'hexa_encryption_key_32chars!!';
  return crypto.createHash('sha256').update(raw).digest();
};

const encrypt = (text) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};

const decrypt = (text) => {
  try {
    const [ivHex, encrypted] = text.split(':');
    if (!ivHex || !encrypted) return text; // plain key fallback
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return text; // already plain
  }
};

const isSameDay = (dateA, dateB) => {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

/**
 * Reset usedToday for keys whose lastResetDate is not today.
 */
const resetDailyQuotasIfNeeded = async () => {
  const keys = await ApiKey.find({ isActive: true });
  const now = new Date();

  for (const key of keys) {
    if (!key.lastResetDate || !isSameDay(key.lastResetDate, now)) {
      key.usedToday = 0;
      key.lastResetDate = now;
      await key.save();
    }
  }
};

/**
 * Pick the first active key with remaining daily quota.
 * @returns {Promise<{ keyDoc: object, plainKey: string } | null>}
 */
const getAvailableKey = async () => {
  await resetDailyQuotasIfNeeded();

  const keys = await ApiKey.find({
    isActive: true,
    senderEmail: { $exists: true, $nin: [null, ''] },
  }).sort({ usedToday: 1 });

  for (const key of keys) {
    if (key.usedToday < key.dailyLimit) {
      return { keyDoc: key, plainKey: decrypt(key.apiKey) };
    }
  }

  return null;
};

/**
 * Increment usedToday after a successful send.
 */
const incrementKeyUsage = async (keyId) => {
  await ApiKey.findByIdAndUpdate(keyId, { $inc: { usedToday: 1 } });
};

/**
 * Replace {{name}}, {{email}} placeholders in HTML/subject.
 */
const replacePlaceholders = (content, contact) => {
  return content
    .replace(/\{\{\s*name\s*\}\}/gi, contact.name || contact.email.split('@')[0])
    .replace(/\{\{\s*email\s*\}\}/gi, contact.email || '');
};

/**
 * Send a single email via Brevo transactional API with key rotation.
 * @returns {Promise<{ success: boolean, apiKeyLabel?: string, error?: string }>}
 */
const sendEmail = async ({ to, subject, htmlContent }) => {
  const available = await getAvailableKey();

  if (!available) {
    return {
      success: false,
      error: 'ALL_KEYS_EXHAUSTED',
      message: 'All API keys have reached their daily quota',
    };
  }

  const { keyDoc, plainKey } = available;

  if (!keyDoc.senderEmail?.trim()) {
    return {
      success: false,
      error: 'MISSING_SENDER_EMAIL',
      message: `API key "${keyDoc.label}" has no sender email configured`,
    };
  }

  try {
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          name: keyDoc.senderName || process.env.FROM_NAME || 'Hexa Mailer',
          email: keyDoc.senderEmail,
        },
        to: Array.isArray(to) ? to : [{ email: to.email, name: to.name || to.email }],
        subject,
        htmlContent,
      },
      {
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': plainKey,
        },
        timeout: 30000,
      }
    );

    await incrementKeyUsage(keyDoc._id);

    console.log(`[EMAIL] Sent to ${JSON.stringify(to)} via key "${keyDoc.label}" — status ${response.status}`);

    return {
      success: true,
      apiKeyLabel: keyDoc.label,
      messageId: response.data?.messageId,
    };
  } catch (error) {
    const errMsg =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Unknown Brevo error';

    console.error(`[EMAIL] Failed via key "${keyDoc.label}": ${errMsg}`);

    return {
      success: false,
      apiKeyLabel: keyDoc.label,
      error: errMsg,
    };
  }
};

module.exports = {
  encrypt,
  decrypt,
  resetDailyQuotasIfNeeded,
  getAvailableKey,
  incrementKeyUsage,
  replacePlaceholders,
  sendEmail,
};

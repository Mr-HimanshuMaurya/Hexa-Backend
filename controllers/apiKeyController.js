const ApiKey = require('../models/ApiKey');
const { encrypt, decrypt, resetDailyQuotasIfNeeded } = require('../utils/email');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const maskKey = (plain) => {
  if (!plain || plain.length < 8) return '****';
  return `${plain.slice(0, 4)}${'*'.repeat(Math.min(plain.length - 8, 20))}${plain.slice(-4)}`;
};

const isValidEmail = (email) => EMAIL_REGEX.test(String(email || '').trim());

const sanitizeKey = (k, plain) => {
  const hasSenderEmail = Boolean(k.senderEmail?.trim());
  return {
    _id: k._id,
    label: k.label,
    apiKeyMasked: maskKey(plain),
    senderEmail: k.senderEmail || '',
    senderName: k.senderName || process.env.FROM_NAME || 'Hexa Mailer',
    isComplete: hasSenderEmail,
    dailyLimit: k.dailyLimit,
    usedToday: k.usedToday,
    remaining: Math.max(0, k.dailyLimit - k.usedToday),
    lastResetDate: k.lastResetDate,
    isActive: k.isActive,
    createdAt: k.createdAt,
    updatedAt: k.updatedAt,
  };
};

/**
 * Deactivate keys missing senderEmail (legacy records).
 */
const deactivateIncompleteKeys = async () => {
  await ApiKey.updateMany(
    { $or: [{ senderEmail: { $exists: false } }, { senderEmail: '' }, { senderEmail: null }] },
    { $set: { isActive: false } }
  );
};

/**
 * GET /api/keys
 */
const getKeys = async (req, res, next) => {
  try {
    await resetDailyQuotasIfNeeded();
    await deactivateIncompleteKeys();
    const keys = await ApiKey.find().sort({ createdAt: -1 });

    const sanitized = keys.map((k) => {
      let plain;
      try {
        plain = decrypt(k.apiKey);
      } catch {
        plain = '****';
      }
      return sanitizeKey(k, plain);
    });

    res.json({ success: true, data: sanitized });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/keys
 */
const createKey = async (req, res, next) => {
  try {
    const { label, apiKey, senderEmail, senderName, dailyLimit } = req.body;

    if (!label || !apiKey) {
      return res.status(400).json({ success: false, message: 'Label and API key are required' });
    }

    if (!senderEmail?.trim()) {
      return res.status(400).json({ success: false, message: 'Sender email is required' });
    }

    if (!isValidEmail(senderEmail)) {
      return res.status(400).json({ success: false, message: 'Sender email must be a valid email address' });
    }

    const key = await ApiKey.create({
      label,
      apiKey: encrypt(apiKey.trim()),
      senderEmail: senderEmail.trim().toLowerCase(),
      senderName: senderName?.trim() || process.env.FROM_NAME || 'Hexa Mailer',
      dailyLimit: dailyLimit || 300,
      usedToday: 0,
      lastResetDate: new Date(),
      isActive: true,
    });

    res.status(201).json({
      success: true,
      data: sanitizeKey(key, apiKey.trim()),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/keys/:id
 */
const updateKey = async (req, res, next) => {
  try {
    const key = await ApiKey.findById(req.params.id);
    if (!key) {
      return res.status(404).json({ success: false, message: 'API key not found' });
    }

    const { label, apiKey, senderEmail, senderName, dailyLimit, isActive } = req.body;

    if (label !== undefined) key.label = label;
    if (apiKey !== undefined && apiKey.trim()) key.apiKey = encrypt(apiKey.trim());
    if (senderEmail !== undefined) {
      if (!senderEmail.trim()) {
        return res.status(400).json({ success: false, message: 'Sender email is required' });
      }
      if (!isValidEmail(senderEmail)) {
        return res.status(400).json({ success: false, message: 'Sender email must be a valid email address' });
      }
      key.senderEmail = senderEmail.trim().toLowerCase();
    }
    if (senderName !== undefined) key.senderName = senderName.trim() || process.env.FROM_NAME || 'Hexa Mailer';
    if (dailyLimit !== undefined) key.dailyLimit = dailyLimit;
    if (isActive !== undefined) {
      if (isActive && !key.senderEmail?.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Cannot activate key without a verified sender email',
        });
      }
      key.isActive = isActive;
    }

    await key.save();

    let plain;
    try {
      plain = decrypt(key.apiKey);
    } catch {
      plain = '****';
    }

    res.json({
      success: true,
      data: sanitizeKey(key, plain),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/keys/:id
 */
const deleteKey = async (req, res, next) => {
  try {
    const key = await ApiKey.findByIdAndDelete(req.params.id);
    if (!key) {
      return res.status(404).json({ success: false, message: 'API key not found' });
    }
    res.json({ success: true, message: 'API key deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getKeys, createKey, updateKey, deleteKey };

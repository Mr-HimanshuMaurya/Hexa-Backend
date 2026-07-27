const ApiKey = require('../models/ApiKey');
const { encrypt, decrypt, resetDailyQuotasIfNeeded } = require('../utils/email');

const maskKey = (plain) => {
  if (!plain || plain.length < 8) return '****';
  return `${plain.slice(0, 4)}${'*'.repeat(Math.min(plain.length - 8, 20))}${plain.slice(-4)}`;
};

/**
 * GET /api/keys
 */
const getKeys = async (req, res, next) => {
  try {
    await resetDailyQuotasIfNeeded();
    const keys = await ApiKey.find().sort({ createdAt: -1 });

    const sanitized = keys.map((k) => {
      let plain;
      try {
        plain = decrypt(k.apiKey);
      } catch {
        plain = '****';
      }
      return {
        _id: k._id,
        label: k.label,
        apiKeyMasked: maskKey(plain),
        dailyLimit: k.dailyLimit,
        usedToday: k.usedToday,
        remaining: Math.max(0, k.dailyLimit - k.usedToday),
        lastResetDate: k.lastResetDate,
        isActive: k.isActive,
        createdAt: k.createdAt,
        updatedAt: k.updatedAt,
      };
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
    const { label, apiKey, dailyLimit } = req.body;

    if (!label || !apiKey) {
      return res.status(400).json({ success: false, message: 'Label and API key are required' });
    }

    const key = await ApiKey.create({
      label,
      apiKey: encrypt(apiKey.trim()),
      dailyLimit: dailyLimit || 300,
      usedToday: 0,
      lastResetDate: new Date(),
      isActive: true,
    });

    res.status(201).json({
      success: true,
      data: {
        _id: key._id,
        label: key.label,
        apiKeyMasked: maskKey(apiKey.trim()),
        dailyLimit: key.dailyLimit,
        usedToday: 0,
        remaining: key.dailyLimit,
        isActive: true,
        createdAt: key.createdAt,
      },
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

    const { label, apiKey, dailyLimit, isActive } = req.body;

    if (label !== undefined) key.label = label;
    if (apiKey !== undefined && apiKey.trim()) key.apiKey = encrypt(apiKey.trim());
    if (dailyLimit !== undefined) key.dailyLimit = dailyLimit;
    if (isActive !== undefined) key.isActive = isActive;

    await key.save();

    let plain;
    try {
      plain = decrypt(key.apiKey);
    } catch {
      plain = '****';
    }

    res.json({
      success: true,
      data: {
        _id: key._id,
        label: key.label,
        apiKeyMasked: maskKey(plain),
        dailyLimit: key.dailyLimit,
        usedToday: key.usedToday,
        remaining: Math.max(0, key.dailyLimit - key.usedToday),
        isActive: key.isActive,
        updatedAt: key.updatedAt,
      },
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

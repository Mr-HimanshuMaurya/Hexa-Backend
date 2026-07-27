const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    apiKey: { type: String, required: true },
    dailyLimit: { type: Number, default: 300 },
    usedToday: { type: Number, default: 0 },
    lastResetDate: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ApiKey', apiKeySchema);

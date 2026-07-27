const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template', required: true },
    contactIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }],
    status: {
      type: String,
      enum: ['draft', 'sending', 'completed', 'failed', 'paused'],
      default: 'draft',
    },
    totalCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    pendingCount: { type: Number, default: 0 },
    currentIndex: { type: Number, default: 0 },
    pauseReason: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Campaign', campaignSchema);

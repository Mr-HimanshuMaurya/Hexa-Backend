const mongoose = require('mongoose');

const sendLogSchema = new mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
    contactEmail: { type: String, required: true },
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    status: {
      type: String,
      enum: ['sent', 'failed', 'pending'],
      default: 'pending',
    },
    errorMessage: { type: String, default: '' },
    apiKeyUsed: { type: String, default: '' },
    sentAt: { type: Date },
  },
  { timestamps: true }
);

sendLogSchema.index({ campaignId: 1 });

module.exports = mongoose.model('SendLog', sendLogSchema);

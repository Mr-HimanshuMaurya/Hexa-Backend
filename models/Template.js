const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    htmlContent: { type: String, required: true },
    thumbnail: { type: String, default: '' },
    logoUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Template', templateSchema);

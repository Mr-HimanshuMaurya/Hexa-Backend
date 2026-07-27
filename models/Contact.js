const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, default: '', trim: true },
    tags: [{ type: String, trim: true }],
    source: {
      type: String,
      enum: ['manual', 'excel', 'csv', 'paste', 'screenshot'],
      default: 'manual',
    },
  },
  { timestamps: true }
);

contactSchema.index({ tags: 1 });

module.exports = mongoose.model('Contact', contactSchema);

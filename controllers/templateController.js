const Template = require('../models/Template');

/**
 * GET /api/templates
 */
const getTemplates = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 12);
    const search = (req.query.search || '').trim();

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Template.countDocuments(filter);
    const templates = await Template.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      data: templates,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/templates/:id
 */
const getTemplate = async (req, res, next) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    res.json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/templates
 */
const createTemplate = async (req, res, next) => {
  try {
    const { name, subject, htmlContent, thumbnail, logoUrl } = req.body;

    if (!name || !subject || !htmlContent) {
      return res.status(400).json({
        success: false,
        message: 'Name, subject and htmlContent are required',
      });
    }

    const template = await Template.create({
      name,
      subject,
      htmlContent,
      thumbnail: thumbnail || '',
      logoUrl: logoUrl || '',
    });

    res.status(201).json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/templates/:id
 */
const updateTemplate = async (req, res, next) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    const { name, subject, htmlContent, thumbnail, logoUrl } = req.body;
    if (name !== undefined) template.name = name;
    if (subject !== undefined) template.subject = subject;
    if (htmlContent !== undefined) template.htmlContent = htmlContent;
    if (thumbnail !== undefined) template.thumbnail = thumbnail;
    if (logoUrl !== undefined) template.logoUrl = logoUrl;

    await template.save();
    res.json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/templates/:id
 */
const deleteTemplate = async (req, res, next) => {
  try {
    const template = await Template.findByIdAndDelete(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
};

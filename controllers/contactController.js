const Contact = require('../models/Contact');
const { extractEmails } = require('../utils/extractEmails');
const { parseExcel } = require('../utils/parseExcel');
const { parseCsv } = require('../utils/parseCsv');
const { ocrExtract } = require('../utils/ocrExtract');

/**
 * GET /api/contacts
 */
const getContacts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const search = (req.query.search || '').trim();
    const tag = (req.query.tag || '').trim();
    const source = (req.query.source || '').trim();

    const filter = {};
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    }
    if (tag) filter.tags = tag;
    if (source) filter.source = source;

    const total = await Contact.countDocuments(filter);
    const contacts = await Contact.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      data: contacts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/contacts — add one manually
 */
const createContact = async (req, res, next) => {
  try {
    const { email, name, tags } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const emailNorm = email.toLowerCase().trim();
    const existing = await Contact.findOne({ email: emailNorm });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Contact with this email already exists' });
    }

    const contact = await Contact.create({
      email: emailNorm,
      name: name || '',
      tags: tags || [],
      source: 'manual',
    });

    res.status(201).json({ success: true, data: contact });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/contacts/bulk — confirm import of selected emails
 */
const bulkCreateContacts = async (req, res, next) => {
  try {
    const { emails, source = 'paste', tags = [] } = req.body;

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ success: false, message: 'emails array is required' });
    }

    const normalized = [
      ...new Set(
        emails
          .map((e) => (typeof e === 'string' ? e : e.email || ''))
          .map((e) => e.toLowerCase().trim())
          .filter(Boolean)
      ),
    ];

    const existing = await Contact.find({ email: { $in: normalized } }).select('email');
    const existingSet = new Set(existing.map((c) => c.email));

    const toInsert = normalized
      .filter((email) => !existingSet.has(email))
      .map((email) => ({
        email,
        name: typeof emails.find((e) => (typeof e === 'string' ? e : e.email)?.toLowerCase() === email) === 'object'
          ? emails.find((e) => (e.email || '').toLowerCase() === email)?.name || ''
          : '',
        tags,
        source: ['manual', 'excel', 'csv', 'paste', 'screenshot'].includes(source) ? source : 'paste',
      }));

    let inserted = [];
    if (toInsert.length > 0) {
      inserted = await Contact.insertMany(toInsert, { ordered: false }).catch((err) => {
        if (err.insertedDocs) return err.insertedDocs;
        throw err;
      });
    }

    res.status(201).json({
      success: true,
      data: {
        inserted: inserted.length,
        skipped: normalized.length - toInsert.length,
        contacts: inserted,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/contacts/upload/excel — preview only
 */
const uploadExcel = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Excel file is required' });
    }

    const result = parseExcel(req.file.buffer);
    const existing = await Contact.find({ email: { $in: result.found } }).select('email');
    const existingSet = new Set(existing.map((c) => c.email));

    res.json({
      success: true,
      data: {
        found: result.found.map((email) => ({
          email,
          alreadyExists: existingSet.has(email),
        })),
        count: result.count,
        newCount: result.found.filter((e) => !existingSet.has(e)).length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/contacts/upload/csv — preview only
 */
const uploadCsv = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'CSV file is required' });
    }

    const result = parseCsv(req.file.buffer);
    const existing = await Contact.find({ email: { $in: result.found } }).select('email');
    const existingSet = new Set(existing.map((c) => c.email));

    res.json({
      success: true,
      data: {
        found: result.found.map((email) => ({
          email,
          alreadyExists: existingSet.has(email),
        })),
        count: result.count,
        newCount: result.found.filter((e) => !existingSet.has(e)).length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/contacts/upload/screenshot — preview only
 */
const uploadScreenshot = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image file is required' });
    }

    const result = await ocrExtract(req.file.buffer);
    const existing = await Contact.find({ email: { $in: result.found } }).select('email');
    const existingSet = new Set(existing.map((c) => c.email));

    res.json({
      success: true,
      data: {
        found: result.found.map((email) => ({
          email,
          alreadyExists: existingSet.has(email),
        })),
        count: result.count,
        newCount: result.found.filter((e) => !existingSet.has(e)).length,
        rawText: result.rawText,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/contacts/extract-paste — preview only
 */
const extractPaste = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, message: 'text field is required' });
    }

    const result = extractEmails(text);
    const existing = await Contact.find({ email: { $in: result.found } }).select('email');
    const existingSet = new Set(existing.map((c) => c.email));

    res.json({
      success: true,
      data: {
        found: result.found.map((email) => ({
          email,
          alreadyExists: existingSet.has(email),
        })),
        count: result.count,
        newCount: result.found.filter((e) => !existingSet.has(e)).length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/contacts/:id
 */
const deleteContact = async (req, res, next) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }
    res.json({ success: true, message: 'Contact deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/contacts/bulk
 */
const bulkDeleteContacts = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'ids array is required' });
    }

    const result = await Contact.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/contacts/all-ids — lightweight id list for bulk select
 */
const getAllContactIds = async (req, res, next) => {
  try {
    const search = (req.query.search || '').trim();
    const tag = (req.query.tag || '').trim();
    const source = (req.query.source || '').trim();

    const filter = {};
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    }
    if (tag) filter.tags = tag;
    if (source) filter.source = source;

    const ids = await Contact.find(filter).select('_id').lean();
    res.json({
      success: true,
      data: ids.map((c) => c._id.toString()),
      total: ids.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/contacts/stats — for dashboard
 */
const getContactStats = async (req, res, next) => {
  try {
    const total = await Contact.countDocuments();
    res.json({ success: true, data: { total } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getContacts,
  getAllContactIds,
  createContact,
  bulkCreateContacts,
  uploadExcel,
  uploadCsv,
  uploadScreenshot,
  extractPaste,
  deleteContact,
  bulkDeleteContacts,
  getContactStats,
};

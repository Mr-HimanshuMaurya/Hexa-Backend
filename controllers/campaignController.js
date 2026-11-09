const Campaign = require('../models/Campaign');
const Template = require('../models/Template');
const Contact = require('../models/Contact');
const SendLog = require('../models/SendLog');
const ApiKey = require('../models/ApiKey');
const { enqueueCampaign, resumeCampaign } = require('../utils/queue');
const { resetDailyQuotasIfNeeded } = require('../utils/email');

/**
 * GET /api/campaigns
 */
const getCampaigns = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);

    const total = await Campaign.countDocuments();
    const campaigns = await Campaign.find()
      .populate('templateId', 'name subject')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      data: campaigns,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/campaigns/:id
 */
const getCampaign = async (req, res, next) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate('templateId', 'name subject htmlContent')
      .populate('contactIds', 'email name');

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    res.json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/campaigns — create + start sending
 */
const createCampaign = async (req, res, next) => {
  try {
    const { name, templateId, contactIds } = req.body;

    if (!name || !templateId || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'name, templateId and contactIds (non-empty) are required',
      });
    }

    const template = await Template.findById(templateId);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    const contacts = await Contact.find({ _id: { $in: contactIds } });
    if (contacts.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid contacts found' });
    }

    await resetDailyQuotasIfNeeded();
    const activeKeys = await ApiKey.countDocuments({
      isActive: true,
      senderEmail: { $exists: true, $nin: [null, ''] },
    });
    if (activeKeys === 0) {
      return res.status(400).json({
        success: false,
        message:
          'No active API keys with a verified sender email configured. Add a Brevo key with sender email before launching a campaign.',
      });
    }

    const campaign = await Campaign.create({
      name,
      templateId,
      contactIds: contacts.map((c) => c._id),
      status: 'sending',
      totalCount: contacts.length,
      sentCount: 0,
      failedCount: 0,
      pendingCount: contacts.length,
      currentIndex: 0,
    });

    enqueueCampaign(campaign._id.toString());

    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/campaigns/:id/progress
 */
const getProgress = async (req, res, next) => {
  try {
    const campaign = await Campaign.findById(req.params.id).select(
      'name status totalCount sentCount failedCount pendingCount currentIndex pauseReason createdAt updatedAt'
    );

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const percent =
      campaign.totalCount > 0
        ? Math.round(((campaign.sentCount + campaign.failedCount) / campaign.totalCount) * 100)
        : 0;

    res.json({
      success: true,
      data: {
        ...campaign.toObject(),
        percent,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/campaigns/:id/logs
 */
const getLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const status = (req.query.status || '').trim();

    const filter = { campaignId: req.params.id };
    if (status) filter.status = status;

    const total = await SendLog.countDocuments(filter);
    const logs = await SendLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      data: logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/campaigns/:id/resume
 */
const resume = async (req, res, next) => {
  try {
    const campaign = await resumeCampaign(req.params.id);
    res.json({ success: true, data: campaign, message: 'Campaign resumed' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/campaigns/stats/dashboard
 */
const getDashboardStats = async (req, res, next) => {
  try {
    await resetDailyQuotasIfNeeded();

    const [totalContacts, totalTemplates, totalCampaigns, keys] = await Promise.all([
      Contact.countDocuments(),
      Template.countDocuments(),
      Campaign.countDocuments(),
      ApiKey.find({ isActive: true }),
    ]);

    const emailsSentToday = keys.reduce((sum, k) => sum + (k.usedToday || 0), 0);
    const totalQuota = keys.reduce((sum, k) => sum + (k.dailyLimit || 0), 0);
    const quotaRemaining = Math.max(0, totalQuota - emailsSentToday);

    const recentCampaigns = await Campaign.find()
      .populate('templateId', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        totalContacts,
        totalTemplates,
        totalCampaigns,
        emailsSentToday,
        activeKeys: keys.length,
        totalQuota,
        quotaRemaining,
        recentCampaigns,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCampaigns,
  getCampaign,
  createCampaign,
  getProgress,
  getLogs,
  resume,
  getDashboardStats,
};

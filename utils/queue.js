const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const Template = require('../models/Template');
const SendLog = require('../models/SendLog');
const { sendEmail, replacePlaceholders, getAvailableKey } = require('./email');

const SEND_DELAY_MS = 1500;

/** @type {Map<string, { running: boolean, paused: boolean }>} */
const activeJobs = new Map();

/**
 * Process a campaign: send emails one-by-one with delay, rotating API keys.
 */
const processCampaign = async (campaignId) => {
  if (activeJobs.get(campaignId)?.running) {
    console.log(`[QUEUE] Campaign ${campaignId} already running`);
    return;
  }

  activeJobs.set(campaignId, { running: true, paused: false });

  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      activeJobs.delete(campaignId);
      return;
    }

    const template = await Template.findById(campaign.templateId);
    if (!template) {
      campaign.status = 'failed';
      campaign.pauseReason = 'Template not found';
      await campaign.save();
      activeJobs.delete(campaignId);
      return;
    }

    campaign.status = 'sending';
    campaign.pauseReason = '';
    await campaign.save();

    const startIndex = campaign.currentIndex || 0;
    const contactIds = campaign.contactIds;

    for (let i = startIndex; i < contactIds.length; i++) {
      const job = activeJobs.get(campaignId);
      if (!job || job.paused) break;

      // Check quota before each send
      const available = await getAvailableKey();
      if (!available) {
        campaign.status = 'paused';
        campaign.pauseReason = 'All API keys exhausted — will resume next day';
        campaign.currentIndex = i;
        campaign.pendingCount = contactIds.length - i;
        await campaign.save();

        // Mark remaining as pending in logs
        for (let j = i; j < contactIds.length; j++) {
          const contact = await Contact.findById(contactIds[j]);
          if (!contact) continue;
          await SendLog.findOneAndUpdate(
            { campaignId, contactEmail: contact.email },
            {
              campaignId,
              contactEmail: contact.email,
              contactId: contact._id,
              status: 'pending',
              errorMessage: 'Waiting for API key quota reset',
            },
            { upsert: true }
          );
        }

        console.log(`[QUEUE] Campaign ${campaignId} paused — all keys exhausted at index ${i}`);
        activeJobs.set(campaignId, { running: false, paused: true });
        return;
      }

      const contact = await Contact.findById(contactIds[i]);
      if (!contact) {
        campaign.failedCount += 1;
        campaign.currentIndex = i + 1;
        await campaign.save();
        continue;
      }

      const subject = replacePlaceholders(template.subject, contact);
      const htmlContent = replacePlaceholders(template.htmlContent, contact);

      const result = await sendEmail({
        to: { email: contact.email, name: contact.name || contact.email },
        subject,
        htmlContent,
      });

      if (result.error === 'ALL_KEYS_EXHAUSTED') {
        campaign.status = 'paused';
        campaign.pauseReason = 'All API keys exhausted — will resume next day';
        campaign.currentIndex = i;
        campaign.pendingCount = contactIds.length - i;
        await campaign.save();
        activeJobs.set(campaignId, { running: false, paused: true });
        return;
      }

      if (result.success) {
        campaign.sentCount += 1;
        await SendLog.create({
          campaignId,
          contactEmail: contact.email,
          contactId: contact._id,
          status: 'sent',
          apiKeyUsed: result.apiKeyLabel,
          sentAt: new Date(),
        });
      } else {
        campaign.failedCount += 1;
        await SendLog.create({
          campaignId,
          contactEmail: contact.email,
          contactId: contact._id,
          status: 'failed',
          errorMessage: result.error || 'Send failed',
          apiKeyUsed: result.apiKeyLabel || '',
          sentAt: new Date(),
        });
      }

      campaign.currentIndex = i + 1;
      campaign.pendingCount = Math.max(0, contactIds.length - (i + 1));
      await campaign.save();

      // Rate-limit delay between sends
      if (i < contactIds.length - 1) {
        await sleep(SEND_DELAY_MS);
      }
    }

    // Finished all contacts
    const refreshed = await Campaign.findById(campaignId);
    if (refreshed && refreshed.status === 'sending') {
      refreshed.status = 'completed';
      refreshed.pendingCount = 0;
      refreshed.pauseReason = '';
      await refreshed.save();
      console.log(`[QUEUE] Campaign ${campaignId} completed`);
    }
  } catch (err) {
    console.error(`[QUEUE] Campaign ${campaignId} error:`, err.message);
    await Campaign.findByIdAndUpdate(campaignId, {
      status: 'failed',
      pauseReason: err.message,
    });
  } finally {
    activeJobs.set(campaignId, { running: false, paused: false });
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Enqueue a campaign for sending (non-blocking).
 */
const enqueueCampaign = (campaignId) => {
  setImmediate(() => processCampaign(campaignId));
};

/**
 * Resume a paused campaign.
 */
const resumeCampaign = async (campaignId) => {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status !== 'paused' && campaign.status !== 'failed') {
    throw new Error(`Cannot resume campaign with status "${campaign.status}"`);
  }
  enqueueCampaign(campaignId);
  return campaign;
};

module.exports = { enqueueCampaign, resumeCampaign, processCampaign, activeJobs };

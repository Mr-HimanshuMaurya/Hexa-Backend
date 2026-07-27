require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const connectDB = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { resetDailyQuotasIfNeeded } = require('./utils/email');
const Campaign = require('./models/Campaign');
const { enqueueCampaign } = require('./utils/queue');

const authRoutes = require('./routes/authRoutes');
const apiKeyRoutes = require('./routes/apiKeyRoutes');
const templateRoutes = require('./routes/templateRoutes');
const contactRoutes = require('./routes/contactRoutes');
const campaignRoutes = require('./routes/campaignRoutes');

connectDB();

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Hexa backend online', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/keys', apiKeyRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/campaigns', campaignRoutes);

app.use(notFound);
app.use(errorHandler);

// Daily quota reset at midnight + auto-resume paused campaigns
cron.schedule('0 0 * * *', async () => {
  console.log('[CRON] Midnight quota reset');
  try {
    await resetDailyQuotasIfNeeded();
    const paused = await Campaign.find({ status: 'paused' });
    for (const c of paused) {
      console.log(`[CRON] Resuming paused campaign ${c._id}`);
      enqueueCampaign(c._id.toString());
    }
  } catch (err) {
    console.error('[CRON] Error:', err.message);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[SERVER] Hexa backend listening on port ${PORT}`);
});

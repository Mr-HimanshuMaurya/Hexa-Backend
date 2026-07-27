const express = require('express');
const {
  getCampaigns,
  getCampaign,
  createCampaign,
  getProgress,
  getLogs,
  resume,
  getDashboardStats,
} = require('../controllers/campaignController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/stats/dashboard', getDashboardStats);
router.get('/', getCampaigns);
router.post('/', createCampaign);
router.get('/:id', getCampaign);
router.get('/:id/progress', getProgress);
router.get('/:id/logs', getLogs);
router.post('/:id/resume', resume);

module.exports = router;

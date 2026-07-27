const express = require('express');
const { getKeys, createKey, updateKey, deleteKey } = require('../controllers/apiKeyController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', getKeys);
router.post('/', createKey);
router.put('/:id', updateKey);
router.delete('/:id', deleteKey);

module.exports = router;

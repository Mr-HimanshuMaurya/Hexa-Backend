const express = require('express');
const multer = require('multer');
const {
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
} = require('../controllers/contactController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

router.use(protect);

router.get('/all-ids', getAllContactIds);
router.get('/', getContacts);
router.post('/', createContact);
router.post('/bulk', bulkCreateContacts);
router.delete('/bulk', bulkDeleteContacts);
router.post('/upload/excel', upload.single('file'), uploadExcel);
router.post('/upload/csv', upload.single('file'), uploadCsv);
router.post('/upload/screenshot', upload.single('file'), uploadScreenshot);
router.post('/extract-paste', extractPaste);
router.delete('/:id', deleteContact);

module.exports = router;

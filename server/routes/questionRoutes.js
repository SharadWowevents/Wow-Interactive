const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');
const { requireAdmin } = require('../middleware/auth');

// Public QR code image route (PNG or SVG)
router.get('/:id/qr.png', questionController.getQr);
router.get('/:id/qr.svg', questionController.getQr);

// Protected Admin routes
router.get('/', requireAdmin, questionController.getQuestions);
router.post('/', requireAdmin, questionController.createQuestion);
router.patch('/:id', requireAdmin, questionController.updateQuestion);
router.post('/:id/clear', requireAdmin, questionController.clearQuestion);
router.delete('/:id', requireAdmin, questionController.deleteQuestion);
router.get('/:id/export-dates', requireAdmin, questionController.getExportDates);
router.get('/:id/export.csv', requireAdmin, questionController.exportCsv);

module.exports = router;

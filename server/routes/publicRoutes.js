const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

router.get('/questions/:id', publicController.getPublicQuestion);
router.post('/questions/:id/answer', publicController.submitAnswer);
router.get('/questions/:id/cloud', publicController.getCloudData);
router.get('/questions/:id/stream', publicController.streamUpdates);

module.exports = router;

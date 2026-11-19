const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAdmin } = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/check', authController.checkAuth);
router.post('/change-password', requireAdmin, authController.changePassword);

module.exports = router;

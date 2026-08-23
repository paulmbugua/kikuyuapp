// src/modules/mpesa/mpesa.routes.js
const express = require('express');
const router = express.Router();
const mpesaController = require('./mpesa.controller');
const { protect, restrictTo } = require('../../middleware/authMiddleware');

// Public callbacks (no auth)
router.post('/callback', mpesaController.mpesaCallback);
router.post('/confirmation', mpesaController.confirmation);
router.post('/validation', mpesaController.validation);

// Protected routes
router.use(protect);

// Sandbox simulation
if (process.env.NODE_ENV !== 'production') {
    router.post('/simulate', restrictTo('super_admin'), mpesaController.simulatePayment);
}

// Admin routes
router.post('/register-urls', restrictTo('super_admin'), mpesaController.registerUrls);
router.get('/query/:checkoutRequestId', restrictTo('super_admin', 'finance'), mpesaController.queryStatus);

module.exports = router;
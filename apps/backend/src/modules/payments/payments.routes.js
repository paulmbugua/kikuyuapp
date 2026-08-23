const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/authMiddleware');
const pool = require('../../config/db');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');

// Get user's payment methods
router.get('/methods', protect, catchAsync(async (req, res) => {
    const userId = req.user.id;
    
    const result = await pool.query(
        `SELECT id, type, phone_number, is_default, created_at 
         FROM payment_methods 
         WHERE user_id = $1 AND is_active = true 
         ORDER BY is_default DESC, created_at DESC`,
        [userId]
    );
    
    ResponseHandler.success(res, { methods: result.rows });
}));

// Add payment method
router.post('/methods', protect, catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { type, phone_number, is_default } = req.body;
    
    // Validate phone number
    const phoneRegex = /^(0|254|\+254)[71]\d{8}$/;
    if (!phoneRegex.test(phone_number)) {
        throw new AppError('Invalid phone number format', 400);
    }
    
    // Check if method already exists
    const existing = await pool.query(
        'SELECT id FROM payment_methods WHERE user_id = $1 AND phone_number = $2 AND is_active = true',
        [userId, phone_number]
    );
    
    if (existing.rows.length > 0) {
        throw new AppError('This payment method already exists', 400);
    }
    
    // If this is the first method or is_default is true, make it default
    const countResult = await pool.query(
        'SELECT COUNT(*) FROM payment_methods WHERE user_id = $1 AND is_active = true',
        [userId]
    );
    
    const shouldBeDefault = is_default || parseInt(countResult.rows[0].count) === 0;
    
    // If setting as default, remove default from others
    if (shouldBeDefault) {
        await pool.query(
            'UPDATE payment_methods SET is_default = false WHERE user_id = $1',
            [userId]
        );
    }
    
    // Insert new payment method
    const result = await pool.query(
        `INSERT INTO payment_methods (user_id, type, phone_number, is_default)
         VALUES ($1, $2, $3, $4)
         RETURNING id, type, phone_number, is_default, created_at`,
        [userId, type || 'mpesa', phone_number, shouldBeDefault]
    );
    
    ResponseHandler.success(res, { method: result.rows[0] }, 'Payment method added successfully');
}));

// Delete payment method
router.delete('/methods/:methodId', protect, catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { methodId } = req.params;
    
    // Check if method exists and belongs to user
    const method = await pool.query(
        'SELECT is_default FROM payment_methods WHERE id = $1 AND user_id = $2 AND is_active = true',
        [methodId, userId]
    );
    
    if (method.rows.length === 0) {
        throw new AppError('Payment method not found', 404);
    }
    
    // Soft delete
    await pool.query(
        'UPDATE payment_methods SET is_active = false WHERE id = $1',
        [methodId]
    );
    
    // If deleted method was default, make another method default
    if (method.rows[0].is_default) {
        const nextMethod = await pool.query(
            'SELECT id FROM payment_methods WHERE user_id = $1 AND is_active = true LIMIT 1',
            [userId]
        );
        
        if (nextMethod.rows.length > 0) {
            await pool.query(
                'UPDATE payment_methods SET is_default = true WHERE id = $1',
                [nextMethod.rows[0].id]
            );
        }
    }
    
    ResponseHandler.success(res, null, 'Payment method removed successfully');
}));

// Set default payment method
router.put('/methods/:methodId/default', protect, catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { methodId } = req.params;
    
    // Check if method exists and belongs to user
    const method = await pool.query(
        'SELECT id FROM payment_methods WHERE id = $1 AND user_id = $2 AND is_active = true',
        [methodId, userId]
    );
    
    if (method.rows.length === 0) {
        throw new AppError('Payment method not found', 404);
    }
    
    // Remove default from all methods
    await pool.query(
        'UPDATE payment_methods SET is_default = false WHERE user_id = $1',
        [userId]
    );
    
    // Set new default
    await pool.query(
        'UPDATE payment_methods SET is_default = true WHERE id = $1',
        [methodId]
    );
    
    ResponseHandler.success(res, null, 'Default payment method updated');
}));

module.exports = router;
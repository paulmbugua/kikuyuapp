// src/modules/mpesa/mpesa.controller.js
const MpesaService = require('./mpesa.service');
const TokenModel = require('../token/token.model');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');
const pool = require('../../config/db');
const logger = require('../../utils/logger');

// M-Pesa callback URL (for STK push results)
const mpesaCallback = catchAsync(async (req, res) => {
    const callbackData = req.body;
    
    logger.info('M-Pesa callback received:', callbackData);
    
    const { Body } = callbackData;
    
    if (!Body || !Body.stkCallback) {
        throw new AppError('Invalid callback data', 400);
    }
    
    const { stkCallback } = Body;
    const {
        MerchantRequestID,
        CheckoutRequestID,
        ResultCode,
        ResultDesc,
        CallbackMetadata
    } = stkCallback;
    
    // Find transaction
    const transaction = await pool.query(
        'SELECT * FROM mpesa_transactions WHERE checkout_request_id = $1',
        [CheckoutRequestID]
    );
    
    if (transaction.rows.length === 0) {
        logger.error('Transaction not found:', CheckoutRequestID);
        return res.json({ ResultCode: 0, ResultDesc: 'Success' });
    }
    
    const tx = transaction.rows[0];
    
    // Update transaction with callback data
    await pool.query(
        `UPDATE mpesa_transactions 
         SET status = $1,
             result_code = $2,
             result_desc = $3,
             callback_data = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [
            ResultCode === 0 ? 'success' : 'failed',
            ResultCode,
            ResultDesc,
            callbackData,
            tx.id
        ]
    );
    
    // If successful, process the purchase
    if (ResultCode === 0) {
        // Extract metadata
        let mpesaReceipt = '';
        let transactionDate = '';
        
        if (CallbackMetadata && CallbackMetadata.Item) {
            CallbackMetadata.Item.forEach(item => {
                if (item.Name === 'MpesaReceiptNumber') {
                    mpesaReceipt = item.Value;
                }
                if (item.Name === 'TransactionDate') {
                    transactionDate = item.Value;
                }
            });
        }
        
        // Update with receipt number
        await pool.query(
            `UPDATE mpesa_transactions 
             SET mpesa_receipt_number = $1,
                 transaction_date = to_timestamp($2::text, 'YYYYMMDDHH24MISS')
             WHERE id = $3`,
            [mpesaReceipt, transactionDate, tx.id]
        );
        
        // Process token purchase
        await TokenModel.processPurchase(tx.user_id, {
            ...tx,
            mpesa_receipt_number: mpesaReceipt
        });
    }
    
    // Respond to M-Pesa
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
});

// Confirmation URL (for C2B)
const confirmation = catchAsync(async (req, res) => {
    const data = req.body;
    
    logger.info('M-Pesa confirmation received:', data);
    
    // Process C2B transaction
    // This would handle direct paybill payments
    
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
});

// Validation URL (for C2B)
const validation = catchAsync(async (req, res) => {
    const data = req.body;
    
    logger.info('M-Pesa validation received:', data);
    
    // Validate transaction
    // Return 0 to accept, 1 to reject
    
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
});

// Simulate payment (sandbox only)
const simulatePayment = catchAsync(async (req, res) => {
    const { phoneNumber, amount, reference } = req.body;
    
    const result = await MpesaService.simulateC2B(phoneNumber, amount, reference);
    
    ResponseHandler.success(res, { result }, 'Payment simulated successfully');
});

// Register URLs (admin only)
const registerUrls = catchAsync(async (req, res) => {
    const result = await MpesaService.registerUrls();
    
    ResponseHandler.success(res, { result }, 'URLs registered successfully');
});

// Query transaction status
const queryStatus = catchAsync(async (req, res) => {
    const { checkoutRequestId } = req.params;
    
    const result = await MpesaService.queryStatus(checkoutRequestId);
    
    ResponseHandler.success(res, { status: result });
});

module.exports = {
    mpesaCallback,
    confirmation,
    validation,
    simulatePayment,
    registerUrls,
    queryStatus
};
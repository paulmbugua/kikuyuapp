// src/modules/token/token.controller.js
const TokenModel = require('./token.model');
const MpesaService = require('../mpesa/mpesa.service');
const { generateAccountReference } = require('../../utils/currency');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');
const pool = require('../../config/db');

// Get token balance
const getBalance = catchAsync(async (req, res) => {
    const userId = req.user.id;
    
    const balance = await TokenModel.getBalance(userId);
    
    ResponseHandler.success(res, { balance });
});

// Get transaction history
const getTransactionHistory = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;
    
    const history = await TokenModel.getHistory(userId, parseInt(limit), parseInt(offset));
    
    ResponseHandler.paginated(res, history.transactions, page, limit, history.total, { balance: history.balance });
});

// Get token packages
const getPackages = catchAsync(async (req, res) => {
    const packages = await TokenModel.getPackages();
    
    ResponseHandler.success(res, { packages });
});

// Get single package
const getPackage = catchAsync(async (req, res) => {
    const { packageId } = req.params;
    
    const pkg = await TokenModel.getPackage(packageId);
    
    ResponseHandler.success(res, { package: pkg });
});

// Purchase tokens via M-Pesa
const purchaseTokens = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { packageId, phoneNumber } = req.body;
    
    // Get package details
    const pkg = await TokenModel.getPackage(packageId);
    
    // Generate account reference
    const accountRef = generateAccountReference('purchase', userId);
    
    // Initiate M-Pesa STK push
    const mpesaResponse = await MpesaService.stkPush(
        phoneNumber,
        pkg.price_kes,
        accountRef,
        `Purchase ${pkg.name} - ${pkg.token_amount} tokens`
    );
    
    // Save M-Pesa transaction
    const transactionResult = await pool.query(
        `INSERT INTO mpesa_transactions (
            user_id, merchant_request_id, checkout_request_id,
            response_code, response_description, customer_message,
            amount, phone_number, account_reference, transaction_desc,
            token_amount, package_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
            userId,
            mpesaResponse.MerchantRequestID,
            mpesaResponse.CheckoutRequestID,
            mpesaResponse.ResponseCode,
            mpesaResponse.ResponseDescription,
            mpesaResponse.CustomerMessage,
            pkg.price_kes,
            phoneNumber,
            accountRef,
            `Purchase ${pkg.name}`,
            pkg.total_tokens,
            packageId,
            'pending'
        ]
    );
    
    ResponseHandler.success(res, {
        transaction: transactionResult.rows[0],
        mpesa_response: {
            checkout_request_id: mpesaResponse.CheckoutRequestID,
            customer_message: mpesaResponse.CustomerMessage
        }
    }, 'STK push initiated. Please check your phone to complete payment.');
});

// Check transaction status
const checkTransactionStatus = catchAsync(async (req, res) => {
    const { transactionId } = req.params;
    const userId = req.user.id;
    
    const transaction = await pool.query(
        'SELECT * FROM mpesa_transactions WHERE id = $1 AND user_id = $2',
        [transactionId, userId]
    );
    
    if (transaction.rows.length === 0) {
        throw new AppError('Transaction not found', 404);
    }
    
    const tx = transaction.rows[0];
    
    // If still pending, query M-Pesa for status
    if (tx.status === 'pending') {
        try {
            const status = await MpesaService.queryStatus(tx.checkout_request_id);
            
            if (status.ResultCode === 0) {
                // Payment successful
                await TokenModel.processPurchase(userId, tx);
            }
        } catch (error) {
            // Ignore query errors
        }
    }
    
    // Get updated transaction
    const updated = await pool.query(
        'SELECT * FROM mpesa_transactions WHERE id = $1',
        [transactionId]
    );
    
    ResponseHandler.success(res, { transaction: updated.rows[0] });
});

// Get user token stats
const getTokenStats = catchAsync(async (req, res) => {
    const userId = req.user.id;
    
    const stats = await TokenModel.getUserStats(userId);
    
    ResponseHandler.success(res, { stats });
});

// Admin: Create token package
const createPackage = catchAsync(async (req, res) => {
    const packageData = req.body;
    
    const pkg = await TokenModel.createPackage(packageData);
    
    ResponseHandler.created(res, { package: pkg }, 'Token package created successfully');
});

// Admin: Update token package
const updatePackage = catchAsync(async (req, res) => {
    const { packageId } = req.params;
    const updates = req.body;
    
    const pkg = await TokenModel.updatePackage(packageId, updates);
    
    ResponseHandler.success(res, { package: pkg }, 'Token package updated successfully');
});

module.exports = {
    getBalance,
    getTransactionHistory,
    getPackages,
    getPackage,
    purchaseTokens,
    checkTransactionStatus,
    getTokenStats,
    createPackage,
    updatePackage
};
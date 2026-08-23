// src/modules/wallet/wallet.validation.js
const { body, param, query } = require('express-validator');

const validateWithdrawalId = [
    param('withdrawalId')
        .isUUID(4)
        .withMessage('Invalid withdrawal ID format')
];

const validateWithdrawalRequest = [
    body('amount')
        .isInt({ min: 500 })
        .withMessage('Minimum withdrawal amount is 500 tokens'),
    body('method')
        .isIn(['mpesa', 'bank', 'paypal'])
        .withMessage('Invalid withdrawal method'),
    body('accountDetails')
        .isObject()
        .withMessage('Account details are required')
        .custom((value, { req }) => {
            if (req.body.method === 'mpesa') {
                if (!value.phoneNumber || !value.phoneNumber.match(/^(0|254|\+254)[71]\d{8}$/)) {
                    throw new Error('Valid M-Pesa phone number required');
                }
            }
            if (req.body.method === 'bank') {
                if (!value.accountName || !value.accountNumber || !value.bankName || !value.branchCode) {
                    throw new Error('All bank account details are required');
                }
            }
            return true;
        })
];

module.exports = {
    validateWithdrawalId,
    validateWithdrawalRequest
};
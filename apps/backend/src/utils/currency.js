// src/utils/currency.js

// Token to KES conversion rate (1 token = 0.5 KES)
const TOKEN_TO_KES_RATE = 0.5;

// Minimum and maximum tip amounts
const MIN_TIP_TOKENS = 10;
const MAX_TIP_TOKENS = 100000;

// Format currency
const formatKES = (amount) => {
    return new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: 'KES',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

// Format tokens
const formatTokens = (amount) => {
    return new Intl.NumberFormat('en-KE').format(amount) + ' tokens';
};

// Convert tokens to KES
const tokensToKES = (tokens) => {
    return tokens * TOKEN_TO_KES_RATE;
};

// Convert KES to tokens
const kesToTokens = (kes) => {
    return Math.floor(kes / TOKEN_TO_KES_RATE);
};

// Calculate bonus tokens
const calculateBonus = (baseTokens, bonusPercentage) => {
    const bonus = Math.floor(baseTokens * (bonusPercentage / 100));
    return {
        base: baseTokens,
        bonus,
        total: baseTokens + bonus
    };
};

// Validate tip amount
const validateTipAmount = (tokens) => {
    if (tokens < MIN_TIP_TOKENS) {
        return {
            valid: false,
            message: `Minimum tip is ${formatTokens(MIN_TIP_TOKENS)}`
        };
    }
    if (tokens > MAX_TIP_TOKENS) {
        return {
            valid: false,
            message: `Maximum tip is ${formatTokens(MAX_TIP_TOKENS)}`
        };
    }
    return { valid: true };
};

// Calculate transaction fee (for withdrawals)
const calculateWithdrawalFee = (amountKES) => {
    // 5% fee, minimum 10 KES, maximum 500 KES
    const fee = Math.max(10, Math.min(500, amountKES * 0.05));
    return {
        fee,
        netAmount: amountKES - fee
    };
};

// Generate M-Pesa account reference
const generateAccountReference = (type, id) => {
    const prefix = type === 'purchase' ? 'PUR' : 'TIP';
    const timestamp = Date.now().toString().slice(-8);
    return `${prefix}${timestamp}${id.slice(0, 4)}`.toUpperCase();
};

module.exports = {
    TOKEN_TO_KES_RATE,
    MIN_TIP_TOKENS,
    MAX_TIP_TOKENS,
    formatKES,
    formatTokens,
    tokensToKES,
    kesToTokens,
    calculateBonus,
    validateTipAmount,
    calculateWithdrawalFee,
    generateAccountReference
};
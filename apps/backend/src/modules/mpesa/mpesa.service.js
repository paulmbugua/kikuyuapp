// src/modules/mpesa/mpesa.service.js
const axios = require('axios');
const config = require('../../config/env');
const { AppError } = require('../../middleware/errorMiddleware');
const logger = require('../../utils/logger');

class MpesaService {
    constructor() {
        this.consumerKey = config.mpesa.consumerKey;
        this.consumerSecret = config.mpesa.consumerSecret;
        this.passkey = config.mpesa.passkey;
        this.shortCode = config.mpesa.shortCode;
        this.environment = config.mpesa.environment;
        this.callbackUrl = config.mpesa.callbackUrl;
        
        // Base URL based on environment
        this.baseURL = this.environment === 'production'
            ? 'https://api.safaricom.co.ke'
            : 'https://sandbox.safaricom.co.ke';
    }

    // Get OAuth token
    async getAuthToken() {
        try {
            const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
            
            const response = await axios.get(
                `${this.baseURL}/oauth/v1/generate?grant_type=client_credentials`,
                {
                    headers: {
                        Authorization: `Basic ${auth}`
                    }
                }
            );
            
            return response.data.access_token;
        } catch (error) {
            logger.error('M-Pesa auth error:', error);
            throw new AppError('Failed to get M-Pesa authentication token', 500);
        }
    }

    // Initiate STK Push (Lipa Na M-Pesa Online)
    async stkPush(phoneNumber, amount, accountReference, transactionDesc) {
        try {
            const token = await this.getAuthToken();
            
            const timestamp = this.getTimestamp();
            const password = Buffer.from(
                `${this.shortCode}${this.passkey}${timestamp}`
            ).toString('base64');

            // Format phone number (remove 0 or +254)
            const formattedPhone = this.formatPhoneNumber(phoneNumber);

            const payload = {
                BusinessShortCode: this.shortCode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: Math.round(amount),
                PartyA: formattedPhone,
                PartyB: this.shortCode,
                PhoneNumber: formattedPhone,
                CallBackURL: `${this.callbackUrl}/mpesa/callback`,
                AccountReference: accountReference,
                TransactionDesc: transactionDesc
            };

            const response = await axios.post(
                `${this.baseURL}/mpesa/stkpush/v1/processrequest`,
                payload,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            return response.data;
        } catch (error) {
            logger.error('M-Pesa STK push error:', error);
            throw new AppError('Failed to initiate M-Pesa payment', 500);
        }
    }

    // Query STK Push status
    async queryStatus(checkoutRequestID) {
        try {
            const token = await this.getAuthToken();
            
            const timestamp = this.getTimestamp();
            const password = Buffer.from(
                `${this.shortCode}${this.passkey}${timestamp}`
            ).toString('base64');

            const payload = {
                BusinessShortCode: this.shortCode,
                Password: password,
                Timestamp: timestamp,
                CheckoutRequestID: checkoutRequestID
            };

            const response = await axios.post(
                `${this.baseURL}/mpesa/stkpushquery/v1/query`,
                payload,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            return response.data;
        } catch (error) {
            logger.error('M-Pesa query error:', error);
            throw new AppError('Failed to query M-Pesa payment status', 500);
        }
    }

    // Register confirmation and validation URLs (for C2B)
    async registerUrls() {
        try {
            const token = await this.getAuthToken();

            const payload = {
                ShortCode: this.shortCode,
                ResponseType: 'Completed',
                ConfirmationURL: `${this.callbackUrl}/mpesa/confirmation`,
                ValidationURL: `${this.callbackUrl}/mpesa/validation`
            };

            const response = await axios.post(
                `${this.baseURL}/mpesa/c2b/v1/registerurl`,
                payload,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            return response.data;
        } catch (error) {
            logger.error('M-Pesa URL registration error:', error);
            throw new AppError('Failed to register M-Pesa URLs', 500);
        }
    }

    // Simulate C2B transaction (sandbox only)
    async simulateC2B(phoneNumber, amount, billRefNumber) {
        if (this.environment === 'production') {
            throw new AppError('Simulation only available in sandbox', 400);
        }

        try {
            const token = await this.getAuthToken();

            const payload = {
                ShortCode: this.shortCode,
                CommandID: 'CustomerPayBillOnline',
                Amount: amount,
                Msisdn: this.formatPhoneNumber(phoneNumber),
                BillRefNumber: billRefNumber
            };

            const response = await axios.post(
                `${this.baseURL}/mpesa/c2b/v1/simulate`,
                payload,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            return response.data;
        } catch (error) {
            logger.error('M-Pesa simulation error:', error);
            throw new AppError('Failed to simulate M-Pesa payment', 500);
        }
    }

    // Get timestamp in required format (YYYYMMDDHHmmss)
    getTimestamp() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}${month}${day}${hours}${minutes}${seconds}`;
    }

    // Format phone number to international format
    formatPhoneNumber(phone) {
        // Remove any non-digit characters
        let cleaned = phone.replace(/\D/g, '');
        
        // If starts with 0, replace with 254
        if (cleaned.startsWith('0')) {
            cleaned = '254' + cleaned.substring(1);
        }
        // If doesn't start with 254, add it
        else if (!cleaned.startsWith('254')) {
            cleaned = '254' + cleaned;
        }
        
        return cleaned;
    }

    // Verify M-Pesa callback signature
    verifyCallback(signature, data) {
        // Implement signature verification if needed
        return true;
    }
}

module.exports = new MpesaService();
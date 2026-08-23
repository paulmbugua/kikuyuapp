// src/utils/taxCalculator.js

class TaxCalculator {
    // Calculate VAT (Value Added Tax) - Kenya: 16%
    static calculateVAT(amount, rate = 16) {
        return {
            amount: amount,
            vat_rate: rate,
            vat_amount: amount * (rate / 100),
            total_inclusive: amount * (1 + rate / 100)
        };
    }

    // Calculate Withholding Tax (for creator payments)
    static calculateWithholdingTax(amount, isResident = true, isCompany = false) {
        // Kenya withholding tax rates:
        // - Resident individuals: 5%
        // - Resident companies: 5% 
        // - Non-resident individuals: 15%
        // - Non-resident companies: 20%
        let rate = 5; // Default for residents
        
        if (!isResident) {
            rate = isCompany ? 20 : 15;
        }
        
        const taxAmount = amount * (rate / 100);
        
        return {
            amount,
            tax_rate: rate,
            tax_amount: taxAmount,
            net_amount: amount - taxAmount,
            resident: isResident,
            entity_type: isCompany ? 'company' : 'individual'
        };
    }

    // Calculate Digital Service Tax (Kenya: 1.5%)
    static calculateDigitalServiceTax(amount, rate = 1.5) {
        return {
            amount,
            dst_rate: rate,
            dst_amount: amount * (rate / 100)
        };
    }

    // Calculate Income Tax (PAYE style - progressive)
    static calculateIncomeTax(annualAmount) {
        // Kenya PAYE rates 2024 (simplified)
        const brackets = [
            { upper: 288000, rate: 10 }, // First 24,000 per month
            { upper: 388000, rate: 15 }, // Next 8,333 per month
            { upper: 688000, rate: 20 }, // Next 25,000 per month
            { upper: 1388000, rate: 25 }, // Next 58,333 per month
            { upper: Infinity, rate: 30 } // Above
        ];

        let remaining = annualAmount;
        let totalTax = 0;
        let previousUpper = 0;

        for (const bracket of brackets) {
            const taxableInBracket = Math.min(remaining, bracket.upper - previousUpper);
            if (taxableInBracket <= 0) break;
            
            const tax = taxableInBracket * (bracket.rate / 100);
            totalTax += tax;
            remaining -= taxableInBracket;
            previousUpper = bracket.upper;
        }

        return {
            annual_income: annualAmount,
            total_tax: totalTax,
            effective_rate: (totalTax / annualAmount * 100).toFixed(2),
            monthly_tax: totalTax / 12
        };
    }

    // Calculate all taxes for a transaction
    static calculateAllTaxes(amount, options = {}) {
        const {
            applyVAT = true,
            applyDST = true,
            applyWithholding = false,
            isResident = true,
            isCompany = false,
            vatRate = 16,
            dstRate = 1.5
        } = options;

        const result = {
            original_amount: amount,
            taxes: [],
            total_tax: 0,
            net_amount: amount
        };

        // Calculate VAT
        if (applyVAT) {
            const vat = this.calculateVAT(amount, vatRate);
            result.taxes.push({
                type: 'VAT',
                rate: vat.vat_rate,
                amount: vat.vat_amount
            });
            result.total_tax += vat.vat_amount;
        }

        // Calculate Digital Service Tax
        if (applyDST) {
            const dst = this.calculateDigitalServiceTax(amount, dstRate);
            result.taxes.push({
                type: 'Digital Service Tax',
                rate: dst.dst_rate,
                amount: dst.dst_amount
            });
            result.total_tax += dst.dst_amount;
        }

        // Calculate Withholding Tax
        if (applyWithholding) {
            const withholding = this.calculateWithholdingTax(amount, isResident, isCompany);
            result.taxes.push({
                type: 'Withholding Tax',
                rate: withholding.tax_rate,
                amount: withholding.tax_amount
            });
            result.total_tax += withholding.tax_amount;
        }

        result.net_amount = amount - result.total_tax;

        return result;
    }

    // Format for KRA reporting
    static formatForKRA(transactions, period) {
        const summary = {
            period,
            total_transactions: transactions.length,
            summary: {
                vat: { amount: 0, transactions: 0 },
                withholding: { amount: 0, transactions: 0 },
                dst: { amount: 0, transactions: 0 }
            },
            transactions: []
        };

        transactions.forEach(t => {
            const transaction = {
                id: t.id,
                date: t.created_at,
                type: t.transaction_type,
                amount: t.original_amount,
                taxes: []
            };

            if (t.vat_amount) {
                summary.summary.vat.amount += t.vat_amount;
                summary.summary.vat.transactions++;
                transaction.taxes.push({ type: 'VAT', amount: t.vat_amount });
            }

            if (t.withholding_amount) {
                summary.summary.withholding.amount += t.withholding_amount;
                summary.summary.withholding.transactions++;
                transaction.taxes.push({ type: 'Withholding', amount: t.withholding_amount });
            }

            if (t.dst_amount) {
                summary.summary.dst.amount += t.dst_amount;
                summary.summary.dst.transactions++;
                transaction.taxes.push({ type: 'DST', amount: t.dst_amount });
            }

            summary.transactions.push(transaction);
        });

        return summary;
    }

    // Generate tax invoice
    static generateTaxInvoice(transaction, businessDetails) {
        return {
            invoice_number: `INV-${Date.now()}-${transaction.id.slice(0, 8)}`,
            date: new Date().toISOString(),
            business: businessDetails,
            customer: transaction.customer,
            items: transaction.items,
            subtotal: transaction.subtotal,
            taxes: transaction.taxes,
            total: transaction.total,
            tax_total: transaction.taxes.reduce((sum, tax) => sum + tax.amount, 0),
            amount_due: transaction.total,
            payment_terms: 'Due immediately',
            notes: 'Tax invoice for digital services'
        };
    }
}

module.exports = TaxCalculator;
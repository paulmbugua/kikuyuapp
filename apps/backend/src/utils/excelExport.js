// src/utils/excelExport.js
const ExcelJS = require('exceljs');

const exportToExcel = async (data, sheetName = 'Sheet1') => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    if (data.length === 0) {
        return await workbook.xlsx.writeBuffer();
    }

    // Add headers
    const headers = Object.keys(data[0]);
    worksheet.addRow(headers);

    // Style headers
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data
    data.forEach(item => {
        const row = headers.map(header => {
            const value = item[header];
            // Handle objects and arrays
            if (typeof value === 'object' && value !== null) {
                return JSON.stringify(value);
            }
            return value;
        });
        worksheet.addRow(row);
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
            const cellLength = cell.value ? cell.value.toString().length : 0;
            maxLength = Math.max(maxLength, cellLength);
        });
        column.width = Math.min(maxLength + 2, 50);
    });

    // Generate buffer
    return await workbook.xlsx.writeBuffer();
};

const exportToCSV = async (data) => {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [];

    // Add headers
    csvRows.push(headers.join(','));

    // Add data
    for (const row of data) {
        const values = headers.map(header => {
            const value = row[header];
            // Handle commas and quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            if (typeof value === 'object' && value !== null) {
                return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
            }
            return value;
        });
        csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
};

module.exports = {
    exportToExcel,
    exportToCSV
};
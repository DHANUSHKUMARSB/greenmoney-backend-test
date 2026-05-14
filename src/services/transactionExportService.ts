import XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import { getTotalIncome, getTotalExpense, getCategoryBreakdown } from './analyticsService';

// Basic polyfill for btoa if missing (required for some XLSX operations)
const btoaPolyfill = (input: string) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = input;
  let output = '';
  for (let block = 0, charCode, i = 0, map = chars;
    str.charAt(i | 0) || (map = '=', i % 1);
    output += map.charAt(63 & block >> 8 - i % 1 * 8)) {
    charCode = str.charCodeAt(i += 3 / 4);
    if (charCode > 0xFF) throw new Error("'btoa' failed");
    block = block << 8 | charCode;
  }
  return output;
};

if (typeof btoa === 'undefined') {
  (global as any).btoa = btoaPolyfill;
}

export interface ExportOptions {
  format: 'xlsx' | 'pdf' | 'csv';
  fileName?: string;
  includeCategories?: boolean;
  includeNotes?: boolean;
  includeAccounts?: boolean;
  includeCharts?: boolean;
  includeSummaries?: boolean;
  dateRange: {
    start: Date;
    end: Date;
    label: string;
  };
}

class TransactionExportService {
  async exportTransactions(transactions: any[], options: ExportOptions): Promise<string> {
    console.log('[EXPORT]: Starting export...', { format: options.format, count: transactions.length });
    if (options.format === 'xlsx' || options.format === 'csv') {
      return this.exportToExcel(transactions, options);
    } else {
      return this.exportToPDF(transactions, options);
    }
  }

  private async exportToExcel(transactions: any[], options: ExportOptions): Promise<string> {
    console.log('[EXPORT]: Generating Excel data...');
    const data = transactions.map(tx => {
      const row: any = {
        'Date': format(new Date(tx.date), 'yyyy-MM-dd'),
        'Type': tx.type.toUpperCase(),
        'Amount': tx.amount,
        'Category': tx.category_name || 'Uncategorized',
      };
      if (options.includeAccounts) row['Account'] = tx.account_name || 'Default';
      if (options.includeNotes) row['Notes'] = tx.note || '';
      return row;
    });

    // Add Summary at bottom
    if (options.includeSummaries) {
      const income = getTotalIncome(transactions);
      const expense = getTotalExpense(transactions);
      data.push({}); // Empty row
      data.push({ 'Date': 'SUMMARY', 'Type': 'TOTAL INCOME', 'Amount': income });
      data.push({ 'Type': 'TOTAL EXPENSE', 'Amount': expense });
      data.push({ 'Type': 'NET BALANCE', 'Amount': income - expense });
    }

    console.log('[EXPORT]: Building workbook...');
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Professional Column Widths
    ws['!cols'] = [
      { wch: 12 }, // Date
      { wch: 15 }, // Type
      { wch: 12 }, // Amount
      { wch: 20 }, // Category
      { wch: 20 }, // Account
      { wch: 35 }, // Notes
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

    console.log('[EXPORT]: Writing file (base64)...');
    const wbout = XLSX.write(wb, { type: 'base64', bookType: options.format === 'csv' ? 'csv' : 'xlsx' });
    const cleanName = (options.fileName || `GreenMoney_Report`).replace(/[^\w\s-]/gi, '').replace(/\s+/g, '_');
    const fileName = `${cleanName}.${options.format}`;
    const fileUri = FileSystem.cacheDirectory + fileName;

    console.log('[EXPORT]: Saving to storage...', fileUri);
    await FileSystem.writeAsStringAsync(fileUri, wbout, { 
      encoding: FileSystem.EncodingType.Base64 
    });
    
    console.log('[EXPORT]: Excel export complete.');
    return fileUri;
  }

  private async exportToPDF(transactions: any[], options: ExportOptions): Promise<string> {
    console.log('[EXPORT]: Generating HTML for PDF...');
    const income = getTotalIncome(transactions);
    const expense = getTotalExpense(transactions);
    const balance = income - expense;
    const categoryBreakdown = getCategoryBreakdown(transactions, 'expense');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>GreenMoney Financial Report</title>
        <style>
          body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #333; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #4CAF50; padding-bottom: 20px; }
          .logo { color: #4CAF50; font-size: 28px; font-weight: 800; margin-bottom: 5px; }
          .report-type { color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; }
          .summary-grid { display: flex; justify-content: space-between; margin-bottom: 40px; gap: 20px; }
          .summary-card { flex: 1; padding: 20px; background: #f9f9f9; border-radius: 12px; border: 1px solid #eee; }
          .summary-label { font-size: 12px; color: #888; text-transform: uppercase; margin-bottom: 8px; font-weight: 700; }
          .summary-value { font-size: 20px; font-weight: 800; }
          .income { color: #4CAF50; }
          .expense { color: #F44336; }
          
          h2 { font-size: 18px; color: #333; margin-top: 30px; margin-bottom: 15px; border-left: 4px solid #4CAF50; padding-left: 10px; }
          
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { text-align: left; background: #f4f4f4; padding: 12px; font-size: 12px; color: #666; text-transform: uppercase; }
          td { padding: 12px; border-bottom: 1px solid #eee; font-size: 13px; }
          .tr-amount { text-align: right; font-weight: 700; }
          
          .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 20px; }
          
          .category-list { display: flex; flex-wrap: wrap; gap: 10px; }
          .category-item { padding: 8px 12px; background: #f0f0f0; border-radius: 20px; font-size: 12px; display: flex; align-items: center; }
          .category-dot { width: 8px; height: 8px; border-radius: 4px; margin-right: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">GreenMoney</div>
          <div class="report-type">Financial Statement • ${options.dateRange.label}</div>
          <div style="font-size: 11px; color: #999; margin-top: 5px;">Generated on ${format(new Date(), 'MMMM dd, yyyy HH:mm')}</div>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">Total Income</div>
            <div class="summary-value income">+${income.toLocaleString()}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Spent</div>
            <div class="summary-value expense">-${expense.toLocaleString()}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Net Balance</div>
            <div class="summary-value ${balance >= 0 ? 'income' : 'expense'}">${balance.toLocaleString()}</div>
          </div>
        </div>

        ${options.includeCategories ? `
          <h2>Spending Breakdown</h2>
          <div class="category-list">
            ${categoryBreakdown.map(c => `
              <div class="category-item">
                <div class="category-dot" style="background-color: ${c.color}"></div>
                <span>${c.name}: <b>${c.percentage.toFixed(0)}%</b></span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <h2>Transaction History</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Details</th>
              <th>Category</th>
              <th style="text-align: right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.map(tx => `
              <tr>
                <td>${format(new Date(tx.date), 'MMM dd')}</td>
                <td>
                  <div style="font-weight: 700">${tx.note || tx.category_name || 'Transaction'}</div>
                  ${options.includeAccounts ? `<div style="font-size: 10px; color: #888">${tx.account_name || 'Cash'}</div>` : ''}
                </td>
                <td>${tx.category_name || 'Uncategorized'}</td>
                <td class="tr-amount ${tx.type === 'income' ? 'income' : 'expense'}">
                  ${tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString()}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          This report was generated automatically by GreenMoney Financial Manager.<br/>
          &copy; 2026 GreenMoney. All rights reserved.
        </div>
      </body>
      </html>
    `;

    console.log('[EXPORT]: Printing to PDF file...');
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    
    // Rename file to user preference
    console.log('[EXPORT]: Renaming PDF file...');
    const cleanName = (options.fileName || `GreenMoney_Report`).replace(/[^\w\s-]/gi, '').replace(/\s+/g, '_');
    const fileName = `${cleanName}.pdf`;
    const newUri = FileSystem.cacheDirectory + fileName;
    
    try {
      await FileSystem.moveAsync({ from: uri, to: newUri });
    } catch (moveError) {
      console.warn('[EXPORT]: moveAsync failed, using original uri', moveError);
      return uri;
    }

    console.log('[EXPORT]: PDF export complete.');
    return newUri;
  }
}

export const transactionExportService = new TransactionExportService();

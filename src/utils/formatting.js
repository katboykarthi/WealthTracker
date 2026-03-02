// Formatting utilities for currency, dates, and numbers

import { CURRENCIES } from '../constants';

/**
 * Formats amount as currency string with appropriate scaling
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (e.g., 'INR', 'USD')
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, currency) {
  // Validate amount is a number
  const numAmount = Number(amount);
  if (isNaN(numAmount)) return '₹0';
  
  const c = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];
  
  if (Math.abs(numAmount) >= 10000000) {
    return `${c.symbol}${(numAmount / 10000000).toFixed(2)}Cr`;
  }
  if (Math.abs(numAmount) >= 100000) {
    return `${c.symbol}${(numAmount / 100000).toFixed(2)}L`;
  }
  if (Math.abs(numAmount) >= 1000) {
    return `${c.symbol}${(numAmount / 1000).toFixed(1)}K`;
  }
  return `${c.symbol}${numAmount.toFixed(0)}`;
}

/**
 * Formats date to Indian locale format
 * @param {Date|string} date - Date to format
 * @param {string} format - Format type: 'short' or 'long'
 * @returns {string} Formatted date string
 */
export function formatDate(date, format = 'short') {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (format === 'short') {
      return dateObj.toLocaleDateString('en-IN', { 
        day: 'numeric', 
        month: 'short', 
        year: '2-digit' 
      });
    }
    
    return dateObj.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  } catch (e) {
    return 'Invalid date';
  }
}

/**
 * Gets current date in Indian locale format
 * @returns {string} Today's date
 */
export function getTodayDate() {
  return new Date().toLocaleDateString('en-IN', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
}

/**
 * Formats percentage with proper decimal places
 * @param {number} value - Percentage value
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage
 */
export function formatPercent(value, decimals = 1) {
  const num = Number(value);
  if (isNaN(num)) return '0%';
  return `${num.toFixed(decimals)}%`;
}

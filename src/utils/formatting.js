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

function getSnapshotDateObject(snapshot) {
  if (!snapshot) return null;

  const timestampCandidate = snapshot.timestamp || snapshot.createdAt || snapshot.dateTime;
  if (timestampCandidate) {
    const parsedTimestamp = new Date(timestampCandidate);
    if (!Number.isNaN(parsedTimestamp.getTime())) {
      return parsedTimestamp;
    }
  }

  if (snapshot.date) {
    const parsedDate = new Date(snapshot.date);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  return null;
}

export function formatSnapshotLabel(snapshot, { includeTime = false, fallbackIndex } = {}) {
  const dateObj = getSnapshotDateObject(snapshot);

  if (dateObj) {
    if (includeTime) {
      return dateObj.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
      });
    }

    return dateObj.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
    });
  }

  if (typeof snapshot?.date === 'string' && snapshot.date.trim()) {
    return snapshot.date;
  }

  return fallbackIndex !== undefined ? `Snapshot ${fallbackIndex + 1}` : 'Snapshot';
}

export function buildSnapshotChartData(snapshots = []) {
  const totalByBaseLabel = snapshots.reduce((map, snapshot, index) => {
    const baseLabel = formatSnapshotLabel(snapshot, { includeTime: false, fallbackIndex: index });
    map.set(baseLabel, (map.get(baseLabel) || 0) + 1);
    return map;
  }, new Map());

  const occurrenceByBaseLabel = new Map();

  return snapshots.map((snapshot, index) => {
    const baseLabel = formatSnapshotLabel(snapshot, { includeTime: false, fallbackIndex: index });
    const occurrence = (occurrenceByBaseLabel.get(baseLabel) || 0) + 1;
    occurrenceByBaseLabel.set(baseLabel, occurrence);

    const hasTimestamp = Boolean(getSnapshotDateObject({ timestamp: snapshot?.timestamp || snapshot?.createdAt || snapshot?.dateTime }));
    const hasDuplicateBaseLabel = (totalByBaseLabel.get(baseLabel) || 0) > 1;
    const detailedLabel = formatSnapshotLabel(snapshot, { includeTime: hasTimestamp, fallbackIndex: index });
    const suffix = !hasTimestamp && hasDuplicateBaseLabel ? ` · Snapshot ${occurrence}` : '';

    return {
      ...snapshot,
      chartKey: snapshot?.id || snapshot?.timestamp || `${baseLabel}-${index}`,
      chartTick: baseLabel,
      tooltipLabel: `${detailedLabel}${suffix}`,
      historyLabel: `${detailedLabel}${suffix}`,
    };
  });
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

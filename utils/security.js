// Security utilities for input validation and sanitization

/**
 * Sanitizes user input to prevent XSS and injection attacks
 * @param {*} input - The input to sanitize
 * @param {string} type - Type of input: 'text' or 'number'
 * @returns {string|number} Sanitized input
 */
export function sanitizeInput(input, type = 'text') {
  if (!input && input !== 0) return type === 'number' ? 0 : '';
  
  const str = String(input).trim();
  
  if (type === 'number') {
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }
  
  if (type === 'text') {
    // Remove potentially harmful characters
    return str
      .replace(/[<>\"']/g, '') // Remove HTML special chars
      .replace(/javascript:/gi, '') // Remove javascript protocol
      .substring(0, 255); // Max length
  }
  
  return str;
}

/**
 * Validates numeric input for financial data
 * @param {number} value - The value to validate
 * @param {string} fieldName - Name of the field (for error messages)
 * @returns {object} {valid: boolean, value: number, error: string}
 */
export function validateNumericInput(value, fieldName = 'Value') {
  const num = parseFloat(value);
  
  if (isNaN(num)) {
    return { valid: false, value: 0, error: `${fieldName} must be a valid number` };
  }
  
  if (num < 0) {
    return { valid: false, value: 0, error: `${fieldName} cannot be negative` };
  }
  
  if (num > 999999999999) {
    return { valid: false, value: 0, error: `${fieldName} exceeds maximum allowed value` };
  }
  
  return { valid: true, value: num, error: null };
}

/**
 * Validates that all required fields are filled
 * @param {object} formData - Object containing form fields
 * @param {array} requiredFields - Array of required field names
 * @returns {object} {valid: boolean, errors: object}
 */
export function validateFormFields(formData, requiredFields) {
  const errors = {};
  
  requiredFields.forEach(field => {
    if (!formData[field] || (typeof formData[field] === 'string' && !formData[field].trim())) {
      errors[field] = `${field} is required`;
    }
  });
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Checks for data integrity
 * @param {array} assets - Array of assets
 * @param {array} liabilities - Array of liabilities
 * @returns {boolean} True if data is valid
 */
export function validateDataIntegrity(assets, liabilities) {
  if (!Array.isArray(assets) || !Array.isArray(liabilities)) {
    return false;
  }
  
  // Verify all assets have required properties
  const assetsValid = assets.every(a => 
    a.id && typeof a.value === 'number' && a.value >= 0 && a.typeId
  );
  
  // Verify all liabilities have required properties
  const liabilitiesValid = liabilities.every(l => 
    l.id && typeof l.value === 'number' && l.value >= 0 && l.typeId
  );
  
  return assetsValid && liabilitiesValid;
}

# Karthick Wealth-tracker - Security Enhanced

A privacy-first, secure wealth tracker application built with React.

## 🔒 Security Features

### Input Validation & Sanitization
- **XSS Prevention**: All user inputs are sanitized to remove HTML special characters and potential injection vectors
- **Numeric Validation**: Financial inputs are validated to ensure they are valid numbers within acceptable ranges
- **String Length Limits**: Text inputs are capped at 255 characters to prevent buffer overflow-like issues
- **Form Validation**: Required fields are validated before processing
- **Data Type Checking**: All data is validated for correct types before storage and processing

### Security Functions
Located in `utils/security.js`:
- `sanitizeInput()` - Removes potentially harmful characters from inputs
- `validateNumericInput()` - Validates financial amounts
- `validateFormFields()` - Checks required fields
- `validateDataIntegrity()` - Verifies data structure integrity

### Implementation Highlights
1. **No External API Calls**: All data remains local on your device
2. **No Tracking**: Complete privacy - no analytics or third-party services
3. **Client-Side Only**: Entire application runs in the browser
4. **Validated Data**: Every financial entry is validated before storage

## 📁 Project Structure

```
WealthTracker/
├── wealth-tracker.jsx          # Main application component
├── utils/
│   ├── security.js             # Security utilities & input validation
│   └── formatting.js           # Formatting utilities for currency & dates
├── constants/
│   └── index.js                # Application constants & configurations
├── styles/
│   └── index.js                # Shared component styles
└── README.md                   # This file
```

## 🏗️ Architecture

### Constants (`constants/index.js`)
- Currency definitions
- Asset and liability types
- Navigation items
- Application configuration
- Security settings

### Utils

#### Security (`utils/security.js`)
- Input sanitization to prevent XSS attacks
- Numeric validation with bounds checking
- Form field validation
- Data integrity verification

#### Formatting (`utils/formatting.js`)
- Currency formatting with scaling (K, L, Cr)
- Date formatting to Indian locale
- Percentage formatting
- Safe number conversion

### Styles (`styles/index.js`)
- Centralized button styles
- Card and input styles
- Label styles
- Dark/Light mode color schemes
- Shared color palette

## 🚀 Features

### Wealth Tracking
- 📊 Dashboard with net worth overview
- 🏛️ Asset tracking (10+ asset types)
- 💳 Liability management
- 📈 Net worth trends over time
- 🎯 Financial goals with progress tracking

### Security Measures
- ✅ Input sanitization on all forms
- ✅ Numeric bounds validation
- ✅ Required field validation
- ✅ Data type verification
- ✅ No external dependencies for sensitive operations

### User Experience
- 🎨 Beautiful, intuitive interface
- 🌙 Dark mode support
- 📱 Responsive design
- 🌍 Multi-currency support
- ⚡ Fast local-only processing

## 🔐 Security Best Practices Implemented

1. **Input Validation**: All user inputs are validated before processing
2. **Output Encoding**: Special characters are removed to prevent injection
3. **Data Isolation**: All data stays on the user's device
4. **Type Safety**: Strict type checking for numeric inputs
5. **Error Handling**: Proper error messages without exposing sensitive info
6. **No External API Calls**: Complete privacy preservation

## 📦 Dependencies

- React 18+
- Recharts (for charting)

## 🎯 Future Security Enhancements

- [ ] Data encryption at rest (using Web Crypto API)
- [ ] Export/Import functionality with encryption
- [ ] Session timeout implementation
- [ ] Audit logging for data changes
- [ ] Backup & recovery mechanisms
- [ ] Two-factor authentication support

## 📝 Usage

### Adding Assets
1. Click "Add Asset" in the dashboard
2. Select asset type
3. Enter asset details (name, value, currency)
4. All inputs are automatically validated and sanitized

### Managing Liabilities
1. Navigate to "Liabilities" section
2. Click "Add Liability"
3. Enter loan details
4. Data is validated before saving

### Tracking Progress
1. Use "Net Worth" section to take snapshots
2. View historical trends
3. Set financial goals and track progress

## 🛡️ Data Privacy

Your wealth data:
- ✅ Never leaves your device
- ✅ Is never sent to external servers
- ✅ Is not tracked or monitored
- ✅ Is fully in your control

## 📄 License

Private Project - Karthick Wealth-tracker

---

**Last Updated**: March 2, 2026

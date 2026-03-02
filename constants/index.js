// Application Constants

export const CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
];

export const ASSET_TYPES = [
  { id: "stocks", label: "Stocks & Equity", icon: "📈", color: "#22c55e" },
  { id: "mutual_funds", label: "Mutual Funds", icon: "🏦", color: "#3b82f6" },
  { id: "real_estate", label: "Real Estate", icon: "🏠", color: "#f97316" },
  { id: "gold", label: "Gold & Silver", icon: "🥇", color: "#eab308" },
  { id: "fd", label: "FD & RD", icon: "🏛️", color: "#8b5cf6" },
  { id: "bonds", label: "Bonds", icon: "📋", color: "#06b6d4" },
  { id: "crypto", label: "Crypto", icon: "₿", color: "#f59e0b" },
  { id: "epf", label: "EPF / PPF / NPS", icon: "🛡️", color: "#10b981" },
  { id: "cash", label: "Cash & Savings", icon: "💰", color: "#64748b" },
  { id: "other", label: "Other", icon: "📦", color: "#94a3b8" },
];

export const LIABILITY_TYPES = [
  { id: "home_loan", label: "Home Loan", icon: "🏠" },
  { id: "car_loan", label: "Car Loan", icon: "🚗" },
  { id: "personal_loan", label: "Personal Loan", icon: "💳" },
  { id: "credit_card", label: "Credit Card", icon: "💳" },
  { id: "education_loan", label: "Education Loan", icon: "🎓" },
  { id: "other", label: "Other Debt", icon: "📋" },
];

export const NAV_ITEMS = [
  { section: "OVERVIEW", items: [{ id: "dashboard", label: "Dashboard", icon: "⊞" }] },
  {
    section: "WEALTH",
    items: [
      { id: "assets", label: "Assets", icon: "🏛" },
      { id: "liabilities", label: "Liabilities", icon: "💳" },
      { id: "networth", label: "Net Worth", icon: "📈" },
    ],
  },
  {
    section: "PLAN",
    items: [
      { id: "goals", label: "Goals", icon: "🎯" },
      { id: "allocation", label: "Allocation", icon: "🕐" },
    ],
  },
  {
    section: "MONEY",
    items: [
      { id: "income", label: "Income", icon: "💼" },
      { id: "expenses", label: "Expenses", icon: "🛒" },
      { id: "insights", label: "Insights", icon: "📊" },
    ],
  },
];

export const GOAL_ICONS = ["🎯", "🏠", "🚗", "✈️", "🎓", "💍", "🌏", "💼", "🏖️"];

export const APP_NAME = "Karthick Wealth-tracker";
export const APP_FEATURES = [
  { icon: "📊", title: "Dashboard", desc: "See your net worth at a glance" },
  { icon: "🎯", title: "Goals", desc: "Track progress to your targets" },
  { icon: "📈", title: "Net Worth", desc: "Historical snapshots & trends" },
  { icon: "💡", title: "Insights", desc: "Smart observations about your wealth" },
];

export const SECURITY_SETTINGS = {
  MAX_INPUT_LENGTH: 255,
  MIN_VALUE: 0,
  MAX_VALUE: 999999999999,
  ALLOWED_CURRENCIES: ["INR", "USD", "EUR", "GBP", "JPY"],
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
};

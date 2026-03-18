/**
 * PriceService — Google Finance price lookup with 15-minute sessionStorage cache.
 *
 * Because Google Finance does NOT allow cross-origin fetch (CORS blocked),
 * we open Google Finance in a new tab for the user to reference the price
 * and enter it manually. However, we provide:
 *   1. A helper to build the Google Finance URL.
 *   2. A sessionStorage cache so the same symbol isn't looked up twice within 15 min.
 *   3. A stub `fetchPrice` that returns the cached value or prompts the user.
 */

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const CACHE_KEY_PREFIX = "wt_price_";

/**
 * Returns the Google Finance URL for a given symbol + exchange.
 * @param {string} symbol  e.g. "RELIANCE"
 * @param {string} exchange e.g. "NSE" | "BSE" | "MUTUALFUND"
 */
export function googleFinanceUrl(symbol, exchange = "NSE") {
  const sym = encodeURIComponent(symbol.toUpperCase().trim());
  const ex = encodeURIComponent(exchange.toUpperCase().trim());
  return `https://www.google.com/finance/quote/${sym}:${ex}`;
}

/**
 * Reads a cached price entry from sessionStorage.
 * Returns { price, updatedAt } or null if missing / expired.
 */
export function getCachedPrice(symbol, exchange = "NSE") {
  try {
    const key = `${CACHE_KEY_PREFIX}${exchange}_${symbol}`.toUpperCase();
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return { price: parsed.price, updatedAt: new Date(parsed.ts) };
  } catch {
    return null;
  }
}

/**
 * Writes a price entry to sessionStorage.
 * @param {string} symbol
 * @param {string} exchange
 * @param {number} price
 */
export function setCachedPrice(symbol, exchange, price) {
  try {
    const key = `${CACHE_KEY_PREFIX}${exchange}_${symbol}`.toUpperCase();
    sessionStorage.setItem(key, JSON.stringify({ price: Number(price), ts: Date.now() }));
  } catch {
    // sessionStorage unavailable — silently ignore
  }
}

/**
 * Opens the Google Finance page in a new tab so the user can look up the price.
 * Returns the cached price if available (and not expired).
 *
 * @param {string} symbol
 * @param {string} exchange
 * @returns {{ cached: boolean, price: number|null, updatedAt: Date|null }}
 */
export function openGoogleFinance(symbol, exchange = "NSE") {
  const cached = getCachedPrice(symbol, exchange);
  if (!cached) {
    window.open(googleFinanceUrl(symbol, exchange), "_blank", "noopener,noreferrer");
  }
  return cached
    ? { cached: true, price: cached.price, updatedAt: cached.updatedAt }
    : { cached: false, price: null, updatedAt: null };
}

/**
 * Formats a Date object as a short time string, e.g. "3:42 PM".
 */
export function formatUpdatedAt(date) {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

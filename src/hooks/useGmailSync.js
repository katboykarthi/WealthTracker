/**
 * hooks/useGmailSync.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages the Gmail auto-import lifecycle:
 *  1. Requests gmail.readonly scope from the already-authenticated Google user
 *  2. Stores the access token in component state (never persisted to disk/cloud)
 *  3. Runs a full sync on demand ("Sync Now") and automatically every 24 hours
 *  4. Reports sync status back to the UI
 *
 * Token acquisition strategy:
 *  Firebase's GoogleAuthProvider returns an OAuth2 credential on sign-in.
 *  For subsequent sessions (user already logged in), we re-trigger a silent
 *  `signInWithPopup` scoped to gmail.readonly to get a fresh access token —
 *  because Firebase does NOT persist OAuth2 access tokens, only ID tokens.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { GoogleAuthProvider, signInWithPopup, OAuthProvider } from "firebase/auth";
import { auth } from "../firebase";
import { runFullGmailSync } from "../services/gmailImportService";

const GMAIL_SCOPE       = "https://www.googleapis.com/auth/gmail.readonly";
const SYNC_INTERVAL_MS  = 24 * 60 * 60 * 1000; // 24 hours
const STORAGE_KEY_META  = "wt_gmail_sync_meta";

function loadSyncMeta() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_META);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSyncMeta(meta) {
  try {
    localStorage.setItem(STORAGE_KEY_META, JSON.stringify(meta));
  } catch {}
}

export function useGmailSync({
  authUser,
  incomes,
  expenses,
  assets,
  currency,
  importIncomeEntries,
  importExpenseEntries,
  importAssetHoldings,
  pushToast,
}) {
  const [gmailConnected,   setGmailConnected]   = useState(false);
  const [gmailToken,       setGmailToken]        = useState(null);
  const [syncStatus,       setSyncStatus]        = useState("idle"); // idle | connecting | syncing | success | error
  const [syncError,        setSyncError]         = useState("");
  const [lastSyncAt,       setLastSyncAt]        = useState(() => loadSyncMeta().lastSyncAt || null);
  const [lastSyncSummary,  setLastSyncSummary]   = useState(() => loadSyncMeta().lastSyncSummary || null);
  const [hdfcEnabled,      setHdfcEnabled]       = useState(() => loadSyncMeta().hdfcEnabled  ?? true);
  const [angelEnabled,     setAngelEnabled]      = useState(() => loadSyncMeta().angelEnabled ?? true);

  const timerRef      = useRef(null);
  const isSyncingRef  = useRef(false);

  // ── Persist settings whenever they change ──────────────────────────────────
  useEffect(() => {
    saveSyncMeta({
      ...loadSyncMeta(),
      hdfcEnabled,
      angelEnabled,
    });
  }, [hdfcEnabled, angelEnabled]);

  // ── Request Gmail access token ──────────────────────────────────────────────
  const connectGmail = useCallback(async () => {
    if (!auth || !authUser) {
      setSyncError("Please sign in with Google first.");
      return false;
    }

    setSyncStatus("connecting");
    setSyncError("");

    try {
      const provider = new GoogleAuthProvider();
      provider.addScope(GMAIL_SCOPE);
      provider.setCustomParameters({ prompt: "consent", login_hint: authUser.email });

      const result     = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token      = credential?.accessToken;

      if (!token) throw new Error("No access token returned from Google.");

      setGmailToken(token);
      setGmailConnected(true);
      setSyncStatus("idle");
      return token;
    } catch (err) {
      const msg = err.code === "auth/popup-closed-by-user"
        ? "Permission popup was closed. Please try again."
        : err.message || "Failed to connect Gmail.";
      setSyncError(msg);
      setSyncStatus("error");
      return false;
    }
  }, [authUser]);

  // ── Core sync logic ────────────────────────────────────────────────────────
  const runSync = useCallback(async (token) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setSyncStatus("syncing");
    setSyncError("");

    try {
      const result = await runFullGmailSync(token, { incomes, expenses, assets, currency });

      // Import into WealthTracker
      if (hdfcEnabled) {
        if (result.incomeEntries.length)  importIncomeEntries(result.incomeEntries);
        if (result.expenseEntries.length) importExpenseEntries(result.expenseEntries);

        // Update HDFC savings account balance
        if (result.accountInfo?.closingBalance) {
          importAssetHoldings([{
            id:       `hdfc-savings-${authUser.uid}`,
            name:     `HDFC Savings A/c ${result.accountInfo.accountNumber || ""}`.trim(),
            typeId:   "cash",
            value:    result.accountInfo.closingBalance,
            currency,
            notes:    `Auto-synced. Period: ${result.accountInfo.period || "—"}`,
            source:   "gmail-auto",
          }]);
        }
      }

      if (angelEnabled && result.holdings.length) {
        importAssetHoldings(result.holdings);
      }

      const now     = new Date().toISOString();
      const summary = result.summary;

      setLastSyncAt(now);
      setLastSyncSummary(summary);
      setSyncStatus("success");

      saveSyncMeta({
        ...loadSyncMeta(),
        lastSyncAt:     now,
        lastSyncSummary: summary,
      });

      const total = summary.newIncome + summary.newExpenses + summary.newHoldings;
      if (total > 0) {
        pushToast(
          `Auto-import: ${summary.newIncome} income, ${summary.newExpenses} expenses, ${summary.newHoldings} holdings imported.`,
          "success"
        );
      } else {
        pushToast("Gmail sync complete — no new data found.", "info");
      }
    } catch (err) {
      console.error("Gmail sync error:", err);
      const msg = err.message?.includes("401")
        ? "Gmail access expired. Reconnect Gmail to resume auto-import."
        : err.message || "Gmail sync failed.";
      setSyncError(msg);
      setSyncStatus("error");
      if (err.message?.includes("401")) {
        setGmailConnected(false);
        setGmailToken(null);
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, [
    incomes, expenses, assets, currency,
    hdfcEnabled, angelEnabled,
    importIncomeEntries, importExpenseEntries, importAssetHoldings,
    pushToast, authUser,
  ]);

  // ── Manual "Sync Now" ──────────────────────────────────────────────────────
  const syncNow = useCallback(async () => {
    let token = gmailToken;
    if (!token) {
      token = await connectGmail();
      if (!token) return;
    }
    await runSync(token);
  }, [gmailToken, connectGmail, runSync]);

  // ── Auto-sync every 24 hours once connected ────────────────────────────────
  useEffect(() => {
    if (!gmailConnected || !gmailToken) return;

    // Run immediately if last sync was > 24h ago or never
    const meta = loadSyncMeta();
    const lastMs = meta.lastSyncAt ? new Date(meta.lastSyncAt).getTime() : 0;
    const nowMs  = Date.now();

    if (nowMs - lastMs >= SYNC_INTERVAL_MS) {
      runSync(gmailToken);
    }

    // Schedule next run
    timerRef.current = setInterval(() => runSync(gmailToken), SYNC_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [gmailConnected, gmailToken, runSync]);

  // ── Reset when user signs out ──────────────────────────────────────────────
  useEffect(() => {
    if (!authUser) {
      setGmailConnected(false);
      setGmailToken(null);
      setSyncStatus("idle");
      clearInterval(timerRef.current);
    }
  }, [authUser]);

  // ── Format last sync time for display ─────────────────────────────────────
  const lastSyncLabel = lastSyncAt
    ? new Date(lastSyncAt).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "Never";

  return {
    gmailConnected,
    syncStatus,
    syncError,
    lastSyncLabel,
    lastSyncSummary,
    hdfcEnabled,
    setHdfcEnabled,
    angelEnabled,
    setAngelEnabled,
    connectGmail,
    syncNow,
  };
}

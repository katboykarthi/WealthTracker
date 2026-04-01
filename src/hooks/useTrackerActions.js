import { useCallback } from "react";
import { ASSET_TYPES } from "../constants";

function stripUndefinedFields(record) {
  return Object.fromEntries(
    Object.entries(record || {}).filter(([, value]) => value !== undefined)
  );
}

export function useTrackerActions({
  assets,
  liabilities,
  setAssets,
  setLiabilities,
  setIncomes,
  setExpenses,
  setSnapshots,
  setActiveNav,
  setAssetComposerRequest,
  pushToast,
}) {
  const addAsset = useCallback((asset) => {
    setAssets((prev) => [...prev, asset]);
  }, [setAssets]);

  const updateAsset = useCallback((updatedAsset) => {
    setAssets((prev) => prev.map((asset) => (asset.id === updatedAsset.id ? updatedAsset : asset)));
    pushToast("Asset updated successfully", "success");
  }, [setAssets, pushToast]);

  const deleteAsset = useCallback((id) => {
    setAssets((prev) => prev.filter((asset) => asset.id !== id));
  }, [setAssets]);

  const addLiability = useCallback((liability) => {
    setLiabilities((prev) => [...prev, liability]);
  }, [setLiabilities]);

  const updateLiability = useCallback((updatedLiability) => {
    setLiabilities((prev) => prev.map((liability) => (liability.id === updatedLiability.id ? updatedLiability : liability)));
    pushToast("Liability updated successfully", "success");
  }, [setLiabilities, pushToast]);

  const deleteLiability = useCallback((id) => {
    setLiabilities((prev) => prev.filter((liability) => liability.id !== id));
  }, [setLiabilities]);

  const addIncome = useCallback((income) => {
    setIncomes((prev) => [...prev, income]);
  }, [setIncomes]);

  const updateIncome = useCallback((updatedIncome) => {
    setIncomes((prev) => prev.map((income) => (income.id === updatedIncome.id ? updatedIncome : income)));
    pushToast("Income updated successfully", "success");
  }, [setIncomes, pushToast]);

  const deleteIncome = useCallback((id) => {
    setIncomes((prev) => prev.filter((income) => income.id !== id));
  }, [setIncomes]);

  const addExpense = useCallback((expense) => {
    setExpenses((prev) => [...prev, expense]);
  }, [setExpenses]);

  const updateExpense = useCallback((updatedExpense) => {
    setExpenses((prev) => prev.map((expense) => (expense.id === updatedExpense.id ? updatedExpense : expense)));
    pushToast("Expense updated successfully", "success");
  }, [setExpenses, pushToast]);

  const deleteExpense = useCallback((id) => {
    setExpenses((prev) => prev.filter((expense) => expense.id !== id));
  }, [setExpenses]);

  const importIncomeEntries = useCallback((entries) => {
    if (!Array.isArray(entries) || entries.length === 0) return;

    setIncomes((prev) => {
      const next = [...prev];

      entries.forEach((incoming) => {
        const incomingName = String(incoming.name || "").trim().toLowerCase();
        if (!incomingName || !Number.isFinite(incoming.amount) || incoming.amount <= 0) {
          return;
        }

        const existingIndex = next.findIndex(
          (item) => String(item.name || "").trim().toLowerCase() === incomingName
        );

        if (existingIndex >= 0) {
          const existing = next[existingIndex];
          next[existingIndex] = {
            ...existing,
            amount: incoming.amount,
            currency: incoming.currency || existing.currency,
            date: incoming.date || existing.date,
            month: incoming.month || existing.month,
          };
        } else {
          next.push({
            id: Date.now() + Math.random(),
            name: incoming.name,
            amount: incoming.amount,
            currency: incoming.currency,
            date: incoming.date || "",
            month: incoming.month || "",
          });
        }
      });

      return next;
    });
  }, [setIncomes]);

  const importExpenseEntries = useCallback((entries) => {
    if (!Array.isArray(entries) || entries.length === 0) return;

    setExpenses((prev) => {
      const next = [...prev];

      entries.forEach((incoming) => {
        const incomingName = String(incoming.name || "").trim().toLowerCase();
        if (!incomingName || !Number.isFinite(incoming.amount) || incoming.amount <= 0) {
          return;
        }

        const existingIndex = next.findIndex(
          (item) => String(item.name || "").trim().toLowerCase() === incomingName
        );

        if (existingIndex >= 0) {
          const existing = next[existingIndex];
          next[existingIndex] = {
            ...existing,
            amount: incoming.amount,
            currency: incoming.currency || existing.currency,
            date: incoming.date || existing.date,
            month: incoming.month || existing.month,
          };
        } else {
          next.push({
            id: Date.now() + Math.random(),
            name: incoming.name,
            amount: incoming.amount,
            currency: incoming.currency,
            date: incoming.date || "",
            month: incoming.month || "",
          });
        }
      });

      return next;
    });
  }, [setExpenses]);

  const importAssetHoldings = useCallback((entries) => {
    if (!Array.isArray(entries) || entries.length === 0) return;

    setAssets((prev) => {
      const next = [...prev];

      entries.forEach((incoming) => {
        const incomingName = String(incoming.name || "").trim().toLowerCase();
        const incomingTypeId = incoming.typeId;

        if (!incomingName || !incomingTypeId || !Number.isFinite(incoming.value) || incoming.value <= 0) {
          return;
        }

        const normalizedIncoming = stripUndefinedFields(incoming);

        const existingIndex = next.findIndex(
          (asset) =>
            String(asset.name || "").trim().toLowerCase() === incomingName &&
            asset.typeId === incomingTypeId
        );

        if (existingIndex >= 0) {
          const existing = next[existingIndex];
          next[existingIndex] = {
            ...existing,
            ...normalizedIncoming,
            id: existing.id,
            typeId: incomingTypeId,
            currency: incoming.currency || existing.currency,
            notes: incoming.notes ?? existing.notes ?? "",
          };
        } else {
          next.push({
            id: Date.now() + Math.random(),
            ...normalizedIncoming,
            typeId: incomingTypeId,
            name: incoming.name,
            currency: incoming.currency,
            notes: incoming.notes ?? "",
          });
        }
      });

      return next;
    });

    pushToast("AngelOne holdings imported successfully.", "success");
  }, [setAssets, pushToast]);

  const takeSnapshot = useCallback((navigateToNetWorth = false) => {
    const totalAssets = assets.reduce((sum, asset) => sum + asset.value, 0);
    const totalLiabilities = liabilities.reduce((sum, liability) => sum + liability.value, 0);
    const total = totalAssets - totalLiabilities;
    const now = new Date();
    const today = now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
    setSnapshots((prev) => [
      ...prev,
      {
        id: `snapshot-${now.getTime()}`,
        timestamp: now.toISOString(),
        date: today,
        value: total,
      },
    ]);
    if (navigateToNetWorth) {
      setActiveNav("networth");
    }
    pushToast("Snapshot saved.", "success");
  }, [assets, liabilities, setSnapshots, setActiveNav, pushToast]);

  const openAssetComposer = useCallback((typeId = "stocks") => {
    const resolvedTypeId = ASSET_TYPES.some((type) => type.id === typeId) ? typeId : "stocks";
    setAssetComposerRequest({ token: Date.now(), typeId: resolvedTypeId });
    setActiveNav("assets");
  }, [setAssetComposerRequest, setActiveNav]);

  return {
    addAsset,
    updateAsset,
    deleteAsset,
    addLiability,
    updateLiability,
    deleteLiability,
    addIncome,
    updateIncome,
    deleteIncome,
    addExpense,
    updateExpense,
    deleteExpense,
    importIncomeEntries,
    importExpenseEntries,
    importAssetHoldings,
    takeSnapshot,
    openAssetComposer,
  };
}

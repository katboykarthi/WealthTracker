import { useState } from "react";
import { ASSET_TYPES, CURRENCIES, LIABILITY_TYPES } from "../../constants";
import { buttonStyles, inputStyle as sharedInputStyle, labelStyle as sharedLabelStyle } from "../../styles";
import { sanitizeInput } from "../../utils/security";

const TOAST_EVENT_NAME = "wealthtracker:toast";
const btnStyle = buttonStyles.primary;
const inputStyle = sharedInputStyle;
const labelStyle = sharedLabelStyle;

function notifyApp(message, type = "info") {
  const text = String(message || "").trim();
  if (!text) return;

  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(
      new CustomEvent(TOAST_EVENT_NAME, {
        detail: { message: text, type },
      })
    );
  }
}

export function AddAssetForm({ typeId, onSave, onCancel, editData }) {
  const t = ASSET_TYPES.find((x) => x.id === typeId) || ASSET_TYPES[0];
  const [name, setName] = useState(editData?.name || "");
  const [value, setValue] = useState(editData?.value?.toString() || "");
  const [currency, setCurrency] = useState(editData?.currency || CURRENCIES[0].code);
  const [notes, setNotes] = useState(editData?.notes || "");

  const save = () => {
    const sanitizedName = sanitizeInput(name, "text");
    const sanitizedNotes = sanitizeInput(notes, "text");
    const sanitizedValue = sanitizeInput(value, "number");

    if (!sanitizedName || sanitizedValue <= 0) {
      notifyApp("Please enter valid asset name and positive value.", "error");
      return;
    }

    const payload = {
      id: editData?.id || Date.now(),
      typeId: t.id,
      name: sanitizedName,
      value: sanitizedValue,
      currency,
      notes: sanitizedNotes,
    };
    onSave(payload);
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 700, color: "rgba(255, 255, 255, 0.95)" }}>{t.icon} {t.label}</div>
      <div>
        <label style={labelStyle}>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="e.g. HDFC Bank, Gold ETF, Flat" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 8 }}>
        <div>
          <label style={labelStyle}>Value</label>
          <input value={value} onChange={(e) => setValue(e.target.value)} style={inputStyle} type="number" min="0" />
        </div>
        <div>
          <label style={labelStyle}>Currency</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputStyle}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.code}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label style={labelStyle}>Notes (optional)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} placeholder="Any extra details" />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCancel} style={{ ...buttonStyles.secondary, padding: "10px 14px" }}>Cancel</button>
        <button onClick={save} style={{ ...btnStyle, padding: "10px 14px" }}>{editData ? "Update" : "Save Asset"}</button>
      </div>
    </div>
  );
}

export function AddLiabilityForm({ onSave, onCancel, editData }) {
  const [name, setName] = useState(editData?.name || "");
  const [value, setValue] = useState(editData?.value?.toString() || "");
  const [currency, setCurrency] = useState(editData?.currency || CURRENCIES[0].code);
  const [type, setType] = useState(editData?.type || LIABILITY_TYPES[0].id);
  const [interest, setInterest] = useState(editData?.interest?.toString() || "");
  const selectedType = LIABILITY_TYPES.find((t) => t.id === type) || LIABILITY_TYPES[0];

  const save = () => {
    const sanitizedName = sanitizeInput(name, "text");
    const sanitizedValue = sanitizeInput(value, "number");
    const sanitizedInterest = sanitizeInput(interest, "number");

    if (!sanitizedName || sanitizedValue <= 0) {
      notifyApp("Please enter valid liability name and positive amount.", "error");
      return;
    }

    onSave({
      id: editData?.id || Date.now(),
      name: sanitizedName,
      value: sanitizedValue,
      currency,
      type,
      interest: sanitizedInterest,
      icon: selectedType.icon,
      label: selectedType.label,
    });
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <label style={labelStyle}>Liability Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="e.g. Home Loan, Credit Card" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 8 }}>
        <div>
          <label style={labelStyle}>Outstanding Amount</label>
          <input value={value} onChange={(e) => setValue(e.target.value)} style={inputStyle} type="number" min="0" />
        </div>
        <div>
          <label style={labelStyle}>Currency</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputStyle}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.code}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 8 }}>
        <div>
          <label style={labelStyle}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
            {LIABILITY_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Interest %</label>
          <input value={interest} onChange={(e) => setInterest(e.target.value)} style={inputStyle} type="number" min="0" step="0.01" placeholder="Optional" />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCancel} style={{ ...buttonStyles.secondary, padding: "10px 14px" }}>Cancel</button>
        <button onClick={save} style={{ ...btnStyle, padding: "10px 14px" }}>{editData ? "Update" : "Save Liability"}</button>
      </div>
    </div>
  );
}

export default AddAssetForm;

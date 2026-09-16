import { useState, useRef } from "react";
import { PageSection, PageHeader, PageTitle, notifyApp } from "../../components/shared/ui";
import { buttonStyles } from "../../styles";
import { parseAngelOneHoldingsFile, buildAngelOneAssetEntries } from "../../services/angelOneImportService";
import { parseHdfcStatementFile, buildImportedHdfcEntries } from "../../services/hdfcImportService";

function PillToggle({ options, selected, onChange }) {
  return (
    <div style={{ display: "inline-flex", background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 4 }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            background: selected === opt.value ? "rgba(255,255,255,0.15)" : "transparent",
            color: selected === opt.value ? "#fff" : "rgba(255,255,255,0.6)",
            border: "none",
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 13,
            fontWeight: selected === opt.value ? 600 : 500,
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Dropzone({ accept, onDropFile, title, subtitle }) {
  const [isDrag, setIsDrag] = useState(false);
  const fileInput = useRef();

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDrag(true); }}
      onDragLeave={() => setIsDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDrag(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onDropFile(file);
      }}
      onClick={() => fileInput.current?.click()}
      style={{
        border: `2px dashed ${isDrag ? "#38bdf8" : "rgba(255,255,255,0.15)"}`,
        borderRadius: 12,
        padding: "40px 20px",
        textAlign: "center",
        cursor: "pointer",
        background: isDrag ? "rgba(56, 189, 248, 0.05)" : "rgba(255, 255, 255, 0.02)",
        transition: "all 0.2s ease"
      }}
    >
      <input type="file" ref={fileInput} accept={accept} style={{ display: "none" }} onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) onDropFile(file);
        e.target.value = '';
      }} />
      <div style={{ fontSize: 32, marginBottom: 12 }}>{isDrag ? "📂" : "📥"}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{subtitle}</div>
    </div>
  );
}

export default function ImportPage({
  currency,
  isMobile,
  onImportHoldings,
  onImportIncome,
  onImportExpense,
}) {
  const [activeTab, setActiveTab] = useState("wealth");
  
  // Wealth states
  const [wealthSource, setWealthSource] = useState("broker");
  const [wealthMode, setWealthMode] = useState("update");

  // Money states
  const [moneySource, setMoneySource] = useState("bank");

  const [recentImports, setRecentImports] = useState([]);

  const handleAngelOneImport = async (file) => {
    try {
      const entries = buildAngelOneAssetEntries(await parseAngelOneHoldingsFile(file), currency);
      if (!entries?.length) { 
        notifyApp("No valid holdings found.", "warning"); 
        return; 
      }
      onImportHoldings?.(entries, wealthMode);
      setRecentImports(prev => [{ id: Date.now(), title: file.name, count: entries.length, type: 'wealth', date: new Date() }, ...prev]);
      notifyApp(`Imported ${entries.length} holding${entries.length !== 1 ? "s" : ""}.`, "success");
    } catch {
      notifyApp("Unable to import. Please upload a valid AngelOne .xls/.xlsx file.", "error"); 
    }
  };

  const handleHdfcImport = async (file) => {
    try {
      const parsed = await parseHdfcStatementFile(file);
      const { incomeEntries, expenseEntries } = buildImportedHdfcEntries(parsed, currency);
      const total = incomeEntries.length + expenseEntries.length;
      if (total === 0) { 
        notifyApp("No valid transactions found.", "warning"); 
        return; 
      }
      if (incomeEntries.length) onImportIncome(incomeEntries);
      if (expenseEntries.length) onImportExpense(expenseEntries);
      setRecentImports(prev => [{ id: Date.now(), title: file.name, count: total, type: 'money', date: new Date() }, ...prev]);
      notifyApp(`Imported ${incomeEntries.length} income and ${expenseEntries.length} expense entries.`, "success");
    } catch { 
      notifyApp("Unable to import. Please upload a valid HDFC statement (.csv/.xls/.xlsx).", "error"); 
    }
  };

  return (
    <PageSection $isMobile={isMobile}>
      <PageHeader $isMobile={isMobile} style={{ flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
        <PageTitle title="Import" subtitle="Bulk import assets, income & expenses" />
      </PageHeader>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        <button 
          onClick={() => setActiveTab('wealth')} 
          style={{ 
            ...buttonStyles.primary, 
            background: activeTab === 'wealth' ? buttonStyles.primary.background : "rgba(255,255,255,0.05)",
            border: activeTab === 'wealth' ? buttonStyles.primary.border : "1px solid rgba(255,255,255,0.1)",
            boxShadow: activeTab === 'wealth' ? buttonStyles.primary.boxShadow : "none",
            color: activeTab === 'wealth' ? "#fff" : "rgba(255,255,255,0.6)"
          }}
        >
          Assets
        </button>
        <button 
          onClick={() => setActiveTab('money')} 
          style={{ 
            ...buttonStyles.primary, 
            background: activeTab === 'money' ? buttonStyles.primary.background : "rgba(255,255,255,0.05)",
            border: activeTab === 'money' ? buttonStyles.primary.border : "1px solid rgba(255,255,255,0.1)",
            boxShadow: activeTab === 'money' ? buttonStyles.primary.boxShadow : "none",
            color: activeTab === 'money' ? "#fff" : "rgba(255,255,255,0.6)"
          }}
        >
          Income & Expenses
        </button>
      </div>

      <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.05)", padding: isMobile ? 20 : 32, paddingBottom: 40 }}>
        {activeTab === 'wealth' && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16 }}>
              <PillToggle 
                options={[{label: "Import from Broker", value: "broker"}, {label: "Standard Import", value: "standard"}]} 
                selected={wealthSource} 
                onChange={setWealthSource} 
              />
              {wealthSource === 'broker' && (
                <PillToggle 
                  options={[{label: "Append", value: "append"}, {label: "Update by Name", value: "update"}]} 
                  selected={wealthMode} 
                  onChange={setWealthMode} 
                />
              )}
            </div>

            {wealthSource === 'broker' && (
              <div style={{ background: "rgba(14, 165, 233, 0.05)", padding: "12px 16px", borderRadius: 8, fontSize: 13, color: "rgba(255,255,255,0.8)", border: "1px solid rgba(14, 165, 233, 0.2)" }}>
                <strong style={{ color: "#38bdf8" }}>{wealthMode === 'update' ? 'Update by Name mode: ' : 'Append mode: '}</strong>
                {wealthMode === 'update' 
                  ? "Assets whose names match existing ones will have their value, quantity, and price updated. Assets not in this file are left untouched, and new names are added as fresh entries." 
                  : "All assets in the file will be added as new entries. Existing assets remain untouched."}
              </div>
            )}

            <div>
              <h3 style={{ margin: "0 0 16px 0", color: "#fff", fontSize: 18 }}>Upload holdings file</h3>
              {wealthSource === 'broker' ? (
                <Dropzone 
                  accept=".xls,.xlsx" 
                  onDropFile={handleAngelOneImport} 
                  title="Drag & drop your file here" 
                  subtitle="or click to browse · Excel · up to 2,000 rows" 
                />
              ) : (
                <Dropzone 
                  accept=".csv,.xls,.xlsx" 
                  onDropFile={() => notifyApp("Standard import coming soon!", "warning")} 
                  title="Drag & drop your custom file here" 
                  subtitle="or click to browse · CSV, Excel" 
                />
              )}
            </div>

            {wealthSource === 'broker' && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>We work out the broker from the file, across supported platforms.</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600, textTransform: "uppercase" }}>Broker</span>
                  <div style={{ background: "rgba(255,255,255,0.1)", padding: "6px 12px", borderRadius: 6, fontSize: 13, color: "#fff", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                    📈 Angel One (Currently Supported)
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'money' && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16 }}>
              <PillToggle 
                options={[{label: "Import from Bank", value: "bank"}, {label: "Standard Import", value: "standard"}]} 
                selected={moneySource} 
                onChange={setMoneySource} 
              />
            </div>

            <div>
              <h3 style={{ margin: "0 0 16px 0", color: "#fff", fontSize: 18 }}>Upload statement</h3>
              {moneySource === 'bank' ? (
                <Dropzone 
                  accept=".csv,.xls,.xlsx" 
                  onDropFile={handleHdfcImport} 
                  title="Drag & drop your file here" 
                  subtitle="or click to browse · CSV, Excel or PDF · up to 2000 rows" 
                />
              ) : (
                <Dropzone 
                  accept=".csv,.xls,.xlsx" 
                  onDropFile={() => notifyApp("Standard import coming soon!", "warning")} 
                  title="Drag & drop your custom file here" 
                  subtitle="or click to browse · CSV, Excel" 
                />
              )}
            </div>

            {moneySource === 'bank' && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>We work out the bank from the file, across supported banks.</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600, textTransform: "uppercase" }}>Bank</span>
                  <div style={{ background: "rgba(255,255,255,0.1)", padding: "6px 12px", borderRadius: 6, fontSize: 13, color: "#fff", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                    🏦 HDFC Bank (Currently Supported)
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 40 }}>
        <h3 style={{ color: "#fff", fontSize: 16, margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: 8 }}>
          🕒 Recent imports
        </h3>
        {recentImports.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 14, background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px dashed rgba(255,255,255,0.1)" }}>
            none yet
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recentImports.map((imp) => (
              <div key={imp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 20 }}>{imp.type === 'wealth' ? '📈' : '🏦'}</div>
                  <div>
                    <div style={{ color: "#fff", fontSize: 14, fontWeight: 500 }}>{imp.title}</div>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 }}>
                      {imp.date.toLocaleTimeString()} · {imp.type === 'wealth' ? 'Broker' : 'Bank'}
                    </div>
                  </div>
                </div>
                <div style={{ color: "#38bdf8", fontSize: 13, fontWeight: 600 }}>
                  +{imp.count} items
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageSection>
  );
}
import React, { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import { styles, theme } from './styles';
import { sanitizeInput, validateNumericInput } from './utils/security';
import { formatCurrency } from './utils/formatting';

const WealthTracker = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showMobileNav, setShowMobileNav] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [prevTab, setPrevTab] = useState('dashboard');
  
  const [assets, setAssets] = useState([
    { id: 1, name: 'Savings', value: 50000, type: 'Cash' },
    { id: 2, name: 'Investments', value: 120000, type: 'Stock' },
    { id: 3, name: 'Real Estate', value: 350000, type: 'Real Estate' },
  ]);
  const [liabilities, setLiabilities] = useState([
    { id: 1, name: 'Car Loan', value: 15000, type: 'Loan' },
    { id: 2, name: 'Credit Card', value: 5000, type: 'Credit Card' },
  ]);

  // Form State
  const [newItem, setNewItem] = useState({ name: '', value: '', type: 'Cash' });
  const [previousNetWorth, setPreviousNetWorth] = useState(null);

  // Persistence
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Inject keyframes animation
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes slideInRight {
        from { opacity: 0; transform: translateX(20px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes slideInLeft {
        from { opacity: 0; transform: translateX(-20px); }
        to { opacity: 1; transform: translateX(0); }
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    const savedAssets = localStorage.getItem('wt_assets');
    const savedLiabilities = localStorage.getItem('wt_liabilities');
    const savedPreviousNW = localStorage.getItem('wt_previousNW');
    
    if (savedAssets) setAssets(JSON.parse(savedAssets));
    if (savedLiabilities) setLiabilities(JSON.parse(savedLiabilities));
    if (savedPreviousNW) setPreviousNetWorth(JSON.parse(savedPreviousNW));
  }, []);

  useEffect(() => {
    localStorage.setItem('wt_assets', JSON.stringify(assets));
    localStorage.setItem('wt_liabilities', JSON.stringify(liabilities));
  }, [assets, liabilities]);

  // Track net worth changes
  useEffect(() => {
    if (previousNetWorth === null) {
      setPreviousNetWorth(netWorth);
      localStorage.setItem('wt_previousNW', JSON.stringify(netWorth));
    }
  }, [netWorth, previousNetWorth]);

  // Efficiency: Memoize calculations to prevent re-computation on every render
  const totalAssets = useMemo(() => assets.reduce((acc, curr) => acc + curr.value, 0), [assets]);
  const totalLiabilities = useMemo(() => liabilities.reduce((acc, curr) => acc + curr.value, 0), [liabilities]);
  const netWorth = useMemo(() => totalAssets - totalLiabilities, [totalAssets, totalLiabilities]);

  const chartData = useMemo(() => [
    { name: 'Assets', value: totalAssets },
    { name: 'Liabilities', value: totalLiabilities }
  ], [totalAssets, totalLiabilities]);

  const historyData = useMemo(() => {
    // Simulated history based on current Net Worth for visualization
    const data = [];
    const current = netWorth;
    for (let i = 5; i >= 0; i--) {
      data.push({
        name: i === 0 ? 'Now' : `${i}m ago`,
        value: Math.max(0, current * (1 - (i * 0.08)) + (Math.random() * 2000 - 1000))
      });
    }
    return data;
  }, [netWorth]);

  // Category breakdown
  const assetsByCategory = useMemo(() => {
    const categories = {};
    assets.forEach(asset => {
      categories[asset.type] = (categories[asset.type] || 0) + asset.value;
    });
    return Object.entries(categories).map(([name, value]) => ({
      name,
      value,
      percentage: (value / totalAssets * 100).toFixed(1)
    }));
  }, [assets, totalAssets]);

  const liabilitiesByCategory = useMemo(() => {
    const categories = {};
    liabilities.forEach(liability => {
      categories[liability.type] = (categories[liability.type] || 0) + liability.value;
    });
    return Object.entries(categories).map(([name, value]) => ({
      name,
      value,
      percentage: (value / totalLiabilities * 100).toFixed(1)
    }));
  }, [liabilities, totalLiabilities]);

  // Performance metrics
  const performance = useMemo(() => {
    const change = netWorth - (previousNetWorth || netWorth);
    const changePercent = previousNetWorth ? ((change / previousNetWorth) * 100).toFixed(2) : 0;
    return {
      change,
      changePercent,
      isPositive: change >= 0
    };
  }, [netWorth, previousNetWorth]);

  // Smart Alerts
  const alerts = useMemo(() => {
    const alertsList = [];
    
    // Liability warning
    if (totalLiabilities > totalAssets * 0.3) {
      alertsList.push({
        type: 'warning',
        message: `⚠️ Liabilities are ${((totalLiabilities / totalAssets) * 100).toFixed(0)}% of your assets`
      });
    }
    
    // Positive net worth milestone
    if (netWorth > 0 && (previousNetWorth === null || previousNetWorth <= 0)) {
      alertsList.push({
        type: 'success',
        message: '🎉 Congratulations! You\'ve reached positive net worth!'
      });
    }
    
    // High savings rate
    if (assets.filter(a => a.type === 'Cash').reduce((acc, a) => acc + a.value, 0) > totalAssets * 0.4) {
      alertsList.push({
        type: 'success',
        message: '✅ Strong savings! Cash represents significant portion of assets'
      });
    }
    
    // Investment opportunity
    if (assets.filter(a => a.type === 'Stock').length === 0 && totalAssets > 50000) {
      alertsList.push({
        type: 'info',
        message: '💡 Consider diversifying into stocks for wealth growth'
      });
    }
    
    return alertsList;
  }, [totalAssets, totalLiabilities, netWorth, previousNetWorth, assets]);

  // Export functions
  const exportToCSV = () => {
    let csv = 'Wealth Tracker Report\n\n';
    csv += `Generated: ${new Date().toLocaleDateString()}\n\n`;
    csv += `Net Worth,${formatCurrency(netWorth)}\nTotal Assets,${formatCurrency(totalAssets)}\nTotal Liabilities,${formatCurrency(totalLiabilities)}\n\n`;
    
    csv += 'ASSETS\n';
    assets.forEach(asset => {
      csv += `${asset.name},${asset.type},${formatCurrency(asset.value)}\n`;
    });
    
    csv += '\nLIABILITIES\n';
    liabilities.forEach(liability => {
      csv += `${liability.name},${liability.type},${formatCurrency(liability.value)}\n`;
    });

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
    element.setAttribute('download', `wealth-report-${new Date().toISOString().split('T')[0]}.csv`);
    element.click();
  };

  const exportToJSON = () => {
    const data = {
      generatedDate: new Date().toISOString(),
      netWorth,
      totalAssets,
      totalLiabilities,
      assets,
      liabilities,
      performance
    };

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2)));
    element.setAttribute('download', `wealth-report-${new Date().toISOString().split('T')[0]}.json`);
    element.click();
  };

  const handleDeleteItem = (id, category) => {
    if (confirm('Are you sure you want to delete this item?')) {
      if (category === 'asset') {
        setAssets(assets.filter(item => item.id !== id));
      } else {
        setLiabilities(liabilities.filter(item => item.id !== id));
      }
    }
  };

  const handleQuickAdd = (type, defaultType) => {
    setNewItem({ name: '', value: '', type: defaultType });
    const targetTab = type === 'asset' ? 'wealth' : 'money';
    setPrevTab(activeTab);
    setActiveTab(targetTab);
  };

  const renderQuickAdd = () => (
    <div style={styles.quickAddWidget}>
      <button style={styles.quickAddButton} onClick={() => handleQuickAdd('asset', 'Cash')} title="Add Cash">
        <span style={{fontSize: '1.5rem'}}>💰</span>
        <span>Cash</span>
      </button>
      <button style={styles.quickAddButton} onClick={() => handleQuickAdd('asset', 'Stock')} title="Add Stock Investment">
        <span style={{fontSize: '1.5rem'}}>📈</span>
        <span>Stock</span>
      </button>
      <button style={styles.quickAddButton} onClick={() => handleQuickAdd('asset', 'Real Estate')} title="Add Real Estate">
        <span style={{fontSize: '1.5rem'}}>🏠</span>
        <span>Property</span>
      </button>
      <button style={styles.quickAddButton} onClick={() => handleQuickAdd('liability', 'Loan')} title="Add Loan">
        <span style={{fontSize: '1.5rem'}}>💳</span>
        <span>Loan</span>
      </button>
    </div>
  );

  const renderAlerts = () => (
    <div style={styles.alertContainer}>
      {alerts.map((alert, idx) => (
        <div key={idx} style={{...styles.alert, ...styles['alert' + alert.type.charAt(0).toUpperCase() + alert.type.slice(1)]}}>
          {alert.message}
        </div>
      ))}
    </div>
  );

  const renderCategoryBreakdown = (items, type) => {
    const categories = type === 'asset' ? assetsByCategory : liabilitiesByCategory;
    const total = type === 'asset' ? totalAssets : totalLiabilities;
    
    return (
      <div style={{...styles.card, gridColumn: isMobile ? '1 / -1' : 'auto'}}>
        <span style={styles.cardTitle}>{type === 'asset' ? 'Asset' : 'Liability'} Breakdown</span>
        {categories.map((category) => (
          <div key={category.name} style={styles.categoryCard}>
            <div style={styles.categoryName}>{category.name}</div>
            <div style={{display: 'flex', alignItems: 'center', gap: theme.spacing(1)}}>
              <span style={{fontSize: '0.8rem', minWidth: '50px', textAlign: 'right'}}>{category.percentage}%</span>
              <div style={{...styles.categoryBar, width: '80px'}}>
                <div style={{...styles.categoryBarFill, width: `${category.percentage}%`}} />
              </div>
              <span style={styles.categoryValue}>{formatCurrency(category.value)}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderOthers = () => (
    <div style={styles.dashboardGrid}>
      <div style={{...styles.card, gridColumn: '1 / -1'}}>
        <h3 style={{margin: `0 0 ${theme.spacing(2)} 0`, fontSize: '1.125rem', color: theme.colors.primary}}>
          💡 Financial Tips
        </h3>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: theme.spacing(2)}}>
          <div style={{...styles.card, background: theme.colors.background}}>
            <h4 style={{margin: `0 0 ${theme.spacing(1)} 0`, color: theme.colors.textPrimary}}>📚 Build Emergency Fund</h4>
            <p style={{margin: 0, fontSize: '0.875rem', color: theme.colors.textSecondary}}>
              Aim to save 3-6 months of expenses in liquid assets.
            </p>
          </div>
          <div style={{...styles.card, background: theme.colors.background}}>
            <h4 style={{margin: `0 0 ${theme.spacing(1)} 0`, color: theme.colors.textPrimary}}>📈 Diversify Portfolio</h4>
            <p style={{margin: 0, fontSize: '0.875rem', color: theme.colors.textSecondary}}>
              Don't put all eggs in one basket. Mix stocks, bonds, and real estate.
            </p>
          </div>
          <div style={{...styles.card, background: theme.colors.background}}>
            <h4 style={{margin: `0 0 ${theme.spacing(1)} 0`, color: theme.colors.textPrimary}}>💰 Manage Debt</h4>
            <p style={{margin: 0, fontSize: '0.875rem', color: theme.colors.textSecondary}}>
              Focus on low-interest debt. Prioritize high-interest credit cards.
            </p>
          </div>
          <div style={{...styles.card, background: theme.colors.background}}>
            <h4 style={{margin: `0 0 ${theme.spacing(1)} 0`, color: theme.colors.textPrimary}}>🎯 Set Financial Goals</h4>
            <p style={{margin: 0, fontSize: '0.875rem', color: theme.colors.textSecondary}}>
              Define clear, measurable targets for your wealth growth.
            </p>
          </div>
        </div>
      </div>

      <div style={{...styles.card, gridColumn: '1 / -1'}}>
        <h3 style={{margin: `0 0 ${theme.spacing(2)} 0`, fontSize: '1.125rem', color: theme.colors.primary}}>
          ℹ️ About This App
        </h3>
        <div style={{display: 'grid', gap: theme.spacing(1), fontSize: '0.9375rem', color: theme.colors.textSecondary}}>
          <p>
            <strong>Wealth Tracker</strong> is a privacy-first financial management tool designed to help you track and manage your net worth.
          </p>
          <p>
            ✅ <strong>100% Private:</strong> All data stored locally in your browser<br/>
            ✅ <strong>Secure:</strong> No cloud storage, no tracking<br/>
            ✅ <strong>Free:</strong> No subscription required<br/>
            ✅ <strong>Offline:</strong> Works completely offline
          </p>
          <p style={{marginTop: theme.spacing(2)}}>
            <strong>Version:</strong> 1.0.0<br/>
            <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );

  const handleAddItem = (category) => {
    const cleanName = sanitizeInput(newItem.name);
    const cleanValue = validateNumericInput(newItem.value);

    if (!cleanName || isNaN(cleanValue) || cleanValue <= 0) {
      alert("Please enter valid details");
      return;
    }

    const item = {
      id: Date.now(),
      name: cleanName,
      value: Number(cleanValue),
      type: newItem.type
    };

    if (category === 'asset') {
      setAssets([...assets, item]);
    } else {
      setLiabilities([...liabilities, item]);
    }
    setNewItem({ name: '', value: '', type: 'Cash' });
  };

  const renderDashboard = () => (
    <div>
      {alerts.length > 0 && renderAlerts()}
      
      {renderQuickAdd()}

      <div style={styles.exportButton}>
        <button style={styles.exportBtn} onClick={exportToCSV}>📥 Export CSV</button>
        <button style={styles.exportBtn} onClick={exportToJSON}>📄 Export JSON</button>
      </div>

      <div style={styles.dashboardGrid}>
        <div style={styles.card}>
          <span style={styles.cardTitle}>Net Worth ✨</span>
          <span style={{...styles.cardValue, fontSize: 'clamp(1.25rem, 5vw, 2rem)', color: netWorth >= 0 ? theme.colors.success : theme.colors.error}}>
            {formatCurrency(netWorth)}
          </span>
          {performance.change !== 0 && (
            <span style={{fontSize: '0.8125rem', color: performance.isPositive ? theme.colors.success : theme.colors.error}}>
              {performance.isPositive ? '📈' : '📉'} {formatCurrency(performance.change)} ({performance.changePercent}%)
            </span>
          )}
          <span style={{fontSize: '0.75rem', color: theme.colors.textSecondary}}>
            Assets minus Liabilities
          </span>
        </div>

        <div style={styles.card}>
          <span style={styles.cardTitle}>Total Assets 🏛</span>
          <span style={{...styles.cardValue, color: theme.colors.success}}>
            {formatCurrency(totalAssets)}
          </span>
          <span style={{fontSize: '0.75rem', color: theme.colors.textSecondary}}>
            {assets.length} {assets.length === 1 ? 'asset' : 'assets'}
          </span>
        </div>

        <div style={styles.card}>
          <span style={styles.cardTitle}>Total Liabilities 💳</span>
          <span style={{...styles.cardValue, color: theme.colors.error}}>
            {formatCurrency(totalLiabilities)}
          </span>
          <span style={{fontSize: '0.75rem', color: theme.colors.textSecondary}}>
            {liabilities.length} {liabilities.length === 1 ? 'debt' : 'debts'}
          </span>
        </div>
        
        <div style={{...styles.card, gridColumn: '1 / -1', minHeight: isMobile ? '250px' : '300px'}}>
          <span style={styles.cardTitle}>Wealth Distribution</span>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={isMobile ? 70 : 100}
                paddingAngle={5}
                dataKey="value"
              >
                <Cell key="cell-assets" fill={theme.colors.primary} />
                <Cell key="cell-liabilities" fill={theme.colors.secondary} />
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend verticalAlign="bottom" height={30}/>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{...styles.card, gridColumn: '1 / -1', minHeight: isMobile ? '250px' : '300px'}}>
          <span style={styles.cardTitle}>Net Worth Trend</span>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme.colors.primary} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={theme.colors.primary} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{fontSize: 12}} />
              <YAxis tick={{fontSize: 12}} />
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Area type="monotone" dataKey="value" stroke={theme.colors.primary} fillOpacity={1} fill="url(#colorValue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {assetsByCategory.length > 0 && renderCategoryBreakdown(assets, 'asset')}
        {liabilitiesByCategory.length > 0 && renderCategoryBreakdown(liabilities, 'liability')}
      </div>
    </div>
  );

  const renderList = (items, type) => (
    <div>
      <div style={styles.form}>
        <h3 style={{margin: 0, color: theme.colors.textSecondary, fontSize: '1rem', fontWeight: 600}}>Add New {type === 'asset' ? 'Asset' : 'Liability'}</h3>
        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={{display: 'block', marginBottom: '6px', fontSize: '0.8125rem', fontWeight: 600}}>Name</label>
            <input 
              style={styles.input}
              value={newItem.name}
              onChange={(e) => setNewItem({...newItem, name: e.target.value})}
              placeholder="e.g. House, Car"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={{display: 'block', marginBottom: '6px', fontSize: '0.8125rem', fontWeight: 600}}>Value</label>
            <input 
              style={styles.input}
              type="number"
              value={newItem.value}
              onChange={(e) => setNewItem({...newItem, value: e.target.value})}
              placeholder="0.00"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={{display: 'block', marginBottom: '6px', fontSize: '0.8125rem', fontWeight: 600}}>Type</label>
            <select 
              style={styles.input}
              value={newItem.type}
              onChange={(e) => setNewItem({...newItem, type: e.target.value})}
            >
              <option>Cash</option>
              <option>Real Estate</option>
              <option>Stock</option>
              <option>Crypto</option>
              <option>Loan</option>
              <option>Credit Card</option>
            </select>
          </div>
          <button 
            style={styles.button}
            onClick={() => handleAddItem(type)}
          >
            Add
          </button>
        </div>
      </div>

      <div style={styles.dashboardGrid}>
        {items.length === 0 ? (
          <div style={{...styles.card, gridColumn: '1 / -1', textAlign: 'center'}}>
            <p style={{color: theme.colors.textSecondary, margin: 0}}>No {type === 'asset' ? 'assets' : 'liabilities'} added yet</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} style={styles.card}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing(1)}}>
                <div>
                  <div style={styles.cardTitle}>{item.type}</div>
                  <div style={{fontSize: '1.0625rem', fontWeight: 600, color: theme.colors.textPrimary}}>{item.name}</div>
                </div>
                <button 
                  style={styles.deleteButton}
                  onClick={() => handleDeleteItem(item.id, type)}
                  title="Delete Item"
                >
                  🗑
                </button>
              </div>
              <div style={{marginTop: theme.spacing(1), fontSize: '1rem', fontWeight: 700, color: type === 'asset' ? theme.colors.success : theme.colors.error}}>
                {formatCurrency(item.value)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Wealth Tracker</h1>
          <span style={{...theme.typography.caption, fontSize: '0.75rem'}}>Secure • Private • Local</span>
        </div>
        <div style={{textAlign: 'right'}}>
          <div style={{...theme.typography.caption, fontSize: '0.75rem'}}>Current Net Worth</div>
          <div style={{fontSize: 'clamp(1rem, 4vw, 1.5rem)', fontWeight: 'bold', color: theme.colors.primary}}>
            {formatCurrency(netWorth)}
          </div>
        </div>
      </header>

      <nav style={styles.tabContainer}>
        <button 
          style={styles.tab(activeTab === 'dashboard')} 
          onClick={() => { setPrevTab(activeTab); setActiveTab('dashboard'); }}
        >
          📊 Dashboard
        </button>
        <button 
          style={styles.tab(activeTab === 'wealth')} 
          onClick={() => { setPrevTab(activeTab); setActiveTab('wealth'); }}
        >
          💎 Wealth
        </button>
        <button 
          style={styles.tab(activeTab === 'money')} 
          onClick={() => { setPrevTab(activeTab); setActiveTab('money'); }}
        >
          💰 Money
        </button>
        <button 
          style={styles.tab(activeTab === 'others')} 
          onClick={() => { setPrevTab(activeTab); setActiveTab('others'); }}
        >
          ⚙️ Others
        </button>
      </nav>

      <main style={{animation: 'fadeInUp 0.4s ease-out'}}>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'wealth' && renderList(assets, 'asset')}
        {activeTab === 'money' && renderList(liabilities, 'liability')}
        {activeTab === 'others' && renderOthers()}
      </main>

      {isMobile && (
        <nav style={styles.mobileNav}>
          <button 
            style={{...styles.navButton, ...(activeTab === 'dashboard' ? styles.navButtonActive : {})}}
            onClick={() => { setPrevTab(activeTab); setActiveTab('dashboard'); }}
            title="Dashboard"
          >
            <span style={{fontSize: '1.5rem', transition: 'transform 0.3s ease'}}>📊</span>
            <span>Dashboard</span>
          </button>
          <button 
            style={{...styles.navButton, ...(activeTab === 'wealth' ? styles.navButtonActive : {})}}
            onClick={() => { setPrevTab(activeTab); setActiveTab('wealth'); }}
            title="Wealth"
          >
            <span style={{fontSize: '1.5rem', transition: 'transform 0.3s ease'}}>💎</span>
            <span>Wealth</span>
          </button>
          <button 
            style={{...styles.navButton, ...(activeTab === 'money' ? styles.navButtonActive : {})}}
            onClick={() => { setPrevTab(activeTab); setActiveTab('money'); }}
            title="Money"
          >
            <span style={{fontSize: '1.5rem', transition: 'transform 0.3s ease'}}>💰</span>
            <span>Money</span>
          </button>
          <button 
            style={{...styles.navButton, ...(activeTab === 'others' ? styles.navButtonActive : {})}}
            onClick={() => { setPrevTab(activeTab); setActiveTab('others'); }}
            title="Others"
          >
            <span style={{fontSize: '1.5rem', transition: 'transform 0.3s ease'}}>⚙️</span>
            <span>Others</span>
          </button>
        </nav>
      )}
    </div>
  );
};

export default WealthTracker;
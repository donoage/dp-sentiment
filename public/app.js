// Holdings data (will be fetched from server)
let SPY_HOLDINGS = [];
let QQQ_HOLDINGS = [];
let ALL_TICKERS = [];

// Fetch holdings configuration
async function fetchHoldings() {
  try {
    const response = await fetch('/api/holdings');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    if (!data.spy || !data.qqq) {
      throw new Error('Invalid holdings data received');
    }
    
    SPY_HOLDINGS = data.spy;
    QQQ_HOLDINGS = data.qqq;
    
    const spyTickers = SPY_HOLDINGS.map(h => h.ticker);
    const qqqTickers = QQQ_HOLDINGS.map(h => h.ticker);
    ALL_TICKERS = [...new Set([...spyTickers, ...qqqTickers])];
    
    console.log(`Loaded ${SPY_HOLDINGS.length} SPY holdings and ${QQQ_HOLDINGS.length} QQQ holdings`);
  } catch (error) {
    console.error('Error fetching holdings:', error);
    throw error; // Re-throw to prevent initialization from continuing
  }
}

// Fetch and update sentiment data
async function fetchSentiments() {
  try {
    const response = await fetch('/api/sentiments');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    updateDashboard(data);
  } catch (error) {
    console.error('Error fetching sentiments:', error);
    // Don't throw - allow retries via interval
  }
}

function formatCurrency(amount) {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
  
  // Add abbreviated format in parentheses
  let abbreviated = '';
  const absAmount = Math.abs(amount);
  
  if (absAmount >= 1000000000) {
    abbreviated = `(${(amount / 1000000000).toFixed(2)}B)`;
  } else if (absAmount >= 1000000) {
    abbreviated = `(${(amount / 1000000).toFixed(2)}M)`;
  }
  
  return abbreviated ? `${formatted} ${abbreviated}` : formatted;
}

function updateDashboard(sentiments) {
  // Update last updated time
  document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
  
  // Create a map of sentiment data
  const sentimentMap = {};
  sentiments.forEach(ticker => {
    sentimentMap[ticker.ticker] = ticker;
  });
  
  // Calculate totals
  let totalBullish = 0;
  let totalBearish = 0;
  let activeTickers = 0;
  
  sentiments.forEach(ticker => {
    totalBullish += parseFloat(ticker.bullish_amount || 0);
    totalBearish += parseFloat(ticker.bearish_amount || 0);
    if (parseFloat(ticker.bullish_amount || 0) > 0 || parseFloat(ticker.bearish_amount || 0) > 0) {
      activeTickers++;
    }
  });
  
  const netSentiment = totalBullish - totalBearish;
  
  // Update summary cards
  document.getElementById('totalBullish').textContent = formatCurrency(totalBullish);
  document.getElementById('totalBearish').textContent = formatCurrency(totalBearish);
  document.getElementById('netSentiment').textContent = formatCurrency(netSentiment);
  
  // Update net sentiment color
  const netElement = document.getElementById('netSentiment');
  netElement.style.color = netSentiment > 0 ? '#10b981' : netSentiment < 0 ? '#ef4444' : '#3b82f6';
  
  // Update SPY table
  updateTable('spyTable', SPY_HOLDINGS, sentimentMap, 'spy');
  
  // Update QQQ table
  updateTable('qqqTable', QQQ_HOLDINGS, sentimentMap, 'qqq');
  
  // Update active tickers count in header
  const subtitle = document.querySelector('.subtitle');
  if (subtitle) {
    subtitle.textContent = `Real-time darkpool sentiment for SPY & QQQ top holdings (${activeTickers}/${ALL_TICKERS.length} active)`;
  }
}

function updateTable(tableId, holdings, sentimentMap, etfType) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.innerHTML = '';
  
  // Don't update if holdings aren't loaded yet
  if (!holdings || holdings.length === 0) {
    return;
  }
  
  holdings.forEach(holding => {
    const ticker = holding.ticker;
    const weight = holding.weight;
    const data = sentimentMap[ticker] || {
      ticker: ticker,
      bullish_amount: 0,
      bearish_amount: 0
    };
    
    const bullishAmount = parseFloat(data.bullish_amount || 0);
    const bearishAmount = parseFloat(data.bearish_amount || 0);
    const net = bullishAmount - bearishAmount;
    const hasActivity = bullishAmount > 0 || bearishAmount > 0;
    
    // Calculate sentiment strength and bias
    const totalVolume = bullishAmount + bearishAmount;
    const bullishPercent = totalVolume > 0 ? (bullishAmount / totalVolume) * 100 : 0;
    const bearishPercent = totalVolume > 0 ? (bearishAmount / totalVolume) * 100 : 0;
    const minThreshold = 250000; // $250K minimum for extreme detection
    
    let sentimentBadge = '';
    let sentimentText = 'Waiting...';
    let rowClass = hasActivity ? '' : 'inactive-row';
    let extremeBadge = '';
    
    if (hasActivity) {
      // Check for extreme sentiment
      if (Math.abs(net) >= minThreshold) {
        if (bullishPercent >= 85) {
          extremeBadge = '<span class="badge badge-extreme badge-extreme-bullish">⚡ EXTREME BULLISH</span>';
          rowClass += ' extreme-row extreme-bullish-row';
        } else if (bearishPercent >= 85) {
          extremeBadge = '<span class="badge badge-extreme badge-extreme-bearish">⚡ EXTREME BEARISH</span>';
          rowClass += ' extreme-row extreme-bearish-row';
        } else if (bullishPercent >= 70) {
          extremeBadge = '<span class="badge badge-strong badge-strong-bullish">🔥 Strong Bullish</span>';
          rowClass += ' strong-row';
        } else if (bearishPercent >= 70) {
          extremeBadge = '<span class="badge badge-strong badge-strong-bearish">❄️ Strong Bearish</span>';
          rowClass += ' strong-row';
        }
      }
      
      if (net > 0) {
        sentimentBadge = '<span class="badge badge-bullish">🟢 Bullish</span>';
        sentimentText = 'Bullish';
      } else if (net < 0) {
        sentimentBadge = '<span class="badge badge-bearish">🔴 Bearish</span>';
        sentimentText = 'Bearish';
      } else {
        sentimentBadge = '<span class="badge badge-neutral">⚪ Neutral</span>';
        sentimentText = 'Neutral';
      }
    } else {
      sentimentBadge = '<span class="badge badge-waiting">⏳ Waiting...</span>';
    }
    
    const row = document.createElement('tr');
    row.className = rowClass;
    row.innerHTML = `
      <td class="ticker-cell"><strong>${ticker}</strong> ${extremeBadge}</td>
      <td class="weight-cell">${weight.toFixed(2)}%</td>
      <td class="sentiment-cell">${sentimentBadge}</td>
      <td class="amount-cell bullish-text">${formatCurrency(bullishAmount)}</td>
      <td class="amount-cell bearish-text">${formatCurrency(bearishAmount)}</td>
      <td class="amount-cell net-text" style="color: ${net > 0 ? '#10b981' : net < 0 ? '#ef4444' : '#6b7280'}; font-weight: 600;">${formatCurrency(net)}</td>
    `;
    
    tbody.appendChild(row);
  });
}

// Dark mode functionality
function initDarkMode() {
  const darkModeToggle = document.getElementById('darkModeToggle');
  const toggleIcon = darkModeToggle.querySelector('.toggle-icon');
  
  // Check for saved dark mode preference
  const isDarkMode = localStorage.getItem('darkMode') === 'true';
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
    toggleIcon.textContent = '☀️';
  }
  
  // Toggle dark mode
  darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isNowDark = document.body.classList.contains('dark-mode');
    toggleIcon.textContent = isNowDark ? '☀️' : '🌙';
    localStorage.setItem('darkMode', isNowDark);
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize dark mode
    initDarkMode();
    
    await fetchHoldings(); // Fetch holdings first
    await fetchSentiments(); // Then fetch sentiments
    
    // Poll every 30 seconds to reduce network usage
    // Data updates are not time-critical for this dashboard
    setInterval(fetchSentiments, 30000);
  } catch (error) {
    console.error('Error initializing dashboard:', error);
  }
});


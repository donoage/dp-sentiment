// Holdings data (will be fetched from server)
let SPY_HOLDINGS = [];
let QQQ_HOLDINGS = [];
let ALL_TICKERS = [];

// WebSocket connection
let ws = null;
let wsReconnectAttempts = 0;
let wsReconnectTimeout = null;
let useFallback = false;

// Sentiment data cache (for incremental updates)
let sentimentCache = {};

// Intraday chart instance
let intradayChart = null;

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

    console.log(
      `Loaded ${SPY_HOLDINGS.length} SPY holdings and ${QQQ_HOLDINGS.length} QQQ holdings`
    );
  } catch (error) {
    console.error('Error fetching holdings:', error);
    throw error; // Re-throw to prevent initialization from continuing
  }
}

// Fetch and update sentiment data (HTTP fallback)
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

// WebSocket connection
function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return; // Already connected or connecting
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  console.log('🔌 Connecting to WebSocket:', wsUrl);
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('✅ WebSocket connected');
    wsReconnectAttempts = 0;
    useFallback = false;
  };

  ws.onmessage = event => {
    try {
      const message = JSON.parse(event.data);

      if (message.type === 'initial' || message.type === 'full') {
        // Full data update - rebuild cache
        sentimentCache = {};
        message.data.forEach(ticker => {
          sentimentCache[ticker.ticker] = {
            bullish_amount: parseFloat(ticker.bullish_amount || 0),
            bearish_amount: parseFloat(ticker.bearish_amount || 0),
            last_updated: ticker.last_updated,
          };
        });
        updateDashboard(message.data);
      } else if (message.type === 'batch_update') {
        // Batch incremental updates
        message.updates.forEach(update => {
          if (!sentimentCache[update.ticker]) {
            sentimentCache[update.ticker] = { bullish_amount: 0, bearish_amount: 0 };
          }
          sentimentCache[update.ticker].bullish_amount += parseFloat(update.bullish_amount);
          sentimentCache[update.ticker].bearish_amount += parseFloat(update.bearish_amount);
        });
        // Update dashboard with cached data
        const sentiments = Object.keys(sentimentCache).map(ticker => ({
          ticker: ticker,
          bullish_amount: sentimentCache[ticker].bullish_amount,
          bearish_amount: sentimentCache[ticker].bearish_amount,
          last_updated: sentimentCache[ticker].last_updated,
        }));
        updateDashboard(sentiments);
      } else if (message.type === 'intraday_snapshot') {
        // New intraday snapshot saved - refresh chart if viewing today
        console.log('📊 New intraday snapshot available', message.timestamp);
        if (intradayChart) {
          const datePicker = document.getElementById('chartDatePicker');
          const selectedDate = datePicker ? datePicker.value : null;
          const today = new Date().toISOString().split('T')[0];

          console.log('📅 Selected date:', selectedDate, 'Today:', today);

          // Only auto-refresh if viewing today
          if (!selectedDate || selectedDate === today) {
            console.log('🔄 Refreshing intraday chart...');
            intradayChart.fetchData();
          } else {
            console.log('⏸️ Not refreshing - viewing historical date:', selectedDate);
          }
        } else {
          console.log('⚠️ intradayChart not initialized yet');
        }
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  ws.onerror = error => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    ws = null;

    // Attempt to reconnect with exponential backoff
    wsReconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, wsReconnectAttempts), 30000);

    console.log(`Reconnecting in ${delay / 1000}s... (attempt ${wsReconnectAttempts})`);

    wsReconnectTimeout = setTimeout(() => {
      if (wsReconnectAttempts > 3) {
        console.log('⚠️ Falling back to HTTP polling');
        useFallback = true;
      }
      connectWebSocket();
    }, delay);
  };
}

// No longer needed - handled in ws.onmessage with batch updates

function formatCurrency(amount) {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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
  // Update last updated time (only during market hours: 7:00 AM - 8:00 PM ET)
  const now = new Date();
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  const marketOpen = 7 * 60; // 7:00 AM
  const marketClose = 20 * 60; // 8:00 PM

  if (timeInMinutes >= marketOpen && timeInMinutes < marketClose) {
    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
  }

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

  // Update net sentiment badge
  const netBadgeElement = document.getElementById('netSentimentBadge');
  const netAbsValue = Math.abs(netSentiment);
  let netBadge = '';

  // Determine badge based on net sentiment magnitude
  if (netAbsValue > 50000000) {
    // > $50M
    if (netSentiment > 0) {
      netBadge =
        '<span class="badge badge-extreme badge-extreme-bullish">🟢 EXTREME BULLISH</span>';
    } else {
      netBadge =
        '<span class="badge badge-extreme badge-extreme-bearish">🔴 EXTREME BEARISH</span>';
    }
  } else if (netAbsValue > 20000000) {
    // > $20M
    if (netSentiment > 0) {
      netBadge = '<span class="badge badge-strong badge-strong-bullish">🟢 STRONG BULLISH</span>';
    } else {
      netBadge = '<span class="badge badge-strong badge-strong-bearish">🔴 STRONG BEARISH</span>';
    }
  } else if (netSentiment > 0) {
    netBadge = '<span class="badge badge-bullish">🟢 Bullish</span>';
  } else if (netSentiment < 0) {
    netBadge = '<span class="badge badge-bearish">🔴 Bearish</span>';
  } else {
    netBadge = '<span class="badge badge-neutral">⚪ Neutral</span>';
  }

  netBadgeElement.innerHTML = netBadge;

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
      bearish_amount: 0,
    };

    const bullishAmount = parseFloat(data.bullish_amount || 0);
    const bearishAmount = parseFloat(data.bearish_amount || 0);
    const net = bullishAmount - bearishAmount;
    const hasActivity = bullishAmount > 0 || bearishAmount > 0;

    // Calculate sentiment strength and bias
    const totalVolume = bullishAmount + bearishAmount;
    const bullishPercent = totalVolume > 0 ? (bullishAmount / totalVolume) * 100 : 0;
    const bearishPercent = totalVolume > 0 ? (bearishAmount / totalVolume) * 100 : 0;
    const minThreshold = 10000000; // $10M minimum for extreme detection

    let sentimentBadge = '';
    let sentimentText = 'Waiting...';
    let rowClass = hasActivity ? '' : 'inactive-row';
    let extremeBadge = '';

    if (hasActivity) {
      // Check for extreme sentiment - use as primary badge
      if (Math.abs(net) >= minThreshold) {
        if (bullishPercent >= 85) {
          sentimentBadge =
            '<span class="badge badge-extreme badge-extreme-bullish">⚡ EXTREME BULLISH</span>';
          rowClass += ' extreme-row extreme-bullish-row';
        } else if (bearishPercent >= 85) {
          sentimentBadge =
            '<span class="badge badge-extreme badge-extreme-bearish">⚡ EXTREME BEARISH</span>';
          rowClass += ' extreme-row extreme-bearish-row';
        } else if (bullishPercent >= 70) {
          sentimentBadge =
            '<span class="badge badge-strong badge-strong-bullish">🔥 Strong Bullish</span>';
          rowClass += ' strong-row';
        } else if (bearishPercent >= 70) {
          sentimentBadge =
            '<span class="badge badge-strong badge-strong-bearish">❄️ Strong Bearish</span>';
          rowClass += ' strong-row';
        } else {
          // Regular sentiment
          if (net > 0) {
            sentimentBadge = '<span class="badge badge-bullish">🟢 Bullish</span>';
          } else if (net < 0) {
            sentimentBadge = '<span class="badge badge-bearish">🔴 Bearish</span>';
          } else {
            sentimentBadge = '<span class="badge badge-neutral">⚪ Neutral</span>';
          }
        }
      } else {
        // Regular sentiment (below threshold)
        if (net > 0) {
          sentimentBadge = '<span class="badge badge-bullish">🟢 Bullish</span>';
        } else if (net < 0) {
          sentimentBadge = '<span class="badge badge-bearish">🔴 Bearish</span>';
        } else {
          sentimentBadge = '<span class="badge badge-neutral">⚪ Neutral</span>';
        }
      }
    } else {
      sentimentBadge = '<span class="badge badge-waiting">⏳ Waiting...</span>';
    }

    const row = document.createElement('tr');
    row.className = rowClass;
    row.innerHTML = `
      <td class="ticker-cell"><strong>${ticker}</strong></td>
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

    // Redraw chart with new theme
    if (intradayChart) {
      intradayChart.draw();
    }
  });
}

// Initialize intraday chart
function initIntradayChart() {
  if (!window.IntradayChart) {
    console.error('IntradayChart class not loaded');
    return;
  }

  intradayChart = new window.IntradayChart('chartContainer');
  intradayChart.init();

  // Set up date picker
  const datePicker = document.getElementById('chartDatePicker');
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  datePicker.value = todayStr;
  datePicker.max = todayStr;

  datePicker.addEventListener('change', async () => {
    const selectedDate = datePicker.value;
    if (selectedDate) {
      await intradayChart.fetchData(selectedDate);
    }
  });

  // Set up refresh button
  const refreshBtn = document.getElementById('chartRefreshBtn');
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    const selectedDate = datePicker.value;
    await intradayChart.fetchData(selectedDate || null);
    refreshBtn.disabled = false;
  });

  // Load initial data (today)
  intradayChart.fetchData();
}

// Auto-refresh chart every 5 minutes during market hours
function startChartAutoRefresh() {
  setInterval(
    () => {
      const now = new Date();
      const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const hours = etTime.getHours();
      const minutes = etTime.getMinutes();
      const timeInMinutes = hours * 60 + minutes;
      const marketOpen = 9 * 60 + 30; // 9:30 AM
      const marketClose = 16 * 60; // 4:00 PM

      // Only auto-refresh during market hours
      if (timeInMinutes >= marketOpen && timeInMinutes < marketClose) {
        if (intradayChart) {
          const datePicker = document.getElementById('chartDatePicker');
          const selectedDate = datePicker.value;
          const today = new Date().toISOString().split('T')[0];

          // Only auto-refresh if viewing today
          if (!selectedDate || selectedDate === today) {
            intradayChart.fetchData();
          }
        }
      }
    },
    5 * 60 * 1000
  ); // 5 minutes
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize dark mode
    initDarkMode();

    await fetchHoldings(); // Fetch holdings first

    // Initialize intraday chart
    initIntradayChart();

    // Start chart auto-refresh
    startChartAutoRefresh();

    // Connect via WebSocket for real-time updates
    // WebSocket will send initial data on connection
    connectWebSocket();

    // Fallback: Only poll if WebSocket fails to connect
    setInterval(() => {
      if (useFallback || !ws || ws.readyState !== WebSocket.OPEN) {
        fetchSentiments();
      }
    }, 20000);
  } catch (error) {
    console.error('Error initializing dashboard:', error);
  }
});

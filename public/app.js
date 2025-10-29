// SPY and QQQ holdings
const SPY_TICKERS = [
  'NVDA', 'MSFT', 'AAPL', 'AMZN', 'META', 'AVGO', 'GOOGL', 'GOOG', 
  'TSLA', 'BRK.B', 'JPM', 'JNJ', 'UNH', 'XOM', 'PG'
];

const QQQ_TICKERS = [
  'AAPL', 'MSFT', 'AMZN', 'NVDA', 'META', 'GOOGL', 'GOOG', 'TSLA',
  'AVGO', 'PEP', 'COST', 'ADBE', 'CSCO', 'CMCSA', 'INTC'
];

const ALL_TICKERS = [...new Set([...SPY_TICKERS, ...QQQ_TICKERS])];

// Fetch and update sentiment data
async function fetchSentiments() {
  try {
    const response = await fetch('/api/sentiments');
    const data = await response.json();
    updateDashboard(data);
  } catch (error) {
    console.error('Error fetching sentiments:', error);
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
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
  updateTable('spyTable', SPY_TICKERS, sentimentMap);
  
  // Update QQQ table
  updateTable('qqqTable', QQQ_TICKERS, sentimentMap);
  
  // Update active tickers count in header
  const subtitle = document.querySelector('.subtitle');
  if (subtitle) {
    subtitle.textContent = `Real-time darkpool sentiment for SPY & QQQ top holdings (${activeTickers}/${ALL_TICKERS.length} active)`;
  }
}

function updateTable(tableId, tickers, sentimentMap) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.innerHTML = '';
  
  tickers.forEach(ticker => {
    const data = sentimentMap[ticker] || {
      ticker: ticker,
      bullish_amount: 0,
      bearish_amount: 0
    };
    
    const bullishAmount = parseFloat(data.bullish_amount || 0);
    const bearishAmount = parseFloat(data.bearish_amount || 0);
    const net = bullishAmount - bearishAmount;
    const hasActivity = bullishAmount > 0 || bearishAmount > 0;
    
    let sentimentBadge = '';
    let sentimentText = 'Waiting...';
    let rowClass = hasActivity ? '' : 'inactive-row';
    
    if (hasActivity) {
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
      <td class="ticker-cell"><strong>${ticker}</strong></td>
      <td class="sentiment-cell">${sentimentBadge}</td>
      <td class="amount-cell bullish-text">${formatCurrency(bullishAmount)}</td>
      <td class="amount-cell bearish-text">${formatCurrency(bearishAmount)}</td>
      <td class="amount-cell net-text" style="color: ${net > 0 ? '#10b981' : net < 0 ? '#ef4444' : '#6b7280'}; font-weight: 600;">${formatCurrency(net)}</td>
    `;
    
    tbody.appendChild(row);
  });
}

// Initial fetch
fetchSentiments();

// Update every 10 seconds
setInterval(fetchSentiments, 10000);


// Modular Chart Component for Intraday Sentiment Tracking
class IntradayChart {
  constructor(containerId) {
    this.containerId = containerId;
    this.canvas = null;
    this.ctx = null;
    this.data = [];
    this.chartPadding = { top: 40, right: 60, bottom: 60, left: 100 };
    this.hoveredPoint = null;
    this.isDarkMode = false;
  }

  // Initialize the chart
  init() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`Container ${this.containerId} not found`);
      return;
    }

    // Clear any existing content (like loading message)
    container.innerHTML = '';

    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'intradayChart';
    this.canvas.style.cursor = 'crosshair';
    container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    
    // Set canvas size
    this.resizeCanvas();
    
    // Add event listeners
    window.addEventListener('resize', () => this.resizeCanvas());
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());

    // Check for dark mode
    this.updateDarkMode();
  }

  // Update dark mode state
  updateDarkMode() {
    this.isDarkMode = document.body.classList.contains('dark-mode');
  }

  // Resize canvas to fit container
  resizeCanvas() {
    const container = document.getElementById(this.containerId);
    const rect = container.getBoundingClientRect();
    
    // Set canvas size with device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = 400 * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = '400px';
    
    this.ctx.scale(dpr, dpr);
    
    // Redraw if we have data
    if (this.data.length > 0) {
      this.draw();
    }
  }

  // Fetch and update chart data
  async fetchData(date = null) {
    try {
      const url = date 
        ? `/api/intraday-snapshots?date=${date}`
        : `/api/intraday-snapshots`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const snapshots = await response.json();
      
      console.log(`Fetched ${snapshots.length} snapshots`);
      
      if (snapshots.length > 0) {
        console.log('Sample snapshot:', snapshots[0]);
      }
      
      // If no date specified, filter to today's data (in ET timezone)
      if (!date) {
        // Use Luxon for reliable timezone handling
        const { DateTime } = luxon;
        const today = DateTime.now().setZone('America/New_York').toFormat('yyyy-MM-dd');
        
        console.log(`Filtering for today (ET): ${today}`);
        
        this.data = snapshots
          .filter(s => {
            const { DateTime } = luxon;
            const snapshotDT = DateTime.fromISO(s.snapshot_time, { zone: 'utc' }).setZone('America/New_York');
            const snapshotDateStr = snapshotDT.toFormat('yyyy-MM-dd');
            
            // Check if it's today
            if (snapshotDateStr !== today) return false;
            
            // Get ET hours - data collection hours are 7:00 AM - 8:00 PM ET
            const etDT = DateTime.fromISO(s.snapshot_time, { zone: 'utc' }).setZone('America/New_York');
            const etTimeInMinutes = etDT.hour * 60 + etDT.minute;
            
            // Data collection hours: 7:00 AM - 8:00 PM ET
            const dataStartET = 7 * 60;      // 7:00 AM
            const dataEndET = 20 * 60;       // 8:00 PM
            
            return etTimeInMinutes >= dataStartET && etTimeInMinutes < dataEndET;
          })
          .map(s => {
            // Parse the UTC time directly - the Date object will handle display correctly
            const time = new Date(s.snapshot_time);
            
            return {
              time: time,
              bullish: parseFloat(s.total_bullish),
              bearish: parseFloat(s.total_bearish),
              net: parseFloat(s.net_sentiment)
            };
          })
          .sort((a, b) => a.time - b.time);
      } else {
        this.data = snapshots
          .filter(s => {
            const { DateTime } = luxon;
            
            // Get ET hours - data collection hours are 7:00 AM - 8:00 PM ET
            const etDT = DateTime.fromISO(s.snapshot_time, { zone: 'utc' }).setZone('America/New_York');
            const etTimeInMinutes = etDT.hour * 60 + etDT.minute;
            
            // Data collection hours: 7:00 AM - 8:00 PM ET
            const dataStartET = 7 * 60;      // 7:00 AM
            const dataEndET = 20 * 60;       // 8:00 PM
            
            return etTimeInMinutes >= dataStartET && etTimeInMinutes < dataEndET;
          })
          .map(s => {
            // Parse the UTC time directly - the Date object will handle display correctly
            const time = new Date(s.snapshot_time);
            
            return {
              time: time,
              bullish: parseFloat(s.total_bullish),
              bearish: parseFloat(s.total_bearish),
              net: parseFloat(s.net_sentiment)
            };
          });
      }
      
      console.log(`Filtered to ${this.data.length} data points`);
      
      this.draw();
      return this.data.length;
    } catch (error) {
      console.error('Error fetching intraday data:', error);
      return 0;
    }
  }

  // Draw the chart
  draw() {
    if (!this.ctx || this.data.length === 0) {
      this.drawEmptyState();
      return;
    }

    this.updateDarkMode();
    
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);
    
    // Clear canvas
    this.ctx.clearRect(0, 0, width, height);
    
    // Set colors based on dark mode
    const colors = this.getColors();
    
    // Draw background
    this.ctx.fillStyle = colors.background;
    this.ctx.fillRect(0, 0, width, height);
    
    // Calculate chart dimensions
    const chartWidth = width - this.chartPadding.left - this.chartPadding.right;
    const chartHeight = height - this.chartPadding.top - this.chartPadding.bottom;
    const chartX = this.chartPadding.left;
    const chartY = this.chartPadding.top;
    
    // Find data ranges (only net sentiment)
    const netValues = this.data.map(d => d.net);
    const maxValue = Math.max(...netValues, 0);
    const minValue = Math.min(...netValues, 0);
    
    // Always include zero in the range
    const valueRange = Math.max(Math.abs(maxValue), Math.abs(minValue));
    const padding = valueRange * 0.15;
    
    // Make the range symmetric around zero for better visualization
    const yMax = maxValue > 0 ? maxValue + padding : padding;
    const yMin = minValue < 0 ? minValue - padding : -padding;
    
    // Draw grid and axes
    this.drawGrid(chartX, chartY, chartWidth, chartHeight, yMin, yMax, colors);
    
    // Draw zero line (always draw it as the midline)
    const zeroY = chartY + chartHeight - ((0 - yMin) / (yMax - yMin)) * chartHeight;
    this.ctx.strokeStyle = colors.zeroLine;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.beginPath();
    this.ctx.moveTo(chartX, zeroY);
    this.ctx.lineTo(chartX + chartWidth, zeroY);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    
    // Draw label for zero line
    this.ctx.fillStyle = colors.zeroLine;
    this.ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('$0 (Neutral)', chartX + 5, zeroY - 10);
    
    // Draw market open/close lines
    this.drawMarketHoursLines(chartX, chartY, chartWidth, chartHeight, colors);
    
    // Draw net sentiment line with dynamic coloring (green above 0, red below 0)
    this.drawDynamicLine(chartX, chartY, chartWidth, chartHeight, yMin, yMax, colors);
    
    // Draw points
    this.drawPoints(chartX, chartY, chartWidth, chartHeight, yMin, yMax, colors);
    
    // Draw legend
    this.drawLegend(width, colors);
    
    // Draw crosshair and tooltip if hovering
    if (this.hoveredPoint !== null) {
      this.drawCrosshair(this.hoveredPoint, chartX, chartY, chartWidth, chartHeight, yMin, yMax, colors);
      this.drawTooltip(this.hoveredPoint, chartX, chartY, chartWidth, chartHeight, yMin, yMax, colors);
    }
  }

  // Draw empty state
  drawEmptyState() {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);
    
    this.updateDarkMode();
    const colors = this.getColors();
    
    this.ctx.fillStyle = colors.background;
    this.ctx.fillRect(0, 0, width, height);
    
    this.ctx.fillStyle = colors.text;
    this.ctx.font = '16px system-ui, -apple-system, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('No intraday data available yet', width / 2, height / 2);
    this.ctx.fillText('Data is captured every 2 minutes during market hours', width / 2, height / 2 + 25);
  }

  // Get color scheme based on dark mode
  getColors() {
    if (this.isDarkMode) {
      return {
        background: '#1a1a1a',
        text: '#e5e7eb',
        textSecondary: '#9ca3af',
        grid: '#374151',
        zeroLine: '#6b7280',
        marketHours: '#f59e0b',
        bullish: '#10b981',
        bearish: '#ef4444',
        net: '#3b82f6',
        tooltip: '#2d2d2d',
        tooltipBorder: '#4b5563'
      };
    } else {
      return {
        background: '#ffffff',
        text: '#1f2937',
        textSecondary: '#6b7280',
        grid: '#e5e7eb',
        zeroLine: '#9ca3af',
        marketHours: '#f59e0b',
        bullish: '#10b981',
        bearish: '#ef4444',
        net: '#3b82f6',
        tooltip: '#ffffff',
        tooltipBorder: '#d1d5db'
      };
    }
  }

  // Draw grid and axes
  drawGrid(x, y, width, height, yMin, yMax, colors) {
    this.ctx.strokeStyle = colors.grid;
    this.ctx.lineWidth = 1;
    this.ctx.fillStyle = colors.text;
    this.ctx.font = '12px system-ui, -apple-system, sans-serif';
    
    // Y-axis labels and grid lines
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const value = yMin + (yMax - yMin) * (i / ySteps);
      const yPos = y + height - (i / ySteps) * height;
      
      // Grid line
      this.ctx.beginPath();
      this.ctx.moveTo(x, yPos);
      this.ctx.lineTo(x + width, yPos);
      this.ctx.stroke();
      
      // Label
      this.ctx.textAlign = 'right';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(this.formatValue(value), x - 10, yPos);
    }
    
    // X-axis labels - Data collection hours (7:00 AM to 8:00 PM ET)
    const marketHours = [
      { label: '7:00 AM', value: 0 },
      { label: '9:00 AM', value: 2 / 13 },
      { label: '11:00 AM', value: 4 / 13 },
      { label: '1:00 PM', value: 6 / 13 },
      { label: '3:00 PM', value: 8 / 13 },
      { label: '5:00 PM', value: 10 / 13 },
      { label: '7:00 PM', value: 12 / 13 },
      { label: '8:00 PM', value: 1 }
    ];
    
    marketHours.forEach(hour => {
      const xPos = x + hour.value * width;
      
      // Vertical grid line
      this.ctx.strokeStyle = colors.grid;
      this.ctx.beginPath();
      this.ctx.moveTo(xPos, y);
      this.ctx.lineTo(xPos, y + height);
      this.ctx.stroke();
      
      // Label
      this.ctx.fillStyle = colors.text;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(hour.label, xPos, y + height + 10);
    });
    
    // Axis labels
    this.ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText('Time (ET)', x + width / 2, y + height + 40);
    
    // Y-axis label (rotated)
    this.ctx.save();
    this.ctx.translate(12, y + height / 2);
    this.ctx.rotate(-Math.PI / 2);
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('Net Sentiment ($)', 0, 0);
    this.ctx.restore();
  }

  // Draw market open and close lines
  drawMarketHoursLines(x, y, width, height, colors) {
    // Market open: 9:30 AM ET
    const marketOpenMinutes = 9 * 60 + 30; // 570 minutes
    const dataStart = 7 * 60;              // 420 minutes
    const dataDuration = 13 * 60;          // 780 minutes (7 AM to 8 PM)
    
    const marketOpenRatio = (marketOpenMinutes - dataStart) / dataDuration;
    const marketOpenX = x + marketOpenRatio * width;
    
    // Market close: 4:00 PM ET
    const marketCloseMinutes = 16 * 60;    // 960 minutes
    const marketCloseRatio = (marketCloseMinutes - dataStart) / dataDuration;
    const marketCloseX = x + marketCloseRatio * width;
    
    // Draw market open line
    this.ctx.strokeStyle = colors.marketHours;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([8, 4]);
    this.ctx.beginPath();
    this.ctx.moveTo(marketOpenX, y);
    this.ctx.lineTo(marketOpenX, y + height);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    
    // Draw market close line
    this.ctx.setLineDash([8, 4]);
    this.ctx.beginPath();
    this.ctx.moveTo(marketCloseX, y);
    this.ctx.lineTo(marketCloseX, y + height);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    
    // Labels
    this.ctx.fillStyle = colors.marketHours;
    this.ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText('Market Open', marketOpenX, y + 5);
    this.ctx.fillText('9:30 AM', marketOpenX, y + 18);
    
    this.ctx.fillText('Market Close', marketCloseX, y + 5);
    this.ctx.fillText('4:00 PM', marketCloseX, y + 18);
  }

  // Get x position based on time (7:00 AM to 8:00 PM ET)
  getXPosition(time, x, width) {
    // Convert UTC time to ET for positioning
    const etTimeStr = time.toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
    const [hours, minutes] = etTimeStr.split(':').map(Number);
    const timeInMinutes = hours * 60 + minutes;
    
    // Data collection hours: 7:00 AM (420 minutes) to 8:00 PM (1200 minutes)
    const dataStart = 7 * 60;         // 420
    const dataEnd = 20 * 60;          // 1200
    const dataDuration = dataEnd - dataStart; // 780 minutes (13 hours)
    
    // Calculate position within data collection hours
    const minutesFromStart = timeInMinutes - dataStart;
    const ratio = minutesFromStart / dataDuration;
    
    return x + ratio * width;
  }

  // Draw a line on the chart with dynamic coloring based on value
  drawDynamicLine(x, y, width, height, yMin, yMax, colors) {
    if (this.data.length === 0) return;
    
    this.ctx.lineWidth = 3;
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    
    // Draw line segments between each pair of points
    for (let i = 0; i < this.data.length - 1; i++) {
      const currentPoint = this.data[i];
      const nextPoint = this.data[i + 1];
      
      const currentValue = currentPoint.net;
      const nextValue = nextPoint.net;
      
      const x1 = this.getXPosition(currentPoint.time, x, width);
      const y1 = y + height - ((currentValue - yMin) / (yMax - yMin)) * height;
      const x2 = this.getXPosition(nextPoint.time, x, width);
      const y2 = y + height - ((nextValue - yMin) / (yMax - yMin)) * height;
      
      // Determine color based on the average of the two points
      const avgValue = (currentValue + nextValue) / 2;
      this.ctx.strokeStyle = avgValue >= 0 ? colors.bullish : colors.bearish;
      
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    }
  }

  // Draw a line on the chart (kept for compatibility)
  drawLine(values, x, y, width, height, yMin, yMax, color, lineWidth) {
    if (values.length === 0) return;
    
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    
    this.ctx.beginPath();
    this.data.forEach((point, i) => {
      const value = values[i];
      const xPos = this.getXPosition(point.time, x, width);
      const yPos = y + height - ((value - yMin) / (yMax - yMin)) * height;
      
      if (i === 0) {
        this.ctx.moveTo(xPos, yPos);
      } else {
        this.ctx.lineTo(xPos, yPos);
      }
    });
    this.ctx.stroke();
  }

  // Draw points on the chart
  drawPoints(x, y, width, height, yMin, yMax, colors) {
    this.data.forEach((point, i) => {
      const xPos = this.getXPosition(point.time, x, width);
      
      // Draw net point with color based on sentiment
      const netY = y + height - ((point.net - yMin) / (yMax - yMin)) * height;
      const pointColor = point.net >= 0 ? colors.bullish : colors.bearish;
      this.drawPoint(xPos, netY, pointColor, i === this.hoveredPoint);
    });
  }

  // Draw a single point
  drawPoint(x, y, color, isHovered) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, isHovered ? 6 : 4, 0, Math.PI * 2);
    this.ctx.fill();
    
    if (isHovered) {
      this.ctx.strokeStyle = this.isDarkMode ? '#ffffff' : '#000000';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }
  }

  // Draw legend
  drawLegend(width, colors) {
    const legendX = width - 200;
    const legendY = 15;
    const lineLength = 30;
    const spacing = 22;
    
    this.ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    
    // Draw bullish line (green)
    this.ctx.strokeStyle = colors.bullish;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(legendX, legendY);
    this.ctx.lineTo(legendX + lineLength, legendY);
    this.ctx.stroke();
    
    this.ctx.fillStyle = colors.text;
    this.ctx.fillText('Bullish (Above $0)', legendX + lineLength + 8, legendY);
    
    // Draw bearish line (red)
    this.ctx.strokeStyle = colors.bearish;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(legendX, legendY + spacing);
    this.ctx.lineTo(legendX + lineLength, legendY + spacing);
    this.ctx.stroke();
    
    this.ctx.fillStyle = colors.text;
    this.ctx.fillText('Bearish (Below $0)', legendX + lineLength + 8, legendY + spacing);
  }

  // Draw crosshair
  drawCrosshair(index, x, y, width, height, yMin, yMax, colors) {
    const point = this.data[index];
    const xPos = this.getXPosition(point.time, x, width);
    const netY = y + height - ((point.net - yMin) / (yMax - yMin)) * height;
    
    // Set crosshair style
    this.ctx.strokeStyle = this.isDarkMode ? 'rgba(156, 163, 175, 0.5)' : 'rgba(107, 114, 128, 0.5)';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);
    
    // Draw vertical line
    this.ctx.beginPath();
    this.ctx.moveTo(xPos, y);
    this.ctx.lineTo(xPos, y + height);
    this.ctx.stroke();
    
    // Draw horizontal line
    this.ctx.beginPath();
    this.ctx.moveTo(x, netY);
    this.ctx.lineTo(x + width, netY);
    this.ctx.stroke();
    
    // Reset line dash
    this.ctx.setLineDash([]);
  }

  // Draw tooltip
  drawTooltip(index, x, y, width, height, yMin, yMax, colors) {
    const point = this.data[index];
    const xPos = this.getXPosition(point.time, x, width);
    
    // Tooltip content
    const sentiment = point.net > 0 ? 'Bullish' : point.net < 0 ? 'Bearish' : 'Neutral';
    const sentimentColor = point.net > 0 ? '#10b981' : point.net < 0 ? '#ef4444' : '#6b7280';
    
    const lines = [
      `Time: ${this.formatTime(point.time)}`,
      `Net Sentiment: ${this.formatCurrency(point.net)}`,
      `Status: ${sentiment}`
    ];
    
    // Calculate tooltip dimensions
    this.ctx.font = '12px system-ui, -apple-system, sans-serif';
    const padding = 10;
    const lineHeight = 18;
    const maxWidth = Math.max(...lines.map(line => this.ctx.measureText(line).width));
    const tooltipWidth = maxWidth + padding * 2;
    const tooltipHeight = lines.length * lineHeight + padding * 2;
    
    // Position tooltip (avoid edges)
    let tooltipX = xPos + 15;
    let tooltipY = y + 10;
    
    if (tooltipX + tooltipWidth > x + width) {
      tooltipX = xPos - tooltipWidth - 15;
    }
    
    // Draw tooltip background
    this.ctx.fillStyle = colors.tooltip;
    this.ctx.strokeStyle = colors.tooltipBorder;
    this.ctx.lineWidth = 1;
    this.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 5);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Draw tooltip text
    this.ctx.fillStyle = colors.text;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    lines.forEach((line, i) => {
      this.ctx.fillText(line, tooltipX + padding, tooltipY + padding + i * lineHeight);
    });
  }

  // Helper: Draw rounded rectangle
  roundRect(x, y, width, height, radius) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }

  // Handle mouse move
  handleMouseMove(e) {
    if (this.data.length === 0) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const width = rect.width;
    const height = rect.height;
    const chartWidth = width - this.chartPadding.left - this.chartPadding.right;
    const chartX = this.chartPadding.left;
    
    // Check if mouse is in chart area
    if (x < chartX || x > chartX + chartWidth) {
      this.hoveredPoint = null;
      this.draw();
      return;
    }
    
    // Find nearest point based on x position
    let nearestIndex = 0;
    let minDistance = Infinity;
    
    this.data.forEach((point, i) => {
      const pointX = this.getXPosition(point.time, chartX, chartWidth);
      const distance = Math.abs(pointX - x);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    });
    
    // Only update if within reasonable distance (20 pixels)
    if (minDistance < 20 && nearestIndex !== this.hoveredPoint) {
      this.hoveredPoint = nearestIndex;
      this.draw();
    } else if (minDistance >= 20 && this.hoveredPoint !== null) {
      this.hoveredPoint = null;
      this.draw();
    }
  }

  // Handle mouse leave
  handleMouseLeave() {
    if (this.hoveredPoint !== null) {
      this.hoveredPoint = null;
      this.draw();
    }
  }

  // Format value for display
  formatValue(value) {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (absValue >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    } else {
      return `$${value.toFixed(0)}`;
    }
  }

  // Format currency
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  // Format time
  formatTime(date) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    });
  }

  // Refresh chart (called by external updates)
  async refresh() {
    await this.fetchData();
  }
}

// Export for use in app.js
window.IntradayChart = IntradayChart;


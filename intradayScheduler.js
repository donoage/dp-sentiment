const { saveIntradaySnapshot } = require('./database');

class IntradayScheduler {
  constructor(broadcastServer = null) {
    this.schedulerInterval = null;
    this.broadcastServer = broadcastServer;
  }

  // Check if market is open (7:00 AM - 8:00 PM ET, Monday-Friday)
  isMarketHours() {
    const now = new Date();
    const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    
    // Check if weekday
    const day = etTime.getDay();
    if (day === 0 || day === 6) {
      return false; // Weekend
    }
    
    // Check time (7:00 AM - 8:00 PM ET)
    const hours = etTime.getHours();
    const minutes = etTime.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    
    const marketOpen = 7 * 60;       // 7:00 AM
    const marketClose = 20 * 60;      // 8:00 PM
    
    return timeInMinutes >= marketOpen && timeInMinutes < marketClose;
  }

  // Check if we should save snapshot (every 2 minutes: :00, :02, :04, :06, :08, etc.)
  shouldSaveSnapshot() {
    if (!this.isMarketHours()) {
      return false;
    }

    const now = new Date();
    const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const minutes = etTime.getMinutes();
    
    // Trigger on exact 2-minute intervals
    return minutes % 2 === 0;
  }

  // Start the scheduler
  start() {
    console.log('📊 Intraday Snapshot Scheduler started - snapshots every 2 min during market hours');
    
    // Check every minute
    this.schedulerInterval = setInterval(async () => {
      if (this.shouldSaveSnapshot()) {
        await this.saveSnapshot();
      }
    }, 60000); // Check every minute
    
    // Also check immediately on startup if it's a 2-minute mark
    if (this.shouldSaveSnapshot()) {
      this.saveSnapshot();
    }
  }

  // Save snapshot
  async saveSnapshot() {
    try {
      const snapshot = await saveIntradaySnapshot();
      
      if (snapshot) {
        console.log('✅ Intraday snapshot saved');
        
        // Broadcast to connected clients that a new snapshot is available
        if (this.broadcastServer) {
          this.broadcastServer.broadcastIntradaySnapshot();
        } else {
          console.log('⚠️ No broadcast server available - skipping WebSocket notification');
        }
      }
    } catch (error) {
      console.error('❌ Error saving intraday snapshot:', error);
    }
  }

  // Stop the scheduler
  stop() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      console.log('📊 Intraday Snapshot Scheduler stopped');
    }
  }
}

module.exports = IntradayScheduler;


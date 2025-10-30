const config = require('./config');

class HoldingsScheduler {
  constructor() {
    this.schedulerInterval = null;
    this.lastRunDate = null;
  }

  // Check if it's time to refresh holdings (6:30 AM ET on weekdays)
  shouldRefreshHoldings() {
    const now = new Date();
    const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    
    // Check if weekday (0 = Sunday, 6 = Saturday)
    const day = etTime.getDay();
    if (day === 0 || day === 6) {
      return false; // Weekend
    }
    
    // Check if it's 6:30 AM ET
    const hours = etTime.getHours();
    const minutes = etTime.getMinutes();
    
    // Run at 6:30 AM ET (before market tracking starts at 7:00 AM)
    if (hours === 6 && minutes === 30) {
      // Check if we've already run today
      const currentDate = etTime.toISOString().split('T')[0];
      if (this.lastRunDate === currentDate) {
        return false; // Already ran today
      }
      return true;
    }
    
    return false;
  }

  // Start the scheduler
  start() {
    console.log('📅 Holdings Scheduler started - will refresh at 6:30 AM ET on weekdays');
    
    // Check every minute
    this.schedulerInterval = setInterval(async () => {
      if (this.shouldRefreshHoldings()) {
        await this.refreshHoldings();
      }
    }, 60000); // Check every minute
    
    // Also check immediately on startup
    if (this.shouldRefreshHoldings()) {
      this.refreshHoldings();
    }
  }

  // Refresh holdings
  async refreshHoldings() {
    try {
      console.log('🔔 Running scheduled holdings refresh at 6:30 AM ET...');
      await config.refresh();
      
      const now = new Date();
      const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      this.lastRunDate = etTime.toISOString().split('T')[0];
      
      console.log('✅ Scheduled holdings refresh completed successfully');
    } catch (error) {
      console.error('❌ Error running scheduled holdings refresh:', error);
    }
  }

  // Stop the scheduler
  stop() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      console.log('📅 Holdings Scheduler stopped');
    }
  }
}

module.exports = HoldingsScheduler;


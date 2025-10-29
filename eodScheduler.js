const { saveEODSnapshot } = require('./database');

class EODScheduler {
  constructor() {
    this.schedulerInterval = null;
    this.hasRunToday = false;
    this.lastRunDate = null;
  }

  // Check if it's time to run EOD snapshot (5:00 PM ET on weekdays)
  shouldRunEODSnapshot() {
    const now = new Date();
    const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    
    // Check if weekday (0 = Sunday, 6 = Saturday)
    const day = etTime.getDay();
    if (day === 0 || day === 6) {
      return false; // Weekend
    }
    
    // Check if it's 5:00 PM ET
    const hours = etTime.getHours();
    const minutes = etTime.getMinutes();
    
    // Run at 5:00 PM ET (17:00)
    if (hours === 17 && minutes === 0) {
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
    console.log('📅 EOD Scheduler started - will snapshot at 5:00 PM ET on weekdays');
    
    // Check every minute
    this.schedulerInterval = setInterval(async () => {
      if (this.shouldRunEODSnapshot()) {
        await this.runEODSnapshot();
      }
    }, 60000); // Check every minute
    
    // Also check immediately on startup
    if (this.shouldRunEODSnapshot()) {
      this.runEODSnapshot();
    }
  }

  // Run the EOD snapshot
  async runEODSnapshot() {
    try {
      console.log('🔔 Running EOD snapshot at 5:00 PM ET...');
      const snapshot = await saveEODSnapshot();
      
      if (snapshot) {
        const now = new Date();
        const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        this.lastRunDate = etTime.toISOString().split('T')[0];
        this.hasRunToday = true;
        
        console.log('✅ EOD snapshot completed successfully');
      } else {
        console.log('⚠️ EOD snapshot had no data to save');
      }
    } catch (error) {
      console.error('❌ Error running EOD snapshot:', error);
    }
  }

  // Stop the scheduler
  stop() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      console.log('📅 EOD Scheduler stopped');
    }
  }
}

module.exports = EODScheduler;


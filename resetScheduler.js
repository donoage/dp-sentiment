const { resetSentiments } = require('./database');

class ResetScheduler {
  constructor() {
    this.schedulerInterval = null;
    this.lastRunDate = null;
  }

  // Check if it's time to reset sentiments (6:45 AM ET on weekdays)
  shouldResetSentiments() {
    const now = new Date();
    const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    
    // Check if weekday (0 = Sunday, 6 = Saturday)
    const day = etTime.getDay();
    if (day === 0 || day === 6) {
      return false; // Weekend
    }
    
    // Check if it's 6:45 AM ET
    const hours = etTime.getHours();
    const minutes = etTime.getMinutes();
    
    // Run at 6:45 AM ET (after holdings refresh, before market opens)
    if (hours === 6 && minutes === 45) {
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
    console.log('📅 Reset Scheduler started - will reset sentiments at 6:45 AM ET on weekdays');
    
    // Check every minute
    this.schedulerInterval = setInterval(async () => {
      if (this.shouldResetSentiments()) {
        await this.resetDailySentiments();
      }
    }, 60000); // Check every minute
    
    // Also check immediately on startup
    if (this.shouldResetSentiments()) {
      this.resetDailySentiments();
    }
  }

  // Reset daily sentiments
  async resetDailySentiments() {
    try {
      console.log('🔔 Running daily sentiment reset at 6:45 AM ET...');
      await resetSentiments();
      
      const now = new Date();
      const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      this.lastRunDate = etTime.toISOString().split('T')[0];
      
      console.log('✅ Daily sentiment reset completed - starting fresh for today');
    } catch (error) {
      console.error('❌ Error running daily sentiment reset:', error);
    }
  }

  // Stop the scheduler
  stop() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      console.log('📅 Reset Scheduler stopped');
    }
  }
}

module.exports = ResetScheduler;


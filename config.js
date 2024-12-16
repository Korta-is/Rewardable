export default {
  // Reset time configuration (24-hour format)
  resetTime: {
    hour: 7,    // Hour to reset (0-23)
    minute: 0,  // Minute to reset (0-59)
    second: 2   // Second to reset (0-59)
  },
  
  // Bot configuration
  bot: {
    maxRetries: 20,          // Maximum transaction retry attempts
    retryInterval: 5000,     // Retry interval in milliseconds
    logDirectory: 'logs',    // Directory for log files
  },
  
  // Time display configuration
  display: {
    timeZone: 'Asia/Jakarta',  // Timezone for display
    timeZoneAbbr: 'WIB'        // Timezone abbreviation
  }
};

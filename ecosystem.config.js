/**
 * PM2 Configuration for Production Bot
 * Ensures 24/7 uptime with auto-restart
 */

module.exports = {
  apps: [{
    name: 'flash-loan-bot',
    script: './dist/index-production.js',
    instances: 1,
    exec_mode: 'fork',
    
    // Auto-restart configuration
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    
    // Restart policy
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 5000,
    
    // Environment
    env: {
      NODE_ENV: 'production',
    },
    
    // Logging
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Advanced features
    kill_timeout: 5000,
    listen_timeout: 10000,
  }],
};

// PM2 Configuration for Auto-Restart and Process Management
// Run with: pm2 start ecosystem.config.js

module.exports = {
  apps: [{
    name: 'flash-arbitrage-bot',
    script: 'dist/index-production.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Restart strategy
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Auto-restart on crash
    autorestart: true,
    
    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 3000,
    
    // Cron restart (optional - restart daily at 3 AM)
    cron_restart: '0 3 * * *',
    
    // Monitoring
    instance_var: 'INSTANCE_ID'
  }]
};

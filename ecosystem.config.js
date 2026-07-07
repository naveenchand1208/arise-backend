module.exports = {
  apps: [
    {
      name: 'arise-api',
      script: 'server.js',
      cwd: '/var/www/arise-backend',

      // Instances
      instances: 2,           // 2 workers for KVM 2 (2 vCPU)
      exec_mode: 'cluster',

      // Auto-restart
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,

      // Memory limit — restart if exceeds 512MB per instance
      max_memory_restart: '512M',

      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },

      // Logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/arise/error.log',
      out_file: '/var/log/arise/out.log',
      merge_logs: true,

      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: false,
      listen_timeout: 8000,
    }
  ],

  deploy: {
    production: {
      user: 'root',
      host: 'YOUR_HOSTINGER_IP',          // ← replace with your KVM 2 IP
      ref: 'origin/main',
      repo: 'git@github.com:bhive/arise-backend.git',  // ← replace with your repo
      path: '/var/www/arise-backend',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'mkdir -p /var/log/arise',
    }
  }
};

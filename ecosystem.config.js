// PM2 Ecosystem — InfraPanel Remote Server
module.exports = {
  apps: [
    {
      name: 'infra-panel-backend',
      script: '/root/infra-panel/venv/bin/uvicorn',
      args: 'backend.main:app --host 127.0.0.1 --port 8000 --workers 1',
      cwd: '/root/infra-panel',
      interpreter: 'none',
      env: {
        PYTHONPATH: '/root/infra-panel',
        PATH: '/root/infra-panel/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      error_file: '/root/infra-panel/logs/backend-error.log',
      out_file: '/root/infra-panel/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'infra-panel-bot',
      script: 'backend/run_bot.py',
      cwd: '/root/infra-panel',
      interpreter: '/root/infra-panel/venv/bin/python3',
      env: {
        PYTHONPATH: '/root/infra-panel',
        PATH: '/root/infra-panel/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      error_file: '/root/infra-panel/logs/bot-error.log',
      out_file: '/root/infra-panel/logs/bot-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
}

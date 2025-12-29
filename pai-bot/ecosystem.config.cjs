module.exports = {
  apps: [
    {
      name: "pai-bot",
      script: "src/index.ts",
      interpreter: "bun",
      env: {
        NODE_ENV: "production",
      },
      // Auto restart
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      // Logs
      error_file: "./logs/error.log",
      out_file: "./logs/output.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      // Monitoring
      max_memory_restart: "500M",
    },
  ],
};

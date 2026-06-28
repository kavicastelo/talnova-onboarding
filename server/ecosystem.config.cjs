module.exports = {
  apps: [
    {
      name: "talnova-api",
      script: "./dist/server.js",
      instances: "max",
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "1G",
      env_production: {
        NODE_ENV: "production",
        PORT: 8080,
        HOST: "0.0.0.0",
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      combine_logs: true,
      merge_logs: true,
    },
  ],
};

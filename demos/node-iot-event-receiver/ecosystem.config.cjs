module.exports = {
  apps: [
    { name: 'iot-demo-receiver', cwd: __dirname, script: 'src/server.js',
      instances: 1, exec_mode: 'fork', max_memory_restart: '256M',
      env: { NODE_ENV: 'production', TCP_PORT: '7070', METRICS_PORT: '9091' } },
    { name: 'iot-demo-consumer', cwd: __dirname, script: 'src/worker.js',
      instances: 1, exec_mode: 'fork', max_memory_restart: '256M',
      env: { NODE_ENV: 'production', METRICS_PORT: '9092' } }
  ]
};

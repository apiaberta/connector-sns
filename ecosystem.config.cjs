module.exports = {
  apps: [
    {
      name: 'apiaberta-sns',
      script: 'src/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3020,
        MONGO_URI: 'mongodb://localhost:27017/apiaberta-sns'
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: '250M'
    }
  ]
}

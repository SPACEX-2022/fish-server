module.exports = {
  apps: [{
    name: 'fish-game-server',
    script: 'dist/main.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env_file: '.env'
  }]
}; 
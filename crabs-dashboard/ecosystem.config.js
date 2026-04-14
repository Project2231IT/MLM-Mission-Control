module.exports = {
  apps: [{
    name: 'crabs-dashboard',
    script: 'server/index.js',
    interpreter: 'node',
    cwd: '/home/jake/.openclaw/workspace/crabs-dashboard',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      PORT: 3800
    }
  }]
};

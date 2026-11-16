// pm2 config: `pm2 start ecosystem.config.cjs` starts only this app.
// Port and secrets come from .env (PORT=4100), nothing else is touched.
module.exports = {
  apps: [
    {
      name: 'komorebi',
      script: 'server/index.js',
      cwd: __dirname,
      instances: 1,
      max_memory_restart: '300M',
      env: { NODE_ENV: 'production' },
    },
  ],
};

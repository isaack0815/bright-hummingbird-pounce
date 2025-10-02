module.exports = {
  apps : [{
    name   : "webhook-updater",
    script : "./webhook-server.js",
    env: {
      "NODE_ENV": "production",
      "WEBHOOK_PORT": 9000,
      "WEBHOOK_SECRET": "DEIN_GEHEIMER_SCHLÜSSEL_HIER"
    }
  }]
}
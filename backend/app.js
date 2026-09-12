const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const logger = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const config = require('./config/config');
const errorHandler = require('./middlewares/errorHandler');

const authRoute = require('./auth/authRoute');
const projectRoute = require('./project/projectRoute');
const controllerRoute = require('./controller/controllerRoute');
const memberRoute = require('./member/memberRoute');
const settingsRoute = require('./settings/settingsRoute');

const app = express();
const STATIC_ROOT = path.join(__dirname, 'public/browser');

// --- Security headers -------------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    // Controllers are reached over plain SNMP/UDP on the LAN by the poller;
    // leave HSTS to the reverse proxy in front of this API.
    hsts: false,
  })
);

// Same-origin deployments need no CORS at all; a dev UI on :4200 does.
app.use(
  cors({
    origin: config.corsOrigins.length ? config.corsOrigins : false,
    credentials: true,
  })
);

// --- Parsing ----------------------------------------------------------------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

app.use(logger(config.isProduction ? 'combined' : 'dev'));

// --- API --------------------------------------------------------------------
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de requêtes. Réessayez dans un instant.' },
  })
);

app.get('/api/health', (req, res) =>
  res.status(200).json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  })
);

app.use('/api/auth', authRoute);
app.use('/api/projects', projectRoute);
app.use('/api/controllers', controllerRoute);
app.use('/api/members', memberRoute);
app.use('/api/settings', settingsRoute);

app.use('/api', (req, res) => res.status(404).json({ error: 'Route introuvable' }));

// --- Static SPA -------------------------------------------------------------
// No long maxAge: unlike a CDN-fronted app, this dev/deploy loop rebuilds the
// SPA in place under the same filenames (development config does not hash
// entry files), so a long-lived cache serves stale bundles after every
// rebuild until the browser's cache happens to expire. ETag still lets an
// unchanged file be answered with a cheap 304.
app.use(express.static(STATIC_ROOT, { index: false, etag: true, maxAge: 0 }));
app.get('*', (req, res) => res.sendFile(path.join(STATIC_ROOT, 'index.html')));

app.use(errorHandler);

module.exports = { app, config };

// --- Bootstrap --------------------------------------------------------------
if (require.main === module) {
  mongoose
    .connect(config.bdUrl)
    .then(async () => {
      console.log('Connected to the database');
      app.listen(config.PORT, () => {
        console.log(`Server running at http://${config.HOST}:${config.PORT}`);
      });
    })
    .catch((err) => {
      console.error('Database connection failed:', err.message);
      process.exit(1);
    });

  const shutdown = async (signal) => {
    console.log(`\n${signal} received — shutting down.`);
    await mongoose.connection.close().catch(() => {});
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

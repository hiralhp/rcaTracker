const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// Auto-seed if the database is empty (handles ephemeral filesystems on free hosting)
const db = require('./db');
try {
  const count = db.prepare('SELECT COUNT(*) as n FROM incidents').get().n;
  if (count === 0) {
    console.log('Database is empty — running seed...');
    require('./seed');
  }
} catch (e) {
  console.error('Auto-seed check failed:', e.message);
}

app.use(cors());
app.use(express.json());

app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/rcas',      require('./routes/rcas'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/portal',    require('./routes/portal'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Serve built frontend in production
if (isProd) {
  const distPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`🚀  RCA Tracker API  →  http://localhost:${PORT}`);
});

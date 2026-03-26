const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/rcas',      require('./routes/rcas'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/portal',    require('./routes/portal'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`🚀  RCA Tracker API  →  http://localhost:${PORT}`);
});

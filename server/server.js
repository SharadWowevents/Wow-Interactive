const path = require('path');
const fs = require('fs');
const http = require('http');
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const geo = require('./utils/geo');
const { initWebSocket } = require('./utils/websocket');

const authRoutes = require('./routes/authRoutes');
const questionRoutes = require('./routes/questionRoutes');
const publicRoutes = require('./routes/publicRoutes');
const publicController = require('./controllers/publicController');
const { ADMIN_PASSWORD } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize WebSockets
initWebSocket(server);

// Connect to MongoDB
connectDB();

// Initialize Offline Geo dataset
geo.load();

// Middleware
app.set('trust proxy', true);
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '20kb' }));

// API Routes
app.use('/api', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/public', publicRoutes);
app.get('/api/cities', publicController.getCities);
app.get('/geo/countries.json', publicController.getCountriesGeoJson);
app.get('/healthz', (req, res) => res.send('ok'));

// Serve React Client in Production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      message: 'Wow Interactive MERN API is running. Build the client or run the Vite dev server for frontend UI.',
      endpoints: {
        admin: '/api/questions',
        cities: '/api/cities',
        health: '/healthz'
      }
    });
  });
}

server.listen(PORT, () => {
  console.log(`[Wow Interactive MERN] Server running on http://localhost:${PORT}`);
  console.log(`[WebSockets] Real-time engine active`);
  if (ADMIN_PASSWORD === 'changeme') {
    console.warn('WARNING: Default ADMIN_PASSWORD is "changeme". Set ADMIN_PASSWORD in .env for production.');
  }
});

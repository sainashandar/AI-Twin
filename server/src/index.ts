import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './db/database.js';
import { seedDatabase } from './db/seed.js';
import { apiRouter } from './routes/api.js';
import { registerSSEClient } from './sse.js';
import { FollowThroughService } from './services/followThroughService.js';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

// Middlewares
app.use(cors({
  origin: '*', // Allow local frontend and Chrome Extension
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Initialize SQLite DB & Seed
const db = initDatabase();
seedDatabase(db);

// Real-time Server-Sent Events Endpoint
app.get('/events', (req, res) => {
  const clientId = (req.query.clientId as string) || uuidv4();
  registerSSEClient(clientId, res);
});

// API Routes
app.use('/api', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    product: 'Continuity AI',
    version: '1.0.0',
    mode: 'local-first',
    timestamp: new Date().toISOString()
  });
});

// Periodic Scheduler for Follow-up Due Queue (every 20s)
const schedulerInterval = setInterval(() => {
  FollowThroughService.checkDueQueue().catch(err => {
    console.error('[Scheduler] Error checking due queue:', err);
  });
}, 20000);

const server = app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  Continuity AI Local Engine listening on port ${PORT}`);
  console.log(`  REST API:   http://localhost:${PORT}/api`);
  console.log(`  SSE Stream: http://localhost:${PORT}/events`);
  console.log(`  Health:     http://localhost:${PORT}/health`);
  console.log(`=======================================================`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  clearInterval(schedulerInterval);
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  clearInterval(schedulerInterval);
  server.close(() => process.exit(0));
});

export { app, server };

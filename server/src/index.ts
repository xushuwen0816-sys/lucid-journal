import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import journalRoutes from './routes/journals';
import letterRoutes from './routes/letters';
import debugRoutes from './routes/debug';
import { startScheduler } from './services/schedulerService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Start Scheduler
startScheduler();

app.use(cors({
  origin: '*', // Allow all origins for now (debugging)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request Logger Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  next();
});

app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/journals', journalRoutes);
app.use('/api/letters', letterRoutes);
app.use('/api/debug', debugRoutes);

app.get('/', (req, res) => {
  res.status(200).send(`
    <html>
      <head>
        <title>Lucid Journal API</title>
        <style>
          body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #1c1917; color: #fff7ed; }
          .container { text-align: center; padding: 2rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem; background: rgba(255,255,255,0.05); }
          h1 { margin-bottom: 0.5rem; color: #fdba74; }
          p { opacity: 0.8; }
          .status { display: inline-block; width: 10px; height: 10px; background: #10b981; border-radius: 50%; margin-right: 0.5rem; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Lucid Journal API</h1>
          <p><span class="status"></span>System is Operational</p>
          <p style="font-size: 0.8rem; margin-top: 1rem;">Running on Port ${PORT}</p>
        </div>
      </body>
    </html>
  `);
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});

import express from 'express';
import cors from 'cors';
import mergeRoutes from './routes/mergeRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', mergeRoutes);
  app.use(errorHandler);
  return app;
}

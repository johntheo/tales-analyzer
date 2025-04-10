import express from 'express';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.get('/', (req, res) => {
  logger.info('Health check requested');
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

export default router; 
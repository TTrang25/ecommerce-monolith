const router = require('express').Router();
const prisma = require('../lib/prisma');

router.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      db: 'up',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(503).json({ status: 'error', db: 'down' });
  }
});

module.exports = router;
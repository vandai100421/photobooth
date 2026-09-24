const router = require('express').Router();
const env = require('../../config/env');
const logger = require('../../utils/logger');
const { runAllJobs } = require('../../scheduler/cron');

// Vercel Cron calls this endpoint (GET) on schedule — see backend/vercel.json.
// When the CRON_SECRET env var is set, Vercel automatically attaches
// 'Authorization: Bearer <CRON_SECRET>' to cron invocations. Manual runs
// (testing from curl) can pass the secret via ?key=<CRON_SECRET>.
router.get('/daily', async (req, res, next) => {
  try {
    if (!env.CRON_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'CRON_SECRET is not configured on the server',
      });
    }
    const authHeader = req.get('authorization');
    const queryKey = req.query.key;
    const isCronHeader = authHeader === `Bearer ${env.CRON_SECRET}`;
    const isManualKey = queryKey === env.CRON_SECRET;
    if (!isCronHeader && !isManualKey) {
      logger.warn('cron: unauthorized trigger attempt');
      return res
        .status(401)
        .json({ success: false, error: 'Unauthorized' });
    }

    logger.info('cron: daily jobs triggered via HTTP');
    await runAllJobs();
    return res.json({
      success: true,
      data: { message: 'Daily jobs executed (birthday, holiday, reengage)' },
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

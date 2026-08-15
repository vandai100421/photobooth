const router = require('express').Router();
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const ctrl = require('./rewards.controller');
const schema = require('./rewards.schema');

// KPI + xếp hạng
router.get('/kpi', auth, validate(schema.kpiSchema), ctrl.kpi);
router.get(
  '/leaderboard',
  auth,
  validate(schema.leaderboardSchema),
  ctrl.leaderboard,
);

// Quy tắc thưởng
router.get('/bonus-rules', auth, ctrl.listBonusRules);
router.put(
  '/bonus-rules',
  auth,
  rbac('admin'),
  validate(schema.upsertBonusRulesSchema),
  ctrl.upsertBonusRules,
);

// Chốt thù lao (payouts)
router.get(
  '/payouts',
  auth,
  rbac('admin', 'manager'),
  validate(schema.payoutsListSchema),
  ctrl.listPayouts,
);
router.post(
  '/payouts',
  auth,
  rbac('admin'),
  validate(schema.createPayoutSchema),
  ctrl.createPayout,
);
router.put(
  '/payouts/:id',
  auth,
  rbac('admin'),
  validate(schema.updatePayoutSchema),
  ctrl.updatePayout,
);

// Đánh giá của khách hàng
router.get('/feedback', auth, ctrl.listFeedback);
router.post(
  '/feedback',
  auth,
  validate(schema.createFeedbackSchema),
  ctrl.createFeedback,
);

module.exports = router;

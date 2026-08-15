const router = require('express').Router();
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const ctrl = require('./schedule.controller');
const schema = require('./schedule.schema');

// Lịch ca (calendar) + tải công việc + gợi ý phân bổ
router.get('/shifts', auth, ctrl.listShifts);
router.get('/workload', auth, ctrl.workload);
router.get('/auto-assign', auth, validate(schema.autoAssignSchema), ctrl.autoAssign);

// CRUD ca làm (tổng quát, không lồng theo employee)
router.post(
  '/shifts',
  auth,
  rbac('admin', 'manager'),
  validate(schema.createShiftSchema),
  ctrl.createShift,
);
router.put(
  '/shifts/:id',
  auth,
  rbac('admin', 'manager'),
  validate(schema.updateShiftSchema),
  ctrl.updateShift,
);
router.delete('/shifts/:id', auth, rbac('admin', 'manager'), ctrl.deleteShift);

// Yêu cầu đổi ca / nghỉ
router.get('/swap-requests', auth, ctrl.listSwapRequests);
router.post(
  '/swap-requests',
  auth,
  validate(schema.createSwapRequestSchema),
  ctrl.createSwapRequest,
);
router.put(
  '/swap-requests/:id/review',
  auth,
  rbac('admin', 'manager'),
  validate(schema.reviewSwapRequestSchema),
  ctrl.reviewSwapRequest,
);

// Địa điểm (locations)
router.get('/locations', auth, ctrl.listLocations);
router.post(
  '/locations',
  auth,
  rbac('admin', 'manager'),
  validate(schema.createLocationSchema),
  ctrl.createLocation,
);
router.put(
  '/locations/:id',
  auth,
  rbac('admin', 'manager'),
  validate(schema.updateLocationSchema),
  ctrl.updateLocation,
);
router.delete('/locations/:id', auth, rbac('admin', 'manager'), ctrl.removeLocation);

module.exports = router;

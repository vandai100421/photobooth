const router = require('express').Router();
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const ctrl = require('./employees.controller');
const schema = require('./employees.schema');

// Employee CRUD
router.get('/', auth, ctrl.list);
router.post(
  '/',
  auth,
  rbac('admin'),
  validate(schema.createEmployeeSchema),
  ctrl.create,
);
router.get('/:id', auth, ctrl.detail);
router.put(
  '/:id',
  auth,
  rbac('admin'),
  validate(schema.updateEmployeeSchema),
  ctrl.update,
);
router.delete('/:id', auth, rbac('admin'), ctrl.remove);

// Shifts nested under an employee
router.get('/:id/shifts', auth, ctrl.listShifts);
router.post(
  '/:id/shifts',
  auth,
  rbac('admin', 'manager'),
  validate(schema.createShiftSchema),
  ctrl.createShift,
);
router.put(
  '/:id/shifts/:shiftId',
  auth,
  rbac('admin', 'manager'),
  validate(schema.updateShiftSchema),
  ctrl.updateShift,
);

// Skills & Areas (kỹ năng + khu vực phụ trách)
router.get('/:id/skills', auth, ctrl.listSkills);
router.post(
  '/:id/skills',
  auth,
  rbac('admin', 'manager'),
  validate(schema.upsertSkillSchema),
  ctrl.upsertSkill,
);
router.delete(
  '/:id/skills/:skillId',
  auth,
  rbac('admin', 'manager'),
  ctrl.removeSkill,
);

router.get('/:id/areas', auth, ctrl.listAreas);
router.post(
  '/:id/areas',
  auth,
  rbac('admin', 'manager'),
  validate(schema.upsertAreaSchema),
  ctrl.upsertArea,
);
router.delete(
  '/:id/areas/:areaId',
  auth,
  rbac('admin', 'manager'),
  ctrl.removeArea,
);

module.exports = router;

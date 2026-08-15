const router = require('express').Router();
const auth = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const ctrl = require('./bookings.controller');
const schema = require('./bookings.schema');

router.get('/', auth, ctrl.list);
router.post('/', auth, validate(schema.createBookingSchema), ctrl.create);
router.get('/:id', auth, ctrl.detail);
router.put('/:id', auth, validate(schema.updateBookingSchema), ctrl.update);
router.delete('/:id', auth, ctrl.remove);

module.exports = router;

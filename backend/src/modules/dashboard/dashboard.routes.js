const router = require('express').Router();
const auth = require('../../middleware/auth');
const ctrl = require('./dashboard.controller');

router.get('/stats', auth, ctrl.stats);
router.get('/revenue', auth, ctrl.revenue);
router.get('/customers', auth, ctrl.customers);
router.get('/vouchers', auth, ctrl.vouchers);

module.exports = router;

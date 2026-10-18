const router = require('express').Router();
const auth = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const ctrl = require('./bank-transactions.controller');
const schema = require('./bank-transactions.schema');

router.get('/', auth, validate(schema.listBankTransactionsSchema), ctrl.list);
router.get('/latest', auth, ctrl.latest);

module.exports = router;

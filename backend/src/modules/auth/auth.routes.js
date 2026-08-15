const router = require('express').Router();
const auth = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const ctrl = require('./auth.controller');
const schema = require('./auth.schema');

router.post('/login', validate(schema.loginSchema), ctrl.login);
router.get('/me', auth, ctrl.me);
router.post('/refresh', auth, ctrl.refresh);
router.post('/logout', auth, ctrl.logout);

module.exports = router;

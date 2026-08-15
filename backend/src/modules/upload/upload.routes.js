const router = require('express').Router();
const multer = require('multer');
const auth = require('../../middleware/auth');
const ctrl = require('./upload.controller');

// Memory storage so the controller can validate type/size and stream to
// Cloudinary without writing to disk.
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', auth, upload.single('file'), ctrl.upload);

module.exports = router;

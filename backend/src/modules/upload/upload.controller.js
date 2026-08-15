const { success } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const cloudinary = require('../../config/cloudinary');

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

// Wrap cloudinary upload_stream in a promise so it can be awaited.
const streamUpload = (buffer, options) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );
    stream.end(buffer);
  });

const upload = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded (field name must be "file")', 400);
  }
  if (!ALLOWED_MIME.includes(req.file.mimetype)) {
    throw new AppError('Invalid file type. Allowed: jpeg, png, webp', 400);
  }
  if (req.file.size > MAX_SIZE) {
    throw new AppError('File too large. Maximum size is 5MB', 400);
  }

  let result;
  try {
    result = await streamUpload(req.file.buffer, {
      folder: 'tapphotobooth',
      resource_type: 'image',
    });
  } catch (err) {
    throw new AppError(`Upload failed: ${err.message}`, 500);
  }

  return success(res, {
    url: result.secure_url,
    public_id: result.public_id,
  });
});

module.exports = { upload };

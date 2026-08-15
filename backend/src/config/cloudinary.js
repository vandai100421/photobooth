const { v2: cloudinary } = require('cloudinary');
const env = require('./env');

if (env.CLOUDINARY_URL) {
  cloudinary.config(env.CLOUDINARY_URL);
}

module.exports = cloudinary;

const fs = require('fs').promises;
const { uploadToCloudinary } = require('../../config/cloudinary');
const { uploadImage } = require('../../config/r2');
const { AppError } = require('../../middleware/errorMiddleware');
const catchAsync = require('../../utils/catchAsync');
const ResponseHandler = require('../../utils/responseHandler');

const uploadPromotionMedia = catchAsync(async (req, res) => {
  if (!req.file) throw new AppError('Promotion media is required', 400);

  try {
    const isVideo = req.file.mimetype.startsWith('video/');
    const media = isVideo
      ? await uploadToCloudinary(req.file.path, { folder: 'rugano/promotions/videos', resource_type: 'video' })
      : await uploadImage(req.file, 'promotions/images');

    ResponseHandler.created(res, {
      media_url: media.url,
      media_type: media.resourceType,
      media_public_id: media.publicId,
      media_provider: media.provider || 'cloudinary'
    }, 'Promotion media uploaded');
  } finally {
    await fs.unlink(req.file.path).catch(() => undefined);
  }
});

module.exports = { uploadPromotionMedia };

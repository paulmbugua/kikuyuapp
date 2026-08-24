const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getClient, getImageTarget } = require('../../config/r2');

const allowedTargets = {
  images: /^users\/avatars\/[A-Za-z0-9._/-]+$/,
  cover: /^users\/covers\/[A-Za-z0-9._/-]+$/
};

const streamImage = async (req, res, next) => {
  try {
    const target = String(req.query.target || '');
    const key = decodeURIComponent(String(req.query.key || ''));
    if (!allowedTargets[target] || !allowedTargets[target].test(key)) {
      return res.status(400).json({ status: 'error', message: 'Invalid image reference' });
    }
    const { bucket } = getImageTarget(target);
    const object = await getClient().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    res.set({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': object.ContentType || 'application/octet-stream',
      ETag: object.ETag || ''
    });
    return object.Body.pipe(res);
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NoSuchKey') {
      return res.status(404).json({ status: 'error', message: 'Image not found' });
    }
    return next(error);
  }
};

module.exports = { streamImage };

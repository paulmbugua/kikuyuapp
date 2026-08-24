const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { DeleteObjectCommand, PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const config = require('./env');

const client = new S3Client({
  region: config.r2.region,
  endpoint: config.r2.endpoint,
  credentials: {
    accessKeyId: config.r2.accessKeyId,
    secretAccessKey: config.r2.secretAccessKey
  }
});

const trimSlashes = (value) => value.replace(/^\/+|\/+$/g, '');
const publicUrl = (baseUrl, key) => `${trimSlashes(baseUrl)}/${key.split('/').map(encodeURIComponent).join('/')}`;

const getImageTarget = (target) => {
  const bucket = config.r2.buckets[target];
  const baseUrl = config.r2.publicBaseUrls[target];
  if (!bucket || !baseUrl) throw new Error(`R2 image target is not configured: ${target}`);
  return { bucket, baseUrl };
};

const uploadImage = async (file, folder, target = 'images') => {
  if (!file?.buffer && !file?.path) throw new Error('Image data is required');
  if (!config.upload.allowedImageTypes.includes(file.mimetype)) throw new Error('Unsupported image type');
  if (file.size > config.r2.maxImageBytes) throw new Error(`Image exceeds ${config.r2.maxImageBytes} bytes`);

  const { bucket, baseUrl } = getImageTarget(target);
  const extension = path.extname(file.originalname || '').toLowerCase() || `.${file.mimetype.split('/')[1] || 'bin'}`;
  const key = `${trimSlashes(folder)}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${extension}`;

  const body = file.buffer || await fs.readFile(file.path);

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: file.mimetype,
    CacheControl: 'public, max-age=31536000, immutable',
    Metadata: { originalName: Buffer.from(file.originalname || 'image').toString('base64url') }
  }));

  return {
    url: publicUrl(baseUrl, key),
    publicId: key,
    resourceType: 'image',
    provider: 'cloudflare-r2',
    bytes: file.size
  };
};

const mirrorImage = async (sourceUrl, folder) => {
  const response = await axios.get(sourceUrl, { responseType: 'arraybuffer', timeout: 15000, maxContentLength: config.r2.maxImageBytes });
  const mimetype = String(response.headers['content-type'] || '').split(';')[0];
  if (!config.upload.allowedImageTypes.includes(mimetype)) throw new Error('Remote profile image has an unsupported type');
  const buffer = Buffer.from(response.data);
  return uploadImage({ buffer, size: buffer.length, mimetype, originalname: `profile.${mimetype.split('/')[1] || 'jpg'}` }, folder);
};
const deleteImage = async (key, target = 'images') => {
  if (!key) return;
  const { bucket } = getImageTarget(target);
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
};

module.exports = { uploadImage, mirrorImage, deleteImage };

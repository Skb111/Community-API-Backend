// utils/imageUploader.js
const { minioClient, bucketName } = require('./minioClient');
const createLogger = require('./logger');
const path = require('path');
const { InternalServerError } = require('./customErrors');

const logger = createLogger('IMAGE_UPLOADER');

/**
 * Delete file from MinIO (fire and forget)
 * @param {string} key - Object key to delete
 * @param {string} imageType - Type of image for logging (e.g., 'profile picture', 'cover image')
 */
const deleteImage = (key, imageType = 'image') => {
  if (!key) return;

  minioClient
    .removeObject(bucketName, key)
    .then(() => {
      logger.info(`Old ${imageType} deleted: ${key}`);
    })
    .catch((error) => {
      logger.warn(`Failed to delete old ${imageType}: ${error.message}`);
    });
};

/**
 * Extract object key from URL
 * @param {string} url - Full URL or path
 * @returns {string|null} Object key or null
 */
const extractObjectKeyFromUrl = (url) => {
  if (!url) return null;
  const parts = url.split('/');
  return parts[parts.length - 1];
};

/**
 * Upload image to MinIO
 * @param {Object} options - Upload options
 * @param {Buffer} options.fileBuffer - File buffer
 * @param {string} options.originalFileName - Original file name
 * @param {string} options.mimeType - File MIME type (default: 'image/jpeg')
 * @param {string} options.imageType - Type of image for file naming (e.g., 'profile_picture', 'blog_cover')
 * @param {string} options.entityId - ID of the entity (user.id, blog.id, etc.)
 * @param {string} [options.oldImageUrl] - URL of old image to delete (optional)
 * @param {string} [options.imageTypeLabel] - Label for logging (e.g., 'profile picture', 'cover image')
 * @returns {Promise<string>} Image URL
 */
const uploadImage = async ({
  fileBuffer,
  originalFileName,
  mimeType = 'image/jpeg',
  imageType,
  entityId,
  oldImageUrl = null,
  imageTypeLabel = 'image',
}) => {
  try {
    if (!fileBuffer || !originalFileName || !imageType || !entityId) {
      throw new Error('Missing required parameters: fileBuffer, originalFileName, imageType, and entityId are required');
    }

    logger.info(`Uploading ${imageTypeLabel} for ${imageType} ${entityId} using: ${originalFileName}`);

    // Extract file extension (file already validated by multer middleware)
    const fileExtension = path.extname(originalFileName).toLowerCase().replace('.', '');

    // If old image exists, delete it (fire and forget)
    if (oldImageUrl) {
      const oldKey = extractObjectKeyFromUrl(oldImageUrl);
      deleteImage(oldKey, imageTypeLabel);
    }

    // Generate unique file name
    const fileName = `${imageType}_${entityId}_${Date.now()}.${fileExtension}`;

    // Upload to MinIO
    await minioClient.putObject(bucketName, fileName, fileBuffer, fileBuffer.length, {
      'Content-Type': mimeType,
    });

    // Generate file URL
    const fileUrl = `${bucketName}/${fileName}`;

    logger.info(`${imageTypeLabel} uploaded successfully for ${imageType} ${entityId}`);

    return fileUrl;
  } catch (error) {
    logger.error(`Error uploading ${imageTypeLabel}: ${error.message}`);

    // Re-throw custom errors
    if (error instanceof InternalServerError) {
      throw error;
    }

    // Wrap other errors in InternalServerError
    throw new InternalServerError(`Failed to upload ${imageTypeLabel}: ${error.message}`);
  }
};

/**
 * Convenience function for uploading profile pictures
 * @param {Object} options - Upload options
 * @param {Buffer} options.fileBuffer - File buffer
 * @param {string} options.originalFileName - Original file name
 * @param {string} options.mimeType - File MIME type
 * @param {string} options.userId - User ID
 * @param {string} [options.oldImageUrl] - URL of old profile picture
 * @returns {Promise<string>} Profile picture URL
 */
const uploadProfilePicture = async ({
  fileBuffer,
  originalFileName,
  mimeType = 'image/jpeg',
  userId,
  oldImageUrl = null,
}) => {
  return uploadImage({
    fileBuffer,
    originalFileName,
    mimeType,
    imageType: 'profile_picture',
    entityId: userId,
    oldImageUrl,
    imageTypeLabel: 'profile picture',
  });
};

/**
 * Convenience function for uploading blog cover images
 * @param {Object} options - Upload options
 * @param {Buffer} options.fileBuffer - File buffer
 * @param {string} options.originalFileName - Original file name
 * @param {string} options.mimeType - File MIME type
 * @param {string} options.blogId - Blog ID
 * @param {string} [options.oldImageUrl] - URL of old cover image
 * @returns {Promise<string>} Cover image URL
 */
const uploadBlogCoverImage = async ({
  fileBuffer,
  originalFileName,
  mimeType = 'image/jpeg',
  blogId,
  oldImageUrl = null,
}) => {
  return uploadImage({
    fileBuffer,
    originalFileName,
    mimeType,
    imageType: 'blog_cover',
    entityId: blogId,
    oldImageUrl,
    imageTypeLabel: 'cover image',
  });
};

module.exports = {
  uploadImage,
  uploadProfilePicture,
  uploadBlogCoverImage,
  deleteImage,
  extractObjectKeyFromUrl,
};


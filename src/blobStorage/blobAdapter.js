const { minioClient, bucketName: minioBucket } = require("./minioClient");
const {  uploadFile: s3Upload, deleteFile: s3Delete } = require("./s3Client");

const env = process.env.NODE_ENV || "development";

const isProduction = env === "production";

module.exports = {
  isProduction,

  async upload(key, buffer, mimeType) {
    if (isProduction) {
      // Upload using Supabase S3 (AWS SDK)
      await s3Upload(key, buffer, mimeType);

      return `${process.env.S3_BUCKET}/${key}`;
    }

    // Development: MinIO
    await minioClient.putObject(
      minioBucket,
      key,
      buffer,
      buffer.length,
      { "Content-Type": mimeType }
    );

    return `${minioBucket}/${key}`;
  },

  async delete(key) {
    if (!key) return;

    if (isProduction) {
      return s3Delete(key);
    }

    return minioClient.removeObject(minioBucket, key);
  },

  getBucket() {
    return isProduction ? process.env.S3_BUCKET : minioBucket;
  },
};

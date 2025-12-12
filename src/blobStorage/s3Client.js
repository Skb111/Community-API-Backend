const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} = require("@aws-sdk/client-s3");

const createLogger = require("../utils/logger");
const logger = createLogger("S3_CLIENT");

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION || "us-east-1";
const bucket = process.env.S3_BUCKET;

const s3 = new S3Client({
  region,
  endpoint, // Supabase S3 endpoint
  forcePathStyle: true, // REQUIRED for Supabase
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

async function ensureBucketExists() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    logger.info(`Bucket '${bucket}' already exists`);
  } catch {
    logger.warn(`Bucket '${bucket}' does not exist. Creating...`);
    await s3.send(
      new CreateBucketCommand({
        Bucket: bucket,
      })
    );
    logger.info(`Bucket '${bucket}' created successfully`);
  }
}

async function uploadFile(key, buffer, contentType = "application/octet-stream") {
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    logger.info(`Uploaded S3 object: ${key}`);
  } catch (error) {
    logger.error("S3 upload error:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

async function deleteFile(key) {
  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    logger.info(`Deleted S3 object: ${key}`);
  } catch (error) {
    logger.error("S3 delete error:", error);
    throw error;
  }
}

module.exports = {
  s3,
  ensureBucketExists,
  uploadFile,
  deleteFile,
};

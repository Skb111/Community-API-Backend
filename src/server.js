/**
 * Server Entry Point
 * ------------------
 * Starts the Express server.
 */

require('dotenv').config();
require('./db'); // Ensure DB connection is established

const createLogger = require('./utils/logger');
const logger = createLogger('SERVER');

// ENV-aware blob storage adapter
const { isProduction } = require("./blobStorage/blobAdapter");

// Only needed for development
const { initializeBucket } = require("./blobStorage/minioClient");

// Only needed for production
const { ensureBucketExists } = require("./blobStorage/s3Client");

const app = require('./app');
const process = require('process');

const PORT = process.env.PORT || 4000;

logger.info('👉 Loaded DB config:', {
  databaseUrl: process.env.DATABASE_URL
    ? `${process.env.DATABASE_URL.slice(0, 20)}#####`
    : 'Not set',
});

// Initialize storage bucket depending on environment
(async () => {
  try {
    if (isProduction) {
      logger.info("🌐 Running in PRODUCTION using Supabase S3");
      await ensureBucketExists();
      logger.info("✅ Supabase S3 bucket is ready");
    } else {
      logger.info("🛠 Running in DEVELOPMENT using MinIO");
      await initializeBucket();
      logger.info("✅ MinIO bucket initialized successfully");
    }
  } catch (error) {
    logger.warn(
      `⚠️ Failed to initialize storage bucket (${isProduction ? "S3" : "MinIO"}): ${error.message}`
    );
  }
})();

app
  .listen(PORT, () => {
    logger.info(`✅ Server running on http://localhost:${PORT}`);
  })
  .on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`❌ Port ${PORT} is already in use. Please use a different port.`);
    }
    throw err;
  });

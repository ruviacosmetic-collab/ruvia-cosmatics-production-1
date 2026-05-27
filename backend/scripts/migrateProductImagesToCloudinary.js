/**
 * Migrates Product.image values that point to local Next.js public assets (e.g. "/images/serum.png")
 * to Cloudinary URLs, then updates MongoDB records.
 *
 * Usage:
 *   cd backend
 *   node scripts/migrateProductImagesToCloudinary.js
 *
 * Requires:
 *   MONGO_URI, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const Product = require('../models/productModel');
const cloudinary = require('../config/cloudinary');

const isCloudinaryConfigured = () =>
  !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

const run = async () => {
  if (!isCloudinaryConfigured()) {
    console.error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET.');
    process.exit(1);
  }

  await connectDB();

  const candidates = await Product.find({
    image: { $regex: '^/images/', $options: 'i' },
  }).select('id name image');

  console.log(`Found ${candidates.length} product(s) with local /images/* paths`);
  if (candidates.length === 0) process.exit(0);

  // Repo layout: backend/ is sibling of Frontend/
  const frontendPublic = path.resolve(__dirname, '..', '..', 'Frontend', 'public');

  let updated = 0;
  for (const p of candidates) {
    const rel = String(p.image || '').replace(/^\/+/, ''); // "images/serum.png"
    const abs = path.join(frontendPublic, rel);

    if (!fs.existsSync(abs)) {
      console.warn(`Skipping ${p.id}: local file not found: ${abs}`);
      continue;
    }

    try {
      const uploadResp = await cloudinary.uploader.upload(abs, {
        folder: 'ruvia_products',
        overwrite: false,
        resource_type: 'image',
      });

      await Product.updateOne(
        { _id: p._id },
        { $set: { image: uploadResp.secure_url } }
      );

      updated += 1;
      console.log(`Updated ${p.id}: ${p.image} -> ${uploadResp.secure_url}`);
    } catch (e) {
      console.error(`Failed ${p.id}:`, e.message);
    }
  }

  console.log(`Done. Updated ${updated}/${candidates.length} products.`);
  process.exit(0);
};

run().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});


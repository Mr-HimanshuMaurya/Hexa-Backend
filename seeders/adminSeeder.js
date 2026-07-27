require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const ADMIN = {
  name: 'Hexa Admin',
  email: 'hexa@ignou.com',
  password: 'Hexa@Delhi',
  role: 'admin',
};

async function seedAdmin() {
  try {
    await mongoose.connect(
      process.env.MONGO_URI ||
        "mongodb://mauryahimanshu416_db_user:1qzz3W6E69AVxKMC@ac-6j1ucfm-shard-00-00.lrvuw3g.mongodb.net:27017,ac-6j1ucfm-shard-00-01.lrvuw3g.mongodb.net:27017,ac-6j1ucfm-shard-00-02.lrvuw3g.mongodb.net:27017/?ssl=true&replicaSet=atlas-d04h7v-shard-0&authSource=admin&appName=Hexa",
    );
    console.log('[SEED] Connected to MongoDB');

    const existing = await User.findOne({ email: ADMIN.email });

    if (existing) {
      existing.name = ADMIN.name;
      existing.password = ADMIN.password; // hashed by pre-save hook
      existing.role = ADMIN.role;
      await existing.save();
      console.log(`[SEED] Admin updated: ${ADMIN.email}`);
    } else {
      await User.create(ADMIN);
      console.log(`[SEED] Admin created: ${ADMIN.email}`);
    }

    console.log('[SEED] Done. Login with:');
    console.log(`       email:    ${ADMIN.email}`);
    console.log(`       password: ${ADMIN.password}`);
  } catch (err) {
    console.error('[SEED] Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedAdmin();

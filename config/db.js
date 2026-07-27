const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGO_URI ||
        "mongodb://mauryahimanshu416_db_user:1qzz3W6E69AVxKMC@ac-6j1ucfm-shard-00-00.lrvuw3g.mongodb.net:27017,ac-6j1ucfm-shard-00-01.lrvuw3g.mongodb.net:27017,ac-6j1ucfm-shard-00-02.lrvuw3g.mongodb.net:27017/?ssl=true&replicaSet=atlas-d04h7v-shard-0&authSource=admin&appName=Hexa",
    );
    console.log(`[DB] MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[DB] Connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

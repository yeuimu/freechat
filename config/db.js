const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI); // 移除不必要的选项
    console.log("MongoDB连接成功");
  } catch (error) {
    console.error("MongoDB连接失败:", error.message);
    process.exit(1); // Exit process with failure
  }
};

module.exports = connectDB;

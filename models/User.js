
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nickname: { type: String, required: true, unique: true },
  publicKey: { type: String, required: true },
  lastActiveAt: { type: Date, default: Date.now }, // 用户最后活跃时间
});

// 自动更新时间戳中间件
userSchema.pre('save', function (next) {
  this.lastActiveAt = new Date();
  next();
});

module.exports = mongoose.model('User', userSchema);


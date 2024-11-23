const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // 群聊名称
  members: { type: [String], default: [] }, // 成员用户名列表
  publicKey: { type: String, required: true }, // 群公钥（加密所需）
  createdAt: { type: Date, default: Date.now }, // 群聊创建时间
  updatedAt: { type: Date, default: Date.now }, // 最后一次群聊数据更新（方便管理过期群聊）
  maxMembers: { type: Number, default: 20 }, // 最大成员数量限制
});

module.exports = mongoose.model('Group', groupSchema);
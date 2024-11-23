const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: String, required: true }, // 发送者用户名
  recipient: { type: String, required: true }, // 接收者（用户名或聊天室 ID）
  content: { type: String, required: true }, // 加密的消息内容
  type: { type: String, required: true, enum: ['private', 'group', 'key'] }, // 消息类型：私聊(private) 或 群聊(group)
  deleteAt: { type: Date, default: null }, // 定时删除时间，null 表示不删除
  createdAt: { type: Date, default: Date.now }, // 消息发送时间
});

// 索引优化
messageSchema.index({ recipient: 1, createdAt: -1 }); // 根据接收方和时间排序查询
messageSchema.index({ deleteAt: 1 }); // 优化定时删除任务

module.exports = mongoose.model('Message', messageSchema);
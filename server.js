const express = require('express');
const bodyParser = require('body-parser');

const userRoutes = require('./routes/userRoutes');
const messageRoutes = require('./routes/messegeRoutes');
const groupRoutes = require('./routes/groupRoutes');

const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto'); // 用于签名验证

const mongoose = require('mongoose');
const connectDB = require('./config/db');

const Message = require('./models/Message');
const User = require('./models/User');

const cron = require('node-cron');
require('dotenv').config();

// 连接数据库
connectDB();

const app = express();

// 中间件
app.use(bodyParser.json());

// 路由
app.use('/api/users', userRoutes);
app.use('/api/messege', messageRoutes);
app.use('/api/group', groupRoutes);

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


// 定时任务：每天检测不活跃用户
cron.schedule('0 0 * * *', async () => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    const result = await User.deleteMany({ lastActiveAt: { $lt: oneDayAgo } });
    console.log(`Deleted ${result.deletedCount} inactive users`);
  } catch (error) {
    console.error('Error deleting inactive users:', error.message);
  }
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 活跃 WebSocket 连接
const connections = new Map(); // { username: WebSocket }

// 签名验证
function verifySignature(username, signature) {
  return User.findOne({ nickname: username })
    .then(user => {
      if (!user) throw new Error('User not found');
      const publicKey = user.publicKey;
      const verifier = crypto.createVerify('sha256');
      verifier.update(username);
      return verifier.verify(publicKey, Buffer.from(signature, 'base64'));
    });
}

// 通过群聊 ID 查询群聊成员
async function getGroupMembers(groupId) {
  try {
    const group = await Group.findById(groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    return group.members; // 返回成员用户名列表
  } catch (error) {
    console.error(`Error fetching group members: ${error.message}`);
    throw error;
  }
}

//  通过群id查看群是否有公钥
async function isGroupPublicKeyNull(groupId) {
  try {
    // 从数据库中查找群聊
    const group = await Group.findById(groupId);

    if (!group) {
      throw new Error('Group not found');
    }

    // 检查公钥是否为 null
    return group.publicKey === null;
  } catch (error) {
    console.error('Error checking group public key:', error.message);
    throw error; // 将错误抛出，以便调用方处理
  }
}

wss.on('connection', (ws) => {
  let username = null; // 登录用户的用户名

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      // 消息处理
      if (data.type === 'message') {
        const { chatType, recipient, content, deleteAt } = data;

        if (!username) {
          ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized user' }));
          return;
        }

        if (!['private', 'group'].includes(chatType)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid chat type' }));
          return;
        }

        // 创建消息
        const newMessage = new Message({
          sender: username,
          recipient,
          content,
          type: chatType, // 新增消息类型字段
          deleteAt: deleteAt ? new Date(deleteAt) : null,
        });

        const savedMessage = await newMessage.save();

        // 处理私聊
        if (chatType === 'private' || chatType === 'key') {
          const recipientWS = connections.get(recipient); // 假设 connections 存储用户 WebSocket 对象
          if (recipientWS) {
            recipientWS.send(
              JSON.stringify({
                type: 'message',
                chatType: 'private',
                sender: username,
                content,
                id: savedMessage._id,
              })
            );
          }
        }

        // 处理群聊
        else if (chatType === 'group') {
          if (isGroupPublicKeyNull(recipient)) {
            throw Error({
              type: 'groupPublicKeyNull',
              message: 'Group public key is null'
            })
          }
          const groupMembers = getGroupMembers(recipient); // 假设存在方法返回群成员
          groupMembers.forEach((member) => {
            const memberWS = connections.get(member);
            if (memberWS && member !== username) {
              memberWS.send(
                JSON.stringify({
                  type: 'message',
                  chatType: 'group',
                  sender: username,
                  content,
                  id: savedMessage._id,
                })
              );
            }
          });
        }

        // 返回消息状态
        ws.send(
          JSON.stringify({
            type: 'status',
            chatType,
            message: 'Message sent successfully',
            id: savedMessage._id,
          })
        );
      }
    } catch (error) {
      console.error('Error handling message:', error.message);
      ws.send(JSON.stringify(error));
    }
  });

  // 用户断开连接
  ws.on('close', () => {
    console.log(`User ${username} disconnected`);
  });
});

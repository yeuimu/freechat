const express = require('express');
const router = express.Router();
const User = require('../models/User');
const crypto = require('crypto');
const Message = require('../models/Message');

// 用户注册
router.post('/register', async (req, res) => {
  const { nickname, publicKey } = req.body;
  try {
    const user = new User({ nickname, publicKey });
    await user.save();
    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      user
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 用户名合法性检测
router.get('/validate', async (req, res) => {
  const { nickname } = req.query;
  try {
    const exists = await User.exists({ nickname });
    res.json({ success: !exists, message: 'Valid' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新用户活跃时间
router.post('/refresh', async (req, res) => {
  const { nickname } = req.body;
  try {
    const user = await User.findOneAndUpdate(
      { nickname },
      { lastActiveAt: new Date() },
      { new: true } // 返回更新后的文档
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ success: true, message: 'User activity refreshed', user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 用户搜索
router.get('/search', async (req, res) => {
  const { query } = req.query;

  if (!query || query.trim() === '') {
    return res.status(400).json({ success: false, message: 'Query parameter is required' });
  }

  try {
    // 全量匹配
    const exactMatch = await User.findOne({ nickname: query.trim() });
    if (exactMatch) {
      return res.status(200).json({
        success: true,
        message: 'Exists',
        results: [{ nickname: exactMatch.nickname, publicKey: exactMatch.publicKey }],
      });
    }
    // 无匹配结果
    return res.status(404).json({ success: false, message: 'No results', results: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 签名验证函数
async function verifySignature(username, signature) {
  try {
    const user = await User.findOne({ nickname: username });
    if (!user) throw new Error('User not found');

    const publicKey = user.publicKey;
    const verifier = crypto.createVerify('sha256');
    verifier.update(username);
    verifier.end();
    return verifier.verify(publicKey, Buffer.from(signature, 'base64'));
  } catch (error) {
    throw new Error('Signature verification failed: ' + error.message);
  }
}

// 用户注销 API
router.delete('/delete/:nickname', async (req, res) => {
  const { nickname } = req.params;
  const { signature } = req.body; // 从请求体中获取签名

  try {
    // 验证签名
    const isValid = await verifySignature(nickname, signature);
    if (!isValid) {
      return res.status(403).json({ success: false, message: 'Invalid signature' });
    }

    // 查找并删除用户
    const user = await User.findOneAndDelete({ nickname });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 删除用户发送的所有消息
    await Message.deleteMany({ sender: nickname });

    // 响应成功
    res.status(200).json({ success: true, message: 'User and associated messages deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;


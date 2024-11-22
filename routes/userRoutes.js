const express = require('express');
const router = express.Router();
const User = require('../models/User');

// 用户注册
router.post('/register', async (req, res) => {
  const { nickname, publicKey } = req.body;
  try {
    const user = new User({ nickname, publicKey });
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 用户名合法性检测
router.get('/validate', async (req, res) => {
  const { nickname } = req.query;
  try {
    const exists = await User.exists({ nickname });
    res.json({ valid: !exists });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


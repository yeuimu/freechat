const express = require('express');
const mongoose = require('mongoose');
const Group = require('../models/Group'); // 引入群聊模型

const router = express.Router();

// 创建群聊 API
router.post('/groups', async (req, res) => {
    const { name, members, publicKey } = req.body;

    // 验证请求数据
    if (!name || !publicKey || !Array.isArray(members)) {
        return res.status(400).json({ success: false, message: 'Invalid input. Name, publicKey, and members are required.' });
    }

    if (members.length > 20) {
        return res.status(400).json({ success: false, message: 'Group members cannot exceed 20.' });
    }

    try {
        // 创建群聊
        const group = new Group({
            name,
            members,
            publicKey,
        });

        await group.save();

        return res.status(201).json({
            success: true,
            message: 'Group created successfully.',
            group,
        });
    } catch (error) {
        console.error('Error creating group:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

// 加入群聊 API
router.post('/groups/:id/join', async (req, res) => {
    const { id } = req.params; // 群聊 ID
    const { username } = req.body; // 用户名

    if (!username) {
        return res.status(400).json({ success: false, message: 'Username is required.' });
    }

    try {
        const group = await Group.findById(id);

        if (!group) {
            return res.status(404).json({ success: false, message: 'Group not found.' });
        }

        if (group.members.includes(username)) {
            return res.status(400).json({ success: false, message: 'User is already a member of the group.' });
        }

        if (group.members.length >= 20) {
            return res.status(400).json({ success: false, message: 'Group is full. Cannot add more members.' });
        }

        // 添加成员并清空群公钥
        group.members.push(username);
        group.publicKey = null;
        group.updatedAt = new Date();

        await group.save();

        return res.status(200).json({
            success: true,
            message: 'User successfully joined the group.',
            group,
        });
    } catch (error) {
        console.error('Error joining group:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});


// 退出群聊 API
router.post('/groups/:id/leave', async (req, res) => {
    const { id } = req.params; // 群聊 ID
    const { username } = req.body; // 用户名

    if (!username) {
        return res.status(400).json({ success: false, message: 'Username is required.' });
    }

    try {
        const group = await Group.findById(id);

        if (!group) {
            return res.status(404).json({ success: false, message: 'Group not found.' });
        }

        if (!group.members.includes(username)) {
            return res.status(400).json({ success: false, message: 'User is not a member of the group.' });
        }

        // 移除成员并清空群公钥
        group.members = group.members.filter(member => member !== username);
        group.publicKey = null;
        group.updatedAt = new Date();

        if (group.members.length === 0) {
            await group.remove();
            return res.status(200).json({ success: true, message: 'Group deleted as it is empty.' });
        }

        await group.save();

        return res.status(200).json({
            success: true,
            message: 'User successfully left the group.',
            group,
        });
    } catch (error) {
        console.error('Error leaving group:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});


module.exports = router;

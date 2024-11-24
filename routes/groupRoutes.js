const express = require('express');
const mongoose = require('mongoose');
const Group = require('../models/Group'); // 引入群聊模型

const router = express.Router();

// 创建群聊 API
router.post('/groups', async (req, res) => {
    const { name } = req.body;

    try {
        // 创建群聊
        const group = new Group({
            name,
            members: [],
            publicKey: null,
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

// 设置群密钥 API
router.post('/groups/:id/set-key', async (req, res) => {
    const { id } = req.params; // 群聊 ID
    const { username, newKey } = req.body; // 当前用户和新群密钥

    if (!username || !newKey) {
        return res.status(400).json({
            success: false,
            message: 'Username and newKey are required.',
        });
    }

    try {
        // 查找群聊
        const group = await Group.findById(id);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found.',
            });
        }

        // 验证当前用户是否是群成员
        if (!group.members.includes(username)) {
            return res.status(403).json({
                success: false,
                message: 'You are not a member of this group.',
            });
        }

        // 查找分发密钥的消息（type: "key" 且群聊 updatedAt 之后）
        const keyMessages = await Message.find({
            recipient: id, // 群聊 ID
            type: 'key',
            createdAt: { $gte: group.updatedAt },
        });

        // 收集所有分发密钥消息的目标用户
        const distributedMembers = keyMessages.map(msg => msg.sender);

        // 检查分发密钥的目标是否包含所有群成员
        const allMembersReceived = group.members.every(member =>
            distributedMembers.includes(member)
        );

        if (!allMembersReceived) {
            return res.status(400).json({
                success: false,
                message: 'Not all members have received the group key.',
                missingMembers: group.members.filter(
                    member => !distributedMembers.includes(member)
                ),
            });
        }

        // 更新群聊公钥并更新时间戳
        group.publicKey = newKey;
        group.updatedAt = new Date();
        await group.save();

        return res.status(200).json({
            success: true,
            message: 'Group key has been successfully set.',
            group,
        });
    } catch (error) {
        console.error('Error setting group key:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error.',
        });
    }
});

module.exports = router;

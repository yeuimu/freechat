const express = require('express');
const Message = require('../models/Message');

const router = express.Router();

// 删除消息
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const message = await Message.findById(id);

        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        await Message.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// 获取消息
router.get('/', async (req, res) => {
    try {
        const { recipient, sender, afterDate, type } = req.query;

        if (!recipient || !sender || !afterDate) {
            return res.status(400).json({ success: false, message: 'Missing required query parameters' });
        }

        const messages = await Message.find({
            type,
            recipient,
            sender,
            createdAt: { $gt: new Date(afterDate) },
        });

        res.status(200).json({ success: true, messages });
    } catch (error) {
        console.error('Error retrieving messages:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router;
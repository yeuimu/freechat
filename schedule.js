const cron = require('node-cron');
const User = require('./models/User');


module.exports = () => {
    // 定时任务：每天检测不活跃用户
    cron.schedule('0 0 * * *', async () => {
        const towDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000 * 2);
        try {
            const result = await User.deleteMany({ lastActiveAt: { $lt: towDayAgo } });
            console.log(`Deleted ${result.deletedCount} inactive users`);
        } catch (error) {
            console.error('Error deleting inactive users:', error.message);
        }
    });
}
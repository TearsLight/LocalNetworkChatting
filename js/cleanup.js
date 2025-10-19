const Database = require('../database');

const db = new Database('./chat.db');

async function cleanup() {
    console.log('开始清理旧数据...\n');
    
    try {
        const deletedCount = await db.cleanOldMessages(30);
        console.log(`已删除 ${deletedCount} 条超过30天的消息`);
        
        const stats = await db.getStatistics();
        console.log('\n当前数据库统计:');
        console.log(`   总用户数: ${stats.totalUsers}`);
        console.log(`   总消息数: ${stats.totalMessages}`);
        console.log(`   总会话数: ${stats.totalSessions}`);
        console.log(`   今日消息: ${stats.todayMessages}`);
        
        await db.close();
        console.log('\n清理完成');
        process.exit(0);
    } catch (err) {
        console.error('清理失败:', err);
        process.exit(1);
    }
}

cleanup();
const Database = require('better-sqlite3');
const path = require('path');

class ChatDatabase {
    constructor(dbPath = './chat.db') {
        this.db = new Database(dbPath);
        // WAL mode for better concurrent read performance
        this.db.pragma('journal_mode = WAL');
        this.initTables();
        console.log('SQLite 数据库连接成功');
    }

    initTables() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nickname TEXT NOT NULL,
                ip_address TEXT,
                first_join DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                total_messages INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                nickname TEXT NOT NULL,
                ip_address TEXT,
                join_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                leave_time DATETIME,
                duration INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER,
                nickname TEXT NOT NULL,
                ip_address TEXT,
                message TEXT NOT NULL,
                message_type TEXT DEFAULT 'user',
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            );
            CREATE TABLE IF NOT EXISTS system_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                log_type TEXT NOT NULL,
                message TEXT NOT NULL,
                ip_address TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ 数据库表初始化完成');
    }

    // ========== 用户 ==========
    findOrCreateUser(nickname, ipAddress) {
        const row = this.db.prepare(
            'SELECT * FROM users WHERE nickname = ? ORDER BY last_seen DESC LIMIT 1'
        ).get(nickname);

        if (row) {
            this.db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);
            return row;
        }

        const result = this.db.prepare(
            'INSERT INTO users (nickname, ip_address) VALUES (?, ?)'
        ).run(nickname, ipAddress);
        return { id: result.lastInsertRowid, nickname, ip_address: ipAddress };
    }

    incrementUserMessages(userId) {
        this.db.prepare('UPDATE users SET total_messages = total_messages + 1 WHERE id = ?').run(userId);
    }

    // ========== 会话 ==========
    createSession(userId, nickname, ipAddress) {
        const result = this.db.prepare(
            'INSERT INTO sessions (user_id, nickname, ip_address) VALUES (?, ?, ?)'
        ).run(userId, nickname, ipAddress);
        return result.lastInsertRowid;
    }

    endSession(sessionId) {
        this.db.prepare(`
            UPDATE sessions
            SET leave_time = CURRENT_TIMESTAMP,
                duration = CAST((julianday(CURRENT_TIMESTAMP) - julianday(join_time)) * 86400 AS INTEGER)
            WHERE id = ?
        `).run(sessionId);
    }

    // ========== 消息相关 ==========
    saveMessage(sessionId, nickname, ipAddress, message, messageType = 'user') {
        const result = this.db.prepare(
            'INSERT INTO messages (session_id, nickname, ip_address, message, message_type) VALUES (?, ?, ?, ?, ?)'
        ).run(sessionId, nickname, ipAddress, message, messageType);
        return result.lastInsertRowid;
    }

    getRecentMessages(limit = 50) {
        const rows = this.db.prepare(`
            SELECT nickname, message, message_type,
                   strftime('%H:%M:%S', timestamp) as time
            FROM messages
            ORDER BY id DESC
            LIMIT ?
        `).all(limit);
        return rows.reverse();
    }

    getMessagesByDateRange(startDate, endDate) {
        return this.db.prepare(`
            SELECT * FROM messages
            WHERE timestamp BETWEEN ? AND ?
            ORDER BY timestamp
        `).all(startDate, endDate);
    }

    searchMessages(keyword, limit = 100) {
        return this.db.prepare(`
            SELECT * FROM messages
            WHERE message LIKE ?
            ORDER BY timestamp DESC
            LIMIT ?
        `).all(`%${keyword}%`, limit);
    }

    // ========== 系统日志 ==========
    logSystem(logType, message, ipAddress = null) {
        this.db.prepare(
            'INSERT INTO system_logs (log_type, message, ip_address) VALUES (?, ?, ?)'
        ).run(logType, message, ipAddress);
    }

    // ========== 统计信息 ==========
    getStatistics() {
        const totalUsers = this.db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const totalMessages = this.db.prepare('SELECT COUNT(*) as count FROM messages').get().count;
        const totalSessions = this.db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
        const todayMessages = this.db.prepare(
            'SELECT COUNT(*) as count FROM messages WHERE DATE(timestamp) = DATE(\'now\')'
        ).get().count;

        return { totalUsers, totalMessages, totalSessions, todayMessages };
    }

    getTopUsers(limit = 10) {
        return this.db.prepare(`
            SELECT nickname, total_messages,
                   strftime('%Y-%m-%d %H:%M:%S', last_seen) as last_seen
            FROM users
            ORDER BY total_messages DESC
            LIMIT ?
        `).all(limit);
    }

    cleanOldMessages(days = 30) {
        const result = this.db.prepare(`
            DELETE FROM messages
            WHERE timestamp < datetime('now', '-' || ? || ' days')
        `).run(days);
        return result.changes;
    }

    close() {
        this.db.close();
        console.log('数据库连接已关闭');
    }
}

module.exports = ChatDatabase;

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor(dbPath = './chat.db') {
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('数据库连接失败:', err.message);
            } else {
                console.log('SQLite 数据库连接成功');
                this.initTables();
            }
        });
    }
    initTables() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nickname TEXT NOT NULL,
                ip_address TEXT,
                first_join DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                total_messages INTEGER DEFAULT 0
            )
        `, (err) => {
            if (err) console.error('创建 users 表失败:', err);
        });
        this.db.run(`
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                nickname TEXT NOT NULL,
                ip_address TEXT,
                join_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                leave_time DATETIME,
                duration INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `, (err) => {
            if (err) console.error('创建 sessions 表失败:', err);
        });

        this.db.run(`
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER,
                nickname TEXT NOT NULL,
                ip_address TEXT,
                message TEXT NOT NULL,
                message_type TEXT DEFAULT 'user',
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )
        `, (err) => {
            if (err) console.error('创建 messages 表失败:', err);
        });

        this.db.run(`
            CREATE TABLE IF NOT EXISTS system_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                log_type TEXT NOT NULL,
                message TEXT NOT NULL,
                ip_address TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) console.error('创建 system_logs 表失败:', err);
        });

        console.log('✅ 数据库表初始化完成');
    }

// ========== 用户 ==========
    findOrCreateUser(nickname, ipAddress) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE nickname = ? ORDER BY last_seen DESC LIMIT 1',
                [nickname],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (row) {
                        this.db.run(
                            'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?',
                            [row.id]
                        );
                        resolve(row);
                    } else {
                        this.db.run(
                            'INSERT INTO users (nickname, ip_address) VALUES (?, ?)',
                            [nickname, ipAddress],
                            function(err) {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve({ id: this.lastID, nickname, ip_address: ipAddress });
                                }
                            }
                        );
                    }
                }
            );
        });
    }
    incrementUserMessages(userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET total_messages = total_messages + 1 WHERE id = ?',
                [userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

// ========== 会话 ==========
    
    createSession(userId, nickname, ipAddress) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO sessions (user_id, nickname, ip_address) VALUES (?, ?, ?)',
                [userId, nickname, ipAddress],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    endSession(sessionId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE sessions 
                 SET leave_time = CURRENT_TIMESTAMP,
                     duration = CAST((julianday(CURRENT_TIMESTAMP) - julianday(join_time)) * 86400 AS INTEGER)
                 WHERE id = ?`,
                [sessionId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

// ========== 消息相关 ==========
    saveMessage(sessionId, nickname, ipAddress, message, messageType = 'user') {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO messages (session_id, nickname, ip_address, message, message_type) VALUES (?, ?, ?, ?, ?)',
                [sessionId, nickname, ipAddress, message, messageType],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }
    getRecentMessages(limit = 50) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT nickname, message, message_type, 
                        strftime('%H:%M:%S', timestamp) as time
                 FROM messages 
                 ORDER BY id DESC 
                 LIMIT ?`,
                [limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows.reverse());
                }
            );
        });
    }
    getMessagesByDateRange(startDate, endDate) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM messages 
                 WHERE timestamp BETWEEN ? AND ?
                 ORDER BY timestamp`,
                [startDate, endDate],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    searchMessages(keyword, limit = 100) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM messages 
                 WHERE message LIKE ?
                 ORDER BY timestamp DESC
                 LIMIT ?`,
                [`%${keyword}%`, limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

// ========== 系统日志 ==========
    
    logSystem(logType, message, ipAddress = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO system_logs (log_type, message, ip_address) VALUES (?, ?, ?)',
                [logType, message, ipAddress],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }
// ========== 统计信息 ==========
    getStatistics() {
        return new Promise((resolve, reject) => {
            const stats = {};
            
            Promise.all([
                new Promise((res, rej) => {
                    this.db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
                        if (err) rej(err);
                        else res(row.count);
                    });
                }),
                new Promise((res, rej) => {
                    this.db.get('SELECT COUNT(*) as count FROM messages', (err, row) => {
                        if (err) rej(err);
                        else res(row.count);
                    });
                }),
                new Promise((res, rej) => {
                    this.db.get('SELECT COUNT(*) as count FROM sessions', (err, row) => {
                        if (err) rej(err);
                        else res(row.count);
                    });
                }),
                new Promise((res, rej) => {
                    this.db.get(
                        'SELECT COUNT(*) as count FROM messages WHERE DATE(timestamp) = DATE("now")',
                        (err, row) => {
                            if (err) rej(err);
                            else res(row.count);
                        }
                    );
                })
            ]).then(([totalUsers, totalMessages, totalSessions, todayMessages]) => {
                resolve({
                    totalUsers,
                    totalMessages,
                    totalSessions,
                    todayMessages
                });
            }).catch(reject);
        });
    }
    getTopUsers(limit = 10) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT nickname, total_messages, 
                        strftime('%Y-%m-%d %H:%M:%S', last_seen) as last_seen
                 FROM users 
                 ORDER BY total_messages DESC 
                 LIMIT ?`,
                [limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }
    cleanOldMessages(days = 30) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `DELETE FROM messages 
                 WHERE timestamp < datetime('now', '-' || ? || ' days')`,
                [days],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }
    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) reject(err);
                else {
                    console.log('数据库连接已关闭');
                    resolve();
                }
            });
        });
    }
}

module.exports = Database;
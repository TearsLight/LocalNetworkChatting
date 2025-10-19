const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor(dbPath = './chat.db') {
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('数据库连接失败:', err.message);
            } else {
                console.log('✅ SQLite 数据库连接成功');
                this.initTables();
            }
        });
    }

    // 初始化数据库表
    initTables() {
        // 用户表
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

        // 会话表（每次连接的记录）
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

        // 消息表
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

        // 系统日志表
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

    // ========== 用户相关 ==========
    
    // 查找或创建用户
    findOrCreateUser(nickname, ipAddress) {
        return new Promise((resolve, reject) => {
            // 先查找用户
            this.db.get(
                'SELECT * FROM users WHERE nickname = ? ORDER BY last_seen DESC LIMIT 1',
                [nickname],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (row) {
                        // 更新最后在线时间
                        this.db.run(
                            'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?',
                            [row.id]
                        );
                        resolve(row);
                    } else {
                        // 创建新用户
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

    // 更新用户消息计数
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

    // ========== 会话相关 ==========
    
    // 创建新会话
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

    // 结束会话
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
    
    // 保存消息
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

    // 获取最近的消息（用于新用户加载历史记录）
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
                    else resolve(rows.reverse()); // 反转顺序，让最早的消息在前
                }
            );
        });
    }

    // 按日期范围获取消息
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

    // 搜索消息
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
    
    // 记录系统日志
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
    
    // 获取统计信息
    getStatistics() {
        return new Promise((resolve, reject) => {
            const stats = {};
            
            Promise.all([
                // 总用户数
                new Promise((res, rej) => {
                    this.db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
                        if (err) rej(err);
                        else res(row.count);
                    });
                }),
                // 总消息数
                new Promise((res, rej) => {
                    this.db.get('SELECT COUNT(*) as count FROM messages', (err, row) => {
                        if (err) rej(err);
                        else res(row.count);
                    });
                }),
                // 总会话数
                new Promise((res, rej) => {
                    this.db.get('SELECT COUNT(*) as count FROM sessions', (err, row) => {
                        if (err) rej(err);
                        else res(row.count);
                    });
                }),
                // 今天的消息数
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

    // 获取活跃用户排行
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

    // ========== 清理和维护 ==========
    
    // 清理旧数据（超过指定天数的消息）
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

    // 关闭数据库连接
    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) reject(err);
                else {
                    console.log('✅ 数据库连接已关闭');
                    resolve();
                }
            });
        });
    }
}

module.exports = Database;
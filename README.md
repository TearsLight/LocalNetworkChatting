# LocalNetworkChatting

一个基于 WebSocket 和 SQLite 的本地网络聊天应用，支持局域网内实时通信与消息持久化存储。

## 项目简介

LocalNetworkChatting 是一个轻量级的局域网聊天系统，旨在提供简单、高效的本地网络通信解决方案。该项目包含服务器端和客户端组件，通过 WebSocket 实现实时消息传输，并使用 SQLite 数据库记录聊天历史、用户信息等数据。

## V 1.1 更新
 - SQL数据库以保留信息
 - admin数据库管理
 
## 技术栈
 - 后端：Node.js
 - 通信协议：WebSocket
 - 数据库：SQLite
## 功能特点
 - 局域网内多用户实时聊天
 - 消息历史记录持久化存储
 - 用户状态跟踪
 - 系统日志与统计信息
 - 数据清理、导出等辅助功能
### 依赖
 - Node.js（v10 及以上版本）
 - npm（通常随 Node.js 一同安装）
### 安装步骤
 - 克隆或下载项目到本地
 - 进入项目目录，安装依赖：
   ```bash
   npm install
   ```
### 运行方式
- 启动服务器：
  ```bash
  npm start
  ```
- 启动开发服务器：
  ```bash
  npm run dev
  ```
## 项目结构
- `server.js`：服务器端核心代码，处理 WebSocket 连接与消息转发
- `chat.html`：用户聊天界面
- `admin.html`：管理员界面
- `database.js`：数据库操作相关逻辑
- `chat.db`：SQLite 数据库文件
- `assets/`：静态资源（图片、视频等）
- `css/`：样式表文件
- `js/`：客户端脚本
- `scripts/`：辅助脚本（数据清理、统计、导出等）
## 数据库设计
使用 SQLite 数据库，包含以下表：
- `users`：存储用户信息
- `sessions`：用户连接会话
- `messages`：聊天消息
- `system_logs`：系统事件日志
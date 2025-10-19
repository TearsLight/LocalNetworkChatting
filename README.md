## 核心功能
- **匿名聊天**：输入昵称即可参与（默认“Anonymous”）。
- **实时消息**：基于 WebSocket 实现全双工通信，消息发送后所有在线用户即时可见。
- **多端兼容**：前端采用响应式设计，支持 PC、平板和手机端访问。



## 技术栈
- **前端**：HTML5 + CSS3 + JavaScript。
- **后端**：Node.js + 原生 WebSocket 协议。
- **通信协议**：WebSocket。


## 项目结构
```
chatroom/
├── assets/
│   └── backgroundVideo.mp4
├── css/
│   └── style.css
├── js/
│   └── script.js
├── chat.html
├── package.json
└── server.js
```


## 项目部署
1. 安装依赖：`npm install`。
2. 启动服务：`node server.js`。
3. 访问聊天室：浏览器打开 `http://服务器IP:9090`。


## 应用场景
- 学习 WebSocket 协议的**入门实践项目**。
- 小型社区、兴趣群组的**临时交流平台**。
- 开发团队的**内部实时沟通工具**。

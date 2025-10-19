## 核心功能
- 匿名聊天：输入昵称即可参与（默认“Anonymous”）。
- 实时消息：基于 WebSocket 实现全双工通信，消息发送后所有在线用户即时可见。

## 技术栈
- 前端：HTML5 + CSS3 + JavaScript。
- 后端：Node.js + WebSocket。
- 通信协议：WebSocket。


## 项目结构
```
.
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
安装依赖：`npm install`。
启动服务：`node server.js`。
访问聊天室：`http://服务器IP:9090`。

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');

const userRoutes = require('./routes/userRoutes');
const messageRoutes = require('./routes/messegeRoutes');
const groupRoutes = require('./routes/groupRoutes');


// 连接数据库
require('./config/db')();

const app = express();

// 配置 CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 中间件
app.use(bodyParser.json());

// 路由
app.use('/user', userRoutes);
app.use('/messege', messageRoutes);
app.use('/group', groupRoutes);

// 启动服务器
const HTTP_PORT = process.env.HTTP_PORT || 3000;
app.listen(HTTP_PORT, () => {
  console.log(`API Server running on port ${HTTP_PORT}`);
});

// 启动 WebSocket 服务器
const server = http.createServer(app);
require('./websocket')(server);

const WS_PORT = process.env.WS_PORT || 3001;
server.listen(WS_PORT, () => {
  console.log(`WebSocket Server running on port ${WS_PORT}`);
});

// 定时任务
require('./schedule')();
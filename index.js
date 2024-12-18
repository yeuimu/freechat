const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');

const userRoutes = require('./routes/userRoutes');
const messageRoutes = require('./routes/messegeRoutes');
const groupRoutes = require('./routes/groupRoutes');
const errorRoutes = require('./routes/errorRoutes');

// 连接数据库
require('./config/db')();
require('./config/redis').startRedis();

const app = express();

// 配置 CORS
app.use(cors());

// 中间件
app.use(bodyParser.json());

// 路由
app.use('/user', userRoutes);
app.use('/messege', messageRoutes);
app.use('/group', groupRoutes);
app.use(errorRoutes);

// 启动 WebSocket 服务器
const server = http.createServer(app);
require('./socket/index').startSocket(server);

// 启动服务器
const HTTP_PORT = process.env.HTTP_PORT || 3000;
server.listen(HTTP_PORT, () => {
  console.log("API服务器运行成功");
});

// 定时任务
require('./schedule')();
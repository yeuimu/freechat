const { Server } = require("socket.io");
const crypto = require("crypto");
const Message = require("./models/Message");
const User = require("./models/User");
const Group = require("./models/Group");
const { createLogger, format, transports } = require("winston");

const connections = new Map(); // { username: socket }
const missedMessages = []; // { username: message }
const events = new Map(); // nicknam => [{eventName, data, sender}]

// 错误码枚举
const Errors = {
  USER_NOT_FOUND: {
    code: 1,
    message: "USER_NOT_FOUND",
  },
  AUTHENTICATION_ERROR: {
    code: 2,
    message: "AUTHENTICATION_ERROR",
  },
  GROUP_NOT_FOUND: {
    code: 3,
    message: "GROUP_NOT_FOUND",
  },
  GROUP_PUBLIC_KEY_NULL: {
    code: 4,
    message: "GROUP_PUBLIC_KEY_NULL",
  },
  INVALID_CHAT_TYPE: {
    code: 5,
    message: "INVALID_CHAT_TYPE",
  },
};

// 响应码枚举
const Responds = {
  MsgMissedOffline: {
    code: 1,
    message: "Recipient is offline, message not delivered",
  },
  MsgDeliveredSuccessfully: {
    code: 2,
    message: "Message delivered successfully",
  },
};

// 使用更强大的日志系统
const logger = createLogger({
  level: "info",
  format: format.simple(),
  transports: [
    new transports.Console(),
    new transports.File({ filename: "combined.log" }),
  ],
});

// 签名验证函数
async function verifySignature(username, signature) {
  try {
    const user = await User.findOne({ nickname: username });
    if (!user) throw new Error("User not found");

    const publicKey = user.publicKey; // 从数据库读取用户的公钥
    const verifier = crypto.createVerify("sha256");
    verifier.update(username);
    verifier.end();

    // 使用 RSA-PSS 验证签名
    const isVerified = verifier.verify(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: 32, // 必须和客户端配置一致
      },
      Buffer.from(signature, "base64")
    );

    return isVerified;
  } catch (error) {
    throw new Error("Signature verification failed: " + error.message);
  }
}

// 通过群聊 ID 查询群聊成员
async function getGroupMembers(groupId) {
  try {
    const group = await Group.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }
    return group.members;
  } catch (error) {
    console.error(`Error fetching group members: ${error.message}`);
    throw error;
  }
}

// 通过群id查看群是否有公钥
async function isGroupPublicKeyNull(groupId) {
  try {
    const group = await Group.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }
    return group.publicKey === null;
  } catch (error) {
    console.error("Error checking group public key:", error.message);
    throw error;
  }
}

// 转达消息
const deliverMessage = async (
  recipientSocket,
  { type, sender, content, create }
) => {
  const newMessage = new Message({
    sender,
    recipient: recipientSocket.username,
    content: content.cipherText,
    type,
    deleteAt: null,
    createdAt: create,
  });
  const savedMessage = await newMessage.save();
  const toMessage = {
    type,
    sender,
    content,
    id: savedMessage._id,
    create: create,
  };
  // 私聊和密钥消息
  if (type === "private" || type === "key") {
    recipientSocket.emit("message", toMessage);
  }
  // 群消息
  else if (type === "group") {
    // if (await isGroupPublicKeyNull(recipient)) {
    //   throw new Error(Errors.GROUP_PUBLIC_KEY_NULL.message);
    // }
    // socket.to(recipient).emit("message", toMessage);
  }
  return toMessage;
};

// 添加没有处理的事件
const addEvent = (username, data) => {
  if (events.has(username)) {
    events.get(username).push(data);
  } else {
    events.set(username, [data]);
  }
}

module.exports = function (server) {
  const io = new Server(server, {
    cors: {
      origin: "*", // 允许所有源
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // 允许的HTTP方法
      credentials: true, // 允许凭据
    },
  });

  // 中间件进行身份验证
  io.use(async (socket, next) => {
    const { username, signature } = socket.handshake.auth;
    try {
      const isValid = await verifySignature(username, signature);
      if (!isValid) {
        logger.error(`${username}' signature is valid!`);
        return next(new Error(Errors.AUTHENTICATION_ERROR.message));
      }
      socket.username = username;
      connections.set(username, socket);
      next();
    } catch (error) {
      next(new Error(Errors.AUTHENTICATION_ERROR.message));
    }
  });

  io.on("connection", async (socket) => {
    logger.info(
      `User ${socket.username} connected with ${socket.conn.transport.name} protocol`
    );

    // 处理用户错过的消息
    if (events.has(socket.username)) {
      const missedEvent = events.get(socket.username);
      missedEvent.map((e) => {
        const {eventName, toMessage, sender} = e;
        switch (eventName) {
          case 'message':
            socket.emit(eventName, toMessage);
            const data = {
              code: Responds.MsgDeliveredSuccessfully.code,
              message: Responds.MsgDeliveredSuccessfully.message,
              toMessage,
            };
            if (connections.has(sender)) {
              const recipientSocket = connections.get(sender);
              recipientSocket.emit('respond', data);
            } else {
              addEvent(sender, data);
            }
            break;
          case 'respond':
            socket.emit('respond', {
              code: Responds.MsgDeliveredSuccessfully.code,
              message: Responds.MsgDeliveredSuccessfully.message,
              toMessage,
            })
            break;
        }
      });
    }

    // 用户更新到websocket
    socket.conn.on("upgrade", (transport) => {
      logger.info(
        `User ${socket.username} connection upgraded to ${transport.name}`
      );
    });

    // 处理用户私聊和群聊
    socket.on("message", async (data) => {
      try {
        const { type, recipient, content, create } = data;

        // type 是否正确
        if (!["private", "group", "key"].includes(type)) {
          socket.emit("error", {
            code: Errors.INVALID_CHAT_TYPE.code,
            message: Errors.INVALID_CHAT_TYPE.message,
          });
          logger.error(`${socket.username}'s chat type is invalid: ${type}`);
          return;
        }

        const recipientSocket = connections.get(recipient);
        // 对方在线
        if (recipientSocket) {
          const toMessage = await deliverMessage(recipientSocket, {
            type,
            sender: socket.username,
            content: content,
            create,
          });
          // 转达消息完成后,响应客户端
          logger.info(
            `Message from ${socket.username} to ${recipientSocket.username}: ${content}`
          );
          socket.emit("respond", {
            code: Responds.MsgDeliveredSuccessfully.code,
            message: Responds.MsgDeliveredSuccessfully.message,
            toMessage,
          });
        }
        // 对方不在线,把事件丢在 events 中, 等对方上线了再处理
        else {
          const toMessage = {
            type,
            sender: socket.username,
            content,
            create,
          };
          const data = {eventName: "message", toMessage, sender: socket.username};
          addEvent(recipient, data);
          socket.emit("respond", {
            code: Responds.MsgMissedOffline.code,
            message: Responds.MsgMissedOffline.message,
            toMessage,
          });
          logger.info(
            `The message to be sent to ${recipient} from ${socket.username} is failed, then stored it at buffers for it be resent`
          );
          return;
        }
      } catch (error) {
        logger.error("Error handling message", {
          error: error.message,
          userId: socket.username,
          stack: error.stack,
        });
        socket.emit("error", { code: error.message, message: error.message });
      }
    });

    // 用户断开连接
    socket.on("disconnect", () => {
      logger.info(`${socket.username} disconnected`);
      connections.delete(socket.username);
    });

    // 处理用户加入群聊
    socket.on("join", (groupId) => {
      socket.join(groupId);
      logger.info(`User ${socket.username} joined group ${groupId}`, {
        userId: socket.username,
        groupId,
      });
    });
  });

  // 初始化时为每个群组创建房间
  Group.find()
    .then((groups) => {
      groups.forEach((group) => {
        io.of("/").adapter.rooms[group._id] = new Set();
      });
    })
    .catch((error) => {
      logger.error("Error initializing group rooms", { error: error.message });
    });
};

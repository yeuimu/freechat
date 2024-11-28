const { Server } = require("socket.io");
const crypto = require("crypto");
const Message = require("./models/Message");
const User = require("./models/User");
const Group = require("./models/Group");
const { createLogger, format, transports } = require("winston");

const connections = new Map(); // { username: socket }

// 定义错误码枚举
const ErrorCodes = {
  USER_NOT_FOUND: "USER_NOT_FOUND",
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
  GROUP_NOT_FOUND: "GROUP_NOT_FOUND",
  GROUP_PUBLIC_KEY_NULL: "GROUP_PUBLIC_KEY_NULL",
  INVALID_CHAT_TYPE: "INVALID_CHAT_TYPE",
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
    const { username, signature } = socket.handshake.query;
    try {
      const isValid = await verifySignature(username, signature);
      if (!isValid) {
        logger.error(`${username}' signature is valid!`);
        return next(new Error(ErrorCodes.AUTHENTICATION_ERROR));
      }
      socket.username = username;
      connections.set(username, socket);
      next();
    } catch (error) {
      next(new Error(ErrorCodes.AUTHENTICATION_ERROR));
    }
  });

  io.on("connection", (socket) => {
    logger.info(
      `User ${socket.username} connected with ${socket.conn.transport.name} protocol`
    );

    socket.conn.on("upgrade", (transport) => {
      logger.info(`User ${socket.username} connection upgraded to ${transport.name}`);
    });

    socket.on("message", async (data) => {
      try {
        const { chatType, recipient, content, deleteAt } = data;

        if (!["private", "group", "key"].includes(chatType)) {
          socket.emit("error", {
            code: ErrorCodes.INVALID_CHAT_TYPE,
            message: "Invalid chat type",
          });
          return;
        }

        const newMessage = new Message({
          sender: socket.username,
          recipient,
          content,
          type: chatType,
          deleteAt: deleteAt ? new Date(deleteAt) : null,
        });

        const savedMessage = await newMessage.save();

        // 私聊和密钥消息
        if (chatType === "private" || chatType === "key") {
          const recipientSocket = connections.get(recipient);
          if (recipientSocket) {
            recipientSocket.emit("message", {
              // type: "private",
              sender: socket.username,
              content,
              id: savedMessage._id,
            });
          }
          logger.info(`${socket.username} send to ${recipientSocket.username}: ${content}`);
        } else if (chatType === "group") {
          // 群消息
          if (await isGroupPublicKeyNull(recipient)) {
            throw new Error(ErrorCodes.GROUP_PUBLIC_KEY_NULL);
          }
          socket.to(recipient).emit("message", {
            chatType: "group",
            sender: socket.username,
            content,
            id: savedMessage._id,
          });
        }

        socket.emit("status", {
          chatType,
          message: "Message sent successfully",
          id: savedMessage._id,
        });
      } catch (error) {
        logger.error("Error handling message", {
          error: error.message,
          userId: socket.username,
        });
        socket.emit("error", { code: error.message, message: error.message });
      }
    });

    // 断开连接
    socket.on("disconnect", () => {
      logger.info(`${socket.username} disconnected`);
      connections.delete(socket.username);
    });

    // 处理群组加入
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

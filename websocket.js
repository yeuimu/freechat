const socketIO = require('socket.io');
const crypto = require('crypto');
const Message = require('./models/Message');
const User = require('./models/User');
const Group = require('./models/Group');

const connections = new Map(); // { username: socket }

// 签名验证
async function verifySignature(username, signature) {
  return User.findOne({ nickname: username })
    .then(user => {
      if (!user) throw new Error('User not found');
      const publicKey = user.publicKey;
      const verifier = crypto.createVerify('sha256');
      verifier.update(username);
      return verifier.verify(publicKey, Buffer.from(signature, 'base64'));
    });
}

// 通过群聊 ID 查询群聊成员
async function getGroupMembers(groupId) {
  try {
    const group = await Group.findById(groupId);
    if (!group) {
      throw new Error('Group not found');
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
      throw new Error('Group not found');
    }
    return group.publicKey === null;
  } catch (error) {
    console.error('Error checking group public key:', error.message);
    throw error;
  }
}

module.exports = function(server) {
  const io = socketIO(server);

  io.on('connection', (socket) => {
    let username = null;

    socket.on('auth', async (data) => {
      try {
        const { username: user, signature } = data;
        const isValid = await verifySignature(user, signature);
        if (!isValid) {
          socket.emit('error', { message: 'Invalid signature' });
          socket.disconnect();
          return;
        }

        username = user;
        connections.set(username, socket);
        socket.emit('auth', { status: 'success' });
        console.log(`${username} connected`);
      } catch (error) {
        console.error('Error during authentication:', error.message);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('message', async (data) => {
      try {
        const { chatType, recipient, content, deleteAt } = data;

        if (!username) {
          socket.emit('error', { message: 'Unauthorized user' });
          return;
        }

        if (!['private', 'group', 'key'].includes(chatType)) {
          socket.emit('error', { message: 'Invalid chat type' });
          return;
        }

        const newMessage = new Message({
          sender: username,
          recipient,
          content,
          type: chatType,
          deleteAt: deleteAt ? new Date(deleteAt) : null,
        });

        const savedMessage = await newMessage.save();

        if (chatType === 'private' || chatType === 'key') {
          const recipientSocket = connections.get(recipient);
          if (recipientSocket) {
            recipientSocket.emit('message', {
              chatType: 'private',
              sender: username,
              content,
              id: savedMessage._id,
            });
          }
        } else if (chatType === 'group') {
          if (await isGroupPublicKeyNull(recipient)) {
            throw new Error('Group public key is null');
          }
          const groupMembers = await getGroupMembers(recipient);
          groupMembers.forEach((member) => {
            const memberSocket = connections.get(member);
            if (memberSocket && member !== username) {
              memberSocket.emit('message', {
                chatType: 'group',
                sender: username,
                content,
                id: savedMessage._id,
              });
            }
          });
        }

        socket.emit('status', {
          chatType,
          message: 'Message sent successfully',
          id: savedMessage._id,
        });
      } catch (error) {
        console.error('Error handling message:', error.message);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User ${username} disconnected`);
      connections.delete(username);
    });
  });
}; 
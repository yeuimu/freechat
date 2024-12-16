const { createClient } = require("redis");
require("dotenv").config();

let client;

const startRedis = async () => {
  if (client) return;

  client = await createClient({
    socket: {
      port: process.env.REDIS_PORT,
      host: process.env.REDIS_HOST,
    },
  })
    .on("error", (err) => console.log(`Redis连接失败：${err}`))
    .on("connect", () => console.log("Redis连接成功"))
    .connect();
};

const setKey = async (key, value, ttl = null) => {
  if (!client) await startRedis();
  value = JSON.stringify(value);
  await client.set(key, value);

  if (ttl !== null) {
    await client.expire(key, ttl);
  }
};

const pushEletList = async (list, value) => {
  try {
    if (!client) await startRedis();
    value = JSON.stringify(value);
    await client.rpush(list, value);
  } catch (error) {
    console.error(error);
  }
};

const getList = async (list) => {
  try {
    if (!client) await startRedis();
    list = await client.lrange(list, 0, -1);
    return list ? JSON.parse(list) : null;
  } catch (error) {}
};

const getKey = async (key) => {
  if (!client) await startRedis();
  const value = await client.get(key);
  return value ? JSON.parse(value) : null;
};

const delKey = async (key) => {
  if (!client) await startRedis();
  await client.del(key);
};

module.exports = { startRedis, setKey, getKey, delKey, pushEletList, getList };

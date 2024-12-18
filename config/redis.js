const { createClient } = require("redis");

let redis;

const startRedis = async () => {
  if (redis) return;

  redis = await createClient({
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
  if (!redis) await startRedis();
  value = JSON.stringify(value);
  await redis.set(key, value);

  if (ttl !== null) {
    await redis.expire(key, ttl);
  }
};

const pushEletList = async (list, value) => {
  try {
    if (!redis) await startRedis();
    value = JSON.stringify(value);
    await redis.rPush(list, value);
  } catch (error) {
    console.error(error);
  }
};

const getList = async (list) => {
  console.log("getList1")
  try {
    if (!redis) await startRedis();
    console.log("getList2")
    list = await redis.lRange(list, 0, -1);
    console.log("getList3")
    return list ? list.map((e) => JSON.parse(e)) : null;
  } catch (error) {
    console.log(error)
  }
};

const getKey = async (key) => {
  if (!redis) await startRedis();
  const value = await redis.get(key);
  return value ? JSON.parse(value) : null;
};

const delKey = async (key) => {
  if (!redis) await startRedis();
  await redis.del(key);
};

const exitsKey = async (key) => {
  try {
    if (!redis) await startRedis();
    return Boolean(await redis.exists(key));
  } catch (error) {
    console.log(error)
  }
};

module.exports = { startRedis, setKey, getKey, delKey, pushEletList, getList, exitsKey };

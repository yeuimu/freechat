const express = require("express");
const router = express.Router();
module.exports = router.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  res.status(err.status || 500).json({
    success: false,
    message: "Internal Server Error",
  });
});
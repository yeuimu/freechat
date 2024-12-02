const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Message = require("../models/Message");
const { verifyUser, verifyNickname } = require("../middlewares/verifyUser");

/**
 * @api {post} /register User Registration
 * @apiDescription Register a new user with a unique nickname and public key.
 * @apiGroup User
 *
 * @apiParam {String} nickname The unique nickname of the user.
 * @apiParam {String} publicKey The public key of the user for encryption purposes.
 *
 * @apiSuccess {Boolean} success Indicates if the registration was successful.
 * @apiSuccess {String} message Success message.
 * @apiSuccess {Object} user The created user object.
 * @apiSuccess {String} user._id The unique ID of the user.
 * @apiSuccess {String} user.nickname The nickname of the user.
 * @apiSuccess {String} user.publicKey The public key of the user.
 * @apiSuccess {Date} user.lastActiveAt The last active timestamp of the user.
 *
 * @apiError {Boolean} success Indicates if the registration failed.
 * @apiError {String} message Error message describing the failure.
 *
 * @apiExample {json} Request-Example:
 *     {
 *       "nickname": "john_doe",
 *       "publicKey": "MIIBIjANBgkqhkiG..."
 *     }
 *
 * @apiExample {json} Success-Response:
 *     HTTP/1.1 201 Created
 *     {
 *       "success": true,
 *       "message": "User created successfully.",
 *       "user": {
 *         "_id": "64acb2f1c55bca6d5e4f1234",
 *         "nickname": "john_doe",
 *         "publicKey": "MIIBIjANBgkqhkiG...",
 *         "lastActiveAt": "2024-12-01T10:20:30.400Z"
 *       }
 *     }
 *
 * @apiExample {json} Error-Response:
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "success": false,
 *       "message": "Nickname already exists."
 *     }
 */
router.post("/register", verifyNickname, async (req, res, next) => {
  const { nickname, publicKey } = req.body;
  if (!nickname || !publicKey) {
    return res.status(400).json({
      success: false,
      message: "Nickname and publicKey are required.",
    });
  }

  try {
    const user = new User({ nickname, publicKey });
    await user.save();
    res.status(201).json({
      success: true,
      message: "User created successfully.",
      user,
    });
  } catch (error) {
    console.error("Error during user registration:", error);
    next(error);
  }
});

/**
 * @api {post} /refresh Refresh User Activity
 * @apiName RefreshUserActivity
 * @apiGroup User
 * @apiDescription This endpoint is used to update the last active time of a user.
 *
 * @apiParam {String} nickname The nickname of the user whose activity is to be refreshed.
 * @apiParam {String} signature The signature to be verified, encoded in base64 (required by verifyUser middleware).
 *
 * @apiSuccess {Boolean} success True if the user activity is successfully refreshed.
 * @apiSuccess {String} message A message indicating the result of the operation.
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "success": true,
 *       "message": "User activity refreshed"
 *     }
 *
 * @apiError {Boolean} success False if the user activity could not be refreshed or an error occurred.
 * @apiError {String} message A message indicating the error.
 * @apiErrorExample Error-Response (Missing Nickname):
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "success": false,
 *       "message": "Nickname are required."
 *     }
 * @apiErrorExample Error-Response (User Not Found):
 *     HTTP/1.1 404 Not Found
 *     {
 *       "success": false,
 *       "message": "User not found"
 *     }
 * @apiErrorExample Error-Response (Invalid Signature):
 *     HTTP/1.1 403 Forbidden
 *     {
 *       "success": false,
 *       "message": "Invalid signature"
 *     }
 * @apiErrorExample Error-Response (Internal Server Error):
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "success": false,
 *       "message": "Internal server error during refresh user activity"
 *     }
 */
router.post("/refresh", verifyUser, async (req, res, next) => {
  const { nickname } = req.body;
  if (!nickname) {
    return res.status(400).json({
      success: false,
      message: "Nickname are required.",
    });
  }

  try {
    const user = await User.findOneAndUpdate(
      { nickname },
      { lastActiveAt: new Date() },
      { new: true }
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, message: "User activity refreshed" });
  } catch (error) {
    console.error("Error during refresh user activity:", error);
    next(error);
  }
});

/**
 * @api {post} /search Search User
 * @apiName SearchUser
 * @apiGroup User
 * @apiDescription This endpoint is used to search for a user by nickname.
 *
 * @apiParam {String} nickname The nickname of the user performing the search (required by verifyUser middleware).
 * @apiParam {String} signature The signature to be verified, encoded in base64 (required by verifyUser middleware).
 * @apiParam {String} query The nickname query to search for in the database.
 *
 * @apiSuccess {Boolean} success True if the search was successful.
 * @apiSuccess {String} message A message indicating the result of the search.
 * @apiSuccess {Object[]} results An array containing the search results.
 * @apiSuccessExample Success-Response (User Found):
 *     HTTP/1.1 200 OK
 *     {
 *       "success": true,
 *       "message": "Exists",
 *       "results": [
 *         {
 *           "nickname": "desiredNickname",
 *           "publicKey": "publicKeyString"
 *         }
 *       ]
 *     }
 *
 * @apiError {Boolean} success False if the search failed or an error occurred.
 * @apiError {String} message A message indicating the error.
 * @apiErrorExample Error-Response (Missing Query):
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "success": false,
 *       "message": "Query parameter is required"
 *     }
 * @apiErrorExample Error-Response (User Not Found):
 *     HTTP/1.1 404 Not Found
 *     {
 *       "success": false,
 *       "message": "User not found",
 *       "results": []
 *     }
 * @apiErrorExample Error-Response (Invalid Signature):
 *     HTTP/1.1 403 Forbidden
 *     {
 *       "success": false,
 *       "message": "Invalid signature"
 *     }
 * @apiErrorExample Error-Response (Internal Server Error):
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "success": false,
 *       "message": "Error during search user"
 *     }
 */
router.post("/search", verifyUser, async (req, res, next) => {
  const { query } = req.body;
  if (!query || query.trim() === "") {
    return res
      .status(400)
      .json({ success: false, message: "Query parameter is required" });
  }

  try {
    const user = await User.findOne({ nickname: query.trim() });
    if (user) {
      return res.status(200).json({
        success: true,
        message: "Exists",
        results: [{ nickname: user.nickname, publicKey: user.publicKey }],
      });
    }
    return res
      .status(404)
      .json({ success: false, message: "User not found", results: [] });
  } catch (error) {
    console.error("Error during search user:", error);
    next(error);
  }
});

/**
 * @api {post} /delete Delete User
 * @apiName DeleteUser
 * @apiGroup User
 * @apiVersion 1.0.0
 * @apiDescription This endpoint is used to delete a user account and all associated messages.
 *
 * @apiParam {String} nickname The nickname of the user performing the deletion (required by verifyUser middleware).
 * @apiParam {String} signature The signature to be verified, encoded in base64 (required by verifyUser middleware).
 * @apiParam {String} publicKey The publicKey of the user to be deleted.
 *
 * @apiSuccess {Boolean} success True if the user and associated messages were deleted successfully.
 * @apiSuccess {String} message A message indicating the result of the deletion.
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "success": true,
 *       "message": "User and associated messages deleted successfully"
 *     }
 *
 * @apiError {Boolean} success False if the deletion failed or an error occurred.
 * @apiError {String} message A message indicating the error.
 * @apiErrorExample Error-Response (Missing Parameters):
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "success": false,
 *       "message": "Nickname and publicKey are required."
 *     }
 * @apiErrorExample Error-Response (User Not Found):
 *     HTTP/1.1 404 Not Found
 *     {
 *       "success": false,
 *       "message": "User not found"
 *     }
 * @apiErrorExample Error-Response (Invalid Signature):
 *     HTTP/1.1 403 Forbidden
 *     {
 *       "success": false,
 *       "message": "Invalid signature"
 *     }
 * @apiErrorExample Error-Response (Internal Server Error):
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "success": false,
 *       "message": "Error during delete user"
 *     }
 */
router.post("/delete", verifyUser, async (req, res, next) => {
  const { nickname, publicKey } = req.body;
  if (!nickname || !publicKey) {
    return res.status(400).json({
      success: false,
      message: "Nickname and publicKey are required.",
    });
  }

  try {
    const user = await User.findOneAndDelete({ nickname, publicKey });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    // 删除用户发送的所有消息
    await Message.deleteMany({ sender: nickname });
    res.status(200).json({
      success: true,
      message: "User and associated messages deleted successfully",
    });
  } catch (error) {
    console.error("Error during delete user:", error);
    next(error);
  }
});

/**
 * @api {post} /publickey Get User Public Key
 * @apiName GetUserPublicKey
 * @apiGroup User
 * @apiDescription This endpoint is used to retrieve the public key of a user by their nickname.
 *
 * @apiParam {String} nickname The nickname of the user whose public key is to be retrieved (required by verifyUser middleware).
 * @apiParam {String} signature The signature to be verified, encoded in base64 (required by verifyUser middleware).
 *
 * @apiSuccess {Boolean} success True if the public key was successfully retrieved.
 * @apiSuccess {String} message A message indicating the result of the operation.
 * @apiSuccess {String} publicKey The public key of the user.
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "success": true,
 *       "message": "Public key retrieved successfully",
 *       "publicKey": "MIIBIjANBgkqhkiG..."
 *     }
 *
 * @apiError {Boolean} success False if the public key could not be retrieved or an error occurred.
 * @apiError {String} message A message indicating the error.
 * @apiErrorExample Error-Response (User Not Found):
 *     HTTP/1.1 404 Not Found
 *     {
 *       "success": false,
 *       "message": "User not found"
 *     }
 * @apiErrorExample Error-Response (Invalid Signature):
 *     HTTP/1.1 403 Forbidden
 *     {
 *       "success": false,
 *       "message": "Invalid signature"
 *     }
 * @apiErrorExample Error-Response (Internal Server Error):
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "success": false,
 *       "message": "Error during retrieving public key"
 *     }
 */
router.post("/publickey", verifyUser, async (req, res, next) => {
  const { targetNickname } = req.body;
  if (!targetNickname) {
    return res.status(400).json({
      success: false,
      message: "Nickname is required.",
    });
  }

  try {
    const user = await User.findOne({ nickname: targetNickname });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.status(200).json({
      success: true,
      message: "Public key retrieved successfully",
      publicKey: user.publicKey,
    });
  } catch (error) {
    console.error("Error during retrieving public key:", error);
    next(error);
  }
});

module.exports = router;

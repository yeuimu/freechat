const crypto = require("crypto");
const User = require("../models/User");

/**
 * @api {post} /verify-user Verify User Signature
 * @apiName VerifyUser
 * @apiGroup User
 * @apiDescription This endpoint is used to verify the signature of a user based on their nickname and provided signature.
 *
 * @apiParam {String} nickname The nickname of the user.
 * @apiParam {String} signature The signature to be verified, encoded in base64.
 *
 * @apiSuccess {Boolean} success True if the signature is valid.
 * @apiSuccess {String} message A message indicating the result of the signature verification.
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "success": true
 *     }
 *
 * @apiError {Boolean} success False if the signature is invalid or an error occurred.
 * @apiError {String} message A message indicating the error.
 * @apiErrorExample Error-Response (Missing Parameters):
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "success": false,
 *       "message": "Nickname and signature are required"
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
 *       "message": "Internal server error during signature verification"
 *     }
 */
module.exports.verifyUser =  async (req, res, next) => {
  const { nickname, signature } = req.body;

  if (!nickname || !signature) {
    return res
      .status(400)
      .json({ success: false, message: "Nickname and signature are required" });
  }

  try {
    const user = await User.findOne({ nickname });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const publicKey = user.publicKey;
    const verifier = crypto.createVerify("sha256");
    verifier.update(nickname);
    verifier.end();

    const isVerified = verifier.verify(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: 32,
      },
      Buffer.from(signature, "base64")
    );

    if (!isVerified) {
      return res
        .status(403)
        .json({ success: false, message: "Invalid signature" });
    }

    next();
  } catch (error) {
    console.error("Error during signature verification:", error);
    next(error);
  }
}

/**
 * @api {post} /verify-nickname Verify Nickname
 * @apiName VerifyNickname
 * @apiGroup User
 * @apiDescription This endpoint is used to verify the uniqueness of a user's nickname.
 *
 * @apiParam {String} nickname The nickname to be verified.
 *
 * @apiSuccess {Boolean} success True if the nickname is available.
 * @apiSuccess {String} message A message indicating the result of the verification.
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "success": true,
 *       "message": "Nickname is available"
 *     }
 *
 * @apiError {Boolean} success False if the nickname is not available or an error occurred.
 * @apiError {String} message A message indicating the error.
 * @apiErrorExample Error-Response (Nickname Required):
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "success": false,
 *       "message": "Nickname is required and cannot be empty"
 *     }
 * @apiErrorExample Error-Response (Nickname Exists):
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "success": false,
 *       "message": "Nickname already exists"
 *     }
 * @apiErrorExample Error-Response (Internal Server Error):
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "success": false,
 *       "message": "Internal Server Error during nickname validation"
 *     }
 */
module.exports.verifyNickname =  async (req, res, next) => {
  const { nickname } = req.body;
  if (!nickname || nickname.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Nickname is required and cannot be empty",
    });
  }
  try {
    const exists = await User.exists({ nickname });
    if (exists) {
      return res
        .status(400)
        .json({ success: false, message: "Nickname already exists" });
    } else {
      res.status(200).json({ success: true, message: "Nickname is available" });
    }
    next();
  } catch (error) {
    console.error("Error during nickname verification:", error);
    next(error);
  }
}

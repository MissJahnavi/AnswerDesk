import express from "express";
import rateLimit from "express-rate-limit";
import {
  register,
  verifyEmail,
  login,
  logout, forgotPassword, resetPassword, getCurrentUser
} from "../controllers/authController.js";

import authenticate from "../middleware/authMiddleware.js";

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      "Too many login attempts. Please try again after 15 minutes.",
  },
});

router.post("/register", register);
router.get("/verify-email", verifyEmail);
router.post("/login", loginLimiter, login);
router.post("/logout", logout);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.get("/me", authenticate, getCurrentUser);

export default router;

import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import pool from "../src/db.js";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 24 * 60 * 60 * 1000,
  path: "/",
};

const createToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "24h" },
  );

const getPublicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  reputation: user.reputation,
  created_at: user.created_at,
});

const createVerificationTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 30000,
  });
};

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res.status(400).json({
        message:
          "Name, valid email, and a password of at least 8 characters are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail],
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const hashedPassword = await bcryptjs.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (
        name,
        email,
        password_hash,
        role,
        email_verified,
        email_verification_token_hash,
        email_verification_expires_at
      )
      VALUES ($1, $2, $3, 'member', FALSE, $4, $5)
      RETURNING id, name, email, role, reputation, created_at`,
      [name.trim(), normalizedEmail, hashedPassword, tokenHash, expiresAt],
    );

    const user = result.rows[0];

    const apiBaseUrl = (
      process.env.API_BASE_URL || "http://localhost:3000"
    ).replace(/\/$/, "");

    const verifyUrl =
      `${apiBaseUrl}/api/auth/verify-email` +
      `?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`;

    try {
      const transporter = createVerificationTransporter();

      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: normalizedEmail,
        subject: "Verify your AnswerDesk email",
        text:
          `Hello ${user.name},\n\n` +
          `Verify your email using this link (valid for 30 minutes):\n` +
          `${verifyUrl}\n\n` +
          "If you did not create this account, you can ignore this email.",
      });
    } catch (emailError) {
      console.error("Verification email error:", emailError);

      return res.status(503).json({
        message:
          "Your account was created, but the verification email could not be sent. Check SMTP configuration before retrying.",
      });
    }

    return res.status(201).json({
      message:
        "Registration successful. Check your email to verify your account within 30 minutes.",
      user,
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }

    return res.status(500).json({
      message: "Failed to register",
    });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token, email } = req.query;

    if (
      typeof token !== "string" ||
      typeof email !== "string" ||
      !token ||
      !email.trim()
    ) {
      return res.status(400).json({
        message: "A verification token and email are required",
      });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const result = await pool.query(
      `UPDATE users
       SET email_verified = TRUE,
           email_verification_token_hash = NULL,
           email_verification_expires_at = NULL
       WHERE email = $1
         AND email_verification_token_hash = $2
         AND email_verification_expires_at > NOW()
         AND email_verified = FALSE
       RETURNING id`,
      [email.trim().toLowerCase(), tokenHash],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        message: "Invalid, expired, or already-used verification link",
      });
    }

    return res.status(200).json({
      message: "Email verified successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Email verification error:", error);

    return res.status(500).json({
      message: "Failed to verify email",
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const result = await pool.query(
      `SELECT id, name, email, password_hash, role,
              reputation, created_at, email_verified
       FROM users
       WHERE email = $1`,
      [email.trim().toLowerCase()],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const user = result.rows[0];
    const isMatch = await bcryptjs.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (!user.email_verified) {
      return res.status(403).json({
        message: "Please verify your email before logging in",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    const token = createToken(user);

    res.cookie("token", token, cookieOptions);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: getPublicUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Failed to log in",
    });
  }
};

const logout = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return res.status(200).json({
    message: "Logged out successfully",
  });
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      "SELECT id, email FROM users WHERE email = $1",
      [normalizedEmail],
    );

    const message =
      "If an account exists for this email, a password reset link will be sent.";

    if (result.rows.length === 0) {
      return res.status(200).json({ message });
    }

    const user = result.rows[0];

    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    await pool.query(
      `UPDATE users
       SET password_reset_token_hash = $1,
           password_reset_expires_at = NOW() + INTERVAL '15 minutes'
       WHERE id = $2`,
      [tokenHash, user.id],
    );

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const resetLink =
      `${process.env.FRONTEND_URL || "http://localhost:5173"}` +
      `/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: user.email,
        subject: "Reset your AnswerDesk password",
        text: `You requested a password reset.

Open this link to choose a new password:
${resetLink}

This link expires in 15 minutes. If you did not request this, ignore this email.`,
      });
    } catch (emailError) {
      await pool.query(
        `UPDATE users
         SET password_reset_token_hash = NULL,
             password_reset_expires_at = NULL
         WHERE id = $1`,
        [user.id],
      );
      throw emailError;
    } finally {
      transporter.close();
    }

    return res.status(200).json({ message });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      message: "Unable to process the password reset request",
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    if (
      typeof email !== "string" ||
      typeof token !== "string" ||
      typeof newPassword !== "string" ||
      !email.trim() ||
      !token ||
      newPassword.length < 8
    ) {
      return res.status(400).json({
        message:
          "Email, reset token, and a new password of at least 8 characters are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const newPasswordHash = await bcryptjs.hash(newPassword, 10);

    const result = await pool.query(
      `UPDATE users
       SET password_hash = $1,
           password_reset_token_hash = NULL,
           password_reset_expires_at = NULL
       WHERE email = $2
         AND password_reset_token_hash = $3
         AND password_reset_expires_at > NOW()
       RETURNING id`,
      [newPasswordHash, normalizedEmail, tokenHash],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        message: "Invalid or expired password reset link",
      });
    }

    return res.status(200).json({
      message: "Password reset successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      message: "Unable to reset password",
    });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, reputation, created_at
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      user: getPublicUser(result.rows[0]),
    });
  } catch (error) {
    console.error("Get current user error:", error);
    return res.status(500).json({
      message: "Failed to fetch current user",
    });
  }
};

export { register, verifyEmail, login, logout, forgotPassword, resetPassword, getCurrentUser };

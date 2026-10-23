import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server } from "socket.io";
import { setIO } from "./socket.js";
import jwt from "jsonwebtoken";
import pool from "./db.js";


import questionRoutes from "../routes/questionRoutes.js";
import authRoutes from "../routes/authRoutes.js";
import voteRoutes from "../routes/voteRoutes.js";
import ticketRoutes from "../routes/ticketRoutes.js";
import userRoutes from "../routes/userRoutes.js";

const app = express();
const PORT = process.env.PORT || 3000;
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

setIO(io);

io.use((socket, next) => {
    try {
        const cookieHeader = socket.handshake.headers.cookie;

        if (!cookieHeader) {
            return next(
                new Error("Authentication cookie missing")
            );
        }

        const cookies = Object.fromEntries(
            cookieHeader
                .split(";")
                .map((cookie) => {
                    const [name, ...valueParts] =
                        cookie.trim().split("=");

                    return [
                        name,
                        decodeURIComponent(valueParts.join("="))
                    ];
                })
        );

        const token = cookies.token;

        if (!token) {
            return next(
                new Error("Authentication token missing")
            );
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        socket.user = decoded;

        next();

    } catch (error) {
        console.error(
            "Socket authentication failed:",
            error.message
        );

        next(
            new Error("Invalid authentication token")
        );
    }
});

app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/questions", questionRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/votes", voteRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/users", userRoutes);

io.on("connection", (socket) => {
  console.log(
    `Socket connected: ${socket.id} | User: ${socket.user.id} | Role: ${socket.user.role}`
  );

  socket.on("join-ticket", async (ticketId) => {
    try {
      const userId = socket.user.id;
      const userRole = socket.user.role;

      const ticketResult = await pool.query(
        `SELECT
            id,
            requester_id,
            assignee_id
         FROM tickets
         WHERE id = $1`,
        [ticketId]
      );

      if (ticketResult.rows.length === 0) {
        socket.emit("socket-error", {
          message: "Ticket not found"
        });

        return;
      }

      const ticket = ticketResult.rows[0];

      const isRequester =
        String(ticket.requester_id) === String(userId);

      const isAssignee =
        ticket.assignee_id !== null &&
        String(ticket.assignee_id) === String(userId);

      const isAdmin = userRole === "admin";

      if (!isRequester && !isAssignee && !isAdmin) {
        socket.emit("socket-error", {
          message: "You are not allowed to access this ticket"
        });

        return;
      }

      const room = `ticket:${ticketId}`;

      socket.join(room);

      console.log(
        `User ${userId} joined ${room}`
      );

    } catch (error) {
      console.error(
        "Failed to join ticket room:",
        error
      );

      socket.emit("socket-error", {
        message: "Failed to join ticket room"
      });
    }
  });

  socket.on("leave-ticket", (ticketId) => {
    const room = `ticket:${ticketId}`;

    socket.leave(room);

    console.log(
      `User ${socket.user.id} left ${room}`
    );
  });

  socket.on("disconnect", () => {
    console.log(
      `Socket disconnected: ${socket.id}`
    );
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

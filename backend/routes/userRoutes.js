import express from "express";

import { getAgents } from "../controllers/userController.js";

import authenticate from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/agents", authenticate,authorizeRoles("agent", "admin"),
    getAgents
);

export default router;
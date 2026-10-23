import express from "express";
import { createTicket, getMyTickets, getTicketById , updateTicketStatus, assignTicket , getAssignedTickets, getAssignedTicketById, getAssignedTicketSummary , getUnassignedTickets, getTicketMessages, sendTicketMessage} from "../controllers/ticketController.js";
import authenticate from '../middleware/authMiddleware.js';
import authorizeRoles from "../middleware/roleMiddleware.js";

const router = express.Router();

router.post("/", authenticate, createTicket);

router.get("/", authenticate, getMyTickets);

router.get("/assigned", authenticate,authorizeRoles("agent", "admin"), getAssignedTickets);

router.get("/assigned/summary", authenticate, authorizeRoles("agent", "admin"), getAssignedTicketSummary);

router.get("/unassigned", authenticate,authorizeRoles("agent", "admin"), getUnassignedTickets);

router.get("/assigned/:id", authenticate, authorizeRoles("agent", "admin"), getAssignedTicketById);

router.get("/:id/messages", authenticate, getTicketMessages);

router.post("/:id/messages",authenticate, sendTicketMessage);

router.get("/:id", authenticate, getTicketById);

router.patch("/:id/status",authenticate,authorizeRoles("agent", "admin"),updateTicketStatus);

router.patch("/:id/assign",authenticate,authorizeRoles("agent", "admin"),assignTicket);



export default router;
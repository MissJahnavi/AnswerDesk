import express from "express";
import authenticate from "../middleware/authMiddleware.js";
import {
  voteQuestion,
  voteAnswer,
  getQuestionVoteSummary,
  getAnswerVoteSummary,
} from "../controllers/voteController.js";
const router = express.Router();

router.get("/questions/:id", authenticate, getQuestionVoteSummary);
router.post("/questions/:id", authenticate, voteQuestion);

router.get("/answers/:id", authenticate, getAnswerVoteSummary);
router.post("/answers/:id", authenticate, voteAnswer);

export default router;
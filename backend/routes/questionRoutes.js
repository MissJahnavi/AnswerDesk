import express from 'express';
import authenticate from '../middleware/authMiddleware.js';

import {createQuestion, getQuestions,getQuestionById,createAnswer, getAnswers,createComment,getComments, escalateQuestion, acceptAnswer} from '../controllers/questionController.js';

const router = express.Router();

router.post('/', authenticate, createQuestion);
router.get('/', getQuestions);
router.post('/:id/escalate',authenticate,escalateQuestion);
router.get('/:id', getQuestionById);

router.patch('/:id/answers/:answerId/accept', authenticate, acceptAnswer);

router.post('/:id/answers', authenticate, createAnswer);
router.get('/:id/answers', getAnswers);

router.post('/:id/comments', authenticate, createComment);
router.get('/:id/comments', getComments);

export default router;
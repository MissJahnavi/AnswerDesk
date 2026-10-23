import pool from "../src/db.js";
import redisClient from "../src/redis.js";
import { sendEmail } from "../src/emailService.js";

const createQuestion = async (req, res) => {
  try {
    const { title, body } = req.body;
    const user_id = req.user.id;

    const result = await pool.query(
      "INSERT INTO questions (user_id, title, body) VALUES ($1, $2, $3) RETURNING *",
      [user_id, title, body],
    );

    try {
      await redisClient.del("questions:list");
    } catch (cacheError) {
      console.error(
        "Failed to invalidate questions cache:",
        cacheError.message,
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to create question",
    });
  }
};

const getQuestions = async (req, res) => {
  const cacheKey = "questions:list";

  try {
    const cachedQuestions = await redisClient.get(cacheKey);

    if (cachedQuestions) {
      console.log("Questions cache: HIT");
      return res.status(200).json(JSON.parse(cachedQuestions));
    }
    console.log("Questions cache: MISS");

    const result = await pool.query(
      `SELECT id, user_id, title, body, created_at, updated_at
             FROM questions
             ORDER BY created_at DESC`,
    );

    await redisClient.set(cacheKey, JSON.stringify(result.rows), { EX: 60 });

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Failed to fetch questions:", error);

    try {
      const result = await pool.query(
        `SELECT id, user_id, title, body, created_at, updated_at
                 FROM questions
                 ORDER BY created_at DESC`,
      );

      return res.status(200).json(result.rows);
    } catch (dbError) {
      console.error("PostgreSQL error:", dbError);

      return res.status(500).json({
        message: "Failed to fetch questions",
      });
    }
  }
};

const getQuestionById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, user_id, title, body, created_at, updated_at, accepted_answer_id
             FROM questions
             WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Question not found",
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch question",
    });
  }
};

const createAnswer = async (req, res) => {
  try {
    const { id } = req.params;
    const { body } = req.body;
    const user_id = req.user.id;

    const result = await pool.query(
      `INSERT INTO answers (question_id, user_id, body)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, user_id, body],
    );

    const answer = result.rows[0];

    try {
      const questionResult = await pool.query(
        `SELECT q.title, q.user_id, u.email
         FROM questions q
         JOIN users u ON u.id = q.user_id
         WHERE q.id = $1`,
        [id],
      );

      const question = questionResult.rows[0];

      if (question?.email && Number(question.user_id) !== Number(user_id)) {
        await sendEmail({
          to: question.email,
          subject: "New answer to your AnswerDesk question",
          text: `Hello,

Someone has answered your question: "${question.title}".

Log in to AnswerDesk to view the answer and join the discussion.

Regards,
AnswerDesk Team`,
        });

        console.log("Answer notification email sent.");
      }
    } catch (emailError) {
      // Email failure must not affect the saved answer
      console.error("Failed to send answer notification:", emailError.message);
    }

    return res.status(201).json(answer);
  } catch (error) {
    console.error("Failed to create answer:", error);

    return res.status(500).json({
      message: "Failed to create answer",
    });
  }
};

const getAnswers = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, question_id, user_id, body, created_at, updated_at
             FROM answers
             WHERE question_id = $1
             ORDER BY created_at ASC`,
      [id],
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch answers",
    });
  }
};

const createComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { body, answer_id } = req.body;
    const user_id = req.user.id;

    const result = await pool.query(
      `INSERT INTO comments (user_id, question_id, answer_id, body)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
      [user_id, answer_id ? null : id, answer_id || null, body],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to create comment",
    });
  }
};

const getComments = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, user_id, question_id, answer_id, body, created_at
             FROM comments
             WHERE question_id = $1
                OR answer_id = $1
             ORDER BY created_at ASC`,
      [id],
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch comments",
    });
  }
};

const escalateQuestion = async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const { id } = req.params;
    const user_id = req.user.id;

    await client.query("BEGIN");
    transactionStarted = true;

    const questionResult = await client.query(
      `SELECT id, user_id, title, body
             FROM questions
             WHERE id = $1
               AND user_id = $2`,
      [id, user_id],
    );

    if (questionResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        message: "Question not found or you are not the owner",
      });
    }
    const question = questionResult.rows[0];

    const existingTicketResult = await client.query(
      `SELECT id, status
             FROM tickets
             WHERE question_id = $1
             LIMIT 1`,
      [id],
    );

    if (existingTicketResult.rows.length > 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(409).json({
        message: "This question has already been escalated",
        ticket_id: existingTicketResult.rows[0].id,
        status: existingTicketResult.rows[0].status,
      });
    }

    const slaResult = await client.query(
      `SELECT id, response_time_minutes, resolution_time_minutes
             FROM sla_policies
             WHERE priority = 'medium'
             LIMIT 1`,
    );

    if (slaResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(500).json({
        message: "Medium priority SLA policy not found",
      });
    }

    const sla = slaResult.rows[0];

    const now = new Date();

    const firstResponseDueAt = new Date(
      now.getTime() + Number(sla.response_time_minutes) * 60 * 1000,
    );

    const resolutionDueAt = new Date(
      now.getTime() + Number(sla.resolution_time_minutes) * 60 * 1000,
    );

    const ticketResult = await client.query(
      `INSERT INTO tickets
             (
                requester_id,
                question_id,
                sla_policy_id,
                subject,
                description,
                priority,
                status,
                first_response_due_at,
                resolution_due_at
             )
             VALUES
             ($1, $2, $3, $4, $5, 'medium', 'open', $6, $7)
             RETURNING *`,
      [
        user_id,
        question.id,
        sla.id,
        question.title,
        question.body,
        firstResponseDueAt,
        resolutionDueAt,
      ],
    );

    const ticket = ticketResult.rows[0];

    await client.query(
      `INSERT INTO ticket_events
             (
                ticket_id,
                actor_id,
                event_type,
                metadata
             )
             VALUES ($1, $2, $3, $4)`,
      [
        ticket.id,
        user_id,
        "escalated_from_question",
        JSON.stringify({
          question_id: question.id,
        }),
      ],
    );

    await client.query("COMMIT");
    transactionStarted = false;

    res.status(201).json({
      message: "Question escalated successfully",
      ticket,
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Escalation rollback failed:", rollbackError);
      }
    }

    console.error("Failed to escalate question:", error);

    return res.status(500).json({
      message: "Failed to escalate question",
    });
  } finally {
    client.release();
  }
};


const acceptAnswer = async (req, res) => {
  const { id: questionId, answerId } = req.params;
  const userId = req.user.id;

  try {
    // 1. Get the question and its author
    const questionResult = await pool.query(
      `SELECT q.id, q.user_id, q.title, q.accepted_answer_id
       FROM questions q
       WHERE q.id = $1`,
      [questionId],
    );

    if (questionResult.rows.length === 0) {
      return res.status(404).json({
        message: "Question not found",
      });
    }

    const question = questionResult.rows[0];

    // 2. Only the question author can accept an answer
    if (String(question.user_id) !== String(userId)) {
      return res.status(403).json({
        message: "Only the question author can accept an answer",
      });
    }

    // 3. Get the answer and its author's email
    const answerResult = await pool.query(
      `SELECT a.id, a.user_id, u.email
       FROM answers a
       JOIN users u ON u.id = a.user_id
       WHERE a.id = $1 AND a.question_id = $2`,
      [answerId, questionId],
    );

    if (answerResult.rows.length === 0) {
      return res.status(404).json({
        message: "Answer not found for this question",
      });
    }

    const answer = answerResult.rows[0];

    // 4. Save the accepted answer first
    await pool.query(
      `UPDATE questions
       SET accepted_answer_id = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [answerId, questionId],
    );

    // 5. Notify the answer author, without breaking acceptance
    // when email delivery fails.
    if (answer.email && String(answer.user_id) !== String(userId)) {
      try {
        await sendEmail({
          to: answer.email,
          subject: "Your answer was accepted on AnswerDesk",
          text: `Congratulations!

Your answer to the question "${question.title}" has been accepted by the question author.

Log in to AnswerDesk to view the discussion.

Regards,
AnswerDesk Team`,
        });

        console.log("Accepted-answer notification email sent.");
      } catch (emailError) {
        console.error(
          "Failed to send accepted-answer notification:",
          emailError.message,
        );
      }
    }

    return res.status(200).json({
      message: "Answer accepted successfully",
      question_id: questionId,
      accepted_answer_id: answerId,
    });
  } catch (error) {
    console.error("Accept answer error:", error);

    return res.status(500).json({
      message: "Failed to accept answer",
    });
  }
};


export {
  createQuestion,
  getQuestions,
  getQuestionById,
  createAnswer,
  getAnswers,
  createComment,
  getComments,
  escalateQuestion,
  acceptAnswer,
};

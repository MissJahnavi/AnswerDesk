import pool from "../src/db.js";

const submitVote = async (req, res, targetType) => {
  const { id } = req.params;
  const { vote_type } = req.body;
  const user_id = req.user.id;

  if (vote_type !== "upvote" && vote_type !== "downvote") {
    return res.status(400).json({ message: "Invalid vote type" });
  }

  const isQuestion = targetType === "question";
  const table = isQuestion ? "questions" : "answers";
  const targetColumn = isQuestion ? "question_id" : "answer_id";
  const targetLabel = isQuestion ? "question" : "answer";

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // Find the target and its author.
    const targetResult = await client.query(
      `SELECT id, user_id FROM ${table} WHERE id = $1`,
      [id]
    );

    if (targetResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        message: `${targetLabel.charAt(0).toUpperCase() + targetLabel.slice(1)} not found`,
      });
    }

    const authorId = targetResult.rows[0].user_id;

    if (String(authorId) === String(user_id)) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(400).json({
        message: `You cannot vote on your own ${targetLabel}`,
      });
    }

    // Check for an existing vote before inserting.
    const existingVote = await client.query(
      `SELECT id FROM votes
       WHERE user_id = $1 AND ${targetColumn} = $2`,
      [user_id, id]
    );

    if (existingVote.rows.length > 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(409).json({
        message: `You have already voted on this ${targetLabel}`,
      });
    }

    // The database's unique index remains the final duplicate-vote safeguard.
    const voteResult = await client.query(
      `INSERT INTO votes (user_id, ${targetColumn}, vote_type)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [user_id, id, vote_type]
    );

    // Apply reputation to the author of the voted item.
    const reputationChange = vote_type === "upvote" ? 5 : -2;

    const reputationResult = await client.query(
      `UPDATE users
       SET reputation = reputation + $1
       WHERE id = $2
       RETURNING reputation`,
      [reputationChange, authorId]
    );

    if (reputationResult.rows.length === 0) {
      throw new Error("Target author's user record was not found");
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(201).json({
      message: "Vote recorded successfully",
      vote: voteResult.rows[0],
      reputation_change: reputationChange,
      author_reputation: reputationResult.rows[0].reputation,
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Vote rollback failed:", rollbackError);
      }
    }

    if (error.code === "23505") {
      return res.status(409).json({
        message: `You have already voted on this ${targetLabel}`,
      });
    }

    console.error(`Failed to vote on ${targetLabel}:`, error);

    return res.status(500).json({
      message: `Failed to vote on ${targetLabel}`,
    });
  } finally {
    client.release();
  }
};

const getVoteSummary = async (req, res, targetType) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const isQuestion = targetType === "question";
    const table = isQuestion ? "questions" : "answers";
    const targetColumn = isQuestion ? "question_id" : "answer_id";
    const label = isQuestion ? "question" : "answer";

    const target = await pool.query(
      `SELECT id FROM ${table} WHERE id = $1`,
      [id]
    );

    if (target.rows.length === 0) {
      return res.status(404).json({
        message: `${label} not found`,
      });
    }

    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE vote_type = 'upvote')::int AS upvotes,
         COUNT(*) FILTER (WHERE vote_type = 'downvote')::int AS downvotes,
         COALESCE(
           SUM(
             CASE
               WHEN vote_type = 'upvote' THEN 1
               WHEN vote_type = 'downvote' THEN -1
               ELSE 0
             END
           ), 0
         )::int AS score,
         MAX(vote_type) FILTER (WHERE user_id = $1) AS user_vote
       FROM votes
       WHERE ${targetColumn} = $2`,
      [user_id, id]
    );

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Failed to fetch vote summary:", error);

    return res.status(500).json({
      message: "Failed to fetch vote summary",
    });
  }
};

const getQuestionVoteSummary = (req, res) =>
  getVoteSummary(req, res, "question");

const getAnswerVoteSummary = (req, res) =>
  getVoteSummary(req, res, "answer");
const voteQuestion = (req, res) => submitVote(req, res, "question");

const voteAnswer = (req, res) => submitVote(req, res, "answer");

export { voteQuestion, voteAnswer, getQuestionVoteSummary, getAnswerVoteSummary };
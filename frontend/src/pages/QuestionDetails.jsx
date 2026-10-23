import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "./QuestionDetails.css";

import {
  getQuestionById,
  getAnswers,
  createAnswer,
  getComments,
  createComment,
  escalateQuestion,
  castVote,
  getVoteSummary,
  acceptAnswer,
} from "../services/questionService";

import { getCurrentUser } from "../services/authService";

const emptyVoteSummary = {
  upvotes: 0,
  downvotes: 0,
  score: 0,
  user_vote: null,
};

function VoteControls({ targetType, targetId, summary, onVote, busy }) {
  return (
    <div className="qd-vote-controls" aria-label={`${targetType} voting`}>
      <button
        type="button"
        className={`qd-vote-button ${summary.user_vote === "upvote" ? "is-selected" : ""}`}
        onClick={() => onVote(targetType, targetId, "upvote")}
        disabled={busy || Boolean(summary.user_vote)}
        aria-label="Upvote"
        title={summary.user_vote ? "You have already voted" : "Upvote"}
      >
        <span aria-hidden="true">▲</span>
        <span>{summary.upvotes ?? 0}</span>
      </button>

      <span className="qd-vote-score" title="Net score">
        Score: {summary.score ?? 0}
      </span>

      <button
        type="button"
        className={`qd-vote-button ${summary.user_vote === "downvote" ? "is-selected" : ""}`}
        onClick={() => onVote(targetType, targetId, "downvote")}
        disabled={busy || Boolean(summary.user_vote)}
        aria-label="Downvote"
        title={summary.user_vote ? "You have already voted" : "Downvote"}
      >
        <span aria-hidden="true">▼</span>
        <span>{summary.downvotes ?? 0}</span>
      </button>
    </div>
  );
}

function QuestionDetails() {
  const { id } = useParams();

  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [comments, setComments] = useState([]);
  const [questionVote, setQuestionVote] = useState(emptyVoteSummary);
  const [answerVotes, setAnswerVotes] = useState({});
  const [votingKey, setVotingKey] = useState("");
  const [voteMessage, setVoteMessage] = useState("");

  const [answerBody, setAnswerBody] = useState("");
  const [commentBody, setCommentBody] = useState("");

  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentMessage, setCommentMessage] = useState("");

  const [escalating, setEscalating] = useState(false);
  const [escalationMessage, setEscalationMessage] = useState("");
  const [ticketId, setTicketId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [answerMessage, setAnswerMessage] = useState("");

  const [acceptingAnswerId, setAcceptingAnswerId] = useState(null);
  const [acceptMessage, setAcceptMessage] = useState("");

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    let active = true;

    const loadQuestion = async () => {
      try {
        setLoading(true);
        setError("");

        const [
          questionData,
          answersData,
          commentsData,
          questionSummary,
          userData,
        ] = await Promise.all([
          getQuestionById(id),
          getAnswers(id),
          getComments(id),
          getVoteSummary("questions", id),
          getCurrentUser().catch(() => null),
        ]);

        const voteEntries = await Promise.all(
          answersData.map(async (answer) => {
            const summary = await getVoteSummary("answers", answer.id);
            return [answer.id, summary];
          }),
        );

        if (!active) return;

        setQuestion(questionData);
        setAnswers(answersData);
        setComments(commentsData);
        setQuestionVote(questionSummary);
        setAnswerVotes(Object.fromEntries(voteEntries));
        setCurrentUser(userData);
      } catch (err) {
        if (active) setError(err.message || "Failed to load question.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadQuestion();

    return () => {
      active = false;
    };
  }, [id]);

  const handleVote = async (targetType, targetId, voteType) => {
    const key = `${targetType}-${targetId}`;

    try {
      setVotingKey(key);
      setVoteMessage("");

      await castVote(targetType, targetId, voteType);

      const summary = await getVoteSummary(targetType, targetId);

      if (targetType === "questions") {
        setQuestionVote(summary);
      } else {
        setAnswerVotes((current) => ({
          ...current,
          [targetId]: summary,
        }));
      }

      setVoteMessage("Your vote was recorded successfully.");
    } catch (err) {
      setVoteMessage(err.message || "Unable to submit vote.");
    } finally {
      setVotingKey("");
    }
  };

  const handleSubmitAnswer = async (event) => {
    event.preventDefault();

    if (!answerBody.trim()) return;

    try {
      setSubmittingAnswer(true);
      setAnswerMessage("");
      setError("");

      const newAnswer = await createAnswer(id, answerBody);
      const summary = await getVoteSummary("answers", newAnswer.id);

      setAnswers((current) => [...current, newAnswer]);
      setAnswerVotes((current) => ({
        ...current,
        [newAnswer.id]: summary,
      }));

      setAnswerBody("");
      setAnswerMessage("Answer posted successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const handleSubmitComment = async (event) => {
    event.preventDefault();

    if (!commentBody.trim()) return;

    try {
      setSubmittingComment(true);
      setCommentMessage("");
      setError("");

      const newComment = await createComment(id, commentBody);
      setComments((current) => [...current, newComment]);
      setCommentBody("");
      setCommentMessage("Comment posted successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleEscalate = async () => {
    try {
      setEscalating(true);
      setEscalationMessage("");
      setError("");

      const data = await escalateQuestion(id);
      setTicketId(data.ticket.id);
      setEscalationMessage("Question escalated successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setEscalating(false);
    }
  };

  const handleAcceptAnswer = async (answerId) => {
    try {
      setAcceptingAnswerId(answerId);
      setAcceptMessage("");
      setError("");

      await acceptAnswer(id, answerId);

      setQuestion((current) => ({
        ...current,
        accepted_answer_id: answerId,
      }));

      setAcceptMessage("Answer accepted successfully.");
    } catch (err) {
      setError(err.message || "Failed to accept answer.");
    } finally {
      setAcceptingAnswerId(null);
    }
  };

  if (loading) {
    return (
      <div className="question-details">
        <div className="qd-state">
          <span className="qd-spinner" />
          <p>Loading question...</p>
        </div>
      </div>
    );
  }

  if (error && !question) {
    return (
      <div className="question-details">
        <div className="qd-state qd-state-error">
          <p>Error: {error}</p>
          <Link to="/questions">← Back to Questions</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="question-details">
      <div className="qd-breadcrumb">
        <Link to="/questions">← Back to Questions</Link>
      </div>

      <section className="qd-question-panel">
        <div className="qd-eyebrow">
          <span className="qd-dot" /> COMMUNITY QUESTION
        </div>
        <h1>{question.title}</h1>
        <p className="qd-question-body">{question.body}</p>
        <small className="qd-muted">
          Asked on {new Date(question.created_at).toLocaleString()}
        </small>

        <VoteControls
          targetType="questions"
          targetId={question.id}
          summary={questionVote}
          onVote={handleVote}
          busy={votingKey === `questions-${question.id}`}
        />
      </section>

      {voteMessage && (
        <p className="qd-feedback" role="status">
          {voteMessage}
        </p>
      )}

      <section className="escalation-section qd-escalation">
        <h3>Still need help?</h3>
        <button
          className="qd-button qd-button-primary"
          onClick={handleEscalate}
          disabled={escalating}
        >
          {escalating ? "Escalating..." : "Escalate to Support"}
        </button>

        {escalationMessage && (
          <p className="qd-feedback qd-success">{escalationMessage}</p>
        )}
        {ticketId && (
          <p className="qd-feedback qd-success">
            Support Ticket #{ticketId} has been created.
          </p>
        )}
      </section>

      <section className="qd-content-section qd-answers-section">
        <div className="qd-section-heading">
          <h2>
            Answers <span>({answers.length})</span>
          </h2>
        </div>

        {answers.length === 0 ? (
          <p>No answers yet. Be the first to answer!</p>
        ) : (
          <div className="answers-list">
            {acceptMessage && (
              <p className="qd-feedback qd-success" role="status">
                {acceptMessage}
              </p>
            )}
            {answers.map((answer) => (
              <article className="answer-card qd-item-card" key={answer.id}>
                <p>{answer.body}</p>
                <small>
                  Answered on {new Date(answer.created_at).toLocaleString()}
                </small>

                <VoteControls
                  targetType="answers"
                  targetId={answer.id}
                  summary={answerVotes[answer.id] || emptyVoteSummary}
                  onVote={handleVote}
                  busy={votingKey === `answers-${answer.id}`}
                />

                {Number(question.accepted_answer_id) === Number(answer.id) ? (
                  <div className="qd-accepted-answer">✓ Accepted Answer</div>
                ) : Number(currentUser?.id) === Number(question.user_id) ? (
                  <button
                    type="button"
                    className="qd-button qd-button-secondary"
                    onClick={() => handleAcceptAnswer(answer.id)}
                    disabled={acceptingAnswerId !== null}
                  >
                    {acceptingAnswerId === answer.id
                      ? "Accepting..."
                      : "Accept Answer"}
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="qd-content-section qd-comments-section">
        <div className="qd-section-heading">
          <h2>
            Comments <span>({comments.length})</span>
          </h2>
        </div>

        {comments.length === 0 ? (
          <p>No comments yet.</p>
        ) : (
          <div className="comments-list">
            {comments.map((comment) => (
              <article className="comment-card qd-item-card" key={comment.id}>
                <p>{comment.body}</p>
                <small>
                  Commented on {new Date(comment.created_at).toLocaleString()}
                </small>
              </article>
            ))}
          </div>
        )}

        <h3 className="qd-form-title">Add a Comment</h3>
        <form
          className="qd-form qd-comment-form"
          onSubmit={handleSubmitComment}
        >
          <textarea
            className="qd-textarea qd-comment-textarea"
            value={commentBody}
            onChange={(event) => setCommentBody(event.target.value)}
            placeholder="Write a comment..."
            rows="3"
          />
          <br />
          <button
            className="qd-button qd-button-secondary"
            type="submit"
            disabled={!commentBody.trim() || submittingComment}
          >
            {submittingComment ? "Posting..." : "Post Comment"}
          </button>
        </form>

        {commentMessage && (
          <p className="qd-feedback qd-success">{commentMessage}</p>
        )}
      </section>

      <section className="qd-content-section qd-answer-editor">
        <div className="qd-section-heading">
          <h2>Write an Answer</h2>
        </div>
        <form className="qd-form" onSubmit={handleSubmitAnswer}>
          <textarea
            className="qd-textarea qd-answer-textarea"
            value={answerBody}
            onChange={(event) => setAnswerBody(event.target.value)}
            placeholder="Write your answer..."
            rows="6"
          />
          <br />
          <button
            className="qd-button qd-button-primary"
            type="submit"
            disabled={!answerBody.trim() || submittingAnswer}
          >
            {submittingAnswer ? "Posting..." : "Post Answer"}
          </button>
        </form>

        {answerMessage && (
          <p className="qd-feedback qd-success">{answerMessage}</p>
        )}
        {error && <p className="qd-feedback qd-error">Error: {error}</p>}
      </section>
    </div>
  );
}

export default QuestionDetails;

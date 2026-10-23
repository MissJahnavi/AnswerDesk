import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createQuestion } from "../services/questionService";
import "./CreateQuestion.css";

function CreateQuestion() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError("Title and body are required.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const question = await createQuestion(title, body);
      navigate(`/questions/${question.id}`);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-question-page">
      <div className="cq-eyebrow"><span className="cq-dot" /> COMMUNITY DISCUSSION</div>
      <Link className="cq-back-link" to="/questions">← Back to Questions</Link>

      <header className="cq-header">
        <h1>Ask a Question</h1>
        <p>Share your question with the community. Include enough detail to help others answer.</p>
      </header>

      {error && <p className="cq-error" role="alert">{error}</p>}

      <form className="cq-form" onSubmit={handleSubmit}>
        <div className="cq-field">
          <label htmlFor="question-title">Title</label>
          <input
            className="cq-input"
            id="question-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What do you want to ask?"
            maxLength={180}
            required
          />
          <span className="cq-hint">Be specific and imagine you're asking another developer.</span>
        </div>

        <div className="cq-field">
          <label htmlFor="question-body">Description</label>
          <textarea
            className="cq-textarea"
            id="question-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Explain your question in detail..."
            rows={8}
            required
          />
          <span className="cq-hint">Include what you tried, what you expected, and what happened.</span>
        </div>

        <div className="cq-form-footer">
          <span className="cq-required-note">* Required fields</span>
          <button className="cq-submit" type="submit" disabled={loading}>
            {loading ? "Posting..." : "Post Question"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateQuestion;

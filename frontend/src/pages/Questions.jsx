import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./Questions.css";
import { getQuestions } from "../services/questionService";
import Pagination from "../components/Pagination";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.3 4.3" />
    </svg>
  );
}

function Questions() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const QUESTIONS_PER_PAGE = 5;

  useEffect(() => {
    let active = true;
    const loadQuestions = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getQuestions();
        if (active) setQuestions(Array.isArray(data) ? data : []);
      } catch (err) {
        if (active) setError(err.message || "Failed to load questions.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadQuestions();
    return () => {
      active = false;
    };
  }, []);

  const filteredQuestions = useMemo(() => {
    const sortedQuestions = [...questions].sort((a, b) => {
      const dateA = Date.parse(a.created_at);
      const dateB = Date.parse(b.created_at);

      if (!Number.isFinite(dateA)) return 1;
      if (!Number.isFinite(dateB)) return -1;

      return dateB - dateA;
    });

    const query = search.trim().toLowerCase();

    if (!query) return sortedQuestions;

    return sortedQuestions.filter(
      (question) =>
        String(question.title || "")
          .toLowerCase()
          .includes(query) ||
        String(question.body || "")
          .toLowerCase()
          .includes(query),
    );
  }, [questions, search]);

  const totalPages = Math.ceil(filteredQuestions.length / QUESTIONS_PER_PAGE);

  const paginatedQuestions = filteredQuestions.slice(
    (page - 1) * QUESTIONS_PER_PAGE,
    page * QUESTIONS_PER_PAGE,
  );
  return (
    <div className="questions-page">
      <section className="questions-hero">
        <div className="questions-hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-dot" /> COMMUNITY
          </div>
          <h1>Questions</h1>
          <p>
            Find answers, share what you know, and learn with the community.
          </p>
        </div>
        <Link className="questions-ask-button" to="/questions/new">
          <span aria-hidden="true">+</span> Ask a question
        </Link>
      </section>

      <div className="questions-toolbar">
        <label className="question-search">
          <SearchIcon />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search questions..."
            aria-label="Search questions"
          />
          {search && (
            <button
              className="search-clear"
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </label>
        <div className="questions-count" aria-live="polite">
          <span className="count-number">{filteredQuestions.length}</span>
          {filteredQuestions.length === 1 ? "question" : "questions"}
        </div>
      </div>

      <section className="questions-section">
        <div className="questions-section-heading">
          <div>
            <h2>{search.trim() ? "Search results" : "Recent questions"}</h2>
            <p>
              {search.trim()
                ? `Results matching “${search.trim()}”`
                : "Browse the latest community discussions."}
            </p>
          </div>
          <span className="sort-label">Newest first</span>
        </div>

        {loading ? (
          <div className="questions-state" role="status">
            <span className="loading-spinner" />
            <strong>Loading questions</strong>
            <p>Fetching the latest community discussions…</p>
          </div>
        ) : error ? (
          <div className="questions-state" role="alert">
            <span className="state-icon">!</span>
            <strong>We couldn’t load the questions</strong>
            <p>{error}</p>
            <button
              className="questions-retry-button"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="questions-state">
            <span className="empty-state-icon">?</span>
            <strong>
              {search.trim() ? "No matching questions" : "No questions yet"}
            </strong>
            <p>
              {search.trim()
                ? "Try another keyword or clear your search."
                : "Start the discussion by asking the first question."}
            </p>
            {search.trim() ? (
              <button
                className="questions-secondary-button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
              >
                Clear search
              </button>
            ) : (
              <Link className="questions-retry-button" to="/questions/new">
                Ask the first question
              </Link>
            )}
          </div>
        ) : (
          <div className="questions-list">
            {paginatedQuestions.map((question) => (
              <article className="question-card" key={question.id}>
                <div className="question-card-meta">
                  <span className="question-category-dot" />
                  <span>COMMUNITY QUESTION</span>
                  <span className="meta-separator">·</span>
                  <span>
                    {question.created_at
                      ? `Asked ${new Date(question.created_at).toLocaleDateString()}`
                      : "Recently asked"}
                  </span>
                </div>
                <h3>
                  <Link to={`/questions/${question.id}`}>{question.title}</Link>
                </h3>
                <p className="question-excerpt">{question.body}</p>
                <div className="question-card-footer">
                  <span className="question-meta-item">
                    <span className="question-meta-label">Discussion</span>
                  </span>
                  <Link
                    className="question-open-link"
                    to={`/questions/${question.id}`}
                  >
                    View question <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}

export default Questions;

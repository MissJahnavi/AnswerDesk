import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyTickets, createTicket } from "../services/ticketService";
import "./MyTickets.css";

function MyTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  const loadTickets = async () => {
    try {
      setError("");
      const data = await getMyTickets();
      setTickets(data);
    } catch (err) {
      setError(err.message || "Failed to load tickets");
    }
  };

  useEffect(() => {
    const loadTickets = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await getMyTickets();

        setTickets(data);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadTickets();
  }, []);

  const handleCreateTicket = async (event) => {
    event.preventDefault();

    if (!subject.trim() || !description.trim()) {
      setCreateError("Subject and description are required.");
      return;
    }

    try {
      setCreating(true);
      setCreateError("");
      setCreateSuccess("");

      await createTicket({
        subject: subject.trim(),
        description: description.trim(),
        priority,
      });

      setSubject("");
      setDescription("");
      setPriority("medium");
      setShowCreateForm(false);
      setCreateSuccess("Support ticket created successfully.");

      await loadTickets();
    } catch (err) {
      setCreateError(err.message || "Failed to create ticket.");
    } finally {
      setCreating(false);
    }
  };
  if (loading) {
    return (
      <div className="my-tickets-page">
        <div className="mt-loading">
          <span className="mt-spinner" />
          Loading your support tickets...
        </div>
      </div>
    );
  }

  return (
    <div className="my-tickets-page">
      <div className="mt-eyebrow">
        <span className="mt-dot" /> YOUR SUPPORT REQUESTS
      </div>
      <Link to="/questions">← Back to Questions</Link>

      <header className="mt-page-header">
        <div>
          <h1>My Support Tickets</h1>
          <p>
            Review your support requests and continue conversations with the
            support team.
          </p>
        </div>

        <button
          type="button"
          className="mt-primary-link"
          onClick={() => {
            setShowCreateForm((current) => !current);
            setCreateError("");
            setCreateSuccess("");
          }}
        >
          {showCreateForm ? "Cancel" : "+ Create Support Ticket"}
        </button>
      </header>

      {createSuccess && (
        <p role="status" className="mt-success">
          {createSuccess}
        </p>
      )}

      {showCreateForm && (
        <form className="mt-create-form" onSubmit={handleCreateTicket}>
          <h2>Create a support ticket</h2>

          {createError && (
            <p role="alert" className="mt-error">
              {createError}
            </p>
          )}

          <label htmlFor="ticket-subject">Subject</label>
          <input
            id="ticket-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            maxLength={200}
            required
            placeholder="Briefly describe your issue"
          />

          <label htmlFor="ticket-description">Description</label>
          <textarea
            id="ticket-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            required
            placeholder="Explain the issue and any relevant details"
          />

          <label htmlFor="ticket-priority">Priority</label>
          <select
            id="ticket-priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          <button type="submit" disabled={creating}>
            {creating ? "Creating…" : "Submit Ticket"}
          </button>
        </form>
      )}

      {error && (
        <p className="mt-error" role="alert">
          {error}
        </p>
      )}

      {!error && tickets.length === 0 && (
        <div className="mt-empty-state">
          <span className="mt-empty-icon">?</span>
          <h2>No support tickets yet</h2>
          <p>
            You haven’t created a support request or escalated a question yet.
          </p>
          <Link className="mt-primary-link" to="/questions">
            Explore community questions
          </Link>
        </div>
      )}

      {tickets.length > 0 && (
        <div className="my-ticket-list">
          {tickets.map((ticket) => (
            <article key={ticket.id} className="my-ticket-card">
              <h2>
                #{ticket.id} — {ticket.subject}
              </h2>

              <p>{ticket.description}</p>

              <p>
                <strong>Priority:</strong> {ticket.priority}
              </p>

              <p>
                <strong>Status:</strong> {ticket.status}
              </p>

              <p>
                <strong>Created:</strong>{" "}
                {new Date(ticket.created_at).toLocaleString()}
              </p>

              <Link to={`/tickets/${ticket.id}`}>View Ticket →</Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyTickets;

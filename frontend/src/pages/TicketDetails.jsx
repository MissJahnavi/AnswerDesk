import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import socket from "../socket";
import "./TicketDetails.css";
import {
  getAssignedTicketById,
  updateTicketStatus,
  assignTicket,
  getAgents,
  getTicketMessages,
  sendTicketMessage,
} from "../services/ticketService";

const formatDate = (value) => {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const humanize = (value) =>
  String(value || "—")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const statusClass = (value) =>
  `ticket-badge ticket-badge--${String(value || "unknown")
    .toLowerCase()
    .replaceAll("_", "-")}`;

const priorityClass = (value) =>
  `ticket-badge ticket-badge--priority-${String(value || "unknown").toLowerCase()}`;

function TicketDetails() {
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState("");

  const currentUser = JSON.parse(
    sessionStorage.getItem("answerdesk_user") || "null",
  );

  const isAdmin = currentUser?.role === "admin";

  const refreshTicket = async () => {
    const data = await getAssignedTicketById(id);
    setTicket(data);
    setEvents(data.events || []);
  };

  useEffect(() => {
    let active = true;
    const loadTicket = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getAssignedTicketById(id);
        if (!active) return;
        setTicket(data);
        setEvents(data.events || []);
      } catch (err) {
        if (active) setError(err.message || "Unable to load ticket.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadTicket();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    let active = true;
    const loadAgents = async () => {
      try {
        const data = await getAgents();
        if (active) setAgents(data);
      } catch (err) {
        if (active) setError((current) => current || err.message);
      }
    };
    loadAgents();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadMessages = async () => {
      try {
        const data = await getTicketMessages(id);
        if (active) setMessages(data.messages || []);
      } catch (err) {
        if (active) setMessageError(err.message || "Unable to load messages.");
      }
    };
    loadMessages();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    const handleConnect = () => {
      socket.emit("join-ticket", id);
    };
    const handleSocketError = (err) => {
      console.error("Socket connection error:", err.message);
    };
    const handleNewMessage = (payload) => {
      const incoming = payload?.ticketMessage || payload;
      if (!incoming?.id) return;
      setMessages((current) => {
        const exists = current.some(
          (item) => String(item.id) === String(incoming.id),
        );
        return exists ? current : [...current, incoming];
      });
    };

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleSocketError);
    socket.on("new-ticket-message", handleNewMessage);
    if (socket.connected) handleConnect();
    else socket.connect();

    return () => {
      socket.emit("leave-ticket", id);
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleSocketError);
      socket.off("new-ticket-message", handleNewMessage);
      socket.disconnect();
    };
  }, [id]);

  const handleStatusUpdate = async () => {
    if (!newStatus) return;
    try {
      setUpdatingStatus(true);
      setStatusMessage("");
      setError("");
      await updateTicketStatus(id, newStatus);
      setStatusMessage("Ticket status updated successfully.");
      setNewStatus("");
      await refreshTicket();
    } catch (err) {
      setError(err.message || "Unable to update ticket status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAssignTicket = async () => {
    if (!selectedAgent) return;
    try {
      setAssigning(true);
      setError("");
      setStatusMessage("");
      await assignTicket(id, selectedAgent);
      setStatusMessage("Ticket assigned successfully.");
      setSelectedAgent("");
      await refreshTicket();
    } catch (err) {
      setError(err.message || "Unable to assign ticket.");
    } finally {
      setAssigning(false);
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!messageText.trim()) return;
    try {
      setMessageLoading(true);
      setMessageError("");
      const data = await sendTicketMessage(id, messageText.trim());
      const sent = data.ticketMessage;
      if (sent?.id) {
        setMessages((current) =>
          current.some((item) => String(item.id) === String(sent.id))
            ? current
            : [...current, sent],
        );
      }
      setMessageText("");
    } catch (err) {
      setMessageError(err.message || "Unable to send reply.");
    } finally {
      setMessageLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="ticket-state-card">
        <span className="ticket-state-spinner" />
        <p>Loading ticket details…</p>
      </div>
    );
  }

  if (error && !ticket) {
    return (
      <div className="ticket-state-card ticket-state-card--error">
        <h2>Unable to load ticket</h2>
        <p>{error}</p>
        <Link className="ticket-button ticket-button--secondary" to="/agent">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!ticket) return null;

  const sla = ticket.sla || {};
  const responseSla = sla.responseSlaStatus || "Not available";
  const resolutionSla = sla.resolutionSlaStatus || "Not available";

  return (
    <div className="ticket-details ticket-details--redesigned">
      <Link className="ticket-back-link" to="/agent">
        ← Back to dashboard
      </Link>

      <section className="ticket-hero">
        <div className="ticket-hero-main">
          <div className="ticket-eyebrow">
            SUPPORT REQUEST <span>#{ticket.id}</span>
          </div>
          <h1>{ticket.subject}</h1>
          <p className="ticket-description">
            {ticket.description || "No description was provided."}
          </p>
          <div className="ticket-badges">
            <span className={statusClass(ticket.status)}>
              {humanize(ticket.status)}
            </span>
            <span className={priorityClass(ticket.priority)}>
              {humanize(ticket.priority)} priority
            </span>
          </div>
        </div>
        <div className="ticket-hero-action">
          <label htmlFor="ticket-status">Update status</label>
          <div className="ticket-inline-control">
            <select
              id="ticket-status"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
            >
              <option value="">Choose status</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="waiting_on_user">Waiting on user</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <button
              className="ticket-button"
              onClick={handleStatusUpdate}
              disabled={!newStatus || updatingStatus}
            >
              {updatingStatus ? "Saving…" : "Update"}
            </button>
          </div>
        </div>
      </section>

      {(error || statusMessage) && (
        <div
          className={`ticket-feedback ${error ? "ticket-feedback--error" : "ticket-feedback--success"}`}
        >
          {error || statusMessage}
        </div>
      )}

      <section className="ticket-summary-grid" aria-label="Ticket overview">
        <article className="ticket-info-card">
          <span className="ticket-card-label">REQUESTER</span>
          <h3>{ticket.requester_name || "Unknown requester"}</h3>
          <p>{ticket.requester_email || "No email available"}</p>
        </article>
        <article className="ticket-info-card">
          <span className="ticket-card-label">ASSIGNED AGENT</span>
          <h3>{ticket.assignee_name || "Unassigned"}</h3>
          <p>{ticket.assignee_email || "Choose an agent below"}</p>
        </article>
        <article className="ticket-info-card">
          <span className="ticket-card-label">FIRST RESPONSE SLA</span>
          <h3 className="ticket-sla-value">{humanize(responseSla)}</h3>
          <p>Due {formatDate(ticket.first_response_due_at)}</p>
        </article>
        <article className="ticket-info-card">
          <span className="ticket-card-label">RESOLUTION SLA</span>
          <h3 className="ticket-sla-value">{humanize(resolutionSla)}</h3>
          <p>Due {formatDate(ticket.resolution_due_at)}</p>
        </article>
      </section>

      {isAdmin &&
       (<section className="ticket-assignment-panel">
        <div>
          <span className="ticket-card-label">TICKET OWNERSHIP</span>
          <h2>Assign or reassign ticket</h2>
          <p>Choose the support agent responsible for this request.</p>
        </div>
        <div className="ticket-assignment-controls">
          <select
            aria-label="Select an agent"
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
          >
            <option value="">Select an agent</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.email})
              </option>
            ))}
          </select>
          <button
            className="ticket-button"
            onClick={handleAssignTicket}
            disabled={!selectedAgent || assigning}
          >
            {assigning ? "Assigning…" : "Assign agent"}
          </button>
        </div>
      </section>)}


      <section className="ticket-conversation ticket-conversation--redesigned">
        <div className="ticket-section-heading">
          <div>
            <span className="ticket-card-label">DISCUSSION</span>
            <h2>Conversation</h2>
          </div>
          <span className="ticket-count">
            {messages.length} {messages.length === 1 ? "message" : "messages"}
          </span>
        </div>

        {messageError && (
          <div className="ticket-feedback ticket-feedback--error">
            {messageError}
          </div>
        )}

        {messages.length === 0 ? (
          <div className="ticket-empty-messages">
            <h3>No messages yet</h3>
            <p>Send a reply to start the conversation on this ticket.</p>
          </div>
        ) : (
          <div className="message-list">
            {messages.map((message) => (
              <article key={message.id} className="ticket-message">
                <div className="ticket-message-header">
                  <div className="ticket-avatar" aria-hidden="true">
                    {(message.sender_name || "U")
                      .trim()
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div className="ticket-message-author">
                    <strong>{message.sender_name || "Unknown user"}</strong>
                    <span>{humanize(message.sender_role)}</span>
                  </div>
                  <time>{formatDate(message.created_at)}</time>
                </div>
                <p>{message.message}</p>
              </article>
            ))}
          </div>
        )}

        <form className="ticket-reply-form" onSubmit={handleSendMessage}>
          <label htmlFor="ticket-reply">Your reply</label>
          <textarea
            id="ticket-reply"
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            placeholder="Share an update or ask for more information…"
            rows={4}
          />
          <div className="ticket-reply-footer">
            <span>Keep your response clear and helpful.</span>
            <button
              className="ticket-button"
              type="submit"
              disabled={messageLoading || !messageText.trim()}
            >
              {messageLoading ? "Sending…" : "Send reply →"}
            </button>
          </div>
        </form>
      </section>

      <section className="ticket-timeline-section">
        <div className="ticket-section-heading">
          <div>
            <span className="ticket-card-label">AUDIT LOG</span>
            <h2>Ticket timeline</h2>
          </div>
          <span className="ticket-count">
            {events.length} {events.length === 1 ? "event" : "events"}
          </span>
        </div>
        {events.length === 0 ? (
          <div className="ticket-empty-messages">
            <p>No timeline events found.</p>
          </div>
        ) : (
          <div className="ticket-timeline">
            {events.map((event) => (
              <article className="ticket-timeline-event" key={event.id}>
                <span className="ticket-timeline-marker" />
                <div className="ticket-timeline-content">
                  <div className="ticket-timeline-topline">
                    <strong>{humanize(event.event_type)}</strong>
                    <time>{formatDate(event.created_at)}</time>
                  </div>
                  <p>By {event.actor_name || "System"}</p>
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <details>
                      <summary>View event details</summary>
                      <pre>{JSON.stringify(event.metadata, null, 2)}</pre>
                    </details>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default TicketDetails;

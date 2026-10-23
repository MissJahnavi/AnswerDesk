import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import socket from "../socket";
import "./MyTicketDetails.css";
import {
  getTicketById,
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
  `my-ticket-badge my-ticket-badge--${String(value || "unknown").toLowerCase().replaceAll("_", "-")}`;

const priorityClass = (value) =>
  `my-ticket-badge my-ticket-badge--priority-${String(value || "unknown").toLowerCase()}`;

function MyTicketDetails() {
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [error, setError] = useState("");
  const [messageError, setMessageError] = useState("");

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        setLoading(true);
        setError("");
        const [ticketData, messageData] = await Promise.all([
          getTicketById(id),
          getTicketMessages(id),
        ]);
        if (!active) return;
        setTicket(ticketData);
        setMessages(messageData.messages || []);
      } catch (err) {
        if (active) setError(err.message || "Unable to load this ticket.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => { active = false; };
  }, [id]);

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
          current.some((message) => String(message.id) === String(sent.id))
            ? current
            : [...current, sent]
        );
      }
      setMessageText("");
    } catch (err) {
      setMessageError(err.message || "Unable to send your reply.");
    } finally {
      setMessageLoading(false);
    }
  };

  useEffect(() => {
    const handleConnect = () => socket.emit("join-ticket", id);
    const handleSocketError = (err) => console.error("Socket connection error:", err.message);
    const handleNewMessage = (payload) => {
      const incoming = payload?.ticketMessage || payload;
      if (!incoming?.id) return;
      setMessages((current) =>
        current.some((message) => String(message.id) === String(incoming.id))
          ? current
          : [...current, incoming]
      );
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

  if (loading) {
    return (
      <div className="my-ticket-state-card">
        <span className="my-ticket-spinner" />
        <p>Loading your ticket…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-ticket-state-card my-ticket-state-card--error">
        <h2>Unable to load ticket</h2>
        <p>{error}</p>
        <Link className="my-ticket-button my-ticket-button--secondary" to="/tickets">← Back to my tickets</Link>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="my-ticket-state-card">
        <h2>Ticket not found</h2>
        <p>This ticket may have been removed or you may not have access to it.</p>
        <Link className="my-ticket-button my-ticket-button--secondary" to="/tickets">← Back to my tickets</Link>
      </div>
    );
  }

  return (
    <div className="my-ticket-details my-ticket-details--redesigned">
      <Link className="my-ticket-back-link" to="/tickets">← Back to my tickets</Link>

      <section className="my-ticket-hero">
        <div className="my-ticket-hero-main">
          <div className="my-ticket-eyebrow">YOUR SUPPORT REQUEST <span>#{ticket.id}</span></div>
          <h1>{ticket.subject}</h1>
          <p className="my-ticket-description">{ticket.description || "No description was provided."}</p>
          <div className="my-ticket-badges">
            <span className={statusClass(ticket.status)}>{humanize(ticket.status)}</span>
            <span className={priorityClass(ticket.priority)}>{humanize(ticket.priority)} priority</span>
          </div>
        </div>
        <div className="my-ticket-status-panel">
          <span className="my-ticket-card-label">CURRENT STATUS</span>
          <strong>{humanize(ticket.status)}</strong>
          <p>We'll keep your conversation and updates together here.</p>
        </div>
      </section>

      <section className="my-ticket-summary-grid" aria-label="Ticket overview">
        <article className="my-ticket-info-card">
          <span className="my-ticket-card-label">TICKET NUMBER</span>
          <h3>#{ticket.id}</h3>
          <p>Use this ID when referring to your request.</p>
        </article>
        <article className="my-ticket-info-card">
          <span className="my-ticket-card-label">PRIORITY</span>
          <h3>{humanize(ticket.priority)}</h3>
          <p>Set when the ticket was created.</p>
        </article>
        <article className="my-ticket-info-card">
          <span className="my-ticket-card-label">STATUS</span>
          <h3>{humanize(ticket.status)}</h3>
          <p>Latest state of your support request.</p>
        </article>
        <article className="my-ticket-info-card">
          <span className="my-ticket-card-label">CONVERSATION</span>
          <h3>{messages.length} {messages.length === 1 ? "message" : "messages"}</h3>
          <p>Replies from you and the support team.</p>
        </article>
      </section>

      <section className="my-ticket-conversation">
        <div className="my-ticket-section-heading">
          <div>
            <span className="my-ticket-card-label">SUPPORT THREAD</span>
            <h2>Conversation</h2>
            <p>All replies for this request appear here.</p>
          </div>
          <span className="my-ticket-count">{messages.length} {messages.length === 1 ? "message" : "messages"}</span>
        </div>

        {messageError && <div className="my-ticket-feedback my-ticket-feedback--error">{messageError}</div>}

        {messages.length === 0 ? (
          <div className="my-ticket-empty">
            <div className="my-ticket-empty-icon" aria-hidden="true">↗</div>
            <h3>No messages yet</h3>
            <p>Send a reply below if you want to add more details to your request.</p>
          </div>
        ) : (
          <div className="my-ticket-message-list">
            {messages.map((message) => (
              <article className="my-ticket-message" key={message.id}>
                <div className="my-ticket-message-header">
                  <span className="my-ticket-avatar" aria-hidden="true">
                    {(message.sender_name || "U").trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="my-ticket-message-author">
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

        <form className="my-ticket-reply-form" onSubmit={handleSendMessage}>
          <div>
            <span className="my-ticket-card-label">CONTINUE THE DISCUSSION</span>
            <h3>Write a reply</h3>
          </div>
          <textarea
            id="my-ticket-reply"
            aria-label="Write a reply"
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            placeholder="Describe what you tried or share any extra details…"
            rows={4}
          />
          <div className="my-ticket-reply-footer">
            <span>Replies are shared with the support team.</span>
            <button className="my-ticket-button" type="submit" disabled={messageLoading || !messageText.trim()}>
              {messageLoading ? "Sending…" : "Send reply →"}
            </button>
          </div>
        </form>
      </section>

      <div className="my-ticket-note">
        <span className="my-ticket-note-mark" aria-hidden="true">i</span>
        <p>Ticket status and assignment are managed by the support team. You can continue the conversation here.</p>
      </div>
    </div>
  );
}

export default MyTicketDetails;

import { useEffect, useState } from "react";

import {
  getAssignedTickets,
  getAssignedTicketSummary,
  getUnassignedTickets,
  assignTicket,
} from "../services/ticketService";

import TicketFilters from "../components/TicketFilters";
import TicketTable from "../components/TicketTable";
import Pagination from "../components/Pagination";
import "./AgentDashboard.css";

function AgentDashboard() {
  const [tickets, setTickets] = useState([]);
  const [unassignedTickets, setUnassignedTickets] = useState([]);
  const [summary, setSummary] = useState(null);

  const [loading, setLoading] = useState(true);
  const [unassignedLoading, setUnassignedLoading] = useState(true);
  const [error, setError] = useState("");
  const [unassignedError, setUnassignedError] = useState("");
  const [claimingId, setClaimingId] = useState(null);
  const [claimError, setClaimError] = useState("");
  const [claimSuccess, setClaimSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadTickets = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getAssignedTickets({
        page,
        limit: 10,
        search,
        status,
        priority,
      });

      setTickets(data.tickets);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const data = await getAssignedTicketSummary();
      setSummary(data);
    } catch (error) {
      console.error("Failed to load summary:", error);
    }
  };

  const loadUnassignedTickets = async () => {
    try {
      setUnassignedLoading(true);
      setUnassignedError("");

      const data = await getUnassignedTickets();
      setUnassignedTickets(data.tickets ?? []);
    } catch (error) {
      setUnassignedError(error.message);
    } finally {
      setUnassignedLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
    loadSummary();
    loadUnassignedTickets();
  }, [page, search, status, priority]);

  const handleApplyFilters = () => {
    setPage(1);
    loadTickets();
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatus("");
    setPriority("");
    setPage(1);
  };

  const handleClaimTicket = async (ticketId) => {
    try {
      setClaimingId(ticketId);
      setClaimError("");
      setClaimSuccess("");

      // Use the currently logged-in user's profile.
      const storedUser = sessionStorage.getItem("answerdesk_user");

      if (!storedUser) {
        throw new Error(
          "Your user session was not found. Please log in again.",
        );
      }

      const user = JSON.parse(storedUser);
      const agentId = user.id ?? user.user?.id;

      if (!agentId || user.role !== "agent") {
        throw new Error(
          "Could not verify your agent account. Please log in again.",
        );
      }

      // The backend must verify that this ticket is still unassigned.
      await assignTicket(ticketId, agentId);

      setClaimSuccess(`Ticket #${ticketId} claimed successfully.`);

      // Refresh the queue and assigned-ticket statistics.
      await Promise.all([
        loadTickets(),
        loadSummary(),
        loadUnassignedTickets(),
      ]);
    } catch (error) {
      setClaimError(error.message);
      // Refresh the queue in case another agent claimed it first.
      await loadUnassignedTickets();
    } finally {
      setClaimingId(null);
    }
  };

  const metricCards = summary
    ? [
        { label: "Total assigned", value: summary.total ?? 0, tone: "neutral" },
        { label: "Open", value: summary.open ?? 0, tone: "blue" },
        {
          label: "In progress",
          value: summary.in_progress ?? 0,
          tone: "amber",
        },
        {
          label: "Waiting on user",
          value: summary.waiting_on_user ?? 0,
          tone: "violet",
        },
        { label: "Resolved", value: summary.resolved ?? 0, tone: "green" },
        {
          label: "SLA breached",
          value: summary.sla_breached ?? 0,
          tone: "red",
        },
      ]
    : [];

  return (
    <div className="agent-dashboard">
      <header className="ad-dashboard-header">
        <div>
          <div className="ad-eyebrow">
            <span className="ad-dot" /> TICKET WORKSPACE
          </div>
          <h1>Agent Dashboard</h1>
          <p className="ad-dashboard-subtitle">
            Track assigned tickets, monitor SLA performance, and respond to
            requests.
          </p>
        </div>

        <div className="ad-header-count">
          <span className="ad-count-number">
            {summary?.total ?? tickets.length}
          </span>
          <span>assigned tickets</span>
        </div>
      </header>

      {summary && (
        <section className="ad-metrics" aria-label="Ticket summary">
          {metricCards.map((metric) => (
            <article
              className={`ad-metric-card ad-tone-${metric.tone}`}
              key={metric.label}
            >
              <span className="ad-metric-label">{metric.label}</span>
              <strong className="ad-metric-value">{metric.value}</strong>
            </article>
          ))}
        </section>
      )}

      {/* Unassigned queue */}
      <section className="ad-ticket-section ad-unassigned-section">
        <div className="ad-section-heading">
          <div>
            <h2>Unassigned tickets</h2>
            <p>
              Review new requests and claim a ticket to start working on it.
            </p>
          </div>
          <span className="ad-result-count">
            {unassignedTickets.length} available
          </span>
        </div>

        {claimError && (
          <div className="ad-state ad-state-error" role="alert">
            {claimError}
          </div>
        )}

        {claimSuccess && (
          <div className="ad-claim-success" role="status">
            {claimSuccess}
          </div>
        )}

        {unassignedLoading ? (
          <div className="ad-state">
            <span className="ad-spinner" />
            Loading unassigned tickets...
          </div>
        ) : unassignedError ? (
          <div className="ad-state ad-state-error" role="alert">
            Unable to load unassigned tickets: {unassignedError}
          </div>
        ) : unassignedTickets.length === 0 ? (
          <div className="ad-state">
            <strong>No unassigned tickets</strong>
            <span>New support requests will appear here.</span>
          </div>
        ) : (
          <div className="ad-table-wrap">
            <table className="ticket-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Subject</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Response SLA</th>
                  <th>Resolution SLA</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {unassignedTickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>#{ticket.id}</td>
                    <td>
                      <a href={`/agent/tickets/${ticket.id}`}>
                        {ticket.subject}
                      </a>
                    </td>
                    <td>{ticket.priority}</td>
                    <td>{ticket.status}</td>
                    <td>{ticket.sla?.responseSlaStatus ?? "pending"}</td>
                    <td>{ticket.sla?.resolutionSlaStatus ?? "pending"}</td>
                    <td>
                      <button
                        type="button"
                        className="ad-claim-button"
                        disabled={claimingId !== null}
                        onClick={() => handleClaimTicket(ticket.id)}
                      >
                        {claimingId === ticket.id
                          ? "Claiming..."
                          : "Claim ticket"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Existing assigned tickets */}
      <section className="ad-ticket-section">
        <div className="ad-section-heading">
          <div>
            <h2>Assigned tickets</h2>
            <p>Search and filter the tickets currently assigned to you.</p>
          </div>
          <span className="ad-result-count">{tickets.length} on this page</span>
        </div>

        <TicketFilters
          search={search}
          status={status}
          priority={priority}
          onSearchChange={setSearch}
          onStatusChange={setStatus}
          onPriorityChange={setPriority}
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
        />

        {loading && (
          <div className="ad-state">
            <span className="ad-spinner" />
            Loading tickets...
          </div>
        )}

        {error && (
          <div className="ad-state ad-state-error" role="alert">
            Unable to load tickets: {error}
          </div>
        )}

        {!loading && !error && tickets.length === 0 && (
          <div className="ad-state">
            <strong>No assigned tickets</strong>
            <span>Claim an available ticket above to get started.</span>
          </div>
        )}

        {!loading && !error && tickets.length > 0 && (
          <>
            <div className="ad-table-wrap">
              <TicketTable tickets={tickets} />
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </section>
    </div>
  );
}

export default AgentDashboard;

import { Link } from "react-router-dom";

function TicketTable({ tickets }) {
  if (tickets.length === 0) {
    return <p>No tickets found.</p>;
  }

  return (
    <table className="ticket-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Subject</th>
          <th>Priority</th>
          <th>Status</th>
          <th>Response SLA</th>
          <th>Resolution SLA</th>
        </tr>
      </thead>

      <tbody>
        {tickets.map((ticket) => (
          <tr key={ticket.id}>
            <td>#{ticket.id}</td>

            <td>
              <Link to={`/agent/tickets/${ticket.id}`}>{ticket.subject}</Link>
            </td>

            <td>{ticket.priority}</td>

            <td>{ticket.status}</td>

            <td>{ticket.sla?.responseSlaStatus}</td>

            <td>{ticket.sla?.resolutionSlaStatus}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default TicketTable;

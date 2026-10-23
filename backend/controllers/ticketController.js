import pool from "../src/db.js";
import { getIO } from "../src/socket.js";

const calculateSLAStatus = (ticket) => {
  const now = new Date();

  let responseSlaStatus = "pending";
  let resolutionSlaStatus = "pending";

  if (ticket.first_response_due_at) {
    const responseDeadline = new Date(ticket.first_response_due_at);

    if (ticket.first_responded_at) {
      const responseTime = new Date(ticket.first_responded_at);

      responseSlaStatus = responseTime <= responseDeadline ? "met" : "breached";
    } else if (now > responseDeadline) {
      responseSlaStatus = "breached";
    }
  }

  if (ticket.resolution_due_at) {
    const resolutionDeadline = new Date(ticket.resolution_due_at);

    if (ticket.resolved_at) {
      const resolutionTime = new Date(ticket.resolved_at);

      resolutionSlaStatus =
        resolutionTime <= resolutionDeadline ? "met" : "breached";
    } else if (now > resolutionDeadline) {
      resolutionSlaStatus = "breached";
    }
  }

  return {
    responseSlaStatus,
    resolutionSlaStatus,
  };
};

const createTicket = async (req, res) => {
  const { subject, description, priority } = req.body;

  if (!subject || !description) {
    return res.status(400).json({
      message: "Subject and description are required",
    });
  }
  const allowedPriorities = ["low", "medium", "high", "critical"];

  if (!allowedPriorities.includes(priority)) {
    return res.status(400).json({
      message: "Invalid priority",
    });
  }

  const requester_id = req.user.id;
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const slaPolicyResult = await client.query(
      `SELECT id, response_time_minutes, resolution_time_minutes
       FROM sla_policies
       WHERE priority = $1`,
      [priority],
    );

    if (slaPolicyResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(500).json({
        message: "SLA policy not configured for this priority",
      });
    }

    const slaPolicy = slaPolicyResult.rows[0];

    const ticketResult = await client.query(
      `INSERT INTO tickets (
        requester_id, sla_policy_id, subject, description,
        priority, status, first_response_due_at, resolution_due_at
      )
      VALUES (
        $1, $2, $3, $4, $5, 'open',
        CURRENT_TIMESTAMP + ($6 * INTERVAL '1 minute'),
        CURRENT_TIMESTAMP + ($7 * INTERVAL '1 minute')
      )
      RETURNING *`,
      [
        requester_id,
        slaPolicy.id,
        subject,
        description,
        priority,
        slaPolicy.response_time_minutes,
        slaPolicy.resolution_time_minutes,
      ],
    );

    const ticket = ticketResult.rows[0];

    await client.query(
      `INSERT INTO ticket_events
        (ticket_id, actor_id, event_type, metadata)
       VALUES ($1, $2, $3, $4)`,
      [
        ticket.id,
        requester_id,
        "created",
        JSON.stringify({
          priority,
          sla_policy_id: slaPolicy.id,
        }),
      ],
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(201).json({
      message: "Ticket created successfully",
      ticket,
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Ticket transaction rollback failed:", rollbackError);
      }
    }

    console.error("Failed to create ticket:", error);

    return res.status(500).json({
      message: "Failed to create ticket",
    });
  } finally {
    client.release();
  }
};

const getMyTickets = async (req, res) => {
  try {
    const user_id = req.user.id;

    const result = await pool.query(
      `SELECT
                id,
                requester_id,
                assignee_id,
                question_id,
                sla_policy_id,
                subject,
                description,
                priority,
                status,
                created_at,
                updated_at
             FROM tickets
             WHERE requester_id = $1
             ORDER BY created_at DESC`,
      [user_id],
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch tickets",
    });
  }
};

const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const result = await pool.query(
      `SELECT id,requester_id,assignee_id,question_id,sla_policy_id,subject,description,priority,status,created_at,updated_at,first_response_due_at,resolution_due_at,first_responded_at,resolved_at
      FROM tickets WHERE id = $1
               AND requester_id = $2`,
      [id, user_id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Ticket not found",
      });
    }

    const ticket = result.rows[0];

    const slaStatus = calculateSLAStatus(ticket);

    res.status(200).json({
      ...ticket,
      sla: slaStatus,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch ticket",
    });
  }
};

const getAssignedTickets = async (req, res) => {
  try {
    const agent_id = req.user.id;

    // Pagination
    const page = Math.max(parseInt(req.query.page) || 1, 1);

    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);

    const offset = (page - 1) * limit;

    const { status, priority, search } = req.query;

    const allowedStatuses = [
      "open",
      "in_progress",
      "waiting_on_user",
      "resolved",
      "closed",
    ];

    const allowedPriorities = ["low", "medium", "high", "critical"];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status filter",
      });
    }

    if (priority && !allowedPriorities.includes(priority)) {
      return res.status(400).json({
        message: "Invalid priority filter",
      });
    }

    if (search && search.trim().length < 2) {
      return res.status(400).json({
        message: "Search must contain at least 2 characters",
      });
    }

    const conditions = ["assignee_id = $1"];
    const values = [agent_id];

    let parameterIndex = 2;

    if (status) {
      conditions.push(`status = $${parameterIndex}`);
      values.push(status);
      parameterIndex++;
    }

    if (priority) {
      conditions.push(`priority = $${parameterIndex}`);
      values.push(priority);
      parameterIndex++;
    }

    if (search) {
      conditions.push(`
        (
            subject ILIKE $${parameterIndex}
            OR description ILIKE $${parameterIndex}
        )
    `);

      values.push(`%${search.trim()}%`);
      parameterIndex++;
    }
    const whereClause = conditions.join(" AND ");

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
             FROM tickets
             WHERE ${whereClause}`,
      values,
    );

    const total = Number(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    const ticketResult = await pool.query(
      `SELECT
                id,
                requester_id,
                assignee_id,
                question_id,
                sla_policy_id,
                subject,
                description,
                priority,
                status,
                created_at,
                updated_at,
                first_response_due_at,
                resolution_due_at,
                first_responded_at,
                resolved_at
             FROM tickets
             WHERE ${whereClause}
             ORDER BY created_at DESC
             LIMIT $${parameterIndex}
             OFFSET $${parameterIndex + 1}`,
      [...values, limit, offset],
    );

    const tickets = ticketResult.rows.map((ticket) => {
      const slaStatus = calculateSLAStatus(ticket);

      return {
        ...ticket,
        sla: slaStatus,
      };
    });

    res.status(200).json({
      tickets,
      filters: {
        status: status || null,
        priority: priority || null,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch assigned tickets",
    });
  }
};

const getAssignedTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const agentId = req.user.id;

    const result = await pool.query(
      `SELECT
                t.id,
                t.requester_id,
                t.assignee_id,
                t.question_id,
                t.sla_policy_id,
                t.subject,
                t.description,
                t.priority,
                t.status,
                t.created_at,
                t.updated_at,
                t.first_response_due_at,
                t.resolution_due_at,
                t.first_responded_at,
                t.resolved_at,

                requester.name AS requester_name,
                requester.email AS requester_email,

                assignee.name AS assignee_name,
                assignee.email AS assignee_email

             FROM tickets t

             JOIN users requester
                ON requester.id = t.requester_id

             LEFT JOIN users assignee
                ON assignee.id = t.assignee_id

             WHERE t.id = $1
               AND (
                    t.assignee_id = $2
                    OR t.assignee_id IS NULL
               )`,
      [id, agentId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Ticket not found or not accessible",
      });
    }
    const ticket = result.rows[0];
    const slaStatus = calculateSLAStatus(ticket);

    const eventsResult = await pool.query(
      `SELECT
                te.id,
                te.ticket_id,
                te.actor_id,
                te.event_type,
                te.metadata,
                te.created_at,

                u.name AS actor_name,
                u.email AS actor_email

             FROM ticket_events te

             LEFT JOIN users u
                ON u.id = te.actor_id

             WHERE te.ticket_id = $1
             ORDER BY te.created_at ASC`,
      [id],
    );

    res.status(200).json({
      ...ticket,
      sla: slaStatus,
      events: eventsResult.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch ticket details",
    });
  }
};

const updateTicketStatus = async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const { id } = req.params;
    const { status } = req.body;
    const actorId = req.user.id;
    const actorRole = req.user.role;

    const allowedStatuses = [
      "open",
      "in_progress",
      "waiting_on_user",
      "resolved",
      "closed",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid ticket status",
      });
    }

    await client.query("BEGIN");
    transactionStarted = true;

    const ticketResult = await client.query(
      `SELECT id, status, first_responded_at, assignee_id
       FROM tickets
       WHERE id = $1
       FOR UPDATE`,
      [id],
    );

    if (ticketResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        message: "Ticket not found",
      });
    }

    const ticket = ticketResult.rows[0];

    if (
      actorRole !== "admin" &&
      String(ticket.assignee_id) !== String(actorId)
    ) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(403).json({
        message: "You can update only tickets assigned to you",
      });
    }

    const currentStatus = ticket.status;
    const firstRespondedAt = ticket.first_responded_at;

    const validTransitions = {
      open: ["in_progress"],
      in_progress: ["waiting_on_user", "resolved"],
      waiting_on_user: ["in_progress"],
      resolved: ["closed"],
      closed: [],
    };

    if (!validTransitions[currentStatus].includes(status)) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(400).json({
        message: `Cannot change ticket status from ${currentStatus} to ${status}`,
      });
    }

    if (
      currentStatus === "open" &&
      status === "in_progress" &&
      firstRespondedAt === null
    ) {
      await client.query(
        `UPDATE tickets
         SET status = $1,
             first_responded_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [status, id],
      );
    } else if (currentStatus === "in_progress" && status === "resolved") {
      await client.query(
        `UPDATE tickets
         SET status = $1,
             resolved_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [status, id],
      );
    } else {
      await client.query(
        `UPDATE tickets
         SET status = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [status, id],
      );
    }

    await client.query(
      `INSERT INTO ticket_events
       (ticket_id, actor_id, event_type, metadata)
       VALUES ($1, $2, $3, $4)`,
      [
        id,
        actorId,
        "status_changed",
        JSON.stringify({
          from: currentStatus,
          to: status,
        }),
      ],
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(200).json({
      message: "Ticket status updated successfully",
      status,
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Ticket status rollback failed:", rollbackError);
      }
    }

    console.error("Failed to update ticket status:", error);

    return res.status(500).json({
      message: "Failed to update ticket status",
    });
  } finally {
    client.release();
  }
};

const assignTicket = async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const { id } = req.params;
    const { assignee_id } = req.body;
    const actorId = req.user.id;
    const actorRole = req.user.role;

    if (!assignee_id) {
      return res.status(400).json({
        message: "assignee_id is required",
      });
    }

    if (actorRole === "agent" && String(assignee_id) !== String(actorId)) {
      return res.status(403).json({
        message: "Agents can only claim tickets for themselves",
      });
    }

    await client.query("BEGIN");
    transactionStarted = true;

    const ticketResult = await client.query(
      `SELECT id, assignee_id
       FROM tickets
       WHERE id = $1
       FOR UPDATE`,
      [id],
    );

    if (ticketResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        message: "Ticket not found",
      });
    }

    const ticket = ticketResult.rows[0];
    if (actorRole === "agent" && ticket.assignee_id !== null) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(403).json({
        message: "You can claim only unassigned tickets",
      });
    }

    const agentResult = await client.query(
      `SELECT id
       FROM users
       WHERE id = $1
         AND role = 'agent'`,
      [assignee_id],
    );

    if (agentResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(400).json({
        message: "Selected user is not an agent",
      });
    }

    if (
      ticket.assignee_id !== null &&
      String(ticket.assignee_id) === String(assignee_id)
    ) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(400).json({
        message: "Ticket is already assigned to this agent",
      });
    }

    await client.query(
      `UPDATE tickets
       SET assignee_id = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [assignee_id, id],
    );

    await client.query(
      `INSERT INTO ticket_events
       (ticket_id, actor_id, event_type, metadata)
       VALUES ($1, $2, $3, $4)`,
      [
        id,
        actorId,
        "assignment_changed",
        JSON.stringify({
          from: ticket.assignee_id,
          to: assignee_id,
        }),
      ],
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(200).json({
      message: "Ticket assigned successfully",
      assignee_id,
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Ticket assignment rollback failed:", rollbackError);
      }
    }

    console.error("Failed to assign ticket:", error);

    return res.status(500).json({
      message: "Failed to assign ticket",
    });
  } finally {
    client.release();
  }
};

const getAssignedTicketSummary = async (req, res) => {
  try {
    const agent_id = req.user.id;

    const result = await pool.query(
      `SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (
                    WHERE status = 'open'
                ) AS open,
                COUNT(*) FILTER (
                    WHERE status = 'in_progress'
                ) AS in_progress,
                COUNT(*) FILTER (
                    WHERE status = 'waiting_on_user'
                ) AS waiting_on_user,
                COUNT(*) FILTER (
                    WHERE status = 'resolved'
                ) AS resolved,
                COUNT(*) FILTER (
                    WHERE status = 'closed'
                ) AS closed
             FROM tickets
             WHERE assignee_id = $1`,
      [agent_id],
    );

    const row = result.rows[0];

    const slaResult = await pool.query(
      `SELECT COUNT(*) AS sla_breached
             FROM tickets
             WHERE assignee_id = $1
               AND (
                    (
                        first_responded_at IS NULL
                        AND first_response_due_at IS NOT NULL
                        AND CURRENT_TIMESTAMP > first_response_due_at
                    )
                    OR
                    (
                        resolved_at IS NULL
                        AND resolution_due_at IS NOT NULL
                        AND CURRENT_TIMESTAMP > resolution_due_at
                    )
               )`,
      [agent_id],
    );

    res.status(200).json({
      total: Number(row.total),
      open: Number(row.open),
      in_progress: Number(row.in_progress),
      waiting_on_user: Number(row.waiting_on_user),
      resolved: Number(row.resolved),
      closed: Number(row.closed),
      sla_breached: Number(slaResult.rows[0].sla_breached),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch ticket summary",
    });
  }
};

const getUnassignedTickets = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
                t.id,
                t.requester_id,
                t.assignee_id,
                t.question_id,
                t.sla_policy_id,
                t.subject,
                t.description,
                t.priority,
                t.status,
                t.created_at,
                t.updated_at,
                t.first_response_due_at,
                t.resolution_due_at,
                t.first_responded_at,
                t.resolved_at,

                requester.name AS requester_name,
                requester.email AS requester_email

             FROM tickets t

             JOIN users requester
                ON requester.id = t.requester_id

             WHERE t.assignee_id IS NULL

             ORDER BY t.created_at DESC`,
    );

    const tickets = result.rows.map((ticket) => {
      const slaStatus = calculateSLAStatus(ticket);

      return {
        ...ticket,
        sla: slaStatus,
      };
    });

    res.status(200).json({
      tickets,
      total: tickets.length,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch unassigned tickets",
    });
  }
};
const sendTicketMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const senderId = req.user.id;

    if (!message || !message.trim()) {
      return res.status(400).json({
        message: "Message is required",
      });
    }

    const ticketResult = await pool.query(
      `SELECT
                id,
                requester_id,
                assignee_id,
                status
             FROM tickets
             WHERE id = $1`,
      [id],
    );

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({
        message: "Ticket not found",
      });
    }

    const ticket = ticketResult.rows[0];

    const isRequester = String(ticket.requester_id) === String(senderId);

    const isAssignedAgent =
      ticket.assignee_id !== null &&
      String(ticket.assignee_id) === String(senderId);

    const isAdmin = req.user.role === "admin";

    if (!isRequester && !isAssignedAgent && !isAdmin) {
      return res.status(403).json({
        message: "You are not allowed to send messages on this ticket",
      });
    }

    const result = await pool.query(
      `INSERT INTO ticket_messages
     (
        ticket_id,
        sender_id,
        message
     )
     VALUES ($1, $2, $3)
     RETURNING
        id,
        ticket_id,
        sender_id,
        message,
        created_at`,
      [id, senderId, message.trim()],
    );

    const messageResult = await pool.query(
      `SELECT
        tm.id,
        tm.ticket_id,
        tm.sender_id,
        tm.message,
        tm.created_at,

        u.name AS sender_name,
        u.email AS sender_email,
        u.role AS sender_role

     FROM ticket_messages tm

     JOIN users u
        ON u.id = tm.sender_id

     WHERE tm.id = $1`,
      [result.rows[0].id],
    );

    const io = getIO();

    io.to(`ticket:${id}`).emit("new-ticket-message", messageResult.rows[0]);

    res.status(201).json({
      message: "Message sent successfully",
      ticketMessage: messageResult.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to send ticket message",
    });
  }
};
const getTicketMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const ticketResult = await pool.query(
      `SELECT
                requester_id,
                assignee_id
             FROM tickets
             WHERE id = $1`,
      [id],
    );

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({
        message: "Ticket not found",
      });
    }

    const ticket = ticketResult.rows[0];

    const isRequester = String(ticket.requester_id) === String(userId);

    const isAssignedAgent =
      ticket.assignee_id !== null &&
      String(ticket.assignee_id) === String(userId);

    const isAdmin = req.user.role === "admin";

    if (!isRequester && !isAssignedAgent && !isAdmin) {
      return res.status(403).json({
        message: "You are not allowed to view this conversation",
      });
    }

    const result = await pool.query(
      `SELECT
                tm.id,
                tm.ticket_id,
                tm.sender_id,
                tm.message,
                tm.created_at,

                u.name AS sender_name,
                u.email AS sender_email,
                u.role AS sender_role

             FROM ticket_messages tm

             JOIN users u
                ON u.id = tm.sender_id

             WHERE tm.ticket_id = $1

             ORDER BY tm.created_at ASC`,
      [id],
    );

    res.status(200).json({
      messages: result.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch ticket messages",
    });
  }
};
export {
  createTicket,
  getMyTickets,
  getTicketById,
  sendTicketMessage,
  updateTicketStatus,
  assignTicket,
  getAssignedTickets,
  getAssignedTicketById,
  getAssignedTicketSummary,
  getUnassignedTickets,
  getTicketMessages,
};

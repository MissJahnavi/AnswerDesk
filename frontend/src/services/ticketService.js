const API_BASE_URL = "http://localhost:3000/api";

const getAssignedTickets = async ({
  page = 1,
  limit = 10,
  search = "",
  status = "",
  priority = "",
} = {}) => {
  const params = new URLSearchParams();

  params.append("page", page);
  params.append("limit", limit);

  if (search) {
    params.append("search", search);
  }

  if (status) {
    params.append("status", status);
  }

  if (priority) {
    params.append("priority", priority);
  }

  const response = await fetch(
    `${API_BASE_URL}/tickets/assigned?${params.toString()}`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch tickets");
  }

  return data;
};

const getAssignedTicketById = async (id) => {
  const response = await fetch(`${API_BASE_URL}/tickets/assigned/${id}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch ticket");
  }
  return data;
};

const updateTicketStatus = async (id, status) => {
  const response = await fetch(`${API_BASE_URL}/tickets/${id}/status`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to update ticket status");
  }
  return data;
};

const assignTicket = async (id, assigneeId) => {
  const response = await fetch(`${API_BASE_URL}/tickets/${id}/assign`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ assignee_id: assigneeId }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to assign ticket");
  }

  return data;
};

const getAgents = async () => {
  const response = await fetch(`${API_BASE_URL}/users/agents`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch agents");
  }
  return data;
};
const getAssignedTicketSummary = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/tickets/assigned/summary`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch ticket summary");
    }
    return data;
  } catch (error) {
    console.error(error);
    throw new Error("Failed to fetch ticket summary");
  }
};

const getUnassignedTickets = async () => {
  const response = await fetch(`${API_BASE_URL}/tickets/unassigned`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch unassigned tickets");
  }
  return data;
};
const getTicketMessages = async (ticketId) => {
  const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/messages`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch ticket messages");
  }
  return data;
};

const sendTicketMessage = async (ticketId, message) => {
  const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/messages`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to send ticket message");
  }
  return data;
};

const getMyTickets = async () => {
  const response = await fetch(`${API_BASE_URL}/tickets`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch my tickets");
  }
  return data;
};

const getTicketById = async (id) => {
  const response = await fetch(`${API_BASE_URL}/tickets/${id}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch ticket");
  }
  return data;
};

const createTicket = async ({ subject, description, priority = "medium" }) => {
  const response = await fetch(`${API_BASE_URL}/tickets`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ subject, description, priority }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to create ticket");
  }

  return data;
};

export {
  getAssignedTickets,
  getAssignedTicketById,
  updateTicketStatus,
  assignTicket,
  getAgents,
  getAssignedTicketSummary,
  getUnassignedTickets,
  getTicketMessages,
  sendTicketMessage,
  getMyTickets,
  getTicketById,
  createTicket,
};

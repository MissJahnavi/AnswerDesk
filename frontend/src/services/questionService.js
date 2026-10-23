const API_BASE_URL = "http://localhost:3000/api";

const getQuestions = async () => {
  const response = await fetch(`${API_BASE_URL}/questions`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch questions");
  }

  return data;
};

const getQuestionById = async (id) => {
  const response = await fetch(`${API_BASE_URL}/questions/${id}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch question");
  }

  return data;
};

const createQuestion = async (title, body) => {
  const response = await fetch(`${API_BASE_URL}/questions`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      body,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to create question");
  }

  return data;
};

const createAnswer = async (questionId, body) => {
  const response = await fetch(
    `${API_BASE_URL}/questions/${questionId}/answers`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        body,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to create answer");
  }

  return data;
};

const getAnswers = async (questionId) => {
  const response = await fetch(
    `${API_BASE_URL}/questions/${questionId}/answers`,
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
    throw new Error(data.message || "Failed to fetch answers");
  }

  return data;
};

const createComment = async (questionId, body, answerId = null) => {
  const response = await fetch(
    `${API_BASE_URL}/questions/${questionId}/comments`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        body,
        answer_id: answerId,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to create comment");
  }

  return data;
};

const getComments = async (questionId) => {
  const response = await fetch(
    `${API_BASE_URL}/questions/${questionId}/comments`,
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
    throw new Error(data.message || "Failed to fetch comments");
  }

  return data;
};

const escalateQuestion = async (questionId) => {
  const response = await fetch(
    `${API_BASE_URL}/questions/${questionId}/escalate`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to escalate question");
  }

  return data;
};
const castVote = async (targetType, targetId, voteType) => {
  const response = await fetch(
    `${API_BASE_URL}/votes/${targetType}/${targetId}`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ vote_type: voteType }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to submit vote");
  }

  return data;
};

const getVoteSummary = async (targetType, targetId) => {
  const response = await fetch(
    `${API_BASE_URL}/votes/${targetType}/${targetId}`,
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
    throw new Error(data.message || "Failed to fetch vote summary");
  }

  return data;
};

const acceptAnswer = async (questionId, answerId) => {
  const response = await fetch(
    `${API_BASE_URL}/questions/${questionId}/answers/${answerId}/accept`,
    {
      method: "PATCH",
      credentials: "include",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to accept answer");
  }

  return data;
};

export {
  getQuestions,
  getQuestionById,
  createQuestion,
  castVote,
  getVoteSummary,
  createAnswer,
  getAnswers,
  createComment,
  getComments,
  escalateQuestion,
    acceptAnswer,
};

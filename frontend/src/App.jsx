import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import Questions from "./pages/Questions";
import AgentDashboard from "./pages/AgentDashboard";
import TicketDetails from "./pages/TicketDetails";
import QuestionDetails from "./pages/QuestionDetails";
import CreateQuestion from "./pages/CreateQuestion";
import MyTickets from "./pages/MyTickets";
import MyTicketDetails from "./pages/MyTicketDetails";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import Home from "./pages/Home";
import { logoutUser } from "./services/authService";
import "./App.css";

function NotFound() {
  return (
    <section className="not-found">
      <div className="not-found-code">404</div>
      <h1>We couldn't find that page</h1>
      <p>The link may be outdated, or the page may have moved.</p>
      <NavLink to="/questions" className="button button-primary">
        Back to community
      </NavLink>
    </section>
  );
}

const getStoredUser = () => {
  try {
    return JSON.parse(sessionStorage.getItem("answerdesk_user") || "null");
  } catch {
    return null;
  }
};

function RoleRoute({ user, allowedRoles, children }) {
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role))
    return <Navigate to="/questions" replace />;
  return children;
}

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getStoredUser();
  const path = location.pathname;
  const isAuthPage = path === "/login" || path === "/register";

  const context = path.startsWith("/agent/tickets/")
    ? "Ticket workspace"
    : /^\/questions\/[^/]+$/.test(path)
      ? "Community discussion"
      : /^\/tickets\/[^/]+$/.test(path)
        ? "Your support request"
        : path === "/agent"
          ? "Agent workspace"
          : path === "/tickets"
            ? "Your support requests"
            : path === "/questions/new"
              ? "Ask the community"
              : "Community";

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      sessionStorage.removeItem("answerdesk_user");
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="app-shell">
      {!isAuthPage && (
        <header className="app-topbar">
          <div className="topbar-inner">
            <NavLink
              to="/questions"
              className="brand"
              aria-label="AnswerDesk home"
            >
              <span className="brand-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M5 5.75A2.75 2.75 0 0 1 7.75 3h8.5A2.75 2.75 0 0 1 19 5.75v7.5A2.75 2.75 0 0 1 16.25 16H11l-4.5 4v-4.12A2.75 2.75 0 0 1 5 13.25v-7.5Z" />
                  <path d="M9 8h6M9 11.5h4" />
                </svg>
              </span>
              <span className="brand-copy">
                <span className="brand-name">AnswerDesk</span>
                <span className="brand-tagline">Knowledge meets support</span>
              </span>
            </NavLink>

            <nav className="primary-nav" aria-label="Main navigation">
              <NavLink
                to="/questions"
                className={({ isActive }) =>
                  `nav-link${isActive ? " active" : ""}`
                }
              >
                <span className="nav-symbol">Q</span>Community
              </NavLink>
              <NavLink
                to="/tickets"
                className={({ isActive }) =>
                  `nav-link${isActive ? " active" : ""}`
                }
              >
                <span className="nav-symbol">T</span>My tickets
              </NavLink>
              {(user?.role === "agent" || user?.role === "admin") && (
                <NavLink
                  to="/agent"
                  className={({ isActive }) =>
                    `nav-link${isActive ? " active" : ""}`
                  }
                >
                  <span className="nav-symbol">A</span>Agent workspace
                </NavLink>
              )}
            </nav>

            <div className="topbar-actions">
              <NavLink to="/questions/new" className="topbar-cta">
                <span aria-hidden="true">＋</span>Ask a question
              </NavLink>

              {user ? (
                <div className="user-profile">
                  <div className="user-profile-avatar" aria-hidden="true">
                    {(user.name || user.email || "U").charAt(0).toUpperCase()}
                  </div>

                  <div className="user-profile-info">
                    <span className="user-profile-name">
                      {user.name || "User"}
                    </span>
                    <span className="user-profile-role">
                      {(user.role || "member").replaceAll("_", " ")}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="button button-secondary logout-button"
                    onClick={handleLogout}
                  >
                    Log out
                  </button>
                </div>
              ) : (
                <NavLink to="/login" className="button button-secondary">
                  Log in
                </NavLink>
              )}
            </div>
          </div>
        </header>
      )}

      <main className={isAuthPage ? "app-main auth-main" : "app-main"}>
        {!isAuthPage && (
          <div className="page-context">
            <span className="context-dot" />
            {context}
          </div>
        )}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/agent"
            element={
              <RoleRoute user={user} allowedRoles={["agent", "admin"]}>
                <AgentDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/agent/tickets/:id"
            element={
              <RoleRoute user={user} allowedRoles={["agent", "admin"]}>
                <TicketDetails />
              </RoleRoute>
            }
          />
          <Route path="/questions" element={<Questions />} />
          <Route path="/questions/new" element={<CreateQuestion />} />
          <Route path="/questions/:id" element={<QuestionDetails />} />
          <Route path="/tickets" element={<MyTickets />} />
          <Route path="/tickets/:id" element={<MyTicketDetails />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {!isAuthPage && (
        <footer className="app-footer">
          <span>AnswerDesk</span>
          <span>Community-powered support</span>
        </footer>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

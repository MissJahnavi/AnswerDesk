
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "../services/authService";
import "./Auth.css";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await loginUser(email.trim(), password);

      // Store profile information only, never the JWT.
      sessionStorage.setItem("answerdesk_user", JSON.stringify(data.user));

      navigate(
        data.user?.role === "agent" || data.user?.role === "admin"
          ? "/agent"
          : "/questions",
        { replace: true }
      );
    } catch (err) {
      setError(err.message || "Unable to log in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link className="auth-brand" to="/questions">
          <span className="auth-brand-mark">A</span>
          <span>AnswerDesk</span>
        </Link>

        <p className="auth-eyebrow">WELCOME BACK</p>
        <h1>Sign in to your account</h1>
        <p className="auth-description">
          Continue your discussions and support requests.
        </p>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>

        <Link className="auth-back" to="/questions">
          ← Browse community
        </Link>
      </div>
    </div>
  );
}

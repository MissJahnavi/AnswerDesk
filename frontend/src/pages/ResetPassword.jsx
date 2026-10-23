
import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!token || !email) {
      setError("This reset link is incomplete. Please request a new one.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:3000/api/auth/reset-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            token,
            newPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to reset your password.");
      }

      setMessage(data.message || "Password reset successfully.");

      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1800);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="reset-password-page">
      <div className="reset-password-card">
        <div className="reset-password-icon" aria-hidden="true">
          🔐
        </div>

        <h1>Reset your password</h1>
        <p className="reset-password-description">
          Choose a new password for your AnswerDesk account.
        </p>

        <form onSubmit={handleSubmit} className="reset-password-form">
          <label htmlFor="newPassword">New password</label>
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            minLength={8}
            required
          />

          <label htmlFor="confirmPassword">Confirm new password</label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Enter your password again"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            required
          />

          {error && (
            <p className="reset-password-error" role="alert">
              {error}
            </p>
          )}

          {message && (
            <p className="reset-password-success" role="status">
              {message}
            </p>
          )}

          <button
            className="button button-primary reset-password-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? "Resetting password..." : "Reset password"}
          </button>
        </form>

        <p className="reset-password-back">
          Remembered your password? <Link to="/login">Log in</Link>
        </p>
      </div>
    </section>
  );
}

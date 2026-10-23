
import { Link } from "react-router-dom";
import {
  MessageSquare,
  Headphones,
  Search,
  Users,
  CheckCircle2,
  ArrowRight,
  Zap,
  ShieldCheck,
} from "lucide-react";
import "./Home.css";

const features = [
  {
    icon: MessageSquare,
    title: "Community Q&A",
    description:
      "Ask questions, share knowledge, vote on helpful answers, and build a searchable knowledge base.",
  },
  {
    icon: Headphones,
    title: "Smart Helpdesk",
    description:
      "Create support tickets, track their status, and keep every support request organized.",
  },
  {
    icon: Zap,
    title: "Faster Resolution",
    description:
      "Help teams prioritize requests, track service-level agreements, and resolve issues efficiently.",
  },
];

function Home() {
  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-content">
          <div className="home-eyebrow">
            <span className="home-eyebrow-dot" />
            COMMUNITY MEETS CUSTOMER SUPPORT
          </div>

          <h1>
            Questions answered.
            <br />
            <span>Problems solved.</span>
          </h1>

          <p className="home-hero-description">
            Welcome to AnswerDesk — one place to share knowledge, find
            solutions, and manage support requests without the confusion.
          </p>

          <div className="home-hero-actions">
            <Link to="/questions" className="home-button home-button-primary">
              Explore community <ArrowRight size={17} />
            </Link>

            <Link to="/register" className="home-button home-button-secondary">
              Get started
            </Link>
          </div>

          <div className="home-trust-note">
            <CheckCircle2 size={16} />
            <span>Knowledge sharing made simple</span>
          </div>
        </div>

        <div className="home-hero-visual" aria-hidden="true">
          <div className="home-visual-glow" />

          <div className="home-preview-card">
            <div className="home-preview-top">
              <div className="home-preview-icon">
                <MessageSquare size={21} />
              </div>
              <div>
                <strong>Community discussions</strong>
                <span>Find answers together</span>
              </div>
              <span className="home-preview-status">LIVE</span>
            </div>

            <div className="home-preview-question">
              <span className="home-preview-tag">QUESTION</span>
              <h3>How can I solve a recurring technical issue?</h3>
              <p>
                Explore community knowledge and learn from helpful answers.
              </p>
              <div className="home-preview-meta">
                <span><Users size={14} /> Community</span>
                <span><CheckCircle2 size={14} /> Accepted answers</span>
              </div>
            </div>

            <div className="home-preview-ticket">
              <div className="home-ticket-icon">
                <Headphones size={19} />
              </div>
              <div>
                <strong>Support tickets</strong>
                <span>Track requests in one place</span>
              </div>
              <ArrowRight size={18} />
            </div>
          </div>

          <div className="home-floating-badge">
            <ShieldCheck size={19} />
            <span>
              <strong>Organized support</strong>
              <small>One connected workspace</small>
            </span>
          </div>
        </div>
      </section>

      <section className="home-features">
        <div className="home-section-heading">
          <span className="home-section-label">WHAT YOU CAN DO</span>
          <h2>Everything you need to find solutions</h2>
          <p>
            From community discussions to structured support, AnswerDesk
            brings the experience together.
          </p>
        </div>

        <div className="home-feature-grid">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <article className="home-feature-card" key={feature.title}>
                <div className="home-feature-icon">
                  <Icon size={23} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="home-cta">
        <div>
          <span className="home-section-label">YOUR NEXT SOLUTION STARTS HERE</span>
          <h2>Have a question? Need support?</h2>
          <p>Join the conversation or explore the community's questions.</p>
        </div>

        <div className="home-cta-actions">
          <Link to="/questions" className="home-button home-button-primary">
            Browse questions <Search size={16} />
          </Link>
          <Link to="/login" className="home-cta-login">
            Already a member? Log in
          </Link>
        </div>
      </section>
    </div>
  );
}

export default Home;

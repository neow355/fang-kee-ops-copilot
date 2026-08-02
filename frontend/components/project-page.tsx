"use client";

import Link from "next/link";
import { Icon } from "./icons";
import { useI18n } from "./locale-provider";

const icons = ["shield", "file", "chart", "database"] as const;
const stack = [
  "Next.js 16",
  "React 19",
  "TypeScript",
  "FastAPI",
  "SQLAlchemy",
  "PostgreSQL",
  "pgvector",
  "Pytest",
  "Docker",
  "GitHub Actions",
];

export function ProjectPage() {
  const { dictionary: d, localePath } = useI18n();

  return (
    <>
      <header className="project-hero">
        <div>
          <p className="eyebrow">{d.project.kicker}</p>
          <h1>{d.project.title}</h1>
          <p>{d.project.intro}</p>
          <div className="project-actions">
            <Link className="button primary" href={localePath("/assistant")}>
              {d.project.primaryAction} <Icon name="arrow" size={17} />
            </Link>
            <Link className="button secondary" href={localePath("/metrics")}>
              {d.project.secondaryAction}
            </Link>
          </div>
        </div>
        <div className="project-monogram" aria-hidden="true">
          <span>FK</span>
          <small>OPS COPILOT</small>
        </div>
      </header>

      <section className="project-stats" aria-label={d.project.builtKicker}>
        {d.project.stats.map((stat) => (
          <article key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></article>
        ))}
      </section>

      <section className="project-section">
        <div className="section-heading">
          <p className="eyebrow">{d.project.builtKicker}</p>
          <h2>{d.project.builtTitle}</h2>
          <p>{d.project.builtBody}</p>
        </div>
        <div className="capability-grid">
          {d.project.capabilities.map((capability, index) => (
            <article className="capability-card" key={capability.title}>
              <span><Icon name={icons[index]} /></span>
              <h3>{capability.title}</h3>
              <p>{capability.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="project-section architecture-section">
        <div className="section-heading">
          <p className="eyebrow">{d.project.architectureKicker}</p>
          <h2>{d.project.architectureTitle}</h2>
        </div>
        <div className="architecture-flow">
          {d.project.flow.map((step, index) => (
            <div className="architecture-step" key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
              {index < d.project.flow.length - 1 && <Icon name="arrow" size={17} />}
            </div>
          ))}
        </div>
      </section>

      <section className="project-section project-details">
        <article className="card">
          <p className="eyebrow">{d.project.decisionsKicker}</p>
          <h2>{d.project.decisionsTitle}</h2>
          <ul className="decision-list">
            {d.project.decisions.map((decision) => (
              <li key={decision.title}><strong>{decision.title} — </strong>{decision.body}</li>
            ))}
          </ul>
        </article>
        <article className="card">
          <p className="eyebrow">{d.project.stackKicker}</p>
          <h2>{d.project.stackTitle}</h2>
          <div className="stack-list">
            {stack.map((item) => <span key={item}>{item}</span>)}
          </div>
          <p className="project-provenance">{d.project.provenance}</p>
        </article>
      </section>
    </>
  );
}

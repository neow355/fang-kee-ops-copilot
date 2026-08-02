"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch, displayError, extractItems, isApiConfigured } from "@/lib/api";
import { Icon } from "./icons";
import { useI18n } from "./locale-provider";

type LoadState = "loading" | "ready" | "error";
type AnyRecord = Record<string, unknown>;

interface Inquiry {
  id?: string | number;
  customer_name?: string;
  customer?: string;
  subject?: string;
  title?: string;
  channel?: string;
  priority?: string;
  status?: string;
  created_at?: string;
}

interface DocumentItem {
  id?: string | number;
  name?: string;
  filename?: string;
  status?: string;
  size?: number;
  created_at?: string;
  uploaded_at?: string;
  chunks?: number;
  chunk_count?: number;
}

interface Citation {
  id?: string | number;
  title?: string;
  document_name?: string;
  excerpt?: string;
  content?: string;
  page?: string | number;
  section_id?: string;
  score?: number;
}

interface RagResponse {
  answer?: string;
  response?: string;
  citations?: Citation[];
  sources?: Citation[];
  refused?: boolean;
  reason?: string;
}

interface Metric {
  key?: string;
  name?: string;
  label?: string;
  value?: number | string;
  unit?: string;
  trend?: number | string;
  description?: string;
}

const metricDefinitions = [
  { key: "accuracy", icon: "check" as const },
  { key: "refusal_rate", icon: "shield" as const },
  { key: "latency", icon: "clock" as const },
  { key: "cost", icon: "chart" as const },
];

function useApiData<T>(path: string, select: (payload: unknown) => T) {
  const { dictionary: d } = useI18n();
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const payload = await apiFetch<unknown>(path);
      setData(select(payload));
      setState("ready");
    } catch (reason) {
      setError(displayError(reason, d.errors));
      setState("error");
    }
  }, [d.errors, path, select]);

  useEffect(() => {
    let active = true;

    async function initialLoad() {
      try {
        const payload = await apiFetch<unknown>(path);
        if (!active) return;
        setData(select(payload));
        setState("ready");
      } catch (reason) {
        if (!active) return;
        setError(displayError(reason, d.errors));
        setState("error");
      }
    }

    void initialLoad();
    return () => {
      active = false;
    };
  }, [d.errors, path, select]);

  return { state, data, error, reload: load, setData };
}

function DataNotice({
  state,
  error,
  onRetry,
  empty,
  emptyText,
}: {
  state: LoadState;
  error: string;
  onRetry: () => void;
  empty?: boolean;
  emptyText?: string;
}) {
  const { dictionary: d } = useI18n();
  if (state === "loading") {
    return (
      <div className="state-panel" role="status" aria-live="polite">
        <span className="spinner" />
        <strong>{d.states.loadingTitle}</strong>
        <span>{d.states.loadingBody}</span>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="state-panel error-state" role="alert">
        <span className="state-icon">!</span>
        <strong>{d.states.errorTitle}</strong>
        <span>{error}</span>
        <button className="button secondary small" type="button" onClick={onRetry}>
          <Icon name="refresh" size={16} /> {d.common.retry}
        </button>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="state-panel">
        <span className="state-icon quiet">○</span>
        <strong>{d.states.emptyTitle}</strong>
        <span>{emptyText ?? d.states.emptyBody}</span>
      </div>
    );
  }
  return null;
}

function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </header>
  );
}

function formatDate(value: string | undefined, locale: string, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "zh-HK", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function text(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function localizedValue(value: unknown, locale: string) {
  if (typeof value !== "string") return value;
  const key = value.trim().toLowerCase();
  const translations: Record<string, [string, string]> = {
    "正常": ["正常", "Normal"],
    normal: ["正常", "Normal"],
    healthy: ["正常", "Healthy"],
    indexed: ["已索引", "Indexed"],
    pending: ["待處理", "Pending"],
    open: ["處理中", "Open"],
    closed: ["已完成", "Closed"],
    high: ["高", "High"],
    urgent: ["緊急", "Urgent"],
    email: ["電郵", "Email"],
    phone: ["電話", "Phone"],
  };
  const translated = translations[key];
  return translated ? translated[locale === "en" ? 1 : 0] : value;
}

function objectPayload(payload: unknown): AnyRecord {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as AnyRecord;
  }
  return {};
}

const selectObject = (payload: unknown) => objectPayload(payload);
const selectInquiries = (payload: unknown) => extractItems<Inquiry>(payload);
const selectDocuments = (payload: unknown) => extractItems<DocumentItem>(payload);
const selectMetrics = (payload: unknown) => {
  const list = extractItems<Metric>(payload);
  if (list.length) return list;
  const record = objectPayload(payload);
  return metricDefinitions.map(({ key }) => {
    const raw = record[key];
    if (raw && typeof raw === "object") {
      return { key, ...(raw as Metric) };
    }
    return { key, value: raw as number | string | undefined };
  });
};

export function DashboardPanel() {
  const { dictionary: d, localePath } = useI18n();
  const { state, data, error, reload } = useApiData(
    "/dashboard",
    selectObject,
  );
  const inquiryCount = data?.inquiry_count ?? data?.open_inquiries;
  const documentCount = data?.document_count ?? data?.indexed_documents;
  const queryCount = data?.query_count ?? data?.rag_queries;
  const serviceStatus = data?.service_status ?? data?.status;

  return (
    <>
      <PageHeading
        eyebrow={d.dashboard.kicker}
        title={d.dashboard.title}
        description={d.dashboard.description}
        actions={
          <button className="button secondary" type="button" onClick={reload}>
            <Icon name="refresh" size={17} /> {d.dashboard.refresh}
          </button>
        }
      />
      <DataNotice state={state} error={error} onRetry={reload} />
      {state === "ready" && (
        <>
          <section className="summary-grid" aria-label={d.dashboard.summaryLabel}>
            <SummaryCard
              label={d.dashboard.inquiryCount}
              value={inquiryCount}
              detail={d.dashboard.inquiryDetail}
              icon="inbox"
            />
            <SummaryCard
              label={d.dashboard.documentCount}
              value={documentCount}
              detail={d.dashboard.documentDetail}
              icon="database"
            />
            <SummaryCard
              label={d.dashboard.queryCount}
              value={queryCount}
              detail={d.dashboard.queryDetail}
              icon="spark"
            />
            <SummaryCard
              label={d.dashboard.serviceStatus}
              value={serviceStatus}
              detail={d.dashboard.serviceDetail}
              icon="shield"
            />
          </section>
          <section className="dashboard-columns">
            <article className="card">
              <div className="card-header">
                <div>
                  <p className="eyebrow">{d.dashboard.workflow}</p>
                  <h2>{d.dashboard.next}</h2>
                </div>
              </div>
              <div className="workflow-list">
                <WorkflowStep number="01" title={d.dashboard.step1} text={d.dashboard.step1Body} href={localePath("/inquiries")} />
                <WorkflowStep number="02" title={d.dashboard.step2} text={d.dashboard.step2Body} href={localePath("/documents")} />
                <WorkflowStep number="03" title={d.dashboard.step3} text={d.dashboard.step3Body} href={localePath("/assistant")} />
              </div>
            </article>
            <article className="card readiness-card">
              <div className="card-header">
                <div>
                  <p className="eyebrow">{d.dashboard.design}</p>
                  <h2>{d.dashboard.designTitle}</h2>
                </div>
                <span className="status-dot">{d.dashboard.designStatus}</span>
              </div>
              <ul className="check-list">
                <li><Icon name="check" size={17} /> {d.dashboard.check1}</li>
                <li><Icon name="check" size={17} /> {d.dashboard.check2}</li>
                <li><Icon name="check" size={17} /> {d.dashboard.check3}</li>
              </ul>
            </article>
          </section>
        </>
      )}
    </>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: unknown;
  detail: string;
  icon: "inbox" | "database" | "spark" | "shield";
}) {
  const { dictionary: d, locale } = useI18n();
  const localized = localizedValue(value, locale);
  const shown =
    typeof localized === "number" || typeof localized === "string" ? String(localized) : "—";
  return (
    <article className="summary-card">
      <div className="summary-icon"><Icon name={icon} /></div>
      <p>{label}</p>
      <strong>{shown}</strong>
      <span>{value == null ? d.common.apiMissing : detail}</span>
    </article>
  );
}

function WorkflowStep({
  number,
  title,
  text: body,
  href,
}: {
  number: string;
  title: string;
  text: string;
  href: string;
}) {
  return (
    <Link className="workflow-step" href={href}>
      <span>{number}</span>
      <div><strong>{title}</strong><p>{body}</p></div>
      <Icon name="arrow" size={17} />
    </Link>
  );
}

export function InquiriesPanel() {
  const { dictionary: d, locale } = useI18n();
  const { state, data, error, reload, setData } = useApiData(
    "/inquiries",
    selectInquiries,
  );
  const [showForm, setShowForm] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setSubmitError("");
    try {
      const created = await apiFetch<Inquiry>("/inquiries", {
        method: "POST",
        body: JSON.stringify({
          customer_name: form.get("customer_name"),
          subject: form.get("subject"),
          channel: form.get("channel"),
          priority: form.get("priority"),
          message: form.get("details"),
        }),
      });
      setData((current) => [created, ...(current ?? [])]);
      setShowForm(false);
      event.currentTarget.reset();
    } catch (reason) {
      setSubmitError(displayError(reason, d.errors));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow={d.inquiries.kicker}
        title={d.inquiries.title}
        description={d.inquiries.description}
        actions={
          <button className="button primary" type="button" onClick={() => setShowForm((value) => !value)}>
            {showForm ? d.inquiries.cancel : d.inquiries.create}
          </button>
        }
      />
      {showForm && (
        <section className="card form-card" aria-labelledby="inquiry-form-title">
          <div className="card-header">
            <div><p className="eyebrow">{d.inquiries.formKicker}</p><h2 id="inquiry-form-title">{d.inquiries.formTitle}</h2></div>
          </div>
          <form className="data-form" onSubmit={submit}>
            <div className="form-grid">
              <div className="field"><label htmlFor="customer_name">{d.inquiries.customer}</label><input id="customer_name" name="customer_name" required /></div>
              <div className="field"><label htmlFor="subject">{d.inquiries.subject}</label><input id="subject" name="subject" required /></div>
              <div className="field"><label htmlFor="channel">{d.inquiries.channel}</label><select id="channel" name="channel" defaultValue="email"><option value="email">{d.inquiries.email}</option><option value="phone">{d.inquiries.phone}</option><option value="in_person">{d.inquiries.inPerson}</option><option value="other">{d.inquiries.other}</option></select></div>
              <div className="field"><label htmlFor="priority">{d.inquiries.priority}</label><select id="priority" name="priority" defaultValue="normal"><option value="normal">{d.inquiries.normal}</option><option value="high">{d.inquiries.high}</option><option value="urgent">{d.inquiries.urgent}</option></select></div>
            </div>
            <div className="field"><label htmlFor="details">{d.inquiries.details}</label><textarea id="details" name="details" rows={4} required /></div>
            {submitError && <p className="form-error" role="alert">{submitError}</p>}
            <div className="form-actions"><button className="button primary" disabled={pending}>{pending ? d.inquiries.saving : d.inquiries.save}</button></div>
          </form>
        </section>
      )}
      <section className="card">
        <div className="card-header">
          <div><p className="eyebrow">{d.inquiries.listKicker}</p><h2>{d.inquiries.listTitle}</h2></div>
          <button className="icon-button" type="button" onClick={reload} aria-label={d.inquiries.reloadLabel}><Icon name="refresh" size={18} /></button>
        </div>
        <DataNotice state={state} error={error} onRetry={reload} empty={state === "ready" && data?.length === 0} emptyText={d.inquiries.empty} />
        {state === "ready" && data && data.length > 0 && (
          <div className="table-wrap">
            <table><thead><tr><th>{d.inquiries.customerSubject}</th><th>{d.inquiries.channel}</th><th>{d.inquiries.priority}</th><th>{d.inquiries.status}</th><th>{d.inquiries.createdAt}</th></tr></thead>
              <tbody>{data.map((item, index) => <tr key={item.id ?? index}><td><strong>{text(item.customer_name ?? item.customer, d.common.notProvided)}</strong><span>{text(item.subject ?? item.title, d.common.notProvided)}</span></td><td>{text(item.channel, d.common.notProvided)}</td><td><Status value={item.priority} /></td><td><Status value={item.status} /></td><td>{formatDate(item.created_at, locale, d.common.notProvided)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export function DocumentsPanel() {
  const { dictionary: d, locale } = useI18n();
  const { state, data, error, reload, setData } = useApiData(
    "/documents",
    selectDocuments,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) return setUploadError(d.documents.chooseError);
    const body = new FormData();
    body.append("file", file);
    setPending(true);
    setUploadError("");
    try {
      const created = await apiFetch<DocumentItem>("/documents", { method: "POST", body });
      setData((current) => [created, ...(current ?? [])]);
      if (inputRef.current) inputRef.current.value = "";
    } catch (reason) {
      setUploadError(displayError(reason, d.errors));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeading eyebrow={d.documents.kicker} title={d.documents.title} description={d.documents.description} />
      <section className="upload-card">
        <div className="upload-icon"><Icon name="upload" size={25} /></div>
        <div><h2>{d.documents.uploadTitle}</h2><p>{d.documents.uploadNote}</p></div>
        <form className="upload-form" onSubmit={upload}>
          <label className="file-picker"><span>{d.documents.choose}</span><input ref={inputRef} name="file" type="file" accept=".pdf,.doc,.docx,.txt,.md" required /></label>
          <button className="button primary" disabled={pending || !isApiConfigured()}>{pending ? d.documents.uploading : d.documents.upload}</button>
        </form>
        {uploadError && <p className="form-error full" role="alert">{uploadError}</p>}
      </section>
      <section className="card">
        <div className="card-header"><div><p className="eyebrow">{d.documents.sources}</p><h2>{d.documents.uploaded}</h2></div><button className="icon-button" type="button" onClick={reload} aria-label={d.documents.reloadLabel}><Icon name="refresh" size={18} /></button></div>
        <DataNotice state={state} error={error} onRetry={reload} empty={state === "ready" && data?.length === 0} emptyText={d.documents.empty} />
        {state === "ready" && data && data.length > 0 && (
          <div className="document-list">{data.map((doc, index) => (
            <article className="document-row" key={doc.id ?? index}>
              <div className="document-icon"><Icon name="file" /></div>
              <div className="document-main"><strong>{text(doc.name ?? doc.filename, d.common.notProvided)}</strong><span>{d.documents.uploadedAt} {formatDate(doc.uploaded_at ?? doc.created_at, locale, d.common.notProvided)}</span></div>
              <div className="document-meta"><span>{typeof (doc.chunk_count ?? doc.chunks) === "number" ? `${doc.chunk_count ?? doc.chunks} ${d.documents.chunks}` : d.documents.chunksMissing}</span><Status value={doc.status} /></div>
            </article>
          ))}</div>
        )}
      </section>
    </>
  );
}

export function AssistantPanel() {
  const { dictionary: d } = useI18n();
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<RagResponse | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setResponse(null);
    try {
      setResponse(await apiFetch<RagResponse>("/chat", {
        method: "POST",
        body: JSON.stringify({ question }),
      }));
    } catch (reason) {
      setError(displayError(reason, d.errors));
    } finally {
      setPending(false);
    }
  }

  const citations = response?.citations ?? response?.sources ?? [];
  return (
    <>
      <PageHeading eyebrow={d.assistant.kicker} title={d.assistant.title} description={d.assistant.description} />
      <section className="assistant-layout">
        <div className="assistant-main">
          <form className="ask-box" onSubmit={ask}>
            <label htmlFor="question">{d.assistant.question}</label>
            <textarea id="question" value={question} onChange={(event) => setQuestion(event.target.value)} rows={5} placeholder={d.assistant.placeholder} required />
            <div className="ask-footer"><span><Icon name="shield" size={16} /> {d.assistant.note}</span><button className="button primary" disabled={pending || !isApiConfigured()}>{pending ? d.assistant.asking : d.assistant.ask}<Icon name="spark" size={17} /></button></div>
          </form>
          {pending && <div className="state-panel"><span className="spinner" /><strong>{d.assistant.loadingTitle}</strong><span>{d.assistant.loadingBody}</span></div>}
          {error && <div className="state-panel error-state" role="alert"><span className="state-icon">!</span><strong>{d.assistant.errorTitle}</strong><span>{error}</span></div>}
          {response && (
            <article className="answer-card" aria-live="polite">
              <div className="answer-heading"><div className="answer-mark"><Icon name={response.refused ? "shield" : "spark"} /></div><div><p className="eyebrow">{response.refused ? d.assistant.refusedKicker : d.assistant.answerKicker}</p><h2>{response.refused ? d.assistant.refusedTitle : d.assistant.answerTitle}</h2></div></div>
              <div className="answer-content">{text(response.answer ?? response.response ?? response.reason, d.assistant.missingAnswer)}</div>
              <p className="answer-footnote">{d.assistant.footnote}</p>
            </article>
          )}
        </div>
        <aside className="citation-column" aria-label={d.assistant.citationsLabel}>
          <div className="citation-heading"><div><p className="eyebrow">{d.assistant.evidence}</p><h2>{d.assistant.citations}</h2></div><span>{response ? citations.length : "—"}</span></div>
          {!response && <div className="citation-empty"><Icon name="search" size={24} /><strong>{d.assistant.noQuery}</strong><p>{d.assistant.noQueryBody}</p></div>}
          {response && citations.length === 0 && <div className="citation-empty"><Icon name="file" size={24} /><strong>{d.assistant.noCitations}</strong><p>{d.assistant.noCitationsBody}</p></div>}
          {citations.map((citation, index) => (
            <article className="citation-card" key={citation.id ?? index}>
              <div className="citation-number">{String(index + 1).padStart(2, "0")}</div>
              <div><strong>{text(citation.title ?? citation.document_name, d.assistant.unnamed)}</strong><p>{text(citation.excerpt ?? citation.content, d.assistant.missingExcerpt)}</p><span>{citation.section_id ? `${d.assistant.section} ${citation.section_id}` : citation.page != null ? `${d.assistant.page} ${citation.page}` : d.assistant.positionMissing}{typeof citation.score === "number" ? ` · ${d.assistant.relevance} ${Math.round(citation.score * 100)}%` : ""}</span></div>
            </article>
          ))}
        </aside>
      </section>
    </>
  );
}

export function MetricsPanel() {
  const { dictionary: d } = useI18n();
  const { state, data, error, reload } = useApiData("/metrics", selectMetrics);
  const labels: Record<string, string> = {
    accuracy: d.metrics.accuracy,
    refusal_rate: d.metrics.refusal,
    latency: d.metrics.latency,
    cost: d.metrics.cost,
  };
  const details: Record<string, string> = {
    accuracy: d.metrics.accuracyDetail,
    refusal_rate: d.metrics.refusalDetail,
    latency: d.metrics.latencyDetail,
    cost: d.metrics.costDetail,
  };
  return (
    <>
      <PageHeading eyebrow={d.metrics.kicker} title={d.metrics.title} description={d.metrics.description} actions={<button className="button secondary" type="button" onClick={reload}><Icon name="refresh" size={17} /> {d.metrics.refresh}</button>} />
      <DataNotice state={state} error={error} onRetry={reload} />
      {state === "ready" && (
        <>
          <section className="metric-grid">
            {metricDefinitions.map((definition) => {
              const metric = data?.find((item) => item.key === definition.key || item.name === definition.key);
              return <MetricCard key={definition.key} label={labels[definition.key]} detail={details[definition.key]} icon={definition.icon} metric={metric} />;
            })}
          </section>
          <section className="card metric-note">
            <div className="note-icon"><Icon name="chart" /></div>
            <div><h2>{d.metrics.noteTitle}</h2><p>{d.metrics.noteBody}</p></div>
          </section>
        </>
      )}
    </>
  );
}

function MetricCard({ label, detail, icon, metric }: { label: string; detail: string; icon: "check" | "shield" | "clock" | "chart"; metric?: Metric }) {
  const { dictionary: d } = useI18n();
  const hasValue = metric?.value !== undefined && metric?.value !== null && metric?.value !== "";
  return (
    <article className="metric-card">
      <div className="metric-top"><span><Icon name={icon} /></span><small>{metric?.trend != null ? String(metric.trend) : d.metrics.trendMissing}</small></div>
      <p>{label}</p>
      <strong>{hasValue ? `${metric?.value}${metric?.unit ?? ""}` : "—"}</strong>
      <span>{hasValue ? detail : d.metrics.missing}</span>
    </article>
  );
}

function Status({ value }: { value?: string }) {
  const { dictionary: d, locale } = useI18n();
  return <span className="badge">{text(localizedValue(value, locale), d.common.notProvided)}</span>;
}

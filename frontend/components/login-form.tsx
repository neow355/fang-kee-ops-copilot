"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, displayError, isApiConfigured } from "@/lib/api";
import { Icon } from "./icons";
import { useI18n } from "./locale-provider";

export function LoginForm() {
  const router = useRouter();
  const { dictionary: d, localePath } = useI18n();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setPending(true);

    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      router.push(localePath("/dashboard"));
      router.refresh();
    } catch (reason) {
      setError(displayError(reason, d.errors));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      {!isApiConfigured() && (
        <div className="inline-alert warning" role="status">
          <strong>{d.login.apiTitle}</strong>
          <span>{d.login.apiBody}</span>
        </div>
      )}
      <div className="field">
        <label htmlFor="email">{d.login.email}</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={d.login.emailPlaceholder}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div className="field">
        <div className="label-row">
          <label htmlFor="password">{d.login.password}</label>
          <span>{d.login.passwordHint}</span>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder={d.login.passwordPlaceholder}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button secondary wide"
        type="button"
        onClick={() => {
          setEmail("admin@demo.example");
          setPassword("LocalDemo123!");
        }}
      >
        {d.login.fillDemo}
      </button>
      <button
        className="button primary wide"
        type="submit"
        disabled={pending || !isApiConfigured()}
      >
        {pending ? d.login.submitting : d.login.submit}
        {!pending && <Icon name="arrow" size={18} />}
      </button>
      <p className="privacy-note">
        {d.login.note}
      </p>
    </form>
  );
}

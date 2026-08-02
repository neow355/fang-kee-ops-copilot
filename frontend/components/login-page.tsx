"use client";

import Link from "next/link";
import { Icon } from "./icons";
import { LanguageSwitcher } from "./language-switcher";
import { LoginForm } from "./login-form";
import { useI18n } from "./locale-provider";

export function LoginPage() {
  const { dictionary: d, localePath } = useI18n();

  return (
    <main className="login-page">
      <section className="login-brand" aria-labelledby="brand-title">
        <div className="brand-lockup">
          <span className="brand-seal">方</span>
          <span>{d.common.brand}</span>
        </div>
        <div className="brand-copy">
          <p className="eyebrow light">{d.login.kicker}</p>
          <h1 id="brand-title">{d.login.title}</h1>
          <p>{d.login.body}</p>
        </div>
        <div className="brand-features">
          <span><Icon name="file" size={18} /> {d.login.featureSource}</span>
          <span><Icon name="shield" size={18} /> {d.login.featureReview}</span>
        </div>
        <p className="brand-caption">{d.login.caption}</p>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-toolbar">
            <div className="mobile-brand">
              <span className="brand-seal">方</span>
              <strong>{d.common.brand}</strong>
            </div>
            <LanguageSwitcher />
          </div>
          <p className="eyebrow">{d.login.panelKicker}</p>
          <h2>{d.login.panelTitle}</h2>
          <p className="login-intro">{d.login.panelIntro}</p>
          <LoginForm />
          <div className="portfolio-note">
            <Icon name="database" size={20} />
            <div>
              <strong>{d.login.aboutTitle}</strong>
              <p>{d.login.aboutBody}</p>
              <Link href={localePath("/project")}>{d.login.aboutLink} →</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

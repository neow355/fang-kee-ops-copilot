"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/components/locale-provider";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { dictionary: d, localePath } = useI18n();
  const navigation = [
    { href: "/dashboard", label: d.nav.dashboard, icon: "grid" as const },
    { href: "/inquiries", label: d.nav.inquiries, icon: "inbox" as const },
    { href: "/documents", label: d.nav.documents, icon: "file" as const },
    { href: "/assistant", label: d.nav.assistant, icon: "spark" as const },
    { href: "/metrics", label: d.nav.metrics, icon: "chart" as const },
    { href: "/project", label: d.nav.project, icon: "database" as const },
  ];

  return (
    <div className="portal-shell">
      <aside className="sidebar">
        <Link className="portal-brand" href={localePath("/dashboard")} aria-label={`${d.common.brand} ${d.common.product}`}>
          <span className="brand-seal">方</span>
          <div><strong>{d.common.brand}</strong><small>{d.common.product}</small></div>
        </Link>
        <nav className="sidebar-nav" aria-label={d.nav.label}>
          <p>{d.nav.workspace}</p>
          {navigation.map((item) => (
            <Link href={localePath(item.href)} key={item.href}>
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <LanguageSwitcher compact />
          <div className="environment-label"><span /><div><strong>{d.nav.build}</strong><small>{d.nav.buildNote}</small></div></div>
          <Link className="logout-link" href={localePath("/")}>{d.nav.backToLogin}</Link>
        </div>
      </aside>
      <div className="portal-body">
        <header className="mobile-topbar">
          <Link className="portal-brand" href={localePath("/dashboard")}><span className="brand-seal">方</span><strong>{d.common.brand}</strong></Link>
          <nav aria-label={d.nav.label}>
            {navigation.map((item) => <Link href={localePath(item.href)} key={item.href} aria-label={item.label}><Icon name={item.icon} size={19} /></Link>)}
          </nav>
        </header>
        <div className="mobile-language"><LanguageSwitcher compact /></div>
        <main className="portal-content">{children}</main>
        <footer className="portal-footer">
          <span>{d.footer.title}</span>
          <span>{d.footer.note}</span>
        </footer>
      </div>
    </div>
  );
}

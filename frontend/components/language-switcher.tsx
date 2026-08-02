"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, type Locale } from "@/lib/i18n";
import { useI18n } from "./locale-provider";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const { locale, dictionary } = useI18n();

  function pathFor(nextLocale: Locale) {
    const segments = pathname.split("/");
    if (locales.includes(segments[1] as Locale)) {
      segments[1] = nextLocale;
      return segments.join("/") || `/${nextLocale}`;
    }
    return `/${nextLocale}${pathname === "/" ? "" : pathname}`;
  }

  function remember(nextLocale: Locale) {
    document.cookie = `NEXT_LOCALE=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }

  return (
    <div className={`language-switcher${compact ? " compact" : ""}`} aria-label={dictionary.language.label}>
      <Link
        href={pathFor("zh-Hant")}
        hrefLang="zh-Hant"
        aria-current={locale === "zh-Hant" ? "page" : undefined}
        onClick={() => remember("zh-Hant")}
      >
        {dictionary.language.zh}
      </Link>
      <span aria-hidden="true">/</span>
      <Link
        href={pathFor("en")}
        hrefLang="en"
        aria-current={locale === "en" ? "page" : undefined}
        onClick={() => remember("en")}
      >
        {dictionary.language.en}
      </Link>
    </div>
  );
}

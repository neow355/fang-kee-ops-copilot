"use client";

import { createContext, useContext, useEffect } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";

type I18nValue = {
  locale: Locale;
  dictionary: Dictionary;
  localePath: (path: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function LocaleProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: React.ReactNode;
}) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <I18nContext.Provider
      value={{
        locale,
        dictionary,
        localePath: (path) => `/${locale}${path === "/" ? "" : path}`,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used within LocaleProvider");
  }
  return value;
}

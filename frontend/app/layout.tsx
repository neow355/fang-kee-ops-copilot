import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Fang Kee Ops Copilot",
    template: "%s | Fang Kee Ops Copilot",
  },
  description: "A role-aware document Q&A and operations prototype.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await headers()).get("x-locale") ?? "zh-Hant";

  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}

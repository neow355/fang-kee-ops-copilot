"use client";

import { useI18n } from "@/components/locale-provider";

export default function Loading() {
  const { dictionary: d } = useI18n();
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="spinner" />
      <strong>{d.states.pageLoading}</strong>
      <span>{d.states.pageLoadingBody}</span>
    </div>
  );
}

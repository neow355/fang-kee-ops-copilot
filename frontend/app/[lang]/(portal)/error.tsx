"use client";

import { useEffect } from "react";
import { useI18n } from "@/components/locale-provider";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const { dictionary: d } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="state-panel error-state" role="alert">
      <span className="state-icon">!</span>
      <strong>{d.states.pageError}</strong>
      <span>{d.states.pageErrorBody}</span>
      <button className="button primary small" type="button" onClick={unstable_retry}>
        {d.common.retry}
      </button>
    </div>
  );
}

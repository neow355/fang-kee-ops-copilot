"use client";

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="login-page">
          <section className="login-panel">
            <div className="login-card" role="alert">
              <p className="eyebrow">Error / 錯誤</p>
              <h1>Something went wrong</h1>
              <p className="login-intro">
                Reload the page to try again. 請重新載入頁面。
              </p>
              <button className="button primary" type="button" onClick={unstable_retry}>
                Reload / 重新載入
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}

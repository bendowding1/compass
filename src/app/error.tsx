"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="app frame" role="alert">
      <div className="head">
        <h1 className="pname">Something went wrong</h1>
      </div>
      <p style={{ color: "var(--soft)", maxWidth: "46ch" }}>
        Compass couldn&apos;t load. The data store may be temporarily unavailable.
      </p>
      <button type="button" className="btn" style={{ marginTop: 18 }} onClick={() => reset()}>
        Retry
      </button>
    </div>
  );
}

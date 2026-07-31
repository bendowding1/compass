"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="app frame" role="alert">
      <div className="head">
        <h1 className="pname">Couldn&apos;t load this project</h1>
      </div>
      <p style={{ color: "var(--soft)", maxWidth: "46ch" }}>
        The data store may be temporarily unavailable. Try again in a moment.
      </p>
      <div className="form-actions" style={{ marginTop: 18 }}>
        <button type="button" className="btn" onClick={() => reset()}>
          Retry
        </button>
        <Link href="/">Back to projects</Link>
      </div>
    </div>
  );
}

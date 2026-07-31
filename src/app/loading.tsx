/** Skeleton for the projects list while the data repo is read. */
export default function Loading() {
  return (
    <div className="app frame" aria-busy="true">
      <div className="head">
        <div className="skeleton" style={{ height: 32, width: 200, borderRadius: 8 }} />
      </div>
      <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="skeleton" style={{ height: 64, borderRadius: 11 }} />
        <div className="skeleton" style={{ height: 64, borderRadius: 11 }} />
        <div className="skeleton" style={{ height: 64, borderRadius: 11 }} />
      </div>
    </div>
  );
}

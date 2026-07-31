/** Skeleton mirroring the project page (header + milestone cards + rail) so the
 *  layout appears instantly while the data repo is read. */
export default function Loading() {
  return (
    <div className="app frame" aria-busy="true">
      <div className="head">
        <div className="skeleton" style={{ height: 32, width: 280, borderRadius: 8 }} />
      </div>
      <div style={{ marginTop: 28, display: "flex", gap: 30, alignItems: "flex-start" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 13 }}>
          <div className="skeleton" style={{ height: 150, borderRadius: 11 }} />
          <div className="skeleton" style={{ height: 150, borderRadius: 11 }} />
        </div>
        <div style={{ width: 280 }}>
          <div className="skeleton" style={{ height: 220, borderRadius: 11 }} />
        </div>
      </div>
    </div>
  );
}

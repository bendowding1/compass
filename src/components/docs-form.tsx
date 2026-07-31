"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { DocLink } from "@/lib/schema/project";

type State = { error?: string };
type Action = (prev: State, formData: FormData) => Promise<State>;
type Row = { key: string; id: string; label: string; url: string };

export function DocsForm({
  action,
  projectId,
  sha,
  docLinks,
}: {
  action: Action;
  projectId: string;
  sha: string;
  docLinks: DocLink[];
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, {});
  const [rows, setRows] = useState<Row[]>(() =>
    docLinks.length
      ? docLinks.map((d, i) => ({ key: `init-${i}`, id: d.id, label: d.label, url: d.url }))
      : [{ key: "init-0", id: "", label: "", url: "" }],
  );

  const addRow = () =>
    setRows((r) => [...r, { key: `new-${Date.now()}-${r.length}`, id: "", label: "", url: "" }]);
  const removeRow = (key: string) => setRows((r) => r.filter((x) => x.key !== key));

  return (
    <form className="form" action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="sha" value={sha} />

      <p className="form-section">Documents (link, don&apos;t upload — these point at SharePoint)</p>
      {rows.map((row) => (
        <div className="doc-row" key={row.key}>
          <input type="hidden" name="docId" defaultValue={row.id} />
          <input name="docLabel" defaultValue={row.label} placeholder="Document name" aria-label="Document name" />
          <input name="docUrl" type="url" defaultValue={row.url} placeholder="https://sharepoint…" aria-label="Document URL" />
          <button type="button" className="link-btn" onClick={() => removeRow(row.key)}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="link-btn" onClick={addRow}>
        + Add document
      </button>

      {state.error && <p className="form-error">{state.error}</p>}

      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save documents"}
        </button>
        <Link href={`/projects/${projectId}`}>Cancel</Link>
      </div>
    </form>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LifecycleStatus } from "@/lib/schema/project";

export type ProjectRow = {
  id: string;
  name: string;
  customerName: string;
  lifecycleStatus: LifecycleStatus;
};

type Filter = LifecycleStatus | "All";
const FILTERS: Filter[] = ["All", "NPD", "Sustaining", "Closed"];

/** The projects list with instant client-side search (name or customer) and a
 *  lifecycle-status filter. */
export function ProjectsBrowser({ projects }: { projects: ProjectRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Filter>("All");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects.filter((p) => {
      const matchesStatus = status === "All" || p.lifecycleStatus === status;
      const matchesQuery =
        needle === "" ||
        p.name.toLowerCase().includes(needle) ||
        p.customerName.toLowerCase().includes(needle);
      return matchesStatus && matchesQuery;
    });
  }, [projects, query, status]);

  return (
    <>
      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search projects or customers…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search projects"
        />
        <div className="filters" role="group" aria-label="Filter by lifecycle">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={status === f ? "on" : ""}
              aria-pressed={status === f}
              onClick={() => setStatus(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="seclab">
        <h2 className="sec">All projects</h2>
        <span className="sub">
          {filtered.length} of {projects.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-box">
          <p>No projects match your search.</p>
        </div>
      ) : (
        <div className="proj-list">
          {filtered.map((p) => (
            <Link className="proj-row" key={p.id} href={`/projects/${p.id}`}>
              <span className="proj-name">{p.name}</span>
              <span className="proj-meta">
                {p.customerName} · {p.lifecycleStatus}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

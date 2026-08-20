"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LifecycleStatus } from "@/lib/schema/project";

export type ProjectRow = {
  id: string;
  name: string;
  customerId: string; // "" when no customer is set yet
  customerName: string;
  lifecycleStatus: LifecycleStatus;
};

type Filter = LifecycleStatus | "All";
const FILTERS: Filter[] = ["All", "NPD", "Sustaining", "Closed"];

/** Customer-select sentinels. Real customer ids are slugs (lowercase
 *  alphanumerics and hyphens), so neither value can collide with one. */
const ALL_CUSTOMERS = "";
const NO_CUSTOMER = "__none";

/** The projects list with instant client-side search (name or customer), a
 *  customer filter, and a lifecycle-status filter — all combined with AND. */
export function ProjectsBrowser({ projects }: { projects: ProjectRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Filter>("All");
  const [customer, setCustomer] = useState<string>(ALL_CUSTOMERS);

  // Only customers that actually have a project, alphabetized; a trailing
  // "No customer" bucket appears when any project is still unassigned.
  const customerOptions = useMemo(() => {
    const byId = new Map<string, string>();
    let hasUnassigned = false;
    for (const p of projects) {
      if (p.customerId === "") hasUnassigned = true;
      else byId.set(p.customerId, p.customerName);
    }
    const opts = [...byId]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    if (hasUnassigned) opts.push({ id: NO_CUSTOMER, name: "No customer" });
    return opts;
  }, [projects]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects.filter((p) => {
      const matchesStatus = status === "All" || p.lifecycleStatus === status;
      const matchesCustomer =
        customer === ALL_CUSTOMERS ||
        (customer === NO_CUSTOMER ? p.customerId === "" : p.customerId === customer);
      const matchesQuery =
        needle === "" ||
        p.name.toLowerCase().includes(needle) ||
        p.customerName.toLowerCase().includes(needle);
      return matchesStatus && matchesCustomer && matchesQuery;
    });
  }, [projects, query, status, customer]);

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
        <select
          className="select"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          aria-label="Filter by customer"
        >
          <option value={ALL_CUSTOMERS}>All customers</option>
          {customerOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
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
          <p>No projects match your filters.</p>
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

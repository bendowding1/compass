import Link from "next/link";
import { listProjects } from "@/lib/git/projects";
import { readCustomers } from "@/lib/git/customers";
import { TopBar } from "@/components/top-bar";
import { ProjectsBrowser, type ProjectRow } from "@/components/projects-browser";

// v1: always read fresh from the data repo (no static prerender).
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [projects, customers] = await Promise.all([listProjects(), readCustomers()]);
  const nameOf = (id: string) => customers.find((c) => c.id === id)?.name ?? "No customer";

  const rows: ProjectRow[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    customerName: nameOf(p.customerId),
    lifecycleStatus: p.lifecycleStatus,
  }));

  return (
    <div className="app frame">
      <TopBar />
      <div className="head head-row">
        <h1 className="pname">Projects</h1>
        <Link className="btn" href="/projects/new">
          + New project
        </Link>
      </div>
      <ProjectsBrowser projects={rows} />
    </div>
  );
}

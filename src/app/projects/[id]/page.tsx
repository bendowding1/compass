import { notFound } from "next/navigation";
import { getProject } from "@/lib/git/projects";
import { readCustomers } from "@/lib/git/customers";
import { ProjectView } from "@/components/project-view";
import { EmptyState } from "@/components/empty-state";

// v1: always read fresh from the data repo (no static prerender).
export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params; // Next 16: params is async
  const result = await getProject(id);
  if (!result) notFound();

  const customers = await readCustomers();
  const customerName =
    customers.find((c) => c.id === result.project.customerId)?.name ?? "";
  const now = new Date();

  if (result.project.milestones.length === 0) {
    return <EmptyState project={result.project} customerName={customerName} />;
  }
  return <ProjectView project={result.project} customerName={customerName} now={now} />;
}

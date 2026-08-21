import { notFound } from "next/navigation";
import { getProject } from "@/lib/git/projects";
import { readCustomers } from "@/lib/git/customers";
import { TopBar } from "@/components/top-bar";
import { EditProjectForm } from "./edit-project-form";
import { DeleteProjectSection } from "./delete-project-section";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [result, customers] = await Promise.all([getProject(id), readCustomers()]);
  if (!result) notFound();

  return (
    <div className="app frame">
      <TopBar crumb={`${result.project.name} / Edit`} />
      <div className="head">
        <h1 className="pname">Edit project</h1>
      </div>
      <EditProjectForm project={result.project} customers={customers} sha={result.sha} />
      <DeleteProjectSection projectId={result.project.id} projectName={result.project.name} />
    </div>
  );
}

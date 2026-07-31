import { notFound } from "next/navigation";
import { getProject } from "@/lib/git/projects";
import { TopBar } from "@/components/top-bar";
import { ResponsibleForm } from "../responsible-form";

export const dynamic = "force-dynamic";

export default async function EditResponsiblePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getProject(id);
  if (!result) notFound();

  return (
    <div className="app frame">
      <TopBar crumb={`${result.project.name} / Responsible`} />
      <div className="head">
        <h1 className="pname">Responsible</h1>
      </div>
      <ResponsibleForm projectId={id} sha={result.sha} roles={result.project.roles} />
    </div>
  );
}

import { notFound } from "next/navigation";
import { getProject } from "@/lib/git/projects";
import { TopBar } from "@/components/top-bar";
import { MilestoneForm } from "@/components/milestone-form";
import { addMilestone } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewMilestonePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getProject(id);
  if (!result) notFound();

  return (
    <div className="app frame">
      <TopBar crumb={`${result.project.name} / New milestone`} />
      <div className="head">
        <h1 className="pname">New milestone</h1>
      </div>
      <MilestoneForm action={addMilestone} projectId={id} sha={result.sha} submitLabel="Add milestone" />
    </div>
  );
}

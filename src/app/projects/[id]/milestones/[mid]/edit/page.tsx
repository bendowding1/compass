import { notFound } from "next/navigation";
import { getProject } from "@/lib/git/projects";
import { TopBar } from "@/components/top-bar";
import { MilestoneForm } from "@/components/milestone-form";
import { updateMilestone } from "../../actions";
import { DeleteMilestoneButton } from "./delete-milestone-button";

export const dynamic = "force-dynamic";

export default async function EditMilestonePage({
  params,
}: {
  params: Promise<{ id: string; mid: string }>;
}) {
  const { id, mid } = await params;
  const result = await getProject(id);
  if (!result) notFound();

  const milestone = result.project.milestones.find((m) => m.id === mid);
  if (!milestone) notFound();

  return (
    <div className="app frame">
      <TopBar crumb={`${result.project.name} / Edit milestone`} />
      <div className="head">
        <h1 className="pname">Edit milestone</h1>
      </div>
      <MilestoneForm
        action={updateMilestone}
        projectId={id}
        sha={result.sha}
        milestone={milestone}
        submitLabel="Save milestone"
      />
      <DeleteMilestoneButton projectId={id} milestoneId={milestone.id} sha={result.sha} />
    </div>
  );
}

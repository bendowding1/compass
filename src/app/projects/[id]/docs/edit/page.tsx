import { notFound } from "next/navigation";
import { getProject } from "@/lib/git/projects";
import { TopBar } from "@/components/top-bar";
import { DocsForm } from "@/components/docs-form";
import { updateDocs } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditDocsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getProject(id);
  if (!result) notFound();

  return (
    <div className="app frame">
      <TopBar crumb={`${result.project.name} / Project docs`} />
      <div className="head">
        <h1 className="pname">Project docs</h1>
      </div>
      <DocsForm
        action={updateDocs}
        projectId={id}
        sha={result.sha}
        docLinks={result.project.docLinks}
      />
    </div>
  );
}

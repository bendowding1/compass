import { readCustomers } from "@/lib/git/customers";
import { TopBar } from "@/components/top-bar";
import { NewProjectForm } from "./new-project-form";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const customers = await readCustomers();
  return (
    <div className="app frame">
      <TopBar crumb="New project" />
      <div className="head">
        <h1 className="pname">New project</h1>
      </div>
      <NewProjectForm customers={customers} />
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { updateProject, type UpdateState } from "./actions";
import type { Project, Customer } from "@/lib/schema/project";

export function EditProjectForm({
  project,
  customers,
  sha,
}: {
  project: Project;
  customers: Customer[];
  sha: string;
}) {
  const [state, action, pending] = useActionState<UpdateState, FormData>(updateProject, {});
  const [addingCustomer, setAddingCustomer] = useState(false);

  return (
    <form className="form" action={action}>
      <input type="hidden" name="id" value={project.id} />
      <input type="hidden" name="sha" value={sha} />

      <div className="field">
        <label htmlFor="name">Project name</label>
        <input id="name" name="name" type="text" required defaultValue={project.name} />
      </div>

      <div className="field">
        <label htmlFor={addingCustomer ? "newCustomerName" : "customerId"}>Customer</label>
        {addingCustomer ? (
          <>
            <input id="newCustomerName" name="newCustomerName" type="text" placeholder="New customer name" />
            <button type="button" className="link-btn" onClick={() => setAddingCustomer(false)}>
              Choose an existing customer instead
            </button>
          </>
        ) : (
          <>
            <select id="customerId" name="customerId" defaultValue={project.customerId}>
              <option value="">Select later</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="button" className="link-btn" onClick={() => setAddingCustomer(true)}>
              + New customer
            </button>
          </>
        )}
      </div>

      <div className="field">
        <label htmlFor="lifecycleStatus">Lifecycle</label>
        <select id="lifecycleStatus" name="lifecycleStatus" defaultValue={project.lifecycleStatus}>
          <option value="NPD">NPD</option>
          <option value="Sustaining">Sustaining</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      {state.error && <p className="form-error">{state.error}</p>}

      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <Link href={`/projects/${project.id}`}>Cancel</Link>
      </div>
    </form>
  );
}

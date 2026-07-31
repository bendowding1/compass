"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createProject, type CreateState } from "./actions";
import type { Customer } from "@/lib/schema/project";

export function NewProjectForm({ customers }: { customers: Customer[] }) {
  const [state, action, pending] = useActionState<CreateState, FormData>(createProject, {});
  const [addingCustomer, setAddingCustomer] = useState(false);

  return (
    <form className="form" action={action}>
      <div className="field">
        <label htmlFor="name">Project name</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="e.g. Apollo Field Unit v2"
          autoFocus
        />
      </div>

      <div className="field">
        <label htmlFor={addingCustomer ? "newCustomerName" : "customerId"}>Customer</label>
        {addingCustomer ? (
          <>
            <input
              id="newCustomerName"
              name="newCustomerName"
              type="text"
              placeholder="New customer name"
            />
            <button type="button" className="link-btn" onClick={() => setAddingCustomer(false)}>
              Choose an existing customer instead
            </button>
          </>
        ) : (
          <>
            <select id="customerId" name="customerId" defaultValue="">
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
        <select id="lifecycleStatus" name="lifecycleStatus" defaultValue="NPD">
          <option value="NPD">NPD</option>
          <option value="Sustaining">Sustaining</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      {state.error && <p className="form-error">{state.error}</p>}

      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create project"}
        </button>
        <Link href="/">Cancel</Link>
      </div>
    </form>
  );
}

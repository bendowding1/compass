"use client";

import { useActionState, useState } from "react";
import { renameCustomer, deleteCustomer, type CustomerActionState } from "./actions";
import type { Customer } from "@/lib/schema/project";

/** One manageable customer: inline rename (armed only when the name changed)
 *  and delete — which, when projects reference the customer, requires picking
 *  where those projects move first. */
export function CustomerRow({
  customer,
  projectCount,
  others,
}: {
  customer: Customer;
  projectCount: number;
  others: Customer[];
}) {
  const [renameState, renameAction, renamePending] = useActionState<CustomerActionState, FormData>(
    renameCustomer,
    {},
  );
  const [deleteState, deleteAction, deletePending] = useActionState<CustomerActionState, FormData>(
    deleteCustomer,
    {},
  );
  const [name, setName] = useState(customer.name);
  const changed = name.trim() !== "" && name.trim() !== customer.name;

  const confirmText =
    projectCount === 0
      ? `Delete ${customer.name}?`
      : `Delete ${customer.name}? Its ${projectCount} project${projectCount === 1 ? "" : "s"} will move to the customer you selected.`;

  return (
    <div className="cust-row">
      <form className="cust-rename" action={renameAction}>
        <input type="hidden" name="id" value={customer.id} />
        <input
          name="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={`Name of ${customer.name}`}
        />
        <button className="btn-sm" type="submit" disabled={!changed || renamePending}>
          {renamePending ? "Renaming…" : "Rename"}
        </button>
      </form>

      <span className="cust-count">
        {projectCount === 0
          ? "no projects"
          : `${projectCount} project${projectCount === 1 ? "" : "s"}`}
      </span>

      <form className="cust-delete" action={deleteAction}>
        <input type="hidden" name="id" value={customer.id} />
        {projectCount > 0 && (
          <select name="moveTo" defaultValue="" aria-label={`Move ${customer.name} projects to`}>
            <option value="">No customer</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
        <button
          className="btn-danger"
          type="submit"
          disabled={deletePending}
          onClick={(e) => {
            if (!confirm(confirmText)) e.preventDefault();
          }}
        >
          {deletePending ? "Deleting…" : projectCount > 0 ? "Move & delete" : "Delete"}
        </button>
      </form>

      {(renameState.error || deleteState.error) && (
        <p className="form-error">{renameState.error ?? deleteState.error}</p>
      )}
    </div>
  );
}

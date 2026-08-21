import { readCustomers } from "@/lib/git/customers";
import { listAllProjects } from "@/lib/git/projects";
import { TopBar } from "@/components/top-bar";
import { CustomerRow } from "./customer-row";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const [customers, projects] = await Promise.all([readCustomers(), listAllProjects()]);
  const counts = new Map<string, number>();
  for (const p of projects) counts.set(p.customerId, (counts.get(p.customerId) ?? 0) + 1);

  const sorted = [...customers].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  return (
    <div className="app frame">
      <TopBar crumb="Customers" />
      <div className="head">
        <h1 className="pname">Customers</h1>
      </div>
      <p className="page-note">
        Renaming fixes the name everywhere at once. Deleting a customer with projects moves them to
        the customer you pick first, so nothing is left pointing at it. New customers are added from
        the project forms.
      </p>

      {sorted.length === 0 ? (
        <div className="empty-box">
          <p>No customers yet — add one from the new-project form.</p>
        </div>
      ) : (
        <div className="cust-list">
          {sorted.map((c) => (
            <CustomerRow
              key={c.id}
              customer={c}
              projectCount={counts.get(c.id) ?? 0}
              others={sorted.filter((o) => o.id !== c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

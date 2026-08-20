import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProjectsBrowser, type ProjectRow } from "@/components/projects-browser";

// next/link renders an anchor; mock it so the test needs no router context.
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}));

const rows: ProjectRow[] = [
  { id: "p-aaaa2222", name: "Acme Telemetry", customerId: "acme-industrial", customerName: "Acme Industrial", lifecycleStatus: "NPD" },
  { id: "p-bbbb2222", name: "Acme Dashboard", customerId: "acme-industrial", customerName: "Acme Industrial", lifecycleStatus: "Sustaining" },
  { id: "p-cccc2222", name: "Northwind Sensors", customerId: "northwind-traders", customerName: "Northwind Traders", lifecycleStatus: "Sustaining" },
  { id: "p-dddd2222", name: "Greenfield Pilot", customerId: "", customerName: "No customer", lifecycleStatus: "NPD" },
];

function selectCustomer(optionName: string | RegExp) {
  const option = screen.getByRole("option", { name: optionName }) as HTMLOptionElement;
  fireEvent.change(screen.getByRole("combobox", { name: /filter by customer/i }), {
    target: { value: option.value },
  });
}

describe("ProjectsBrowser", () => {
  it("lists all projects initially", () => {
    render(<ProjectsBrowser projects={rows} />);
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  it("searches by name or customer, case-insensitive", () => {
    render(<ProjectsBrowser projects={rows} />);
    fireEvent.change(screen.getByRole("searchbox", { name: /search projects/i }), {
      target: { value: "north" },
    });
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("Northwind Sensors");
  });

  it("filters by lifecycle status", () => {
    render(<ProjectsBrowser projects={rows} />);
    fireEvent.click(screen.getByRole("button", { name: "NPD" }));
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent("Acme Telemetry");
    expect(links[1]).toHaveTextContent("Greenfield Pilot");
  });

  it("offers each customer once, alphabetized, with a No-customer bucket last", () => {
    render(<ProjectsBrowser projects={rows} />);
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["All customers", "Acme Industrial", "Northwind Traders", "No customer"]);
  });

  it("filters by customer", () => {
    render(<ProjectsBrowser projects={rows} />);
    selectCustomer("Acme Industrial");
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent("Acme Telemetry");
    expect(links[1]).toHaveTextContent("Acme Dashboard");
  });

  it("filters to projects with no customer", () => {
    render(<ProjectsBrowser projects={rows} />);
    selectCustomer("No customer");
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("Greenfield Pilot");
  });

  it("combines customer and status filters", () => {
    render(<ProjectsBrowser projects={rows} />);
    selectCustomer("Acme Industrial");
    fireEvent.click(screen.getByRole("button", { name: "Sustaining" }));
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("Acme Dashboard");
  });

  it("combines search and status filter", () => {
    render(<ProjectsBrowser projects={rows} />);
    fireEvent.click(screen.getByRole("button", { name: "NPD" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "green" } });
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("Greenfield Pilot");
  });

  it("shows an empty message when nothing matches", () => {
    render(<ProjectsBrowser projects={rows} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText(/no projects match/i)).toBeInTheDocument();
  });
});

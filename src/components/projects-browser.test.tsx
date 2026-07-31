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
  { id: "a", name: "Acme Telemetry", customerName: "Acme Industrial", lifecycleStatus: "NPD" },
  { id: "b", name: "Northwind Sensors", customerName: "Northwind Traders", lifecycleStatus: "Sustaining" },
  { id: "c", name: "Greenfield Pilot", customerName: "No customer", lifecycleStatus: "NPD" },
];

describe("ProjectsBrowser", () => {
  it("lists all projects initially", () => {
    render(<ProjectsBrowser projects={rows} />);
    expect(screen.getAllByRole("link")).toHaveLength(3);
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
    fireEvent.click(screen.getByRole("button", { name: "Sustaining" }));
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("Northwind Sensors");
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

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/empty-state";
import { newProject } from "@/lib/schema/project";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}));

const project = newProject("greenfield", "Greenfield Pilot", {
  by: "Sam",
  at: "2026-06-27T00:00:00.000Z",
});

describe("EmptyState (the adoption screen)", () => {
  it("shows the create-first-milestone action and the rule", () => {
    render(<EmptyState project={project} />);
    expect(
      screen.getByRole("link", { name: /create the first milestone/i }),
    ).toHaveAttribute("href", expect.stringContaining("/milestones/new"));
    expect(screen.getByText(/nothing happens outside a milestone/i)).toBeInTheDocument();
  });

  it("prompts to select a customer when none is set", () => {
    render(<EmptyState project={project} />);
    expect(screen.getByText(/select customer/i)).toBeInTheDocument();
  });

  it("shows the five fixed roles, all as 'Assign' when unassigned", () => {
    render(<EmptyState project={project} />);
    expect(screen.getAllByText(/assign/i)).toHaveLength(5);
  });
});

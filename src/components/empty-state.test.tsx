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

  it("shows saved doc links even before the first milestone exists", () => {
    const withDocs = {
      ...project,
      docLinks: [
        { id: "brief", label: "Project brief", url: "https://example.sharepoint.com/brief" },
        { id: "spec", label: "Firmware spec", url: "https://example.sharepoint.com/spec" },
      ],
    };
    render(<EmptyState project={withDocs} />);

    expect(screen.getByRole("link", { name: "Project brief" })).toHaveAttribute(
      "href",
      "https://example.sharepoint.com/brief",
    );
    expect(screen.getByRole("link", { name: "Firmware spec" })).toBeInTheDocument();

    // once docs exist, the adoption CTA gives way to a plain Edit link
    expect(screen.queryByRole("link", { name: /link a document/i })).not.toBeInTheDocument();
    const editLinks = screen.getAllByRole("link", { name: "Edit" });
    expect(editLinks.map((l) => l.getAttribute("href"))).toContain("/projects/greenfield/docs/edit");
  });
});

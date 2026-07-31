import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectView } from "@/components/project-view";
import type { Project } from "@/lib/schema/project";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}));

const NOW = new Date("2026-06-16T12:00:00.000Z");

function project(): Project {
  return {
    schemaVersion: 1,
    id: "p1",
    name: "Acme Telemetry",
    customerId: "cust-acme",
    lifecycleStatus: "NPD",
    roles: { PM: "Sam", Development: "Dev", Test: "Tess", Deploy: "Dan", CustomerCare: "Cara" },
    milestones: [
      {
        id: "m1",
        name: "Release 1.0",
        targetDate: "2026-06-01", // 15 days before NOW -> late 2w
        releaseUrl: "https://sharepoint.example.com/acme/release-1.0.zip",
        steps: {
          Requirements: { status: "done" },
          Build: { status: "done" },
          Test: { status: "current" },
          Deploy: { status: "upcoming" },
        },
        updatedBy: "Sam",
        updatedAt: "2026-06-20T10:00:00.000Z",
      },
    ],
    docLinks: [{ id: "d1", label: "Spec", url: "https://sharepoint.example.com/spec" }],
    archived: false,
    updatedBy: "Sam",
    updatedAt: "2026-06-20T10:00:00.000Z",
  };
}

describe("ProjectView", () => {
  it("renders the customer, milestone, a role person, and a doc link", () => {
    render(<ProjectView project={project()} customerName="Acme Industrial" now={NOW} />);
    expect(screen.getByText("Acme Industrial")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /release 1\.0/i })).toBeInTheDocument();
    expect(screen.getByText("Sam")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /spec/i })).toHaveAttribute(
      "href",
      "https://sharepoint.example.com/spec",
    );
  });

  it("shows the derived slip badge on a late milestone", () => {
    render(<ProjectView project={project()} customerName="Acme" now={NOW} />);
    expect(screen.getByText(/late 2w/i)).toBeInTheDocument();
  });

  it("links to the release package on a milestone", () => {
    render(<ProjectView project={project()} customerName="Acme" now={NOW} />);
    expect(screen.getByRole("link", { name: /release package/i })).toHaveAttribute(
      "href",
      "https://sharepoint.example.com/acme/release-1.0.zip",
    );
  });

  it("shows a Today marker on the timeline", () => {
    render(<ProjectView project={project()} customerName="Acme" now={NOW} />);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("orders the timeline chronologically with Today between past and future", () => {
    const base = project();
    const proj: Project = {
      ...base,
      milestones: [
        {
          ...base.milestones[0],
          id: "future",
          name: "Future Release",
          targetDate: "2026-12-01",
          actualDate: undefined,
          releaseUrl: undefined,
          steps: {
            Requirements: { status: "upcoming" },
            Build: { status: "upcoming" },
            Test: { status: "upcoming" },
            Deploy: { status: "upcoming" },
          },
        },
        {
          ...base.milestones[0],
          id: "past",
          name: "Past Release",
          targetDate: "2026-01-01",
          actualDate: "2026-01-05",
          releaseUrl: undefined,
          steps: {
            Requirements: { status: "done" },
            Build: { status: "done" },
            Test: { status: "done" },
            Deploy: { status: "done" },
          },
        },
      ],
    };
    render(<ProjectView project={proj} customerName="Acme" now={NOW} />); // NOW = 2026-06-16
    const past = screen.getByText("Past Release");
    const today = screen.getByText("Today");
    const future = screen.getByText("Future Release");
    // DOM order should read Past Release -> Today -> Future Release.
    expect(past.compareDocumentPosition(today) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(today.compareDocumentPosition(future) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

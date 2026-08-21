import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeleteProjectSection } from "./delete-project-section";

vi.mock("./actions", () => ({ deleteProject: vi.fn() }));

describe("DeleteProjectSection", () => {
  it("keeps the delete button disabled until the exact project name is typed", () => {
    render(<DeleteProjectSection projectId="p-abc23456" projectName="Bike" />);
    const button = screen.getByRole("button", { name: /delete project/i });
    const input = screen.getByRole("textbox", { name: /type the project name/i });

    expect(button).toBeDisabled();

    fireEvent.change(input, { target: { value: "Bik" } });
    expect(button).toBeDisabled();

    fireEvent.change(input, { target: { value: " Bike " } }); // trimmed match arms it
    expect(button).toBeEnabled();
  });
});

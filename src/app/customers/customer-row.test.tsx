import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CustomerRow } from "./customer-row";

vi.mock("./actions", () => ({ renameCustomer: vi.fn(), deleteCustomer: vi.fn() }));

const acme = { id: "acme", name: "Acme Industral" };
const others = [{ id: "northwind", name: "Northwind Traders" }];

describe("CustomerRow", () => {
  it("arms Rename only once the name actually changed", () => {
    render(<CustomerRow customer={acme} projectCount={2} others={others} />);
    const rename = screen.getByRole("button", { name: "Rename" });
    expect(rename).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox", { name: /name of/i }), {
      target: { value: "Acme Industrial" },
    });
    expect(rename).toBeEnabled();
  });

  it("requires picking a move target when projects reference the customer", () => {
    render(<CustomerRow customer={acme} projectCount={2} others={others} />);
    expect(screen.getByRole("combobox", { name: /move .* projects to/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /move & delete/i })).toBeInTheDocument();
    expect(screen.getByText("2 projects")).toBeInTheDocument();
  });

  it("offers a plain delete when no projects reference the customer", () => {
    render(<CustomerRow customer={acme} projectCount={0} others={others} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByText("no projects")).toBeInTheDocument();
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeToggle } from "@/components/theme-toggle";

// jsdom has no matchMedia, so with no explicit theme the effective theme
// resolves to light (the component's ?? false fallback).
beforeEach(() => {
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});

describe("ThemeToggle", () => {
  it("pins the opposite of the effective theme and persists it", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: /light and dark/i });

    fireEvent.click(button); // effective light -> pin dark
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("compass-theme")).toBe("dark");

    fireEvent.click(button); // now explicitly dark -> pin light
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("compass-theme")).toBe("light");
  });

  it("flips an explicit dark theme back to light", () => {
    document.documentElement.dataset.theme = "dark";
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: /light and dark/i }));
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

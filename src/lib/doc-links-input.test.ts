import { describe, it, expect } from "vitest";
import { docLinksFromForm } from "@/lib/doc-links-input";

function fd(rows: { id?: string; label?: string; url?: string }[]): FormData {
  const f = new FormData();
  for (const r of rows) {
    f.append("docId", r.id ?? "");
    f.append("docLabel", r.label ?? "");
    f.append("docUrl", r.url ?? "");
  }
  return f;
}

describe("docLinksFromForm", () => {
  it("keeps filled rows, skips empty rows, preserves existing ids, slugs new ones", () => {
    const out = docLinksFromForm(
      fd([
        { id: "d-1", label: "Spec", url: "https://sp.example.com/spec" },
        { id: "", label: "", url: "" },
        { id: "", label: "Test plan", url: "https://sp.example.com/test" },
      ]),
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ id: "d-1", label: "Spec", url: "https://sp.example.com/spec" });
    expect(out[1]).toEqual({ id: "test-plan", label: "Test plan", url: "https://sp.example.com/test" });
  });

  it("throws when a row has a label but no/invalid URL", () => {
    expect(() => docLinksFromForm(fd([{ label: "Spec", url: "not-a-url" }]))).toThrow();
    expect(() => docLinksFromForm(fd([{ label: "Spec", url: "" }]))).toThrow();
  });

  it("de-duplicates generated ids", () => {
    const out = docLinksFromForm(
      fd([
        { label: "Doc", url: "https://a.example.com" },
        { label: "Doc", url: "https://b.example.com" },
      ]),
    );
    expect(out.map((d) => d.id)).toEqual(["doc", "doc-2"]);
  });
});

import { DocLinkSchema, type DocLink } from "@/lib/schema/project";
import { slugify } from "@/lib/format";

/**
 * Build the docLinks array from a submitted docs form. Rows arrive as parallel
 * arrays (docId / docLabel / docUrl via FormData.getAll). Fully-empty rows are
 * dropped; partial/invalid rows throw (each link needs a label and a valid URL).
 * Existing ids are preserved; new rows get a slug id, de-duplicated. Pure — no I/O.
 */
export function docLinksFromForm(formData: FormData): DocLink[] {
  const ids = formData.getAll("docId").map((v) => String(v).trim());
  const labels = formData.getAll("docLabel").map((v) => String(v).trim());
  const urls = formData.getAll("docUrl").map((v) => String(v).trim());

  const used = new Set<string>();
  const out: DocLink[] = [];
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i] ?? "";
    const url = urls[i] ?? "";
    if (!label && !url) continue; // empty row

    const base = ids[i] || slugify(label) || "doc";
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);

    out.push(DocLinkSchema.parse({ id, label, url })); // validates label + URL
  }
  return out;
}

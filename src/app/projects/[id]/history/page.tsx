import { notFound } from "next/navigation";
import { getProject, getProjectHistory } from "@/lib/git/projects";
import { TopBar } from "@/components/top-bar";
import { longDate, relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function action(message: string): string {
  if (message.startsWith("update ")) return "Updated";
  if (message.startsWith("seed")) return "Created (seed import)";
  if (message.startsWith("cleanup")) return "Cleanup";
  return message;
}

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [result, history] = await Promise.all([getProject(id), getProjectHistory(id)]);
  if (!result) notFound();

  return (
    <div className="app frame">
      <TopBar crumb={`${result.project.name} / History`} />
      <div className="head">
        <h1 className="pname">Change history</h1>
      </div>
      <p style={{ color: "var(--faint)", fontSize: 13, margin: "0 0 18px" }}>
        {result.project.name} — every change is a commit in the data repo.
      </p>

      {history.length === 0 ? (
        <div className="empty-box">
          <p>No history yet.</p>
        </div>
      ) : (
        <ol className="history">
          {history.map((h) => (
            <li className="hist-row" key={h.sha}>
              <span className="hist-action">{action(h.message)}</span>
              <span className="hist-who">{h.author}</span>
              <span className="hist-when" title={longDate(h.date)}>
                {relativeTime(h.date)}
              </span>
              <span className="hist-sha">{h.sha.slice(0, 7)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

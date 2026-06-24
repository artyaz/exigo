"use client";
/* Playground collection: every exercise you've commented on, with its comment,
   source/context, the exercise code, an on-demand render, and export (download
   all as JSON, or copy one). */
import React from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { EmbedExercise } from "../../_components/exercises/embed";

interface CommentRow {
  _id: Id<"exerciseComments">;
  comment: string;
  html: string;
  source: string;
  context?: string;
  mechanic?: string;
  createdAt: number;
}

export default function CollectionPage(): React.JSX.Element {
  const { userId } = useAuth();
  const rows = useQuery(api.exerciseComments.listForUser, userId ? { userId } : "skip") as CommentRow[] | undefined;
  const remove = useMutation(api.exerciseComments.remove);

  React.useEffect(() => {
    if (document.getElementById("exg-coll-styles")) return;
    const s = document.createElement("style");
    s.id = "exg-coll-styles";
    s.textContent = CSS;
    document.head.appendChild(s);
    return () => document.getElementById("exg-coll-styles")?.remove();
  }, []);

  const exportAll = (): void => {
    if (!rows?.length) return;
    const payload = rows.map((r) => ({
      comment: r.comment,
      source: r.source,
      context: r.context ?? null,
      mechanic: r.mechanic ?? null,
      html: r.html,
      createdAt: new Date(r.createdAt).toISOString(),
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `exigo-commented-exercises-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="coll">
      <div className="coll__head">
        <span className="coll__title">Collection</span>
        <span className="coll__sub">commented exercises</span>
        <span className="coll__count">{rows?.length ?? 0}</span>
        <button className="coll__btn" type="button" onClick={exportAll} disabled={!rows?.length}>
          Export all (JSON)
        </button>
      </div>

      {!userId ? (
        <div className="coll__hint">Sign in to see your collection.</div>
      ) : rows === undefined ? (
        <div className="coll__hint">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="coll__hint">No comments yet. Right-click an exercise (or use its 💬 chip) to leave one.</div>
      ) : (
        <div className="coll__list">
          {rows.map((r) => (
            <Card key={r._id} row={r} onDelete={() => userId && void remove({ userId, id: r._id })} />
          ))}
        </div>
      )}
    </div>
  );
}

function Card({ row, onDelete }: { row: CommentRow; onDelete: () => void }): React.JSX.Element {
  const [render, setRender] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(row.html);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className="coll__card">
      <div className="coll__cmt">{row.comment}</div>
      <div className="coll__meta">
        <span className="coll__pill">{row.source}</span>
        {row.context ? <span className="coll__ctx">{row.context}</span> : null}
        <span className="coll__date">{new Date(row.createdAt).toLocaleString()}</span>
      </div>
      {row.mechanic ? <div className="coll__mech">{row.mechanic}</div> : null}
      <div className="coll__actions">
        <button type="button" className="coll__a" onClick={() => setRender((v) => !v)}>
          {render ? "Hide render" : "Render"}
        </button>
        <button type="button" className="coll__a" onClick={() => void copy()}>
          {copied ? "Copied ✓" : "Copy code"}
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" className="coll__a coll__a--danger" onClick={onDelete}>
          Delete
        </button>
      </div>
      {render ? (
        <div className="coll__render">
          <EmbedExercise html={row.html} />
        </div>
      ) : null}
      <details className="coll__code">
        <summary>code ({row.html.length} chars)</summary>
        <pre>{row.html}</pre>
      </details>
    </div>
  );
}

const CSS = `
.coll{ min-height:100vh; background:#000; color:var(--white-80); font-family:var(--font-sans); }
.coll__head{ display:flex; align-items:center; gap:14px; padding:18px 22px; border-bottom:1px solid var(--border-faint); }
.coll__title{ font-size:18px; font-weight:600; color:#fff; }
.coll__sub{ font-family:var(--font-mono); font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--white-30); }
.coll__count{ font-family:var(--font-mono); font-size:11px; color:var(--white-40); }
.coll__btn{ margin-left:auto; font-family:var(--font-mono); font-size:12px; padding:8px 16px; border-radius:99px; background:rgb(52 211 153 / .14); border:1px solid rgb(52 211 153 / .4); color:var(--emerald-400); cursor:pointer; }
.coll__btn:disabled{ opacity:.5; cursor:default; }
.coll__hint{ padding:40px 22px; font-size:13px; color:var(--white-40); }
.coll__list{ display:grid; grid-template-columns:repeat(auto-fill, minmax(420px, 1fr)); gap:16px; padding:18px 22px; }
.coll__card{ border:1px solid var(--border-faint); border-radius:16px; background:var(--neutral-950); padding:16px; display:flex; flex-direction:column; gap:10px; }
.coll__cmt{ font-size:15px; line-height:1.55; color:#fff; }
.coll__meta{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-family:var(--font-mono); font-size:10.5px; color:var(--white-40); }
.coll__pill{ padding:2px 8px; border-radius:99px; background:var(--white-05); border:1px solid var(--border); text-transform:uppercase; letter-spacing:.1em; }
.coll__ctx{ color:var(--white-55); }
.coll__date{ margin-left:auto; }
.coll__mech{ font-size:12.5px; color:var(--white-55); line-height:1.5; border-left:2px solid var(--border-strong); padding-left:10px; }
.coll__actions{ display:flex; align-items:center; gap:8px; }
.coll__a{ font-family:var(--font-mono); font-size:11px; padding:5px 11px; border-radius:8px; background:var(--white-03); border:1px solid var(--border); color:var(--white-70); cursor:pointer; }
.coll__a:hover{ background:var(--white-08); color:#fff; }
.coll__a--danger{ color:var(--rose-400); border-color:rgb(251 113 133 / .3); }
.coll__render{ border-radius:14px; overflow:hidden; }
.coll__code summary{ cursor:pointer; font-family:var(--font-mono); font-size:11px; color:var(--white-40); }
.coll__code pre{ font-family:var(--font-mono); font-size:11px; line-height:1.5; color:var(--white-55); background:var(--surface-sunken); border:1px solid var(--border); border-radius:10px; padding:10px; overflow:auto; max-height:280px; white-space:pre-wrap; word-break:break-word; }
`;

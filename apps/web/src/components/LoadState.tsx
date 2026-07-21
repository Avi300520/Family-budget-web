// BATCH-GI 4.1.3 — this is the shared loading/error surface for ~15 authenticated routes and
// it announced nothing: a fetch that failed after the page had rendered swapped the panel
// silently. role="alert" (assertive) for the failure, role="status" (polite) for the wait.
// The distinct `key`s are load-bearing, not decoration. Both branches return a root <div>, so
// without them React reconciles loading -> error IN PLACE: it patches role="status" to
// role="alert" on a node the screen reader has already mapped as a polite region. role="alert"
// is announced on INSERTION; mutating the attribute of an existing node is the unreliable path,
// and loading -> error is the exact transition this component exists to announce.
export function LoadState({ error }: { error?: string }) {
  if (error) return <div key="err" className="panel status error" role="alert">{error}</div>;
  return <div key="load" className="panel muted" role="status">טוען...</div>;
}

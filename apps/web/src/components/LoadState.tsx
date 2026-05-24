export function LoadState({ error }: { error?: string }) {
  if (error) return <div className="panel status error">{error}</div>;
  return <div className="panel muted">טוען...</div>;
}

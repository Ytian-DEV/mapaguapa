export function FullPageLoader({ label = "Loading MAPAGUAPA..." }: { label?: string }) {
  return (
    <div aria-live="polite" className="app-shell app-shell--loading" role="status">
      {label}
    </div>
  );
}

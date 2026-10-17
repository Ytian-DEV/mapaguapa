import { useEffect } from "react";
import { hasSupabaseEnv, listingPhotosBucket } from "../../lib/supabase";
import { Badge, Card, CardHeader, PageHeader } from "../../ui";
import { tileConfig } from "../map/tiles";
import "./admin.css";

/** Read-only system settings: what the app is configured with and how to change it. */
export default function AdminSettingsPage() {
  useEffect(() => {
    document.title = "Settings · Admin · mapaguapa";
  }, []);

  const mapOk = tileConfig.provider === "maptiler";

  return (
    <div className="admin-page admin-settings">
      <PageHeader eyebrow="System" subtitle="Configuration lives in Vercel environment variables and the Supabase dashboard." title="Settings" />
      <Card>
        <CardHeader title="Configuration" />
        <dl>
          <div>
            <dt>Supabase</dt>
            <dd>{hasSupabaseEnv ? <Badge tone="green">Connected</Badge> : <Badge tone="red">Missing URL / key</Badge>}</dd>
          </div>
          <div>
            <dt>Listing photos bucket</dt>
            <dd>
              <code>{listingPhotosBucket}</code>
            </dd>
          </div>
          <div>
            <dt>Map tiles</dt>
            <dd>{mapOk ? <Badge tone="green">MapTiler</Badge> : <Badge tone="amber">OpenStreetMap fallback</Badge>}</dd>
          </div>
        </dl>
      </Card>
      {!mapOk && (
        <Card>
          <CardHeader title="Set up map tiles" />
          <ol style={{ display: "grid", gap: 8, paddingLeft: 20, listStyle: "decimal", fontSize: "var(--text-sm)" }}>
            <li>Create a free key at maptiler.com (Account → API keys).</li>
            <li>Restrict it to your domains: the Vercel URL and http://localhost:5173.</li>
            <li>
              In Vercel → Project → Settings → Environment Variables, add <code>VITE_MAPTILER_KEY</code> and redeploy.
            </li>
          </ol>
        </Card>
      )}
    </div>
  );
}

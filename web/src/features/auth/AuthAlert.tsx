import type { ReactNode } from "react";
import { AlertCircle, Info } from "lucide-react";

export function AuthAlert({ tone, children }: { tone: "error" | "info"; children: ReactNode }) {
  const Icon = tone === "error" ? AlertCircle : Info;
  return (
    <div className={`auth__alert auth__alert--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

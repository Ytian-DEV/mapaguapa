import { useState } from "react";
import { initialsOf } from "../lib/format";
import { cx } from "./cx";
import "./avatar.css";

type AvatarProps = {
  name?: string | null;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  tone?: "sage" | "clay" | "paper";
  className?: string;
};

export function Avatar({ name, src, size = "md", tone = "sage", className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <span
      aria-label={name ?? undefined}
      className={cx("ui-avatar", `ui-avatar--${size}`, `ui-avatar--${tone}`, className)}
      role={name ? "img" : undefined}
    >
      {showImage ? (
        <img alt="" onError={() => setFailed(true)} referrerPolicy="no-referrer" src={src ?? undefined} />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
    </span>
  );
}

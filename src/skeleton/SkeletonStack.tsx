import type { ReactNode } from "react";

type SkeletonStackProps = {
  children: ReactNode;
  gap?: "sm" | "md" | "lg";
  className?: string;
  role?: string;
  "aria-busy"?: boolean;
  "aria-label"?: string;
};

const GAP_CLASS = {
  sm: "skeleton-stack--gap-sm",
  md: "skeleton-stack--gap-md",
  lg: "skeleton-stack--gap-lg",
} as const;

export function SkeletonStack({
  children,
  gap = "md",
  className = "",
  role,
  "aria-busy": ariaBusy,
  "aria-label": ariaLabel,
}: SkeletonStackProps) {
  return (
    <div
      className={`skeleton-stack ${GAP_CLASS[gap]}${className ? ` ${className}` : ""}`}
      role={role}
      aria-busy={ariaBusy}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

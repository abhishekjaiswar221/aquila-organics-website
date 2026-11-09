import type { ReactNode } from "react";
import { Eyebrow } from "./eyebrow";
import { cn } from "@/lib/utils";

interface Props {
  eyebrow?: string;
  title: string;
  level?: 2 | 3;
  children?: ReactNode;
  className?: string;
}

export function SectionHeader({ eyebrow, title, level = 2, children, className }: Props) {
  const Tag = level === 2 ? "h2" : "h3";
  return (
    <div className={cn("max-w-3xl", className)}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Tag className="text-display-lg mt-3">{title}</Tag>
      {children ? <div className="mt-5 text-lg leading-relaxed text-muted-foreground">{children}</div> : null}
    </div>
  );
}

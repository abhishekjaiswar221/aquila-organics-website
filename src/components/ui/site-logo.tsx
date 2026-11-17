import Image from "next/image";
import { imageFileData, logo } from "@/content/images";
import { cn } from "@/lib/utils";

/**
 * The Aquila logo from the current website. It is a black mark on a transparent background, so on a dark
 * background pass `onDark` to show it white (a CSS filter; no second file is needed).
 */
export function SiteLogo({ onDark = false, priority = false, className }: { onDark?: boolean; priority?: boolean; className?: string }) {
  const data = imageFileData(logo.file);
  if (!data) return <span className={cn("font-display text-2xl uppercase tracking-[0.12em]", className)}>{logo.alt}</span>;
  return (
    <Image
      src={logo.file}
      alt={logo.alt}
      width={data.width}
      height={data.height}
      sizes="(min-width: 1024px) 220px, 160px"
      priority={priority}
      className={cn("h-auto w-40 lg:w-52", onDark && "brightness-0 invert", className)}
    />
  );
}

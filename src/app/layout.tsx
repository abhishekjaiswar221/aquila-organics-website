import type { Metadata } from "next";
import { body, display, mono } from "@/lib/fonts";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Aquila Organics — Fragrances, Aroma Chemicals & Flavours",
    template: "%s | Aquila Organics",
  },
  description:
    "Aquila Organics Private Limited is an Indian manufacturer of fragrances, aroma chemicals and flavours. Where Science Meets Senses.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}

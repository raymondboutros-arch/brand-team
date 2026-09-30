import type { Metadata } from "next";
import "@fontsource-variable/schibsted-grotesk";
import "@fontsource/instrument-serif/400-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LIVBRID HQ", template: "%s · LIVBRID HQ" },
  description: "LIVBRID's brand workspace.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}

import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Compass",
  description: "Milestone-centric project pages — one standard shape for every project.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

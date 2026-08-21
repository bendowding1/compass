import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Compass",
  description: "Milestone-centric project pages — one standard shape for every project.",
};

// Re-apply the pinned theme before first paint so a dark-mode user never sees a
// light flash. Runs as the first thing in <body>; no stored choice = follow the
// OS preference via the prefers-color-scheme blocks in globals.css.
const themeInit = `try{var t=localStorage.getItem("compass-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the script above may set data-theme on <html>
    // before React hydrates, which is an expected attribute mismatch.
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {children}
      </body>
    </html>
  );
}

import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

/** App top bar: the Compass mark (links home), a Projects breadcrumb, the
 *  theme switch, and the user avatar. */
export function TopBar({ crumb, avatar }: { crumb?: string; avatar?: string }) {
  return (
    <div className="top">
      <Link href="/" className="mark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="logo-icon" />
        Compass
      </Link>
      <span className="crumb">
        <Link href="/" className="crumb-link">
          Projects
        </Link>
        {crumb ? (
          <>
            {" / "}
            <b>{crumb}</b>
          </>
        ) : null}
      </span>
      <span className="spacer" />
      <ThemeToggle />
      <span className="avatar">{avatar ?? ""}</span>
      {/* Auth.js sign-out is an API route, not a page, so a full-navigation <a>
          is correct here (Link would client-side route to it). */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className="signout" href="/api/auth/signout">
        Sign out
      </a>
    </div>
  );
}

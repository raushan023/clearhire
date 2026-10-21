import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Suspense, useEffect, useRef } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { InlineLoader, LoadingState } from "./ui";
import { viewerTimezone } from "../lib/presentation";
import { useAuth } from "../lib/auth";
import { ApiError, http } from "../lib/api-client";
import { useApiQuery } from "../lib/query";
const navigation = {
  candidate: [
    ["Overview", ""],
    ["Find jobs", "/jobs"],
    ["Saved jobs", "/saved-jobs"],
    ["Applications", "/applications"],
    ["Profile", "/profile"],
    ["Resume", "/resume"],
  ],
  employer: [
    ["Overview", ""],
    ["Companies", "/companies"],
    ["Jobs", "/jobs"],
    ["Feedback obligations", "/feedback-obligations"],
    ["Account", "/profile"],
  ],
};
function RefreshFeedback() {
  const { user } = useAuth();
  const client = useQueryClient();
  const fetching = useIsFetching({
    predicate: (query) =>
      query.queryKey[0] === "account" &&
      query.queryKey[1] === user?.id &&
      query.state.data !== undefined,
  });
  const failed = client
    .getQueryCache()
    .getAll()
    .some(
      (query) =>
        query.queryKey[0] === "account" &&
        query.queryKey[1] === user?.id &&
        query.isActive() &&
        query.state.data !== undefined &&
        query.state.status === "error" &&
        (!(query.state.error instanceof ApiError) ||
          query.state.error.status === 0 ||
          query.state.error.status >= 500),
    );
  return (
    <div className="refresh-feedback" aria-live="polite">
      {fetching ? (
        <InlineLoader text="Refreshing…" />
      ) : failed ? (
        "Some data could not refresh. Showing the last available information."
      ) : null}
    </div>
  );
}
export function Shell() {
  const { user, logout } = useAuth(),
    location = useLocation(),
    main = useRef<HTMLElement>(null);
  const unread = useApiQuery(["unread"], (signal) =>
    http.get<{ count: number }>("/notifications/unread-count", signal),
  );
  const role = user!.role,
    base = `/${role}`;
  const links = navigation[role];
  useEffect(() => {
    main.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    document.title =
      "ClearHire · " +
      (links.find(
        ([, path]) => path && location.pathname.startsWith(base + path),
      )?.[0] ?? "Workspace");
  }, [location.pathname, base, links]);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" to={base}>
            <span className="brand-mark" aria-hidden="true">
              C<span>↗</span>
            </span>
            ClearHire<span className="workspace-tag">{role}</span>
          </Link>
          <div className="topbar-actions">
            <Link className="notification-link" to={`${base}/notifications`}>
              Notifications{" "}
              {unread.isPending && <InlineLoader text="Loading count…" />}
              {unread.data && unread.data.count > 0 && (
                <span className="notification-count">
                  {unread.data.count}
                  <span className="sr-only"> unread</span>
                </span>
              )}
            </Link>
            {unread.error && (
              <span className="small muted" role="status">
                Notification count unavailable
              </span>
            )}
            <span className="user-name">{user!.firstName}</span>
            <button className="secondary small" onClick={() => logout()}>
              Log out
            </button>
          </div>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          {links.map(([text, path]) => (
            <NavLink key={path} to={base + path} end={!path}>
              {text}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="main" className="container" ref={main} tabIndex={-1}>
        <RefreshFeedback />
        <Suspense key={location.pathname} fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="footer">
        <span>ClearHire</span>
        <span>
          Clear deadlines. Transparent outcomes. · Times: {viewerTimezone()}
        </span>
      </footer>
    </>
  );
}

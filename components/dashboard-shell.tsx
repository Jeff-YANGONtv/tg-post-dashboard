"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarClock,
  Inbox,
  LayoutDashboard,
  Radio,
  Send,
  Settings,
} from "lucide-react";

const items = [
  ["/", "Overview", LayoutDashboard],
  ["/posts", "Posts", Inbox],
  ["/scheduled", "Scheduled", CalendarClock],
  ["/channels", "Channels", Radio],
  ["/published", "Published", Send],
  ["/settings", "Settings", Settings],
] as const;

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">↗</div>
          <div>
            <div className="brand-title">SIGNAL RELAY</div>
            <div className="brand-sub">TELEGRAM CONTROL ROOM</div>
          </div>
        </div>
        <div className="nav-label">Workspace</div>
        {items.slice(0, 5).map(([href, label, Icon]) => (
          <Link
            key={href}
            href={href}
            className={`nav-link ${path === href ? "active" : ""}`}
          >
            <Icon size={16} />
            <span>{label === "Published" ? "Published records" : label}</span>
          </Link>
        ))}
        <div className="nav-label">System</div>
        <Link
          href="/settings"
          className={`nav-link ${path === "/settings" ? "active" : ""}`}
        >
          <Activity size={16} />
          <span>Health &amp; access</span>
        </Link>
        <div className="sidebar-status">
          <div className="notice">
            <div className="green status-title">● CONNECTED</div>
            <div className="status-copy">
              Workspace data syncs from Supabase.
            </div>
          </div>
        </div>
      </aside>
      <header className="mobile-brand">
        <div className="brand-mark">↗</div>
        <div>
          <div className="brand-title">SIGNAL RELAY</div>
          <div className="brand-sub">TELEGRAM CONTROL ROOM</div>
        </div>
      </header>
      <main className="main">{children}</main>
      <nav className="mobile-tabs" aria-label="Primary navigation">
        {items.map(([href, label, Icon]) => (
          <Link
            key={href}
            href={href}
            className={`mobile-tab-link ${path === href ? "active" : ""}`}
            aria-current={path === href ? "page" : undefined}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{label === "Published" ? "Published" : label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

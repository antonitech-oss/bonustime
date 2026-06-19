"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, ICONS } from "./Icon";
import { useStore } from "@/lib/store";

interface Voce { label: string; href: string; icon: string; }

const NAV: Voce[] = [
  { label: "Dashboard", href: "/dashboard", icon: ICONS.dashboard },
  { label: "Da fare",   href: "/dafare",    icon: ICONS.check },
  { label: "ID",        href: "/id",        icon: ICONS.id },
  { label: "Book",      href: "/book",      icon: ICONS.book },
  { label: "Spese",     href: "/spese",     icon: ICONS.money },
  { label: "Pasqubet",  href: "/pasquale",   icon: ICONS.handshake },
  { label: "Dispositivi", href: "/dispositivi", icon: ICONS.phone },
];

const SUB: Voce[] = [
  { label: "Backup",   href: "/dashboard#backup", icon: ICONS.backup },
  { label: "Calendar", href: "https://calendar.google.com", icon: ICONS.calendar },
];

const MOBILE = NAV;

export function Sidebar({ email, onLogout }: { email?: string; onLogout?: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const todoPending = useStore((s) => s.data.todos.filter((t) => !t.fatto).length);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("bt-sb") === "1"); } catch {}
  }, []);

  const toggle = () => {
    const v = !collapsed;
    setCollapsed(v);
    try { localStorage.setItem("bt-sb", v ? "1" : "0"); } catch {}
  };

  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href));
  const initials = (email || "?").slice(0, 2).toUpperCase();

  const Item = ({ v, sub }: { v: Voce; sub?: boolean }) => {
    const active = isActive(v.href);
    const cls = `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
      active ? "bg-violet/15 text-violet font-semibold rounded-lg" : "text-txt-secondary hover:bg-bg-hover hover:text-txt-primary rounded-lg"
    }`;
    const isDaFare = v.href === "/dafare";
    const inner = (
      <>
        <span className="relative shrink-0">
          <Icon d={v.icon} size={16} />
          {isDaFare && todoPending > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-acc-red text-white text-[9px] font-bold flex items-center justify-center leading-none">
              {todoPending > 99 ? "99+" : todoPending}
            </span>
          )}
        </span>
        {!collapsed && <span>{v.label}</span>}
      </>
    );
    if (v.href.startsWith("http"))
      return <a href={v.href} target="_blank" rel="noreferrer" className={cls}>{inner}</a>;
    return <Link href={v.href} className={cls}>{inner}</Link>;
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`hidden md:flex flex-col sticky top-0 h-screen shrink-0 bg-bg-sidebar border-r border-bord transition-all duration-200 ${collapsed ? "w-[56px]" : "w-[220px]"}`}>
        <div className="flex items-center justify-between px-3 h-14 border-b border-bord">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold" style={{background:"linear-gradient(135deg,#8b5cf6,#7c3aed)"}}>B</div>
              <span className="font-bold tracking-tight page-title" style={{color:"#a78bfa",fontSize:14}}>Bonustime</span>
            </div>
          )}
          <button onClick={toggle} className="text-txt-secondary hover:text-txt-primary p-1 ml-auto">
            <Icon d={ICONS.menu} size={16} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {NAV.map((v) => <Item key={v.href} v={v} />)}
          <div className="h-px bg-bord my-2" />
          {SUB.map((v) => <Item key={v.href} v={v} sub />)}
        </nav>
        <div className="border-t border-bord p-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{background:"linear-gradient(135deg,#8b5cf6,#7c3aed)",color:"#fff"}}>
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-xs truncate text-txt-secondary">{email}</div>
              <div className="flex items-center gap-1 text-[10px] text-teal">
                <span className="w-1.5 h-1.5 rounded-full bg-teal inline-block" />sync
              </div>
            </div>
          )}
          {!collapsed && onLogout && (
            <button onClick={onLogout} className="text-txt-secondary hover:text-acc-red p-1 shrink-0" title="Logout">
              <Icon d={ICONS.logout} size={15} />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-bg-sidebar border-t border-bord flex justify-around"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {MOBILE.map((v) => {
          const active = isActive(v.href);
          const isDaFare = v.href === "/dafare";
          return (
            <Link key={v.href} href={v.href}
              className={`flex flex-col items-center gap-0.5 py-2 flex-1 transition-colors ${active ? "text-violet" : "text-txt-secondary"}`}
              style={{ fontSize: 10 }}>
              <span className="relative">
                <Icon d={v.icon} size={20} />
                {isDaFare && todoPending > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-acc-red text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {todoPending > 99 ? "99+" : todoPending}
                  </span>
                )}
              </span>
              {v.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

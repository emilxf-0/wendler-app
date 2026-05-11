"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/workout/today", label: "Today" },
  { href: "/program", label: "Program" },
  { href: "/progress", label: "Progress" },
  { href: "/setup", label: "Setup" },
  { href: "/history", label: "History" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/90">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-white"
          >
            531 Forever
          </Link>
          <nav className="flex flex-wrap gap-1.5 text-base">
            {links.map((l) => {
              const active =
                l.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`inline-flex min-h-11 items-center rounded-lg px-3.5 py-2 transition-colors ${
                    active
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-7 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}

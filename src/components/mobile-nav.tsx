"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { navItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const mobileNavItems = navItems.filter((item) => item.href !== "/gantt");

  return (
    <div className="md:hidden">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="打开菜单"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="关闭菜单"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-0 z-10 flex h-dvh w-[88vw] max-w-sm flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="shrink-0 border-b border-slate-200 bg-white/95 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">Tess 工作台</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="关闭菜单"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            </div>
            <nav className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto bg-white/95 p-3">
              {mobileNavItems.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-slate-950 text-white hover:bg-slate-950 hover:text-white [&_svg]:text-white"
                        : "bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950",
                    )}
                  >
                    <Icon className={cn("h-5 w-5 shrink-0", active ? "text-white" : "text-slate-500")} />
                    <span className={cn("min-w-0 flex-1", active ? "text-white" : "text-slate-900")}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}

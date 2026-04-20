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
        <div className="fixed inset-0 z-50 bg-slate-950/40" role="dialog" aria-modal="true">
          <div className="absolute right-0 top-0 flex h-full w-[86vw] max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-950">Tess Work Manager</p>
                <p className="text-xs text-slate-500">Mobile menu</p>
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
            <nav className="grid gap-1 p-3">
              {navItems.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-md px-3 text-sm font-medium",
                      active
                        ? "bg-slate-950 text-white"
                        : "text-slate-700 hover:bg-slate-100",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                    <span className="ml-auto text-xs opacity-70">{item.sub}</span>
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

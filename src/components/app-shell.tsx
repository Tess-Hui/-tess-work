import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/mobile-nav";
import { logoutAction } from "@/lib/actions";
import { getSession } from "@/lib/auth";
import { navItems } from "@/lib/navigation";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen md:grid md:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-slate-200 bg-white/85 px-4 py-5 backdrop-blur md:block">
        <Link href="/dashboard" className="mb-6 block rounded-md px-2">
          <p className="text-lg font-semibold text-slate-950">Tess 工作台</p>
        </Link>
        <nav className="grid gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <form action={logoutAction} className="absolute bottom-5 left-4 right-4">
          <Button variant="outline" className="w-full">
            <LogOut className="h-4 w-4" />
            退出登录
          </Button>
        </form>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-8">
          <div>
            <p className="text-sm font-semibold text-slate-950">Tess 工作台</p>
            <p className="text-xs text-slate-500">云端同步</p>
          </div>
          <div className="flex items-center gap-2">
            <MobileNav />
            <form action={logoutAction} className="hidden md:block">
              <Button variant="ghost" size="sm">
                <LogOut className="h-4 w-4" />
                退出登录
              </Button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-5 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

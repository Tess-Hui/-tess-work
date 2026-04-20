import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          "flex min-h-11 w-full appearance-none rounded-md border border-slate-200 bg-white px-3 py-2 pr-10 text-base text-slate-950 shadow-sm outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-100 md:text-sm",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
    </div>
  );
}

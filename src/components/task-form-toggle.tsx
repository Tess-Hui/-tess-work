"use client";

import { Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TaskFormToggle({
  children,
  initialOpen = false,
}: {
  children: ReactNode;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);

  return (
    <div className="grid gap-3">
      <div>
        <Button type="button" variant="outline" onClick={() => setOpen((current) => !current)}>
          {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {open ? "收起表单" : "新建任务"}
        </Button>
      </div>
      <div
        className={cn(
          "grid overflow-hidden transition-all duration-200 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0">{children}</div>
      </div>
    </div>
  );
}

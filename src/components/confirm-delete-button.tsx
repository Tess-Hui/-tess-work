"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";

export function ConfirmDeleteButton({
  title = "确定要删除这个批次吗？",
  description = "删除后，该批次的流转记录也会一起删除，库存会重新计算。",
  triggerText = "删除",
  confirmText = "确认删除",
  pendingText = "删除中...",
}: {
  title?: string;
  description?: string;
  triggerText?: string;
  confirmText?: string;
  pendingText?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="danger" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
        {triggerText}
      </Button>
    );
  }

  return (
    <div className="grid gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm">
      <div>
        <p className="font-semibold text-red-800">{title}</p>
        <p className="mt-1 text-red-700">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
          取消
        </Button>
        <SubmitButton variant="danger" size="sm" pendingText={pendingText}>
          <Trash2 className="h-4 w-4" />
          {confirmText}
        </SubmitButton>
      </div>
    </div>
  );
}

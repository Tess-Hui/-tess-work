"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";

export function SubmitButton({
  children,
  pendingText = "处理中...",
  ...props
}: ButtonProps & { children: ReactNode; pendingText?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}

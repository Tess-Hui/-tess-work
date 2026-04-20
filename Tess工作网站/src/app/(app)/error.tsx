"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-2xl border-amber-200 bg-amber-50">
        <CardHeader>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-amber-100 text-amber-700">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <CardTitle>页面暂时无法加载</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm leading-6 text-amber-900">
            系统已经尝试自动初始化 Neon 数据库表，但本次请求没有成功。请稍后重试；如果仍然失败，请检查
            Vercel 环境变量中的 <code className="rounded bg-white px-1">DATABASE_URL</code> 是否有效。
          </p>
          <details className="rounded-md border border-amber-200 bg-white p-3 text-xs text-slate-600">
            <summary className="cursor-pointer font-medium text-slate-800">错误详情</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words">
              {error.message || error.digest || "Unknown error"}
            </pre>
          </details>
          <Button type="button" onClick={reset} className="w-fit">
            <RefreshCcw className="h-4 w-4" />
            重新加载
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

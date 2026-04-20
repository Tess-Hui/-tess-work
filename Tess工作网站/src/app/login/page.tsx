import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";

import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginAction } from "@/lib/actions";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/dashboard");
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-950 text-white">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Tess 工作管理登录</CardTitle>
          <p className="text-sm text-slate-500">Private cloud workspace · Admin only</p>
        </CardHeader>
        <CardContent>
          {params.error ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              用户名或密码不正确，或环境变量尚未配置。
            </div>
          ) : null}
          <form action={loginAction} className="grid gap-4">
            <Field label="用户名 Username">
              <Input name="username" defaultValue="Tess" autoComplete="username" required />
            </Field>
            <Field label="密码 Password">
              <Input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <SubmitButton className="mt-2 w-full">登录进入系统</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

import Link from "next/link";
import { Tags } from "lucide-react";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { deleteMaterialCategoryAction, saveMaterialCategoryAction } from "@/lib/actions";
import { listMaterialCategoryItems } from "@/lib/data";

type Params = {
  edit?: string;
  error?: string;
};

export async function MaterialCategoryManager({ searchParams }: { searchParams: Params }) {
  const categories = await listMaterialCategoryItems();
  const editing = categories.find((category) => category.id === searchParams.edit) ?? null;

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">物料分类</h1>
          <p className="mt-1 text-sm text-slate-500">先维护分类，新建物料和库存筛选时可以直接选择。</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/materials/batches">返回物料总库存</Link>
        </Button>
      </div>

      {searchParams.error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            {searchParams.error === "CATEGORY_IN_USE" ? "这个分类已有物料使用，不能直接删除。" : "分类保存失败，请检查名称。"}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{editing ? "编辑分类" : "新增分类"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveMaterialCategoryAction} className="grid gap-3 md:grid-cols-[1fr_0.5fr_auto_auto] md:items-end">
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <Field label="分类名称">
              <Input name="name" defaultValue={editing?.name} placeholder="例如：贺卡 / 彩盒 / 标签类" required />
            </Field>
            <Field label="排序">
              <Input name="sortOrder" type="number" step="1" defaultValue={editing?.sortOrder ?? 80} />
            </Field>
            <SubmitButton>{editing ? "保存分类" : "新增分类"}</SubmitButton>
            {editing ? (
              <Button asChild variant="outline">
                <Link href="/materials/categories">取消</Link>
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {categories.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Card key={category.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-950">{category.name}</p>
                  <p className="mt-1 text-sm text-slate-500">排序：{category.sortOrder}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/materials/categories?edit=${category.id}`}>编辑</Link>
                  </Button>
                  <form action={deleteMaterialCategoryAction}>
                    <input type="hidden" name="id" value={category.id} />
                    <ConfirmDeleteButton
                      title="确定要删除这个分类吗？"
                      description="删除后，使用该分类的物料会改为未分类；批次、库存和流转记录都会保留。"
                    />
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={Tags} title="暂无分类" description="新增分类后即可在物料和批次筛选里使用。" />
      )}
    </div>
  );
}

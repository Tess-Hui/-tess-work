import {
  Bell,
  CheckCircle2,
  ClipboardList,
  Download,
  Home,
  NotebookText,
  Package,
  Pin,
  Ruler,
  Link2,
  Tags,
  Trash2,
} from "lucide-react";

export const navItems = [
  { href: "/dashboard", label: "首页", icon: Home },
  { href: "/tasks", label: "待办工作", icon: ClipboardList },
  { href: "/completed", label: "已完成工作", icon: CheckCircle2 },
  { href: "/trash", label: "废纸篓", icon: Trash2 },
  { href: "/fixed", label: "固定事项", icon: Pin },
  { href: "/reminders", label: "提醒事项", icon: Bell },
  { href: "/memos", label: "备忘录", icon: NotebookText },
  { href: "/materials", label: "物料管理", icon: Package },
  { href: "/materials/links", label: "物料联动组", icon: Link2 },
  { href: "/materials/categories", label: "物料分类", icon: Tags },
  { href: "/material-sizes", label: "物料尺寸管理", icon: Ruler },
  { href: "/export", label: "导出", icon: Download },
];

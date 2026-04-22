import {
  Bell,
  CheckCircle2,
  ClipboardList,
  Download,
  Home,
  NotebookText,
  Package,
  Pin,
  Trash2,
  Workflow,
} from "lucide-react";

export const navItems = [
  { href: "/dashboard", label: "首页", sub: "Dashboard", icon: Home },
  { href: "/tasks", label: "待办工作", sub: "Tasks", icon: ClipboardList },
  { href: "/completed", label: "已完成工作", sub: "Done", icon: CheckCircle2 },
  { href: "/trash", label: "废纸篓", sub: "Trash", icon: Trash2 },
  { href: "/fixed", label: "固定事项", sub: "Fixed", icon: Pin },
  { href: "/reminders", label: "提醒事项", sub: "Reminders", icon: Bell },
  { href: "/memos", label: "备忘录", sub: "Memos", icon: NotebookText },
  { href: "/gantt", label: "甘特图", sub: "Gantt", icon: Workflow },
  { href: "/materials", label: "物料管理", sub: "Materials", icon: Package },
  { href: "/export", label: "导出", sub: "Export", icon: Download },
];

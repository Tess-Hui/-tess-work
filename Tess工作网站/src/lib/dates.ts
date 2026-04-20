const SHANGHAI_TIME_ZONE = "Asia/Shanghai";

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "未设置";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: SHANGHAI_TIME_ZONE,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "未设置";
  const date = typeof value === "string" ? new Date(`${value}T00:00:00+08:00`) : value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: SHANGHAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function toDateTimeInput(value: Date | null | undefined) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: SHANGHAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
  return parts.replace(" ", "T");
}

export function getShanghaiDateString(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: SHANGHAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getShanghaiDayRange(dateString: string) {
  const start = new Date(`${dateString}T00:00:00+08:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function parseDateTimeInput(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return new Date(`${trimmed}:00+08:00`);
}

export function parseDateInput(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string") return null;
  return value.trim() || null;
}

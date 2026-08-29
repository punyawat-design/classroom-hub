export function thaiDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function safeFileName(name: string) {
  return name.replace(/[^\w.\-ก-๙]+/g, "_");
}

export function errText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String((error as any).message);
  return String(error ?? "เกิดข้อผิดพลาด");
}

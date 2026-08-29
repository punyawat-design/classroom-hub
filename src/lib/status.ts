export type Status =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "WAITING_REVIEW"
  | "GRADED"
  | "REVISION_REQUIRED"
  | "LATE"
  | "OVERDUE";

export const statusLabel: Record<Status,string> = {
  NOT_STARTED: "ยังไม่เริ่ม",
  IN_PROGRESS: "กำลังทำ",
  WAITING_REVIEW: "รอตรวจ",
  GRADED: "ตรวจแล้ว",
  REVISION_REQUIRED: "ต้องแก้ไข",
  LATE: "ส่งล่าช้า",
  OVERDUE: "เลยกำหนด"
};

export const statusTone: Record<Status,string> = {
  NOT_STARTED: "red",
  IN_PROGRESS: "blue",
  WAITING_REVIEW: "purple",
  GRADED: "green",
  REVISION_REQUIRED: "yellow",
  LATE: "orange",
  OVERDUE: "red"
};

import { Status, statusLabel, statusTone } from "../lib/status";

export default function StatusBadge({status}:{status:Status}) {
  return <span className={`badge ${statusTone[status]}`}>{statusLabel[status]}</span>;
}

import { useEffect,useState } from "react";
import StatusBadge from "../../components/StatusBadge";
import { supabase } from "../../lib/supabase";
import { Status } from "../../lib/status";
import { errText, thaiDate } from "../../lib/utils";

export default function TrackingPage(){
  const [assignments,setAssignments]=useState<any[]>([]);
  const [selected,setSelected]=useState("");
  const [rows,setRows]=useState<any[]>([]);
  const [filter,setFilter]=useState("ALL");
  const [error,setError]=useState("");

  useEffect(()=>{supabase.from("assignments").select("id,title").order("created_at",{ascending:false}).then(({data})=>setAssignments(data||[]))},[]);
  async function load(id:string){
    setSelected(id);setRows([]);setError("");
    if(!id)return;
    const {data,error}=await supabase.rpc("teacher_assignment_tracking",{p_assignment_id:id});
    if(error)setError(errText(error)); else setRows(data||[]);
  }
  const shown=filter==="ALL"?rows:rows.filter(x=>x.computed_status===filter);

  return <>
    <header className="page-header"><div><h1>ติดตามการส่งงาน</h1><p>เลือกงานเพื่อดูว่านักเรียนคนใดส่งหรือยังไม่ส่ง</p></div></header>
    {error&&<div className="error">{error}</div>}
    <div className="toolbar section">
      <select value={selected} onChange={e=>load(e.target.value)}><option value="">เลือก Assignment</option>{assignments.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}</select>
      <select value={filter} onChange={e=>setFilter(e.target.value)}>
        <option value="ALL">ทุกสถานะ</option>
        <option value="NOT_STARTED">ยังไม่เริ่ม</option>
        <option value="IN_PROGRESS">กำลังทำ</option>
        <option value="WAITING_REVIEW">รอตรวจ</option>
        <option value="GRADED">ตรวจแล้ว</option>
        <option value="REVISION_REQUIRED">ต้องแก้ไข</option>
        <option value="LATE">ส่งล่าช้า</option>
        <option value="OVERDUE">เลยกำหนด</option>
      </select>
    </div>
    <div className="table-card section"><table>
      <thead><tr><th>รหัส</th><th>นักเรียน</th><th>สถานะ</th><th>วันที่ส่ง</th><th>คะแนน</th></tr></thead>
      <tbody>{shown.map(x=><tr key={x.student_id}><td>{x.student_code||"-"}</td><td>{x.full_name}</td><td><StatusBadge status={x.computed_status as Status}/></td><td>{thaiDate(x.submitted_at)}</td><td>{x.score??"-"}</td></tr>)}</tbody>
    </table>{selected&&shown.length===0&&<div className="empty">ไม่พบข้อมูลในสถานะนี้</div>}</div>
  </>;
}

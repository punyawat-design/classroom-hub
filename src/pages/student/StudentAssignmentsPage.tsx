import { useEffect,useMemo,useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import StatusBadge from "../../components/StatusBadge";
import { Status } from "../../lib/status";
import { thaiDate } from "../../lib/utils";

export default function StudentAssignmentsPage(){
  const {user}=useAuth();
  const [items,setItems]=useState<any[]>([]);
  const [filter,setFilter]=useState("ALL");
  useEffect(()=>{if(user) supabase.rpc("student_assignment_overview",{p_student_id:user.id}).then(({data})=>setItems(data||[]))},[user]);
  const shown=useMemo(()=>filter==="ALL"?items:items.filter(x=>x.computed_status===filter),[items,filter]);

  return <>
    <header className="page-header"><div><h1>งานของฉัน</h1><p>ดู กรอง และเปิดงานที่ได้รับมอบหมาย</p></div></header>
    <div className="toolbar section"><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="ALL">ทุกสถานะ</option><option value="NOT_STARTED">ยังไม่เริ่ม</option><option value="IN_PROGRESS">กำลังทำ</option><option value="WAITING_REVIEW">รอตรวจ</option><option value="GRADED">ตรวจแล้ว</option><option value="REVISION_REQUIRED">ต้องแก้ไข</option><option value="LATE">ส่งล่าช้า</option><option value="OVERDUE">เลยกำหนด</option></select></div>
    <div className="cards-list section">{shown.map(x=><article className="card assignment-card" key={x.assignment_id}>
      <div><h3>{x.title}</h3><div className="muted">{x.course_name} • {x.classroom_name}</div><div className="small top-gap">กำหนดส่ง: {thaiDate(x.due_at)} • {x.max_score} คะแนน</div></div>
      <div className="assignment-actions"><StatusBadge status={x.computed_status as Status}/><Link className="btn primary" to={`/student/assignments/${x.assignment_id}`}>เปิดงาน</Link></div>
    </article>)}</div>
  </>;
}

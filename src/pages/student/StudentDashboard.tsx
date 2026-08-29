import { useEffect,useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import StatCard from "../../components/StatCard";
import StatusBadge from "../../components/StatusBadge";
import { Status } from "../../lib/status";
import { thaiDate } from "../../lib/utils";

export default function StudentDashboard(){
  const {user}=useAuth();
  const [items,setItems]=useState<any[]>([]);
  useEffect(()=>{if(user) supabase.rpc("student_assignment_overview",{p_student_id:user.id}).then(({data})=>setItems(data||[]))},[user]);
  const submitted=items.filter(x=>["WAITING_REVIEW","GRADED","LATE"].includes(x.computed_status)).length;
  const progress=items.filter(x=>x.computed_status==="IN_PROGRESS").length;
  const overdue=items.filter(x=>x.computed_status==="OVERDUE").length;
  const upcoming=items.filter(x=>!["GRADED","WAITING_REVIEW","LATE"].includes(x.computed_status)).slice(0,5);

  return <>
    <header className="page-header"><div><h1>หน้าหลักนักเรียน</h1><p>งานที่ต้องทำและสถานะล่าสุด</p></div></header>
    <section className="stats-grid">
      <StatCard label="งานทั้งหมด" value={items.length}/>
      <StatCard label="ส่งแล้ว/รอตรวจ" value={submitted}/>
      <StatCard label="กำลังทำ" value={progress}/>
      <StatCard label="เลยกำหนด" value={overdue}/>
    </section>
    <section className="card section"><h2>งานที่ควรทำต่อ</h2>
      <div className="cards-list compact">{upcoming.map(x=><div className="row-card" key={x.assignment_id}><div><b>{x.title}</b><div className="muted small">{x.course_name} • {thaiDate(x.due_at)}</div></div><StatusBadge status={x.computed_status as Status}/></div>)}</div>
      {upcoming.length===0&&<div className="empty">ไม่มีงานค้าง 🎉</div>}
    </section>
  </>;
}

import { useEffect,useMemo,useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import StatusBadge from "../../components/StatusBadge";
import { Status } from "../../lib/status";
import { thaiDate } from "../../lib/utils";

export default function StudentCourseAssignmentsPage(){
  const {courseId=""}=useParams();
  const [items,setItems]=useState<any[]>([]);
  const [filter,setFilter]=useState("ALL");

  useEffect(()=>{
    supabase.rpc("student_course_assignment_history_v1",{p_course_id:courseId})
      .then(({data})=>setItems(data||[]));
  },[courseId]);

  const shown=useMemo(()=>filter==="ALL"?items:items.filter(x=>x.computed_status===filter),[items,filter]);
  const courseName=items[0]?.course_name||"รายวิชา";
  const archived=!!items[0]?.course_archived;

  return <>
    <Link className="back-link" to="/student/assignments">← กลับไปงานของฉัน</Link>
    <header className="page-header"><div><h1>{courseName}</h1><p>{archived?"ประวัติงานของรายวิชาที่จบแล้ว":"งานทั้งหมดของรายวิชานี้"}</p></div></header>
    {archived&&<div className="notice">รายวิชานี้ถูกเก็บถาวรแล้ว เปิดดูงานและคะแนนเก่าได้ แต่ไม่สามารถส่งงานใหม่</div>}
    <div className="toolbar"><select value={filter} onChange={e=>setFilter(e.target.value)}>
      <option value="ALL">ทุกสถานะ</option><option value="NOT_STARTED">ยังไม่เริ่ม</option><option value="IN_PROGRESS">กำลังทำ</option><option value="WAITING_REVIEW">รอตรวจ</option><option value="GRADED">ตรวจแล้ว</option><option value="REVISION_REQUIRED">ต้องแก้ไข</option><option value="LATE">ส่งล่าช้า</option><option value="OVERDUE">เลยกำหนด</option>
    </select></div>
    <div className="cards-list section">{shown.map(x=><article className="card assignment-card" key={x.assignment_id}><div><h3>{x.title}</h3><div className="muted">{x.classroom_name}</div><div className="small top-gap">กำหนดส่ง: {thaiDate(x.due_at)} • {x.max_score} คะแนน</div></div><div className="assignment-actions"><StatusBadge status={x.computed_status as Status}/><Link className="btn primary" to={`/student/assignments/${x.assignment_id}`}>ดูงาน</Link></div></article>)}{shown.length===0&&<div className="empty card">ไม่มีงานในสถานะนี้</div>}</div>
  </>;
}

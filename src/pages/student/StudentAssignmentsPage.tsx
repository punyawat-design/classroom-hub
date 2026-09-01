import { useEffect,useMemo,useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { Status, statusLabel } from "../../lib/status";

export default function StudentAssignmentsPage(){
  const {user}=useAuth();
  const [items,setItems]=useState<any[]>([]);

  useEffect(()=>{if(user) supabase.rpc("student_assignment_overview",{p_student_id:user.id}).then(({data})=>setItems(data||[]))},[user]);

  const groups=useMemo(()=>{
    const map=new Map<string,{course_id:string;course_name:string;items:any[]}>();
    items.forEach(x=>{
      const key=x.course_id||x.course_name;
      if(!map.has(key))map.set(key,{course_id:x.course_id,course_name:x.course_name,items:[]});
      map.get(key)!.items.push(x);
    });
    return [...map.values()];
  },[items]);

  const activeStatuses:Status[]=["NOT_STARTED","IN_PROGRESS","REVISION_REQUIRED","OVERDUE"];

  return <>
    <header className="page-header"><div><h1>งานของฉัน</h1><p>เลือกวิชาก่อน แล้วค่อยดูงานของวิชานั้น</p></div></header>
    <div className="course-grid section">
      {groups.map(g=>{
        const remaining=g.items.filter(x=>activeStatuses.includes(x.computed_status as Status)).length;
        const overdue=g.items.filter(x=>x.computed_status==="OVERDUE").length;
        return <Link className="card course-work-card" key={g.course_id||g.course_name} to={`/student/assignments/course/${g.course_id}`}>
          <div className="course-icon">📘</div>
          <div><h3>{g.course_name}</h3><div className="muted small">งานทั้งหมด {g.items.length} งาน</div></div>
          <div className="course-count"><b>{remaining}</b><span>งานที่ต้องทำ</span>{overdue>0&&<em>{overdue} เลยกำหนด</em>}</div>
        </Link>
      })}
      {groups.length===0&&<div className="empty card">ยังไม่มีงานที่ได้รับมอบหมาย</div>}
    </div>
  </>;
}

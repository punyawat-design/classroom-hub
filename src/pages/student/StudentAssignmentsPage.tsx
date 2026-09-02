import { useEffect,useMemo,useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2,ClipboardList } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { Status } from "../../lib/status";

const doneStatuses:Status[]=["WAITING_REVIEW","GRADED","LATE"];
const activeStatuses:Status[]=["NOT_STARTED","IN_PROGRESS","REVISION_REQUIRED","OVERDUE"];

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

  const overallDone=items.filter(x=>doneStatuses.includes(x.computed_status as Status)).length;
  const overallTotal=items.length;
  const overallRemaining=Math.max(overallTotal-overallDone,0);
  const overallPercent=overallTotal?Math.round((overallDone/overallTotal)*100):0;

  return <>
    <header className="page-header"><div><h1>งานของฉัน</h1><p>ดูจำนวนงานที่ทำแล้วและงานที่ยังเหลือในแต่ละรายวิชา</p></div></header>

    <section className="student-work-summary section">
      <div className="card work-summary-main">
        <div className="work-summary-icon"><ClipboardList size={26}/></div>
        <div><span>ความคืบหน้าทั้งหมด</span><strong>{overallDone}/{overallTotal}</strong><small>ทำแล้ว {overallDone} งาน • เหลือ {overallRemaining} งาน</small></div>
        <div className="work-summary-percent">{overallPercent}%</div>
        <div className="work-summary-track"><i style={{width:`${overallPercent}%`}}/></div>
      </div>
    </section>

    <div className="course-grid section">
      {groups.map(g=>{
        const done=g.items.filter(x=>doneStatuses.includes(x.computed_status as Status)).length;
        const remaining=g.items.filter(x=>activeStatuses.includes(x.computed_status as Status)).length;
        const overdue=g.items.filter(x=>x.computed_status==="OVERDUE").length;
        const total=g.items.length;
        const percent=total?Math.round((done/total)*100):0;
        const allDone=total>0&&done===total;

        return <Link className={`card course-work-card progress-course-card ${allDone?"all-done":""}`} key={g.course_id||g.course_name} to={`/student/assignments/course/${g.course_id}`}>
          <div className="course-icon">{allDone?<CheckCircle2 size={27}/>:"📘"}</div>
          <div className="progress-course-copy">
            <h3>{g.course_name}</h3>
            <div className="muted small">งานทั้งหมด {total} งาน • เหลือ {remaining} งาน</div>
            <div className="course-progress-track"><i style={{width:`${percent}%`}}/></div>
          </div>
          <div className="course-count course-count-ratio">
            <b>{done}/{total}</b>
            <span>{allDone?"ทำครบแล้ว 🎉":"งานที่ทำแล้ว"}</span>
            {overdue>0&&<em>{overdue} เลยกำหนด</em>}
          </div>
        </Link>;
      })}
      {groups.length===0&&<div className="empty card">ยังไม่มีงานที่ได้รับมอบหมาย</div>}
    </div>
  </>;
}

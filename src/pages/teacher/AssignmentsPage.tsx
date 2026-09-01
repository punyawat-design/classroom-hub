import { useEffect,useMemo,useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { errText } from "../../lib/utils";

export default function AssignmentsPage(){
  const [courses,setCourses]=useState<any[]>([]);
  const [assignments,setAssignments]=useState<any[]>([]);
  const [message,setMessage]=useState("");

  useEffect(()=>{(async()=>{
    const [{data:c,error:ce},{data:a,error:ae}]=await Promise.all([
      supabase.from("courses").select("id,name,created_at,archived_at").is("archived_at",null).order("name"),
      supabase.from("assignments").select("id,course_id,due_at")
    ]);
    if(ce||ae){
      setMessage(errText(ce||ae));
      return;
    }
    setCourses(c||[]);
    setAssignments(a||[]);
  })()},[]);

  const stats=useMemo(()=>{
    const map=new Map<string,{total:number;upcoming:number}>();
    const now=Date.now();
    courses.forEach(c=>map.set(c.id,{total:0,upcoming:0}));
    assignments.forEach(a=>{
      const s=map.get(a.course_id)||{total:0,upcoming:0};
      s.total++;
      if(new Date(a.due_at).getTime()>=now)s.upcoming++;
      map.set(a.course_id,s);
    });
    return map;
  },[courses,assignments]);

  return <>
    <header className="page-header">
      <div>
        <h1>งาน / Assignment</h1>
        <p>เลือกวิชาก่อน แล้วค่อยจัดการงานของวิชานั้น</p>
      </div>
    </header>

    {message&&<div className="error">{message}</div>}

    <div className="course-grid section">
      {courses.map(c=>{
        const s=stats.get(c.id)||{total:0,upcoming:0};
        return <Link key={c.id} className="card course-work-card teacher-course-card" to={`/teacher/assignments/course/${c.id}`}>
          <div className="course-icon">📚</div>
          <div>
            <h3>{c.name}</h3>
            <div className="muted small">กดเพื่อดูและจัดการงานในวิชานี้</div>
          </div>
          <div className="course-count">
            <b>{s.total}</b>
            <span>งานทั้งหมด</span>
            {s.upcoming>0&&<em>{s.upcoming} งานที่ยังไม่ถึงกำหนด</em>}
          </div>
        </Link>
      })}
      {courses.length===0&&<div className="empty card">ยังไม่มีรายวิชา กรุณาสร้างรายวิชาก่อน</div>}
    </div>
  </>;
}

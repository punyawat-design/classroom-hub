import { useEffect,useMemo,useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { errText } from "../../lib/utils";

export default function GradingPage(){
  const [rows,setRows]=useState<any[]>([]);
  const [message,setMessage]=useState("");

  useEffect(()=>{supabase.rpc("teacher_pending_submissions").then(({data,error})=>{
    if(error)setMessage(errText(error)); else setRows(data||[]);
  })},[]);

  const groups=useMemo(()=>{
    const map=new Map<string,{course_id:string;course_name:string;count:number}>();
    rows.forEach(x=>{
      if(!map.has(x.course_id))map.set(x.course_id,{course_id:x.course_id,course_name:x.course_name,count:0});
      map.get(x.course_id)!.count++;
    });
    return [...map.values()];
  },[rows]);

  return <>
    <header className="page-header"><div><h1>ตรวจงาน</h1><p>เลือกวิชาก่อน แล้วดูเฉพาะงานที่รอตรวจของวิชานั้น</p></div></header>
    {message&&<div className="error">{message}</div>}
    {groups.length>0?<div className="course-grid section">{groups.map(g=><Link className="card course-work-card" key={g.course_id} to={`/teacher/grading/course/${g.course_id}`}>
      <div className="course-icon">📝</div><div><h3>{g.course_name}</h3><div className="muted small">กดเพื่อเริ่มตรวจงาน</div></div>
      <div className="course-count"><b>{g.count}</b><span>งานรอตรวจ</span></div>
    </Link>)}</div>:<div className="great-job section"><div>🏆</div><h2>เก่งมาก!</h2><p>ตอนนี้ไม่มีงานค้างให้ตรวจแล้ว</p></div>}
  </>;
}

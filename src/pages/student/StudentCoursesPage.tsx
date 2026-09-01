import { useEffect,useMemo,useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { errText } from "../../lib/utils";
import { useToast } from "../../context/ToastContext";

export default function StudentCoursesPage(){
  const [courses,setCourses]=useState<any[]>([]);
  const [materials,setMaterials]=useState<any[]>([]);
  const [announcements,setAnnouncements]=useState<any[]>([]);
  const {toast}=useToast();

  useEffect(()=>{(async()=>{
    const [{data:c,error:ce},{data:m,error:me},{data:a,error:ae}] = await Promise.all([
      supabase.from("courses").select("id,name,archived_at").order("name"),
      supabase.from("learning_materials").select("id,course_id"),
      supabase.from("announcements").select("id,course_id")
    ]);
    if(ce||me||ae){toast("โหลดข้อมูลไม่สำเร็จ",errText(ce||me||ae),"error");return;}
    setCourses(c||[]);setMaterials(m||[]);setAnnouncements(a||[]);
  })()},[]);

  const stats=useMemo(()=>{
    const map=new Map<string,{materials:number;announcements:number}>();
    courses.forEach(c=>map.set(c.id,{materials:0,announcements:0}));
    materials.forEach((m:any)=>{const s=map.get(m.course_id)||{materials:0,announcements:0};s.materials++;map.set(m.course_id,s);});
    announcements.forEach((a:any)=>{const s=map.get(a.course_id)||{materials:0,announcements:0};s.announcements++;map.set(a.course_id,s);});
    return map;
  },[courses,materials,announcements]);

  const active=courses.filter(c=>!c.archived_at);
  const archived=courses.filter(c=>!!c.archived_at);

  function card(c:any){
    const s=stats.get(c.id)||{materials:0,announcements:0};
    return <Link key={c.id} className="card course-work-card" to={`/student/courses/${c.id}`}>
      <div className="course-icon">📘</div>
      <div><h3>{c.name}</h3><div className="muted small">กดเพื่อดูสื่อและประกาศของวิชานี้</div></div>
      <div className="course-count"><b>{s.materials}</b><span>สื่อการสอน</span>{s.announcements>0&&<em>{s.announcements} ประกาศ</em>}</div>
    </Link>;
  }

  return <>
    <header className="page-header"><div><h1>รายวิชาและสื่อ</h1><p>เลือกวิชาก่อน แล้วค่อยดูสื่อและประกาศของวิชานั้น</p></div><Link className="btn primary" to="/student/join-course"><KeyRound size={17}/> เข้าร่วมด้วยรหัส</Link></header>

    <section className="section"><h2>รายวิชาของฉัน</h2><div className="course-grid">{active.map(card)}{active.length===0&&<div className="empty card">ยังไม่มีรายวิชาที่กำลังเรียน</div>}</div></section>

    {archived.length>0&&<details className="card section"><summary><b>รายวิชาที่จบ/เก็บถาวร ({archived.length})</b></summary><div className="course-grid top-gap">{archived.map(card)}</div></details>}
  </>;
}

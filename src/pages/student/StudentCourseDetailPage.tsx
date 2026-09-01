import { useEffect,useMemo,useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { errText, thaiDate } from "../../lib/utils";
import MaterialViewer, { MaterialItem } from "../../components/MaterialViewer";
import { useToast } from "../../context/ToastContext";

export default function StudentCourseDetailPage(){
  const {courseId=""}=useParams();
  const [course,setCourse]=useState<any|null>(null);
  const [materials,setMaterials]=useState<any[]>([]);
  const [announcements,setAnnouncements]=useState<any[]>([]);
  const [selected,setSelected]=useState<MaterialItem|null>(null);
  const {toast}=useToast();

  useEffect(()=>{(async()=>{
    const [{data:c,error:ce},{data:m,error:me},{data:a,error:ae}] = await Promise.all([
      supabase.from("courses").select("id,name,archived_at").eq("id",courseId).maybeSingle(),
      supabase.from("learning_materials").select("id,title,description,link_url,file_name,storage_path,course_id,courses(name)").eq("course_id",courseId).order("created_at",{ascending:false}),
      supabase.from("announcements").select("id,title,body,created_at,course_id,classroom_id,courses(name),classrooms(name)").eq("course_id",courseId).order("created_at",{ascending:false}).limit(30)
    ]);
    if(ce||me||ae){toast("โหลดข้อมูลไม่สำเร็จ",errText(ce||me||ae),"error");return;}
    setCourse(c||null);setMaterials(m||[]);setAnnouncements(a||[]);
  })()},[courseId]);

  const announcementText=useMemo(()=>announcements.length===0?"ยังไม่มีประกาศในวิชานี้":"",[announcements]);

  return <>
    <Link className="back-link" to="/student/courses">← กลับไปเลือกรายวิชา</Link>
    <header className="page-header"><div><h1>{course?.name||"รายวิชา"}</h1><p>สื่อการสอนและประกาศของวิชานี้เท่านั้น</p></div><Link className="btn ghost" to={`/student/assignments/course/${courseId}`}>ดูงานของวิชานี้</Link></header>
    {course?.archived_at&&<div className="notice section">รายวิชานี้ถูกเก็บถาวรแล้ว คุณยังสามารถย้อนดูสื่อและประวัติเดิมได้</div>}

    <section className="section"><h2>สื่อการสอน</h2><div className="cards-list">{materials.map(m=><article className="card material-card" key={m.id}><div><h3>{m.title}</h3><div className="muted small">{m.courses?.name}</div><p>{m.description}</p></div><button className="btn primary" onClick={()=>setSelected(m)}>ดูสื่อ / ดาวน์โหลด</button></article>)}{materials.length===0&&<div className="empty card">วิชานี้ยังไม่มีสื่อการสอน</div>}</div></section>

    <section className="section"><h2>ประกาศล่าสุด</h2><div className="cards-list">{announcements.map(a=><article className="card" key={a.id}><h3>{a.title}</h3><div className="muted small">{a.classrooms?.name||"ทุกห้อง"} • {thaiDate(a.created_at)}</div><p>{a.body}</p></article>)}{announcementText&&<div className="empty card">{announcementText}</div>}</div></section>

    {selected&&<MaterialViewer item={selected} onClose={()=>setSelected(null)}/>}  
  </>;
}

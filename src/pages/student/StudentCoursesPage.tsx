import { useEffect,useState } from "react";
import { supabase } from "../../lib/supabase";
import { errText, thaiDate } from "../../lib/utils";
import MaterialViewer, { MaterialItem } from "../../components/MaterialViewer";
import { useToast } from "../../context/ToastContext";

export default function StudentCoursesPage(){
  const [courses,setCourses]=useState<any[]>([]);
  const [materials,setMaterials]=useState<any[]>([]);
  const [announcements,setAnnouncements]=useState<any[]>([]);
  const [selected,setSelected]=useState<MaterialItem|null>(null);
  const {toast}=useToast();

  useEffect(()=>{(async()=>{
    const [{data:c,error:ce},{data:m,error:me},{data:a,error:ae}]=await Promise.all([
      supabase.from("courses").select("id,name").order("name"),
      supabase.from("learning_materials").select("id,title,description,link_url,file_name,storage_path,course_id,courses(name)").order("created_at",{ascending:false}),
      supabase.from("announcements").select("id,title,body,created_at,courses(name),classrooms(name)").order("created_at",{ascending:false}).limit(20)
    ]);
    if(ce||me||ae)toast("โหลดข้อมูลไม่สำเร็จ",errText(ce||me||ae),"error");
    else {setCourses(c||[]);setMaterials(m||[]);setAnnouncements(a||[]);}
  })()},[]);

  return <>
    <header className="page-header"><div><h1>รายวิชาและสื่อ</h1><p>เปิด PDF ในเว็บ หรือดาวน์โหลดไฟล์ไปอ่านเอง</p></div></header>
    <section className="section"><h2>รายวิชาของฉัน</h2><div className="course-grid">{courses.map(c=><div className="card course-card" key={c.id}><b>{c.name}</b></div>)}</div></section>
    <section className="section"><h2>สื่อการสอน</h2><div className="cards-list">{materials.map(m=><article className="card material-card" key={m.id}>
      <div><h3>{m.title}</h3><div className="muted small">{m.courses?.name}</div><p>{m.description}</p></div>
      <button className="btn primary" onClick={()=>setSelected(m)}>ดูสื่อ / ดาวน์โหลด</button>
    </article>)}
    {materials.length===0&&<div className="empty card">ยังไม่มีสื่อการสอน</div>}</div></section>
    <section className="section"><h2>ประกาศล่าสุด</h2><div className="cards-list">{announcements.map(a=><article className="card" key={a.id}><h3>{a.title}</h3><div className="muted small">{a.courses?.name||"ทั่วไป"} • {a.classrooms?.name||"ทุกห้อง"} • {thaiDate(a.created_at)}</div><p>{a.body}</p></article>)}</div></section>
    {selected&&<MaterialViewer item={selected} onClose={()=>setSelected(null)}/>}
  </>;
}

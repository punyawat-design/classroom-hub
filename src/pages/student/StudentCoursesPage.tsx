import { useEffect,useState } from "react";
import { supabase } from "../../lib/supabase";
import { errText, thaiDate } from "../../lib/utils";

export default function StudentCoursesPage(){
  const [courses,setCourses]=useState<any[]>([]);
  const [materials,setMaterials]=useState<any[]>([]);
  const [announcements,setAnnouncements]=useState<any[]>([]);
  const [message,setMessage]=useState("");

  useEffect(()=>{(async()=>{
    const [{data:c,error:ce},{data:m,error:me},{data:a,error:ae}]=await Promise.all([
      supabase.from("courses").select("id,name").order("name"),
      supabase.from("learning_materials").select("id,title,description,link_url,file_name,storage_path,course_id,courses(name)").order("created_at",{ascending:false}),
      supabase.from("announcements").select("id,title,body,created_at,courses(name),classrooms(name)").order("created_at",{ascending:false}).limit(20)
    ]);
    if(ce||me||ae)setMessage(errText(ce||me||ae)); else {setCourses(c||[]);setMaterials(m||[]);setAnnouncements(a||[]);}
  })()},[]);

  async function openMaterial(path:string){
    const {data,error}=await supabase.storage.from("materials").createSignedUrl(path,120);
    if(error)setMessage(errText(error)); else window.open(data.signedUrl,"_blank","noopener,noreferrer");
  }

  return <>
    <header className="page-header"><div><h1>รายวิชาและสื่อ</h1><p>สื่อการสอนและประกาศที่เกี่ยวข้องกับคุณ</p></div></header>
    {message&&<div className="error">{message}</div>}
    <section className="section"><h2>รายวิชาของฉัน</h2><div className="course-grid">{courses.map(c=><div className="card course-card" key={c.id}><b>{c.name}</b></div>)}</div></section>
    <section className="section"><h2>สื่อการสอน</h2><div className="cards-list">{materials.map(m=><article className="card" key={m.id}><h3>{m.title}</h3><div className="muted small">{m.courses?.name}</div><p>{m.description}</p><div className="actions">{m.link_url&&<a className="btn ghost" href={m.link_url} target="_blank" rel="noreferrer">เปิดลิงก์</a>}{m.storage_path&&<button className="btn primary" onClick={()=>openMaterial(m.storage_path)}>ดาวน์โหลด {m.file_name}</button>}</div></article>)}</div></section>
    <section className="section"><h2>ประกาศล่าสุด</h2><div className="cards-list">{announcements.map(a=><article className="card" key={a.id}><h3>{a.title}</h3><div className="muted small">{a.courses?.name||"ทั่วไป"} • {a.classrooms?.name||"ทุกห้อง"} • {thaiDate(a.created_at)}</div><p>{a.body}</p></article>)}</div></section>
  </>;
}

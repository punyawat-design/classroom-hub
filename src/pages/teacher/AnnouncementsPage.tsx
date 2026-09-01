import { useEffect,useState } from "react";
import { supabase } from "../../lib/supabase";
import { errText, thaiDate } from "../../lib/utils";
import { useToast } from "../../context/ToastContext";

export default function AnnouncementsPage(){
  const {toast}=useToast();
  const [courses,setCourses]=useState<any[]>([]);
  const [rooms,setRooms]=useState<any[]>([]);
  const [items,setItems]=useState<any[]>([]);
  const [message,setMessage]=useState("");

  async function load(){
    const [{data:c},{data:r},{data:a,error}]=await Promise.all([
      supabase.from("courses").select("id,name").order("name"),
      supabase.from("classrooms").select("id,name").order("name"),
      supabase.from("announcements").select("id,title,body,created_at,courses(name),classrooms(name)").order("created_at",{ascending:false})
    ]);
    setCourses(c||[]);setRooms(r||[]);
    if(error)setMessage(errText(error)); else setItems(a||[]);
  }
  useEffect(()=>{load()},[]);

  async function create(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setMessage("");
    const fd=new FormData(e.currentTarget);
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return;
    const {error}=await supabase.from("announcements").insert({
      teacher_id:user.id,
      course_id:String(fd.get("course_id")||"")||null,
      classroom_id:String(fd.get("classroom_id")||"")||null,
      title:String(fd.get("title")),
      body:String(fd.get("body"))
    });
    if(error)setMessage(errText(error)); else {setMessage("โพสต์ประกาศแล้ว");toast("โพสต์ประกาศแล้ว","","success");e.currentTarget.reset();load();}
  }

  return <>
    <header className="page-header"><div><h1>ประกาศ</h1><p>สื่อสารกับนักเรียนตามรายวิชาหรือห้อง</p></div></header>
    {message&&<div className={message.includes("แล้ว")?"success":"notice"}>{message}</div>}
    <form className="card form section" onSubmit={create}>
      <div className="two-col"><label className="field"><span>รายวิชา (ไม่บังคับ)</span><select name="course_id"><option value="">ทั้งหมด/ไม่ระบุ</option>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="field"><span>ห้อง (ไม่บังคับ)</span><select name="classroom_id"><option value="">ทั้งหมด/ไม่ระบุ</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label></div>
      <label className="field"><span>หัวข้อ</span><input name="title" required/></label>
      <label className="field"><span>ข้อความ</span><textarea name="body" rows={4} required/></label>
      <button className="btn primary">โพสต์ประกาศ</button>
    </form>
    <div className="cards-list section">{items.map(x=><article className="card" key={x.id}><h3>{x.title}</h3><div className="muted small">{x.courses?.name||"ทุกวิชา"} • {x.classrooms?.name||"ทุกห้อง"} • {thaiDate(x.created_at)}</div><p>{x.body}</p></article>)}</div>
  </>;
}
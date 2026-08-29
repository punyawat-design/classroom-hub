import { useEffect,useState } from "react";
import { supabase } from "../../lib/supabase";
import { errText } from "../../lib/utils";

export default function CoursesPage(){
  const [courses,setCourses]=useState<any[]>([]);
  const [rooms,setRooms]=useState<any[]>([]);
  const [name,setName]=useState("");
  const [roomId,setRoomId]=useState("");
  const [message,setMessage]=useState("");

  async function load(){
    const [{data:c,error:ce},{data:r,error:re}]=await Promise.all([
      supabase.from("courses").select("id,name,created_at").order("name"),
      supabase.from("classrooms").select("id,name").order("name")
    ]);
    if(ce||re)setMessage(errText(ce||re)); else {setCourses(c||[]);setRooms(r||[]);}
  }
  useEffect(()=>{load()},[]);

  async function create(e:React.FormEvent){
    e.preventDefault(); setMessage("");
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return;
    const {data,error}=await supabase.from("courses").insert({name,teacher_id:user.id}).select().single();
    if(error){setMessage(errText(error));return;}
    if(roomId){
      const {error:linkError}=await supabase.from("course_classrooms").insert({course_id:data.id,classroom_id:roomId});
      if(linkError){setMessage(errText(linkError));return;}
    }
    setName("");setRoomId("");setMessage("สร้างรายวิชาแล้ว");load();
  }

  return <>
    <header className="page-header"><div><h1>รายวิชา</h1><p>สร้างรายวิชาและผูกกับห้องเรียน</p></div></header>
    {message&&<div className={message.includes("แล้ว")?"success":"notice"}>{message}</div>}
    <form className="card form section" onSubmit={create}>
      <h2>สร้างรายวิชา</h2>
      <label className="field"><span>ชื่อรายวิชา</span><input value={name} onChange={e=>setName(e.target.value)} required/></label>
      <label className="field"><span>ผูกกับห้อง (เลือกได้)</span><select value={roomId} onChange={e=>setRoomId(e.target.value)}><option value="">ยังไม่ผูก</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <button className="btn primary">สร้างรายวิชา</button>
    </form>
    <div className="cards-list section">{courses.map(c=><div className="card row-card" key={c.id}><b>{c.name}</b></div>)}</div>
  </>;
}

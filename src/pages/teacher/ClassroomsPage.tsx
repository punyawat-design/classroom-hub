import { useEffect,useState } from "react";
import { Link } from "react-router-dom";
import { FileSpreadsheet } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { errText } from "../../lib/utils";
import { useToast } from "../../context/ToastContext";

export default function ClassroomsPage(){
  const {toast}=useToast();
  const [rooms,setRooms]=useState<any[]>([]);
  const [selected,setSelected]=useState("");
  const [students,setStudents]=useState<any[]>([]);
  const [name,setName]=useState("");
  const [code,setCode]=useState("");
  const [message,setMessage]=useState("");

  async function loadRooms(){
    const {data,error}=await supabase.from("classrooms").select("id,name,created_at").order("name");
    if(error)setMessage(errText(error)); else setRooms(data||[]);
  }

  async function loadStudents(id:string){
    setSelected(id);setStudents([]);
    if(!id)return;
    const {data,error}=await supabase.rpc("teacher_classroom_students",{p_classroom_id:id});
    if(error)setMessage(errText(error)); else setStudents(data||[]);
  }

  useEffect(()=>{loadRooms()},[]);

  async function createRoom(e:React.FormEvent){
    e.preventDefault();setMessage("");
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return;
    const {error}=await supabase.from("classrooms").insert({name,teacher_id:user.id});
    if(error)setMessage(errText(error)); else {setName("");setMessage("สร้างห้องเรียนแล้ว");toast("สร้างห้องเรียนแล้ว","","success");await loadRooms();}
  }

  async function enroll(e:React.FormEvent){
    e.preventDefault();if(!selected)return;
    const {data,error}=await supabase.rpc("teacher_enroll_student_by_code",{p_classroom_id:selected,p_student_code:code.trim()});
    if(error)setMessage(errText(error)); else {setMessage(String(data));setCode("");await loadStudents(selected);}
  }

  return <>
    <header className="page-header"><div><h1>ห้องเรียน</h1><p>สร้างห้อง เพิ่มนักเรียนทีละคน หรือ Import Excel/CSV</p></div><Link className="btn primary" to="/teacher/import-students"><FileSpreadsheet size={17}/> นำเข้า Excel/CSV</Link></header>
    {message&&<div className={message.includes("แล้ว")?"success":"notice"}>{message}</div>}

    <div className="two-col section">
      <form className="card form" onSubmit={createRoom}><h2>สร้างห้องเรียน</h2><label className="field"><span>ชื่อห้อง</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="เช่น ปวช.2/1" required/></label><button className="btn primary">สร้างห้อง</button></form>
      <div className="card"><h2>เลือกห้อง</h2><label className="field"><span>ห้องเรียน</span><select value={selected} onChange={e=>loadStudents(e.target.value)}><option value="">เลือกห้อง</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>{selected&&<form className="inline-form" onSubmit={enroll}><input value={code} onChange={e=>setCode(e.target.value)} placeholder="รหัสนักเรียน" required/><button className="btn primary">เพิ่มเข้าห้อง</button></form>}</div>
    </div>

    {selected&&<div className="table-card section"><table><thead><tr><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>ชื่อเล่น</th></tr></thead><tbody>{students.map(s=><tr key={s.student_id}><td>{s.student_code||"-"}</td><td>{s.full_name}</td><td>{s.nickname||"-"}</td></tr>)}</tbody></table>{students.length===0&&<div className="empty">ยังไม่มีนักเรียนในห้องนี้</div>}</div>}
  </>;
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { errText } from "../../lib/utils";
import { useToast } from "../../context/ToastContext";

export default function JoinCoursePage(){
  const [code,setCode]=useState("");
  const [busy,setBusy]=useState(false);
  const {toast}=useToast();
  const navigate=useNavigate();

  async function join(e:React.FormEvent){
    e.preventDefault();
    if(!code.trim())return;
    setBusy(true);
    const {data,error}=await supabase.rpc("student_join_course_by_code_v1",{
      p_join_code:code.trim().toUpperCase()
    });
    setBusy(false);
    if(error){toast("เข้าร่วมรายวิชาไม่สำเร็จ",errText(error),"error");return;}
    toast("เข้าร่วมรายวิชาแล้ว",data?.course_name||"","success");
    if(data?.course_id)navigate(`/student/courses/${data.course_id}`);
    else navigate("/student/courses");
  }

  return <>
    <header className="page-header"><div><h1>เข้าร่วมรายวิชา</h1><p>ใส่รหัสรายวิชาที่ได้รับจากครู</p></div></header>
    <form className="card join-course-card section" onSubmit={join}>
      <div className="join-icon"><KeyRound size={30}/></div>
      <label className="field"><span>รหัสเข้าร่วม</span><input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="เช่น A1B2C3D4" maxLength={12} required/></label>
      <button className="btn primary wide" disabled={busy}>{busy?"กำลังเข้าร่วม...":"เข้าร่วมรายวิชา"}</button>
    </form>
  </>;
}

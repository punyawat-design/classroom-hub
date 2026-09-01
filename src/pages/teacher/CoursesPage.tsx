import { useEffect,useMemo,useState } from "react";
import { supabase } from "../../lib/supabase";
import { errText, thaiDate } from "../../lib/utils";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";

export default function CoursesPage(){
  const {toast}=useToast();
  const {confirm}=useConfirm();
  const [courses,setCourses]=useState<any[]>([]);
  const [rooms,setRooms]=useState<any[]>([]);
  const [name,setName]=useState("");
  const [roomId,setRoomId]=useState("");
  const [selectedCourse,setSelectedCourse]=useState("");
  const [roster,setRoster]=useState<any[]>([]);
  const [available,setAvailable]=useState<any[]>([]);
  const [studentCode,setStudentCode]=useState("");
  const [search,setSearch]=useState("");
  const [message,setMessage]=useState("");

  async function load(){
    const [{data:c,error:ce},{data:r,error:re}]=await Promise.all([
      supabase.from("courses").select("id,name,created_at").order("name"),
      supabase.from("classrooms").select("id,name").order("name")
    ]);
    if(ce||re)setMessage(errText(ce||re)); else {setCourses(c||[]);setRooms(r||[]);}
  }

  async function loadRoster(courseId:string){
    setSelectedCourse(courseId);setRoster([]);setAvailable([]);
    if(!courseId)return;
    const [{data:r,error:re},{data:a,error:ae}]=await Promise.all([
      supabase.rpc("teacher_course_roster",{p_course_id:courseId}),
      supabase.rpc("teacher_course_available_students",{p_course_id:courseId})
    ]);
    if(re||ae){toast("โหลดรายชื่อนักเรียนไม่สำเร็จ",errText(re||ae),"error");return;}
    setRoster(r||[]);setAvailable(a||[]);
  }

  useEffect(()=>{load()},[]);

  async function create(e:React.FormEvent){
    e.preventDefault();setMessage("");
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return;
    const {data,error}=await supabase.from("courses").insert({name,teacher_id:user.id}).select().single();
    if(error){toast("สร้างรายวิชาไม่สำเร็จ",errText(error),"error");return;}

    if(roomId){
      await supabase.from("course_classrooms").upsert({course_id:data.id,classroom_id:roomId},{onConflict:"course_id,classroom_id"});
      const {error:enrollError}=await supabase.rpc("teacher_enroll_classroom_to_course",{p_course_id:data.id,p_classroom_id:roomId});
      if(enrollError){toast("สร้างวิชาแล้ว แต่ดึงนักเรียนเข้าวิชาไม่ครบ",errText(enrollError),"error");}
    }

    setName("");setRoomId("");toast("สร้างรายวิชาแล้ว",roomId?"นักเรียนในห้องที่เลือกถูกดึงเข้ารายวิชาแล้ว":"","success");
    await load();
  }

  async function addByCode(){
    if(!selectedCourse||!studentCode.trim())return;
    const {data,error}=await supabase.rpc("teacher_enroll_student_to_course",{p_course_id:selectedCourse,p_student_code:studentCode.trim()});
    if(error)toast("เพิ่มนักเรียนไม่สำเร็จ",errText(error),"error");
    else{toast("เพิ่มนักเรียนแล้ว",String(data||""),"success");setStudentCode("");loadRoster(selectedCourse);}
  }

  async function addStudent(student:any){
    const {data,error}=await supabase.rpc("teacher_enroll_student_to_course",{p_course_id:selectedCourse,p_student_code:student.student_code});
    if(error)toast("เพิ่มนักเรียนไม่สำเร็จ",errText(error),"error");
    else{toast("เพิ่มนักเรียนแล้ว",student.full_name,"success");loadRoster(selectedCourse);}
  }

  async function withdraw(student:any){
    const ok=await confirm({
      title:"ถอนนักเรียนออกจากรายวิชา?",
      message:`${student.full_name} จะไม่เห็นงานและสื่อใหม่ของรายวิชานี้ แต่ประวัติการส่งงานเดิมยังเก็บไว้`,
      confirmText:"ถอนออก",
      danger:true
    });
    if(!ok)return;
    const {error}=await supabase.rpc("teacher_withdraw_student_from_course",{p_course_id:selectedCourse,p_student_id:student.student_id});
    if(error)toast("ถอนนักเรียนไม่สำเร็จ",errText(error),"error");
    else{toast("ถอนนักเรียนแล้ว",student.full_name,"success");loadRoster(selectedCourse);}
  }

  async function completeCourse(){
    const course=courses.find(c=>c.id===selectedCourse);
    if(!course)return;
    const ok=await confirm({
      title:"จบรายวิชาและถอนนักเรียนทั้งหมด?",
      message:`นักเรียนทั้งหมดใน “${course.name}” จะถูกเปลี่ยนเป็นสถานะถอน/เรียนจบ แต่ประวัติงานและคะแนนยังคงอยู่`,
      confirmText:"จบรายวิชา",
      danger:true
    });
    if(!ok)return;
    const {data,error}=await supabase.rpc("teacher_complete_course",{p_course_id:selectedCourse});
    if(error)toast("ดำเนินการไม่สำเร็จ",errText(error),"error");
    else{toast("จบรายวิชาแล้ว",`${data||0} คนถูกถอนออกจากรายวิชา`,"success");loadRoster(selectedCourse);}
  }

  const shownAvailable=useMemo(()=>{
    const q=search.trim().toLowerCase();
    if(!q)return available;
    return available.filter(x=>String(x.full_name||"").toLowerCase().includes(q)||String(x.student_code||"").toLowerCase().includes(q));
  },[available,search]);

  return <>
    <header className="page-header"><div><h1>รายวิชา</h1><p>สร้างวิชา ดึงนักเรียนเข้าวิชา และถอนออกเมื่อเรียนจบได้</p></div></header>
    {message&&<div className="notice">{message}</div>}

    <form className="card form section" onSubmit={create}>
      <h2>สร้างรายวิชา</h2>
      <label className="field"><span>ชื่อรายวิชา</span><input value={name} onChange={e=>setName(e.target.value)} required/></label>
      <label className="field"><span>ดึงนักเรียนจากห้องเข้าวิชาทันที (เลือกได้)</span>
        <select value={roomId} onChange={e=>setRoomId(e.target.value)}>
          <option value="">ยังไม่ดึงจากห้อง</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </label>
      <button className="btn primary">สร้างรายวิชา</button>
    </form>

    <section className="card section">
      <div className="course-roster-head">
        <div><h2>จัดนักเรียนในรายวิชา</h2><p className="muted">นักเรียน 1 คนสามารถอยู่หลายรายวิชาได้</p></div>
        {selectedCourse&&<button className="btn danger" onClick={completeCourse}>จบรายวิชา / ถอนทั้งหมด</button>}
      </div>
      <label className="field"><span>เลือกรายวิชา</span>
        <select value={selectedCourse} onChange={e=>loadRoster(e.target.value)}>
          <option value="">เลือกรายวิชา</option>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      {selectedCourse&&<>
        <div className="enroll-by-code">
          <input value={studentCode} onChange={e=>setStudentCode(e.target.value)} placeholder="ใส่รหัสนักเรียน เช่น 999" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addByCode();}}}/>
          <button className="btn primary" onClick={addByCode}>เพิ่มด้วยรหัส</button>
        </div>

        <div className="course-enrollment-grid top-gap">
          <div className="enrollment-pane">
            <div className="pane-title"><b>นักเรียนในรายวิชา</b><span>{roster.filter(x=>x.active).length} คน</span></div>
            {roster.filter(x=>x.active).map(s=><div className="student-manage-row" key={s.student_id}>
              <div><b>{s.full_name}</b><span>{s.student_code||"-"} • เข้าเรียน {thaiDate(s.enrolled_at)}</span></div>
              <button className="btn danger small-btn" onClick={()=>withdraw(s)}>ถอนออก</button>
            </div>)}
            {roster.filter(x=>x.active).length===0&&<div className="empty">ยังไม่มีนักเรียนในรายวิชา</div>}
          </div>

          <div className="enrollment-pane">
            <div className="pane-title"><b>นักเรียนที่เพิ่มได้</b><span>{shownAvailable.length} คน</span></div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหาชื่อหรือรหัสนักเรียน"/>
            <div className="available-list">
              {shownAvailable.map(s=><div className="student-manage-row" key={s.student_id}>
                <div><b>{s.full_name}</b><span>{s.student_code||"-"}{s.classroom_names?` • ${s.classroom_names}`:""}</span></div>
                <button className="btn ghost small-btn" onClick={()=>addStudent(s)}>+ เพิ่ม</button>
              </div>)}
              {shownAvailable.length===0&&<div className="empty">ไม่มีนักเรียนที่สามารถเพิ่มได้</div>}
            </div>
          </div>
        </div>

        {roster.some(x=>!x.active)&&<details className="top-gap">
          <summary><b>ประวัตินักเรียนที่ถอน/เรียนจบแล้ว ({roster.filter(x=>!x.active).length})</b></summary>
          <div className="cards-list top-gap">{roster.filter(x=>!x.active).map(s=><div className="student-manage-row history" key={s.student_id}>
            <div><b>{s.full_name}</b><span>{s.student_code||"-"} • ถอนเมื่อ {thaiDate(s.withdrawn_at)}</span></div>
            <button className="btn ghost small-btn" onClick={()=>addStudent(s)}>ดึงกลับเข้าวิชา</button>
          </div>)}</div>
        </details>}
      </>}
    </section>
  </>;
}

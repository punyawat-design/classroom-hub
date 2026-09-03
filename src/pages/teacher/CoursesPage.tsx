import { useEffect,useMemo,useState } from "react";
import { Link } from "react-router-dom";
import { Archive, ArchiveRestore, Copy, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { errText, thaiDate } from "../../lib/utils";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { deleteCourseDeep } from "../../lib/deleteContent";

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
  const [deletingCourse,setDeletingCourse]=useState(false);

  async function load(){
    const [{data:c,error:ce},{data:r,error:re}]=await Promise.all([
      supabase.from("courses").select("id,name,join_code,archived_at,created_at").order("archived_at",{ascending:true,nullsFirst:true}).order("name"),
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
    const {data,error}=await supabase.from("courses").insert({name,teacher_id:user.id}).select("id,name,join_code").single();
    if(error){toast("สร้างรายวิชาไม่สำเร็จ",errText(error),"error");return;}

    if(roomId){
      await supabase.from("course_classrooms").upsert({course_id:data.id,classroom_id:roomId},{onConflict:"course_id,classroom_id"});
      const {error:enrollError}=await supabase.rpc("teacher_enroll_classroom_to_course",{p_course_id:data.id,p_classroom_id:roomId});
      if(enrollError)toast("สร้างวิชาแล้ว แต่ดึงนักเรียนเข้าวิชาไม่ครบ",errText(enrollError),"error");
    }

    setName("");setRoomId("");
    toast("สร้างรายวิชาแล้ว",`รหัสเข้าร่วม ${data.join_code||"ถูกสร้างแล้ว"}`,"success");
    await load();
    await loadRoster(data.id);
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
    const ok=await confirm({title:"ถอนนักเรียนออกจากรายวิชา?",message:`${student.full_name} จะไม่เห็นงานและสื่อใหม่ แต่ประวัติเดิมยังอยู่`,confirmText:"ถอนออก",danger:true});
    if(!ok)return;
    const {error}=await supabase.rpc("teacher_withdraw_student_from_course",{p_course_id:selectedCourse,p_student_id:student.student_id});
    if(error)toast("ถอนนักเรียนไม่สำเร็จ",errText(error),"error");
    else{toast("ถอนนักเรียนแล้ว",student.full_name,"success");loadRoster(selectedCourse);}
  }

  async function completeCourse(){
    const course=courses.find(c=>c.id===selectedCourse);
    if(!course)return;
    const ok=await confirm({title:"ถอนนักเรียนทั้งหมด?",message:`นักเรียนทั้งหมดใน “${course.name}” จะถูกถอน แต่ประวัติงานและคะแนนยังคงอยู่`,confirmText:"ถอนทั้งหมด",danger:true});
    if(!ok)return;
    const {data,error}=await supabase.rpc("teacher_complete_course",{p_course_id:selectedCourse});
    if(error)toast("ดำเนินการไม่สำเร็จ",errText(error),"error");
    else{toast("ถอนนักเรียนทั้งหมดแล้ว",`${data||0} คน`,"success");loadRoster(selectedCourse);}
  }

  async function toggleArchive(archive:boolean){
    const course=courses.find(c=>c.id===selectedCourse);
    if(!course)return;
    const ok=await confirm({
      title:archive?"เก็บรายวิชานี้เข้าคลัง?":"นำรายวิชากลับมาใช้งาน?",
      message:archive?"วิชาจะถูกซ่อนจากหน้าหลักของนักเรียน แต่งาน คะแนน และสื่อเดิมไม่ถูกลบ":"วิชาจะกลับมาแสดงในหน้าหลักอีกครั้ง",
      confirmText:archive?"เก็บเข้าคลัง":"นำกลับมา"
    });
    if(!ok)return;
    const {error}=await supabase.rpc("teacher_set_course_archived_v1",{p_course_id:selectedCourse,p_archived:archive});
    if(error)toast("ดำเนินการไม่สำเร็จ",errText(error),"error");
    else{toast(archive?"เก็บรายวิชาเข้าคลังแล้ว":"นำรายวิชากลับมาแล้ว","","success");await load();}
  }

  async function deleteCourse(){
    const course=courses.find(c=>c.id===selectedCourse);
    if(!course||deletingCourse)return;

    const ok=await confirm({
      title:"ลบรายวิชาถาวร?",
      message:`วิชา “${course.name}” จะถูกลบพร้อมสื่อ งาน ไฟล์ประกอบ งานที่นักเรียนส่ง คะแนน ประกาศ และรายชื่อนักเรียนในวิชานี้ การลบนี้ย้อนกลับไม่ได้`,
      confirmText:"ลบรายวิชา",
      danger:true
    });
    if(!ok)return;

    setDeletingCourse(true);
    try{
      await deleteCourseDeep(course.id);
      toast("ลบรายวิชาแล้ว",course.name,"success");
      setSelectedCourse("");
      setRoster([]);
      setAvailable([]);
      await load();
    }catch(error){
      toast("ลบรายวิชาไม่สำเร็จ",errText(error),"error");
    }finally{
      setDeletingCourse(false);
    }
  }

  async function regenerateCode(){
    const ok=await confirm({title:"สร้างรหัสเข้าร่วมใหม่?",message:"รหัสเดิมจะใช้เข้าร่วมรายวิชาไม่ได้อีก",confirmText:"สร้างรหัสใหม่"});
    if(!ok)return;
    const {data,error}=await supabase.rpc("teacher_regenerate_course_join_code_v1",{p_course_id:selectedCourse});
    if(error)toast("สร้างรหัสไม่สำเร็จ",errText(error),"error");
    else{toast("สร้างรหัสใหม่แล้ว",String(data||""),"success");await load();}
  }

  async function copyCode(code:string){
    try{await navigator.clipboard.writeText(code);toast("คัดลอกรหัสแล้ว",code,"success");}
    catch{toast("รหัสเข้าร่วม",code,"info");}
  }

  const selected=courses.find(c=>c.id===selectedCourse);
  const activeCourses=courses.filter(c=>!c.archived_at);
  const archivedCourses=courses.filter(c=>!!c.archived_at);

  const shownAvailable=useMemo(()=>{
    const q=search.trim().toLowerCase();
    if(!q)return available;
    return available.filter(x=>String(x.full_name||"").toLowerCase().includes(q)||String(x.nickname||"").toLowerCase().includes(q)||String(x.student_code||"").toLowerCase().includes(q));
  },[available,search]);

  return <>
    <header className="page-header"><div><h1>รายวิชา</h1><p>สร้างวิชา จัดนักเรียน รหัสเข้าร่วม และเก็บวิชาเข้าคลังเมื่อจบภาคเรียน</p></div></header>
    {message&&<div className="notice">{message}</div>}

    <form className="card form section" onSubmit={create}>
      <h2>สร้างรายวิชา</h2>
      <label className="field"><span>ชื่อรายวิชา</span><input value={name} onChange={e=>setName(e.target.value)} required/></label>
      <label className="field"><span>ดึงนักเรียนจากห้องเข้าวิชาทันที (เลือกได้)</span><select value={roomId} onChange={e=>setRoomId(e.target.value)}><option value="">ยังไม่ดึงจากห้อง</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <button className="btn primary">สร้างรายวิชา</button>
    </form>

    <section className="section">
      <h2>รายวิชาที่ใช้งาน</h2>
      <div className="course-grid">{activeCourses.map(c=><button type="button" key={c.id} className={`card course-select-card ${selectedCourse===c.id?"selected":""}`} onClick={()=>loadRoster(c.id)}><div><b>{c.name}</b><span>รหัส {c.join_code}</span></div><strong>จัดการ</strong></button>)}{activeCourses.length===0&&<div className="empty card">ยังไม่มีรายวิชาที่ใช้งาน</div>}</div>
    </section>

    {archivedCourses.length>0&&<details className="card section"><summary><b>รายวิชาที่เก็บถาวร ({archivedCourses.length})</b></summary><div className="course-grid top-gap">{archivedCourses.map(c=><button type="button" key={c.id} className={`card course-select-card archived ${selectedCourse===c.id?"selected":""}`} onClick={()=>loadRoster(c.id)}><div><b>{c.name}</b><span>เก็บเมื่อ {thaiDate(c.archived_at)}</span></div><strong>เปิดดู</strong></button>)}</div></details>}

    {selected&&<section className="card section">
      <div className="course-roster-head">
        <div><h2>{selected.name}</h2><p className="muted">นักเรียน 1 คนสามารถอยู่หลายรายวิชาได้</p></div>
        <div className="actions"><Link className="btn ghost" to={`/teacher/assignments/course/${selected.id}`}>ดูงาน</Link><Link className="btn ghost" to={`/teacher/materials/course/${selected.id}`}>ดูสื่อ</Link>{selected.archived_at?<button className="btn primary" onClick={()=>toggleArchive(false)}><ArchiveRestore size={17}/> นำกลับมาใช้งาน</button>:<button className="btn warning" onClick={()=>toggleArchive(true)}><Archive size={17}/> เก็บเข้าคลัง</button>}<button className="btn danger" onClick={completeCourse}>ถอนนักเรียนทั้งหมด</button><button className="btn danger" onClick={deleteCourse} disabled={deletingCourse}><Trash2 size={17}/> {deletingCourse?"กำลังลบ...":"ลบรายวิชา"}</button></div>
      </div>

      <div className="join-code-box"><div><span>รหัสให้นักเรียนเข้าร่วมวิชา</span><b>{selected.join_code}</b></div><div className="actions"><button className="btn ghost" onClick={()=>copyCode(selected.join_code)}><Copy size={16}/> คัดลอก</button><button className="btn ghost" onClick={regenerateCode}><RefreshCw size={16}/> เปลี่ยนรหัส</button></div></div>

      <div className="enroll-by-code"><input value={studentCode} onChange={e=>setStudentCode(e.target.value)} placeholder="ใส่รหัสนักเรียน เช่น 999" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addByCode();}}}/><button className="btn primary" onClick={addByCode}>เพิ่มด้วยรหัสนักเรียน</button></div>

      <div className="course-enrollment-grid top-gap">
        <div className="enrollment-pane"><div className="pane-title"><b>นักเรียนในรายวิชา</b><span>{roster.filter(x=>x.active).length} คน</span></div>{roster.filter(x=>x.active).map(s=><div className="student-manage-row" key={s.student_id}><div><b>{s.full_name}{s.nickname?` (${s.nickname})`:""}</b><span>{s.student_code||"-"} • เข้าเรียน {thaiDate(s.enrolled_at)}</span></div><button className="btn danger small-btn" onClick={()=>withdraw(s)}>ถอนออก</button></div>)}{roster.filter(x=>x.active).length===0&&<div className="empty">ยังไม่มีนักเรียนในรายวิชา</div>}</div>

        <div className="enrollment-pane"><div className="pane-title"><b>นักเรียนที่เพิ่มได้</b><span>{shownAvailable.length} คน</span></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหาชื่อ ชื่อเล่น หรือรหัสนักเรียน"/><div className="available-list">{shownAvailable.map(s=><div className="student-manage-row" key={s.student_id}><div><b>{s.full_name}{s.nickname?` (${s.nickname})`:""}</b><span>{s.student_code||"-"}{s.classroom_names?` • ${s.classroom_names}`:""}</span></div><button className="btn ghost small-btn" onClick={()=>addStudent(s)}>+ เพิ่ม</button></div>)}{shownAvailable.length===0&&<div className="empty">ไม่มีนักเรียนที่สามารถเพิ่มได้</div>}</div></div>
      </div>

      {roster.some(x=>!x.active)&&<details className="top-gap"><summary><b>ประวัตินักเรียนที่ถอน/เรียนจบแล้ว ({roster.filter(x=>!x.active).length})</b></summary><div className="cards-list top-gap">{roster.filter(x=>!x.active).map(s=><div className="student-manage-row history" key={s.student_id}><div><b>{s.full_name}{s.nickname?` (${s.nickname})`:""}</b><span>{s.student_code||"-"} • ถอนเมื่อ {thaiDate(s.withdrawn_at)}</span></div><button className="btn ghost small-btn" onClick={()=>addStudent(s)}>ดึงกลับเข้าวิชา</button></div>)}</div></details>}
    </section>}
  </>;
}

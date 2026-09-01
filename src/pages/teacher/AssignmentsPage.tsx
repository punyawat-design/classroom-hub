import { useEffect,useState } from "react";
import { supabase } from "../../lib/supabase";
import { errText, thaiDate } from "../../lib/utils";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";

function localDateTime(value?:string|null){
  if(!value)return "";
  const d=new Date(value);
  const pad=(n:number)=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AssignmentsPage(){
  const [items,setItems]=useState<any[]>([]);
  const [courses,setCourses]=useState<any[]>([]);
  const [rooms,setRooms]=useState<any[]>([]);
  const [editing,setEditing]=useState<any|null>(null);
  const [message,setMessage]=useState("");
  const {toast}=useToast();
  const {confirm}=useConfirm();

  async function load(){
    const [{data:a,error},{data:c},{data:r}]=await Promise.all([
      supabase.from("assignments")
        .select("id,title,description,instructions,course_id,classroom_id,open_at,due_at,max_score,allow_late_submission,allow_resubmission,courses(name),classrooms(name)")
        .order("due_at"),
      supabase.from("courses").select("id,name").order("name"),
      supabase.from("classrooms").select("id,name").order("name")
    ]);
    if(error)setMessage(errText(error)); else setItems(a||[]);
    setCourses(c||[]);setRooms(r||[]);
  }
  useEffect(()=>{load()},[]);

  async function create(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setMessage("");
    const fd=new FormData(e.currentTarget);
    const title=String(fd.get("title")||"");
    const ok=await confirm({
      title:"สร้างงานใหม่?",
      message:`งาน “${title}” จะถูกมอบหมายตามรายวิชาและกลุ่มเป้าหมายที่เลือก`,
      confirmText:"สร้างงาน"
    });
    if(!ok)return;

    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return;

    const room=String(fd.get("classroom_id")||"");
    const {error}=await supabase.from("assignments").insert({
      title,
      description:String(fd.get("description")||""),
      instructions:String(fd.get("instructions")||""),
      course_id:String(fd.get("course_id")),
      classroom_id:room||null,
      teacher_id:user.id,
      open_at:new Date(String(fd.get("open_at"))).toISOString(),
      due_at:new Date(String(fd.get("due_at"))).toISOString(),
      max_score:Number(fd.get("max_score")||10),
      allow_late_submission:fd.get("allow_late_submission")==="on",
      allow_resubmission:fd.get("allow_resubmission")==="on"
    });

    if(error){setMessage(errText(error));toast("สร้างงานไม่สำเร็จ",errText(error),"error");}
    else{
      toast("สร้างงานแล้ว","นักเรียนที่ลงทะเบียนในรายวิชาจะเห็นงานตามกลุ่มที่กำหนด","success");
      e.currentTarget.reset();load();
    }
  }

  async function saveEdit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!editing)return;
    const fd=new FormData(e.currentTarget);
    const ok=await confirm({
      title:"บันทึกการแก้ไขงาน?",
      message:"รายละเอียดและกำหนดส่งใหม่จะมีผลกับนักเรียนทันที",
      confirmText:"บันทึก"
    });
    if(!ok)return;

    const room=String(fd.get("classroom_id")||"");
    const {error}=await supabase.from("assignments").update({
      title:String(fd.get("title")),
      description:String(fd.get("description")||""),
      instructions:String(fd.get("instructions")||""),
      course_id:String(fd.get("course_id")),
      classroom_id:room||null,
      open_at:new Date(String(fd.get("open_at"))).toISOString(),
      due_at:new Date(String(fd.get("due_at"))).toISOString(),
      max_score:Number(fd.get("max_score")||10),
      allow_late_submission:fd.get("allow_late_submission")==="on",
      allow_resubmission:fd.get("allow_resubmission")==="on",
      updated_at:new Date().toISOString()
    }).eq("id",editing.id);

    if(error)toast("แก้ไขไม่สำเร็จ",errText(error),"error");
    else{toast("แก้ไขงานแล้ว","","success");setEditing(null);load();}
  }

  async function removeAssignment(item:any){
    const ok=await confirm({
      title:"ลบงานนี้?",
      message:`“${item.title}” รวมถึงข้อมูลการส่งและคะแนนของงานนี้จะถูกลบ การกระทำนี้ย้อนกลับไม่ได้`,
      confirmText:"ลบงาน",
      danger:true
    });
    if(!ok)return;

    // Remove actual files from Storage first, then DB cascade removes submission metadata.
    const {data:subs,error:subError}=await supabase
      .from("submissions")
      .select("id,submission_files(storage_path)")
      .eq("assignment_id",item.id);

    if(subError){toast("ลบงานไม่สำเร็จ",errText(subError),"error");return;}

    const paths=(subs||[]).flatMap((s:any)=>(s.submission_files||[]).map((f:any)=>f.storage_path)).filter(Boolean);
    if(paths.length){
      const {error:storageError}=await supabase.storage.from("submissions").remove(paths);
      if(storageError){toast("ลบไฟล์งานไม่สำเร็จ",errText(storageError),"error");return;}
    }

    const {error}=await supabase.from("assignments").delete().eq("id",item.id);
    if(error)toast("ลบงานไม่สำเร็จ",errText(error),"error");
    else{toast("ลบงานแล้ว","","success");load();}
  }

  return <>
    <header className="page-header"><div><h1>งาน / Assignment</h1><p>สร้าง แก้ไข หรือลบงานได้จากหน้านี้</p></div></header>
    {message&&<div className="notice">{message}</div>}

    <details className="card section">
      <summary><b>+ สร้างงานใหม่</b></summary>
      <form className="form top-gap" onSubmit={create}>
        <label className="field"><span>ชื่องาน</span><input name="title" required/></label>
        <div className="two-col">
          <label className="field"><span>รายวิชา</span><select name="course_id" required><option value="">เลือก</option>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="field"><span>กลุ่มเป้าหมาย</span><select name="classroom_id"><option value="">นักเรียนทุกคนในรายวิชา</option>{rooms.map(r=><option key={r.id} value={r.id}>เฉพาะห้อง {r.name}</option>)}</select></label>
        </div>
        <label className="field"><span>คำอธิบาย</span><textarea name="description" rows={2}/></label>
        <label className="field"><span>คำสั่ง</span><textarea name="instructions" rows={4}/></label>
        <div className="two-col">
          <label className="field"><span>เปิดงาน</span><input type="datetime-local" name="open_at" required/></label>
          <label className="field"><span>กำหนดส่ง</span><input type="datetime-local" name="due_at" required/></label>
        </div>
        <label className="field"><span>คะแนนเต็ม</span><input type="number" name="max_score" defaultValue={10} min={0}/></label>
        <label className="check"><input type="checkbox" name="allow_late_submission" defaultChecked/> อนุญาตส่งล่าช้า</label>
        <label className="check"><input type="checkbox" name="allow_resubmission" defaultChecked/> อนุญาตลบ/ส่งใหม่ก่อนตรวจเสร็จ</label>
        <button className="btn primary">บันทึกงาน</button>
      </form>
    </details>

    <div className="table-card section"><table>
      <thead><tr><th>งาน</th><th>รายวิชา</th><th>กลุ่ม</th><th>กำหนดส่ง</th><th>คะแนน</th><th>จัดการ</th></tr></thead>
      <tbody>{items.map(x=><tr key={x.id}>
        <td><b>{x.title}</b></td>
        <td>{x.courses?.name}</td>
        <td>{x.classrooms?.name||"ทุกคนในรายวิชา"}</td>
        <td>{thaiDate(x.due_at)}</td>
        <td>{x.max_score}</td>
        <td><div className="actions">
          <button className="btn ghost" onClick={()=>setEditing(x)}>แก้ไข</button>
          <button className="btn danger" onClick={()=>removeAssignment(x)}>ลบ</button>
        </div></td>
      </tr>)}</tbody>
    </table>{items.length===0&&<div className="empty">ยังไม่มีงาน</div>}</div>

    {editing&&<div className="modal-backdrop" onMouseDown={()=>setEditing(null)}>
      <div className="edit-modal" onMouseDown={e=>e.stopPropagation()}>
        <div className="viewer-head"><div><h2>แก้ไขงาน</h2><div className="muted">{editing.title}</div></div><button onClick={()=>setEditing(null)}>×</button></div>
        <form className="form top-gap" onSubmit={saveEdit}>
          <label className="field"><span>ชื่องาน</span><input name="title" defaultValue={editing.title} required/></label>
          <div className="two-col">
            <label className="field"><span>รายวิชา</span><select name="course_id" defaultValue={editing.course_id} required>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className="field"><span>กลุ่มเป้าหมาย</span><select name="classroom_id" defaultValue={editing.classroom_id||""}><option value="">นักเรียนทุกคนในรายวิชา</option>{rooms.map(r=><option key={r.id} value={r.id}>เฉพาะห้อง {r.name}</option>)}</select></label>
          </div>
          <label className="field"><span>คำอธิบาย</span><textarea name="description" rows={2} defaultValue={editing.description||""}/></label>
          <label className="field"><span>คำสั่ง</span><textarea name="instructions" rows={4} defaultValue={editing.instructions||""}/></label>
          <div className="two-col">
            <label className="field"><span>เปิดงาน</span><input type="datetime-local" name="open_at" defaultValue={localDateTime(editing.open_at)} required/></label>
            <label className="field"><span>กำหนดส่ง</span><input type="datetime-local" name="due_at" defaultValue={localDateTime(editing.due_at)} required/></label>
          </div>
          <label className="field"><span>คะแนนเต็ม</span><input type="number" name="max_score" defaultValue={editing.max_score} min={0}/></label>
          <label className="check"><input type="checkbox" name="allow_late_submission" defaultChecked={editing.allow_late_submission}/> อนุญาตส่งล่าช้า</label>
          <label className="check"><input type="checkbox" name="allow_resubmission" defaultChecked={editing.allow_resubmission}/> อนุญาตลบ/ส่งใหม่ก่อนตรวจเสร็จ</label>
          <div className="actions"><button type="button" className="btn ghost" onClick={()=>setEditing(null)}>ยกเลิก</button><button className="btn primary">บันทึกการแก้ไข</button></div>
        </form>
      </div>
    </div>}
  </>;
}

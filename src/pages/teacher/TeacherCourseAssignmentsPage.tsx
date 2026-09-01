import { useEffect,useState } from "react";
import { Link,useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { errText,thaiDate } from "../../lib/utils";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";

function localDateTime(value?:string|null){
  if(!value)return "";
  const d=new Date(value);
  const pad=(n:number)=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TeacherCourseAssignmentsPage(){
  const {courseId=""}=useParams();
  const [course,setCourse]=useState<any|null>(null);
  const [items,setItems]=useState<any[]>([]);
  const [rooms,setRooms]=useState<any[]>([]);
  const [editing,setEditing]=useState<any|null>(null);
  const [message,setMessage]=useState("");
  const {toast}=useToast();
  const {confirm}=useConfirm();

  async function load(){
    const [{data:c,error:ce},{data:a,error:ae},{data:r,error:re}]=await Promise.all([
      supabase.from("courses").select("id,name").eq("id",courseId).single(),
      supabase.from("assignments")
        .select("id,title,description,instructions,course_id,classroom_id,open_at,due_at,max_score,allow_late_submission,allow_resubmission,classrooms(name)")
        .eq("course_id",courseId)
        .order("due_at",{ascending:true}),
      supabase.from("classrooms").select("id,name").order("name")
    ]);
    if(ce||ae||re){
      setMessage(errText(ce||ae||re));
      return;
    }
    setCourse(c);
    setItems(a||[]);
    setRooms(r||[]);
  }

  useEffect(()=>{load()},[courseId]);

  async function create(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    const fd=new FormData(e.currentTarget);
    const title=String(fd.get("title")||"");
    const ok=await confirm({
      title:"สร้างงานใหม่?",
      message:`เพิ่มงาน “${title}” ในวิชา ${course?.name||""}`,
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
      course_id:courseId,
      classroom_id:room||null,
      teacher_id:user.id,
      open_at:new Date(String(fd.get("open_at"))).toISOString(),
      due_at:new Date(String(fd.get("due_at"))).toISOString(),
      max_score:Number(fd.get("max_score")||10),
      allow_late_submission:fd.get("allow_late_submission")==="on",
      allow_resubmission:fd.get("allow_resubmission")==="on"
    });

    if(error)toast("สร้างงานไม่สำเร็จ",errText(error),"error");
    else{
      toast("สร้างงานแล้ว",`เพิ่มในวิชา ${course?.name||""} เรียบร้อย`,"success");
      e.currentTarget.reset();
      load();
    }
  }

  async function saveEdit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!editing)return;
    const fd=new FormData(e.currentTarget);
    const ok=await confirm({
      title:"บันทึกการแก้ไข?",
      message:"ข้อมูลใหม่จะมีผลกับนักเรียนทันที",
      confirmText:"บันทึก"
    });
    if(!ok)return;

    const room=String(fd.get("classroom_id")||"");
    const {error}=await supabase.from("assignments").update({
      title:String(fd.get("title")),
      description:String(fd.get("description")||""),
      instructions:String(fd.get("instructions")||""),
      classroom_id:room||null,
      open_at:new Date(String(fd.get("open_at"))).toISOString(),
      due_at:new Date(String(fd.get("due_at"))).toISOString(),
      max_score:Number(fd.get("max_score")||10),
      allow_late_submission:fd.get("allow_late_submission")==="on",
      allow_resubmission:fd.get("allow_resubmission")==="on",
      updated_at:new Date().toISOString()
    }).eq("id",editing.id);

    if(error)toast("แก้ไขไม่สำเร็จ",errText(error),"error");
    else{
      toast("แก้ไขงานแล้ว","","success");
      setEditing(null);
      load();
    }
  }

  async function removeAssignment(item:any){
    const ok=await confirm({
      title:"ลบงานนี้?",
      message:`“${item.title}” และข้อมูลการส่งของงานนี้จะถูกลบ`,
      confirmText:"ลบงาน",
      danger:true
    });
    if(!ok)return;

    const {data:subs,error:subError}=await supabase
      .from("submissions")
      .select("id,submission_files(storage_path)")
      .eq("assignment_id",item.id);

    if(subError){
      toast("ลบงานไม่สำเร็จ",errText(subError),"error");
      return;
    }

    const paths=(subs||[])
      .flatMap((s:any)=>(s.submission_files||[]).map((f:any)=>f.storage_path))
      .filter(Boolean);

    if(paths.length){
      const {error:storageError}=await supabase.storage.from("submissions").remove(paths);
      if(storageError){
        toast("ลบไฟล์งานไม่สำเร็จ",errText(storageError),"error");
        return;
      }
    }

    const {error}=await supabase.from("assignments").delete().eq("id",item.id);
    if(error)toast("ลบงานไม่สำเร็จ",errText(error),"error");
    else{
      toast("ลบงานแล้ว","","success");
      load();
    }
  }

  return <>
    <Link className="back-link" to="/teacher/assignments">← กลับไปเลือกรายวิชา</Link>

    <header className="page-header">
      <div>
        <h1>{course?.name||"รายวิชา"}</h1>
        <p>สร้าง แก้ไข หรือลบงานเฉพาะวิชานี้</p>
      </div>
    </header>

    {message&&<div className="error">{message}</div>}

    <details className="card section">
      <summary><b>+ สร้างงานใหม่ในวิชานี้</b></summary>
      <form className="form top-gap" onSubmit={create}>
        <label className="field"><span>ชื่องาน</span><input name="title" required/></label>

        <label className="field"><span>กลุ่มเป้าหมาย</span>
          <select name="classroom_id">
            <option value="">นักเรียนทุกคนในรายวิชา</option>
            {rooms.map(r=><option key={r.id} value={r.id}>เฉพาะห้อง {r.name}</option>)}
          </select>
        </label>

        <label className="field"><span>คำอธิบาย</span><textarea name="description" rows={2}/></label>
        <label className="field"><span>คำสั่ง</span><textarea name="instructions" rows={4}/></label>

        <div className="two-col">
          <label className="field"><span>เปิดงาน</span><input type="datetime-local" name="open_at" required/></label>
          <label className="field"><span>กำหนดส่ง</span><input type="datetime-local" name="due_at" required/></label>
        </div>

        <label className="field"><span>คะแนนเต็ม</span><input type="number" name="max_score" defaultValue={10} min={0}/></label>
        <label className="check"><input type="checkbox" name="allow_late_submission" defaultChecked/> อนุญาตส่งล่าช้า</label>
        <label className="check"><input type="checkbox" name="allow_resubmission" defaultChecked/> อนุญาตลบ/ส่งใหม่ก่อนครูตรวจเสร็จ</label>

        <button className="btn primary">บันทึกงาน</button>
      </form>
    </details>

    <div className="table-card section">
      <table>
        <thead>
          <tr>
            <th>งาน</th>
            <th>กลุ่ม</th>
            <th>กำหนดส่ง</th>
            <th>คะแนน</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {items.map(x=><tr key={x.id}>
            <td><b>{x.title}</b></td>
            <td>{x.classrooms?.name||"ทุกคนในรายวิชา"}</td>
            <td>{thaiDate(x.due_at)}</td>
            <td>{x.max_score}</td>
            <td>
              <div className="actions">
                <button className="btn ghost" onClick={()=>setEditing(x)}>แก้ไข</button>
                <button className="btn danger" onClick={()=>removeAssignment(x)}>ลบ</button>
              </div>
            </td>
          </tr>)}
        </tbody>
      </table>
      {items.length===0&&<div className="empty">วิชานี้ยังไม่มีงาน</div>}
    </div>

    {editing&&<div className="modal-backdrop" onMouseDown={()=>setEditing(null)}>
      <div className="edit-modal" onMouseDown={e=>e.stopPropagation()}>
        <div className="viewer-head">
          <div><h2>แก้ไขงาน</h2><div className="muted">{editing.title}</div></div>
          <button onClick={()=>setEditing(null)}>×</button>
        </div>

        <form className="form top-gap" onSubmit={saveEdit}>
          <label className="field"><span>ชื่องาน</span><input name="title" defaultValue={editing.title} required/></label>

          <label className="field"><span>กลุ่มเป้าหมาย</span>
            <select name="classroom_id" defaultValue={editing.classroom_id||""}>
              <option value="">นักเรียนทุกคนในรายวิชา</option>
              {rooms.map(r=><option key={r.id} value={r.id}>เฉพาะห้อง {r.name}</option>)}
            </select>
          </label>

          <label className="field"><span>คำอธิบาย</span><textarea name="description" rows={2} defaultValue={editing.description||""}/></label>
          <label className="field"><span>คำสั่ง</span><textarea name="instructions" rows={4} defaultValue={editing.instructions||""}/></label>

          <div className="two-col">
            <label className="field"><span>เปิดงาน</span><input type="datetime-local" name="open_at" defaultValue={localDateTime(editing.open_at)} required/></label>
            <label className="field"><span>กำหนดส่ง</span><input type="datetime-local" name="due_at" defaultValue={localDateTime(editing.due_at)} required/></label>
          </div>

          <label className="field"><span>คะแนนเต็ม</span><input type="number" name="max_score" defaultValue={editing.max_score} min={0}/></label>
          <label className="check"><input type="checkbox" name="allow_late_submission" defaultChecked={editing.allow_late_submission}/> อนุญาตส่งล่าช้า</label>
          <label className="check"><input type="checkbox" name="allow_resubmission" defaultChecked={editing.allow_resubmission}/> อนุญาตลบ/ส่งใหม่ก่อนครูตรวจเสร็จ</label>

          <div className="actions">
            <button type="button" className="btn ghost" onClick={()=>setEditing(null)}>ยกเลิก</button>
            <button className="btn primary">บันทึกการแก้ไข</button>
          </div>
        </form>
      </div>
    </div>}
  </>;
}

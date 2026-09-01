import { useEffect,useState } from "react";
import { Link,useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { errText } from "../../lib/utils";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import RichTextEditor from "../../components/RichTextEditor";
import AssignmentLinksEditor from "../../components/AssignmentLinksEditor";
import { FILE_ACCEPT } from "../../lib/fileRules";
import { richTextToPlain } from "../../lib/richText";
import {
  parseAssignmentLinks,
  uploadAssignmentAttachments,
  validateAssignmentAttachments
} from "../../lib/assignmentResources";

export default function CreateAssignmentPage(){
  const [courses,setCourses]=useState<any[]>([]);
  const [rooms,setRooms]=useState<any[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const {toast}=useToast();
  const {confirm}=useConfirm();
  const navigate=useNavigate();

  useEffect(()=>{(async()=>{
    const [{data:c,error:ce},{data:r,error:re}]=await Promise.all([
      supabase.from("courses").select("id,name,archived_at").is("archived_at",null).order("name"),
      supabase.from("classrooms").select("id,name").order("name")
    ]);

    if(ce||re){
      setError(errText(ce||re));
      return;
    }

    setCourses(c||[]);
    setRooms(r||[]);
  })()},[]);

  async function create(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(busy)return;

    const form=e.currentTarget;
    const fd=new FormData(form);
    const courseId=String(fd.get("course_id")||"");
    const title=String(fd.get("title")||"").trim();
    const course=courses.find(c=>c.id===courseId);
    const input=form.elements.namedItem("assignment_files") as HTMLInputElement;
    const files=Array.from(input?.files||[]);

    if(!courseId){
      toast("ยังไม่ได้เลือกรายวิชา","กรุณาเลือกรายวิชาก่อนสร้างงาน","error");
      return;
    }

    const fileError=validateAssignmentAttachments(files);
    if(fileError){
      toast("ไฟล์ประกอบงานไม่ผ่านเงื่อนไข",fileError,"error");
      return;
    }

    let links;
    try{
      links=parseAssignmentLinks(fd.get("resource_links"));
    }catch(err){
      toast("ลิงก์ไม่ถูกต้อง",errText(err),"error");
      return;
    }

    const descriptionHtml=String(fd.get("description_html")||"");
    const instructionsHtml=String(fd.get("instructions_html")||"");

    const ok=await confirm({
      title:"สร้างงานใหม่?",
      message:`เพิ่มงาน “${title}” ในวิชา ${course?.name||""}${files.length?` พร้อมไฟล์ประกอบ ${files.length} ไฟล์`:""}${links.length?` และลิงก์ ${links.length} รายการ`:""}`,
      confirmText:"สร้างงาน"
    });

    if(!ok)return;

    setBusy(true);
    setError("");

    let createdId="";

    try{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user)throw new Error("กรุณาเข้าสู่ระบบใหม่");

      const room=String(fd.get("classroom_id")||"");

      const {data:created,error:createError}=await supabase.from("assignments").insert({
        title,
        description:richTextToPlain(descriptionHtml),
        instructions:richTextToPlain(instructionsHtml),
        description_html:descriptionHtml,
        instructions_html:instructionsHtml,
        resource_links:links,
        course_id:courseId,
        classroom_id:room||null,
        teacher_id:user.id,
        open_at:new Date(String(fd.get("open_at"))).toISOString(),
        due_at:new Date(String(fd.get("due_at"))).toISOString(),
        max_score:Number(fd.get("max_score")||10),
        allow_late_submission:fd.get("allow_late_submission")==="on",
        allow_resubmission:fd.get("allow_resubmission")==="on"
      }).select("id").single();

      if(createError)throw createError;
      if(!created?.id)throw new Error("ระบบสร้างงานไม่สำเร็จ");
      createdId=created.id;

      if(files.length){
        await uploadAssignmentAttachments({
          assignmentId:created.id,
          teacherId:user.id,
          files
        });
      }

      toast("สร้างงานแล้ว",`เพิ่มในวิชา ${course?.name||""} เรียบร้อย`,"success");
      navigate(`/teacher/assignments/course/${courseId}`,{replace:true});
    }catch(err){
      if(createdId){
        await supabase.from("assignments").delete().eq("id",createdId);
      }
      const msg=errText(err);
      setError(msg);
      toast("สร้างงานไม่สำเร็จ",msg,"error");
    }finally{
      setBusy(false);
    }
  }

  return <>
    <Link className="back-link" to="/teacher">← กลับแดชบอร์ด</Link>

    <header className="page-header">
      <div>
        <h1>สร้างงานใหม่</h1>
        <p>เพิ่มข้อความ ไฟล์ประกอบ และลิงก์สำหรับนักเรียนได้ในงานเดียว</p>
      </div>
    </header>

    {error&&<div className="error">{error}</div>}

    {courses.length===0
      ? <div className="empty card section">ยังไม่มีรายวิชา กรุณาสร้างรายวิชาก่อน</div>
      : <form className="card form section" onSubmit={create}>
          <label className="field">
            <span>รายวิชา</span>
            <select name="course_id" required defaultValue="">
              <option value="" disabled>เลือกรายวิชา</option>
              {courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          <label className="field">
            <span>ชื่องาน</span>
            <input name="title" required/>
          </label>

          <label className="field">
            <span>กลุ่มเป้าหมาย</span>
            <select name="classroom_id" defaultValue="">
              <option value="">นักเรียนทุกคนในรายวิชา</option>
              {rooms.map(r=><option key={r.id} value={r.id}>เฉพาะห้อง {r.name}</option>)}
            </select>
          </label>

          <RichTextEditor
            name="description_html"
            label="คำอธิบาย (ไม่บังคับ)"
            minHeight={110}
            hint="เว้นว่างได้ หากต้องการใช้เฉพาะหัวข้องานและคำสั่ง"
          />

          <RichTextEditor
            name="instructions_html"
            label="คำสั่ง"
            minHeight={180}
            hint="ใช้ตัวหนา หัวข้อ รายการ สี และการจัดวางข้อความเพื่อเน้นคำสั่งสำคัญได้"
          />

          <AssignmentLinksEditor/>

          <label className="field">
            <span>ไฟล์ประกอบการทำงาน (ไม่บังคับ)</span>
            <input type="file" name="assignment_files" multiple accept={FILE_ACCEPT}/>
            <small className="field-hint">สูงสุด 10 ไฟล์ และไม่เกิน 50 MB ต่อไฟล์</small>
          </label>

          <div className="two-col">
            <label className="field">
              <span>เปิดงาน</span>
              <input type="datetime-local" name="open_at" required/>
            </label>

            <label className="field">
              <span>กำหนดส่ง</span>
              <input type="datetime-local" name="due_at" required/>
            </label>
          </div>

          <label className="field">
            <span>คะแนนเต็ม</span>
            <input type="number" name="max_score" defaultValue={10} min={0}/>
          </label>

          <label className="check">
            <input type="checkbox" name="allow_late_submission" defaultChecked/>
            อนุญาตส่งล่าช้า
          </label>

          <label className="check">
            <input type="checkbox" name="allow_resubmission" defaultChecked/>
            อนุญาตลบ/ส่งใหม่ก่อนครูตรวจเสร็จ
          </label>

          <button className="btn primary" disabled={busy}>
            {busy?"กำลังสร้างงาน...":"สร้างงาน"}
          </button>
        </form>
    }
  </>;
}

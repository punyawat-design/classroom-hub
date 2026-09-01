import { useEffect,useState } from "react";
import { Link,useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { errText,thaiDate } from "../../lib/utils";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import RichTextEditor from "../../components/RichTextEditor";
import AssignmentLinksEditor,{AssignmentLink} from "../../components/AssignmentLinksEditor";
import { FILE_ACCEPT } from "../../lib/fileRules";
import { plainTextToHtml,richTextToPlain } from "../../lib/richText";
import {
  parseAssignmentLinks,
  uploadAssignmentAttachments,
  validateAssignmentAttachments
} from "../../lib/assignmentResources";

function localDateTime(value?:string|null){
  if(!value)return "";
  const d=new Date(value);
  const pad=(n:number)=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function linksOf(value:any):AssignmentLink[]{
  if(!Array.isArray(value))return [];
  return value
    .map(x=>({title:String(x?.title||""),url:String(x?.url||"")}))
    .filter(x=>x.url);
}

function htmlOf(html?:string|null,plain?:string|null){
  return html?.trim()?html:plainTextToHtml(plain);
}

export default function TeacherCourseAssignmentsPage(){
  const {courseId=""}=useParams();
  const [course,setCourse]=useState<any|null>(null);
  const [items,setItems]=useState<any[]>([]);
  const [rooms,setRooms]=useState<any[]>([]);
  const [editing,setEditing]=useState<any|null>(null);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [formKey,setFormKey]=useState(0);
  const {toast}=useToast();
  const {confirm}=useConfirm();

  async function load(){
    const [{data:c,error:ce},{data:a,error:ae},{data:r,error:re}]=await Promise.all([
      supabase.from("courses").select("id,name").eq("id",courseId).single(),
      supabase.from("assignments")
        .select("id,title,description,instructions,description_html,instructions_html,resource_links,course_id,classroom_id,open_at,due_at,max_score,allow_late_submission,allow_resubmission,classrooms(name)")
        .eq("course_id",courseId)
        .order("due_at",{ascending:true}),
      supabase.from("classrooms").select("id,name").order("name")
    ]);

    if(ce||ae||re){
      setMessage(errText(ce||ae||re));
      return;
    }

    const base=a||[];
    let attachments:any[]=[];

    if(base.length){
      const ids=base.map(x=>x.id);
      const {data:att,error:attError}=await supabase
        .from("assignment_attachments")
        .select("id,assignment_id,file_name,storage_path,file_size,file_type,uploaded_at")
        .in("assignment_id",ids)
        .order("uploaded_at");

      if(attError){
        setMessage(errText(attError));
        return;
      }
      attachments=att||[];
    }

    setCourse(c);
    setItems(base.map(x=>({
      ...x,
      assignment_attachments:attachments.filter(att=>att.assignment_id===x.id)
    })));
    setRooms(r||[]);
    setMessage("");
  }

  useEffect(()=>{load()},[courseId]);

  async function create(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(busy)return;

    const form=e.currentTarget;
    const fd=new FormData(form);
    const title=String(fd.get("title")||"").trim();
    const input=form.elements.namedItem("assignment_files") as HTMLInputElement;
    const files=Array.from(input?.files||[]);

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

    const ok=await confirm({
      title:"สร้างงานใหม่?",
      message:`เพิ่มงาน “${title}” ในวิชา ${course?.name||""}`,
      confirmText:"สร้างงาน"
    });
    if(!ok)return;

    setBusy(true);
    let createdId="";

    try{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user)throw new Error("กรุณาเข้าสู่ระบบใหม่");

      const room=String(fd.get("classroom_id")||"");
      const descriptionHtml=String(fd.get("description_html")||"");
      const instructionsHtml=String(fd.get("instructions_html")||"");

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
        await uploadAssignmentAttachments({assignmentId:created.id,teacherId:user.id,files});
      }

      toast("สร้างงานแล้ว",`เพิ่มในวิชา ${course?.name||""} เรียบร้อย`,"success");
      setFormKey(k=>k+1);
      await load();
    }catch(err){
      if(createdId)await supabase.from("assignments").delete().eq("id",createdId);
      toast("สร้างงานไม่สำเร็จ",errText(err),"error");
    }finally{
      setBusy(false);
    }
  }

  async function saveEdit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!editing||busy)return;

    const form=e.currentTarget;
    const fd=new FormData(form);
    const input=form.elements.namedItem("assignment_files") as HTMLInputElement;
    const newFiles=Array.from(input?.files||[]);
    const existingCount=(editing.assignment_attachments||[]).length;

    const fileError=validateAssignmentAttachments(newFiles,existingCount);
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

    const ok=await confirm({
      title:"บันทึกการแก้ไข?",
      message:"ข้อความ ไฟล์ใหม่ และลิงก์จะมีผลกับนักเรียนทันที",
      confirmText:"บันทึก"
    });
    if(!ok)return;

    setBusy(true);

    try{
      const room=String(fd.get("classroom_id")||"");
      const descriptionHtml=String(fd.get("description_html")||"");
      const instructionsHtml=String(fd.get("instructions_html")||"");

      const {error}=await supabase.from("assignments").update({
        title:String(fd.get("title")||"").trim(),
        description:richTextToPlain(descriptionHtml),
        instructions:richTextToPlain(instructionsHtml),
        description_html:descriptionHtml,
        instructions_html:instructionsHtml,
        resource_links:links,
        classroom_id:room||null,
        open_at:new Date(String(fd.get("open_at"))).toISOString(),
        due_at:new Date(String(fd.get("due_at"))).toISOString(),
        max_score:Number(fd.get("max_score")||10),
        allow_late_submission:fd.get("allow_late_submission")==="on",
        allow_resubmission:fd.get("allow_resubmission")==="on",
        updated_at:new Date().toISOString()
      }).eq("id",editing.id);

      if(error)throw error;

      if(newFiles.length){
        const {data:{user}}=await supabase.auth.getUser();
        if(!user)throw new Error("กรุณาเข้าสู่ระบบใหม่");
        await uploadAssignmentAttachments({assignmentId:editing.id,teacherId:user.id,files:newFiles});
      }

      toast("แก้ไขงานแล้ว","ข้อมูลประกอบงานอัปเดตแล้ว","success");
      setEditing(null);
      await load();
    }catch(err){
      toast("แก้ไขไม่สำเร็จ",errText(err),"error");
    }finally{
      setBusy(false);
    }
  }

  async function openAttachment(item:any){
    const {data,error}=await supabase.storage
      .from("assignment-files")
      .createSignedUrl(item.storage_path,180);

    if(error){
      toast("เปิดไฟล์ไม่ได้",errText(error),"error");
      return;
    }

    window.open(data.signedUrl,"_blank","noopener,noreferrer");
  }

  async function removeAttachment(item:any){
    if(!editing||busy)return;

    const ok=await confirm({
      title:"ลบไฟล์ประกอบนี้?",
      message:item.file_name,
      confirmText:"ลบไฟล์",
      danger:true
    });
    if(!ok)return;

    setBusy(true);
    try{
      const {error:metaError}=await supabase
        .from("assignment_attachments")
        .delete()
        .eq("id",item.id);
      if(metaError)throw metaError;

      const {error:storageError}=await supabase.storage
        .from("assignment-files")
        .remove([item.storage_path]);
      if(storageError)throw storageError;

      const nextAttachments=(editing.assignment_attachments||[]).filter((x:any)=>x.id!==item.id);
      setEditing({...editing,assignment_attachments:nextAttachments});
      toast("ลบไฟล์แล้ว","","success");
      await load();
    }catch(err){
      toast("ลบไฟล์ไม่สำเร็จ",errText(err),"error");
    }finally{
      setBusy(false);
    }
  }

  async function removeAssignment(item:any){
    const ok=await confirm({
      title:"ลบงานนี้?",
      message:`“${item.title}” ไฟล์ประกอบ และข้อมูลการส่งของงานนี้จะถูกลบ`,
      confirmText:"ลบงาน",
      danger:true
    });
    if(!ok)return;

    const [{data:subs,error:subError},{data:attachments,error:attError}]=await Promise.all([
      supabase.from("submissions").select("id,submission_files(storage_path)").eq("assignment_id",item.id),
      supabase.from("assignment_attachments").select("storage_path").eq("assignment_id",item.id)
    ]);

    if(subError||attError){
      toast("ลบงานไม่สำเร็จ",errText(subError||attError),"error");
      return;
    }

    const submissionPaths=(subs||[])
      .flatMap((s:any)=>(s.submission_files||[]).map((f:any)=>f.storage_path))
      .filter(Boolean);

    const attachmentPaths=(attachments||[]).map((x:any)=>x.storage_path).filter(Boolean);

    if(submissionPaths.length){
      const {error}=await supabase.storage.from("submissions").remove(submissionPaths);
      if(error){toast("ลบไฟล์งานไม่สำเร็จ",errText(error),"error");return;}
    }

    if(attachmentPaths.length){
      const {error}=await supabase.storage.from("assignment-files").remove(attachmentPaths);
      if(error){toast("ลบไฟล์ประกอบไม่สำเร็จ",errText(error),"error");return;}
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
        <p>สร้างงานพร้อมข้อความ ไฟล์ และลิงก์ประกอบสำหรับวิชานี้</p>
      </div>
    </header>

    {message&&<div className="error">{message}</div>}

    <details className="card section">
      <summary><b>+ สร้างงานใหม่ในวิชานี้</b></summary>
      <form key={formKey} className="form top-gap" onSubmit={create}>
        <label className="field"><span>ชื่องาน</span><input name="title" required/></label>

        <label className="field"><span>กลุ่มเป้าหมาย</span>
          <select name="classroom_id">
            <option value="">นักเรียนทุกคนในรายวิชา</option>
            {rooms.map(r=><option key={r.id} value={r.id}>เฉพาะห้อง {r.name}</option>)}
          </select>
        </label>

        <RichTextEditor
          name="description_html"
          label="คำอธิบาย (ไม่บังคับ)"
          minHeight={100}
          hint="เว้นว่างได้ หากต้องการใช้เฉพาะชื่องานและคำสั่ง"
        />

        <RichTextEditor
          name="instructions_html"
          label="คำสั่ง"
          minHeight={170}
        />

        <AssignmentLinksEditor/>

        <label className="field">
          <span>ไฟล์ประกอบการทำงาน (ไม่บังคับ)</span>
          <input type="file" name="assignment_files" multiple accept={FILE_ACCEPT}/>
          <small className="field-hint">สูงสุด 10 ไฟล์ และไม่เกิน 50 MB ต่อไฟล์</small>
        </label>

        <div className="two-col">
          <label className="field"><span>เปิดงาน</span><input type="datetime-local" name="open_at" required/></label>
          <label className="field"><span>กำหนดส่ง</span><input type="datetime-local" name="due_at" required/></label>
        </div>

        <label className="field"><span>คะแนนเต็ม</span><input type="number" name="max_score" defaultValue={10} min={0}/></label>
        <label className="check"><input type="checkbox" name="allow_late_submission" defaultChecked/> อนุญาตส่งล่าช้า</label>
        <label className="check"><input type="checkbox" name="allow_resubmission" defaultChecked/> อนุญาตลบ/ส่งใหม่ก่อนครูตรวจเสร็จ</label>

        <button className="btn primary" disabled={busy}>{busy?"กำลังบันทึก...":"บันทึกงาน"}</button>
      </form>
    </details>

    <div className="table-card section">
      <table>
        <thead>
          <tr>
            <th>งาน</th>
            <th>กลุ่ม</th>
            <th>สื่อประกอบ</th>
            <th>กำหนดส่ง</th>
            <th>คะแนน</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {items.map(x=>{
            const fileCount=(x.assignment_attachments||[]).length;
            const linkCount=linksOf(x.resource_links).length;
            return <tr key={x.id}>
              <td><b>{x.title}</b></td>
              <td>{x.classrooms?.name||"ทุกคนในรายวิชา"}</td>
              <td>{fileCount||linkCount?<>{fileCount} ไฟล์ • {linkCount} ลิงก์</>:"-"}</td>
              <td>{thaiDate(x.due_at)}</td>
              <td>{x.max_score}</td>
              <td>
                <div className="actions">
                  <button className="btn ghost" onClick={()=>setEditing(x)}>แก้ไข</button>
                  <button className="btn danger" onClick={()=>removeAssignment(x)}>ลบ</button>
                </div>
              </td>
            </tr>;
          })}
        </tbody>
      </table>
      {items.length===0&&<div className="empty">วิชานี้ยังไม่มีงาน</div>}
    </div>

    {editing&&<div className="modal-backdrop" onMouseDown={()=>!busy&&setEditing(null)}>
      <div className="edit-modal assignment-edit-modal" onMouseDown={e=>e.stopPropagation()}>
        <div className="viewer-head">
          <div><h2>แก้ไขงาน</h2><div className="muted">{editing.title}</div></div>
          <button disabled={busy} onClick={()=>setEditing(null)}>×</button>
        </div>

        <form key={editing.id} className="form top-gap" onSubmit={saveEdit}>
          <label className="field"><span>ชื่องาน</span><input name="title" defaultValue={editing.title} required/></label>

          <label className="field"><span>กลุ่มเป้าหมาย</span>
            <select name="classroom_id" defaultValue={editing.classroom_id||""}>
              <option value="">นักเรียนทุกคนในรายวิชา</option>
              {rooms.map(r=><option key={r.id} value={r.id}>เฉพาะห้อง {r.name}</option>)}
            </select>
          </label>

          <RichTextEditor
            name="description_html"
            label="คำอธิบาย (ไม่บังคับ)"
            defaultValue={htmlOf(editing.description_html,editing.description)}
            minHeight={100}
          />

          <RichTextEditor
            name="instructions_html"
            label="คำสั่ง"
            defaultValue={htmlOf(editing.instructions_html,editing.instructions)}
            minHeight={170}
          />

          <AssignmentLinksEditor defaultValue={linksOf(editing.resource_links)}/>

          <div className="field">
            <span>ไฟล์ประกอบที่มีอยู่</span>
            <div className="assignment-existing-files">
              {(editing.assignment_attachments||[]).map((file:any)=><div className="assignment-existing-file" key={file.id}>
                <button type="button" className="resource-file-name" onClick={()=>openAttachment(file)}>{file.file_name}</button>
                <button type="button" className="btn danger small-btn" disabled={busy} onClick={()=>removeAttachment(file)}>ลบ</button>
              </div>)}
              {!(editing.assignment_attachments||[]).length&&<span className="muted small">ยังไม่มีไฟล์ประกอบ</span>}
            </div>
          </div>

          <label className="field">
            <span>เพิ่มไฟล์ประกอบ</span>
            <input type="file" name="assignment_files" multiple accept={FILE_ACCEPT}/>
            <small className="field-hint">ไฟล์เดิมจะยังอยู่ และสามารถเพิ่มได้รวมสูงสุด 10 ไฟล์</small>
          </label>

          <div className="two-col">
            <label className="field"><span>เปิดงาน</span><input type="datetime-local" name="open_at" defaultValue={localDateTime(editing.open_at)} required/></label>
            <label className="field"><span>กำหนดส่ง</span><input type="datetime-local" name="due_at" defaultValue={localDateTime(editing.due_at)} required/></label>
          </div>

          <label className="field"><span>คะแนนเต็ม</span><input type="number" name="max_score" defaultValue={editing.max_score} min={0}/></label>
          <label className="check"><input type="checkbox" name="allow_late_submission" defaultChecked={editing.allow_late_submission}/> อนุญาตส่งล่าช้า</label>
          <label className="check"><input type="checkbox" name="allow_resubmission" defaultChecked={editing.allow_resubmission}/> อนุญาตลบ/ส่งใหม่ก่อนครูตรวจเสร็จ</label>

          <div className="actions">
            <button type="button" className="btn ghost" disabled={busy} onClick={()=>setEditing(null)}>ยกเลิก</button>
            <button className="btn primary" disabled={busy}>{busy?"กำลังบันทึก...":"บันทึกการแก้ไข"}</button>
          </div>
        </form>
      </div>
    </div>}
  </>;
}

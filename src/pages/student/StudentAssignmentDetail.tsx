import { useEffect,useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { errText, safeFileName, thaiDate } from "../../lib/utils";
import StatusBadge from "../../components/StatusBadge";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { Status } from "../../lib/status";

export default function StudentAssignmentDetail(){
  const {id=""}=useParams();
  const {user}=useAuth();
  const [a,setA]=useState<any>(null);
  const [submission,setSubmission]=useState<any>(null);
  const [files,setFiles]=useState<any[]>([]);
  const [computedStatus,setComputedStatus]=useState<Status>("NOT_STARTED");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const {toast}=useToast();
  const {confirm}=useConfirm();

  async function load(){
    if(!user||!id)return;

    const [{data:assignment,error:ae},{data:sub,error:se},{data:overview,error:oe}]=await Promise.all([
      supabase.from("assignments")
        .select("*,courses(name),classrooms(name)")
        .eq("id",id)
        .single(),
      supabase.from("submissions")
        .select("*")
        .eq("assignment_id",id)
        .eq("student_id",user.id)
        .maybeSingle(),
      supabase.rpc("student_assignment_overview",{p_student_id:user.id})
    ]);

    if(ae||se||oe){
      const msg=errText(ae||se||oe);
      setMessage(msg);
      return;
    }

    setA(assignment);
    setSubmission(sub);

    const ov=(overview||[]).find((x:any)=>x.assignment_id===id);
    setComputedStatus((ov?.computed_status||"NOT_STARTED") as Status);

    if(sub){
      const {data:f,error:fe}=await supabase
        .from("submission_files")
        .select("*")
        .eq("submission_id",sub.id)
        .order("uploaded_at");

      if(fe){
        setMessage(errText(fe));
        setFiles([]);
      }else{
        setFiles(f||[]);
      }
    }else{
      setFiles([]);
    }
  }

  useEffect(()=>{load()},[user,id]);

  async function start(){
    if(!user||busy)return;
    setBusy(true);
    setMessage("");

    try{
      const {error}=await supabase.rpc("student_mark_assignment_started",{
        p_assignment_id:id
      });
      if(error)throw error;

      toast("เริ่มทำงานแล้ว","","success");
      await load();
    }catch(error){
      const msg=errText(error);
      setMessage(msg);
      toast("เริ่มงานไม่สำเร็จ",msg,"error");
    }finally{
      setBusy(false);
    }
  }

  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!user||!a||busy)return;

    setMessage("");

    const form=e.currentTarget;
    const fd=new FormData(form);
    const input=form.elements.namedItem("files") as HTMLInputElement;
    const uploadFiles=Array.from(input.files||[]);
    const submissionLink=String(fd.get("submission_link")||"").trim();
    const studentNote=String(fd.get("student_note")||"");

    if(uploadFiles.length===0&&!submissionLink){
      toast("ยังไม่มีงานสำหรับส่ง","กรุณาเลือกไฟล์งาน หรือใส่ลิงก์ผลงานอย่างน้อย 1 อย่าง","error");
      return;
    }

    const ok=await confirm({
      title:"ยืนยันส่งงาน?",
      message:`กำลังส่ง ${uploadFiles.length} ไฟล์${submissionLink?" พร้อมลิงก์ผลงาน":""}`,
      confirmText:"ส่งงาน"
    });
    if(!ok)return;

    setBusy(true);
    const uploadedPaths:string[]=[];

    try{
      // Create/prepare the submission row on the database first.
      // This RPC checks assignment access and bypasses accidental client-side RLS conflicts safely.
      const {data:submissionId,error:beginError}=await supabase.rpc("student_begin_submission",{
        p_assignment_id:id,
        p_student_note:studentNote,
        p_submission_link:submissionLink||null
      });

      if(beginError)throw beginError;
      if(!submissionId)throw new Error("ระบบไม่สามารถสร้างรายการส่งงานได้");

      // Upload all selected files.
      for(const file of uploadFiles){
        const unique =
          typeof crypto!=="undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const path=`${user.id}/${id}/${unique}-${safeFileName(file.name)}`;

        const {data:storageData,error:upError}=await supabase.storage
          .from("submissions")
          .upload(path,file,{
            cacheControl:"3600",
            upsert:false,
            contentType:file.type||undefined
          });

        if(upError)throw upError;

        const actualPath=storageData.path;
        uploadedPaths.push(actualPath);

        const {error:fileError}=await supabase
          .from("submission_files")
          .insert({
            submission_id:submissionId,
            file_name:file.name,
            storage_path:actualPath,
            file_size:file.size,
            file_type:file.type||null
          });

        if(fileError)throw fileError;
      }

      // Mark as WAITING_REVIEW/LATE only after every file is uploaded successfully.
      const {data:finalStatus,error:finalError}=await supabase.rpc("student_finalize_submission",{
        p_assignment_id:id
      });

      if(finalError)throw finalError;

      toast(
        "ส่งงานเรียบร้อยแล้ว",
        finalStatus==="LATE"
          ?"ระบบบันทึกเป็นงานส่งล่าช้า และครูสามารถตรวจได้แล้ว"
          :"ครูสามารถเห็นงานในหน้าตรวจงานได้แล้ว",
        "success"
      );

      form.reset();
      await load();
    }catch(error){
      // Clean up files uploaded in this attempt if something fails.
      if(uploadedPaths.length){
        await supabase.storage.from("submissions").remove(uploadedPaths);
      }

      const msg=errText(error);
      setMessage(msg);
      toast("ส่งงานไม่สำเร็จ",msg,"error");
    }finally{
      setBusy(false);
    }
  }

  async function deleteSubmission(){
    if(!submission||busy)return;

    if(submission.status==="GRADED"){
      toast("ลบไม่ได้","งานนี้ครูตรวจและให้คะแนนแล้ว กรุณาติดต่อครูหากต้องการส่งใหม่","error");
      return;
    }

    if(!a.allow_resubmission){
      toast("ลบไม่ได้","ครูไม่ได้เปิดให้ส่งงานใหม่สำหรับงานนี้","error");
      return;
    }

    const ok=await confirm({
      title:"ลบงานที่ส่งแล้ว?",
      message:"ไฟล์ ลิงก์ และสถานะการส่งครั้งนี้จะถูกลบ แล้วคุณสามารถส่งใหม่ได้",
      confirmText:"ลบเพื่อส่งใหม่",
      danger:true
    });
    if(!ok)return;

    setBusy(true);

    try{
      const paths=files.map((f:any)=>f.storage_path).filter(Boolean);

      if(paths.length){
        const {error:storageError}=await supabase.storage
          .from("submissions")
          .remove(paths);

        if(storageError)throw storageError;
      }

      const {error}=await supabase
        .from("submissions")
        .delete()
        .eq("id",submission.id);

      if(error)throw error;

      toast("ลบงานที่ส่งแล้ว","ตอนนี้สามารถเลือกไฟล์และส่งใหม่ได้","success");
      setSubmission(null);
      setFiles([]);
      setComputedStatus("NOT_STARTED");
      await load();
    }catch(error){
      const msg=errText(error);
      setMessage(msg);
      toast("ลบงานไม่สำเร็จ",msg,"error");
    }finally{
      setBusy(false);
    }
  }

  async function openFile(path:string){
    const {data,error}=await supabase.storage
      .from("submissions")
      .createSignedUrl(path,120);

    if(error){
      const msg=errText(error);
      setMessage(msg);
      toast("เปิดไฟล์ไม่ได้",msg,"error");
    }else{
      window.open(data.signedUrl,"_blank","noopener,noreferrer");
    }
  }

  if(!a)return <div>{message||"กำลังโหลด..."}</div>;

  return <>
    <Link className="back-link" to="/student/assignments">← กลับไปงานของฉัน</Link>

    <header className="page-header">
      <div>
        <h1>{a.title}</h1>
        <p>{a.courses?.name} • {a.classrooms?.name||"ทุกคนในรายวิชา"}</p>
      </div>
      <StatusBadge status={computedStatus}/>
    </header>

    {message&&<div className="error">{message}</div>}

    <section className="card section">
      <h2>รายละเอียด</h2>
      <p>{a.description||"-"}</p>

      <h3>คำสั่ง</h3>
      <p className="preline">{a.instructions||"-"}</p>

      <div className="info-grid">
        <div><span>เปิดงาน</span><b>{thaiDate(a.open_at)}</b></div>
        <div><span>กำหนดส่ง</span><b>{thaiDate(a.due_at)}</b></div>
        <div><span>คะแนนเต็ม</span><b>{a.max_score}</b></div>
      </div>
    </section>

    {!submission&&
      <button className="btn primary section" onClick={start} disabled={busy}>
        {busy?"กำลังเริ่มงาน...":"เริ่มทำงาน"}
      </button>
    }

    {submission&&<section className="card section">
      <div className="submission-head">
        <h2>การส่งล่าสุด</h2>
        {submission.status!=="GRADED"&&a.allow_resubmission&&
          <button className="btn danger" onClick={deleteSubmission} disabled={busy}>
            ลบงานนี้เพื่อส่งใหม่
          </button>
        }
      </div>

      <p>วันที่ส่ง: {thaiDate(submission.submitted_at)}</p>

      {submission.submission_link&&
        <p>
          <a className="text-link" href={submission.submission_link} target="_blank" rel="noreferrer">
            เปิดลิงก์ที่ส่ง
          </a>
        </p>
      }

      <div className="file-list">
        {files.map(f=>
          <button key={f.id} className="btn ghost" onClick={()=>openFile(f.storage_path)}>
            📎 {f.file_name}
          </button>
        )}
      </div>

      {submission.teacher_feedback&&
        <div className="feedback">
          <b>Feedback จากครู</b>
          <p>{submission.teacher_feedback}</p>
        </div>
      }

      {submission.score!==null&&submission.score!==undefined&&
        <p><b>คะแนน: {submission.score} / {a.max_score}</b></p>
      }
    </section>}

    <form className="card form section" onSubmit={submit}>
      <h2>{submission?"ส่งงาน/ส่งแก้ไข":"ส่งงาน"}</h2>

      <label className="field">
        <span>ไฟล์งาน (เลือกได้หลายไฟล์)</span>
        <input name="files" type="file" multiple disabled={busy}/>
      </label>

      <label className="field">
        <span>ลิงก์ผลงาน</span>
        <input
          name="submission_link"
          type="url"
          placeholder="Google Drive / GitHub / Canva / เว็บไซต์"
          disabled={busy}
        />
      </label>

      <label className="field">
        <span>หมายเหตุถึงครู</span>
        <textarea name="student_note" rows={3} disabled={busy}/>
      </label>

      <button className="btn primary" disabled={busy}>
        {busy?"กำลังส่งงาน...":"ยืนยันส่งงาน"}
      </button>
    </form>
  </>;
}

import { useEffect,useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { errText, safeFileName, thaiDate } from "../../lib/utils";
import StatusBadge from "../../components/StatusBadge";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { Status } from "../../lib/status";
import { FILE_ACCEPT, validateSubmissionFiles } from "../../lib/fileRules";

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
        .select("*,courses(name,archived_at),classrooms(name)")
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
      setMessage(errText(ae||se||oe));
      return;
    }

    setA(assignment);
    setSubmission(sub);

    const ov=(overview||[]).find((x:any)=>x.assignment_id===id);
    setComputedStatus((ov?.computed_status||sub?.status||"NOT_STARTED") as Status);

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
      const {error}=await supabase.rpc("student_mark_assignment_started_v3",{
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
      toast(
        "ยังไม่มีงานสำหรับส่ง",
        "กรุณาเลือกไฟล์งาน หรือใส่ลิงก์ผลงานอย่างน้อย 1 อย่าง",
        "error"
      );
      return;
    }

    const fileRuleError=validateSubmissionFiles(uploadFiles);
    if(fileRuleError){
      toast("ไฟล์งานไม่ผ่านเงื่อนไข",fileRuleError,"error");
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
      // 1) Backend verifies enrollment/access and prepares the submission.
      const {data:submissionId,error:prepareError}=await supabase.rpc(
        "student_submit_prepare_v3",
        {
          p_assignment_id:id,
          p_student_note:studentNote,
          p_submission_link:submissionLink||null
        }
      );

      if(prepareError)throw prepareError;
      if(!submissionId)throw new Error("ระบบสร้างรายการส่งงานไม่สำเร็จ");

      // 2) Upload files. Storage permission only checks the student's own folder.
      for(const file of uploadFiles){
        const unique =
          typeof crypto!=="undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const path=`${user.id}/${id}/${unique}-${safeFileName(file.name)}`;

        const {data:uploaded,error:uploadError}=await supabase.storage
          .from("submissions")
          .upload(path,file,{
            cacheControl:"3600",
            upsert:false,
            contentType:file.type||undefined
          });

        if(uploadError)throw uploadError;

        uploadedPaths.push(uploaded.path);

        // 3) File metadata is written through a SECURITY DEFINER RPC,
        //    so old RLS policies cannot silently block new students.
        const {error:metaError}=await supabase.rpc(
          "student_register_submission_file_v3",
          {
            p_submission_id:submissionId,
            p_file_name:file.name,
            p_storage_path:uploaded.path,
            p_file_size:file.size,
            p_file_type:file.type||null
          }
        );

        if(metaError)throw metaError;
      }

      // 4) Only now mark the submission as WAITING_REVIEW / LATE.
      const {data:finalStatus,error:finishError}=await supabase.rpc(
        "student_submit_finish_v3",
        {p_assignment_id:id}
      );

      if(finishError)throw finishError;

      toast(
        "ส่งงานเรียบร้อยแล้ว",
        finalStatus==="LATE"
          ?"บันทึกเป็นงานส่งล่าช้า และครูเห็นงานนี้แล้ว"
          :"สถานะเป็นรอตรวจ และครูเห็นงานนี้แล้ว",
        "success"
      );

      form.reset();
      await load();
    }catch(error){
      // Delete files uploaded during this failed attempt.
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
      toast(
        "ลบไม่ได้",
        "งานนี้ครูตรวจและให้คะแนนแล้ว กรุณาติดต่อครูหากต้องการส่งใหม่",
        "error"
      );
      return;
    }

    if(!a.allow_resubmission){
      toast(
        "ลบไม่ได้",
        "ครูไม่ได้เปิดให้ส่งงานใหม่สำหรับงานนี้",
        "error"
      );
      return;
    }

    const ok=await confirm({
      title:"ลบงานที่ส่งแล้ว?",
      message:"ไฟล์และข้อมูลการส่งครั้งนี้จะถูกลบ แล้วสามารถส่งใหม่ได้",
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

      const {error}=await supabase.rpc(
        "student_delete_submission_v3",
        {p_assignment_id:id}
      );

      if(error)throw error;

      toast("ลบงานแล้ว","สามารถส่งงานใหม่ได้ทันที","success");
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

    {!a.courses?.archived_at&&!submission&&
      <button className="btn primary section" onClick={start} disabled={busy}>
        {busy?"กำลังเริ่มงาน...":"เริ่มทำงาน"}
      </button>
    }

    {submission&&<section className="card section">
      <div className="submission-head">
        <h2>การส่งล่าสุด</h2>

        {submission.status!=="GRADED"&&a.allow_resubmission&&!a.courses?.archived_at&&
          <button className="btn danger" onClick={deleteSubmission} disabled={busy}>
            ลบงานนี้เพื่อส่งใหม่
          </button>
        }
      </div>

      <p>วันที่ส่ง: {thaiDate(submission.submitted_at)}</p>

      {submission.submission_link&&
        <p>
          <a
            className="text-link"
            href={submission.submission_link}
            target="_blank"
            rel="noreferrer"
          >
            เปิดลิงก์ที่ส่ง
          </a>
        </p>
      }

      <div className="file-list">
        {files.map(f=>
          <button
            key={f.id}
            className="btn ghost"
            onClick={()=>openFile(f.storage_path)}
          >
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

    {a.courses?.archived_at
      ? <div className="notice section">รายวิชานี้จบแล้ว จึงปิดการส่งงานใหม่</div>
      : <form className="card form section" onSubmit={submit}>
      <h2>{submission?"ส่งงาน/ส่งแก้ไข":"ส่งงาน"}</h2>

      <label className="field">
        <span>ไฟล์งาน (เลือกได้หลายไฟล์)</span>
        <input name="files" type="file" multiple accept={FILE_ACCEPT} disabled={busy}/>
      </label>

      <div className="hint">ส่งได้สูงสุด 10 ไฟล์ • ไม่เกิน 20 MB ต่อไฟล์</div>

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
    </form>}
  </>;
}

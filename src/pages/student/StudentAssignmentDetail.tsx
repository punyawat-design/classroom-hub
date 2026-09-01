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
  const {toast}=useToast();
  const {confirm}=useConfirm();

  async function load(){
    if(!user||!id)return;
    const [{data:assignment,error:ae},{data:sub,error:se},{data:overview}]=await Promise.all([
      supabase.from("assignments").select("*,courses(name),classrooms(name)").eq("id",id).single(),
      supabase.from("submissions").select("*").eq("assignment_id",id).eq("student_id",user.id).maybeSingle(),
      supabase.rpc("student_assignment_overview",{p_student_id:user.id})
    ]);
    if(ae||se){setMessage(errText(ae||se));return;}
    setA(assignment);setSubmission(sub);
    const ov=(overview||[]).find((x:any)=>x.assignment_id===id);
    if(ov)setComputedStatus(ov.computed_status);
    if(sub){
      const {data:f}=await supabase.from("submission_files").select("*").eq("submission_id",sub.id).order("uploaded_at");
      setFiles(f||[]);
    } else setFiles([]);
  }
  useEffect(()=>{load()},[user,id]);

  async function start(){
    if(!user)return;
    const {error}=await supabase.from("submissions").upsert({
      assignment_id:id,student_id:user.id,status:"IN_PROGRESS",started_at:new Date().toISOString()
    },{onConflict:"assignment_id,student_id"});
    if(error)setMessage(errText(error));else load();
  }

  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setMessage("");
    if(!user||!a)return;
    const ok=await confirm({title:"ยืนยันส่งงาน?",message:"ตรวจสอบไฟล์ ลิงก์ และหมายเหตุให้เรียบร้อยก่อนส่ง",confirmText:"ส่งงาน"});
    if(!ok)return;
    if(new Date()>new Date(a.due_at)&&!a.allow_late_submission){setMessage("งานนี้ไม่อนุญาตให้ส่งหลังหมดเวลา");return;}
    if(submission?.submitted_at&&!a.allow_resubmission&&submission.status!=="REVISION_REQUIRED"){setMessage("งานนี้ไม่อนุญาตให้ส่งใหม่");return;}

    const fd=new FormData(e.currentTarget);
    const input=e.currentTarget.elements.namedItem("files") as HTMLInputElement;
    const uploadFiles=Array.from(input.files||[]);
    const now=new Date();
    const late=now>new Date(a.due_at);
    const {data:sub,error:subError}=await supabase.from("submissions").upsert({
      assignment_id:id,student_id:user.id,
      status:late?"LATE":"WAITING_REVIEW",
      submitted_at:now.toISOString(),
      is_late:late,
      student_note:String(fd.get("student_note")||""),
      submission_link:String(fd.get("submission_link")||"")||null
    },{onConflict:"assignment_id,student_id"}).select().single();

    if(subError){setMessage(errText(subError));return;}

    for(const file of uploadFiles){
      const path=`${user.id}/${id}/${Date.now()}-${safeFileName(file.name)}`;
      const {error:upError}=await supabase.storage.from("submissions").upload(path,file);
      if(upError){setMessage(errText(upError));return;}
      const {error:fileError}=await supabase.from("submission_files").insert({
        submission_id:sub.id,file_name:file.name,storage_path:path,file_size:file.size,file_type:file.type
      });
      if(fileError){setMessage(errText(fileError));return;}
    }
    setMessage("");
    toast("ส่งงานเรียบร้อยแล้ว",late?"ระบบบันทึกว่าเป็นงานส่งล่าช้า":"ครูจะเห็นงานในหน้ารอตรวจ","success");
    e.currentTarget.reset();
    load();
  }


  async function deleteSubmission(){
    if(!submission)return;
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

    const paths=files.map((f:any)=>f.storage_path).filter(Boolean);
    if(paths.length){
      const {error:storageError}=await supabase.storage.from("submissions").remove(paths);
      if(storageError){toast("ลบไฟล์ไม่สำเร็จ",errText(storageError),"error");return;}
    }

    const {error}=await supabase.from("submissions").delete().eq("id",submission.id);
    if(error){toast("ลบงานไม่สำเร็จ",errText(error),"error");return;}

    toast("ลบงานที่ส่งแล้ว","ตอนนี้สามารถเลือกไฟล์และส่งใหม่ได้","success");
    setSubmission(null);setFiles([]);setComputedStatus("NOT_STARTED");
    load();
  }

  async function openFile(path:string){
    const {data,error}=await supabase.storage.from("submissions").createSignedUrl(path,120);
    if(error)setMessage(errText(error)); else window.open(data.signedUrl,"_blank","noopener,noreferrer");
  }

  if(!a)return <div>{message||"กำลังโหลด..."}</div>;

  return <>
    <Link className="back-link" to="/student/assignments">← กลับไปงานของฉัน</Link>
    <header className="page-header"><div><h1>{a.title}</h1><p>{a.courses?.name} • {a.classrooms?.name}</p></div><StatusBadge status={computedStatus}/></header>
    {message&&<div className={message.includes("เรียบร้อย")?"success":"notice"}>{message}</div>}
    <section className="card section">
      <h2>รายละเอียด</h2><p>{a.description||"-"}</p>
      <h3>คำสั่ง</h3><p className="preline">{a.instructions||"-"}</p>
      <div className="info-grid"><div><span>เปิดงาน</span><b>{thaiDate(a.open_at)}</b></div><div><span>กำหนดส่ง</span><b>{thaiDate(a.due_at)}</b></div><div><span>คะแนนเต็ม</span><b>{a.max_score}</b></div></div>
    </section>
    {!submission&&<button className="btn primary section" onClick={start}>เริ่มทำงาน</button>}
    {submission&&<section className="card section">
      <div className="submission-head"><h2>การส่งล่าสุด</h2>
        {submission.status!=="GRADED"&&a.allow_resubmission&&<button className="btn danger" onClick={deleteSubmission}>ลบงานนี้เพื่อส่งใหม่</button>}
      </div>
      <p>วันที่ส่ง: {thaiDate(submission.submitted_at)}</p>
      {submission.submission_link&&<p><a className="text-link" href={submission.submission_link} target="_blank" rel="noreferrer">เปิดลิงก์ที่ส่ง</a></p>}
      <div className="file-list">{files.map(f=><button key={f.id} className="btn ghost" onClick={()=>openFile(f.storage_path)}>📎 {f.file_name}</button>)}</div>
      {submission.teacher_feedback&&<div className="feedback"><b>Feedback จากครู</b><p>{submission.teacher_feedback}</p></div>}
      {submission.score!==null&&submission.score!==undefined&&<p><b>คะแนน: {submission.score} / {a.max_score}</b></p>}
    </section>}
    <form className="card form section" onSubmit={submit}>
      <h2>{submission?"ส่งงาน/ส่งแก้ไข":"ส่งงาน"}</h2>
      <label className="field"><span>ไฟล์งาน (เลือกได้หลายไฟล์)</span><input name="files" type="file" multiple/></label>
      <label className="field"><span>ลิงก์ผลงาน</span><input name="submission_link" type="url" placeholder="Google Drive / GitHub / Canva / เว็บไซต์"/></label>
      <label className="field"><span>หมายเหตุถึงครู</span><textarea name="student_note" rows={3}/></label>
      <button className="btn primary">ยืนยันส่งงาน</button>
    </form>
  </>;
}

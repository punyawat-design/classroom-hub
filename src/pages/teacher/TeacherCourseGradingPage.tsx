import { useEffect,useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { errText, thaiDate } from "../../lib/utils";
import StatusBadge from "../../components/StatusBadge";
import { Status } from "../../lib/status";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";

export default function TeacherCourseGradingPage(){
  const {courseId=""}=useParams();
  const [rows,setRows]=useState<any[]>([]);
  const [message,setMessage]=useState("");
  const {toast}=useToast();
  const {confirm}=useConfirm();

  async function load(){
    const {data,error}=await supabase.rpc("teacher_pending_submissions");
    if(error)setMessage(errText(error)); else setRows((data||[]).filter((x:any)=>x.course_id===courseId));
  }
  useEffect(()=>{load()},[courseId]);

  async function openFile(path:string){
    const {data,error}=await supabase.storage.from("submissions").createSignedUrl(path,120);
    if(error){toast("เปิดไฟล์ไม่ได้",errText(error),"error");return;}
    window.open(data.signedUrl,"_blank","noopener,noreferrer");
  }

  async function grade(submissionId:string,max:number,mode:"grade"|"revision"){
    const scoreEl=document.getElementById(`score-${submissionId}`) as HTMLInputElement|null;
    const feedEl=document.getElementById(`feedback-${submissionId}`) as HTMLTextAreaElement|null;
    const score=Number(scoreEl?.value||0);
    if(mode==="grade"&&(score<0||score>Number(max))){toast("คะแนนไม่ถูกต้อง",`คะแนนต้องอยู่ระหว่าง 0 ถึง ${max}`,"error");return;}

    const ok=await confirm({
      title:mode==="grade"?"ยืนยันการบันทึกคะแนน":"ส่งงานกลับให้นักเรียนแก้ไข?",
      message:mode==="grade"?`บันทึกคะแนน ${score} / ${max} ใช่หรือไม่`:"นักเรียนจะเห็นสถานะ “ต้องแก้ไข” และ Feedback ของครู",
      confirmText:mode==="grade"?"บันทึกคะแนน":"ส่งกลับแก้ไข"
    });
    if(!ok)return;

    const patch=mode==="grade"
      ? {score,teacher_feedback:feedEl?.value||"",graded_at:new Date().toISOString(),status:"GRADED"}
      : {teacher_feedback:feedEl?.value||"",status:"REVISION_REQUIRED"};
    const {error}=await supabase.from("submissions").update(patch).eq("id",submissionId);
    if(error)toast("ดำเนินการไม่สำเร็จ",errText(error),"error");
    else {toast(mode==="grade"?"บันทึกคะแนนแล้ว":"ส่งกลับให้นักเรียนแก้ไขแล้ว","","success");load();}
  }

  const courseName=rows[0]?.course_name||"รายวิชา";
  return <>
    <Link className="back-link" to="/teacher/grading">← กลับไปเลือกรายวิชา</Link>
    <header className="page-header"><div><h1>{courseName}</h1><p>งานที่รอตรวจ</p></div></header>
    {message&&<div className="error">{message}</div>}
    <div className="cards-list section">{rows.map(x=><article className="card grading-card" key={x.submission_id}>
      <div className="grading-head"><div><h3>{x.assignment_title}</h3><div className="muted">{x.student_code||"-"} • {x.full_name} • {thaiDate(x.submitted_at)}</div></div><StatusBadge status={x.computed_status as Status}/></div>
      {x.student_note&&<p><b>หมายเหตุ:</b> {x.student_note}</p>}
      {x.submission_link&&<p><a className="text-link" href={x.submission_link} target="_blank" rel="noreferrer">เปิดลิงก์ที่นักเรียนส่ง</a></p>}
      <div className="file-list">{(x.files||[]).map((f:any)=><button className="btn ghost" type="button" key={f.storage_path} onClick={()=>openFile(f.storage_path)}>📎 {f.file_name}</button>)}</div>
      <div className="two-col top-gap">
        <label className="field"><span>คะแนน / {x.max_score}</span><input id={`score-${x.submission_id}`} type="number" min={0} max={x.max_score} defaultValue={x.score??0}/></label>
        <label className="field"><span>Feedback</span><textarea id={`feedback-${x.submission_id}`} defaultValue={x.teacher_feedback||""} rows={3}/></label>
      </div>
      <div className="actions"><button className="btn primary" onClick={()=>grade(x.submission_id,x.max_score,"grade")}>บันทึกคะแนน</button><button className="btn warning" onClick={()=>grade(x.submission_id,x.max_score,"revision")}>ส่งกลับให้แก้ไข</button></div>
    </article>)}
    {rows.length===0&&<div className="great-job"><div>🌟</div><h2>เก่งมาก!</h2><p>วิชานี้ไม่มีงานค้างให้ตรวจ</p></div>}</div>
  </>;
}

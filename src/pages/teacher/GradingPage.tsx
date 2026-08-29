import { useEffect,useState } from "react";
import { supabase } from "../../lib/supabase";
import { errText, thaiDate } from "../../lib/utils";
import StatusBadge from "../../components/StatusBadge";
import { Status } from "../../lib/status";

export default function GradingPage(){
  const [rows,setRows]=useState<any[]>([]);
  const [message,setMessage]=useState("");

  async function load(){
    const {data,error}=await supabase.rpc("teacher_pending_submissions");
    if(error)setMessage(errText(error)); else setRows(data||[]);
  }
  useEffect(()=>{load()},[]);

  async function openFile(path:string){
    const {data,error}=await supabase.storage.from("submissions").createSignedUrl(path,60);
    if(error){setMessage(errText(error));return;}
    window.open(data.signedUrl,"_blank","noopener,noreferrer");
  }

  async function grade(submissionId:string,max:number,mode:"grade"|"revision"){
    const scoreEl=document.getElementById(`score-${submissionId}`) as HTMLInputElement|null;
    const feedEl=document.getElementById(`feedback-${submissionId}`) as HTMLTextAreaElement|null;
    const score=Number(scoreEl?.value||0);
    if(mode==="grade"&&(score<0||score>Number(max))){setMessage(`คะแนนต้องอยู่ระหว่าง 0 ถึง ${max}`);return;}
    const patch=mode==="grade"
      ? {score,teacher_feedback:feedEl?.value||"",graded_at:new Date().toISOString(),status:"GRADED"}
      : {teacher_feedback:feedEl?.value||"",status:"REVISION_REQUIRED"};
    const {error}=await supabase.from("submissions").update(patch).eq("id",submissionId);
    if(error)setMessage(errText(error)); else {setMessage(mode==="grade"?"บันทึกคะแนนแล้ว":"ส่งกลับให้แก้ไขแล้ว");load();}
  }

  return <>
    <header className="page-header"><div><h1>ตรวจงาน</h1><p>งานที่รอตรวจและงานที่ส่งล่าช้า</p></div></header>
    {message&&<div className={message.includes("แล้ว")?"success":"notice"}>{message}</div>}
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
    {rows.length===0&&<div className="empty card">ไม่มีงานรอตรวจ 🎉</div>}</div>
  </>;
}

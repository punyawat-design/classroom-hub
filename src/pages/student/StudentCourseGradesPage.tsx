import { useEffect,useMemo,useState } from "react";
import type { CSSProperties } from "react";
import { Link,useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import StatusBadge from "../../components/StatusBadge";
import PixelPlantGarden from "../../components/PixelPlantGarden";
import { Status } from "../../lib/status";

type GradeRow={
  assignment_id:string;
  assignment_title:string;
  course_id?:string|null;
  course_name:string;
  max_score:number|string|null;
  score:number|string|null;
  teacher_feedback?:string|null;
  computed_status:string;
  due_at?:string|null;
};

function num(v:unknown){
  const n=Number(v);
  return Number.isFinite(n)?n:0;
}

function rowRef(row:GradeRow){
  return row.course_id || `name:${encodeURIComponent(row.course_name)}`;
}

export default function StudentCourseGradesPage(){
  const {courseRef=""}=useParams();
  const decodedRef=courseRef;
  const {user}=useAuth();
  const [rows,setRows]=useState<GradeRow[]>([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    if(!user)return;
    let alive=true;
    (async()=>{
      setLoading(true);
      let result=await supabase.rpc("student_gradebook_v2",{p_student_id:user.id});
      if(result.error){
        result=await supabase.rpc("student_gradebook",{p_student_id:user.id});
      }
      const all=(result.data||[]) as GradeRow[];
      if(alive){
        setRows(all.filter(row=>rowRef(row)===decodedRef));
        setLoading(false);
      }
    })();
    return()=>{alive=false};
  },[user,decodedRef]);

  const summary=useMemo(()=>{
    const earned=rows.reduce((sum,row)=>sum+(row.score==null?0:num(row.score)),0);
    const possible=rows.reduce((sum,row)=>sum+num(row.max_score),0);
    const graded=rows.filter(row=>row.score!=null).length;
    const percent=possible>0?Math.max(0,Math.min(100,Math.round((earned/possible)*100))):0;
    return {earned,possible,graded,percent};
  },[rows]);

  const courseName=rows[0]?.course_name||"รายละเอียดคะแนน";

  return <>
    <div className="back-row"><Link to="/student/grades"><ArrowLeft size={17}/> กลับหน้าคะแนน</Link></div>
    <header className="page-header course-grade-head">
      <div>
        <span className="grade-course-label">SCORE QUEST</span>
        <h1>{courseName}</h1>
        <p>คะแนนรวมจากงานทั้งหมดในรายวิชานี้</p>
      </div>
    </header>

    {loading?<div className="empty">กำลังโหลดคะแนน...</div>:<>
      <section className={`course-score-hero ${summary.percent===100?"is-perfect":""}`}>
        <div className="course-score-number">
          <span>คะแนนที่ได้รับ</span>
          <strong>{summary.earned.toLocaleString()} <small>/ {summary.possible.toLocaleString()}</small></strong>
          <p>ตรวจแล้ว {summary.graded}/{rows.length} งาน</p>
        </div>
        <div className="course-score-ring" style={{"--score":`${summary.percent*3.6}deg`} as CSSProperties}>
          <div><b>{summary.percent}%</b><span>เติบโต</span></div>
        </div>
        {summary.percent===100&&<div className="perfect-course-burst"><Sparkles/> PERFECT!</div>}
      </section>

      <section className="section plant-garden-section">
        <div className="section-title-row">
          <div>
            <h2>🌱 สวนคะแนนของฉัน</h2>
            <p>เลื่อนไปด้านข้างเพื่อดูต้นไม้ทั้ง 3 แบบ • ต้นไม้จะโตตามเปอร์เซ็นต์คะแนน</p>
          </div>
        </div>
        <PixelPlantGarden percent={summary.percent}/>
      </section>

      <section className="table-card section grade-detail-table">
        <table>
          <thead><tr><th>งาน</th><th>สถานะ</th><th>คะแนน</th><th>Feedback</th></tr></thead>
          <tbody>
            {rows.map(row=><tr key={row.assignment_id}>
              <td><b>{row.assignment_title}</b></td>
              <td><StatusBadge status={row.computed_status as Status}/></td>
              <td className="score-cell">{row.score==null?"-":<><CheckCircle2 size={16}/><b>{num(row.score).toLocaleString()} / {num(row.max_score).toLocaleString()}</b></>}</td>
              <td>{row.teacher_feedback||"-"}</td>
            </tr>)}
          </tbody>
        </table>
      </section>
    </>}
  </>;
}

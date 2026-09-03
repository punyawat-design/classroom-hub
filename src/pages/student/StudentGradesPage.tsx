import { useEffect,useMemo,useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Sparkles, Trophy } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import PixelPlantGarden from "../../components/PixelPlantGarden";

type GradeRow={
  assignment_id:string;
  assignment_title:string;
  course_id?:string|null;
  course_name:string;
  max_score:number|string|null;
  score:number|string|null;
  teacher_feedback?:string|null;
  computed_status:string;
};

type CourseSummary={
  courseId:string;
  courseName:string;
  earned:number;
  possible:number;
  assignments:number;
  graded:number;
  percent:number;
};

function num(v:unknown){
  const n=Number(v);
  return Number.isFinite(n)?n:0;
}

function courseRef(row:GradeRow){
  return row.course_id || `name:${encodeURIComponent(row.course_name)}`;
}

export default function StudentGradesPage(){
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
      if(alive){
        setRows((result.data||[]) as GradeRow[]);
        setLoading(false);
      }
    })();
    return()=>{alive=false};
  },[user]);

  const courses=useMemo<CourseSummary[]>(()=>{
    const map=new Map<string,CourseSummary>();
    for(const row of rows){
      const key=courseRef(row);
      const current=map.get(key)||{
        courseId:key,
        courseName:row.course_name,
        earned:0,
        possible:0,
        assignments:0,
        graded:0,
        percent:0
      };
      current.assignments+=1;
      current.possible+=num(row.max_score);
      if(row.score!=null){
        current.earned+=num(row.score);
        current.graded+=1;
      }
      map.set(key,current);
    }
    return [...map.values()].map(course=>({
      ...course,
      percent:course.possible>0?Math.max(0,Math.min(100,Math.round((course.earned/course.possible)*100))):0
    })).sort((a,b)=>a.courseName.localeCompare(b.courseName,"th"));
  },[rows]);

  const all=useMemo(()=>{
    const earned=courses.reduce((s,c)=>s+c.earned,0);
    const possible=courses.reduce((s,c)=>s+c.possible,0);
    return {earned,possible,percent:possible>0?Math.max(0,Math.min(100,Math.round(earned/possible*100))):0};
  },[courses]);

  return <>
    <header className="page-header grades-page-head">
      <div>
        <h1>คะแนนของฉัน</h1>
        <p>เลือกแต่ละรายวิชาเพื่อดูคะแนน Feedback และสวนคะแนนที่เติบโตไปพร้อมกับคุณ</p>
      </div>
      <div className="all-score-pill"><Trophy size={18}/><b>{all.earned.toLocaleString()} / {all.possible.toLocaleString()}</b></div>
    </header>

    <section className="grade-overall-card">
      <div>
        <span>คะแนนรวมทุกวิชา</span>
        <strong>{all.earned.toLocaleString()} <small>/ {all.possible.toLocaleString()}</small></strong>
        <p>{all.possible?`คิดเป็น ${all.percent}% ของคะแนนเต็มทั้งหมด`:"ยังไม่มีงานที่มีคะแนน"}</p>
      </div>
      <div className="overall-progress" aria-label={`คะแนนรวม ${all.percent}%`}>
        <i style={{width:`${all.percent}%`}}/>
      </div>
      {all.percent===100&&<div className="perfect-banner"><Sparkles size={18}/> PERFECT SCORE!</div>}
    </section>

    {loading?<div className="empty">กำลังโหลดคะแนน...</div>:courses.length===0?<div className="empty">ยังไม่มีงานในรายวิชาของคุณ</div>:<div className="grade-course-grid">
      {courses.map((course,index)=>{
        const kind=(['sunflower','blossom','sprout'] as const)[index%3];
        return <Link className="grade-course-card" to={`/student/grades/course/${encodeURIComponent(course.courseId)}`} key={course.courseId}>
          <div className="grade-course-info">
            <div className="grade-course-label">รายวิชา</div>
            <h2>{course.courseName}</h2>
            <div className="grade-score-big">{course.earned.toLocaleString()} <span>/ {course.possible.toLocaleString()}</span></div>
            <div className="grade-course-meta">ตรวจแล้ว {course.graded}/{course.assignments} งาน • {course.percent}%</div>
            <div className="grade-card-progress"><i style={{width:`${course.percent}%`}}/></div>
          </div>
          <PixelPlantGarden compact percent={course.percent} kind={kind}/>
          <div className="grade-card-arrow"><ChevronRight size={22}/></div>
        </Link>;
      })}
    </div>}
  </>;
}

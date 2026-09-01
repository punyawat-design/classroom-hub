import { useEffect,useState } from "react";
import { Link } from "react-router-dom";
import StatCard from "../../components/StatCard";
import { supabase } from "../../lib/supabase";
import { errText } from "../../lib/utils";

export default function TeacherDashboard() {
  const [stats,setStats] = useState({students:0,assignments:0,pending:0,missing:0});
  const [error,setError] = useState("");

  useEffect(()=>{(async()=>{
    const {data,error}=await supabase.rpc("teacher_dashboard_stats");
    if(error){setError(errText(error));return;}

    const x=data?.[0];
    if(x) setStats({
      students:Number(x.students||0),
      assignments:Number(x.assignments||0),
      pending:Number(x.pending||0),
      missing:Number(x.missing||0)
    });
  })()},[]);

  return <>
    <header className="page-header">
      <div>
        <h1>แดชบอร์ดครู</h1>
        <p>ดูสถานะงานและติดตามนักเรียนจากจุดเดียว</p>
      </div>
    </header>

    {error&&<div className="error">{error}</div>}

    <section className="stats-grid">
      <StatCard label="นักเรียนในความดูแล" value={stats.students}/>
      <StatCard label="งานทั้งหมด" value={stats.assignments}/>
      <StatCard label="งานรอตรวจ" value={stats.pending}/>
      <StatCard label="งานเลยกำหนดที่ยังไม่ส่ง" value={stats.missing}/>
    </section>

    <section className="card section">
      <h2>ทางลัดการใช้งาน</h2>

      <div className="quick-grid">
        <Link to="/teacher/assignments/new">+ สร้างงานใหม่</Link>
        <Link to="/teacher/assignments">จัดการงานตามรายวิชา</Link>
        <Link to="/teacher/tracking">ดูว่าใครยังไม่ส่ง</Link>
        <Link to="/teacher/grading">ตรวจงานและให้คะแนน</Link>
      </div>
    </section>
  </>;
}

import { useEffect,useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import StatusBadge from "../../components/StatusBadge";
import { Status } from "../../lib/status";

export default function StudentGradesPage(){
  const {user}=useAuth();
  const [rows,setRows]=useState<any[]>([]);
  useEffect(()=>{if(user) supabase.rpc("student_gradebook",{p_student_id:user.id}).then(({data})=>setRows(data||[]))},[user]);
  return <>
    <header className="page-header"><div><h1>คะแนน</h1><p>คะแนนและ Feedback ของแต่ละงาน</p></div></header>
    <div className="table-card section"><table>
      <thead><tr><th>งาน</th><th>รายวิชา</th><th>สถานะ</th><th>คะแนน</th><th>Feedback</th></tr></thead>
      <tbody>{rows.map(x=><tr key={x.assignment_id}><td><b>{x.assignment_title}</b></td><td>{x.course_name}</td><td><StatusBadge status={x.computed_status as Status}/></td><td>{x.score==null?"-":`${x.score} / ${x.max_score}`}</td><td>{x.teacher_feedback||"-"}</td></tr>)}</tbody>
    </table></div>
  </>;
}

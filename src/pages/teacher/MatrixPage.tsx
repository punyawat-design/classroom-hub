import { useEffect,useState } from "react";
import { supabase } from "../../lib/supabase";
import { Status } from "../../lib/status";
import StatusBadge from "../../components/StatusBadge";
import { errText } from "../../lib/utils";

export default function MatrixPage(){
  const [rooms,setRooms]=useState<any[]>([]);
  const [room,setRoom]=useState("");
  const [rows,setRows]=useState<any[]>([]);
  const [error,setError]=useState("");

  useEffect(()=>{
    supabase.from("classrooms").select("id,name").order("name")
      .then(({data})=>setRooms(data||[]))
  },[]);

  async function load(id:string){
    setRoom(id);setRows([]);setError("");
    if(!id)return;
    const {data,error}=await supabase.rpc("classroom_assignment_matrix",{p_classroom_id:id});
    if(error)setError(errText(error));
    else setRows(data||[]);
  }

  const assignments=Array.from(new Map(rows.map(r=>[r.assignment_id,r.assignment_title])).entries());
  const students=Array.from(new Map(rows.map(r=>[r.student_id,r.full_name])).entries());

  return <>
    <header className="page-header">
      <div>
        <h1>ภาพรวมงานค้าง</h1>
        <p>แสดงสถานะเป็นข้อความสี เพื่อดูง่ายกว่าจุดสี</p>
      </div>
    </header>

    {error&&<div className="error">{error}</div>}

    <div className="toolbar section">
      <select value={room} onChange={e=>load(e.target.value)}>
        <option value="">เลือกห้องเรียน</option>
        {rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
    </div>

    <div className="legend status-legend section">
      <StatusBadge status="GRADED"/>
      <StatusBadge status="WAITING_REVIEW"/>
      <StatusBadge status="IN_PROGRESS"/>
      <StatusBadge status="REVISION_REQUIRED"/>
      <StatusBadge status="LATE"/>
      <StatusBadge status="OVERDUE"/>
      <StatusBadge status="NOT_STARTED"/>
    </div>

    <div className="table-card section matrix">
      <table>
        <thead>
          <tr>
            <th>นักเรียน</th>
            {assignments.map(([id,title])=><th key={id}>{title}</th>)}
          </tr>
        </thead>
        <tbody>
          {students.map(([sid,name])=><tr key={sid}>
            <td><b>{name}</b></td>
            {assignments.map(([aid])=>{
              const x=rows.find(r=>r.student_id===sid&&r.assignment_id===aid);
              const s=(x?.computed_status||"NOT_STARTED") as Status;
              return <td key={aid} className="matrix-status-cell">
                <StatusBadge status={s}/>
              </td>
            })}
          </tr>)}
        </tbody>
      </table>

      {room&&rows.length===0&&<div className="empty">ยังไม่มี Assignment หรือไม่มีนักเรียนในห้องนี้</div>}
    </div>
  </>;
}

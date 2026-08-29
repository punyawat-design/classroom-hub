import { useEffect,useState } from "react";
import { supabase } from "../../lib/supabase";
import { statusLabel, Status } from "../../lib/status";
import { errText } from "../../lib/utils";

const icon:Record<string,string>={
  GRADED:"🟢",WAITING_REVIEW:"🟣",IN_PROGRESS:"🔵",
  REVISION_REQUIRED:"🟡",LATE:"🟠",NOT_STARTED:"⚪",OVERDUE:"🔴"
};

export default function MatrixPage(){
  const [rooms,setRooms]=useState<any[]>([]);
  const [room,setRoom]=useState("");
  const [rows,setRows]=useState<any[]>([]);
  const [error,setError]=useState("");

  useEffect(()=>{supabase.from("classrooms").select("id,name").order("name").then(({data})=>setRooms(data||[]))},[]);
  async function load(id:string){
    setRoom(id);setRows([]);setError("");
    if(!id)return;
    const {data,error}=await supabase.rpc("classroom_assignment_matrix",{p_classroom_id:id});
    if(error)setError(errText(error)); else setRows(data||[]);
  }
  const assignments=Array.from(new Map(rows.map(r=>[r.assignment_id,r.assignment_title])).entries());
  const students=Array.from(new Map(rows.map(r=>[r.student_id,r.full_name])).entries());

  return <>
    <header className="page-header"><div><h1>ภาพรวมงานค้าง</h1><p>Matrix ช่วยให้เห็นทั้งห้องในหน้าเดียว</p></div></header>
    {error&&<div className="error">{error}</div>}
    <div className="toolbar section"><select value={room} onChange={e=>load(e.target.value)}><option value="">เลือกห้องเรียน</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
    <div className="legend section"><span>🟢 ตรวจแล้ว</span><span>🟣 รอตรวจ</span><span>🔵 กำลังทำ</span><span>🟡 ต้องแก้</span><span>🟠 ส่งช้า</span><span>🔴 เลยกำหนด</span><span>⚪ ยังไม่เริ่ม</span></div>
    <div className="table-card section matrix"><table>
      <thead><tr><th>นักเรียน</th>{assignments.map(([id,title])=><th key={id}>{title}</th>)}</tr></thead>
      <tbody>{students.map(([sid,name])=><tr key={sid}><td><b>{name}</b></td>{assignments.map(([aid])=>{
        const x=rows.find(r=>r.student_id===sid&&r.assignment_id===aid);
        const s=(x?.computed_status||"NOT_STARTED") as Status;
        return <td key={aid} className="matrix-cell" title={statusLabel[s]}>{icon[s]}</td>
      })}</tr>)}</tbody>
    </table>{room&&rows.length===0&&<div className="empty">ยังไม่มี Assignment หรือไม่มีนักเรียนในห้องนี้</div>}</div>
  </>;
}

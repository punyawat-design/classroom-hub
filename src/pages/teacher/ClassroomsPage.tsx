import { useEffect,useRef,useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightLeft,Check,FileSpreadsheet,Search,Trash2,UserPlus } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { errText } from "../../lib/utils";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";

type StudentSearchResult={
  student_id:string;
  student_code:string|null;
  full_name:string;
  nickname:string|null;
  already_in_room:boolean;
};

export default function ClassroomsPage(){
  const {toast}=useToast();
  const {confirm}=useConfirm();
  const [rooms,setRooms]=useState<any[]>([]);
  const [selected,setSelected]=useState("");
  const [students,setStudents]=useState<any[]>([]);
  const [name,setName]=useState("");
  const [code,setCode]=useState("");
  const [message,setMessage]=useState("");

  const [searchResults,setSearchResults]=useState<StudentSearchResult[]>([]);
  const [searching,setSearching]=useState(false);
  const [showSuggestions,setShowSuggestions]=useState(false);
  const [chosenStudent,setChosenStudent]=useState<StudentSearchResult|null>(null);
  const searchSeq=useRef(0);

  const [movingStudent,setMovingStudent]=useState<any|null>(null);
  const [moveTarget,setMoveTarget]=useState("");
  const [moving,setMoving]=useState(false);

  async function loadRooms(){
    const {data,error}=await supabase.from("classrooms").select("id,name,created_at").order("name");
    if(error)setMessage(errText(error)); else setRooms(data||[]);
  }

  async function loadStudents(id:string){
    setSelected(id);setStudents([]);setCode("");setChosenStudent(null);setSearchResults([]);setShowSuggestions(false);
    if(!id)return;
    const {data,error}=await supabase.rpc("teacher_classroom_students",{p_classroom_id:id});
    if(error)setMessage(errText(error)); else setStudents(data||[]);
  }

  useEffect(()=>{loadRooms()},[]);

  useEffect(()=>{
    if(!selected || !code.trim()){
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const current=++searchSeq.current;
    const timer=window.setTimeout(async()=>{
      setSearching(true);
      const {data,error}=await supabase.rpc("teacher_search_students",{
        p_query:code.trim(),
        p_classroom_id:selected
      });

      if(current!==searchSeq.current)return;
      setSearching(false);

      if(error){
        setSearchResults([]);
        setMessage(errText(error));
        return;
      }

      setSearchResults((data||[]) as StudentSearchResult[]);
      setShowSuggestions(true);
    },220);

    return ()=>window.clearTimeout(timer);
  },[code,selected]);

  async function createRoom(e:React.FormEvent){
    e.preventDefault();setMessage("");
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return;
    const {error}=await supabase.from("classrooms").insert({name,teacher_id:user.id});
    if(error)setMessage(errText(error)); else {setName("");setMessage("สร้างห้องเรียนแล้ว");toast("สร้างห้องเรียนแล้ว","","success");await loadRooms();}
  }

  function chooseStudent(s:StudentSearchResult){
    setChosenStudent(s);
    setCode(s.student_code||s.full_name);
    setShowSuggestions(false);
  }

  async function enroll(e:React.FormEvent){
    e.preventDefault();if(!selected)return;

    if(chosenStudent?.already_in_room){
      toast("นักเรียนอยู่ในห้องนี้แล้ว","ไม่ต้องเพิ่มซ้ำ","info");
      return;
    }

    const studentCode=(chosenStudent?.student_code||code).trim();
    if(!studentCode){
      toast("กรุณาเลือกนักเรียน","ค้นหาด้วยชื่อ ชื่อเล่น หรือรหัสนักเรียนก่อน","error");
      return;
    }

    const {data,error}=await supabase.rpc("teacher_enroll_student_by_code",{p_classroom_id:selected,p_student_code:studentCode});
    if(error)setMessage(errText(error)); else {
      setMessage(String(data));
      setCode("");setChosenStudent(null);setSearchResults([]);setShowSuggestions(false);
      await loadStudents(selected);
    }
  }

  async function removeStudent(student:any){
    const room=rooms.find(r=>r.id===selected);
    const ok=await confirm({
      title:"นำออกจากห้องเรียน?",
      message:`${student.full_name} จะถูกนำออกจากห้อง “${room?.name||"นี้"}” เท่านั้น บัญชี งานที่ส่ง และคะแนนเดิมจะไม่ถูกลบ`,
      confirmText:"นำออกจากห้อง",
      danger:true
    });
    if(!ok)return;

    const {data,error}=await supabase.rpc("teacher_remove_student_from_classroom_v1",{
      p_classroom_id:selected,
      p_student_id:student.student_id
    });

    if(error){toast("นำออกจากห้องไม่สำเร็จ",errText(error),"error");return;}
    toast("นำออกจากห้องแล้ว",String(data||student.full_name),"success");
    await loadStudents(selected);
  }

  function openMove(student:any){
    const firstTarget=rooms.find(r=>r.id!==selected)?.id||"";
    setMovingStudent(student);
    setMoveTarget(firstTarget);
  }

  async function confirmMove(){
    if(!movingStudent||!selected||!moveTarget)return;
    setMoving(true);
    const {data,error}=await supabase.rpc("teacher_move_student_classroom_v1",{
      p_from_classroom_id:selected,
      p_to_classroom_id:moveTarget,
      p_student_id:movingStudent.student_id
    });
    setMoving(false);

    if(error){toast("ย้ายนักเรียนไม่สำเร็จ",errText(error),"error");return;}
    toast("ย้ายนักเรียนแล้ว",String(data||movingStudent.full_name),"success");
    setMovingStudent(null);
    setMoveTarget("");
    await loadStudents(selected);
  }

  return <>
    <header className="page-header"><div><h1>ห้องเรียน</h1><p>สร้างห้อง เพิ่ม ย้าย หรือนำนักเรียนออกจากห้องได้</p></div><Link className="btn primary" to="/teacher/import-students"><FileSpreadsheet size={17}/> นำเข้า Excel/CSV</Link></header>
    {message&&<div className={message.includes("แล้ว")?"success":"notice"}>{message}</div>}

    <div className="two-col section">
      <form className="card form" onSubmit={createRoom}><h2>สร้างห้องเรียน</h2><label className="field"><span>ชื่อห้อง</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="เช่น ปวช.2/1" required/></label><button className="btn primary">สร้างห้อง</button></form>
      <div className="card">
        <h2>เลือกห้อง</h2>
        <label className="field"><span>ห้องเรียน</span><select value={selected} onChange={e=>loadStudents(e.target.value)}><option value="">เลือกห้อง</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>

        {selected&&<form className="inline-form" onSubmit={enroll} style={{alignItems:"flex-start"}}>
          <div style={{position:"relative",flex:"1 1 360px",minWidth:0}}>
            <div style={{position:"relative"}}>
              <Search size={17} style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",opacity:.65,pointerEvents:"none"}}/>
              <input
                value={code}
                onChange={e=>{setCode(e.target.value);setChosenStudent(null);setShowSuggestions(true)}}
                onFocus={()=>{if(code.trim())setShowSuggestions(true)}}
                placeholder="ค้นหาชื่อ / ชื่อเล่น / รหัสนักเรียน"
                autoComplete="off"
                style={{width:"100%",paddingLeft:40}}
                required
              />
            </div>

            {showSuggestions&&code.trim()&&<div style={{
              position:"absolute",left:0,right:0,top:"calc(100% + 6px)",zIndex:40,
              border:"1px solid var(--border, #d8dee9)",borderRadius:12,
              background:"var(--card-bg, #fff)",boxShadow:"0 14px 38px rgba(0,0,0,.18)",
              overflow:"hidden",maxHeight:330,overflowY:"auto"
            }}>
              {searching&&<div style={{padding:14}} className="muted">กำลังค้นหา...</div>}

              {!searching&&searchResults.map(s=><button
                key={s.student_id}
                type="button"
                onClick={()=>chooseStudent(s)}
                style={{
                  width:"100%",textAlign:"left",padding:"11px 13px",border:0,
                  borderBottom:"1px solid var(--border, #e5e7eb)",background:"transparent",
                  color:"inherit",cursor:"pointer",display:"flex",justifyContent:"space-between",
                  alignItems:"center",gap:12
                }}
              >
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:700,overflowWrap:"anywhere"}}>{s.full_name}</div>
                  <div className="muted" style={{fontSize:13,marginTop:3,display:"flex",gap:10,flexWrap:"wrap"}}>
                    <span>ชื่อเล่น: <b>{s.nickname||"-"}</b></span>
                    <span>รหัส: <b>{s.student_code||"-"}</b></span>
                  </div>
                </div>
                <div style={{flex:"0 0 auto",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:5,opacity:s.already_in_room ? .7 : 1}}>
                  {s.already_in_room?<><Check size={15}/> อยู่ในห้องแล้ว</>:<><UserPlus size={15}/> เลือก</>}
                </div>
              </button>)}

              {!searching&&searchResults.length===0&&<div style={{padding:14}} className="muted">ไม่พบนักเรียนที่ตรงกับคำค้น</div>}
            </div>}

            {chosenStudent&&<div className="muted" style={{fontSize:12,marginTop:6}}>
              เลือก: <b>{chosenStudent.full_name}</b> · ชื่อเล่น {chosenStudent.nickname||"-"} · รหัส {chosenStudent.student_code||"-"}
            </div>}
          </div>

          <button className="btn primary" disabled={!!chosenStudent?.already_in_room}>
            {chosenStudent?.already_in_room?"อยู่ในห้องแล้ว":"เพิ่มเข้าห้อง"}
          </button>
        </form>}
      </div>
    </div>

    {selected&&<div className="table-card section classroom-roster-card">
      <table>
        <thead><tr><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>ชื่อเล่น</th><th className="room-actions-col">จัดการ</th></tr></thead>
        <tbody>{students.map(s=><tr key={s.student_id}>
          <td>{s.student_code||"-"}</td>
          <td>{s.full_name}</td>
          <td>{s.nickname||"-"}</td>
          <td>
            <div className="room-student-actions">
              <button className="btn ghost small-btn" type="button" onClick={()=>openMove(s)} disabled={rooms.length<2}><ArrowRightLeft size={15}/> ย้ายห้อง</button>
              <button className="btn danger small-btn" type="button" onClick={()=>removeStudent(s)}><Trash2 size={15}/> นำออก</button>
            </div>
          </td>
        </tr>)}</tbody>
      </table>
      {students.length===0&&<div className="empty">ยังไม่มีนักเรียนในห้องนี้</div>}
    </div>}

    {movingStudent&&<div className="modal-backdrop" onMouseDown={()=>!moving&&setMovingStudent(null)}>
      <div className="classroom-move-modal" onMouseDown={e=>e.stopPropagation()}>
        <div className="modal-symbol"><ArrowRightLeft size={22}/></div>
        <h2>ย้ายนักเรียนไปห้องอื่น</h2>
        <p><b>{movingStudent.full_name}</b>{movingStudent.nickname?` (${movingStudent.nickname})`:""}</p>
        <label className="field"><span>ห้องปลายทาง</span><select value={moveTarget} onChange={e=>setMoveTarget(e.target.value)}>{rooms.filter(r=>r.id!==selected).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        {rooms.length<2&&<div className="notice">ต้องสร้างห้องอื่นก่อนจึงจะย้ายนักเรียนได้</div>}
        <div className="modal-actions">
          <button className="btn ghost" type="button" onClick={()=>setMovingStudent(null)} disabled={moving}>ยกเลิก</button>
          <button className="btn primary" type="button" onClick={confirmMove} disabled={!moveTarget||moving}>{moving?"กำลังย้าย...":"ย้ายห้อง"}</button>
        </div>
      </div>
    </div>}
  </>;
}

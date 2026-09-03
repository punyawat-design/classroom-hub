import { useEffect,useMemo,useState } from "react";
import { BookOpen, Users, ClipboardList } from "lucide-react";
import StatusBadge from "../../components/StatusBadge";
import { supabase } from "../../lib/supabase";
import { Status } from "../../lib/status";
import { errText, thaiDate } from "../../lib/utils";

type AssignmentRow={
  id:string;
  title:string;
  course_id:string;
  classroom_id?:string|null;
  due_at?:string|null;
};

type CourseRow={id:string;name:string};
type ClassroomRow={id:string;name:string};

export default function TrackingPage(){
  const [courses,setCourses]=useState<CourseRow[]>([]);
  const [classrooms,setClassrooms]=useState<ClassroomRow[]>([]);
  const [assignments,setAssignments]=useState<AssignmentRow[]>([]);

  const [courseId,setCourseId]=useState("");
  const [classroomId,setClassroomId]=useState("");
  const [assignmentId,setAssignmentId]=useState("");

  const [rows,setRows]=useState<any[]>([]);
  const [classroomStudentIds,setClassroomStudentIds]=useState<Set<string>|null>(null);
  const [filter,setFilter]=useState("ALL");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    (async()=>{
      const [{data:c,error:ce},{data:r,error:re},{data:a,error:ae}]=await Promise.all([
        supabase.from("courses").select("id,name").order("name"),
        supabase.from("classrooms").select("id,name").order("name"),
        supabase.from("assignments").select("id,title,course_id,classroom_id,due_at").order("created_at",{ascending:false})
      ]);
      if(ce||re||ae){setError(errText(ce||re||ae));return;}
      setCourses((c||[]) as CourseRow[]);
      setClassrooms((r||[]) as ClassroomRow[]);
      setAssignments((a||[]) as AssignmentRow[]);
    })();
  },[]);

  useEffect(()=>{
    setClassroomStudentIds(null);
    if(!classroomId)return;

    (async()=>{
      const {data,error}=await supabase.rpc("teacher_classroom_students",{p_classroom_id:classroomId});
      if(error){setError(errText(error));return;}
      setClassroomStudentIds(new Set((data||[]).map((x:any)=>String(x.student_id))));
    })();
  },[classroomId]);

  async function loadAssignment(id:string){
    setAssignmentId(id);
    setRows([]);
    setFilter("ALL");
    setError("");
    if(!id)return;

    setLoading(true);
    const {data,error}=await supabase.rpc("teacher_assignment_tracking",{p_assignment_id:id});
    setLoading(false);
    if(error)setError(errText(error));
    else setRows(data||[]);
  }

  function changeCourse(id:string){
    setCourseId(id);
    setClassroomId("");
    setClassroomStudentIds(null);
    setAssignmentId("");
    setRows([]);
    setFilter("ALL");
  }

  function changeClassroom(id:string){
    setClassroomId(id);
    setAssignmentId("");
    setRows([]);
    setFilter("ALL");
  }

  const courseAssignments=useMemo(()=>{
    if(!courseId)return [];
    return assignments.filter(a=>{
      if(a.course_id!==courseId)return false;
      // งานที่สั่งทั้งรายวิชาใช้ได้กับทุกห้อง ส่วนงานเฉพาะห้องจะแสดงเฉพาะห้องนั้น
      if(classroomId)return !a.classroom_id||a.classroom_id===classroomId;
      return true;
    });
  },[assignments,courseId,classroomId]);

  const roomFilteredRows=useMemo(()=>{
    if(!classroomId)return rows;
    if(!classroomStudentIds)return [];
    return rows.filter(x=>classroomStudentIds.has(String(x.student_id)));
  },[rows,classroomId,classroomStudentIds]);

  const shown=useMemo(()=>{
    return filter==="ALL"
      ? roomFilteredRows
      : roomFilteredRows.filter(x=>x.computed_status===filter);
  },[roomFilteredRows,filter]);

  const stats=useMemo(()=>{
    const all=roomFilteredRows.length;
    const submitted=roomFilteredRows.filter(x=>["WAITING_REVIEW","GRADED","REVISION_REQUIRED","LATE"].includes(x.computed_status)).length;
    const graded=roomFilteredRows.filter(x=>x.computed_status==="GRADED").length;
    const missing=roomFilteredRows.filter(x=>["NOT_STARTED","IN_PROGRESS","OVERDUE"].includes(x.computed_status)).length;
    return {all,submitted,graded,missing};
  },[roomFilteredRows]);

  const selectedCourse=courses.find(c=>c.id===courseId);
  const selectedRoom=classrooms.find(r=>r.id===classroomId);
  const selectedAssignment=assignments.find(a=>a.id===assignmentId);

  return <>
    <header className="page-header">
      <div>
        <h1>ติดตามการส่งงาน</h1>
        <p>แยกดูตามรายวิชา ห้องเรียน และงานที่มอบหมาย</p>
      </div>
    </header>

    {error&&<div className="error">{error}</div>}

    <div className="card section">
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:14}}>
        <label className="field">
          <span style={{display:"flex",alignItems:"center",gap:7}}><BookOpen size={16}/> 1. รายวิชา</span>
          <select value={courseId} onChange={e=>changeCourse(e.target.value)}>
            <option value="">เลือกรายวิชา</option>
            {courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        <label className="field">
          <span style={{display:"flex",alignItems:"center",gap:7}}><Users size={16}/> 2. ห้องเรียน</span>
          <select value={classroomId} onChange={e=>changeClassroom(e.target.value)} disabled={!courseId}>
            <option value="">ทุกห้องในรายวิชา</option>
            {classrooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>

        <label className="field">
          <span style={{display:"flex",alignItems:"center",gap:7}}><ClipboardList size={16}/> 3. งาน</span>
          <select value={assignmentId} onChange={e=>loadAssignment(e.target.value)} disabled={!courseId}>
            <option value="">เลือกงาน</option>
            {courseAssignments.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </label>
      </div>

      {courseId&&<div className="muted" style={{fontSize:13,marginTop:10}}>
        กำลังดู: <b>{selectedCourse?.name}</b>{selectedRoom?<> · ห้อง <b>{selectedRoom.name}</b></>:<> · <b>ทุกห้อง</b></>}
        {selectedAssignment?<> · งาน <b>{selectedAssignment.title}</b></>:null}
      </div>}
    </div>

    {!courseId&&<div className="empty section">เลือกรายวิชาก่อน เพื่อดูงานและติดตามนักเรียนของวิชานั้น</div>}

    {courseId&&courseAssignments.length===0&&<div className="empty section">
      {classroomId?"ห้องนี้ยังไม่มีงานในรายวิชานี้":"รายวิชานี้ยังไม่มีงาน"}
    </div>}

    {assignmentId&&<>
      <div className="stats-grid section" style={{gridTemplateColumns:"repeat(4,minmax(0,1fr))"}}>
        <div className="card stat-card"><span>นักเรียนทั้งหมด</span><div className="stat-value">{stats.all}</div></div>
        <div className="card stat-card"><span>ส่งแล้ว</span><div className="stat-value">{stats.submitted}</div></div>
        <div className="card stat-card"><span>ตรวจแล้ว</span><div className="stat-value">{stats.graded}</div></div>
        <div className="card stat-card"><span>ยังไม่ส่ง/กำลังทำ</span><div className="stat-value">{stats.missing}</div></div>
      </div>

      <div className="toolbar section">
        <select value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="ALL">ทุกสถานะ</option>
          <option value="NOT_STARTED">ยังไม่เริ่ม</option>
          <option value="IN_PROGRESS">กำลังทำ</option>
          <option value="WAITING_REVIEW">รอตรวจ</option>
          <option value="GRADED">ตรวจแล้ว</option>
          <option value="REVISION_REQUIRED">ต้องแก้ไข</option>
          <option value="LATE">ส่งล่าช้า</option>
          <option value="OVERDUE">เลยกำหนด</option>
        </select>
      </div>

      <div className="table-card section">
        <table>
          <thead>
            <tr><th>รหัส</th><th>นักเรียน</th><th>สถานะ</th><th>วันที่ส่ง</th><th>คะแนน</th></tr>
          </thead>
          <tbody>
            {shown.map(x=><tr key={x.student_id}>
              <td>{x.student_code||"-"}</td>
              <td>{x.full_name}</td>
              <td><StatusBadge status={x.computed_status as Status}/></td>
              <td>{thaiDate(x.submitted_at)}</td>
              <td>{x.score??"-"}</td>
            </tr>)}
          </tbody>
        </table>
        {loading&&<div className="empty">กำลังโหลดข้อมูล...</div>}
        {!loading&&assignmentId&&shown.length===0&&<div className="empty">ไม่พบข้อมูลในห้องหรือสถานะที่เลือก</div>}
      </div>
    </>}
  </>;
}

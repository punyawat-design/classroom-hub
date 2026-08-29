import { useEffect,useState } from "react";
import { supabase } from "../../lib/supabase";
import { errText, thaiDate } from "../../lib/utils";

export default function AssignmentsPage(){
  const [items,setItems]=useState<any[]>([]);
  const [courses,setCourses]=useState<any[]>([]);
  const [rooms,setRooms]=useState<any[]>([]);
  const [message,setMessage]=useState("");

  async function load(){
    const [{data:a,error},{data:c},{data:r}]=await Promise.all([
      supabase.from("assignments").select("id,title,due_at,max_score,courses(name),classrooms(name)").order("due_at"),
      supabase.from("courses").select("id,name").order("name"),
      supabase.from("classrooms").select("id,name").order("name")
    ]);
    if(error)setMessage(errText(error)); else setItems(a||[]);
    setCourses(c||[]);setRooms(r||[]);
  }
  useEffect(()=>{load()},[]);

  async function create(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setMessage("");
    const fd=new FormData(e.currentTarget);
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return;
    const {error}=await supabase.from("assignments").insert({
      title:String(fd.get("title")),
      description:String(fd.get("description")||""),
      instructions:String(fd.get("instructions")||""),
      course_id:String(fd.get("course_id")),
      classroom_id:String(fd.get("classroom_id")),
      teacher_id:user.id,
      open_at:new Date(String(fd.get("open_at"))).toISOString(),
      due_at:new Date(String(fd.get("due_at"))).toISOString(),
      max_score:Number(fd.get("max_score")||10),
      allow_late_submission:fd.get("allow_late_submission")==="on",
      allow_resubmission:fd.get("allow_resubmission")==="on"
    });
    if(error)setMessage(errText(error)); else {setMessage("สร้างงานแล้ว");e.currentTarget.reset();load();}
  }

  return <>
    <header className="page-header"><div><h1>งาน / Assignment</h1><p>สร้างงาน กำหนดคะแนนและวันส่ง</p></div></header>
    {message&&<div className={message.includes("แล้ว")?"success":"notice"}>{message}</div>}
    <details className="card section" open>
      <summary><b>+ สร้างงานใหม่</b></summary>
      <form className="form top-gap" onSubmit={create}>
        <label className="field"><span>ชื่องาน</span><input name="title" required/></label>
        <div className="two-col">
          <label className="field"><span>รายวิชา</span><select name="course_id" required><option value="">เลือก</option>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="field"><span>ห้องเรียน</span><select name="classroom_id" required><option value="">เลือก</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        </div>
        <label className="field"><span>คำอธิบาย</span><textarea name="description" rows={2}/></label>
        <label className="field"><span>คำสั่ง</span><textarea name="instructions" rows={4}/></label>
        <div className="two-col">
          <label className="field"><span>เปิดงาน</span><input type="datetime-local" name="open_at" required/></label>
          <label className="field"><span>กำหนดส่ง</span><input type="datetime-local" name="due_at" required/></label>
        </div>
        <label className="field"><span>คะแนนเต็ม</span><input type="number" name="max_score" defaultValue={10} min={0}/></label>
        <label className="check"><input type="checkbox" name="allow_late_submission" defaultChecked/> อนุญาตส่งล่าช้า</label>
        <label className="check"><input type="checkbox" name="allow_resubmission" defaultChecked/> อนุญาตส่งใหม่</label>
        <button className="btn primary">บันทึกงาน</button>
      </form>
    </details>
    <div className="table-card section"><table>
      <thead><tr><th>งาน</th><th>รายวิชา</th><th>ห้อง</th><th>กำหนดส่ง</th><th>คะแนน</th></tr></thead>
      <tbody>{items.map(x=><tr key={x.id}><td><b>{x.title}</b></td><td>{x.courses?.name}</td><td>{x.classrooms?.name}</td><td>{thaiDate(x.due_at)}</td><td>{x.max_score}</td></tr>)}</tbody>
    </table></div>
  </>;
}

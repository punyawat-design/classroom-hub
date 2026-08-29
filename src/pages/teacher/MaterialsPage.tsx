import { useEffect,useState } from "react";
import { supabase } from "../../lib/supabase";
import { errText, safeFileName } from "../../lib/utils";

export default function MaterialsPage(){
  const [courses,setCourses]=useState<any[]>([]);
  const [items,setItems]=useState<any[]>([]);
  const [message,setMessage]=useState("");

  async function load(){
    const [{data:c},{data:m,error}]=await Promise.all([
      supabase.from("courses").select("id,name").order("name"),
      supabase.from("learning_materials").select("id,title,description,link_url,file_name,storage_path,created_at,courses(name)").order("created_at",{ascending:false})
    ]);
    setCourses(c||[]);
    if(error)setMessage(errText(error)); else setItems(m||[]);
  }
  useEffect(()=>{load()},[]);

  async function create(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setMessage("");
    const fd=new FormData(e.currentTarget);
    const courseId=String(fd.get("course_id"));
    const file=fd.get("file") as File;
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return;

    let storage_path:string|null=null;
    let file_name:string|null=null;
    if(file && file.size>0){
      file_name=file.name;
      storage_path=`${user.id}/${courseId}/${Date.now()}-${safeFileName(file.name)}`;
      const {error}=await supabase.storage.from("materials").upload(storage_path,file);
      if(error){setMessage(errText(error));return;}
    }

    const {error}=await supabase.from("learning_materials").insert({
      teacher_id:user.id,
      course_id:courseId,
      title:String(fd.get("title")),
      description:String(fd.get("description")||""),
      link_url:String(fd.get("link_url")||"")||null,
      file_name,
      storage_path
    });
    if(error)setMessage(errText(error)); else {setMessage("เพิ่มสื่อการสอนแล้ว");e.currentTarget.reset();load();}
  }

  return <>
    <header className="page-header"><div><h1>สื่อการสอน</h1><p>โพสต์เอกสาร ลิงก์ และไฟล์สำหรับนักเรียน</p></div></header>
    {message&&<div className={message.includes("แล้ว")?"success":"notice"}>{message}</div>}
    <form className="card form section" onSubmit={create}>
      <label className="field"><span>รายวิชา</span><select name="course_id" required><option value="">เลือก</option>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="field"><span>ชื่อสื่อ</span><input name="title" required/></label>
      <label className="field"><span>รายละเอียด</span><textarea name="description" rows={3}/></label>
      <label className="field"><span>ลิงก์</span><input name="link_url" type="url" placeholder="https://..."/></label>
      <label className="field"><span>ไฟล์</span><input name="file" type="file"/></label>
      <button className="btn primary">เพิ่มสื่อ</button>
    </form>
    <div className="cards-list section">{items.map(x=><div className="card row-card" key={x.id}><div><b>{x.title}</b><div className="muted small">{x.courses?.name}</div><div>{x.description}</div></div></div>)}</div>
  </>;
}

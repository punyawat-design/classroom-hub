import { useEffect,useState } from "react";
import { supabase } from "../../lib/supabase";
import { errText, safeFileName } from "../../lib/utils";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";

export default function MaterialsPage(){
  const [courses,setCourses]=useState<any[]>([]);
  const [items,setItems]=useState<any[]>([]);
  const {toast}=useToast();
  const {confirm}=useConfirm();

  async function load(){
    const [{data:c},{data:m,error}]=await Promise.all([
      supabase.from("courses").select("id,name").order("name"),
      supabase.from("learning_materials").select("id,title,description,link_url,file_name,storage_path,created_at,courses(name)").order("created_at",{ascending:false})
    ]);
    setCourses(c||[]);
    if(error)toast("โหลดสื่อไม่สำเร็จ",errText(error),"error"); else setItems(m||[]);
  }
  useEffect(()=>{load()},[]);

  async function create(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    const fd=new FormData(e.currentTarget);
    const courseId=String(fd.get("course_id"));
    const file=fd.get("file") as File;
    const link=String(fd.get("link_url")||"").trim();

    const ok=await confirm({title:"เพิ่มสื่อการสอน?",message:"สื่อนี้จะปรากฏให้นักเรียนในรายวิชาที่เลือกเห็นทันที",confirmText:"เพิ่มสื่อ"});
    if(!ok)return;

    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return;

    let storage_path:string|null=null;
    let file_name:string|null=null;
    if(file && file.size>0){
      file_name=file.name;
      storage_path=`${user.id}/${courseId}/${Date.now()}-${safeFileName(file.name)}`;
      const {error}=await supabase.storage.from("materials").upload(storage_path,file);
      if(error){toast("อัปโหลดไฟล์ไม่สำเร็จ",errText(error),"error");return;}
    }

    const {error}=await supabase.from("learning_materials").insert({
      teacher_id:user.id,course_id:courseId,
      title:String(fd.get("title")),description:String(fd.get("description")||""),
      link_url:link||null,file_name,storage_path
    });
    if(error)toast("เพิ่มสื่อไม่สำเร็จ",errText(error),"error");
    else {toast("เพิ่มสื่อการสอนแล้ว",file_name?"นักเรียนสามารถดู/ดาวน์โหลดไฟล์ได้":"บันทึกลิงก์เรียบร้อย","success");e.currentTarget.reset();load();}
  }

  return <>
    <header className="page-header"><div><h1>สื่อการสอน</h1><p>อัปโหลด PDF/ZIP หรือวางลิงก์ Google Drive</p></div></header>
    <form className="card form section" onSubmit={create}>
      <label className="field"><span>รายวิชา</span><select name="course_id" required><option value="">เลือก</option>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="field"><span>ชื่อสื่อ</span><input name="title" required/></label>
      <label className="field"><span>รายละเอียด</span><textarea name="description" rows={3}/></label>
      <label className="field"><span>Google Drive / ลิงก์ภายนอก</span><input name="link_url" type="url" placeholder="วางลิงก์ Share จาก Google Drive หรือ https://..."/></label>
      <label className="field"><span>อัปโหลดไฟล์จากเครื่อง</span><input name="file" type="file" accept=".pdf,.zip,.rar,.7z,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*,text/plain"/></label>
      <div className="hint">PDF จะเปิดดูในเว็บได้ • ZIP และไฟล์อื่นดาวน์โหลดได้ • Google Drive ใช้วิธีวางลิงก์ Share</div>
      <button className="btn primary">เพิ่มสื่อ</button>
    </form>
    <div className="cards-list section">{items.map(x=><div className="card row-card" key={x.id}><div><b>{x.title}</b><div className="muted small">{x.courses?.name}</div><div>{x.description}</div><div className="small top-gap">{x.file_name&&`📎 ${x.file_name}`}{x.link_url&&` 🔗 มีลิงก์`}</div></div></div>)}</div>
  </>;
}

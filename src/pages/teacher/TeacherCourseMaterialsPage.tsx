import { useEffect,useState } from "react";
import { Link,useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { errText,safeFileName } from "../../lib/utils";
import MaterialViewer,{MaterialItem} from "../../components/MaterialViewer";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { FILE_ACCEPT, validateMaterialFile } from "../../lib/fileRules";

export default function TeacherCourseMaterialsPage(){
  const {courseId=""}=useParams();
  const [course,setCourse]=useState<any|null>(null);
  const [items,setItems]=useState<any[]>([]);
  const [editing,setEditing]=useState<any|null>(null);
  const [selected,setSelected]=useState<MaterialItem|null>(null);
  const [busy,setBusy]=useState(false);
  const {toast}=useToast();
  const {confirm}=useConfirm();

  async function load(){
    const [{data:c,error:ce},{data:m,error:me}]=await Promise.all([
      supabase.from("courses").select("id,name").eq("id",courseId).single(),
      supabase.from("learning_materials")
        .select("id,teacher_id,course_id,title,description,link_url,file_name,storage_path,created_at,courses(name)")
        .eq("course_id",courseId)
        .order("created_at",{ascending:false})
    ]);

    if(ce||me){
      toast("โหลดสื่อไม่สำเร็จ",errText(ce||me),"error");
      return;
    }

    setCourse(c);
    setItems(m||[]);
  }

  useEffect(()=>{load()},[courseId]);

  async function uploadFile(file:File,userId:string){
    const fileError=validateMaterialFile(file);
    if(fileError)throw new Error(fileError);
    const path=`${userId}/${courseId}/${Date.now()}-${safeFileName(file.name)}`;
    const {data,error}=await supabase.storage
      .from("materials")
      .upload(path,file,{
        cacheControl:"3600",
        upsert:false,
        contentType:file.type||undefined
      });

    if(error)throw error;
    return data.path;
  }

  async function create(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(busy)return;

    const fd=new FormData(e.currentTarget);
    const file=fd.get("file") as File;
    const link=String(fd.get("link_url")||"").trim();

    if((!file||file.size===0)&&!link){
      toast("ยังไม่ได้เลือกสื่อ","กรุณาอัปโหลดไฟล์ หรือใส่ลิงก์ Google Drive/เว็บไซต์","error");
      return;
    }

    const ok=await confirm({
      title:"เพิ่มสื่อการสอน?",
      message:`สื่อนี้จะถูกเพิ่มในวิชา ${course?.name||""}`,
      confirmText:"เพิ่มสื่อ"
    });
    if(!ok)return;

    setBusy(true);
    let uploadedPath:string|null=null;

    try{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user)throw new Error("กรุณาเข้าสู่ระบบใหม่");

      let fileName:string|null=null;
      if(file&&file.size>0){
        fileName=file.name;
        uploadedPath=await uploadFile(file,user.id);
      }

      const {error}=await supabase.from("learning_materials").insert({
        teacher_id:user.id,
        course_id:courseId,
        title:String(fd.get("title")),
        description:String(fd.get("description")||""),
        link_url:link||null,
        file_name:fileName,
        storage_path:uploadedPath
      });

      if(error)throw error;

      toast("เพิ่มสื่อการสอนแล้ว","ไฟล์ถูกเก็บในรายวิชานี้เรียบร้อย","success");
      e.currentTarget.reset();
      await load();
    }catch(error){
      // If DB insert fails, do not leave an orphan object.
      if(uploadedPath){
        await supabase.storage.from("materials").remove([uploadedPath]);
      }
      toast("เพิ่มสื่อไม่สำเร็จ",errText(error),"error");
    }finally{
      setBusy(false);
    }
  }

  async function saveEdit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!editing||busy)return;

    const fd=new FormData(e.currentTarget);
    const replacement=fd.get("file") as File;
    const link=String(fd.get("link_url")||"").trim();

    const ok=await confirm({
      title:"บันทึกการแก้ไขสื่อ?",
      message:replacement&&replacement.size>0
        ?"ไฟล์ใหม่จะถูกใช้แทนไฟล์เดิม"
        :"แก้ไขชื่อ รายละเอียด หรือลิงก์ของสื่อนี้",
      confirmText:"บันทึก"
    });
    if(!ok)return;

    setBusy(true);
    let newPath:string|null=null;

    try{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user)throw new Error("กรุณาเข้าสู่ระบบใหม่");

      let fileName=editing.file_name||null;
      let storagePath=editing.storage_path||null;

      if(replacement&&replacement.size>0){
        fileName=replacement.name;
        newPath=await uploadFile(replacement,user.id);
        storagePath=newPath;
      }

      if(!storagePath&&!link){
        throw new Error("สื่อต้องมีไฟล์หรือลิงก์อย่างน้อย 1 อย่าง");
      }

      const {error}=await supabase.from("learning_materials").update({
        title:String(fd.get("title")),
        description:String(fd.get("description")||""),
        link_url:link||null,
        file_name:fileName,
        storage_path:storagePath
      }).eq("id",editing.id);

      if(error)throw error;

      // Delete old object only AFTER the new DB row is safely saved.
      if(newPath&&editing.storage_path&&editing.storage_path!==newPath){
        const {error:deleteOldError}=await supabase.storage.from("materials").remove([editing.storage_path]);
        if(deleteOldError){
          toast("แก้ไขสื่อแล้ว","แต่ไฟล์เก่าใน Storage ลบไม่สำเร็จ สามารถใช้งานไฟล์ใหม่ได้ตามปกติ","info");
        }
      }

      toast("แก้ไขสื่อแล้ว","","success");
      setEditing(null);
      await load();
    }catch(error){
      if(newPath){
        await supabase.storage.from("materials").remove([newPath]);
      }
      toast("แก้ไขสื่อไม่สำเร็จ",errText(error),"error");
    }finally{
      setBusy(false);
    }
  }

  async function removeItem(item:any){
    const ok=await confirm({
      title:"ลบสื่อนี้?",
      message:`“${item.title}” จะถูกลบออกจากรายวิชา`,
      confirmText:"ลบสื่อ",
      danger:true
    });
    if(!ok)return;

    setBusy(true);
    try{
      if(item.storage_path){
        const {error:storageError}=await supabase.storage.from("materials").remove([item.storage_path]);
        // If the old object is already missing, still allow deletion of stale metadata.
        if(storageError && !String(storageError.message||"").toLowerCase().includes("not found")){
          throw storageError;
        }
      }

      const {error}=await supabase.from("learning_materials").delete().eq("id",item.id);
      if(error)throw error;

      toast("ลบสื่อแล้ว","","success");
      await load();
    }catch(error){
      toast("ลบสื่อไม่สำเร็จ",errText(error),"error");
    }finally{
      setBusy(false);
    }
  }

  return <>
    <Link className="back-link" to="/teacher/materials">← กลับไปเลือกรายวิชา</Link>

    <header className="page-header">
      <div>
        <h1>{course?.name||"รายวิชา"}</h1>
        <p>สื่อการสอนของวิชานี้เท่านั้น</p>
      </div>
    </header>

    <details className="card section">
      <summary><b>+ เพิ่มสื่อในวิชานี้</b></summary>

      <form className="form top-gap" onSubmit={create}>
        <label className="field">
          <span>ชื่อสื่อ</span>
          <input name="title" required/>
        </label>

        <label className="field">
          <span>รายละเอียด</span>
          <textarea name="description" rows={3}/>
        </label>

        <label className="field">
          <span>Google Drive / ลิงก์ภายนอก</span>
          <input name="link_url" type="url" placeholder="https://..."/>
        </label>

        <label className="field">
          <span>อัปโหลดไฟล์จากเครื่อง</span>
          <input name="file" type="file" accept={FILE_ACCEPT}/>
        </label>

        <div className="hint">
          PDF และรูปภาพเปิดดูในเว็บได้ • ZIP/Office ดาวน์โหลดได้ • ไฟล์อัปโหลดไม่เกิน 50 MB • ใช้ Google Drive Share Link ได้
        </div>

        <button className="btn primary" disabled={busy}>
          {busy?"กำลังอัปโหลด...":"เพิ่มสื่อ"}
        </button>
      </form>
    </details>

    <div className="cards-list section">
      {items.map(item=><article className="card material-manage-card" key={item.id}>
        <div>
          <h3>{item.title}</h3>
          {item.description&&<p>{item.description}</p>}
          <div className="muted small">
            {item.file_name&&<>📎 {item.file_name}</>}
            {item.file_name&&item.link_url&&<> • </>}
            {item.link_url&&<>🔗 มีลิงก์</>}
          </div>
        </div>

        <div className="actions">
          <button className="btn primary" onClick={()=>setSelected(item)}>ดู</button>
          <button className="btn ghost" onClick={()=>setEditing(item)}>แก้ไข</button>
          <button className="btn danger" onClick={()=>removeItem(item)} disabled={busy}>ลบ</button>
        </div>
      </article>)}

      {items.length===0&&<div className="empty card">วิชานี้ยังไม่มีสื่อการสอน</div>}
    </div>

    {editing&&<div className="modal-backdrop" onMouseDown={()=>setEditing(null)}>
      <div className="edit-modal" onMouseDown={e=>e.stopPropagation()}>
        <div className="viewer-head">
          <div>
            <h2>แก้ไขสื่อ</h2>
            <div className="muted">{editing.title}</div>
          </div>
          <button onClick={()=>setEditing(null)}>×</button>
        </div>

        <form className="form top-gap" onSubmit={saveEdit}>
          <label className="field">
            <span>ชื่อสื่อ</span>
            <input name="title" defaultValue={editing.title} required/>
          </label>

          <label className="field">
            <span>รายละเอียด</span>
            <textarea name="description" rows={3} defaultValue={editing.description||""}/>
          </label>

          <label className="field">
            <span>Google Drive / ลิงก์ภายนอก</span>
            <input name="link_url" type="url" defaultValue={editing.link_url||""}/>
          </label>

          <label className="field">
            <span>เปลี่ยนไฟล์ (ไม่เลือก = ใช้ไฟล์เดิม)</span>
            <input name="file" type="file" accept={FILE_ACCEPT}/>
          </label>

          {editing.file_name&&<div className="notice">ไฟล์ปัจจุบัน: {editing.file_name}</div>}

          <div className="actions">
            <button type="button" className="btn ghost" onClick={()=>setEditing(null)}>ยกเลิก</button>
            <button className="btn primary" disabled={busy}>
              {busy?"กำลังบันทึก...":"บันทึกการแก้ไข"}
            </button>
          </div>
        </form>
      </div>
    </div>}

    {selected&&<MaterialViewer item={selected} onClose={()=>setSelected(null)}/>}
  </>;
}

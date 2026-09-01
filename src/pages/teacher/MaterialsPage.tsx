import { useEffect,useMemo,useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { errText } from "../../lib/utils";
import { useToast } from "../../context/ToastContext";

export default function MaterialsPage(){
  const [courses,setCourses]=useState<any[]>([]);
  const [materials,setMaterials]=useState<any[]>([]);
  const {toast}=useToast();

  useEffect(()=>{(async()=>{
    const [{data:c,error:ce},{data:m,error:me}]=await Promise.all([
      supabase.from("courses").select("id,name,archived_at").is("archived_at",null).order("name"),
      supabase.from("learning_materials").select("id,course_id")
    ]);

    if(ce||me){
      toast("โหลดข้อมูลไม่สำเร็จ",errText(ce||me),"error");
      return;
    }

    setCourses(c||[]);
    setMaterials(m||[]);
  })()},[]);

  const count=useMemo(()=>{
    const map=new Map<string,number>();
    courses.forEach(c=>map.set(c.id,0));
    materials.forEach((m:any)=>map.set(m.course_id,(map.get(m.course_id)||0)+1));
    return map;
  },[courses,materials]);

  return <>
    <header className="page-header">
      <div>
        <h1>สื่อการสอน</h1>
        <p>เลือกวิชาก่อน แล้วค่อยเพิ่ม แก้ไข หรือลบสื่อของวิชานั้น</p>
      </div>
    </header>

    <div className="course-grid section">
      {courses.map(c=><Link key={c.id} className="card course-work-card" to={`/teacher/materials/course/${c.id}`}>
        <div className="course-icon">📁</div>
        <div>
          <h3>{c.name}</h3>
          <div className="muted small">จัดการสื่อเฉพาะรายวิชานี้</div>
        </div>
        <div className="course-count">
          <b>{count.get(c.id)||0}</b>
          <span>สื่อการสอน</span>
        </div>
      </Link>)}

      {courses.length===0&&<div className="empty card">ยังไม่มีรายวิชา กรุณาสร้างรายวิชาก่อน</div>}
    </div>
  </>;
}

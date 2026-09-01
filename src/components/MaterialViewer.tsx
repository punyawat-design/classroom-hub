import { useEffect,useMemo,useState } from "react";
import { Download, ExternalLink, FileArchive, FileText, Image as ImageIcon, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { driveDownloadUrl, drivePreviewUrl, isGoogleDriveUrl, looksLikePdf, looksLikeZip } from "../lib/drive";
import { errText } from "../lib/utils";
import { useToast } from "../context/ToastContext";

export type MaterialItem = {
  id:string;
  title:string;
  description?:string|null;
  link_url?:string|null;
  file_name?:string|null;
  storage_path?:string|null;
  course_id?:string|null;
  teacher_id?:string|null;
  courses?:{name?:string}|null;
};

function looksLikeImage(fileName?:string|null){
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(fileName||"");
}

export default function MaterialViewer({item,onClose}:{item:MaterialItem;onClose:()=>void}){
  const [signed,setSigned]=useState("");
  const [loading,setLoading]=useState(false);
  const [fileError,setFileError]=useState("");
  const {toast}=useToast();

  useEffect(()=>{(async()=>{
    setSigned("");
    setFileError("");
    if(!item.storage_path)return;

    setLoading(true);
    const {data,error}=await supabase.storage
      .from("materials")
      .createSignedUrl(item.storage_path,600);

    setLoading(false);

    if(error){
      const msg=errText(error);
      setFileError(msg);
      return;
    }
    setSigned(data.signedUrl);
  })()},[item.id,item.storage_path]);

  const drive = isGoogleDriveUrl(item.link_url);
  const pdf = looksLikePdf(item.file_name,item.link_url);
  const image = looksLikeImage(item.file_name);

  const drivePreview = drive&&item.link_url ? drivePreviewUrl(item.link_url) : "";
  const previewUrl = drivePreview || signed;

  async function downloadStorage(){
    if(!item.storage_path)return;

    const {data,error}=await supabase.storage
      .from("materials")
      .createSignedUrl(item.storage_path,120,{
        download:item.file_name||true
      });

    if(error){
      toast("ดาวน์โหลดไม่ได้",errText(error),"error");
      return;
    }

    window.open(data.signedUrl,"_blank","noopener,noreferrer");
  }

  const nonPreviewFile = useMemo(()=>{
    return item.file_name && !pdf && !image;
  },[item.file_name,pdf,image]);

  return <div className="modal-backdrop viewer-backdrop" onMouseDown={onClose}>
    <div className="material-viewer" onMouseDown={e=>e.stopPropagation()}>
      <div className="viewer-head">
        <div>
          <h2>{item.title}</h2>
          <div className="muted">{item.courses?.name||""}</div>
        </div>
        <button onClick={onClose}><X size={21}/></button>
      </div>

      {item.description&&<p>{item.description}</p>}
      {loading&&<div className="viewer-loading">กำลังเตรียมไฟล์...</div>}

      {fileError&&<div className="material-file-error">
        <FileText size={42}/>
        <b>เปิดไฟล์นี้ไม่ได้</b>
        <span>ระบบหาไฟล์ใน Storage ไม่พบ หรือสิทธิ์ไฟล์เก่ายังไม่ถูกต้อง</span>
        <small>{fileError}</small>
      </div>}

      {!fileError&&pdf&&previewUrl&&
        <iframe className="pdf-frame" src={previewUrl} title={item.title}/>
      }

      {!fileError&&image&&signed&&
        <div className="image-preview-wrap">
          <img className="material-image-preview" src={signed} alt={item.title}/>
        </div>
      }

      {!fileError&&nonPreviewFile&&<div className="file-preview-placeholder">
        {looksLikeZip(item.file_name)?<FileArchive size={58}/>:<FileText size={58}/>}
        <b>{item.file_name}</b>
        <span>ไฟล์ชนิดนี้สามารถดาวน์โหลดไปเปิดด้วยโปรแกรมที่รองรับ</span>
      </div>}

      {!fileError&&!item.storage_path&&item.link_url&&!drive&&
        <div className="file-preview-placeholder">
          <ExternalLink size={58}/>
          <b>สื่อแบบลิงก์ภายนอก</b>
          <span>กด “เปิดลิงก์” ด้านล่าง</span>
        </div>
      }

      {!fileError&&!item.storage_path&&!item.link_url&&
        <div className="file-preview-placeholder">
          <ImageIcon size={58}/>
          <b>รายการนี้ยังไม่มีไฟล์หรือลิงก์</b>
        </div>
      }

      <div className="viewer-actions">
        {item.storage_path&&!fileError&&
          <button className="btn primary" onClick={downloadStorage}>
            <Download size={17}/> ดาวน์โหลดไฟล์
          </button>
        }

        {item.link_url&&
          <a className="btn ghost" target="_blank" rel="noreferrer" href={item.link_url}>
            <ExternalLink size={17}/> เปิดลิงก์
          </a>
        }

        {drive&&item.link_url&&
          <a className="btn ghost" target="_blank" rel="noreferrer" href={driveDownloadUrl(item.link_url)}>
            <Download size={17}/> ดาวน์โหลดจาก Drive
          </a>
        }
      </div>
    </div>
  </div>
}

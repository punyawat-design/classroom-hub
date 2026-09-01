import { useEffect,useState } from "react";
import { Download, ExternalLink, FileArchive, FileText, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { driveDownloadUrl, drivePreviewUrl, isGoogleDriveUrl, looksLikePdf, looksLikeZip } from "../lib/drive";
import { errText } from "../lib/utils";
import { useToast } from "../context/ToastContext";

export type MaterialItem = {
  id:string; title:string; description?:string|null; link_url?:string|null;
  file_name?:string|null; storage_path?:string|null; courses?:{name?:string}|null;
};

export default function MaterialViewer({item,onClose}:{item:MaterialItem;onClose:()=>void}){
  const [signed,setSigned]=useState("");
  const [loading,setLoading]=useState(false);
  const {toast}=useToast();

  useEffect(()=>{(async()=>{
    if(!item.storage_path)return;
    setLoading(true);
    const {data,error}=await supabase.storage.from("materials").createSignedUrl(item.storage_path,600);
    setLoading(false);
    if(error) toast("เปิดไฟล์ไม่ได้",errText(error),"error");
    else setSigned(data.signedUrl);
  })()},[item.storage_path]);

  const drive = isGoogleDriveUrl(item.link_url);
  const pdf = looksLikePdf(item.file_name,item.link_url);
  const previewUrl = drive&&item.link_url ? drivePreviewUrl(item.link_url) : (pdf?signed:"");

  async function downloadStorage(){
    if(!item.storage_path)return;
    const {data,error}=await supabase.storage.from("materials").download(item.storage_path);
    if(error){toast("ดาวน์โหลดไม่ได้",errText(error),"error");return;}
    const url=URL.createObjectURL(data);
    const a=document.createElement("a");
    a.href=url;a.download=item.file_name||"material";a.click();
    URL.revokeObjectURL(url);
  }

  return <div className="modal-backdrop viewer-backdrop" onMouseDown={onClose}>
    <div className="material-viewer" onMouseDown={e=>e.stopPropagation()}>
      <div className="viewer-head">
        <div><h2>{item.title}</h2><div className="muted">{item.courses?.name||""}</div></div>
        <button onClick={onClose}><X size={21}/></button>
      </div>
      {item.description&&<p>{item.description}</p>}
      {loading&&<div className="viewer-loading">กำลังเตรียมไฟล์...</div>}
      {previewUrl&&<iframe className="pdf-frame" src={previewUrl} title={item.title}/>}
      {!previewUrl&&item.file_name&&<div className="file-preview-placeholder">
        {looksLikeZip(item.file_name)?<FileArchive size={58}/>:<FileText size={58}/>}
        <b>{item.file_name}</b>
        <span>ไฟล์ชนิดนี้ให้ดาวน์โหลดเพื่อเปิดด้วยโปรแกรมที่รองรับ</span>
      </div>}
      <div className="viewer-actions">
        {item.storage_path&&<button className="btn primary" onClick={downloadStorage}><Download size={17}/> ดาวน์โหลดไฟล์</button>}
        {item.link_url&&<a className="btn ghost" target="_blank" rel="noreferrer" href={item.link_url}><ExternalLink size={17}/> เปิดลิงก์</a>}
        {drive&&item.link_url&&<a className="btn ghost" target="_blank" rel="noreferrer" href={driveDownloadUrl(item.link_url)}><Download size={17}/> ดาวน์โหลดจาก Drive</a>}
      </div>
    </div>
  </div>
}

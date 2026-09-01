import { useEffect,useMemo,useRef,useState } from "react";
import {
  Download,
  ExternalLink,
  FileArchive,
  FileText,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  X
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  driveDownloadUrl,
  drivePreviewUrl,
  isGoogleDriveUrl,
  looksLikePdf,
  looksLikeZip
} from "../lib/drive";
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

export default function MaterialViewer({
  item,
  onClose
}:{
  item:MaterialItem;
  onClose:()=>void;
}){
  const viewerRef=useRef<HTMLDivElement|null>(null);

  const [signed,setSigned]=useState("");
  const [loading,setLoading]=useState(false);
  const [fileError,setFileError]=useState("");
  const [isFullscreen,setIsFullscreen]=useState(false);

  // ขนาดเริ่มต้นของหน้าต่าง
  const [viewerSize,setViewerSize]=useState<"medium"|"large"|"xlarge">("large");

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
      setFileError(errText(error));
      return;
    }

    setSigned(data.signedUrl);
  })()},[item.id,item.storage_path]);

  useEffect(()=>{
    function fullscreenChanged(){
      setIsFullscreen(document.fullscreenElement===viewerRef.current);
    }

    document.addEventListener("fullscreenchange",fullscreenChanged);
    return ()=>document.removeEventListener("fullscreenchange",fullscreenChanged);
  },[]);

  const drive=isGoogleDriveUrl(item.link_url);
  const pdf=looksLikePdf(item.file_name,item.link_url);
  const image=looksLikeImage(item.file_name);

  const drivePreview=drive&&item.link_url
    ? drivePreviewUrl(item.link_url)
    : "";

  const previewUrl=drivePreview||signed;

  const nonPreviewFile=useMemo(()=>{
    return item.file_name&&!pdf&&!image;
  },[item.file_name,pdf,image]);

  const normalSize=useMemo(()=>{
    if(viewerSize==="medium"){
      return {
        width:"min(900px,88vw)",
        height:"72vh"
      };
    }

    if(viewerSize==="xlarge"){
      return {
        width:"min(1450px,96vw)",
        height:"90vh"
      };
    }

    return {
      width:"min(1150px,93vw)",
      height:"82vh"
    };
  },[viewerSize]);

  async function toggleFullscreen(){
    try{
      if(!viewerRef.current)return;

      if(document.fullscreenElement){
        await document.exitFullscreen();
      }else{
        await viewerRef.current.requestFullscreen();
      }
    }catch(error){
      toast("เปิดโหมดเต็มจอไม่ได้",errText(error),"error");
    }
  }

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

  const viewerStyle:React.CSSProperties=isFullscreen
    ? {
        width:"100vw",
        height:"100vh",
        maxWidth:"none",
        maxHeight:"none",
        borderRadius:0,
        padding:18,
        background:"var(--card-bg, #ffffff)",
        color:"inherit",
        display:"flex",
        flexDirection:"column",
        overflow:"hidden"
      }
    : {
        ...normalSize,
        minWidth:"min(560px,92vw)",
        minHeight:"480px",
        maxWidth:"96vw",
        maxHeight:"92vh",
        resize:"both",
        overflow:"auto",
        background:"var(--card-bg, #ffffff)",
        color:"inherit",
        borderRadius:18,
        padding:18,
        boxShadow:"0 30px 90px rgba(0,0,0,.28)",
        display:"flex",
        flexDirection:"column"
      };

  const previewAreaStyle:React.CSSProperties={
    flex:"1 1 auto",
    minHeight:0,
    marginTop:10,
    display:"flex",
    flexDirection:"column"
  };

  const iframeStyle:React.CSSProperties={
    width:"100%",
    flex:"1 1 auto",
    minHeight:isFullscreen?"calc(100vh - 190px)":"420px",
    border:"1px solid #dbe0e8",
    borderRadius:12,
    background:"#f8fafc"
  };

  return <div
    className="modal-backdrop viewer-backdrop"
    onMouseDown={onClose}
  >
    <div
      ref={viewerRef}
      className="material-viewer"
      style={viewerStyle}
      onMouseDown={e=>e.stopPropagation()}
    >
      <div
        className="viewer-head"
        style={{
          display:"flex",
          justifyContent:"space-between",
          alignItems:"flex-start",
          gap:12,
          flex:"0 0 auto"
        }}
      >
        <div style={{minWidth:0}}>
          <h2 style={{margin:"0 0 4px",overflowWrap:"anywhere"}}>
            {item.title}
          </h2>

          <div className="muted">
            {item.courses?.name||""}
          </div>
        </div>

        <div
          style={{
            display:"flex",
            gap:6,
            alignItems:"center",
            flexWrap:"wrap",
            justifyContent:"flex-end"
          }}
        >
          {!isFullscreen&&<>
            <button
              className={`btn ghost ${viewerSize==="medium"?"active":""}`}
              type="button"
              onClick={()=>setViewerSize("medium")}
              title="ขนาดกลาง"
            >
              70%
            </button>

            <button
              className={`btn ghost ${viewerSize==="large"?"active":""}`}
              type="button"
              onClick={()=>setViewerSize("large")}
              title="ขนาดใหญ่"
            >
              85%
            </button>

            <button
              className={`btn ghost ${viewerSize==="xlarge"?"active":""}`}
              type="button"
              onClick={()=>setViewerSize("xlarge")}
              title="ขนาดใหญ่มาก"
            >
              95%
            </button>
          </>}

          <button
            className="btn ghost"
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen?"ออกจากเต็มจอ":"เต็มจอ"}
            style={{display:"inline-flex",alignItems:"center",gap:6}}
          >
            {isFullscreen
              ? <Minimize2 size={17}/>
              : <Maximize2 size={17}/>
            }
            {isFullscreen?"ออกจากเต็มจอ":"เต็มจอ"}
          </button>

          <button
            className="btn ghost"
            type="button"
            onClick={onClose}
            title="ปิด"
            style={{
              width:40,
              height:40,
              padding:0,
              display:"grid",
              placeItems:"center"
            }}
          >
            <X size={21}/>
          </button>
        </div>
      </div>

      {item.description&&
        <p style={{flex:"0 0 auto",marginBottom:4}}>
          {item.description}
        </p>
      }

      {loading&&
        <div className="viewer-loading">
          กำลังเตรียมไฟล์...
        </div>
      }

      <div style={previewAreaStyle}>
        {fileError&&
          <div className="material-file-error" style={{flex:1}}>
            <FileText size={42}/>
            <b>เปิดไฟล์นี้ไม่ได้</b>
            <span>
              ระบบหาไฟล์ใน Storage ไม่พบ หรือสิทธิ์ไฟล์ยังไม่ถูกต้อง
            </span>
            <small>{fileError}</small>
          </div>
        }

        {!fileError&&pdf&&previewUrl&&
          <iframe
            style={iframeStyle}
            src={previewUrl}
            title={item.title}
          />
        }

        {!fileError&&image&&signed&&
          <div
            className="image-preview-wrap"
            style={{
              flex:1,
              minHeight:0,
              overflow:"auto",
              display:"flex",
              alignItems:"center",
              justifyContent:"center"
            }}
          >
            <img
              className="material-image-preview"
              src={signed}
              alt={item.title}
              style={{
                maxWidth:"100%",
                maxHeight:"100%",
                objectFit:"contain"
              }}
            />
          </div>
        }

        {!fileError&&nonPreviewFile&&
          <div
            className="file-preview-placeholder"
            style={{flex:1}}
          >
            {looksLikeZip(item.file_name)
              ? <FileArchive size={58}/>
              : <FileText size={58}/>
            }

            <b>{item.file_name}</b>

            <span>
              ไฟล์ชนิดนี้สามารถดาวน์โหลดไปเปิดด้วยโปรแกรมที่รองรับ
            </span>
          </div>
        }

        {!fileError&&!item.storage_path&&item.link_url&&!drive&&
          <div
            className="file-preview-placeholder"
            style={{flex:1}}
          >
            <ExternalLink size={58}/>
            <b>สื่อแบบลิงก์ภายนอก</b>
            <span>กด “เปิดลิงก์” ด้านล่าง</span>
          </div>
        }

        {!fileError&&!item.storage_path&&!item.link_url&&
          <div
            className="file-preview-placeholder"
            style={{flex:1}}
          >
            <ImageIcon size={58}/>
            <b>รายการนี้ยังไม่มีไฟล์หรือลิงก์</b>
          </div>
        }
      </div>

      <div
        className="viewer-actions"
        style={{
          flex:"0 0 auto",
          display:"flex",
          gap:8,
          flexWrap:"wrap",
          marginTop:12
        }}
      >
        {item.storage_path&&!fileError&&
          <button
            className="btn primary"
            type="button"
            onClick={downloadStorage}
          >
            <Download size={17}/> ดาวน์โหลดไฟล์
          </button>
        }

        {item.link_url&&
          <a
            className="btn ghost"
            target="_blank"
            rel="noreferrer"
            href={item.link_url}
          >
            <ExternalLink size={17}/> เปิดลิงก์
          </a>
        }

        {drive&&item.link_url&&
          <a
            className="btn ghost"
            target="_blank"
            rel="noreferrer"
            href={driveDownloadUrl(item.link_url)}
          >
            <Download size={17}/> ดาวน์โหลดจาก Drive
          </a>
        }
      </div>

      {!isFullscreen&&
        <div
          className="muted"
          style={{
            fontSize:11,
            marginTop:8,
            textAlign:"right"
          }}
        >
          สามารถลากมุมขวาล่างเพื่อปรับขนาดหน้าต่างเองได้
        </div>
      }
    </div>
  </div>
}

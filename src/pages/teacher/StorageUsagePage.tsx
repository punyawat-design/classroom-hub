import { useEffect,useMemo,useState } from "react";
import { HardDrive, RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { errText } from "../../lib/utils";
import { formatBytes } from "../../lib/fileRules";
import { useToast } from "../../context/ToastContext";

const DEFAULT_QUOTA_GB=1;

export default function StorageUsagePage(){
  const [data,setData]=useState<any|null>(null);
  const [busy,setBusy]=useState(false);
  const [quotaGb,setQuotaGb]=useState(()=>Number(localStorage.getItem("ch-storage-quota-gb")||DEFAULT_QUOTA_GB));
  const {toast}=useToast();

  async function load(){
    setBusy(true);
    const {data,error}=await supabase.rpc("teacher_storage_usage_v1");
    setBusy(false);
    if(error){toast("โหลดพื้นที่ไม่สำเร็จ",errText(error),"error");return;}
    setData(data||{});
  }

  useEffect(()=>{load()},[]);

  function changeQuota(value:number){
    setQuotaGb(value);
    localStorage.setItem("ch-storage-quota-gb",String(value));
  }

  const quotaBytes=quotaGb*1024*1024*1024;
  const total=Number(data?.total_bytes||0);
  const pct=useMemo(()=>Math.min(100,quotaBytes?total/quotaBytes*100:0),[total,quotaBytes]);

  return <>
    <header className="page-header">
      <div><h1>พื้นที่ไฟล์</h1><p>ดูพื้นที่สื่อการสอนและไฟล์งานนักเรียนที่เกี่ยวกับบัญชีครูนี้</p></div>
      <button className="btn ghost" onClick={load} disabled={busy}><RefreshCw size={17}/> {busy?"กำลังโหลด...":"รีเฟรช"}</button>
    </header>

    <section className="card section storage-overview">
      <div className="storage-title"><HardDrive size={28}/><div><b>{formatBytes(total)} ใช้งานแล้ว</b><span>จากโควตาอ้างอิง {quotaGb} GB</span></div></div>
      <div className="storage-bar"><div style={{width:`${pct}%`}}/></div>
      <div className="storage-meta"><span>{pct.toFixed(1)}%</span><label>โควตาอ้างอิง <select value={quotaGb} onChange={e=>changeQuota(Number(e.target.value))}><option value={1}>1 GB</option><option value={5}>5 GB</option><option value={10}>10 GB</option><option value={100}>100 GB</option><option value={250}>250 GB</option></select></label></div>
    </section>

    <section className="stats-grid">
      <div className="stat-card"><span>สื่อการสอน</span><b>{formatBytes(Number(data?.materials_bytes||0))}</b></div>
      <div className="stat-card"><span>งานนักเรียน</span><b>{formatBytes(Number(data?.submissions_bytes||0))}</b></div>
      <div className="stat-card"><span>จำนวนไฟล์</span><b>{Number(data?.file_count||0)}</b></div>
      <div className="stat-card"><span>ไฟล์ใหญ่สุด</span><b>{formatBytes(Number(data?.largest_files?.[0]?.size||0))}</b></div>
    </section>

    <div className="table-card section"><table>
      <thead><tr><th>ไฟล์ขนาดใหญ่</th><th>ประเภท</th><th>ขนาด</th><th>วันที่</th></tr></thead>
      <tbody>{(data?.largest_files||[]).map((f:any,i:number)=><tr key={`${f.bucket}-${f.name}-${i}`}><td className="storage-path">{f.name}</td><td>{f.bucket==="materials"?"สื่อการสอน":"งานนักเรียน"}</td><td>{formatBytes(Number(f.size||0))}</td><td>{f.created_at?new Date(f.created_at).toLocaleDateString("th-TH"):"-"}</td></tr>)}</tbody>
    </table>{!data?.largest_files?.length&&<div className="empty">ยังไม่มีไฟล์</div>}</div>

    <div className="notice section">ระบบจำกัดไฟล์งานนักเรียนไม่เกิน 20 MB/ไฟล์ และสื่อการสอนไม่เกิน 50 MB/ไฟล์</div>
  </>;
}

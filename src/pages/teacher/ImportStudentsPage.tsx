import { useEffect,useMemo,useState } from "react";
import { supabase } from "../../lib/supabase";
import { errText } from "../../lib/utils";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";

type ImportRow={
  student_code:string;
  full_name:string;
  nickname:string;
  email:string;
};

function cleanKey(value:string){
  return String(value||"").trim().toLowerCase().replace(/[\s_\-./]+/g,"");
}

function pick(row:Record<string,unknown>,keys:string[]){
  const entries=Object.entries(row);
  for(const [k,v] of entries){
    if(keys.includes(cleanKey(k))) return String(v??"").trim();
  }
  return "";
}

function normalizeRow(row:Record<string,unknown>):ImportRow{
  return {
    student_code:pick(row,["รหัสนักเรียน","รหัส","studentcode","code","studentid"]),
    full_name:pick(row,["ชื่อนามสกุล","ชื่อ","fullname","name"]),
    nickname:pick(row,["ชื่อเล่น","nickname","nick","nickName".toLowerCase()]),
    email:pick(row,["อีเมล","email","mail"])
  };
}


function parseCsvText(text:string){
  const rows:string[][]=[];
  let row:string[]=[];
  let cell="";
  let quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    const next=text[i+1];
    if(ch==='"' && quoted && next==='"'){cell+='"';i++;continue;}
    if(ch==='"'){quoted=!quoted;continue;}
    if(ch===',' && !quoted){row.push(cell);cell="";continue;}
    if((ch==='\n'||ch==='\r') && !quoted){
      if(ch==='\r'&&next==='\n')i++;
      row.push(cell);cell="";
      if(row.some(v=>v.trim()!==""))rows.push(row);
      row=[];continue;
    }
    cell+=ch;
  }
  row.push(cell);
  if(row.some(v=>v.trim()!==""))rows.push(row);
  if(rows.length===0)return [] as Record<string,unknown>[];
  const headers=rows[0].map(x=>x.replace(/^\ufeff/,"").trim());
  return rows.slice(1).map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]??""])));
}

export default function ImportStudentsPage(){
  const [rooms,setRooms]=useState<any[]>([]);
  const [roomId,setRoomId]=useState("");
  const [rows,setRows]=useState<ImportRow[]>([]);
  const [fileName,setFileName]=useState("");
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState<any|null>(null);
  const {toast}=useToast();
  const {confirm}=useConfirm();

  useEffect(()=>{
    supabase.from("classrooms").select("id,name").order("name").then(({data,error})=>{
      if(error)toast("โหลดห้องไม่สำเร็จ",errText(error),"error");
      else setRooms(data||[]);
    });
  },[]);

  const validRows=useMemo(()=>rows.filter(r=>r.student_code&&r.full_name),[rows]);

  async function parseFile(file:File){
    setResult(null);
    setFileName(file.name);
    try{
      let raw:Record<string,unknown>[]=[];
      if(file.name.toLowerCase().endsWith(".csv")){
        raw=parseCsvText(await file.text());
      }else{
        const moduleUrl="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm";
        const XLSX:any=await import(/* @vite-ignore */ moduleUrl);
        const buffer=await file.arrayBuffer();
        const wb=XLSX.read(buffer,{type:"array"});
        const sheet=wb.Sheets[wb.SheetNames[0]];
        raw=XLSX.utils.sheet_to_json(sheet,{defval:""});
      }
      const normalized=raw.map(normalizeRow).filter(r=>r.student_code||r.full_name||r.email);
      if(normalized.length===0)throw new Error("ไม่พบข้อมูลนักเรียนในไฟล์");
      if(normalized.length>2000)throw new Error("นำเข้าได้สูงสุด 2,000 คนต่อไฟล์");
      setRows(normalized);
      toast("อ่านไฟล์แล้ว",`พบ ${normalized.length} แถว`,"success");
    }catch(error){
      setRows([]);
      toast("อ่านไฟล์ไม่สำเร็จ",errText(error),"error");
    }
  }

  function downloadTemplate(){
    const csv="student_code,full_name,nickname,email\n65001,สมชาย ใจดี,บอล,student@example.com\n";
    const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download="classroom-hub-student-template.csv";a.click();
    URL.revokeObjectURL(url);
  }

  async function importRows(){
    if(!roomId){toast("ยังไม่ได้เลือกห้อง","กรุณาเลือกห้องที่จะนำเข้านักเรียน","error");return;}
    if(validRows.length===0){toast("ไม่มีข้อมูลที่นำเข้าได้","ต้องมีรหัสนักเรียนและชื่อ-นามสกุล","error");return;}

    const room=rooms.find(r=>r.id===roomId);
    const ok=await confirm({
      title:"นำเข้านักเรียน?",
      message:`นำเข้า ${validRows.length} คนไปยังห้อง ${room?.name||""} นักเรียนที่มีบัญชีแล้วจะถูกเพิ่มทันที ส่วนผู้ที่ยังไม่สมัครจะรอจับคู่ตอนสมัคร`,
      confirmText:"นำเข้า"
    });
    if(!ok)return;

    setBusy(true);setResult(null);
    let matched=0,pending=0,updated=0,skipped=0;
    try{
      for(let i=0;i<validRows.length;i+=250){
        const chunk=validRows.slice(i,i+250);
        const {data,error}=await supabase.rpc("teacher_import_student_invites_v1",{
          p_classroom_id:roomId,
          p_rows:chunk
        });
        if(error)throw error;
        matched+=Number(data?.matched||0);
        pending+=Number(data?.pending||0);
        updated+=Number(data?.updated||0);
        skipped+=Number(data?.skipped||0);
      }
      const summary={matched,pending,updated,skipped,total:validRows.length};
      setResult(summary);
      toast("นำเข้าเรียบร้อย",`มีบัญชีแล้ว ${matched} คน • รอสมัคร ${pending} คน`,"success");
    }catch(error){
      toast("นำเข้าไม่สำเร็จ",errText(error),"error");
    }finally{
      setBusy(false);
    }
  }

  return <>
    <header className="page-header"><div><h1>นำเข้านักเรียน</h1><p>รองรับ Excel (.xlsx/.xls) และ CSV</p></div></header>

    <section className="card form section">
      <div className="import-actions">
        <button className="btn ghost" type="button" onClick={downloadTemplate}>ดาวน์โหลดไฟล์ตัวอย่าง CSV</button>
      </div>

      <label className="field"><span>ห้องเรียนปลายทาง</span>
        <select value={roomId} onChange={e=>setRoomId(e.target.value)}>
          <option value="">เลือกห้อง</option>
          {rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </label>

      <label className="field"><span>ไฟล์รายชื่อนักเรียน</span>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={e=>{const f=e.target.files?.[0];if(f)parseFile(f)}}/>
      </label>

      <div className="hint">หัวคอลัมน์ที่แนะนำ: student_code, full_name, nickname, email</div>
      {fileName&&<div className="notice">ไฟล์: {fileName} • อ่านได้ {rows.length} แถว • ใช้ได้ {validRows.length} แถว</div>}
      <button className="btn primary" type="button" disabled={busy||validRows.length===0} onClick={importRows}>{busy?"กำลังนำเข้า...":`นำเข้า ${validRows.length} คน`}</button>
    </section>

    {result&&<section className="card section import-summary">
      <h2>ผลการนำเข้า</h2>
      <div className="info-grid">
        <div><span>มีบัญชีแล้ว / เพิ่มเข้าห้องทันที</span><b>{result.matched}</b></div>
        <div><span>รอสมัครบัญชี</span><b>{result.pending}</b></div>
        <div><span>อัปเดตรายการเดิม</span><b>{result.updated}</b></div>
      </div>
    </section>}

    {rows.length>0&&<div className="table-card section import-preview"><table>
      <thead><tr><th>#</th><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>ชื่อเล่น</th><th>Email</th><th>สถานะข้อมูล</th></tr></thead>
      <tbody>{rows.slice(0,100).map((r,i)=><tr key={`${r.student_code}-${i}`}>
        <td>{i+1}</td><td>{r.student_code||"-"}</td><td>{r.full_name||"-"}</td><td>{r.nickname||"-"}</td><td>{r.email||"-"}</td>
        <td>{r.student_code&&r.full_name?<span className="mini-ok">พร้อม</span>:<span className="mini-bad">ข้อมูลไม่ครบ</span>}</td>
      </tr>)}</tbody>
    </table>{rows.length>100&&<div className="empty">แสดงตัวอย่าง 100 แถวแรก จากทั้งหมด {rows.length} แถว</div>}</div>}
  </>;
}

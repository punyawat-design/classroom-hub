import { Moon, Palette, Sun, Upload, X } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";

const presets=["#2563eb","#7c3aed","#db2777","#059669","#ea580c","#0891b2","#334155"];

export default function ThemePanel(){
  const t=useTheme();
  const {toast}=useToast();
  if(!t.panelOpen)return null;

  function imagePicked(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];
    if(!file)return;
    if(file.size>2_000_000){
      toast("รูปใหญ่เกินไป","แนะนำรูปไม่เกิน 2 MB","error");
      return;
    }
    const reader=new FileReader();
    reader.onload=()=>{ t.setBackgroundImage(String(reader.result)); toast("เปลี่ยนพื้นหลังแล้ว","","success"); };
    reader.readAsDataURL(file);
  }

  return <div className="theme-panel">
    <div className="theme-head"><div><b>ปรับธีม</b><span>เปลี่ยนสีและพื้นหลังได้ทันที</span></div><button onClick={()=>t.setPanelOpen(false)}><X size={19}/></button></div>
    <div className="theme-block">
      <label>โหมด</label>
      <div className="theme-mode">
        <button className={t.mode==="light"?"selected":""} onClick={()=>t.setMode("light")}><Sun size={17}/> สว่าง</button>
        <button className={t.mode==="dark"?"selected":""} onClick={()=>t.setMode("dark")}><Moon size={17}/> มืด</button>
      </div>
    </div>
    <div className="theme-block">
      <label><Palette size={16}/> สีหลัก</label>
      <div className="color-presets">{presets.map(c=><button key={c} aria-label={c} style={{background:c}} className={t.accent===c?"selected":""} onClick={()=>t.setAccent(c)}/>)}</div>
      <input type="color" value={t.accent} onChange={e=>t.setAccent(e.target.value)}/>
    </div>
    <div className="theme-block">
      <label><Upload size={16}/> รูปพื้นหลัง</label>
      <input type="file" accept="image/*" onChange={imagePicked}/>
      {t.backgroundImage&&<button className="btn ghost" onClick={()=>t.setBackgroundImage("")}>ลบพื้นหลัง</button>}
    </div>
    <button className="btn ghost wide" onClick={()=>{t.reset();toast("คืนค่าธีมแล้ว","","info")}}>คืนค่าเริ่มต้น</button>
  </div>
}

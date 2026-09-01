import { createContext, useContext, useMemo, useState } from "react";

type Tone = "success" | "error" | "info";
type Toast = { id:number; title:string; message?:string; tone:Tone };

const ToastContext = createContext({
  toast: (_title:string,_message?:string,_tone:Tone="success") => {}
});

export function ToastProvider({children}:{children:React.ReactNode}) {
  const [items,setItems] = useState<Toast[]>([]);

  function toast(title:string,message?:string,tone:Tone="success") {
    const id = Date.now() + Math.floor(Math.random()*1000);
    setItems(v=>[...v,{id,title,message,tone}]);
    window.setTimeout(()=>setItems(v=>v.filter(x=>x.id!==id)),3500);
  }

  const value = useMemo(()=>({toast}),[]);
  return <ToastContext.Provider value={value}>
    {children}
    <div className="toast-stack">
      {items.map(x=><div key={x.id} className={`toast toast-${x.tone}`}>
        <div className="toast-icon">{x.tone==="success"?"✓":x.tone==="error"?"!":"i"}</div>
        <div><b>{x.title}</b>{x.message&&<div>{x.message}</div>}</div>
        <button onClick={()=>setItems(v=>v.filter(y=>y.id!==x.id))}>×</button>
      </div>)}
    </div>
  </ToastContext.Provider>;
}

export const useToast = () => useContext(ToastContext);

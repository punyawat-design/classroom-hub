import { createContext, useContext, useState } from "react";

type Options = { title:string; message:string; confirmText?:string; cancelText?:string; danger?:boolean };
type Resolver = (value:boolean)=>void;

const ConfirmContext = createContext({
  confirm: (_options:Options):Promise<boolean> => Promise.resolve(true)
});

export function ConfirmProvider({children}:{children:React.ReactNode}) {
  const [options,setOptions] = useState<Options|null>(null);
  const [resolver,setResolver] = useState<Resolver|null>(null);

  function confirm(next:Options) {
    setOptions(next);
    return new Promise<boolean>(resolve=>setResolver(()=>resolve));
  }

  function finish(value:boolean) {
    resolver?.(value);
    setResolver(null);
    setOptions(null);
  }

  return <ConfirmContext.Provider value={{confirm}}>
    {children}
    {options&&<div className="modal-backdrop" onMouseDown={()=>finish(false)}>
      <div className="confirm-modal" onMouseDown={e=>e.stopPropagation()}>
        <div className="modal-symbol">?</div>
        <h2>{options.title}</h2>
        <p>{options.message}</p>
        <div className="modal-actions">
          <button className="btn ghost" onClick={()=>finish(false)}>{options.cancelText||"ยกเลิก"}</button>
          <button className={`btn ${options.danger?"danger":"primary"}`} onClick={()=>finish(true)}>{options.confirmText||"ยืนยัน"}</button>
        </div>
      </div>
    </div>}
  </ConfirmContext.Provider>;
}

export const useConfirm = () => useContext(ConfirmContext);

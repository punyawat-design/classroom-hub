import { useEffect,useState } from "react";

export type AssignmentLink={title:string;url:string};

type Props={
  name?:string;
  defaultValue?:AssignmentLink[];
};

export default function AssignmentLinksEditor({name="resource_links",defaultValue=[]}:Props){
  const [items,setItems]=useState<AssignmentLink[]>(()=>defaultValue.length?defaultValue:[{title:"",url:""}]);

  useEffect(()=>{
    setItems(defaultValue.length?defaultValue:[{title:"",url:""}]);
  },[JSON.stringify(defaultValue)]);

  function setItem(index:number,key:keyof AssignmentLink,value:string){
    setItems(current=>current.map((item,i)=>i===index?{...item,[key]:value}:item));
  }

  function remove(index:number){
    setItems(current=>{
      const next=current.filter((_,i)=>i!==index);
      return next.length?next:[{title:"",url:""}];
    });
  }

  const saved=items
    .map(item=>({title:item.title.trim(),url:item.url.trim()}))
    .filter(item=>item.url);

  return <div className="field assignment-links-editor">
    <span>ลิงก์ประกอบการทำงาน</span>

    <div className="assignment-link-rows">
      {items.map((item,index)=><div className="assignment-link-row" key={index}>
        <input
          value={item.title}
          onChange={e=>setItem(index,"title",e.target.value)}
          placeholder="ชื่อ เช่น ตัวอย่างงาน (ไม่บังคับ)"
        />
        <input
          value={item.url}
          onChange={e=>setItem(index,"url",e.target.value)}
          placeholder="https://..."
          inputMode="url"
        />
        <button type="button" className="btn ghost small-btn" onClick={()=>remove(index)}>ลบ</button>
      </div>)}
    </div>

    <div>
      <button
        type="button"
        className="btn ghost small-btn"
        onClick={()=>setItems(current=>[...current,{title:"",url:""}])}
      >
        + เพิ่มลิงก์อีก
      </button>
    </div>

    <input type="hidden" name={name} value={JSON.stringify(saved)}/>
    <small className="field-hint">เพิ่มได้หลายลิงก์ เช่น Google Drive, เว็บไซต์, YouTube หรือเอกสารออนไลน์</small>
  </div>;
}

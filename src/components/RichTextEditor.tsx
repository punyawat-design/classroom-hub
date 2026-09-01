import { useEffect,useRef,useState } from "react";
import { sanitizeRichHtml } from "../lib/richText";

type Props={
  name:string;
  label:string;
  defaultValue?:string;
  minHeight?:number;
  hint?:string;
};

export default function RichTextEditor({
  name,
  label,
  defaultValue="",
  minHeight=150,
  hint="จัดรูปแบบตัวอักษรได้ หรือเว้นว่างไว้ก็ได้"
}:Props){
  const editorRef=useRef<HTMLDivElement|null>(null);
  const selectionRef=useRef<Range|null>(null);
  const [html,setHtml]=useState(()=>sanitizeRichHtml(defaultValue));

  useEffect(()=>{
    const next=sanitizeRichHtml(defaultValue);
    setHtml(next);
    if(editorRef.current && editorRef.current.innerHTML!==next){
      editorRef.current.innerHTML=next;
    }
  },[defaultValue]);

  function rememberSelection(){
    const editor=editorRef.current;
    const sel=window.getSelection();
    if(!editor||!sel||sel.rangeCount===0)return;
    const range=sel.getRangeAt(0);
    if(editor.contains(range.commonAncestorContainer))selectionRef.current=range.cloneRange();
  }

  function restoreSelection(){
    const sel=window.getSelection();
    if(!sel||!selectionRef.current)return;
    sel.removeAllRanges();
    sel.addRange(selectionRef.current);
  }

  function sync(){
    const editor=editorRef.current;
    if(!editor)return;
    const next=sanitizeRichHtml(editor.innerHTML);
    setHtml(next);
  }

  function command(cmd:string,value?:string){
    const editor=editorRef.current;
    if(!editor)return;
    editor.focus();
    restoreSelection();
    document.execCommand(cmd,false,value);
    rememberSelection();
    sync();
  }

  return <div className="field rich-field">
    <span>{label}</span>

    <div className="rich-editor-shell">
      <div className="rich-toolbar" aria-label={`เครื่องมือจัดรูปแบบ ${label}`}>
        <button type="button" title="ตัวหนา" onMouseDown={e=>{e.preventDefault();command("bold")}}><b>B</b></button>
        <button type="button" title="ตัวเอียง" onMouseDown={e=>{e.preventDefault();command("italic")}}><i>I</i></button>
        <button type="button" title="ขีดเส้นใต้" onMouseDown={e=>{e.preventDefault();command("underline")}}><u>U</u></button>
        <button type="button" title="ข้อความปกติ" onMouseDown={e=>{e.preventDefault();command("formatBlock","p")}}>ปกติ</button>
        <button type="button" title="หัวข้อใหญ่" onMouseDown={e=>{e.preventDefault();command("formatBlock","h2")}}>หัวข้อใหญ่</button>
        <button type="button" title="หัวข้อย่อย" onMouseDown={e=>{e.preventDefault();command("formatBlock","h3")}}>หัวข้อย่อย</button>
        <button type="button" title="รายการแบบจุด" onMouseDown={e=>{e.preventDefault();command("insertUnorderedList")}}>• รายการ</button>
        <button type="button" title="รายการแบบตัวเลข" onMouseDown={e=>{e.preventDefault();command("insertOrderedList")}}>1. รายการ</button>
        <button type="button" title="ชิดซ้าย" onMouseDown={e=>{e.preventDefault();command("justifyLeft")}}>ซ้าย</button>
        <button type="button" title="กึ่งกลาง" onMouseDown={e=>{e.preventDefault();command("justifyCenter")}}>กลาง</button>
        <label className="rich-color" title="สีตัวอักษร">
          <span>สี</span>
          <input
            type="color"
            defaultValue="#111827"
            onMouseDown={()=>rememberSelection()}
            onChange={e=>command("foreColor",e.target.value)}
          />
        </label>
        <button type="button" title="ล้างรูปแบบ" onMouseDown={e=>{e.preventDefault();command("removeFormat")}}>ล้างรูปแบบ</button>
      </div>

      <div
        ref={editorRef}
        className="rich-editor"
        contentEditable
        suppressContentEditableWarning
        style={{minHeight}}
        data-placeholder={`พิมพ์${label}...`}
        onInput={sync}
        onMouseUp={rememberSelection}
        onKeyUp={rememberSelection}
        onBlur={()=>{rememberSelection();sync()}}
      />
    </div>

    <input type="hidden" name={name} value={html}/>
    <small className="field-hint">{hint}</small>
  </div>;
}

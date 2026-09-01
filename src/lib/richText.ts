const ALLOWED_TAGS = new Set([
  "P","DIV","BR","STRONG","B","EM","I","U","S",
  "UL","OL","LI","H2","H3","H4","BLOCKQUOTE","SPAN","FONT","A"
]);

const DROP_TAGS = new Set(["SCRIPT","STYLE","IFRAME","OBJECT","EMBED","LINK","META"]);

function safeUrl(value:string){
  const raw=value.trim();
  if(!raw)return "";
  try{
    const u=new URL(raw,window.location.origin);
    if(["http:","https:","mailto:"].includes(u.protocol))return raw;
  }catch{
    return "";
  }
  return "";
}

function cleanStyle(style:string){
  const out:string[]=[];
  for(const part of style.split(";")){
    const [rawKey,...rest]=part.split(":");
    const key=(rawKey||"").trim().toLowerCase();
    const value=rest.join(":").trim();
    if(!value)continue;

    if(key==="color" && /^#[0-9a-f]{3,8}$/i.test(value))out.push(`color:${value}`);
    if(key==="text-align" && ["left","center","right","justify"].includes(value.toLowerCase())){
      out.push(`text-align:${value.toLowerCase()}`);
    }
  }
  return out.join(";");
}

export function sanitizeRichHtml(input:string){
  if(!input)return "";

  const parser=new DOMParser();
  const doc=parser.parseFromString(`<div id="root">${input}</div>`,"text/html");
  const root=doc.getElementById("root");
  if(!root)return "";

  function clean(node:Element){
    for(const child of Array.from(node.children))clean(child);

    if(DROP_TAGS.has(node.tagName)){
      node.remove();
      return;
    }

    if(node!==root && !ALLOWED_TAGS.has(node.tagName)){
      const parent=node.parentNode;
      if(parent){
        while(node.firstChild)parent.insertBefore(node.firstChild,node);
        parent.removeChild(node);
      }
      return;
    }

    if(node===root)return;

    const href=node.tagName==="A"?safeUrl(node.getAttribute("href")||""):"";
    const style=cleanStyle(node.getAttribute("style")||"");
    const color=node.tagName==="FONT"?(node.getAttribute("color")||""):"";

    for(const attr of Array.from(node.attributes))node.removeAttribute(attr.name);

    if(node.tagName==="A" && href){
      node.setAttribute("href",href);
      node.setAttribute("target","_blank");
      node.setAttribute("rel","noopener noreferrer");
    }

    if(style)node.setAttribute("style",style);
    if(node.tagName==="FONT" && /^#[0-9a-f]{3,8}$/i.test(color))node.setAttribute("color",color);
  }

  clean(root);
  return root.innerHTML.trim();
}

export function richTextToPlain(input:string){
  if(!input)return "";
  const html=sanitizeRichHtml(input)
    .replace(/<br\s*\/?>/gi,"\n")
    .replace(/<\/(p|div|li|h2|h3|h4|blockquote)>/gi,"\n");
  const parser=new DOMParser();
  const doc=parser.parseFromString(html,"text/html");
  return (doc.body.textContent||"")
    .replace(/\n{3,}/g,"\n\n")
    .trim();
}

export function plainTextToHtml(input?:string|null){
  const text=(input||"").trim();
  if(!text)return "";
  const escaped=text
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
  return escaped
    .split(/\n{2,}/)
    .map(block=>`<p>${block.replace(/\n/g,"<br>")}</p>`)
    .join("");
}

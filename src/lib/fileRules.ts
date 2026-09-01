export const MAX_SUBMISSION_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_MATERIAL_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_SUBMISSION_FILES = 10;

const allowedExtensions = new Set([
  "pdf","doc","docx","xls","xlsx","ppt","pptx","zip","rar","7z",
  "jpg","jpeg","png","webp","gif","txt","csv"
]);

export const FILE_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.jpg,.jpeg,.png,.webp,.gif,.txt,.csv,image/*";

export function formatBytes(bytes:number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units=["B","KB","MB","GB","TB"];
  let value=bytes;
  let i=0;
  while(value>=1024 && i<units.length-1){ value/=1024;i++; }
  return `${value>=10||i===0?value.toFixed(0):value.toFixed(1)} ${units[i]}`;
}

function ext(name:string){
  const parts=name.toLowerCase().split(".");
  return parts.length>1?parts.pop()||"":"";
}

export function validateMaterialFile(file:File){
  if(file.size>MAX_MATERIAL_FILE_BYTES){
    return `ไฟล์ ${file.name} ใหญ่เกิน 50 MB`;
  }
  if(!allowedExtensions.has(ext(file.name))){
    return `ไม่รองรับไฟล์ ${file.name}`;
  }
  return "";
}

export function validateSubmissionFiles(files:File[]){
  if(files.length>MAX_SUBMISSION_FILES){
    return `ส่งได้สูงสุด ${MAX_SUBMISSION_FILES} ไฟล์ต่อครั้ง`;
  }
  for(const file of files){
    if(file.size>MAX_SUBMISSION_FILE_BYTES){
      return `ไฟล์ ${file.name} ใหญ่เกิน 20 MB`;
    }
    if(!allowedExtensions.has(ext(file.name))){
      return `ไม่รองรับไฟล์ ${file.name}`;
    }
  }
  return "";
}

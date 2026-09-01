import { supabase } from "./supabase";
import { safeFileName } from "./utils";
import { validateMaterialFile } from "./fileRules";

export type AssignmentLink={title:string;url:string};

export const MAX_ASSIGNMENT_ATTACHMENTS=10;

export function parseAssignmentLinks(raw:FormDataEntryValue|null):AssignmentLink[]{
  let input:any[]=[];
  try{
    const parsed=JSON.parse(String(raw||"[]"));
    if(Array.isArray(parsed))input=parsed;
  }catch{
    throw new Error("ข้อมูลลิงก์ไม่ถูกต้อง");
  }

  return input
    .map(item=>({
      title:String(item?.title||"").trim(),
      url:String(item?.url||"").trim()
    }))
    .filter(item=>item.url)
    .map(item=>{
      let url=item.url;
      if(!/^https?:\/\//i.test(url))url=`https://${url}`;
      try{
        const parsed=new URL(url);
        if(!["http:","https:"].includes(parsed.protocol))throw new Error();
      }catch{
        throw new Error(`ลิงก์ไม่ถูกต้อง: ${item.url}`);
      }
      return {...item,url};
    });
}

export function validateAssignmentAttachments(files:File[],existingCount=0){
  if(existingCount+files.length>MAX_ASSIGNMENT_ATTACHMENTS){
    return `ไฟล์ประกอบงานรวมได้สูงสุด ${MAX_ASSIGNMENT_ATTACHMENTS} ไฟล์`;
  }

  for(const file of files){
    const error=validateMaterialFile(file);
    if(error)return error;
  }

  return "";
}

export async function uploadAssignmentAttachments({
  assignmentId,
  teacherId,
  files
}:{
  assignmentId:string;
  teacherId:string;
  files:File[];
}){
  const uploadedPaths:string[]=[];

  try{
    for(const file of files){
      const unique=
        typeof crypto!=="undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const path=`${teacherId}/${assignmentId}/${unique}-${safeFileName(file.name)}`;

      const {data:uploaded,error:uploadError}=await supabase.storage
        .from("assignment-files")
        .upload(path,file,{
          cacheControl:"3600",
          upsert:false,
          contentType:file.type||undefined
        });

      if(uploadError)throw uploadError;
      uploadedPaths.push(uploaded.path);

      const {error:metaError}=await supabase.from("assignment_attachments").insert({
        assignment_id:assignmentId,
        file_name:file.name,
        storage_path:uploaded.path,
        file_size:file.size,
        file_type:file.type||null
      });

      if(metaError)throw metaError;
    }

    return uploadedPaths;
  }catch(error){
    if(uploadedPaths.length){
      await supabase.storage.from("assignment-files").remove(uploadedPaths);
    }
    throw error;
  }
}

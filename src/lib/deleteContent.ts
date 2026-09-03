import { supabase } from "./supabase";

function uniq(paths:(string|null|undefined)[]){
  return [...new Set(paths.filter((x):x is string=>!!x))];
}

async function removeStorageFiles(bucket:string,paths:string[]){
  const clean=uniq(paths);
  for(let i=0;i<clean.length;i+=100){
    const {error}=await supabase.storage.from(bucket).remove(clean.slice(i,i+100));
    if(error)throw error;
  }
}

export async function deleteAssignmentsDeep(assignmentIds:string[]){
  const ids=[...new Set(assignmentIds.filter(Boolean))];
  if(ids.length===0)return;

  const [{data:subs,error:subError},{data:attachments,error:attError}]=await Promise.all([
    supabase
      .from("submissions")
      .select("id,submission_files(storage_path)")
      .in("assignment_id",ids),
    supabase
      .from("assignment_attachments")
      .select("storage_path")
      .in("assignment_id",ids)
  ]);

  if(subError)throw subError;
  if(attError)throw attError;

  const submissionPaths=uniq(
    (subs||[]).flatMap((s:any)=>(s.submission_files||[]).map((f:any)=>f.storage_path))
  );
  const attachmentPaths=uniq((attachments||[]).map((x:any)=>x.storage_path));

  await removeStorageFiles("submissions",submissionPaths);
  await removeStorageFiles("assignment-files",attachmentPaths);

  const {error}=await supabase.from("assignments").delete().in("id",ids);
  if(error)throw error;
}

export async function deleteClassroomDeep(classroomId:string){
  const {data:assignments,error:assignmentError}=await supabase
    .from("assignments")
    .select("id")
    .eq("classroom_id",classroomId);
  if(assignmentError)throw assignmentError;

  await deleteAssignmentsDeep((assignments||[]).map((x:any)=>x.id));

  const {error}=await supabase.from("classrooms").delete().eq("id",classroomId);
  if(error)throw error;
}

export async function deleteCourseDeep(courseId:string){
  const [{data:materials,error:materialError},{data:assignments,error:assignmentError}]=await Promise.all([
    supabase.from("learning_materials").select("storage_path").eq("course_id",courseId),
    supabase.from("assignments").select("id").eq("course_id",courseId)
  ]);

  if(materialError)throw materialError;
  if(assignmentError)throw assignmentError;

  await removeStorageFiles("materials",(materials||[]).map((x:any)=>x.storage_path));
  await deleteAssignmentsDeep((assignments||[]).map((x:any)=>x.id));

  const {error}=await supabase.from("courses").delete().eq("id",courseId);
  if(error)throw error;
}

import { useEffect,useMemo,useRef,useState } from "react";
import { Camera,Flag,Mountain,RefreshCw,Trophy,Upload } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { supabase } from "../lib/supabase";
import { errText } from "../lib/utils";

type CourseRow={
  id:string;
  name:string;
  archived_at?:string|null;
};

type LeaderRow={
  rank_no:number;
  student_id:string;
  student_code:string|null;
  full_name:string;
  nickname:string|null;
  avatar_path:string|null;
  completed_count:number;
  total_assignments:number;
  remaining_count:number;
  progress_percent:number;
  avg_speed_seconds:number|null;
  last_submitted_at:string|null;
};

const routeStops=[
  {p:0,x:16,y:86},
  {p:18,x:67,y:76},
  {p:36,x:31,y:64},
  {p:55,x:72,y:51},
  {p:74,x:37,y:37},
  {p:90,x:67,y:24},
  {p:100,x:52,y:10},
];

function clamp(n:number,min:number,max:number){return Math.max(min,Math.min(max,n));}

function mountainPosition(progress:number,rank:number){
  const p=clamp(Number(progress)||0,0,100);
  let a=routeStops[0],b=routeStops[routeStops.length-1];
  for(let i=0;i<routeStops.length-1;i++){
    if(p>=routeStops[i].p&&p<=routeStops[i+1].p){a=routeStops[i];b=routeStops[i+1];break;}
  }
  const t=(p-a.p)/Math.max(1,b.p-a.p);
  let x=a.x+(b.x-a.x)*t;
  let y=a.y+(b.y-a.y)*t;
  const spread=((rank-1)%5-2)*2.6;
  x=clamp(x+spread,8,90);
  y=clamp(y+Math.floor((rank-1)/5)*1.4,7,88);
  return {left:`${x}%`,top:`${y}%`};
}

function initials(row:LeaderRow){
  const text=(row.nickname||row.full_name||"?").trim();
  return text.slice(0,2).toUpperCase();
}

function speedText(seconds:number|null){
  if(seconds===null||seconds===undefined||!Number.isFinite(Number(seconds)))return "ยังไม่มีเวลาส่ง";
  const sec=Math.max(0,Number(seconds));
  const days=Math.floor(sec/86400);
  const hours=Math.floor((sec%86400)/3600);
  const mins=Math.floor((sec%3600)/60);
  if(days>0)return `เฉลี่ย ${days} วัน ${hours} ชม.`;
  if(hours>0)return `เฉลี่ย ${hours} ชม. ${mins} นาที`;
  return `เฉลี่ย ${Math.max(1,mins)} นาที`;
}

export default function AdventureLeaderboardPage(){
  const {user,profile}=useAuth();
  const {toast}=useToast();
  const fileRef=useRef<HTMLInputElement|null>(null);

  const [courses,setCourses]=useState<CourseRow[]>([]);
  const [courseId,setCourseId]=useState("");
  const [leaders,setLeaders]=useState<LeaderRow[]>([]);
  const [avatarUrls,setAvatarUrls]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(false);
  const [uploading,setUploading]=useState(false);

  async function loadCourses(){
    const {data,error}=await supabase
      .from("courses")
      .select("id,name,archived_at")
      .order("archived_at",{ascending:true,nullsFirst:true})
      .order("name");

    if(error){toast("โหลดรายวิชาไม่สำเร็จ",errText(error),"error");return;}
    const rows=(data||[]) as CourseRow[];
    setCourses(rows);
    setCourseId(current=>current||rows[0]?.id||"");
  }

  async function loadLeaderboard(id:string){
    if(!id){setLeaders([]);setAvatarUrls({});return;}
    setLoading(true);
    const {data,error}=await supabase.rpc("course_adventure_leaderboard_v1",{p_course_id:id});
    setLoading(false);

    if(error){
      setLeaders([]);
      toast("โหลดอันดับไม่สำเร็จ",errText(error),"error");
      return;
    }

    const rows=((data||[]) as LeaderRow[]).map(row=>({
      ...row,
      rank_no:Number(row.rank_no||0),
      completed_count:Number(row.completed_count||0),
      total_assignments:Number(row.total_assignments||0),
      remaining_count:Number(row.remaining_count||0),
      progress_percent:Number(row.progress_percent||0),
      avg_speed_seconds:row.avg_speed_seconds===null?null:Number(row.avg_speed_seconds)
    }));
    setLeaders(rows);

    const paths=[...new Set(rows.map(x=>x.avatar_path).filter(Boolean) as string[])];
    if(paths.length===0){setAvatarUrls({});return;}

    const {data:signed,error:signedError}=await supabase.storage
      .from("avatars")
      .createSignedUrls(paths,3600);

    if(signedError){
      setAvatarUrls({});
      return;
    }

    const map:Record<string,string>={};
    (signed||[]).forEach((item:any)=>{
      if(item.path&&item.signedUrl)map[item.path]=item.signedUrl;
    });
    setAvatarUrls(map);
  }

  useEffect(()=>{loadCourses()},[]);
  useEffect(()=>{if(courseId)loadLeaderboard(courseId)},[courseId]);

  async function uploadAvatar(file:File){
    if(!user||profile?.role!=="student")return;
    const allowed=["image/jpeg","image/png","image/webp","image/gif"];
    if(!allowed.includes(file.type)){
      toast("รูปแบบไฟล์ไม่รองรับ","ใช้ JPG, PNG, WEBP หรือ GIF เท่านั้น","error");
      return;
    }
    if(file.size>5*1024*1024){
      toast("รูปใหญ่เกินไป","ขนาดรูปต้องไม่เกิน 5 MB","error");
      return;
    }

    setUploading(true);
    const path=`${user.id}/profile-avatar`;
    const {error:uploadError}=await supabase.storage
      .from("avatars")
      .upload(path,file,{upsert:true,contentType:file.type,cacheControl:"3600"});

    if(uploadError){
      setUploading(false);
      toast("อัปโหลดรูปไม่สำเร็จ",errText(uploadError),"error");
      return;
    }

    const {error:profileError}=await supabase.rpc("student_set_avatar_v1",{p_storage_path:path});
    setUploading(false);

    if(profileError){
      toast("บันทึกรูปไม่สำเร็จ",errText(profileError),"error");
      return;
    }

    toast("เปลี่ยนรูปนักผจญภัยแล้ว","รูปใหม่จะแสดงบนภูเขา","success");
    if(courseId)await loadLeaderboard(courseId);
  }

  const selectedCourse=courses.find(c=>c.id===courseId);
  const me=leaders.find(x=>x.student_id===user?.id);
  const top3=leaders.slice(0,3);

  const summary=useMemo(()=>{
    if(!me)return null;
    return `${me.completed_count}/${me.total_assignments} งาน • ปีนถึง ${Math.round(me.progress_percent)}%`;
  },[me]);

  return <>
    <header className="page-header adventure-page-head">
      <div>
        <div className="adventure-kicker"><Mountain size={18}/> ADVENTURE RANKING</div>
        <h1>ศึกพิชิตยอดเขา</h1>
        <p>ส่งงานให้ครบ แล้วปีนขึ้นสู่ยอดเขาประจำรายวิชา</p>
      </div>
      <button className="btn ghost" type="button" onClick={()=>courseId&&loadLeaderboard(courseId)} disabled={!courseId||loading}>
        <RefreshCw size={17}/> รีเฟรชอันดับ
      </button>
    </header>

    <section className="card adventure-toolbar">
      <label className="field adventure-course-select">
        <span>เลือกรายวิชา</span>
        <select value={courseId} onChange={e=>setCourseId(e.target.value)}>
          {courses.length===0&&<option value="">ยังไม่มีรายวิชา</option>}
          {courses.map(c=><option key={c.id} value={c.id}>{c.name}{c.archived_at?" (เก็บถาวร)":""}</option>)}
        </select>
      </label>

      {profile?.role==="student"&&<div className="adventure-my-profile">
        <div>
          <b>{profile.nickname||profile.full_name}</b>
          <span>{summary||"เริ่มภารกิจแล้วไปให้ถึงยอดเขา!"}</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          hidden
          onChange={e=>{
            const file=e.target.files?.[0];
            if(file)uploadAvatar(file);
            e.currentTarget.value="";
          }}
        />
        <button className="btn primary" type="button" onClick={()=>fileRef.current?.click()} disabled={uploading}>
          {uploading?<Upload size={17}/>:<Camera size={17}/>} {uploading?"กำลังอัปโหลด...":"ใส่รูปของฉัน"}
        </button>
      </div>}
    </section>

    {selectedCourse&&<section className="adventure-hero section">
      <div className="adventure-title-row">
        <div>
          <span className="adventure-eyebrow">MISSION</span>
          <h2>{selectedCourse.name}</h2>
        </div>
        <div className="adventure-rule"><Trophy size={18}/> ทำงานครบก่อน • ถ้าเท่ากัน คนที่ส่งเร็วกว่าอยู่อันดับสูงกว่า</div>
      </div>

      <div className="adventure-stage-wrap">
        <div className="adventure-stage" aria-label={`อันดับการส่งงานรายวิชา ${selectedCourse.name}`}>
          <div className="adventure-sun"/>
          <div className="cloud cloud-a">☁</div>
          <div className="cloud cloud-b">☁</div>
          <div className="cloud cloud-c">☁</div>
          <div className="mountain-back mountain-back-a"/>
          <div className="mountain-back mountain-back-b"/>
          <div className="mountain-main"/>
          <div className="mountain-snow"/>
          <div className="summit-flag"><Flag size={28}/><span>ยอดเขา 100%</span></div>
          <svg className="adventure-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="16,86 67,76 31,64 72,51 37,37 67,24 52,10"/>
          </svg>
          <div className="adventure-base-label">BASE CAMP</div>

          {leaders.map(row=>{
            const pos=mountainPosition(row.progress_percent,row.rank_no);
            const avatar=row.avatar_path?avatarUrls[row.avatar_path]:"";
            return <div
              key={row.student_id}
              className={`mountain-player rank-${Math.min(row.rank_no,4)} ${row.student_id===user?.id?"is-me":""}`}
              style={pos}
              title={`${row.full_name} • ${row.completed_count}/${row.total_assignments} งาน`}
            >
              <div className="player-rank">#{row.rank_no}</div>
              <div className="player-avatar">
                {avatar?<img src={avatar} alt={row.full_name}/>:<span>{initials(row)}</span>}
              </div>
              <div className="player-tag">
                <b>{row.nickname||row.full_name}</b>
                <span>{row.completed_count}/{row.total_assignments} • {Math.round(row.progress_percent)}%</span>
              </div>
            </div>;
          })}

          {leaders.length===0&&!loading&&<div className="adventure-empty">ยังไม่มีนักเรียนในภารกิจนี้</div>}
          {loading&&<div className="adventure-empty">กำลังโหลดเส้นทาง...</div>}
        </div>
      </div>
    </section>}

    {leaders.length>0&&<section className="section adventure-ranking-section">
      <div className="adventure-podium-grid">
        {top3.map(row=>{
          const avatar=row.avatar_path?avatarUrls[row.avatar_path]:"";
          return <article className={`card podium-card podium-${row.rank_no}`} key={row.student_id}>
            <div className="podium-medal">{row.rank_no===1?"🥇":row.rank_no===2?"🥈":"🥉"}</div>
            <div className="podium-avatar">{avatar?<img src={avatar} alt={row.full_name}/>:initials(row)}</div>
            <div><b>{row.nickname||row.full_name}</b><span>{row.full_name}</span></div>
            <strong>{row.completed_count}/{row.total_assignments}</strong>
          </article>;
        })}
      </div>

      <div className="table-card adventure-table-card">
        <table>
          <thead><tr><th>อันดับ</th><th>นักผจญภัย</th><th>ความคืบหน้า</th><th>เหลือ</th><th>ความเร็วการส่ง</th></tr></thead>
          <tbody>{leaders.map(row=>{
            const avatar=row.avatar_path?avatarUrls[row.avatar_path]:"";
            return <tr key={row.student_id} className={row.student_id===user?.id?"leaderboard-me-row":""}>
              <td><b>#{row.rank_no}</b></td>
              <td><div className="leader-name-cell"><div className="leader-mini-avatar">{avatar?<img src={avatar} alt=""/>:initials(row)}</div><div><b>{row.nickname||row.full_name}</b><span>{row.full_name} • {row.student_code||"ไม่มีรหัส"}</span></div></div></td>
              <td><div className="leader-progress-cell"><b>{row.completed_count}/{row.total_assignments}</b><div className="leader-progress-track"><i style={{width:`${clamp(row.progress_percent,0,100)}%`}}/></div><span>{Math.round(row.progress_percent)}%</span></div></td>
              <td>{row.remaining_count} งาน</td>
              <td>{speedText(row.avg_speed_seconds)}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>}
  </>;
}

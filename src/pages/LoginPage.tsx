import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { errText } from "../lib/utils";
import { useToast } from "../context/ToastContext";

export default function LoginPage() {
  const [mode,setMode]=useState<"login"|"signup">("login");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [fullName,setFullName] = useState("");
  const [studentCode,setStudentCode] = useState("");
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const {profile,loading} = useAuth();
  const {toast}=useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && profile) navigate(profile.role==="teacher"?"/teacher":"/student",{replace:true});
  }, [profile,loading,navigate]);

  async function login(e:React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const {data,error} = await supabase.auth.signInWithPassword({email,password});
    if (error) {
      setError(errText(error));
    } else {
      // If a confirmed student signup has no profile yet, repair it from Auth metadata.
      if(data.user){
        const {data:existing}=await supabase.from("profiles").select("id,role,student_code").eq("id",data.user.id).maybeSingle();
        if(!existing){
          const meta=data.user.user_metadata||{};
          await supabase.from("profiles").insert({
            id:data.user.id,
            full_name:String(meta.full_name||data.user.email?.split("@")[0]||"นักเรียน"),
            role:"student",
            student_code:String(meta.student_code||"")||null
          });
        }
      }
      toast("เข้าสู่ระบบสำเร็จ","ยินดีต้อนรับกลับ","success");
    }
    setBusy(false);
  }

  async function signup(e:React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    if(password.length<6){setError("รหัสผ่านควรมีอย่างน้อย 6 ตัวอักษร");setBusy(false);return;}
    const {data,error}=await supabase.auth.signUp({
      email,password,
      options:{data:{full_name:fullName,student_code:studentCode}}
    });
    if(error){setError(errText(error));setBusy(false);return;}

    // Backup for projects that do not require email confirmation.
    if(data.session && data.user){
      await supabase.from("profiles").upsert({
        id:data.user.id,full_name:fullName,role:"student",student_code:studentCode
      },{onConflict:"id"});
    }

    if(data.session){
      toast("สมัครเรียบร้อย","กำลังพาเข้าสู่ระบบ","success");
    }else{
      toast("สมัครเรียบร้อย","กรุณาเปิดอีเมลเพื่อยืนยันบัญชีก่อน Login","info");
      setMode("login");
    }
    setBusy(false);
  }

  return <div className="login-page">
    <form className="login-card" onSubmit={mode==="login"?login:signup}>
      <div className="logo-mark">CH</div>
      <h1>Classroom Hub</h1>
      <p className="muted">ระบบสื่อการสอน ส่งงาน และติดตามงานนักเรียน</p>

      <div className="auth-tabs">
        <button type="button" className={mode==="login"?"active":""} onClick={()=>{setMode("login");setError("")}}>เข้าสู่ระบบ</button>
        <button type="button" className={mode==="signup"?"active":""} onClick={()=>{setMode("signup");setError("")}}>นักเรียนสมัครใหม่</button>
      </div>

      {error && <div className="error">{error}</div>}

      {mode==="signup"&&<>
        <label className="field"><span>ชื่อ-นามสกุล</span><input value={fullName} onChange={e=>setFullName(e.target.value)} required/></label>
        <label className="field"><span>รหัสนักเรียน</span><input value={studentCode} onChange={e=>setStudentCode(e.target.value)} required/></label>
      </>}

      <label className="field"><span>Email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label>
      <label className="field"><span>Password</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete={mode==="login"?"current-password":"new-password"}/></label>

      <button className="btn primary wide" disabled={busy}>
        {busy?"กำลังดำเนินการ...":mode==="login"?"เข้าสู่ระบบ":"สมัครบัญชีนักเรียน"}
      </button>
      <div className="hint">{mode==="login"?"ครูและนักเรียนใช้ Email + Password เดียวกัน":"การสมัครจากหน้านี้จะสร้างบัญชีเป็นนักเรียนเท่านั้น"}</div>
    </form>
  </div>;
}

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { errText } from "../lib/utils";
import { useToast } from "../context/ToastContext";

export default function LoginPage() {
  const [mode,setMode]=useState<"login"|"signup">("login");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [fullName,setFullName] = useState("");
  const [nickname,setNickname] = useState("");
  const [studentCode,setStudentCode] = useState("");
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);

  const {profile,loading,refreshProfile} = useAuth();
  const {toast}=useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && profile) {
      navigate(profile.role==="teacher"?"/teacher":"/student",{replace:true});
    }
  }, [profile,loading,navigate]);

  async function ensureProfile(user:any) {
    const {data:existing,error:readError}=await supabase
      .from("profiles")
      .select("id,full_name,nickname,role,student_code")
      .eq("id",user.id)
      .maybeSingle();

    if(readError) throw readError;
    if(existing) return existing;

    const meta=user.user_metadata||{};
    const payload={
      id:user.id,
      full_name:String(meta.full_name||user.email?.split("@")[0]||"นักเรียน"),
      nickname:String(meta.nickname||"")||null,
      role:"student" as const,
      student_code:String(meta.student_code||"")||null
    };

    const {data:created,error:createError}=await supabase
      .from("profiles")
      .insert(payload)
      .select("id,full_name,nickname,role,student_code")
      .single();

    if(createError) throw createError;
    return created;
  }

  async function login(e:React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const {data,error} = await supabase.auth.signInWithPassword({email,password});
      if (error || !data.user) throw error || new Error("เข้าสู่ระบบไม่สำเร็จ");

      const userProfile = await ensureProfile(data.user);
      await refreshProfile();

      toast("เข้าสู่ระบบสำเร็จ","กำลังเข้าสู่หน้าหลัก","success");
      navigate(userProfile.role==="teacher"?"/teacher":"/student",{replace:true});
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function signup(e:React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      if(password.length<8) throw new Error("รหัสผ่านควรมีอย่างน้อย 8 ตัวอักษร");

      const {data,error}=await supabase.auth.signUp({
        email,
        password,
        options:{
          data:{
            full_name:fullName.trim(),
            nickname:nickname.trim(),
            student_code:studentCode.trim()
          }
        }
      });

      if(error) throw error;

      if(data.session && data.user){
        const userProfile=await ensureProfile(data.user);
        await refreshProfile();
        toast("สมัครเรียบร้อย","เข้าสู่ระบบให้แล้ว","success");
        navigate(userProfile.role==="teacher"?"/teacher":"/student",{replace:true});
      }else{
        toast("สมัครเรียบร้อย","กรุณายืนยัน Email ก่อน แล้วกลับมาเข้าสู่ระบบ","info");
        setMode("login");
      }
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
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
        <label className="field"><span>ชื่อเล่น</span><input value={nickname} onChange={e=>setNickname(e.target.value)} placeholder="เช่น บอล" required/></label>
        <label className="field"><span>รหัสนักเรียน</span><input value={studentCode} onChange={e=>setStudentCode(e.target.value)} required/></label>
      </>}

      <label className="field"><span>Email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label>
      <label className="field"><span>Password</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete={mode==="login"?"current-password":"new-password"}/></label>

      <button className="btn primary wide" disabled={busy}>
        {busy?"กำลังดำเนินการ...":mode==="login"?"เข้าสู่ระบบ":"สมัครบัญชีนักเรียน"}
      </button>

      {mode==="login"&&<div className="auth-help"><Link to="/forgot-password">ลืมรหัสผ่าน?</Link></div>}

      <div className="hint">
        {mode==="login"
          ?"ครูและนักเรียนใช้ Email + Password เดียวกัน"
          :"สมัครจากหน้านี้จะเป็นบัญชีนักเรียน"}
      </div>
    </form>
  </div>;
}

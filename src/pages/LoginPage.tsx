import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { errText } from "../lib/utils";

export default function LoginPage() {
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const {profile,loading} = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && profile) navigate(profile.role==="teacher"?"/teacher":"/student",{replace:true});
  }, [profile,loading,navigate]);

  async function login(e:React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const {error} = await supabase.auth.signInWithPassword({email,password});
    if (error) setError(errText(error));
    setBusy(false);
  }

  return <div className="login-page">
    <form className="login-card" onSubmit={login}>
      <div className="logo-mark">CH</div>
      <h1>Classroom Hub</h1>
      <p className="muted">ระบบสื่อการสอน ส่งงาน และติดตามงานนักเรียน</p>
      {error && <div className="error">{error}</div>}
      <label className="field">
        <span>Email</span>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/>
      </label>
      <label className="field">
        <span>Password</span>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/>
      </label>
      <button className="btn primary wide" disabled={busy}>{busy?"กำลังเข้าสู่ระบบ...":"เข้าสู่ระบบ"}</button>
      <div className="hint">บัญชีผู้ใช้สร้างจาก Supabase Authentication และต้องมีข้อมูลในตาราง <code>profiles</code></div>
    </form>
  </div>;
}

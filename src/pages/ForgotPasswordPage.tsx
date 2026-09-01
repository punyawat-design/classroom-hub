import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { errText } from "../lib/utils";

export default function ForgotPasswordPage(){
  const [email,setEmail]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setBusy(true);setError("");setMessage("");
    const redirectTo=`${window.location.origin}/reset-password`;
    const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo});
    setBusy(false);
    if(error)setError(errText(error));
    else setMessage("ส่งลิงก์ตั้งรหัสผ่านใหม่แล้ว กรุณาตรวจ Email ของคุณ");
  }

  return <div className="login-page">
    <form className="login-card" onSubmit={submit}>
      <div className="logo-mark">CH</div>
      <h1>ลืมรหัสผ่าน</h1>
      <p className="muted">กรอก Email ที่ใช้สมัคร ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้</p>
      {error&&<div className="error">{error}</div>}
      {message&&<div className="success">{message}</div>}
      <label className="field"><span>Email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
      <button className="btn primary wide" disabled={busy}>{busy?"กำลังส่ง...":"ส่งลิงก์ตั้งรหัสผ่านใหม่"}</button>
      <div className="auth-help"><Link to="/login">← กลับหน้าเข้าสู่ระบบ</Link></div>
    </form>
  </div>;
}

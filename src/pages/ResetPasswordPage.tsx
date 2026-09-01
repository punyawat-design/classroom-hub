import { useEffect,useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { errText } from "../lib/utils";

export default function ResetPasswordPage(){
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const navigate=useNavigate();

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setReady(!!data.session));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event==="PASSWORD_RECOVERY"||session)setReady(true);
    });
    return ()=>subscription.unsubscribe();
  },[]);

  async function submit(e:React.FormEvent){
    e.preventDefault();setError("");
    if(password.length<8){setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");return;}
    if(password!==confirmPassword){setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");return;}
    setBusy(true);
    const {error}=await supabase.auth.updateUser({password});
    setBusy(false);
    if(error){setError(errText(error));return;}
    await supabase.auth.signOut();
    navigate("/login",{replace:true});
  }

  return <div className="login-page">
    <form className="login-card" onSubmit={submit}>
      <div className="logo-mark">CH</div>
      <h1>ตั้งรหัสผ่านใหม่</h1>
      {!ready&&<div className="notice">กำลังตรวจสอบลิงก์กู้รหัสผ่าน...</div>}
      {error&&<div className="error">{error}</div>}
      <label className="field"><span>รหัสผ่านใหม่</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required disabled={!ready}/></label>
      <label className="field"><span>ยืนยันรหัสผ่านใหม่</span><input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required disabled={!ready}/></label>
      <button className="btn primary wide" disabled={!ready||busy}>{busy?"กำลังบันทึก...":"บันทึกรหัสผ่านใหม่"}</button>
    </form>
  </div>;
}

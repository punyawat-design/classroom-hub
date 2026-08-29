import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import {
  LayoutDashboard, BookOpen, Users, ClipboardList, Grid3X3,
  GraduationCap, Megaphone, Files, LogOut, CheckSquare
} from "lucide-react";

const teacherNav = [
  ["/teacher", "แดชบอร์ด", LayoutDashboard],
  ["/teacher/classrooms", "ห้องเรียน", Users],
  ["/teacher/courses", "รายวิชา", BookOpen],
  ["/teacher/materials", "สื่อการสอน", Files],
  ["/teacher/assignments", "งาน", ClipboardList],
  ["/teacher/tracking", "ติดตามการส่งงาน", CheckSquare],
  ["/teacher/matrix", "ภาพรวมงานค้าง", Grid3X3],
  ["/teacher/grading", "ตรวจงาน", GraduationCap],
  ["/teacher/announcements", "ประกาศ", Megaphone],
] as const;

const studentNav = [
  ["/student", "หน้าหลัก", LayoutDashboard],
  ["/student/courses", "รายวิชาและสื่อ", BookOpen],
  ["/student/assignments", "งานของฉัน", ClipboardList],
  ["/student/grades", "คะแนน", GraduationCap],
] as const;

export default function AppLayout() {
  const {profile} = useAuth();
  const navigate = useNavigate();
  const nav = profile?.role==="teacher" ? teacherNav : studentNav;

  async function logout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand">Classroom Hub</div>
      <div className="user-box">
        <b>{profile?.full_name}</b>
        <span>{profile?.role==="teacher"?"ครูผู้สอน":`นักเรียน${profile?.student_code?` • ${profile.student_code}`:""}`}</span>
      </div>
      <nav className="nav">
        {nav.map(([to,label,Icon])=>
          <NavLink key={to} to={to} end={to==="/teacher"||to==="/student"} className={({isActive})=>isActive?"active":""}>
            <Icon size={18}/><span>{label}</span>
          </NavLink>
        )}
      </nav>
      <button className="sidebar-logout" onClick={logout}><LogOut size={18}/>ออกจากระบบ</button>
    </aside>
    <main className="main"><Outlet/></main>
  </div>;
}

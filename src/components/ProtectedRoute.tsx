import { Navigate, Outlet } from "react-router-dom";
import { useAuth, Role } from "../context/AuthContext";

export default function ProtectedRoute({role}:{role?:Role}) {
  const {user,profile,loading} = useAuth();
  if (loading) return <div className="center-page">กำลังตรวจสอบบัญชี...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <div className="center-page"><div className="error">พบ Auth account แต่ยังไม่มีข้อมูลในตาราง profiles</div></div>;
  if (role && profile.role !== role) return <Navigate to={profile.role==="teacher"?"/teacher":"/student"} replace />;
  return <Outlet />;
}

import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AdventureLeaderboardPage from "./pages/AdventureLeaderboardPage";

import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import ClassroomsPage from "./pages/teacher/ClassroomsPage";
import ImportStudentsPage from "./pages/teacher/ImportStudentsPage";
import CoursesPage from "./pages/teacher/CoursesPage";
import MaterialsPage from "./pages/teacher/MaterialsPage";
import TeacherCourseMaterialsPage from "./pages/teacher/TeacherCourseMaterialsPage";
import AssignmentsPage from "./pages/teacher/AssignmentsPage";
import CreateAssignmentPage from "./pages/teacher/CreateAssignmentPage";
import TeacherCourseAssignmentsPage from "./pages/teacher/TeacherCourseAssignmentsPage";
import TrackingPage from "./pages/teacher/TrackingPage";
import MatrixPage from "./pages/teacher/MatrixPage";
import GradingPage from "./pages/teacher/GradingPage";
import TeacherCourseGradingPage from "./pages/teacher/TeacherCourseGradingPage";
import AnnouncementsPage from "./pages/teacher/AnnouncementsPage";
import StorageUsagePage from "./pages/teacher/StorageUsagePage";

import StudentDashboard from "./pages/student/StudentDashboard";
import JoinCoursePage from "./pages/student/JoinCoursePage";
import StudentCoursesPage from "./pages/student/StudentCoursesPage";
import StudentCourseDetailPage from "./pages/student/StudentCourseDetailPage";
import StudentAssignmentsPage from "./pages/student/StudentAssignmentsPage";
import StudentCourseAssignmentsPage from "./pages/student/StudentCourseAssignmentsPage";
import StudentAssignmentDetail from "./pages/student/StudentAssignmentDetail";
import StudentGradesPage from "./pages/student/StudentGradesPage";

export default function App(){
  return <Routes>
    <Route path="/login" element={<LoginPage/>}/>
    <Route path="/forgot-password" element={<ForgotPasswordPage/>}/>
    <Route path="/reset-password" element={<ResetPasswordPage/>}/>

    <Route element={<ProtectedRoute role="teacher"/>}>
      <Route element={<AppLayout/>}>
        <Route path="/teacher" element={<TeacherDashboard/>}/>
        <Route path="/teacher/classrooms" element={<ClassroomsPage/>}/>
        <Route path="/teacher/import-students" element={<ImportStudentsPage/>}/>
        <Route path="/teacher/courses" element={<CoursesPage/>}/>
        <Route path="/teacher/materials" element={<MaterialsPage/>}/>
        <Route path="/teacher/materials/course/:courseId" element={<TeacherCourseMaterialsPage/>}/>
        <Route path="/teacher/assignments" element={<AssignmentsPage/>}/>
        <Route path="/teacher/assignments/new" element={<CreateAssignmentPage/>}/>
        <Route path="/teacher/assignments/course/:courseId" element={<TeacherCourseAssignmentsPage/>}/>
        <Route path="/teacher/tracking" element={<TrackingPage/>}/>
        <Route path="/teacher/matrix" element={<MatrixPage/>}/>
        <Route path="/teacher/grading" element={<GradingPage/>}/>
        <Route path="/teacher/grading/course/:courseId" element={<TeacherCourseGradingPage/>}/>
        <Route path="/teacher/announcements" element={<AnnouncementsPage/>}/>
        <Route path="/teacher/storage" element={<StorageUsagePage/>}/>
        <Route path="/teacher/adventure" element={<AdventureLeaderboardPage/>}/>
      </Route>
    </Route>

    <Route element={<ProtectedRoute role="student"/>}>
      <Route element={<AppLayout/>}>
        <Route path="/student" element={<StudentDashboard/>}/>
        <Route path="/student/join-course" element={<JoinCoursePage/>}/>
        <Route path="/student/courses" element={<StudentCoursesPage/>}/>
        <Route path="/student/courses/:courseId" element={<StudentCourseDetailPage/>}/>
        <Route path="/student/assignments" element={<StudentAssignmentsPage/>}/>
        <Route path="/student/assignments/course/:courseId" element={<StudentCourseAssignmentsPage/>}/>
        <Route path="/student/assignments/:id" element={<StudentAssignmentDetail/>}/>
        <Route path="/student/grades" element={<StudentGradesPage/>}/>
        <Route path="/student/adventure" element={<AdventureLeaderboardPage/>}/>
      </Route>
    </Route>

    <Route path="/" element={<Navigate to="/login" replace/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
}

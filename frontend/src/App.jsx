import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import ProtectedRoute from './components/ProtectedRoute'

import LandingPage from './pages/LandingPage'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'

import StudentLayout from './pages/student/StudentLayout'
import GradesFeedback from './pages/student/GradesFeedback'
import OnlineExams from './pages/student/OnlineExams'
import ProgressTracking from './pages/student/ProgressTracking'
import StudyPlanner from './pages/student/StudyPlanner'
import AIQuizzes from './pages/student/AIQuizzes'
import StudentAssignments from './pages/student/Assignments'
import PhysicalExams from './pages/student/PhysicalExams'

import TeacherLayout from './pages/teacher/TeacherLayout'
import Dashboard from './pages/teacher/Dashboard'
import GradeManagement from './pages/teacher/GradeManagement'
import ClassAnalytics from './pages/teacher/ClassAnalytics'
import FlaggedAnswers from './pages/teacher/FlaggedAnswers'
import TeacherAssignments from './pages/teacher/Assignments'

function RootRedirect() {
  const { user } = useAuth()
  if (!user) return <LandingPage />
  if (user.role === 'teacher') return <Navigate to="/teacher/dashboard" replace />
  return <Navigate to="/student/grades" replace />
}

export default function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />

            <Route path="/student" element={<ProtectedRoute role="student"><StudentLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="grades" replace />} />
              <Route path="grades" element={<GradesFeedback />} />
              <Route path="online-exams" element={<OnlineExams />} />
              <Route path="assignments" element={<StudentAssignments />} />
              <Route path="progress" element={<ProgressTracking />} />
              <Route path="planner" element={<StudyPlanner />} />
              <Route path="quizzes" element={<AIQuizzes />} />
              <Route path="physical-exams" element={<PhysicalExams />} />
            </Route>

            <Route path="/teacher" element={<ProtectedRoute role="teacher"><TeacherLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="grades" element={<GradeManagement />} />
              <Route path="assignments" element={<TeacherAssignments />} />
              <Route path="analytics" element={<ClassAnalytics />} />
              <Route path="flagged" element={<FlaggedAnswers />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </NotificationProvider>
  )
}

import { Navigate, Route, Routes } from 'react-router-dom';
import { Landing } from './features/landing/Landing';
import { ChatPage } from './features/chat/ChatPage';
import { SimDashboard } from './features/simulator/SimDashboard';
import { KycRunPage } from './features/simulator/kyc/KycRunPage';
import { KycRunBootstrap } from './features/simulator/kyc/KycRunBootstrap';
import { HrDashboard } from './features/hr/HrDashboard';
import { NewcomerDetail } from './features/hr/NewcomerDetail';
import { ProfilePage } from './features/game/ProfilePage';
import { SkillsHub } from './features/skills/SkillsHub';
import { EmployeeSkillsPage } from './features/skills/EmployeeSkillsPage';
import { SignUpPage } from './features/auth/SignUpPage';
import { SignInPage } from './features/auth/SignInPage';
import { CallbackPage } from './features/auth/CallbackPage';
import { EmployeeDashboard } from './features/workspace/EmployeeDashboard';
import { InternDashboard } from './features/workspace/InternDashboard';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/auth/callback" element={<CallbackPage />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/simulator" element={<SimDashboard />} />
      <Route path="/simulator/kyc" element={<KycRunBootstrap />} />
      <Route path="/simulator/kyc/:runId" element={<KycRunPage />} />
      <Route path="/intern" element={<InternDashboard />} />
      <Route path="/employee" element={<EmployeeDashboard />} />
      <Route path="/hr" element={<HrDashboard />} />
      <Route path="/hr/newcomers/:id" element={<NewcomerDetail />} />
      <Route path="/me" element={<ProfilePage />} />
      <Route path="/skills" element={<SkillsHub />} />
      <Route path="/skills/employees/:id" element={<EmployeeSkillsPage />} />
    </Routes>
  );
}

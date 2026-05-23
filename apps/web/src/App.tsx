import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Landing } from './features/landing/Landing';
import { ChatPage } from './features/chat/ChatPage';
import { SimDashboard } from './features/simulator/SimDashboard';
import { KycRunPage } from './features/simulator/kyc/KycRunPage';
import { KycRunBootstrap } from './features/simulator/kyc/KycRunBootstrap';
import { OpenAccountRunPage } from './features/simulator/open-account/OpenAccountRunPage';
import { OpenAccountRunBootstrap } from './features/simulator/open-account/OpenAccountRunBootstrap';
import { DepositRunPage } from './features/simulator/deposit/DepositRunPage';
import { DepositRunBootstrap } from './features/simulator/deposit/DepositRunBootstrap';
import { TransferRunPage } from './features/simulator/transfer/TransferRunPage';
import { TransferRunBootstrap } from './features/simulator/transfer/TransferRunBootstrap';
import { HrDashboard } from './features/hr/HrDashboard';
import { NewcomerDetail } from './features/hr/NewcomerDetail';
import { ProfilePage } from './features/game/ProfilePage';
import { SignUpPage } from './features/auth/SignUpPage';
import { SignInPage } from './features/auth/SignInPage';
import { CallbackPage } from './features/auth/CallbackPage';
import { EmployeeDashboard } from './features/workspace/EmployeeDashboard';
import { InternDashboard } from './features/workspace/InternDashboard';

const QuestsPage = lazy(() => import('./features/game/QuestsPage'));
const MessagesPage = lazy(() => import('./features/messages/MessagesPage'));
const ResourcesPage = lazy(() => import('./features/resources/ResourcesPage'));

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
      <Route path="/simulator/open-account" element={<OpenAccountRunBootstrap />} />
      <Route path="/simulator/open-account/:runId" element={<OpenAccountRunPage />} />
      <Route path="/simulator/deposit" element={<DepositRunBootstrap />} />
      <Route path="/simulator/deposit/:runId" element={<DepositRunPage />} />
      <Route path="/simulator/transfer" element={<TransferRunBootstrap />} />
      <Route path="/simulator/transfer/:runId" element={<TransferRunPage />} />
      <Route path="/intern" element={<InternDashboard />} />
      <Route path="/employee" element={<EmployeeDashboard />} />
      <Route path="/hr" element={<HrDashboard />} />
      <Route path="/hr/newcomers/:id" element={<NewcomerDetail />} />
      <Route path="/me" element={<ProfilePage />} />
      <Route
        path="/quests"
        element={
          <Suspense fallback={null}>
            <QuestsPage />
          </Suspense>
        }
      />
      <Route
        path="/messages"
        element={
          <Suspense fallback={null}>
            <MessagesPage />
          </Suspense>
        }
      />
      <Route
        path="/resources"
        element={
          <Suspense fallback={null}>
            <ResourcesPage />
          </Suspense>
        }
      />
    </Routes>
  );
}

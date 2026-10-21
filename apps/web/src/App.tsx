import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { useAuth, ProtectedRoute, home } from "./lib/auth";
import { Shell } from "./components/Shell";
import { EmptyState, LoadingState } from "./components/ui";
const EmployerProfilePage = lazy(() =>
  import("./pages/EmployerProfile").then((module) => ({
    default: module.EmployerProfilePage,
  })),
);
const CandidateDashboard = lazy(() =>
  import("./pages/CandidateDashboard").then((module) => ({
    default: module.CandidateDashboard,
  })),
);
const JobSearchPage = lazy(() =>
  import("./pages/CandidateJobs").then((module) => ({
    default: module.JobSearchPage,
  })),
);
const CandidateJobPage = lazy(() =>
  import("./pages/CandidateJobs").then((module) => ({
    default: module.CandidateJobPage,
  })),
);
const SavedJobsPage = lazy(() =>
  import("./pages/CandidateJobs").then((module) => ({
    default: module.SavedJobsPage,
  })),
);
const ApplicationsPage = lazy(() =>
  import("./pages/Applications").then((module) => ({
    default: module.ApplicationsPage,
  })),
);
const CandidateApplicationPage = lazy(() =>
  import("./pages/Applications").then((module) => ({
    default: module.CandidateApplicationPage,
  })),
);
const ProfilePage = lazy(() =>
  import("./pages/Account").then((module) => ({ default: module.ProfilePage })),
);
const ResumePage = lazy(() =>
  import("./pages/Account").then((module) => ({ default: module.ResumePage })),
);
const NotificationsPage = lazy(() =>
  import("./pages/Account").then((module) => ({
    default: module.NotificationsPage,
  })),
);
const CompaniesPage = lazy(() =>
  import("./pages/Companies").then((module) => ({
    default: module.CompaniesPage,
  })),
);
const CompanyPage = lazy(() =>
  import("./pages/Companies").then((module) => ({
    default: module.CompanyPage,
  })),
);
const JobEditorPage = lazy(() =>
  import("./pages/JobEditor").then((module) => ({
    default: module.JobEditorPage,
  })),
);
const EmployerDashboard = lazy(() =>
  import("./pages/EmployerJobs").then((module) => ({
    default: module.EmployerDashboard,
  })),
);
const EmployerJobsPage = lazy(() =>
  import("./pages/EmployerJobs").then((module) => ({
    default: module.EmployerJobsPage,
  })),
);
const EmployerJobPage = lazy(() =>
  import("./pages/EmployerJobs").then((module) => ({
    default: module.EmployerJobPage,
  })),
);
const ApplicantsPage = lazy(() =>
  import("./pages/Hiring").then((module) => ({
    default: module.ApplicantsPage,
  })),
);
const EmployerApplicationPage = lazy(() =>
  import("./pages/Hiring").then((module) => ({
    default: module.EmployerApplicationPage,
  })),
);
const FeedbackObligationsPage = lazy(() =>
  import("./pages/Hiring").then((module) => ({
    default: module.FeedbackObligationsPage,
  })),
);
const AuthPage = lazy(() =>
  import("./pages/AuthPage").then((module) => ({ default: module.AuthPage })),
);
function Start() {
  const auth = useAuth();
  return auth.loading ? (
    <LoadingState />
  ) : (
    <Navigate to={auth.user ? home(auth.user.role) : "/login"} replace />
  );
}
export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingState />}>
        <Routes>
          <Route path="/" element={<Start />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage register />} />
          <Route element={<ProtectedRoute role="candidate" />}>
            <Route path="/candidate" element={<Shell />}>
              <Route index element={<CandidateDashboard />} />
              <Route path="jobs" element={<JobSearchPage />} />
              <Route path="jobs/:jobId" element={<CandidateJobPage />} />
              <Route path="saved-jobs" element={<SavedJobsPage />} />
              <Route path="applications" element={<ApplicationsPage />} />
              <Route
                path="applications/:applicationId"
                element={<CandidateApplicationPage />}
              />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="resume" element={<ResumePage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route
                path="*"
                element={
                  <EmptyState title="Page not found">
                    <Link to="/">Return to your workspace</Link>
                  </EmptyState>
                }
              />
            </Route>
          </Route>
          <Route element={<ProtectedRoute role="employer" />}>
            <Route path="/employer" element={<Shell />}>
              <Route index element={<EmployerDashboard />} />
              <Route path="profile" element={<EmployerProfilePage />} />
              <Route path="companies" element={<CompaniesPage />} />
              <Route path="companies/:companyId" element={<CompanyPage />} />
              <Route path="jobs" element={<EmployerJobsPage />} />
              <Route path="jobs/new" element={<JobEditorPage />} />
              <Route path="jobs/:jobId" element={<EmployerJobPage />} />
              <Route path="jobs/:jobId/edit" element={<JobEditorPage />} />
              <Route
                path="jobs/:jobId/applications"
                element={<ApplicantsPage />}
              />
              <Route
                path="applications/:applicationId"
                element={<EmployerApplicationPage />}
              />
              <Route
                path="feedback-obligations"
                element={<FeedbackObligationsPage />}
              />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route
                path="*"
                element={
                  <EmptyState title="Page not found">
                    <Link to="/">Return to your workspace</Link>
                  </EmptyState>
                }
              />
            </Route>
          </Route>
          <Route
            path="*"
            element={
              <EmptyState title="Page not found">
                <a href="/">Return to your workspace</a>
              </EmptyState>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

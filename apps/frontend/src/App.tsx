import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

// Auth
import AuthGuard from "./components/Auth/AuthGuard";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

// Lazy loaded components
const ChatLayout = lazy(() => import("./components/Layout/ChatLayout"));
const ChatRoomPage = lazy(() => import("./pages/ChatRoomPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SecuritySettingsPage = lazy(() => import("./pages/SecuritySettingsPage"));
const CreateRoomPage = lazy(() => import("./pages/CreateRoomPage"));
const BrowseRoomsPage = lazy(() => import("./pages/BrowseRoomsPage"));

// Loading component
const Loading = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
  </div>
);

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes */}
        <Route element={<AuthGuard />}>
          <Route element={<ChatLayout />}>
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="/chat" element={<ChatRoomPage />} />
            <Route path="/chat/create" element={<CreateRoomPage />} />
            <Route path="/chat/browse" element={<BrowseRoomsPage />} />
            <Route path="/chat/:roomId" element={<ChatRoomPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route
              path="/settings/security"
              element={<SecuritySettingsPage />}
            />
          </Route>
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;

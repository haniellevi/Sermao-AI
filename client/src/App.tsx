
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/lib/auth";
import { Navbar } from "@/components/layout/navbar";

// Pages
import { WelcomePage } from "@/pages/welcome";
import { LoginPage } from "@/pages/login";
import { RegisterPage } from "@/pages/register";
import { ResetPasswordPage } from "@/pages/reset-password";
import { DashboardPage } from "@/pages/dashboard";
import { GenerateSermonPage } from "@/pages/generate-sermon";
import { SermonResultPage } from "@/pages/sermon-result";
import { HistoryPage } from "@/pages/history";
import { EditSermonPage } from "@/pages/edit-sermon";
import { MyDnaPage } from "@/pages/my-dna";
import { NotFoundPage } from "@/pages/not-found";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <Navbar />
            <Routes>
              <Route path="/" element={<WelcomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/generate-sermon"
                element={
                  <ProtectedRoute>
                    <GenerateSermonPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sermon-result/:id"
                element={
                  <ProtectedRoute>
                    <SermonResultPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/history"
                element={
                  <ProtectedRoute>
                    <HistoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/edit-sermon/:id"
                element={
                  <ProtectedRoute>
                    <EditSermonPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-dna"
                element={
                  <ProtectedRoute>
                    <MyDnaPage />
                  </ProtectedRoute>
                }
              />
              
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </div>
          <Toaster />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";

// Pages
import WelcomePage from "@/pages/welcome";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ResetPasswordPage from "@/pages/reset-password";
import DashboardPage from "@/pages/dashboard";
import MyDNAPage from "@/pages/my-dna";
import GenerateSermonPage from "@/pages/generate-sermon";
import SermonResultPage from "@/pages/sermon-result";
import HistoryPage from "@/pages/history";
import EditSermonPage from "@/pages/edit-sermon";
import DocumentLibraryPage from "@/pages/document-library";
import AdminDashboardPage from "@/pages/admin-dashboard";
import AdminBulkIndexPage from "@/pages/admin-bulk-index";
import AdminReportsPage from "@/pages/admin-reports";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={WelcomePage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/my-dna" component={MyDNAPage} />
      <Route path="/generate-sermon" component={GenerateSermonPage} />
      <Route path="/sermon-result/:id" component={SermonResultPage} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/edit-sermon/:id" component={EditSermonPage} />
      <Route path="/document-library" component={DocumentLibraryPage} />
      <Route path="/admin" component={AdminDashboardPage} />
      <Route path="/admin/bulk-index" component={AdminBulkIndexPage} />
      <Route path="/admin/reports" component={AdminReportsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
import { useAuthContext } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect } from "react";

export function useAuth() {
  return useAuthContext();
}

export function useRequireAuth() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  return { user, isLoading };
}

// Protected route wrapper hook
export function useProtectedRoute() {
  const { user, isLoading } = useRequireAuth();
  
  if (isLoading) {
    return { user: null, isLoading: true, isAuthenticated: false };
  }
  
  return { user, isLoading: false, isAuthenticated: !!user };
}

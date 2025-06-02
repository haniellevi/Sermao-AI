
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';

export function useAuth() {
  const { user, isLoaded } = useUser();
  const { signOut, getToken } = useClerkAuth();

  return {
    user: user ? {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress || '',
      name: user.fullName || user.firstName || '',
    } : null,
    isLoading: !isLoaded,
    signOut,
    getToken,
  };
}

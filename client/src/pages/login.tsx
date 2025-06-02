import { SignIn } from '@clerk/clerk-react';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="max-w-md w-full">
        <SignIn 
          redirectUrl="/dashboard"
          signUpUrl="/register"
        />
      </div>
    </div>
  );
}
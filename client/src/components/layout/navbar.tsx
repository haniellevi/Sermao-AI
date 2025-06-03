import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useLocation } from "wouter";
import { Scroll, Dna, Plus, User, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function Navbar() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  if (!user) {
    return null;
  }

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Title */}
          <Link href="/dashboard">
            <div className="flex items-center cursor-pointer">
              <div className="bg-primary rounded-lg p-2 mr-3">
                <Scroll className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Gerador de Sermões</h1>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-4">
            <Link href="/my-dna">
              <Button variant="ghost" className="text-gray-600 hover:text-gray-900 hover:bg-gray-100">
                <Dna className="w-4 h-4 mr-2" />
                Meu DNA
              </Button>
            </Link>

            <Link href="/generate-sermon">
              <Button variant="ghost" className="text-gray-600 hover:text-gray-900 hover:bg-gray-100">
                <Plus className="w-4 h-4 mr-2" />
                Novo Sermão
              </Button>
            </Link>

            {/* Profile Dropdown */}
            <DropdownMenu open={isProfileOpen} onOpenChange={setIsProfileOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center text-gray-600 hover:text-gray-900 hover:bg-gray-100">
                  <div className="bg-primary/10 rounded-full w-8 h-8 flex items-center justify-center mr-2">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <span className="hidden sm:inline">{user.name}</span>
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}
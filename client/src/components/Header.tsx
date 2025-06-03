import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthContext } from "@/lib/auth";
import { User, LogOut, Settings, Shield } from "lucide-react";
import { Link } from "wouter";

export default function Header() {
  const { user, logout } = useAuthContext();

  if (!user) return null;

  const handleLogout = () => {
    logout();
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo/Title */}
          <Link href="/dashboard">
            <div className="flex items-center space-x-2 cursor-pointer">
              <div className="bg-primary rounded-lg p-2">
                <span className="text-white font-bold text-lg">SG</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Sermon Generator</span>
            </div>
          </Link>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="flex flex-col space-y-1 leading-none">
                  <p className="font-medium">{user.name}</p>
                  <p className="w-[200px] truncate text-sm text-muted-foreground">
                    {user.email}
                  </p>
                  {user.role === 'admin' && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      <Shield className="w-3 h-3 mr-1" />
                      Admin
                    </span>
                  )}
                </div>
              </div>
              <DropdownMenuSeparator />
              <Link href="/dashboard">
                <DropdownMenuItem className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Dashboard</span>
                </DropdownMenuItem>
              </Link>
              <Link href="/my-dna">
                <DropdownMenuItem className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Meu DNA</span>
                </DropdownMenuItem>
              </Link>
              {user.role === 'admin' && (
                <>
                  <DropdownMenuSeparator />
                  <Link href="/admin">
                    <DropdownMenuItem className="cursor-pointer">
                      <Shield className="mr-2 h-4 w-4" />
                      <span>Painel Admin</span>
                    </DropdownMenuItem>
                  </Link>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="cursor-pointer text-red-600 focus:text-red-600"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
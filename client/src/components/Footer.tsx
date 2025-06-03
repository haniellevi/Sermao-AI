import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthContext } from "@/lib/auth";
import { Link } from "wouter";

export default function Footer() {
  const { user } = useAuthContext();

  if (!user) return null;

  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-8">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          {/* Brand/Copyright */}
          <div className="text-sm text-gray-600">
            <p>&copy; 2025 Sermon Generator. Todos os direitos reservados.</p>
          </div>

          {/* Admin Access - Only for admin users */}
          {user.role === 'admin' && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-3">
                <div className="flex items-center space-x-3">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-blue-900">Área Administrativa</span>
                    <span className="text-xs text-blue-700">Acesso exclusivo para administradores</span>
                  </div>
                  <Link href="/admin">
                    <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100">
                      Acessar Painel
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </footer>
  );
}
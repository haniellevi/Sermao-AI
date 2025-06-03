
#!/usr/bin/env python3
import sqlite3
import sys
import os

def make_user_admin(email):
    """
    Torna um usuário administrador pelo email
    """
    # Encontrar o arquivo do banco de dados
    db_path = None
    possible_paths = [
        "database.sqlite",
        "server/database.sqlite", 
        "../database.sqlite",
        "../../database.sqlite"
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            db_path = path
            break
    
    if not db_path:
        print("❌ Erro: Arquivo do banco de dados não encontrado")
        print("Caminhos verificados:", possible_paths)
        return False
    
    try:
        # Conectar ao banco
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Verificar se o usuário existe
        cursor.execute("SELECT id, name, email, role FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()
        
        if not user:
            print(f"❌ Usuário com email '{email}' não encontrado")
            return False
            
        user_id, name, user_email, current_role = user
        print(f"📧 Usuário encontrado: {name} ({user_email})")
        print(f"🔒 Role atual: {current_role}")
        
        # Atualizar para admin
        cursor.execute("UPDATE users SET role = 'admin' WHERE id = ?", (user_id,))
        conn.commit()
        
        # Verificar a atualização
        cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
        new_role = cursor.fetchone()[0]
        
        print(f"✅ Role atualizado com sucesso para: {new_role}")
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Erro no banco de dados: {e}")
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python make_admin_user.py <email>")
        print("Exemplo: python make_admin_user.py usuario@email.com")
        sys.exit(1)
    
    email = sys.argv[1]
    print(f"🔧 Tornando o usuário '{email}' administrador...")
    
    if make_user_admin(email):
        print("🎉 Processo concluído com sucesso!")
        print("🔄 Faça logout e login novamente para as mudanças terem efeito")
    else:
        print("💥 Falha ao tornar o usuário administrador")
        sys.exit(1)

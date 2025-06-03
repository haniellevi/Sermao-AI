
import psycopg2
import os
from urllib.parse import urlparse

# Parse DATABASE_URL
database_url = os.getenv('DATABASE_URL', 'postgresql://postgres:Texugo12!@db.jflnhsijcwjbtfduefha.supabase.co:5432/postgres')
url = urlparse(database_url)

# Connect to database
conn = psycopg2.connect(
    host=url.hostname,
    port=url.port,
    user=url.username,
    password=url.password,
    database=url.path[1:]  # Remove leading '/'
)

cursor = conn.cursor()

# Get user email to make admin
user_email = input("Digite o email do usuário para tornar administrador: ")

# Update user role to admin
cursor.execute(
    "UPDATE users SET role = 'admin' WHERE email = %s",
    (user_email,)
)

if cursor.rowcount > 0:
    print(f"Usuário {user_email} agora é administrador!")
else:
    print(f"Usuário {user_email} não encontrado.")

conn.commit()
cursor.close()
conn.close()

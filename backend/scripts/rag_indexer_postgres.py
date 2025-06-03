import os
import sys
import google.generativeai as genai
from sqlalchemy import create_engine, text, Column, Integer, String, Text, ARRAY, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from typing import List, Dict
import PyPDF2
from docx import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
import time
import json

# Configure Google Generative AI
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

# Database setup
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL não configurada nas variáveis de ambiente.")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class RagChunk(Base):
    __tablename__ = "rag_chunks"
    
    id = Column(Integer, primary_key=True)
    document_id = Column(String(255), nullable=False)
    chunk_text = Column(Text, nullable=False)
    embedding_vector = Column(Text, nullable=False)  # JSON string of float array
    source_url = Column(String(500))
    page_number = Column(Integer)
    user_id = Column(Integer, nullable=False)

def create_rag_table():
    """Cria a tabela rag_chunks se não existir"""
    try:
        with engine.connect() as conn:
            # Instalar extensão pgvector se necessário (para Supabase/PostgreSQL)
            try:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                conn.commit()
                print("Extensão vector habilitada")
            except Exception as e:
                print(f"Aviso: Não foi possível habilitar extensão vector: {e}")
            
            # Criar tabela
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS rag_chunks (
                    id SERIAL PRIMARY KEY,
                    document_id VARCHAR(255) NOT NULL,
                    chunk_text TEXT NOT NULL,
                    embedding_vector TEXT NOT NULL,
                    source_url VARCHAR(500),
                    page_number INTEGER,
                    user_id INTEGER NOT NULL DEFAULT 1,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            """))
            conn.commit()
            print("Tabela rag_chunks criada com sucesso")
            
    except Exception as e:
        print(f"Erro ao criar tabela: {e}")
        raise

def load_document(file_path: str) -> str:
    """Carrega conteúdo de texto de um arquivo"""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Arquivo não encontrado: {file_path}")
    
    file_extension = os.path.splitext(file_path)[1].lower()
    
    try:
        if file_extension == '.txt':
            with open(file_path, 'r', encoding='utf-8') as file:
                return file.read()
                
        elif file_extension == '.pdf':
            text = ""
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
            return text
            
        elif file_extension == '.docx':
            doc = Document(file_path)
            text = ""
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
            return text
            
        else:
            raise ValueError(f"Formato de arquivo não suportado: {file_extension}")
            
    except Exception as e:
        print(f"Erro ao carregar documento {file_path}: {str(e)}")
        return ""

def split_text_into_chunks(text: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> List[str]:
    """Divide texto em fragmentos usando RecursiveCharacterTextSplitter"""
    if not text.strip():
        return []
    
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""]
    )
    
    chunks = text_splitter.split_text(text)
    return chunks

def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """Gera embeddings para uma lista de textos usando Google Generative AI"""
    embeddings = []
    
    for i, text in enumerate(texts):
        if not text.strip():
            continue
            
        try:
            # Rate limiting para evitar problemas de quota
            if i > 0 and i % 10 == 0:
                time.sleep(1)
            
            result = genai.embed_content(
                model="models/text-embedding-004",
                content=text,
                task_type="retrieval_document"
            )
            
            embeddings.append(result['embedding'])
            
        except Exception as e:
            print(f"Erro ao gerar embedding para texto {i}: {str(e)}")
            continue
    
    return embeddings

def index_documents(sources: List[Dict[str, str]], user_id: int = 1) -> bool:
    """Indexa documentos de várias fontes no PostgreSQL"""
    try:
        session = SessionLocal()
        
        # Limpar chunks existentes do usuário
        session.execute(text("DELETE FROM rag_chunks WHERE user_id = :user_id"), {"user_id": user_id})
        session.commit()
        print(f"Chunks existentes do usuário {user_id} removidos")
        
        all_chunks = []
        all_metadatas = []
        
        for source in sources:
            source_type = source.get('type')
            source_path = source.get('path')
            document_id = source.get('document_id', f"doc_{int(time.time())}")
            
            print(f"Processando {source_type}: {source_path}")
            
            # Carregar conteúdo
            if source_type == 'file':
                content = load_document(source_path)
            else:
                print(f"Tipo de fonte desconhecido: {source_type}")
                continue
            
            if not content:
                print(f"Nenhum conteúdo carregado de {source_path}")
                continue
            
            # Dividir em chunks
            chunks = split_text_into_chunks(content)
            print(f"Dividido em {len(chunks)} chunks")
            
            # Preparar chunks e metadados
            for i, chunk in enumerate(chunks):
                if chunk.strip():
                    all_chunks.append(chunk)
                    all_metadatas.append({
                        'document_id': document_id,
                        'source_path': source_path,
                        'page_number': i + 1,
                        'user_id': user_id
                    })
        
        if not all_chunks:
            print("Nenhum chunk para indexar")
            return False
        
        print(f"Gerando embeddings para {len(all_chunks)} chunks...")
        
        # Gerar embeddings em lotes
        batch_size = 50
        total_indexed = 0
        
        for i in range(0, len(all_chunks), batch_size):
            batch_chunks = all_chunks[i:i + batch_size]
            batch_metadatas = all_metadatas[i:i + batch_size]
            
            print(f"Processando lote {i//batch_size + 1}/{(len(all_chunks) + batch_size - 1)//batch_size}")
            
            # Gerar embeddings para este lote
            batch_embeddings = generate_embeddings(batch_chunks)
            
            if len(batch_embeddings) != len(batch_chunks):
                print(f"Aviso: Gerados {len(batch_embeddings)} embeddings para {len(batch_chunks)} chunks")
                batch_chunks = batch_chunks[:len(batch_embeddings)]
                batch_metadatas = batch_metadatas[:len(batch_embeddings)]
            
            # Inserir no banco de dados
            for chunk, embedding, metadata in zip(batch_chunks, batch_embeddings, batch_metadatas):
                try:
                    session.execute(text("""
                        INSERT INTO rag_chunks (document_id, chunk_text, embedding_vector, source_url, page_number, user_id)
                        VALUES (:document_id, :chunk_text, :embedding_vector, :source_url, :page_number, :user_id)
                    """), {
                        'document_id': metadata['document_id'],
                        'chunk_text': chunk,
                        'embedding_vector': json.dumps(embedding),
                        'source_url': metadata['source_path'],
                        'page_number': metadata['page_number'],
                        'user_id': metadata['user_id']
                    })
                    total_indexed += 1
                except Exception as e:
                    print(f"Erro ao inserir chunk: {e}")
                    continue
            
            session.commit()
            print(f"Lote inserido: {len(batch_embeddings)} chunks")
        
        session.close()
        print(f"Indexação concluída com sucesso: {total_indexed} chunks indexados")
        return True
        
    except Exception as e:
        print(f"Erro na indexação de documentos: {str(e)}")
        return False

if __name__ == "__main__":
    print("Iniciando processo de indexação RAG...")
    
    # Verificar se a chave da API do Google está configurada
    if not os.getenv('GEMINI_API_KEY'):
        print("Erro: Variável de ambiente GEMINI_API_KEY não configurada")
        sys.exit(1)
    
    # Criar tabela
    create_rag_table()
    
    # Definir fontes para indexar
    sources = [
        {'type': 'file', 'path': 'backend/data/freebiblecommentary_content.txt', 'document_id': 'freebible_commentary'},
        {'type': 'file', 'path': 'backend/data/bibliotecabiblica_content.txt', 'document_id': 'biblioteca_biblica'},
        {'type': 'file', 'path': 'backend/data/enduringword_content.txt', 'document_id': 'enduring_word'},
    ]
    
    # Criar diretório de dados se não existir
    os.makedirs('backend/data', exist_ok=True)
    
    # Criar arquivos de exemplo se não existirem
    sample_files = [
        ('backend/data/freebiblecommentary_content.txt', 'Comentário Bíblico Free Bible Commentary'),
        ('backend/data/bibliotecabiblica_content.txt', 'Comentário da Biblioteca Bíblica'),
        ('backend/data/enduringword_content.txt', 'Comentário Enduring Word')
    ]
    
    for file_path, title in sample_files:
        if not os.path.exists(file_path):
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(f"{title}\n\n")
                f.write("Este é um conteúdo de exemplo para demonstrar o sistema RAG.\n")
                f.write("Em produção, substitua este conteúdo por comentários bíblicos reais.\n\n")
                f.write("Exemplo de comentário sobre Gênesis 1:1:\n")
                f.write("No princípio criou Deus os céus e a terra. Este versículo estabelece ")
                f.write("a base para toda a teologia bíblica, demonstrando que Deus é o criador ")
                f.write("soberano de todas as coisas. A palavra 'Elohim' no hebraico indica ")
                f.write("a majestade e poder divino.\n")
    
    # Filtrar fontes para incluir apenas arquivos existentes
    existing_sources = []
    for source in sources:
        if source['type'] == 'file':
            if os.path.exists(source['path']):
                existing_sources.append(source)
            else:
                print(f"Arquivo não encontrado: {source['path']}")
    
    if not existing_sources:
        print("Nenhuma fonte válida encontrada. Adicione arquivos de conteúdo em backend/data/")
        sys.exit(1)
    
    # Executar indexação
    success = index_documents(existing_sources, user_id=1)
    
    if success:
        print("Indexação RAG concluída com sucesso!")
    else:
        print("Falha na indexação RAG!")
        sys.exit(1)
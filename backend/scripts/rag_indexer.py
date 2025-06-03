
import os
import sys
import requests
import google.generativeai as genai
import chromadb
from chromadb.config import Settings
from typing import List, Dict, Any
import PyPDF2
from docx import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
import time
from urllib.parse import urlparse

# Configure Google Generative AI
# Make sure to set your GOOGLE_API_KEY environment variable
genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))

def load_document(file_path: str) -> str:
    """
    Load text content from a file (TXT, PDF, DOCX).
    
    Args:
        file_path (str): Path to the file
        
    Returns:
        str: Extracted text content
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
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
            raise ValueError(f"Unsupported file format: {file_extension}")
            
    except Exception as e:
        print(f"Error loading document {file_path}: {str(e)}")
        return ""

def load_web_page(url: str) -> str:
    """
    Load text content from a web page.
    This is a simplified implementation for MVP.
    
    Args:
        url (str): URL of the web page
        
    Returns:
        str: Extracted text content
    """
    try:
        # For MVP, we'll do a simple text extraction
        # In production, you'd want to use BeautifulSoup for better HTML parsing
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        # Simple text extraction (remove HTML tags in a basic way)
        text = response.text
        # This is a very basic HTML tag removal - in production use BeautifulSoup
        import re
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        
        return text.strip()
        
    except Exception as e:
        print(f"Error loading web page {url}: {str(e)}")
        return ""

def split_text_into_chunks(text: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> List[str]:
    """
    Split text into chunks using RecursiveCharacterTextSplitter.
    
    Args:
        text (str): Text to split
        chunk_size (int): Maximum size of each chunk
        chunk_overlap (int): Overlap between chunks
        
    Returns:
        List[str]: List of text chunks
    """
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
    """
    Generate embeddings for a list of texts using Google Generative AI.
    
    Args:
        texts (List[str]): List of texts to embed
        
    Returns:
        List[List[float]]: List of embedding vectors
    """
    embeddings = []
    
    for i, text in enumerate(texts):
        if not text.strip():
            continue
            
        try:
            # Rate limiting to avoid quota issues
            if i > 0 and i % 10 == 0:
                time.sleep(1)
            
            result = genai.embed_content(
                model="models/text-embedding-004",
                content=text,
                task_type="retrieval_document"
            )
            
            embeddings.append(result['embedding'])
            
        except Exception as e:
            print(f"Error generating embedding for text {i}: {str(e)}")
            # Continue with other texts even if one fails
            continue
    
    return embeddings

def create_chroma_collection(collection_name: str = "bible_comments_rag"):
    """
    Initialize a ChromaDB collection and return it.
    
    Args:
        collection_name (str): Name of the collection
        
    Returns:
        chromadb.Collection: ChromaDB collection object
    """
    try:
        # Create ChromaDB client with persistent storage
        persist_directory = "backend/data/chromadb"
        os.makedirs(persist_directory, exist_ok=True)
        
        client = chromadb.PersistentClient(path=persist_directory)
        
        # Try to get existing collection or create new one
        try:
            collection = client.get_collection(name=collection_name)
            print(f"Using existing collection: {collection_name}")
        except:
            collection = client.create_collection(
                name=collection_name,
                metadata={"description": "RAG collection for biblical commentaries"}
            )
            print(f"Created new collection: {collection_name}")
        
        return collection
        
    except Exception as e:
        print(f"Error creating ChromaDB collection: {str(e)}")
        raise

def index_documents(sources: List[Dict[str, str]]) -> bool:
    """
    Index documents from various sources into ChromaDB.
    
    Args:
        sources (List[Dict]): List of source dictionaries with 'type' and 'path'/'url'
        
    Returns:
        bool: True if indexing was successful
    """
    try:
        # Create ChromaDB collection
        collection = create_chroma_collection()
        
        all_chunks = []
        all_metadatas = []
        all_ids = []
        
        chunk_id_counter = 0
        
        for source in sources:
            source_type = source.get('type')
            source_path = source.get('path') or source.get('url')
            
            print(f"Processing {source_type}: {source_path}")
            
            # Load content based on source type
            if source_type == 'file':
                content = load_document(source_path)
            elif source_type == 'url':
                content = load_web_page(source_path)
            else:
                print(f"Unknown source type: {source_type}")
                continue
            
            if not content:
                print(f"No content loaded from {source_path}")
                continue
            
            # Split into chunks
            chunks = split_text_into_chunks(content)
            print(f"Split into {len(chunks)} chunks")
            
            # Prepare chunks and metadata
            for chunk in chunks:
                if chunk.strip():
                    all_chunks.append(chunk)
                    all_metadatas.append({
                        'source_type': source_type,
                        'source_path': source_path,
                        'chunk_index': len(all_chunks) - 1
                    })
                    all_ids.append(f"chunk_{chunk_id_counter}")
                    chunk_id_counter += 1
        
        if not all_chunks:
            print("No chunks to index")
            return False
        
        print(f"Generating embeddings for {len(all_chunks)} chunks...")
        
        # Generate embeddings in batches to avoid memory issues
        batch_size = 50
        for i in range(0, len(all_chunks), batch_size):
            batch_chunks = all_chunks[i:i + batch_size]
            batch_metadatas = all_metadatas[i:i + batch_size]
            batch_ids = all_ids[i:i + batch_size]
            
            print(f"Processing batch {i//batch_size + 1}/{(len(all_chunks) + batch_size - 1)//batch_size}")
            
            # Generate embeddings for this batch
            batch_embeddings = generate_embeddings(batch_chunks)
            
            if len(batch_embeddings) != len(batch_chunks):
                print(f"Warning: Generated {len(batch_embeddings)} embeddings for {len(batch_chunks)} chunks")
                # Adjust arrays to match successful embeddings
                batch_chunks = batch_chunks[:len(batch_embeddings)]
                batch_metadatas = batch_metadatas[:len(batch_embeddings)]
                batch_ids = batch_ids[:len(batch_embeddings)]
            
            # Add to ChromaDB
            if batch_embeddings:
                collection.add(
                    embeddings=batch_embeddings,
                    documents=batch_chunks,
                    metadatas=batch_metadatas,
                    ids=batch_ids
                )
                print(f"Added {len(batch_embeddings)} chunks to collection")
        
        print(f"Successfully indexed {len(all_chunks)} chunks")
        return True
        
    except Exception as e:
        print(f"Error indexing documents: {str(e)}")
        return False

if __name__ == "__main__":
    print("Starting RAG indexing process...")
    
    # Check if Google API key is set
    if not os.getenv('GOOGLE_API_KEY'):
        print("Error: GOOGLE_API_KEY environment variable not set")
        sys.exit(1)
    
    # Define sources to index
    # For MVP, we'll focus on local files instead of web scraping
    # You can manually download content from these sites and save as TXT files
    sources = [
        # Example local files (create these manually for MVP)
        {'type': 'file', 'path': 'backend/data/freebiblecommentary_content.txt'},
        {'type': 'file', 'path': 'backend/data/bibliotecabiblica_content.txt'},
        {'type': 'file', 'path': 'backend/data/enduringword_content.txt'},
        
        # Uncomment these for web scraping (may need additional setup)
        # {'type': 'url', 'url': 'https://www.freebiblecommentary.org/portuguese_bible_study.htm'},
        # {'type': 'url', 'url': 'https://bibliotecabiblica.blogspot.com/'},
        # {'type': 'url', 'url': 'https://pt.enduringword.com/'},
    ]
    
    # Create data directory if it doesn't exist
    os.makedirs('backend/data', exist_ok=True)
    
    # Create sample files if they don't exist (for testing)
    sample_files = [
        'backend/data/freebiblecommentary_content.txt',
        'backend/data/bibliotecabiblica_content.txt',
        'backend/data/enduringword_content.txt'
    ]
    
    for file_path in sample_files:
        if not os.path.exists(file_path):
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(f"Sample content for {os.path.basename(file_path)}\n\n")
                f.write("This is placeholder content. Replace with actual biblical commentary content.\n")
                f.write("For production, download content from the respective websites and place here.\n")
    
    # Filter sources to only include existing files
    existing_sources = []
    for source in sources:
        if source['type'] == 'file':
            if os.path.exists(source['path']):
                existing_sources.append(source)
            else:
                print(f"File not found: {source['path']}")
        else:
            existing_sources.append(source)
    
    if not existing_sources:
        print("No valid sources found. Please add content files to backend/data/")
        sys.exit(1)
    
    # Run indexing
    success = index_documents(existing_sources)
    
    if success:
        print("RAG indexing completed successfully!")
    else:
        print("RAG indexing failed!")
        sys.exit(1)

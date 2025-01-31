"""
Main entry point for the chatbot application.
Handles initialization and user interaction loop.
"""

from src.document_loader import load_documents
from src.vector_store import VectorStore
from src.chat_bot import ChatBot

def initialize_system():
    # Load or create vector store
    vector_store = VectorStore()
    # try:
    #     vector_store.load_local()
    # except:
    #     print("Creating new vector store...")
    #     documents = load_documents()
    #     vector_store.create_from_documents(documents)
    print("Creating new vector store...")
    documents = load_documents()
    vector_store.create_from_documents(documents)
    return ChatBot(vector_store.vector_store)

def main():
    chatbot = initialize_system()
    print("Chatbot ready! Type 'exit' to end the conversation.")
    
    while True:
        query = input("\nYour question: ")
        if query.lower() in ["exit", "quit"]:
            break
            
        response = chatbot.query(query)
        print(f"\nAssistant: {response}")

if __name__ == "__main__":
    main()
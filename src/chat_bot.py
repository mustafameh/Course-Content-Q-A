"""
Main chatbot class handling query processing and OpenRouter API communication.
Includes conversation history management and retrieval-augmented generation.
"""

import json
import requests
from typing import List, Dict
from src.config import settings

class ChatBot:
    def __init__(self, vector_store):
        self.vector_store = vector_store
        self.conversation_history: List[Dict] = []

    def _format_prompt(self, query: str, context: str, sources: List[str]) -> str:
        return f"""Use the following context to answer the question. If you don't know the answer, say so.

        Context: {context}

        Sources: {", ".join(sources)}

        Question: {query}

        Answer:"""

    def _openrouter_request(self, prompt: str) -> str:
        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": settings.LLM_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7
        }

        response = requests.post(
            f"{settings.OPENROUTER_URL}/chat/completions",
            headers=headers,
            data=json.dumps(payload)
        )
        return response.json()["choices"][0]["message"]["content"]

    def query(self, question: str) -> str:
        # Retrieve documents with similarity scores
        docs_with_scores = self.vector_store.similarity_search_with_score(question, k=3)
        
        # Filter documents based on similarity threshold
        relevant_docs = [
            doc for doc, score in docs_with_scores 
            if score >= settings.SIMILARITY_THRESHOLD
        ]
        
        if not relevant_docs:
            return "I couldn't find any relevant information in my knowledge base."
        
        # Extract context and sources
        context = "\n".join([doc.page_content for doc in relevant_docs])
        sources = list(set([
            doc.metadata.get("source", "unknown") 
            for doc in relevant_docs
        ]))
        
        # Generate prompt with context and sources
        prompt = self._format_prompt(question, context, sources)
        
        # Get LLM response
        response = self._openrouter_request(prompt)
        
        # Update conversation history
        self.conversation_history.append({
            "question": question,
            "response": response,
            "context": context,
            "sources": sources,
            "scores": [score for _, score in docs_with_scores]  # Optional: store scores
        })
        
        # Append sources to the response
        response_with_sources = f"{response}\n\nSources: {', '.join(sources)}"
        return response_with_sources
"""
Main chatbot class handling query processing and OpenRouter API communication.
Includes conversation history management and retrieval-augmented generation.
"""

import re
import os
import json
import requests
from typing import List, Dict
from langchain.schema import Document
from src.config import settings

class ChatBot:
    def __init__(self, vector_store):
        self.vector_store = vector_store
        self.conversation_history: List[Dict] = []

    def _format_prompt(self, query: str, context: List[Document]) -> str:
        """ Format context with source annotations """
        formatted_context = []
        for doc in context:
            source = os.path.basename(doc.metadata.get("source", "unknown"))
            formatted_context.append(f"[Source: {source}]{doc.page_content}")
    
    # Fixed indentation and removed extra parentheses
        prompt = f"""Answer the question using ONLY the context below.
ALWAYS cite sources using [Source: filename] format next to the sentence.
If unsure, say so.

Context:
{'              '.join(formatted_context)}

Question: {query}
Answer:"""
        return prompt

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
        # Retrieve relevant docs with scores
        docs_with_scores = self.vector_store.similarity_search_with_score(question, k=3)
        
        # Filter documents
        relevant_docs = [
            doc for doc, score in docs_with_scores 
            if score >= settings.SIMILARITY_THRESHOLD
        ]
        
        if not relevant_docs:
            return "I couldn't find any relevant information in my knowledge base."
        
        # Generate prompt with source-annotated context
        prompt = self._format_prompt(question, relevant_docs)
        response = self._openrouter_request(prompt)
        
        # Extract cited sources
        cited_sources = list(set(
            re.findall(r"\[Source: (.*?)\]", response)
        )) or ["general knowledge"]
        
        # Clean response
        clean_response = re.sub(r"\[Source: .*?\]", "", response).strip()
        
        # Update history
        self.conversation_history.append({
            "question": question,
            "response": clean_response,
            "sources": cited_sources
        })
        
        return f"{clean_response}\n\nSources: {', '.join(cited_sources)}"
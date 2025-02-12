"""
chat_bot.py
Main chatbot class handling query processing and OpenRouter API communication.
Includes conversation history management and retrieval-augmented generation.
"""

import re
import os
import json
import requests
import spacy
from typing import List, Dict
from langchain.schema import Document
from src.config import settings
import spacy 




class ChatBot:
    def __init__(self, vector_store, subject_name: str):
        self.vector_store = vector_store
        self.subject_name = subject_name
        self.conversation_history: List[Dict] = []
        self.entity_buffer = set()
        self.ner_pipeline = spacy.load("en_core_web_sm")
        self.pronouns = {"he", "she", "it", "they", "his", "her", "their", "them"}
        
        
    def _extract_entities(self, text: str) -> List[str]:
        """Extract entities using both Flair and spaCy"""
        
        # spaCy NER for additional entity types
        spacy_doc = self.ner_pipeline(text)
    
        
        return [ent.text for ent in spacy_doc.ents]
    
    
    def _check_pronouns(self, text: str) -> bool:
        """Check if query contains ambiguous pronouns"""
        return any(word.lower() in self.pronouns for word in text.split())
        
    def _augment_query(self, query: str) -> str:
        """Enhance query with tracked entities only if pronouns are present"""
        if self._check_pronouns(query) and self.entity_buffer:
            return f"{query} {' '.join(self.entity_buffer)}"
        return query  # Return original query if no pronouns

    
    
    def _count_tokens(self, text: str) -> int:
        """Approximate token count by splitting on whitespace"""
        return len(text.split())
    
    def _get_truncated_history(self) -> str:
        """Get conversation history within token/length limits"""
        # Get last N exchanges based on MAX_HISTORY_LENGTH
        history_exchanges = self.conversation_history[-settings.MAX_HISTORY_LENGTH:]
        
        # Convert to formatted text
        history_text = "\n".join([
            f"User: {item['question']}\nAssistant: {item['response']}" 
            for item in history_exchanges
        ])
        
        # Truncate by token count if needed
        while self._count_tokens(history_text) > settings.MAX_HISTORY_TOKENS and len(history_exchanges) > 0:
            # Remove oldest exchange
            history_exchanges = history_exchanges[1:]
            history_text = "\n".join([
                f"User: {item['question']}\nAssistant: {item['response']}" 
                for item in history_exchanges
            ])
        
        return history_text

    def _format_prompt(self, query: str, context: List[Document]) -> str:
        """Format prompt with conversation history and context"""
        history_text = self._get_truncated_history()
        
        formatted_context = []
        for doc in context:
            source = os.path.basename(doc.metadata.get("source", "unknown"))
            formatted_context.append(f"[Source: {source}] {doc.page_content}")
            formatted_context.append(" + ")
            
        entity_context = f"| Known Entities: {', '.join(self.entity_buffer)} |" if self.entity_buffer else ""
        
        prompt = f"""You are an AI assistant helping with questions about the subject: {self.subject_name}.
        
        Conversation History:
        {history_text}
        :end of conversation history. Known entities: {entity_context}.  
        
        Answer the question using the new context below and if needed the history.
        If unsure, say so. Ask for clarification if pronoun is ambiguous. 
        Tell them to rephrase the query with full nouns.
        Stay focused on the subject matter of {self.subject_name}.
        
        Information from current "new Context":
        {', '.join(formatted_context)}
        
        Question: {query}
        
        Answer:"""
        
        print(f"Generated prompt for {self.subject_name}:", prompt)
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
        # Augment query with entities
        augmented_query = self._augment_query(question)
        print("Current Entity Buffer: " , self.entity_buffer)
        print("Query to vector base:", augmented_query)
        
        # Retrieve and filter documents
        docs_with_scores = self.vector_store.similarity_search_with_score(augmented_query, k=settings.NUMBER_OF_CHUNKS)
        relevant_docs = [doc for doc, score in docs_with_scores if score >= settings.SIMILARITY_THRESHOLD]
        
        if not relevant_docs:
            return "I couldn't find any relevant information in my knowledge base."
        
        # Update entity buffer
        self.entity_buffer.update(self._extract_entities(question))
        self.entity_buffer.update(self._extract_entities(" ".join([doc.page_content for doc in relevant_docs])))
        
        # Keep only recent 5 entities
        self.entity_buffer = set(list(self.entity_buffer)[-5:])

        # Generate and execute prompt
        prompt = self._format_prompt(question, relevant_docs)
        response = self._openrouter_request(prompt)
        
        # Process response
        # Extract sources from the relevant documents instead of the response
        sources = list(set([os.path.basename(doc.metadata.get("source", "unknown")) 
                        for doc in relevant_docs]))
        
        # Clean any source annotations that might be in the response
        clean_response = re.sub(r"$$Source:.*?$$", "", response).strip()
        
        # Update history
        self.conversation_history.append({
            "question": question,
            "response": clean_response,
            "sources": sources,
            "entities": list(self.entity_buffer)
        })
        
        return f"{clean_response}\n\nSources: {', '.join(sources)}"
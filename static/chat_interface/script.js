class CourseCompanion {
    constructor() {
        this.currentSubjectId = null;
        this.initializeElements();
        this.addEventListeners();
    }

    initializeElements() {
        this.elements = {
            subjectSelect: document.getElementById('subject-select'),
            chatContainer: document.getElementById('chat-container'),
            messageInput: document.getElementById('message-input'),
            sendButton: document.getElementById('send-button'),
            resetButton: document.getElementById('reset-button')
        };
    }

    addEventListeners() {
        // Handle Enter key in input
        this.elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // Load subjects when page loads
        document.addEventListener('DOMContentLoaded', () => this.loadSubjects());
    }

    async loadSubjects() {
        try {
            const response = await fetch('/chat/subjects');
            const data = await response.json();
            
            data.subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject.id;
                option.textContent = subject.name;
                this.elements.subjectSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading subjects:', error);
            this.showError('Failed to load subjects. Please try again later.');
        }
    }

    async initializeChat() {
        const subjectId = this.elements.subjectSelect.value;
        if (!subjectId) return;

        try {
            const response = await fetch(`/chat/initialize/${subjectId}`, {
                method: 'POST'
            });
            
            if (!response.ok) throw new Error('Failed to initialize chat');
            
            this.currentSubjectId = subjectId;
            this.enableChat();
            this.clearChat();
            await this.loadChatHistory();
            
            this.addSystemMessage('Chat initialized. How can I help you today?');
        } catch (error) {
            console.error('Error initializing chat:', error);
            this.showError('Failed to initialize chat. Please try again.');
        }
    }

    async sendMessage() {
        const message = this.elements.messageInput.value.trim();
        if (!message) return;
    
        this.elements.messageInput.value = '';
        this.addMessage(message, 'user');
        this.elements.sendButton.disabled = true;
        this.elements.messageInput.disabled = true; // Disable input while processing
    
        // Show typing indicator
        this.showTypingIndicator();
    
        try {
            const response = await fetch(`/chat/query/${this.currentSubjectId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question: message })
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to get response');
            
            // Remove typing indicator before showing the response
            this.removeTypingIndicator();
            this.addMessage(data.response, 'bot');
        } catch (error) {
            console.error('Error sending message:', error);
            this.removeTypingIndicator();
            this.showError('Failed to get response. Please try again.');
        } finally {
            this.elements.sendButton.disabled = false;
            this.elements.messageInput.disabled = false; // Re-enable input
        }
    }

    async resetChat() {
        try {
            await fetch(`/chat/${this.currentSubjectId}/reset`, {
                method: 'POST'
            });
            this.clearChat();
            this.addSystemMessage('Chat history has been reset.');
        } catch (error) {
            console.error('Error resetting chat:', error);
            this.showError('Failed to reset chat. Please try again.');
        }
    }

    async loadChatHistory() {
        try {
            const response = await fetch(`/chat/${this.currentSubjectId}/history`);
            const data = await response.json();
            
            this.clearChat();
            data.history.forEach(item => {
                this.addMessage(item.question, 'user');
                this.addMessage(item.response, 'bot');
            });
        } catch (error) {
            console.error('Error loading chat history:', error);
            this.showError('Failed to load chat history.');
        }
    }

    addMessage(text, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        if (type === 'bot' && text.includes('\n\nSources:')) {
            const [message, sources] = text.split('\n\nSources:');
            messageDiv.textContent = message;
            
            const sourcesDiv = document.createElement('div');
            sourcesDiv.className = 'source';
            // Update the text here to say "Sources Searched: " instead of "Sources: "
            sourcesDiv.textContent = 'Sources Searched: ' + sources;
            messageDiv.appendChild(sourcesDiv);
        } else {
            messageDiv.textContent = text;
        }
        
        this.elements.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addSystemMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system-message';
        messageDiv.textContent = text;
        this.elements.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    showError(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message error-message';
        messageDiv.textContent = 'Error: ' + text;
        this.elements.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    clearChat() {
        this.elements.chatContainer.innerHTML = '';
    }

    enableChat() {
        this.elements.messageInput.disabled = false;
        this.elements.sendButton.disabled = false;
        this.elements.resetButton.disabled = false;
    }

    scrollToBottom() {
        this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;
    }



    showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.innerHTML = `
            <span></span>
            <span></span>
            <span></span>
        `;
        indicator.id = 'typing-indicator';
        this.elements.chatContainer.appendChild(indicator);
        this.scrollToBottom();
    }
    
    removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }


}

// Initialize the CourseCompanion
const courseCompanion = new CourseCompanion();

// Export functions for HTML event handlers
window.initializeChat = () => courseCompanion.initializeChat();
window.sendMessage = () => courseCompanion.sendMessage();
window.resetChat = () => courseCompanion.resetChat();
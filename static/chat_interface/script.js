class CourseCompanion {




    constructor() {
        this.currentSubjectId = null;
        this.initializeElements();
        this.addEventListeners();
        this.conversation_history = []; // Add this line
        this.currentFeedbackContext = null; // Add this line
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
            this.conversation_history = []; // Reset conversation history
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

            this.conversation_history.push({
                question: message,
                response: data.response
            });


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
            this.conversation_history = data.history; // Update conversation history
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
        
        if (type === 'bot') {
            const messageContent = document.createElement('div');
            messageContent.className = 'message-content';
            
            if (text.includes('\n\nSources:')) {
                const [message, sources] = text.split('\n\nSources:');
                messageContent.textContent = message;
                
                const sourcesDiv = document.createElement('div');
                sourcesDiv.className = 'source';
                sourcesDiv.textContent = 'Sources Searched: ' + sources;
                messageContent.appendChild(sourcesDiv);
            } else {
                messageContent.textContent = text;
            }

            // Add feedback button
            const feedbackButton = document.createElement('span');
            feedbackButton.className = 'feedback-button';
            feedbackButton.innerHTML = '<i class="fas fa-thumbs-down"></i>';
            feedbackButton.onclick = () => this.showFeedbackModal(text);
            
            messageDiv.appendChild(messageContent);
            messageDiv.appendChild(feedbackButton);
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
    showFeedbackModal(botResponse) {
        const modal = document.getElementById('feedbackModal');
        const questionInput = document.getElementById('questionForReview');
    
        // Get the last question from conversation history
        const lastExchange = this.conversation_history[this.conversation_history.length - 1];
        const lastQuestion = lastExchange ? lastExchange.question : '';
        
        // Pre-fill the question
        questionInput.value = lastQuestion;
        
        this.currentFeedbackContext = {
            originalQuestion: lastQuestion,
            botResponse: botResponse
        };
    
        modal.style.display = 'flex';
    }

    closeFeedbackModal() {
        const modal = document.getElementById('feedbackModal');
        modal.style.display = 'none';
    }

    async submitFeedback() {
        const questionForReview = document.getElementById('questionForReview').value;
        
        try {
            const response = await fetch(`/chat/feedback/${this.currentSubjectId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    originalQuestion: this.currentFeedbackContext.originalQuestion,
                    questionForReview: questionForReview,
                    botResponse: this.currentFeedbackContext.botResponse
                })
            });
    
            if (!response.ok) throw new Error('Failed to submit feedback');
    
            this.addSystemMessage('Thank you! Your question has been submitted for review.');
        } catch (error) {
            console.error('Error submitting feedback:', error);
            this.showError('Failed to submit question for review. Please try again.');
        } finally {
            this.closeFeedbackModal();
        }
    }
}


    


// Initialize the CourseCompanion
const courseCompanion = new CourseCompanion();

// Export functions for HTML event handlers
window.initializeChat = () => courseCompanion.initializeChat();
window.sendMessage = () => courseCompanion.sendMessage();
window.resetChat = () => courseCompanion.resetChat();

window.submitFeedback = () => courseCompanion.submitFeedback();


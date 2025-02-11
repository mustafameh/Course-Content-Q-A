class CourseCompanion {




    constructor() {
        this.currentSubjectId = null;
        this.viewType = document.body.dataset.viewType; // 'global' or 'professor'
        this.professorId = document.body.dataset.professorId;
        this.initializeElements();
        this.addEventListeners();
        this.conversation_history = [];
        this.currentFeedbackContext = null;
        this.initializeTheme();
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
    initializeTheme() {
        const themeToggle = document.getElementById('theme-toggle');
        const savedTheme = localStorage.getItem('theme') || 'light';
        
        document.body.classList.toggle('dark-mode', savedTheme === 'dark');
        this.updateThemeIcon(savedTheme);
    
        themeToggle.addEventListener('click', () => this.toggleTheme());
    }
    
    toggleTheme() {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        this.updateThemeIcon(isDark ? 'dark' : 'light');
    }
    
    updateThemeIcon(theme) {
        const icon = document.querySelector('#theme-toggle i');
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    async loadSubjects() {
        try {
            let url = '/chat/subjects';
            
            // Add professor_id parameter if in professor view
            if (this.viewType === 'professor' && this.professorId) {
                url += `?professor_id=${this.professorId}`;
            }

            const response = await fetch(url);
            const data = await response.json();

            // Clear existing options
            this.elements.subjectSelect.innerHTML = '<option value="">Select a subject</option>';

            // Add new options
            data.subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject.id;
                option.textContent = subject.name;
                if (this.viewType === 'global') {
                    // In global view, show professor name with subject
                    option.textContent += ` (Prof. ${subject.professor_name})`;
                }
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
        // Add animation class based on message type
        const animationClass = type === 'bot' ? 'message-appear-left' : 'message-appear-right';
        messageDiv.className = `message ${type}-message ${animationClass}`;
        
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
        
        // Add animation cleanup
        messageDiv.addEventListener('animationend', () => {
            messageDiv.classList.remove(animationClass);
        });
        
        this.elements.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addSystemMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system-message message-appear-left';
        messageDiv.textContent = text;
        
        messageDiv.addEventListener('animationend', () => {
            messageDiv.classList.remove('message-appear-left');
        });
        
        this.elements.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    showError(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message error-message message-appear-left';
        messageDiv.textContent = 'Error: ' + text;
        
        messageDiv.addEventListener('animationend', () => {
            messageDiv.classList.remove('message-appear-left');
        });
        
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
        indicator.className = 'typing-indicator message-appear-left';
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


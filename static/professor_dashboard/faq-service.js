/**
 * FAQService
 * 
 * Manages all FAQ-related operations in the dashboard:
 * - Loading and displaying FAQs
 * - Handling pending questions
 * - Updating and deleting FAQs
 * - Managing FAQ UI elements
 * 
 * Key Functions:
 * - loadFAQs(): Fetches and displays all FAQs for a subject
 * - answerQuestion(): Handles answering pending questions
 * - updateFAQ(): Updates existing FAQ questions/answers
 * - deleteFAQ(): Removes FAQ entries
 * - filterQuestions(): Switches between pending and all questions view
 */
const FAQService = {
    async loadFAQs(subjectId) {
        try {
            const response = await fetch(`/professor/faq/subject/${subjectId}/questions`);
            if (!response.ok) throw new Error('Failed to load FAQs');
            
            const data = await response.json();
            this.updateFAQUI(subjectId, data);
            this.updatePendingBadge(subjectId, data.pending_questions.length);
        } catch (error) {
            console.error('Error loading FAQs:', error);
            alert('Failed to load FAQs');
        }
    },

    updateFAQUI(subjectId, data) {
        const pendingContainer = document.getElementById(`pending-questions-${subjectId}`);
        const answeredContainer = document.getElementById(`answered-questions-${subjectId}`);

        // Update pending questions
        pendingContainer.innerHTML = this.createPendingQuestionsHTML(subjectId, data.pending_questions);

        // Update answered questions
        answeredContainer.innerHTML = this.createAnsweredQuestionsHTML(subjectId, data.answered_questions);
    },

    createPendingQuestionsHTML(subjectId, questions) {
        if (questions.length === 0) {
            return '<div class="no-questions">No pending questions</div>';
        }

        return questions.map(q => `
            <div class="faq-item pending" id="faq-${q.number}">
                <div class="faq-question">
                    <span class="question-number">#${q.number}</span>
                    <span class="question-text">${q.question}</span>
                    <span class="question-date">Asked: ${q.date_asked}</span>
                </div>
                <div class="faq-answer">
                    <textarea class="answer-input" placeholder="Type your answer here..."></textarea>
                    <div class="answer-actions">
                        <button onclick="FAQService.answerQuestion(${subjectId}, ${q.number})" class="btn btn-primary">
                            Submit Answer
                        </button>
                        <button onclick="FAQService.deleteFAQ(${subjectId}, ${q.number})" class="btn btn-danger">
                            Delete Question
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    },

    createAnsweredQuestionsHTML(subjectId, questions) {
        if (questions.length === 0) {
            return '<div class="no-questions">No answered questions</div>';
        }

        return questions.map(q => `
            <div class="faq-item" id="faq-${q.number}">
                <div class="faq-question">
                    <span class="question-number">#${q.number}</span>
                    <div class="question-content">
                        <textarea class="question-input" onchange="FAQService.updateFAQ(${subjectId}, ${q.number}, 'question', this.value)">${q.question}</textarea>
                    </div>
                </div>
                <div class="faq-answer">
                    <div class="answer-content">
                        <textarea class="answer-input" onchange="FAQService.updateFAQ(${subjectId}, ${q.number}, 'answer', this.value)">${q.answer}</textarea>
                    </div>
                    <div class="answer-meta">
                        <span class="answer-date">Answered: ${q.date_answered}</span>
                        <button onclick="FAQService.deleteFAQ(${subjectId}, ${q.number})" class="btn btn-danger btn-sm">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    },

    updatePendingBadge(subjectId, count) {
        const badge = document.getElementById(`pending-questions-badge-${subjectId}`);
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline' : 'none';
        }
    },

    async answerQuestion(subjectId, questionNumber) {
        // Get the specific answer input for this question
        const answerInput = document.querySelector(`#faq-${questionNumber} .answer-input`);
        if (!answerInput) {
            console.error('Answer input not found');
            return;
        }
    
        const answer = answerInput.value.trim();
        if (!answer) {
            alert('Please provide an answer');
            return;
        }
    
        try {
            const response = await fetch(`/professor/faq/subject/${subjectId}/questions/answer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question_number: questionNumber,
                    answer: answer
                })
            });
    
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to submit answer');
            }
    
            // Reload FAQs to update the UI
            await this.loadFAQs(subjectId);
            
            // Show success message
            alert('Answer submitted successfully');
    
        } catch (error) {
            console.error('Error answering question:', error);
            alert(error.message || 'Failed to submit answer');
        }
    },

    async updateFAQ(subjectId, questionNumber, field, value) {
        try {
            const response = await fetch(`/professor/faq/subject/${subjectId}/questions/${questionNumber}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: value })
            });

            if (!response.ok) throw new Error('Failed to update FAQ');

            // Reload FAQs to update the UI
            this.loadFAQs(subjectId);
        } catch (error) {
            console.error('Error updating FAQ:', error);
            alert('Failed to update FAQ');
        }
    },

    async deleteFAQ(subjectId, questionNumber) {
        if (!confirm('Are you sure you want to delete this question?')) return;

        try {
            const response = await fetch(`/professor/faq/subject/${subjectId}/questions/${questionNumber}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete FAQ');

            // Reload FAQs to update the UI
            this.loadFAQs(subjectId);
        } catch (error) {
            console.error('Error deleting FAQ:', error);
            alert('Failed to delete FAQ');
        }
    },

    filterQuestions(subjectId, type) {
        const pendingQuestions = document.getElementById(`pending-questions-${subjectId}`);
        const answeredQuestions = document.getElementById(`answered-questions-${subjectId}`);
        const [pendingBtn, allBtn] = document.querySelectorAll(`#faq-tab-${subjectId} .faq-filters button`);

        if (type === 'pending') {
            pendingQuestions.style.display = 'block';
            answeredQuestions.style.display = 'none';
            pendingBtn.classList.add('active');
            allBtn.classList.remove('active');
        } else {
            pendingQuestions.style.display = 'block';
            answeredQuestions.style.display = 'block';
            pendingBtn.classList.remove('active');
            allBtn.classList.add('active');
        }
    }
};
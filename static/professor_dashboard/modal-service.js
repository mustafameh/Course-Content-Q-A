/**
 * ModalService
 * 
 * Handles all modal-related operations in the dashboard:
 * - Creating and showing modals
 * - Closing and cleaning up modals
 * - Managing modal content and state
 * 
 * Key Functions:
 * - showCreateSubjectModal(): Displays subject creation modal
 * - showEditSubjectModal(): Shows subject editing modal
 * - closeModal(): Handles modal closing and cleanup
 */


const ModalService = {
    showCreateSubjectModal() {
        if (!DriveService.isDriveConnected) {
            alert('Please connect to Google Drive first');
            return;
        }

        // Add loading state
        const button = document.querySelector('.create-subject-btn');
        button.classList.add('loading');
        button.disabled = true;

        try {
            const modal = document.getElementById('create-subject-modal');
            modal.style.display = 'block';
        } finally {
            // Remove loading state
            button.classList.remove('loading');
            button.disabled = false;
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            // Clear any input fields and errors
            const input = modal.querySelector('input');
            const error = modal.querySelector('.error-text');
            if (input) input.value = '';
            if (error) error.style.display = 'none';
        }
    },

    showEditSubjectModal(subjectId) {
        const subjectSection = document.querySelector(`[data-subject-id="${subjectId}"]`);
        const currentName = subjectSection.querySelector('.subject-title h3').textContent;
        const descriptionElement = subjectSection.querySelector('.subject-description');
        const currentDescription = descriptionElement ? 
            descriptionElement.textContent.trim() === 'No description' ? '' : descriptionElement.textContent : '';

        // Create edit modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'edit-subject-modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Edit Subject</h2>
                    <span class="close" onclick="closeModal('edit-subject-modal')">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="edit-subject-name">Subject Name</label>
                        <input type="text" id="edit-subject-name" class="input-field" 
                               value="${currentName}" placeholder="Enter subject name">
                    </div>
                    <div class="form-group">
                        <label for="edit-subject-description">Description</label>
                        <textarea id="edit-subject-description" class="input-field" 
                                placeholder="Enter subject description">${currentDescription}</textarea>
                    </div>
                    <div id="edit-subject-error" class="error-text" style="display: none;"></div>
                </div>
                <div class="modal-footer">
                    <button onclick="SubjectService.updateSubject(${subjectId})" class="btn btn-primary">
                        <i class="fas fa-save"></i> Save Changes
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'block';
    }
};
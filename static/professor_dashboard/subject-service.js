/**
 * SubjectService
 * 
 * Manages all subject-related operations in the dashboard:
 * - Subject CRUD operations (Create, Read, Update, Delete)
 * - Subject UI generation and management
 * - Subject section creation and updates
 * 
 * Key Functions:
 * - loadSubjects(): Fetches and displays all subjects
 * - createSubjectSection(): Generates subject UI with file list and controls
 * - createDriveSubject(): Creates new subject with Drive integration
 * - updateSubject(): Updates existing subject details
 * - deleteDriveSubject(): Removes subject and associated Drive folder
 */



const SubjectService = {
    // Subject CRUD Operations
    async loadSubjects() {
        try {
            const response = await fetch('/professor/drive/subjects');
            if (!response.ok) throw new Error('Failed to load subjects');
            
            const data = await response.json();
            const container = document.getElementById('subjects-container');
            container.innerHTML = ''; // Clear existing content

            if (data.subjects.length === 0) {
                container.innerHTML = '<div class="no-subjects">No subjects created yet</div>';
                return;
            }

            data.subjects.forEach(subject => {
                const section = this.createSubjectSection(subject);
                container.appendChild(section);
                FileService.loadDriveFiles(subject.id);
            });
        } catch (error) {
            console.error('Error loading subjects:', error);
            alert('Failed to load subjects');
        }
    },

    createSubjectSection(subject) {
        const section = document.createElement('div');
        section.className = 'subject-section drive-subject-section';
        section.setAttribute('data-subject-id', subject.id);

        const headerContent = `
            <div class="subject-header">
                <div class="subject-title">
                    <h3>${subject.name}</h3>
                    <button onclick="ModalService.showEditSubjectModal(${subject.id})" class="btn btn-sm btn-secondary">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
                <div class="subject-description">
                    ${subject.description || 'No description'}
                </div>
            </div>
        `;

        const fileListSection = `
            <div class="file-list-header">
                <div class="file-list-controls">
                    <select onchange="FileService.changeFileView(${subject.id}, this.value)" class="view-select">
                        <option value="list">List View</option>
                        <option value="grid">Grid View</option>
                    </select>
                    <input type="text" 
                           placeholder="Search files..." 
                           onkeyup="FileService.searchFiles(${subject.id}, this.value)"
                           class="file-search">
                </div>
            </div>
            <div class="file-list drive-files" 
                 id="files-${subject.id}"
                 data-view="list">
            </div>
            <div class="file-list-footer">
                <div class="pagination" id="pagination-${subject.id}"></div>
            </div>
        `;

        const uploadZone = `
            <div class="file-upload-zone" id="upload-zone-${subject.id}" 
                 ondrop="FileService.handleFileDrop(event, ${subject.id})" 
                 ondragover="FileService.handleDragOver(event)"
                 ondragleave="FileService.handleDragLeave(event)">
                <div class="upload-message">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <p>Drag and drop files here or</p>
                    <label class="upload-btn">
                        Choose Files
                        <input type="file" 
                               multiple 
                               onchange="FileService.handleFileSelect(event, ${subject.id})" 
                               style="display: none;">
                    </label>
                </div>
            </div>
            <div class="upload-progress" id="upload-progress-${subject.id}" style="display: none;">
                <div class="progress-bar">
                    <div class="progress" id="progress-bar-${subject.id}"></div>
                </div>
                <p class="progress-text" id="progress-text-${subject.id}">Uploading...</p>
            </div>
        `;

        const actionsContent = `
            <div class="subject-actions">
                <button onclick="DriveService.openDriveFolder('${subject.drive_folder_id}')" class="btn btn-drive" title="Open in Google Drive">
                    <i class="fab fa-google-drive"></i> Drive
                </button>
                <button onclick="KnowledgeBaseService.updateKnowledgeBase(${subject.id})" 
                        class="btn btn-kb" 
                        id="kb-btn-${subject.id}"
                        title="Sync files and save to knowledge base">
                    <i class="fas fa-database"></i> Save to KB
                </button>
                <button onclick="SubjectService.deleteDriveSubject(${subject.id})" class="btn btn-delete" title="Delete subject">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;

        section.innerHTML = `
            ${headerContent}
            ${fileListSection}
            ${uploadZone}
            ${actionsContent}
        `;

        return section;
    },

    async createDriveSubject() {
        const name = document.getElementById('new-subject-name').value.trim();
        const errorElement = document.getElementById('subject-error');
        
        if (!name) {
            errorElement.textContent = 'Please enter a subject name';
            errorElement.style.display = 'block';
            return;
        }
        
        if (!DriveService.isDriveConnected) {
            errorElement.textContent = 'Please connect to Google Drive first';
            errorElement.style.display = 'block';
            return;
        }
        
        try {
            const response = await fetch('/professor/drive/subjects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create subject');
            }
            
            ModalService.closeModal('create-subject-modal');
            this.loadSubjects();
        } catch (error) {
            errorElement.textContent = error.message;
            errorElement.style.display = 'block';
        }
    },

    async updateSubject(subjectId) {
        const nameInput = document.getElementById('edit-subject-name');
        const descriptionInput = document.getElementById('edit-subject-description');
        const errorElement = document.getElementById('edit-subject-error');
        
        const name = nameInput.value.trim();
        const description = descriptionInput.value.trim();
        
        if (!name) {
            errorElement.textContent = 'Subject name is required';
            errorElement.style.display = 'block';
            return;
        }
        
        try {
            const response = await fetch(`/professor/drive/subjects/${subjectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update subject');
            }
            
            ModalService.closeModal('edit-subject-modal');
            this.loadSubjects();  // Refresh the subjects list
            
        } catch (error) {
            errorElement.textContent = error.message;
            errorElement.style.display = 'block';
        }
    },

    async deleteDriveSubject(subjectId) {
        if (!confirm('Are you sure you want to delete this subject? This will also delete the Drive folder.')) {
            return;
        }

        try {
            const response = await fetch(`/professor/drive/subjects/${subjectId}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete subject');
            
            this.loadSubjects();
        } catch (error) {
            console.error('Error deleting subject:', error);
            alert('Failed to delete subject');
        }
    }
};
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
                // Remove this line since we're loading files in createSubjectSection
                // FileService.loadDriveFiles(subject.id);
            });
            this.updateSidebarNavigation();
        } catch (error) {
            console.error('Error loading subjects:', error);
            alert('Failed to load subjects');
        }
    },

    // UI Generation Functions
    createSubjectSection(subject) {
        const section = document.createElement('div');
        section.className = 'subject-section drive-subject-section';
        section.setAttribute('data-subject-id', subject.id);
        section.setAttribute('data-default-height', '750px'); // Store default height


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

        const tabNavigation = `
            <div class="subject-tabs">
                <button class="tab-btn active" onclick="SubjectService.switchTab(${subject.id}, 'files')">
                    <i class="fas fa-file"></i> Files
                </button>
                <button class="tab-btn" onclick="SubjectService.switchTab(${subject.id}, 'faq')">
                    <i class="fas fa-question-circle"></i> FAQ Management
                    <span class="pending-badge" id="pending-questions-badge-${subject.id}" style="display: none">0</span>
                </button>
            </div>
        `;

        const fileListSection = `
            <div class="tab-content files-tab" id="files-tab-${subject.id}" style="display: block;">
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
                ${this.createUploadZoneHTML(subject.id)}
            </div>
        `;

        const faqSection = `
            <div class="tab-content faq-tab" id="faq-tab-${subject.id}" style="display: none;">
                <div class="faq-header">
                    <h4>FAQ Management</h4>
                    <div class="faq-filters">
                        <button class="btn btn-primary active" onclick="FAQService.filterQuestions(${subject.id}, 'pending')">
                            Pending Questions
                        </button>
                        <button class="btn btn-secondary" onclick="FAQService.filterQuestions(${subject.id}, 'all')">
                            All Questions
                        </button>
                    </div>
                </div>
                <div class="faq-content">
                    <div class="pending-questions" id="pending-questions-${subject.id}">
                        <!-- Pending questions will be loaded here -->
                    </div>
                    <div class="answered-questions" id="answered-questions-${subject.id}" style="display: none;">
                        <!-- Answered questions will be loaded here -->
                    </div>
                </div>
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
            ${tabNavigation}
            ${fileListSection}
            ${faqSection}
            ${actionsContent}
            <div class="resize-handle" title="Drag to resize (Double-click to reset)"></div>
        `;
        this.initializeResize(section);
        // Initialize both files and FAQ data after creating the section
    // Use setTimeout to ensure the DOM is ready
        setTimeout(() => {
        // Load files for the Files tab (which is visible by default)
        FileService.loadDriveFiles(subject.id);
        // Pre-load FAQ data in the background
        FAQService.loadFAQs(subject.id);
    }, 0);

        return section;
    },

    createUploadZoneHTML(subjectId) {
        return `
            <div class="file-upload-zone" id="upload-zone-${subjectId}" 
                 ondrop="FileService.handleFileDrop(event, ${subjectId})" 
                 ondragover="FileService.handleDragOver(event)"
                 ondragleave="FileService.handleDragLeave(event)">
                <div class="upload-message">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <p>Drag and drop files here or</p>
                    <label class="upload-btn">
                        Choose Files
                        <input type="file" 
                               multiple 
                               onchange="FileService.handleFileSelect(event, ${subjectId})" 
                               style="display: none;">
                    </label>
                </div>
            </div>
            <div class="upload-progress" id="upload-progress-${subjectId}" style="display: none;">
                <div class="progress-bar">
                    <div class="progress" id="progress-bar-${subjectId}"></div>
                </div>
                <p class="progress-text" id="progress-text-${subjectId}">Uploading...</p>
            </div>
        `;
    },

    // Tab Management
    switchTab(subjectId, tabName) {
        const filesTab = document.getElementById(`files-tab-${subjectId}`);
        const faqTab = document.getElementById(`faq-tab-${subjectId}`);
        const [filesBtn, faqBtn] = document.querySelectorAll(`[data-subject-id="${subjectId}"] .tab-btn`);
    
        if (tabName === 'files') {
            filesTab.style.display = 'block';
            faqTab.style.display = 'none';
            filesBtn.classList.add('active');
            faqBtn.classList.remove('active');
            // Only reload files if the tab was previously hidden
            if (filesTab.style.display === 'none') {
                FileService.loadDriveFiles(subjectId);
            }
        } else {
            filesTab.style.display = 'none';
            faqTab.style.display = 'block';
            filesBtn.classList.remove('active');
            faqBtn.classList.add('active');
            // Only reload FAQ data if the tab was previously hidden
            if (faqTab.style.display === 'none') {
                FAQService.loadFAQs(subjectId);
            }
        }
    },
    updateSidebarNavigation() {
        const navList = document.getElementById('subject-nav-list');
        const subjects = document.querySelectorAll('.subject-section');
        
        navList.innerHTML = '';
        subjects.forEach(subject => {
            const subjectId = subject.getAttribute('data-subject-id');
            const subjectName = subject.querySelector('.subject-title h3').textContent;
            
            const navItem = document.createElement('div');
            navItem.className = 'subject-nav-item';
            navItem.innerHTML = `
                <i class="fas fa-book"></i>
                <span>${subjectName}</span>
            `;
            navItem.onclick = () => this.scrollToSubject(subjectId);
            
            navList.appendChild(navItem);
        });
    },initializeResize(section) {
        const handle = section.querySelector('.resize-handle');
        let startY, startHeight;
    
        const startResize = (e) => {
            startY = e.clientY;
            startHeight = section.offsetHeight;
            section.classList.add('resizing');
            
            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);
        };
    
        const resize = (e) => {
            const diff = e.clientY - startY;
            const newHeight = Math.max(300, Math.min(1000, startHeight + diff));
            section.style.height = `${newHeight}px`;
            
            // Adjust scroll position to keep content in view while resizing
            const scrollContainer = document.querySelector('.main-content');
            if (scrollContainer) {
                const rect = section.getBoundingClientRect();
                if (rect.bottom > window.innerHeight) {
                    scrollContainer.scrollTop += diff;
                }
            }
        };
    
        const stopResize = () => {
            section.classList.remove('resizing');
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
        };
    
        const resetSize = () => {
            const defaultHeight = section.getAttribute('data-default-height');
            section.style.height = defaultHeight;
        };
    
        handle.addEventListener('mousedown', startResize);
        handle.addEventListener('dblclick', resetSize);
    },

    scrollToSubject(subjectId) {
        const subjectSection = document.querySelector(`[data-subject-id="${subjectId}"]`);
        if (subjectSection) {
            subjectSection.scrollIntoView({ behavior: 'smooth' });
            
            // Highlight the section briefly
            subjectSection.style.transition = 'background-color 0.5s';
            subjectSection.style.backgroundColor = '#f0f7ff';
            setTimeout(() => {
                subjectSection.style.backgroundColor = '';
            }, 1000);

            // Update active state in navigation
            document.querySelectorAll('.subject-nav-item').forEach(item => {
                item.classList.remove('active');
            });
            const navItem = Array.from(document.querySelectorAll('.subject-nav-item'))
                .find(item => item.textContent.trim() === subjectSection.querySelector('.subject-title h3').textContent.trim());
            if (navItem) {
                navItem.classList.add('active');
            }
        }
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
            this.updateSidebarNavigation();
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
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    name: name, 
                    description: description 
                })
            });
    
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update subject');
            }
    
            // Get the updated data
            const data = await response.json();
    
            // Update the UI immediately
            const subjectSection = document.querySelector(`[data-subject-id="${subjectId}"]`);
            if (subjectSection) {
                const titleElement = subjectSection.querySelector('.subject-title h3');
                const descriptionElement = subjectSection.querySelector('.subject-description');
                
                if (titleElement) {
                    titleElement.textContent = name;
                }
                if (descriptionElement) {
                    descriptionElement.textContent = description || 'No description';
                }
            }
    
            // Update sidebar navigation
            this.updateSidebarNavigation();
            
            // Close the modal
            ModalService.closeModal('edit-subject-modal');
            
            // Show success message
            alert('Subject updated successfully');
            
        } catch (error) {
            console.error('Error updating subject:', error);
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
            this.updateSidebarNavigation();
        } catch (error) {
            console.error('Error deleting subject:', error);
            alert('Failed to delete subject');
        }
    }
};
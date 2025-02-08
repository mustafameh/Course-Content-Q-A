// Global state management
const state = {
    currentSubjectId: null,
    isDriveConnected: false
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initializeDashboard();
});

window.addEventListener('message', function(event) {
    if (event.data === 'google-drive-connected') {
        loadGoogleDriveStatus();
    }
});

// Modal event listeners
window.onclick = function(event) {
    if (event.target.className === 'modal') {
        event.target.style.display = 'none';
    }
};

// Initialization
async function initializeDashboard() {
    await Promise.all([
        loadProfessorProfile(),
        loadSubjects(),
        loadGoogleDriveStatus()
    ]);
}

// Profile Management
async function loadProfessorProfile() {
    try {
        const response = await fetch('/professor/profile');
        if (!response.ok) throw new Error('Failed to load profile');
        
        const data = await response.json();
        updateProfileUI(data);
    } catch (error) {
        console.error('Error loading profile:', error);
        handleProfileError();
    }
}

function updateProfileUI(data) {
    document.getElementById('professor-email').textContent = `Email: ${data.email}`;
    document.getElementById('professor-institution').textContent = `Institution: ${data.institution}`;
    document.getElementById('professor-department').textContent = `Department: ${data.department}`;
}

function handleProfileError() {
    document.getElementById('professor-email').textContent = 'Error loading profile';
    document.getElementById('professor-institution').textContent = '';
    document.getElementById('professor-department').textContent = '';
}

// Google Drive Integration

async function connectGoogleDrive() {
    try {
        const response = await fetch('/professor/google/auth/start');
        const data = await response.json();
        
        if (data.auth_url) {
            openGoogleAuthWindow(data.auth_url);
            startConnectionCheck();
        }
    } catch (error) {
        console.error('Error starting Google auth:', error);
        alert('Failed to connect to Google Drive');
    }
}

function openGoogleAuthWindow(authUrl) {
    const width = 600;
    const height = 700;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    
    window.open(
        authUrl,
        'Connect Google Drive',
        `width=${width},height=${height},top=${top},left=${left}`
    );
}

function startConnectionCheck() {
    const checkInterval = setInterval(async () => {
        const statusResponse = await fetch('/professor/google/status');
        const statusData = await statusResponse.json();
        
        if (statusData.connected) {
            clearInterval(checkInterval);
            loadGoogleDriveStatus();
        }
    }, 2000);
}




async function loadSubjects() {
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
            const section = createSubjectSection(subject);
            container.appendChild(section);
            loadDriveFiles(subject.id);
        });
    } catch (error) {
        console.error('Error loading subjects:', error);
        alert('Failed to load subjects');
    }
}
function createSubjectSection(subject) {
    const section = document.createElement('div');
    section.className = 'subject-section drive-subject-section';
    section.setAttribute('data-subject-id', subject.id);

    const headerContent = `
        <div class="subject-header">
            <div class="subject-title">
                <h3>${subject.name}</h3>
                <button onclick="showEditSubject(${subject.id})" class="btn btn-sm btn-secondary">
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
                <select onchange="changeFileView(${subject.id}, this.value)" class="view-select">
                    <option value="list">List View</option>
                    <option value="grid">Grid View</option>
                </select>
                <input type="text" 
                       placeholder="Search files..." 
                       onkeyup="searchFiles(${subject.id}, this.value)"
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
             ondrop="handleFileDrop(event, ${subject.id})" 
             ondragover="handleDragOver(event)"
             ondragleave="handleDragLeave(event)">
            <div class="upload-message">
                <i class="fas fa-cloud-upload-alt"></i>
                <p>Drag and drop files here or</p>
                <label class="upload-btn">
                    Choose Files
                    <input type="file" 
                           multiple 
                           onchange="handleFileSelect(event, ${subject.id})" 
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
        <button onclick="openDriveFolder('${subject.drive_folder_id}')" class="btn btn-drive" title="Open in Google Drive">
            <i class="fab fa-google-drive"></i> Drive
        </button>
        <button onclick="updateKnowledgeBase(${subject.id})" 
                class="btn btn-kb" 
                id="kb-btn-${subject.id}"
                title="Sync files and save to knowledge base">
            <i class="fas fa-database"></i> Save to KB
        </button>
        <button onclick="deleteDriveSubject(${subject.id})" class="btn btn-delete" title="Delete subject">
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
}

function showEditSubject(subjectId) {
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
                <button onclick="updateSubject(${subjectId})" class="btn btn-primary">
                    <i class="fas fa-save"></i> Save Changes
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'block';
}
async function updateSubject(subjectId) {
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
        
        closeModal('edit-subject-modal');
        loadSubjects();  // Refresh the subjects list
        
    } catch (error) {
        errorElement.textContent = error.message;
        errorElement.style.display = 'block';
    }
}
// File Management

function createDriveFileItem(file, subjectId) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.innerHTML = `
        <span class="file-path">
            <img src="${getFileIcon(file.mimeType)}" alt="${file.mimeType}" class="file-icon">
            ${file.name}
        </span>
        <div class="file-actions">
            <button onclick="openDriveFile('${file.id}')" class="btn btn-primary">Open</button>
            <button onclick="deleteDriveFile('${file.id}', ${subjectId})" class="btn btn-danger">Remove</button>
        </div>
    `;
    return fileItem;
}

function updateFilesList(subjectId, files) {
    const filesList = document.getElementById(`files-${subjectId}`);
    filesList.innerHTML = '';
    
    files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span class="file-path">${file.path}</span>
            <button onclick="deleteFile(${file.id}, ${subjectId})" class="btn btn-danger">Remove</button>
        `;
        filesList.appendChild(fileItem);
    });

    updateKnowledgeBaseButton(subjectId, files.length);
}


async function showCreateSubjectModal() {
    if (!state.isDriveConnected) {
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
}


function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        // Clear any input fields and errors
        const input = modal.querySelector('input');
        const error = modal.querySelector('.error-text');
        if (input) input.value = '';
        if (error) error.style.display = 'none';
    }
}


// Subject Creation and Deletion
async function createSubject() {
    const name = document.getElementById('new-subject-name').value.trim();
    if (!name) {
        alert('Please enter a subject name');
        return;
    }

    try {
        const response = await fetch('/professor/subjects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        if (!response.ok) throw new Error('Failed to create subject');
        
        closeModal('create-subject-modal');
        loadSubjects();
    } catch (error) {
        console.error('Error creating subject:', error);
        alert('Failed to create subject');
    }
}

async function createDriveSubject() {
    const name = document.getElementById('new-subject-name').value.trim();
    const errorElement = document.getElementById('subject-error');
    
    if (!name) {
        errorElement.textContent = 'Please enter a subject name';
        errorElement.style.display = 'block';
        return;
    }
    
    if (!state.isDriveConnected) {
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
        
        closeModal('create-subject-modal');
        loadSubjects();
    } catch (error) {
        errorElement.textContent = error.message;
        errorElement.style.display = 'block';
    }
}

async function deleteSubject(subjectId) {
    if (!confirm('Are you sure you want to delete this subject?')) return;

    try {
        const response = await fetch(`/professor/subjects/${subjectId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete subject');
        
        loadSubjects();
    } catch (error) {
        console.error('Error deleting subject:', error);
        alert('Failed to delete subject');
    }
}

async function deleteDriveSubject(subjectId) {
    if (!confirm('Are you sure you want to delete this subject? This will also delete the Drive folder.')) {
        return;
    }

    try {
        const response = await fetch(`/professor/drive/subjects/${subjectId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete subject');
        
        loadSubjects();
    } catch (error) {
        console.error('Error deleting subject:', error);
        alert('Failed to delete subject');
    }
}

// File Operations

async function deleteDriveFile(fileId, subjectId) {
    if (!confirm('Are you sure you want to remove this file?')) return;

    try {
        const response = await fetch(`/professor/drive/files/${fileId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete file');
        
        loadDriveFiles(subjectId);
    } catch (error) {
        console.error('Error deleting file:', error);
        alert('Failed to delete file');
    }
}

// Drive Operations
function openDriveFolder(folderId) {
    window.open(`https://drive.google.com/drive/folders/${folderId}`, '_blank');
}

function openDriveFile(fileId) {
    window.open(`https://drive.google.com/file/d/${fileId}/view`, '_blank');
}

async function syncDriveFiles(subjectId) {
    try {
        const response = await fetch(`/professor/drive/subjects/${subjectId}/sync`, {
            method: 'POST'
        });
        
        if (!response.ok) throw new Error('Failed to sync files');
        
        loadDriveFiles(subjectId);
    } catch (error) {
        console.error('Error syncing files:', error);
        alert('Failed to sync files');
    }
}

// Modify the updateKnowledgeBase function
async function updateKnowledgeBase(subjectId) {
    const kbButton = document.getElementById(`kb-btn-${subjectId}`);
    if (!confirm('This will sync your files and update the knowledge base. Continue?')) return;

    // Set loading state
    kbButton.disabled = true;
    kbButton.classList.add('loading');
    kbButton.innerHTML = `
        <div class="spinner"></div>
        <span>Syncing & Saving...</span>
    `;

    try {
        // First sync the files
        const syncResponse = await fetch(`/professor/drive/subjects/${subjectId}/sync`, {
            method: 'POST'
        });
        
        if (!syncResponse.ok) throw new Error('Failed to sync files');

        // Then update knowledge base
        const kbResponse = await fetch(`/professor/subjects/${subjectId}/knowledge-base`, {
            method: 'POST'
        });

        if (!kbResponse.ok) throw new Error('Failed to update knowledge base');
        
        // Success state
        kbButton.classList.remove('loading');
        kbButton.classList.add('success');
        kbButton.innerHTML = `
            <i class="fas fa-check"></i>
            <span>Saved to KB</span>
        `;
        kbButton.disabled = false;

    } catch (error) {
        console.error('Error updating knowledge base:', error);
        
        // Error state
        kbButton.classList.remove('loading');
        kbButton.classList.add('error');
        kbButton.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>Update Failed</span>
        `;
        kbButton.disabled = false;
    }
}

// Utility Functions
function getFileIcon(mimeType) {
    // Using publicly available file type icons
    const iconMap = {
        'application/pdf': 'https://cdn-icons-png.flaticon.com/512/337/337946.png',
        'application/msword': 'https://cdn-icons-png.flaticon.com/512/337/337932.png',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'https://cdn-icons-png.flaticon.com/512/337/337932.png',
        'text/plain': 'https://cdn-icons-png.flaticon.com/512/337/337956.png',
        'application/vnd.ms-excel': 'https://cdn-icons-png.flaticon.com/512/337/337958.png',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'https://cdn-icons-png.flaticon.com/512/337/337958.png',
        'application/vnd.ms-powerpoint': 'https://cdn-icons-png.flaticon.com/512/337/337949.png',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'https://cdn-icons-png.flaticon.com/512/337/337949.png'
    };
    
    // Default file icon for unknown types
    return iconMap[mimeType] || 'https://cdn-icons-png.flaticon.com/512/337/337937.png';
}



// Authentication
async function logout() {
    try {
        const response = await fetch('/auth/logout', {
            method: 'POST'
        });
        
        if (response.ok) {
            window.location.href = '/';
        } else {
            alert('Logout failed');
        }
    } catch (error) {
        console.error('Error during logout:', error);
        alert('Logout failed');
    }
}

// File Management State
const fileState = {
    currentPage: {},  // Store current page for each subject
    itemsPerPage: 10,
    fileCache: {},    // Cache file lists
    searchTerm: {},   // Store search terms for each subject
    viewType: {}      // Store view type (list/grid) for each subject
};

// File Upload Handlers
function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('drag-over');
}

async function handleFileDrop(event, subjectId) {
    event.preventDefault();
    event.stopPropagation();
    
    const uploadZone = event.currentTarget;
    uploadZone.classList.remove('drag-over');
    
    const files = Array.from(event.dataTransfer.files);
    await uploadFiles(files, subjectId);
}

async function handleFileSelect(event, subjectId) {
    const files = Array.from(event.target.files);
    await uploadFiles(files, subjectId);
    // Reset file input
    event.target.value = '';
}

async function uploadFiles(files, subjectId) {
    const progressBar = document.getElementById(`progress-bar-${subjectId}`);
    const progressText = document.getElementById(`progress-text-${subjectId}`);
    const progressDiv = document.getElementById(`upload-progress-${subjectId}`);
    
    progressDiv.style.display = 'block';
    
    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const formData = new FormData();
            formData.append('file', file);
            
            // Update progress text
            progressText.textContent = `Uploading ${i + 1}/${files.length}: ${file.name}`;
            
            // Calculate total progress
            const progress = ((i + 1) / files.length) * 100;
            progressBar.style.width = `${progress}%`;
            
            const response = await fetch(`/professor/drive/subjects/${subjectId}/upload`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Failed to upload ${file.name}`);
            }
        }
        
        // Refresh file list
        await loadDriveFiles(subjectId);
        
        // Enable KB button since we now have files
        const kbButton = document.getElementById(`kb-btn-${subjectId}`);
        if (kbButton) {
            kbButton.disabled = false;
            kbButton.classList.remove('disabled');
            kbButton.innerHTML = `
                <i class="fas fa-database"></i>
                <span>Save to KB</span>
            `;
        }
        
        // Show success message
        progressText.textContent = 'Upload completed successfully!';
        setTimeout(() => {
            progressDiv.style.display = 'none';
        }, 2000);
        
    } catch (error) {
        console.error('Upload error:', error);
        progressText.textContent = `Error: ${error.message}`;
        progressBar.style.backgroundColor = '#dc3545';
    }
}

// Update the updateKnowledgeBaseButton function
function updateKnowledgeBaseButton(subjectId, fileCount = 0) {
    const kbButton = document.getElementById(`kb-btn-${subjectId}`);
    if (kbButton) {
        const hasFiles = fileCount > 0;
        kbButton.disabled = !hasFiles;
        kbButton.classList.toggle('disabled', !hasFiles);
        
        if (!hasFiles) {
            kbButton.innerHTML = `
                <i class="fas fa-database"></i>
                <span>No Files to Save</span>
            `;
        } else {
            kbButton.innerHTML = `
                <i class="fas fa-database"></i>
                <span>Save to KB</span>
            `;
        }
    }
}

// File List Management
async function loadDriveFiles(subjectId, page = 1) {
    try {
        const searchTerm = fileState.searchTerm[subjectId] || '';
        const response = await fetch(
            `/professor/drive/subjects/${subjectId}/files?page=${page}&search=${searchTerm}`
        );
        
        if (!response.ok) throw new Error('Failed to load files');
        
        const data = await response.json();
        fileState.fileCache[subjectId] = data.files;
        fileState.currentPage[subjectId] = page;
        
        updateFileList(subjectId, data);
        updateKnowledgeBaseButton(subjectId, data.files.length);
        
    } catch (error) {
        console.error('Error loading Drive files:', error);
        showError('Failed to load files');
    }
}

function updateFileList(subjectId, data) {
    const filesList = document.getElementById(`files-${subjectId}`);
    const viewType = fileState.viewType[subjectId] || 'list';
    filesList.setAttribute('data-view', viewType);
    
    filesList.innerHTML = data.files.map(file => createFileItem(file, subjectId, viewType)).join('');
    
    // Update pagination
    updatePagination(subjectId, data.totalPages, data.currentPage);
}
// Add the rename function
async function renameFile(fileId, currentName) {
    const newName = prompt('Enter new filename:', currentName);
    if (!newName || newName === currentName) return;

    try {
        const response = await fetch(`/professor/drive/files/${fileId}/rename`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ new_name: newName })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to rename file');
        }

        // Refresh the file list
        const subjectSection = document.querySelector(`[data-subject-id]`);
        const subjectId = subjectSection.getAttribute('data-subject-id');
        await loadDriveFiles(subjectId);

    } catch (error) {
        console.error('Error renaming file:', error);
        alert('Failed to rename file: ' + error.message);
    }
}
// Add this to your file item creation function
function createFileItem(file, subjectId, viewType) {
    const fileIcon = getFileIcon(file.mimeType);
    const fileSize = formatFileSize(file.size);
    const modifiedDate = new Date(file.modifiedTime).toLocaleDateString();
    const isSystemFile = file.isSystemFile || file.name === 'faq.csv';
    
    if (viewType === 'grid') {
        return `
            <div class="file-item ${isSystemFile ? 'system-file' : ''}" id="file-${file.id}">
                <img src="${fileIcon}" alt="${file.mimeType}" class="file-icon">
                <div class="file-info">
                    <div class="file-name">
                        <span class="filename-text">${file.name}</span>
                        ${isSystemFile ? '<span class="system-badge" title="This is a system file that cannot be deleted">System File</span>' : ''}
                        ${!isSystemFile ? `
                            <button onclick="renameFile('${file.id}', '${file.name}')" class="rename-btn" title="Rename">
                                <i class="fas fa-edit"></i>
                            </button>
                        ` : ''}
                    </div>
                    <div class="file-meta">${fileSize} • ${modifiedDate}</div>
                </div>
                <div class="file-actions">
                    <button onclick="previewFile('${file.id}')" class="btn btn-preview" title="Preview">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="openDriveFile('${file.id}')" class="btn btn-open" title="Open in Drive">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                    ${!isSystemFile ? `
                        <button onclick="deleteDriveFile('${file.id}', ${subjectId})" class="btn btn-remove" title="Remove">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    return `
        <div class="file-item ${isSystemFile ? 'system-file' : ''}" id="file-${file.id}">
            <div class="file-main">
                <img src="${fileIcon}" alt="${file.mimeType}" class="file-icon">
                <div class="file-info">
                    <div class="file-name">
                        <span class="filename-text">${file.name}</span>
                        ${isSystemFile ? '<span class="system-badge" title="This is a system file that cannot be deleted">System File</span>' : ''}
                        ${!isSystemFile ? `
                            <button onclick="renameFile('${file.id}', '${file.name}')" class="rename-btn" title="Rename">
                                <i class="fas fa-edit"></i>
                            </button>
                        ` : ''}
                    </div>
                    <div class="file-meta">${fileSize} • ${modifiedDate}</div>
                </div>
            </div>
            <div class="file-actions">
                <button onclick="previewFile('${file.id}')" class="btn btn-preview" title="Preview">
                    <i class="fas fa-eye"></i>
                </button>
                <button onclick="openDriveFile('${file.id}')" class="btn btn-open" title="Open in Drive">
                    <i class="fas fa-external-link-alt"></i>
                </button>
                ${!isSystemFile ? `
                    <button onclick="deleteDriveFile('${file.id}', ${subjectId})" class="btn btn-remove" title="Remove">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}



function updatePagination(subjectId, totalPages, currentPage) {
    const pagination = document.getElementById(`pagination-${subjectId}`);
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }
    
    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `
        <button class="page-btn" 
                onclick="changePage(${subjectId}, ${currentPage - 1})"
                ${currentPage === 1 ? 'disabled' : ''}>
            Previous
        </button>
    `;
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        paginationHTML += `
            <button class="page-btn ${i === currentPage ? 'active' : ''}"
                    onclick="changePage(${subjectId}, ${i})">
                ${i}
            </button>
        `;
    }
    
    // Next button
    paginationHTML += `
        <button class="page-btn" 
                onclick="changePage(${subjectId}, ${currentPage + 1})"
                ${currentPage === totalPages ? 'disabled' : ''}>
            Next
        </button>
    `;
    
    pagination.innerHTML = paginationHTML;
}

// File Operations
async function previewFile(fileId) {
    try {
        const response = await fetch(`/professor/drive/files/${fileId}/preview`);
        if (!response.ok) throw new Error('Failed to get file preview');
        
        const data = await response.json();
        
        // Create and show preview modal
        const previewModal = document.createElement('div');
        previewModal.className = 'modal file-preview-modal';
        previewModal.innerHTML = `
            <div class="modal-content">
                <div class="preview-header">
                    <h3>${data.name}</h3>
                    <div class="preview-actions">
                        <button onclick="openDriveFile('${fileId}')" class="btn btn-primary">
                            Open in Drive
                        </button>
                        <button onclick="closePreview()" class="btn btn-danger">
                            Close
                        </button>
                    </div>
                </div>
                <div class="preview-content">
                    ${getPreviewContent(data)}
                </div>
            </div>
        `;
        
        document.body.appendChild(previewModal);
        previewModal.style.display = 'block';
        
    } catch (error) {
        console.error('Error previewing file:', error);
        showError('Failed to preview file');
    }
}

function getPreviewContent(file) {
    if (file.mimeType.includes('image/')) {
        return `<img src="${file.previewUrl}" alt="${file.name}">`;
    }
    if (file.mimeType.includes('pdf')) {
        return `<iframe src="${file.previewUrl}" width="100%" height="600px"></iframe>`;
    }
    return `<div class="no-preview">Preview not available for this file type</div>`;
}

function closePreview() {
    const modal = document.querySelector('.file-preview-modal');
    if (modal) {
        modal.remove();
    }
}

// Utility Functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function changeFileView(subjectId, viewType) {
    fileState.viewType[subjectId] = viewType;
    const filesList = document.getElementById(`files-${subjectId}`);
    filesList.setAttribute('data-view', viewType);
    loadDriveFiles(subjectId, fileState.currentPage[subjectId]);
}

function searchFiles(subjectId, term) {
    fileState.searchTerm[subjectId] = term;
    loadDriveFiles(subjectId, 1);
}

function changePage(subjectId, page) {
    loadDriveFiles(subjectId, page);
}

// Update the existing updateKnowledgeBaseButton function
function updateKnowledgeBaseButton(subjectId, fileCount = 0) {
    const kbButton = document.getElementById(`kb-btn-${subjectId}`);
    if (kbButton) {
        const hasFiles = fileCount > 0;
        kbButton.disabled = !hasFiles;
        kbButton.classList.toggle('disabled', !hasFiles);
        
        // Update button content based on file status
        if (!hasFiles) {
            kbButton.innerHTML = `
                <i class="fas fa-database"></i>
                <span>No Files to Process</span>
            `;
        } else {
            kbButton.innerHTML = `
                <i class="fas fa-database"></i>
                <span>Update Knowledge Base</span>
            `;
        }
    }
}

// Add this to your script.js
window.addEventListener('message', function(event) {
    if (event.data === 'google-drive-connected') {
        // Refresh Drive status
        loadGoogleDriveStatus();
        // Reload subjects
        loadSubjects();
    }
});

async function loadGoogleDriveStatus() {
    try {
        const response = await fetch('/professor/google/status');
        const data = await response.json();
        state.isDriveConnected = data.connected;
        updateDriveStatus(data.connected);
        updateDriveUI();
    } catch (error) {
        console.error('Error loading Drive status:', error);
        updateDriveStatus(false);
    }
}

function updateDriveStatus(connected) {
    const statusIndicator = document.getElementById('drive-status-indicator');
    const statusText = document.getElementById('drive-status-text');
    const connectBtn = document.getElementById('connect-drive-btn');
    const statusElement = document.getElementById('drive-connection-status');

    if (connected) {
        statusIndicator.className = 'status-indicator status-connected';
        statusText.textContent = 'Connected';
        connectBtn.style.display = 'none';
        //statusElement.className = 'drive-status connected';
        //statusElement.textContent = 'Drive: Connected';
    } else {
        statusIndicator.className = 'status-indicator status-disconnected';
        statusText.textContent = 'Not Connected';
        connectBtn.style.display = 'block';
        //statusElement.className = 'drive-status disconnected';
        //statusElement.textContent = 'Drive: Not Connected';
    }
}

function updateDriveUI() {
    const createSubjectBtn = document.querySelector('.create-subject-btn');
    if (createSubjectBtn) {
        createSubjectBtn.disabled = !state.isDriveConnected;
    }
}
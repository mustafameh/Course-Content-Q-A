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
async function loadGoogleDriveStatus() {
    try {
        const response = await fetch('/professor/google/status');
        const data = await response.json();
        state.isDriveConnected = data.connected;
        updateDriveStatus(data.connected, data.last_synced);
        updateDriveUI();
    } catch (error) {
        console.error('Error loading Drive status:', error);
        updateDriveStatus(false);
    }
}

function updateDriveStatus(connected, lastSynced = null) {
    const statusIndicator = document.getElementById('drive-status-indicator');
    const statusText = document.getElementById('drive-status-text');
    const driveInfo = document.getElementById('drive-info');
    const connectBtn = document.getElementById('connect-drive-btn');
    const statusElement = document.getElementById('drive-connection-status');
    
    if (connected) {
        statusIndicator.className = 'status-indicator status-connected';
        statusText.textContent = 'Connected';
        driveInfo.style.display = 'block';
        connectBtn.style.display = 'none';
        statusElement.className = 'drive-status connected';
        statusElement.textContent = `Drive: Connected${lastSynced ? ` (Last synced: ${new Date(lastSynced).toLocaleString()})` : ''}`;
    } else {
        statusIndicator.className = 'status-indicator status-disconnected';
        statusText.textContent = 'Disconnected';
        driveInfo.style.display = 'none';
        connectBtn.style.display = 'block';
        statusElement.className = 'drive-status disconnected';
        statusElement.textContent = 'Drive: Disconnected';
    }
}

function updateDriveUI() {
    const createDriveBtn = document.getElementById('create-drive-subject-btn');
    const driveTab = document.getElementById('drive-tab');
    
    createDriveBtn.disabled = !state.isDriveConnected;
    if (driveTab) {
        driveTab.style.display = state.isDriveConnected ? 'block' : 'none';
    }
}

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

async function refreshDriveConnection() {
    await loadGoogleDriveStatus();
}

async function disconnectDrive() {
    if (!confirm('Are you sure you want to disconnect Google Drive?')) return;
    
    try {
        const response = await fetch('/professor/google/disconnect', {
            method: 'POST'
        });
        
        if (response.ok) {
            loadGoogleDriveStatus();
        } else {
            throw new Error('Failed to disconnect');
        }
    } catch (error) {
        console.error('Error disconnecting Drive:', error);
        alert('Failed to disconnect Google Drive');
    }
}

// Subject Management
async function loadSubjects() {
    try {
        // Load both regular and Drive subjects
        const [regularResponse, driveResponse] = await Promise.all([
            fetch('/professor/subjects'),
            fetch('/professor/drive/subjects')
        ]);

        const regularData = await regularResponse.json();
        const driveData = await driveResponse.json();
        
        const container = document.getElementById('subjects-container');
        container.innerHTML = ''; // Clear existing content
        
        // Render regular subjects
        regularData.subjects.forEach(subject => {
            const section = createSubjectSection(subject, false);
            container.appendChild(section);
            loadSubjectFiles(subject.id);
        });
        
        // Render Drive subjects
        driveData.subjects.forEach(subject => {
            if (subject.drive_folder_id) {
                const section = createSubjectSection(subject, true);
                container.appendChild(section);
                loadDriveFiles(subject.id);
            }
        });
    } catch (error) {
        console.error('Error loading subjects:', error);
        alert('Failed to load subjects');
    }
}

function createSubjectSection(subject, isDrive) {
    const section = document.createElement('div');
    section.className = `subject-section ${isDrive ? 'drive-subject-section' : ''}`;
    
    const headerContent = `
        <div class="subject-header">
            ${subject.name}
            ${isDrive ? `
                <div class="folder-info">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" 
                         alt="Google Drive" class="google-icon">
                    Drive Folder Connected
                </div>
            ` : ''}
        </div>
    `;
    const uploadZone = isDrive ? `
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
    ` : '';

    
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
        <div class="file-list ${isDrive ? 'drive-files' : ''}" 
             id="files-${subject.id}"
             data-view="list">
            <!-- Files will be loaded here -->
        </div>
        <div class="file-list-footer">
            <div class="pagination" id="pagination-${subject.id}"></div>
        </div>
    `;

    const actionsContent = `
        <div class="action-buttons">
            ${isDrive ? `
                <button onclick="openDriveFolder('${subject.drive_folder_id}')" class="btn btn-primary">
                    <i class="fas fa-external-link-alt"></i> Open in Drive
                </button>
                <button onclick="syncDriveFiles(${subject.id})" class="btn btn-primary">
                    <i class="fas fa-sync"></i> Sync Files
                </button>
            ` : `
                <button onclick="showAddFileModal(${subject.id})" class="btn btn-primary">
                    <i class="fas fa-plus"></i> Add File Path
                </button>
            `}
            <button onclick="updateKnowledgeBase(${subject.id})" 
                    class="btn btn-success" 
                    id="kb-btn-${subject.id}"
                    disabled>
                <i class="fas fa-database"></i> Create/Update Knowledge Base
            </button>
            <button onclick="${isDrive ? 'deleteDriveSubject' : 'deleteSubject'}(${subject.id})" 
                    class="btn btn-danger">
                <i class="fas fa-trash"></i> Delete Subject
            </button>
        </div>
    `;
    
    section.innerHTML = `
        ${headerContent}
        ${uploadZone}
        ${fileListSection}
        ${actionsContent}
    `;
    
    return section;
}

// File Management
async function loadSubjectFiles(subjectId) {
    try {
        const response = await fetch(`/professor/subjects/${subjectId}/files`);
        if (!response.ok) throw new Error('Failed to load files');
        
        const data = await response.json();
        updateFilesList(subjectId, data.files);
    } catch (error) {
        console.error('Error loading files:', error);
    }
}

async function loadDriveFiles(subjectId) {
    try {
        const response = await fetch(`/professor/drive/subjects/${subjectId}/files`);
        if (!response.ok) throw new Error('Failed to load files');
        
        const data = await response.json();
        const filesList = document.getElementById(`files-${subjectId}`);
        filesList.innerHTML = '';
        
        data.files.forEach(file => {
            const fileItem = createDriveFileItem(file, subjectId);
            filesList.appendChild(fileItem);
        });
    } catch (error) {
        console.error('Error loading Drive files:', error);
    }
}

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

function updateKnowledgeBaseButton(subjectId, fileCount) {
    const kbButton = document.getElementById(`kb-btn-${subjectId}`);
    kbButton.disabled = fileCount === 0;
    kbButton.classList.toggle('disabled', fileCount === 0);
}

// Update showCreateSubjectModal function
function showCreateSubjectModal(type = 'regular') {
    const modal = document.getElementById('create-subject-modal');
    modal.style.display = 'block';
    
    // Update UI based on Drive connection status
    const driveTab = document.getElementById('drive-tab');
    if (driveTab) {
        driveTab.style.display = state.isDriveConnected ? 'block' : 'none';
    }
    
    // Switch to appropriate tab
    switchTab(type);
    
    // If trying to open drive tab but not connected, switch to regular
    if (type === 'drive' && !state.isDriveConnected) {
        switchTab('regular');
        alert('Please connect to Google Drive first');
    }
}

function showAddFileModal(subjectId) {
    state.currentSubjectId = subjectId;
    document.getElementById('add-file-modal').style.display = 'block';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'none';
    
    if (modalId === 'create-subject-modal') {
        document.getElementById('new-subject-name').value = '';
        document.getElementById('new-drive-subject-name').value = '';
        document.getElementById('drive-subject-error').style.display = 'none';
    } else if (modalId === 'add-file-modal') {
        document.getElementById('new-file-path').value = '';
        state.currentSubjectId = null;
    }
}

function switchTab(tabName) {
    // Remove active class from all tabs and contents
    const tabs = document.querySelectorAll('.modal-tab');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));
    
    // Add active class to selected tab
    document.querySelector(`.modal-tab[onclick="switchTab('${tabName}')"]`).classList.add('active');
    
    // Add active class to selected content
    const contentId = tabName === 'regular' ? 'regular-tab' : 'drive-tab-content';
    const content = document.getElementById(contentId);
    if (content) {
        content.classList.add('active');
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
    const name = document.getElementById('new-drive-subject-name').value.trim();
    const errorElement = document.getElementById('drive-subject-error');
    
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
async function addFilePath() {
    if (!state.currentSubjectId) return;
    
    const filepath = document.getElementById('new-file-path').value.trim();
    if (!filepath) {
        alert('Please enter a file path');
        return;
    }

    try {
        const response = await fetch(`/professor/subjects/${state.currentSubjectId}/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filepath })
        });

        if (!response.ok) throw new Error('Failed to add file');
        
        closeModal('add-file-modal');
        loadSubjectFiles(state.currentSubjectId);
    } catch (error) {
        console.error('Error adding file:', error);
        alert('Failed to add file');
    }
}

async function deleteFile(fileId, subjectId) {
    if (!confirm('Are you sure you want to remove this file path?')) return;

    try {
        const response = await fetch(`/professor/subjects/files/${fileId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete file');
        
        loadSubjectFiles(subjectId);
    } catch (error) {
        console.error('Error deleting file:', error);
        alert('Failed to delete file');
    }
}

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

// Knowledge Base Operations
async function updateKnowledgeBase(subjectId) {
    if (!confirm('Are you sure you want to create/update the knowledge base? This may take a while.')) return;

    try {
        const response = await fetch(`/professor/subjects/${subjectId}/knowledge-base`, {
            method: 'POST'
        });

        if (!response.ok) throw new Error('Failed to update knowledge base');
        
        alert('Knowledge base updated successfully');
    } catch (error) {
        console.error('Error updating knowledge base:', error);
        alert('Failed to update knowledge base');
    }
}

// Utility Functions
function getFileIcon(mimeType) {
    // Add more mime types as needed
    const iconMap = {
        'application/pdf': '/static/images/icons/pdf.png',
        'application/msword': '/static/images/icons/doc.png',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '/static/images/icons/doc.png',
        'text/plain': '/static/images/icons/txt.png'
    };
    
    return iconMap[mimeType] || '/static/images/icons/file.png';
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
        updateKnowledgeBaseButton(subjectId);
        
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

function createFileItem(file, subjectId, viewType) {
    const fileIcon = getFileIcon(file.mimeType);
    const fileSize = formatFileSize(file.size);
    const modifiedDate = new Date(file.modifiedTime).toLocaleDateString();
    
    if (viewType === 'grid') {
        return `
            <div class="file-item" id="file-${file.id}">
                <img src="${fileIcon}" alt="${file.mimeType}" class="file-icon">
                <div class="file-info">
                    <div class="file-name" title="${file.name}">${file.name}</div>
                    <div class="file-meta">${fileSize} • ${modifiedDate}</div>
                </div>
                <div class="file-actions">
                    <button onclick="previewFile('${file.id}')" class="btn btn-sm btn-primary">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="deleteDriveFile('${file.id}', ${subjectId})" class="btn btn-sm btn-danger">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="file-item" id="file-${file.id}">
            <img src="${fileIcon}" alt="${file.mimeType}" class="file-icon">
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-meta">${fileSize} • ${modifiedDate}</div>
            </div>
            <div class="file-actions">
                <button onclick="previewFile('${file.id}')" class="btn btn-sm btn-primary">Preview</button>
                <button onclick="openDriveFile('${file.id}')" class="btn btn-sm btn-primary">Open</button>
                <button onclick="deleteDriveFile('${file.id}', ${subjectId})" class="btn btn-sm btn-danger">Remove</button>
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
    }
}
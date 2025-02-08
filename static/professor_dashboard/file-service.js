const FileService = {
    // File state management
    fileState: {
        currentPage: {},  // Store current page for each subject
        itemsPerPage: 10,
        fileCache: {},    // Cache file lists
        searchTerm: {},   // Store search terms for each subject
        viewType: {}      // Store view type (list/grid) for each subject
    },

    // File List Management
    async loadDriveFiles(subjectId, page = 1) {
        try {
            const searchTerm = this.fileState.searchTerm[subjectId] || '';
            const response = await fetch(
                `/professor/drive/subjects/${subjectId}/files?page=${page}&search=${searchTerm}`
            );
            
            if (!response.ok) throw new Error('Failed to load files');
            
            const data = await response.json();
            this.fileState.fileCache[subjectId] = data.files;
            this.fileState.currentPage[subjectId] = page;
            
            this.updateFileList(subjectId, data);
            KnowledgeBaseService.updateKnowledgeBaseButton(subjectId, data.files.length);
            
        } catch (error) {
            console.error('Error loading Drive files:', error);
            alert('Failed to load files');
        }
    },

    updateFileList(subjectId, data) {
        const filesList = document.getElementById(`files-${subjectId}`);
        const viewType = this.fileState.viewType[subjectId] || 'list';
        filesList.setAttribute('data-view', viewType);
        
        filesList.innerHTML = data.files.map(file => this.createFileItem(file, subjectId, viewType)).join('');
        
        // Update pagination
        this.updatePagination(subjectId, data.totalPages, data.currentPage);
    },

    // File Item Creation
    createFileItem(file, subjectId, viewType) {
        const fileIcon = this.getFileIcon(file.mimeType);
        const fileSize = this.formatFileSize(file.size);
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
                                <button onclick="FileService.renameFile('${file.id}', '${file.name}')" class="rename-btn" title="Rename">
                                    <i class="fas fa-edit"></i>
                                </button>
                            ` : ''}
                        </div>
                        <div class="file-meta">${fileSize} • ${modifiedDate}</div>
                    </div>
                    <div class="file-actions">
                        <button onclick="FileService.previewFile('${file.id}')" class="btn btn-preview" title="Preview">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="DriveService.openDriveFile('${file.id}')" class="btn btn-open" title="Open in Drive">
                            <i class="fas fa-external-link-alt"></i>
                        </button>
                        ${!isSystemFile ? `
                            <button onclick="FileService.deleteDriveFile('${file.id}', ${subjectId})" class="btn btn-remove" title="Remove">
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
                                <button onclick="FileService.renameFile('${file.id}', '${file.name}')" class="rename-btn" title="Rename">
                                    <i class="fas fa-edit"></i>
                                </button>
                            ` : ''}
                        </div>
                        <div class="file-meta">${fileSize} • ${modifiedDate}</div>
                    </div>
                </div>
                <div class="file-actions">
                    <button onclick="FileService.previewFile('${file.id}')" class="btn btn-preview" title="Preview">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="DriveService.openDriveFile('${file.id}')" class="btn btn-open" title="Open in Drive">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                    ${!isSystemFile ? `
                        <button onclick="FileService.deleteDriveFile('${file.id}', ${subjectId})" class="btn btn-remove" title="Remove">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    },

    // File Operations
    async deleteDriveFile(fileId, subjectId) {
        if (!confirm('Are you sure you want to remove this file?')) return;

        try {
            const response = await fetch(`/professor/drive/files/${fileId}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete file');
            
            this.loadDriveFiles(subjectId);
        } catch (error) {
            console.error('Error deleting file:', error);
            alert('Failed to delete file');
        }
    },

    async renameFile(fileId, currentName) {
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
            await this.loadDriveFiles(subjectId);

        } catch (error) {
            console.error('Error renaming file:', error);
            alert('Failed to rename file: ' + error.message);
        }
    },

    // File Upload Handlers
    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.classList.add('drag-over');
    },

    handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.classList.remove('drag-over');
    },

    async handleFileDrop(event, subjectId) {
        event.preventDefault();
        event.stopPropagation();
        
        const uploadZone = event.currentTarget;
        uploadZone.classList.remove('drag-over');
        
        const files = Array.from(event.dataTransfer.files);
        await this.uploadFiles(files, subjectId);
    },

    async handleFileSelect(event, subjectId) {
        const files = Array.from(event.target.files);
        await this.uploadFiles(files, subjectId);
        // Reset file input
        event.target.value = '';
    },

    async uploadFiles(files, subjectId) {
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
            await this.loadDriveFiles(subjectId);
            
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
    },

    // Utility Functions
    getFileIcon(mimeType) {
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
        
        return iconMap[mimeType] || 'https://cdn-icons-png.flaticon.com/512/337/337937.png';
    },

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // View and Search Functions
    changeFileView(subjectId, viewType) {
        this.fileState.viewType[subjectId] = viewType;
        const filesList = document.getElementById(`files-${subjectId}`);
        filesList.setAttribute('data-view', viewType);
        this.loadDriveFiles(subjectId, this.fileState.currentPage[subjectId]);
    },

    searchFiles(subjectId, term) {
        this.fileState.searchTerm[subjectId] = term;
        this.loadDriveFiles(subjectId, 1);
    },

    // Pagination
    updatePagination(subjectId, totalPages, currentPage) {
        const pagination = document.getElementById(`pagination-${subjectId}`);
        if (totalPages <= 1) {
            pagination.style.display = 'none';
            return;
        }
        
        let paginationHTML = '';
        
        // Previous button
        paginationHTML += `
            <button class="page-btn" 
                    onclick="FileService.changePage(${subjectId}, ${currentPage - 1})"
                    ${currentPage === 1 ? 'disabled' : ''}>
                Previous
            </button>
        `;
        
        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `
                <button class="page-btn ${i === currentPage ? 'active' : ''}"
                        onclick="FileService.changePage(${subjectId}, ${i})">
                    ${i}
                </button>
            `;
        }
        
        // Next button
        paginationHTML += `
            <button class="page-btn" 
                    onclick="FileService.changePage(${subjectId}, ${currentPage + 1})"
                    ${currentPage === totalPages ? 'disabled' : ''}>
                Next
            </button>
        `;
        
        pagination.innerHTML = paginationHTML;
    },

    changePage(subjectId, page) {
        this.loadDriveFiles(subjectId, page);
    }
};
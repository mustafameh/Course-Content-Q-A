/**
 * KnowledgeBaseService
 * 
 * Manages the knowledge base functionality for subjects:
 * - Syncing files with knowledge base
 * - Updating knowledge base status
 * - Managing KB-related UI elements
 * 
 * Key Functions:
 * - updateKnowledgeBase(): Syncs files and updates the knowledge base
 * - updateKnowledgeBaseButton(): Updates KB button state based on file count
 * - syncDriveFiles(): Synchronizes files with Google Drive
 */


const KnowledgeBaseService = {
    async updateKnowledgeBase(subjectId) {
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
    },

    updateKnowledgeBaseButton(subjectId, fileCount = 0) {
        const kbButton = document.getElementById(`kb-btn-${subjectId}`);
        if (kbButton) {
            const hasFiles = fileCount > 0;
            kbButton.disabled = !hasFiles;
            kbButton.classList.toggle('disabled', !hasFiles);
            
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
    },

    async syncDriveFiles(subjectId) {
        try {
            const response = await fetch(`/professor/drive/subjects/${subjectId}/sync`, {
                method: 'POST'
            });
            
            if (!response.ok) throw new Error('Failed to sync files');
            
            FileService.loadDriveFiles(subjectId);
        } catch (error) {
            console.error('Error syncing files:', error);
            alert('Failed to sync files');
        }
    }
};
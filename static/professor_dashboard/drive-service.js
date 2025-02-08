// drive-service.js
const DriveService = {
    // Tracks the Google Drive connection status
    isDriveConnected: false,


    // AUTHENTICATION & CONNECTION MANAGEMENT
    // Initiates the Google Drive OAuth flow
    // Creates popup window for Google authentication

    async connectGoogleDrive() {
        try {
            const response = await fetch('/professor/google/auth/start');
            const data = await response.json();
            
            if (data.auth_url) {
                this.openGoogleAuthWindow(data.auth_url);
                this.startConnectionCheck();
            }
        } catch (error) {
            console.error('Error starting Google auth:', error);
            alert('Failed to connect to Google Drive');
        }
    },

    // Helper function to create centered popup window for Google auth
    // Handles the OAuth redirect flow
    
    openGoogleAuthWindow(authUrl) {
        const width = 600;
        const height = 700;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;
        
        window.open(
            authUrl,
            'Connect Google Drive',
            `width=${width},height=${height},top=${top},left=${left}`
        );
    },

    // Polls the server to check if Google Drive connection is established
    // Runs every 2 seconds until connection is confirmed

    startConnectionCheck() {
        const checkInterval = setInterval(async () => {
            const statusResponse = await fetch('/professor/google/status');
            const statusData = await statusResponse.json();
            
            if (statusData.connected) {
                clearInterval(checkInterval);
                this.loadGoogleDriveStatus();
            }
        }, 2000);
    },

    // CONNECTION STATUS MANAGEMENT
    // Fetches and updates the current Google Drive connection status
    // Updates UI elements based on connection state
    async loadGoogleDriveStatus() {
        try {
            const response = await fetch('/professor/google/status');
            const data = await response.json();
            this.isDriveConnected = data.connected;
            this.updateDriveStatus(data.connected);
            this.updateDriveUI();
        } catch (error) {
            console.error('Error loading Drive status:', error);
            this.updateDriveStatus(false);
        }
    },

    // UI UPDATES
    // Updates the connection status indicators in the UI
    // Controls visibility of connect button

    updateDriveStatus(connected) {
        const statusIndicator = document.getElementById('drive-status-indicator');
        const statusText = document.getElementById('drive-status-text');
        const connectBtn = document.getElementById('connect-drive-btn');

        if (connected) {
            statusIndicator.className = 'status-indicator status-connected';
            statusText.textContent = 'Connected';
            connectBtn.style.display = 'none';
        } else {
            statusIndicator.className = 'status-indicator status-disconnected';
            statusText.textContent = 'Not Connected';
            connectBtn.style.display = 'block';
        }
    },

    // Updates UI elements that depend on Drive connection status
    // Currently handles the create subject button state

    updateDriveUI() {
        const createSubjectBtn = document.querySelector('.create-subject-btn');
        if (createSubjectBtn) {
            createSubjectBtn.disabled = !this.isDriveConnected;
        }
    },
    // DRIVE OPERATIONS
    // Opens a Google Drive folder in a new tab
    // Used for viewing subject folders

    openDriveFolder(folderId) {
        window.open(`https://drive.google.com/drive/folders/${folderId}`, '_blank');
    },

    // Opens a specific Google Drive file in a new tab
    // Used for viewing individual files

    openDriveFile(fileId) {
        window.open(`https://drive.google.com/file/d/${fileId}/view`, '_blank');
    }
};
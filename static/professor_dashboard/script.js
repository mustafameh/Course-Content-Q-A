/**
 * Main Dashboard Script
 * 
 * Core dashboard functionality and initialization:
 * - Global state management
 * - Event listeners and initialization
 * - Professor profile management
 * - Authentication handling
 * 
 * Key Components:
 * - state: Global application state
 * - initializeDashboard(): Initializes dashboard components
 * - loadProfessorProfile(): Manages professor profile data
 * - Event Listeners: Handles DOM events and Google Drive connection
 * - Authentication: Handles logout functionality
 * 
 * Note: This file acts as the main coordinator between different services:
 * - DriveService: Google Drive integration
 * - SubjectService: Subject management
 * - FileService: File operations
 * - ModalService: Modal handling
 * - KnowledgeBaseService: KB operations
 */
const state = {
    currentSubjectId: null,
    get isDriveConnected() {
        return DriveService.isDriveConnected;
    }
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
        SubjectService.loadSubjects(),
        DriveService.loadGoogleDriveStatus()
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




// Add this to your script.js
window.addEventListener('message', function(event) {
    if (event.data === 'google-drive-connected') {
        DriveService.loadGoogleDriveStatus();
        loadSubjects();
    }
});

// Add to your existing script.js
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Show a brief success message
        const tooltip = document.createElement('div');
        tooltip.className = 'copy-tooltip';
        tooltip.textContent = 'URL copied!';
        document.body.appendChild(tooltip);
        
        setTimeout(() => {
            tooltip.remove();
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}


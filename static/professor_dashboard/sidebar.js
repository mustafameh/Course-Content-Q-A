// sidebar.js
document.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const icon = toggleButton.querySelector('i') || document.createElement('i');
    
    // Initialize icon
    icon.className = 'fas fa-bars';
    if (!toggleButton.querySelector('i')) {
        toggleButton.appendChild(icon);
    }

    toggleButton.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
        
        // Update icon
        if (sidebar.classList.contains('collapsed')) {
            icon.className = 'fas fa-bars';
            toggleButton.title = 'Expand Sidebar';
        } else {
            icon.className = 'fas fa-times';
            toggleButton.title = 'Collapse Sidebar';
        }
    });
});

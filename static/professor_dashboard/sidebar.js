document.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const icon = toggleButton.querySelector('i') || document.createElement('i');
    
    // Initialize icon
    icon.className = 'fas fa-chevron-left';
    if (!toggleButton.querySelector('i')) {
        toggleButton.appendChild(icon);
    }

    toggleButton.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
        
        // Update icon
        icon.className = sidebar.classList.contains('collapsed') 
            ? 'fas fa-chevron-right' 
            : 'fas fa-chevron-left';

        // Update toggle button position
        if (sidebar.classList.contains('collapsed')) {
            toggleButton.style.left = '20px'; // Adjust as needed
        } else {
            toggleButton.style.left = `calc(var(--sidebar-width) - 16px)`; // Adjust as needed
        }
    });
});
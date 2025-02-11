document.addEventListener('DOMContentLoaded', function() {
    // Initialize stats counter
    fetchAndUpdateStats();
    
    // Initialize professor search
    initializeProfessorSearch();
    
    // Initialize contact form
    initializeContactForm();
    
    // Initialize scroll animations
    initializeScrollAnimations();
});

// Stats Counter
async function fetchAndUpdateStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        
        // Animate counting up for each stat
        animateCounter('professorCount', stats.professorCount);
        animateCounter('subjectCount', stats.subjectCount);
        animateCounter('documentCount', stats.documentCount);
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    const duration = 2000; // 2 seconds
    const steps = 60;
    const stepValue = targetValue / steps;
    let currentStep = 0;
    
    const interval = setInterval(() => {
        currentStep++;
        const currentValue = Math.round(stepValue * currentStep);
        element.textContent = currentValue;
        
        if (currentStep >= steps) {
            element.textContent = targetValue;
            clearInterval(interval);
        }
    }, duration / steps);
}

// Professor Search
function initializeProfessorSearch() {
    const searchInput = document.getElementById('professorSearch');
    const resultsContainer = document.getElementById('searchResults');
    let debounceTimeout;

    searchInput.addEventListener('input', function(e) {
        clearTimeout(debounceTimeout);
        
        debounceTimeout = setTimeout(async () => {
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                resultsContainer.innerHTML = '';
                return;
            }
            
            try {
                const response = await fetch(`/api/professors/search?query=${encodeURIComponent(query)}`);
                const professors = await response.json();
                
                displaySearchResults(professors, resultsContainer);
            } catch (error) {
                console.error('Error searching professors:', error);
            }
        }, 300); // Debounce delay
    });

    // Close results when clicking outside
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.innerHTML = '';
        }
    });
}

function displaySearchResults(professors, container) {
    if (professors.length === 0) {
        container.innerHTML = '<div class="no-results">No professors found</div>';
        return;
    }
    
    container.innerHTML = professors.map(prof => `
        <a href="${prof.url}" class="search-result-item">
            <div class="professor-info">
                <span class="professor-name">${prof.username}</span>
                ${prof.institution ? `<span class="professor-institution">${prof.institution}</span>` : ''}
            </div>
        </a>
    `).join('');
}

// Contact Form
function initializeContactForm() {
    const form = document.getElementById('contactForm');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
            name: form.querySelector('input[type="text"]').value,
            email: form.querySelector('input[type="email"]').value,
            message: form.querySelector('textarea').value
        };
        
        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                showNotification('Message sent successfully!', 'success');
                form.reset();
            } else {
                showNotification('Error sending message. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            showNotification('Error sending message. Please try again.', 'error');
        }
    });
}

// Notification System
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Fade in
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Scroll Animations
function initializeScrollAnimations() {
    const elements = document.querySelectorAll('.feature-card, .stat-item, .contact-container');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });
    
    elements.forEach(element => observer.observe(element));
}

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Navbar scroll behavior
let lastScroll = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll <= 0) {
        navbar.classList.remove('scroll-up');
        return;
    }
    
    if (currentScroll > lastScroll && !navbar.classList.contains('scroll-down')) {
        // Scrolling down
        navbar.classList.remove('scroll-up');
        navbar.classList.add('scroll-down');
    } else if (currentScroll < lastScroll && navbar.classList.contains('scroll-down')) {
        // Scrolling up
        navbar.classList.remove('scroll-down');
        navbar.classList.add('scroll-up');
    }
    
    lastScroll = currentScroll;
});
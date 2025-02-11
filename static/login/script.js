document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (data.user.role === 'professor') {
                window.location.href = '/professor/dashboard';
            } else {
                window.location.href = '/chat';
            }
        } else {
            document.getElementById('error').textContent = data.error || 'Login failed';
        }
    } catch (error) {
        document.getElementById('error').textContent = 'An error occurred. Please try again.';
    }
});
(function() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle.querySelector('.theme-icon');
    const html = document.documentElement;
    
    const savedTheme = localStorage.getItem('theme') || 'light';
    
    if (savedTheme === 'dark') {
        html.setAttribute('data-theme', 'dark');
        themeIcon.textContent = 'light_mode.sh';
    } else {
        html.setAttribute('data-theme', 'light');
        themeIcon.textContent = 'dark_mode.sh';
    }
    
    themeToggle.addEventListener('click', function() {
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        themeIcon.textContent = newTheme === 'dark' ? 'light_mode.sh' : 'dark_mode.sh';
    });
})();


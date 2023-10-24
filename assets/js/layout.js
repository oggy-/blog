document.addEventListener('DOMContentLoaded', adjustSlidebarPosition);
window.addEventListener('resize', adjustSlidebarPosition);

document.addEventListener('DOMContentLoaded', addToggleSidebarListener);

function adjustSlidebarPosition() {
    const headerHeight = document.querySelector('.site-header').offsetHeight;
    const slidebar = document.getElementById('toc-wrapper');
    slidebar.style.top = `${headerHeight}px`;
}

window.addEventListener("load", function() {
    const slidebar = document.querySelector('.toc-fixed');

    // Function to set checkbox state based on window width
    function setCheckboxState() {
        if (window.innerWidth <= 768) { // Assuming 768px is the breakpoint
            slidebar.classList.add('collapsed');
            const contents = document.getElementById('non-toc-wrapper');
            contents.style.left = `30px`;

        }

    }

    // Set initial state
    setCheckboxState();

    // Update state on window resize
    window.addEventListener("resize", setCheckboxState);
});

function addToggleSidebarListener() {
    let toggle = document.getElementById('toc-toggle');
    toggle.addEventListener('click', function() {
        const slidebar = document.querySelector('.toc-fixed');
        const contents = document.getElementById('non-toc-wrapper');
        const slidebarWrapper = document.getElementById('toc-wrapper');
        if (slidebar.classList.contains('collapsed')) {
            slidebar.classList.remove('collapsed');
            const offset = slidebarWrapper.offsetWidth + 10;
            contents.style.left = `${offset}px`;
        } else {
            slidebar.classList.add('collapsed');
            const offset = slidebarWrapper.offsetWidth + 10;
            contents.style.left = `${offset}px`;
        }

    });
}


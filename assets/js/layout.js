document.addEventListener('DOMContentLoaded', adjustSlidebarPosition);
window.addEventListener('resize', adjustSlidebarPosition);

document.addEventListener('DOMContentLoaded', addToggleSidebarListener);

function adjustSlidebarPosition() {
    const slidebar = document.getElementById('toc-wrapper');
    if(slidebar) {
        const headerHeight = document.querySelector('.site-header').offsetHeight;
        slidebar.style.top = `${headerHeight}px`;
    }
}

function limitContentWidth() {
    const contents = document.getElementById('non-toc-wrapper');
    const slidebarWrapper = document.getElementById('toc-wrapper');
    const offset = slidebarWrapper.offsetWidth + 10;
    const maxWidth = window.innerWidth - offset;
    contents.style.maxWidth = `${maxWidth}px`;
    contents.style.paddingLeft = `${offset}px`;
    if(window.innerWidth >= 768){
        contents.style.paddingRight = `${offset}px`;
    }
}
window.addEventListener("load", function() {
    const slidebar = document.querySelector('.toc-fixed');
    if(slidebar) {
        // Function to set checkbox state based on window width
        function setCheckboxState() {
            if (window.innerWidth <= 768) { // Assuming 768px is the breakpoint
                slidebar.classList.add('collapsed');
            }
            limitContentWidth();

        }
        // Set initial state
        setCheckboxState();

        // Update state on window resize
        window.addEventListener("resize", setCheckboxState);
    }
});

function addToggleSidebarListener() {
    let toggle = document.getElementById('toc-toggle');
    if(toggle) {
        toggle.addEventListener('click', function() {
            const slidebar = document.querySelector('.toc-fixed');
            if (slidebar.classList.contains('collapsed')) {
                slidebar.classList.remove('collapsed');
            } else {
                slidebar.classList.add('collapsed');
            }
            limitContentWidth();

        });
    }
}


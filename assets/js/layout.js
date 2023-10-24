window.addEventListener("DOMContentLoaded", function() {
    var checkbox = document.getElementById('toc-toggle');

    // Function to set checkbox state based on window width
    function setCheckboxState() {
        if (window.innerWidth <= 768) { // Assuming 768px is the breakpoint
            checkbox.checked = false;
        } else {
            checkbox.checked = true;
        }
    }

    // Set initial state
    setCheckboxState();

    // Update state on window resize
    window.addEventListener("resize", setCheckboxState);
});

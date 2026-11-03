(function () {
    // 1. Inject PDF.js and PDF.js Worker scripts dynamically if not already present
    function loadScript(src, callback) {
        if (document.querySelector(`script[src="${src}"]`)) {
            if (callback) callback();
            return;
        }
        let script = document.createElement('script');
        script.src = src;
        script.onload = callback;
        document.head.appendChild(script);
    }

    loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', function () {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        initPdfViewers();
    });

    // 2. Find and initialize all PDF viewer placeholders on the page
    function initPdfViewers() {
        const containers = document.querySelectorAll('.pdf-viewer');
        
        containers.forEach(container => {
            const pdfUrl = container.getAttribute('data-pdf');
            if (!pdfUrl) return;

            // Apply styling wrapper
            container.classList.add('pdf-viewer-container');
            container.innerHTML = '<div class="pdf-loading">Loading PDF...</div>';

            // Load and render PDF
            pdfjsLib.getDocument(pdfUrl).promise.then(function(pdfDoc) {
                container.innerHTML = ''; // Clear loading text

                for (let num = 1; num <= pdfDoc.numPages; num++) {
                    renderPage(pdfDoc, num, container);
                }
            }).catch(function(error) {
                console.error('Error loading PDF:', error);
                container.innerHTML = `<div class="pdf-error">Failed to load PDF. <a href="${pdfUrl}" target="_blank">Download instead</a></div>`;
            });
        });
    }

    // 3. Render individual pages onto responsive canvases
    function renderPage(pdfDoc, num, container) {
        pdfDoc.getPage(num).then(function(page) {
            // Scale dynamically based on container width for mobile responsiveness
            let containerWidth = container.clientWidth || 600;
            let unscaledViewport = page.getViewport({ scale: 1.0 });
            let scale = (containerWidth - 30) / unscaledViewport.width;
            if (scale < 1.0) scale = 1.0; // Don't shrink too small

            let viewport = page.getViewport({ scale: scale });

            let canvas = document.createElement('canvas');
            let ctx = canvas.getContext('2d');
            canvas.className = 'pdf-page-canvas';
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            container.appendChild(canvas);

            let renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };
            page.render(renderContext);
        });
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const sheetCards = document.querySelectorAll('.sheet-card');

    // Optional: Ensure cards match the initial active button ("piano") on load
    const activeFilter = document.querySelector('.filter-btn.active').getAttribute('data-filter');
    sheetCards.forEach(card => {
        if (card.getAttribute('data-category') !== activeFilter) {
            card.classList.add('hide');
        }
    });

    // Click event listeners for switching tabs
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const filterValue = button.getAttribute('data-filter');

            sheetCards.forEach(card => {
                const cardCategory = card.getAttribute('data-category');

                if (cardCategory === filterValue) {
                    card.classList.remove('hide');
                } else {
                    card.classList.add('hide');
                }
            });
        });
    });
});

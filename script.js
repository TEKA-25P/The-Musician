window.tailwind = window.tailwind || {};
window.tailwind.config = {
    theme: {
        extend: {
            fontFamily: {
                sans: ['Plus Jakarta Sans', 'sans-serif'],
                serif: ['Playfair Display', 'serif'],
            },
            colors: {
                brand: {
                    cyan: '#06b6d4',
                    purple: '#8b5cf6',
                    emerald: '#10b981',
                    dark: '#0f172a',
                    slate: '#1e293b'
                }
            },
            animation: {
                'pulse-glow': 'pulseGlow 3s infinite ease-in-out',
                'float': 'float 6s infinite ease-in-out',
                'shimmer': 'shimmer 2.5s infinite linear',
            },
            keyframes: {
                pulseGlow: {
                    '0%, 100%': { boxShadow: '0 0 20px rgba(6, 182, 212, 0.3), inset 0 0 15px rgba(6, 182, 212, 0.2)' },
                    '50%': { boxShadow: '0 0 35px rgba(139, 92, 246, 0.5), inset 0 0 25px rgba(139, 92, 246, 0.3)' }
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-12px)' }
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' }
                }
            }
        }
    }
};

const pdfJsUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';

function loadPdfJs() {
    return new Promise((resolve, reject) => {
        if (window.pdfjsLib) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = pdfJsUrl;
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load PDF.js.'));
        document.head.appendChild(script);
    });
}

function renderPdfPage(pdf, pageNumber, container) {
    pdf.getPage(pageNumber).then(page => {
        const containerWidth = container.clientWidth || 600;
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const scale = Math.max(1.0, (containerWidth - 30) / unscaledViewport.width);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        canvas.className = 'pdf-page-canvas';
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        container.appendChild(canvas);
        page.render({ canvasContext: context, viewport });
    });
}

function initializePdfViewers() {
    const containers = document.querySelectorAll('.pdf-viewer');
    if (!containers.length) return;

    containers.forEach(container => {
        const pdfUrl = container.getAttribute('data-pdf');
        if (!pdfUrl) return;

        container.classList.add('pdf-viewer-container');
        container.innerHTML = '<div class="pdf-loading">Loading PDF...</div>';
    });

    loadPdfJs().then(() => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        containers.forEach(container => {
            const pdfUrl = container.getAttribute('data-pdf');
            if (!pdfUrl) return;

            window.pdfjsLib.getDocument(pdfUrl).promise.then(pdf => {
                container.innerHTML = '';
                for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
                    renderPdfPage(pdf, pageNumber, container);
                }
            }).catch(error => {
                console.error('Error loading PDF:', error);
                container.innerHTML =
                    `<div class="pdf-error">Failed to load PDF. <a href="${pdfUrl}" target="_blank" rel="noopener noreferrer">Download instead</a></div>`;
            });
        });
    }).catch(error => {
        console.error(error);
        containers.forEach(container => {
            container.innerHTML = '<div class="pdf-error">Failed to load the PDF viewer.</div>';
        });
    });
}

function initializeSheetFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const sheetCards = document.querySelectorAll('.sheet-card');
    const activeFilter = document.querySelector('.filter-btn.active');

    if (activeFilter) {
        const activeCategory = activeFilter.getAttribute('data-filter');
        sheetCards.forEach(card => {
            if (card.getAttribute('data-category') !== activeCategory) {
                card.classList.add('hide');
            }
        });
    }

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(filterButton => filterButton.classList.remove('active'));
            button.classList.add('active');

            const filterValue = button.getAttribute('data-filter');
            sheetCards.forEach(card => {
                card.classList.toggle('hide', card.getAttribute('data-category') !== filterValue);
            });
        });
    });
}

function initializeHeader() {
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const fontAwesome = document.createElement('link');
        fontAwesome.rel = 'stylesheet';
        fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        document.head.appendChild(fontAwesome);
    }

    const isSheetPage = /\/sheets\//i.test(window.location.pathname);
    const basePath = isSheetPage ? '../' : '';
    const fileName = window.location.pathname.split('/').pop().toLowerCase();
    const activePage = fileName === 'about.html'
        ? 'about'
        : fileName === 'index.html' || !fileName
            ? 'home'
            : 'sheets';
    const contactUrl = 'https://wa.me/201212405466?text=Hi%20TEKA,%20I%20came%20from%20The%20Musician%20website!';
    const nav = document.createElement('nav');
    nav.className = 'site-nav';
    nav.innerHTML = `
        <div class="site-nav-inner">
            <a href="${basePath}index.html" class="site-brand">
                <span class="site-brand-clef" aria-hidden="true">𝄞</span>
                <span class="site-brand-word">TEKA <span class="site-brand-music">MUSIC</span><span class="site-brand-note" aria-hidden="true">♪</span></span>
            </a>
            <div class="site-nav-links">
                <a href="${basePath}index.html" data-page="home">Home</a>
                <a href="${basePath}sheets.html" data-page="sheets">Sheet Music</a>
                <a href="${basePath}about.html" data-page="about">About</a>
            </div>
            <a href="${contactUrl}" target="_blank" rel="noopener noreferrer" class="site-nav-cta">
                <i class="fa-brands fa-whatsapp" aria-hidden="true"></i>
                <span>Order Custom Score</span>
            </a>
            <button class="site-nav-toggle" type="button" aria-label="Toggle Navigation" aria-expanded="false" aria-controls="site-mobile-menu">
                <i class="fa-solid fa-bars" aria-hidden="true"></i>
            </button>
        </div>
        <div class="site-nav-mobile" id="site-mobile-menu">
            <a href="${basePath}index.html" data-page="home">Home</a>
            <a href="${basePath}sheets.html" data-page="sheets">Sheet Music</a>
            <a href="${basePath}about.html" data-page="about">About</a>
            <a href="${contactUrl}" target="_blank" rel="noopener noreferrer" class="site-nav-mobile-cta">
                <i class="fa-brands fa-whatsapp" aria-hidden="true"></i>
                Chat on WhatsApp
            </a>
        </div>
    `;

    nav.querySelectorAll(`[data-page="${activePage}"]`).forEach(link => {
        link.setAttribute('aria-current', 'page');
    });

    const existingHeader = document.querySelector('.header');
    if (existingHeader) {
        existingHeader.replaceWith(nav);
    } else {
        document.body.prepend(nav);
    }

    const spacer = document.createElement('div');
    spacer.className = 'site-nav-spacer';
    spacer.setAttribute('aria-hidden', 'true');
    nav.insertAdjacentElement('afterend', spacer);

    const menuButton = nav.querySelector('.site-nav-toggle');
    const mobileMenu = nav.querySelector('.site-nav-mobile');
    menuButton.addEventListener('click', () => {
        const isOpen = mobileMenu.classList.toggle('is-open');
        menuButton.setAttribute('aria-expanded', String(isOpen));
    });

    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.remove('is-open');
            menuButton.setAttribute('aria-expanded', 'false');
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initializeHeader();
    initializeSheetFilters();
    initializePdfViewers();

    const year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();
});

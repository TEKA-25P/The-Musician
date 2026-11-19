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
const midiModuleUrl = 'https://cdn.jsdelivr.net/npm/@tonejs/midi@2.0.28/+esm';
const toneModuleUrl = 'https://cdn.jsdelivr.net/npm/tone@14.8.49/+esm';
let pdfJsPromise;
let midiLibrariesPromise;
let activeMidiPlayback;
let pendingMidiButton;

function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve();
    if (pdfJsPromise) return pdfJsPromise;

    pdfJsPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = pdfJsUrl;
        script.onload = () => resolve();
        script.onerror = () => {
            pdfJsPromise = null;
            reject(new Error('Failed to load PDF.js.'));
        };
        document.head.appendChild(script);
    });
    return pdfJsPromise;
}

async function renderPdfPage(pdf, pageNumber, container, isCurrentRequest) {
    const page = await pdf.getPage(pageNumber);
    if (!isCurrentRequest()) return;

    const containerWidth = container.clientWidth || 600;
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const scale = Math.max(1.0, (containerWidth - 30) / unscaledViewport.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) throw new Error('Unable to create a canvas for the PDF page.');

    canvas.className = 'pdf-page-canvas';
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    container.appendChild(canvas);
    await page.render({ canvasContext: context, viewport }).promise;
}

async function renderPdfViewer(container) {
    const pdfUrl = container.getAttribute('data-pdf');
    if (!pdfUrl) return;

    const requestId = String(Date.now()) + Math.random();
    container.dataset.pdfRequestId = requestId;
    container.classList.add('pdf-viewer-container');
    container.innerHTML = '<div class="pdf-loading">Loading PDF...</div>';

    try {
        await loadPdfJs();
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const pdf = await window.pdfjsLib.getDocument(pdfUrl).promise;
        if (container.dataset.pdfRequestId !== requestId) return;

        container.innerHTML = '';
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            await renderPdfPage(
                pdf,
                pageNumber,
                container,
                () => container.dataset.pdfRequestId === requestId
            );
        }
    } catch (error) {
        console.error('Error loading PDF:', error);
        if (container.dataset.pdfRequestId !== requestId) return;
        container.innerHTML =
            `<div class="pdf-error">Failed to load PDF. <a href="${pdfUrl}" target="_blank" rel="noopener noreferrer">Download instead</a></div>`;
    }
}

function initializePdfViewers() {
    document.querySelectorAll('.pdf-viewer').forEach(renderPdfViewer);
}

function initializeSheetMediaControls() {
    const sheetCards = document.querySelectorAll(
        '.sheet-card[data-category="piano"], .sheet-card[data-category="guitar"]'
    );

    sheetCards.forEach(card => {
        const viewer = card.querySelector('.pdf-viewer');
        if (!viewer) return;

        const defaultPdfUrl = viewer.getAttribute('data-pdf');
        if (!defaultPdfUrl) return;

        const sheetBaseUrl = defaultPdfUrl.replace(/_(dark|light|vintage)\.pdf$/i, '');
        if (sheetBaseUrl === defaultPdfUrl) {
            console.error('Sheet PDF filename must include a theme suffix:', defaultPdfUrl);
            return;
        }

        const heading = card.querySelector('h2');
        const instrument = heading ? heading.textContent.replace(/\s+Sheet$/i, '') : 'Sheet';
        const controls = document.createElement('div');
        controls.className = 'sheet-controls';

        const themeLabel = document.createElement('label');
        themeLabel.className = 'sheet-theme-control';
        themeLabel.textContent = 'Theme';

        const themeSelect = document.createElement('select');
        themeSelect.className = 'sheet-theme-select';
        themeSelect.setAttribute('aria-label', `${instrument} sheet theme`);

        ['dark', 'light', 'vintage'].forEach(theme => {
            const option = document.createElement('option');
            option.value = theme;
            option.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
            themeSelect.appendChild(option);
        });

        themeSelect.value = 'dark';
        themeSelect.addEventListener('change', () => {
            viewer.setAttribute('data-pdf', `${sheetBaseUrl}_${themeSelect.value}.pdf`);
            renderPdfViewer(viewer);
        });
        themeLabel.appendChild(themeSelect);

        controls.appendChild(themeLabel);
        viewer.insertAdjacentElement('beforebegin', controls);
    });

    initializeSheetAudioPlayer();
}

function initializeSheetAudioPlayer() {
    const sheetsContainer = document.querySelector('.sheets-container')
        || document.querySelector('.sheets-grid');
    if (!sheetsContainer) return;
    const sheetCards = document.querySelectorAll('.sheet-card');
    const insertionPoint = sheetsContainer.classList.contains('sheets-container')
        ? sheetsContainer
        : sheetCards.length
            ? sheetCards[sheetCards.length - 1]
            : sheetsContainer;

    const pageName = window.location.pathname.split('/').pop().replace(/\.html$/i, '');
    const firstViewer = document.querySelector('.pdf-viewer');
    const firstPdfUrl = firstViewer ? firstViewer.getAttribute('data-pdf') : '';
    const sheetBaseUrl = firstPdfUrl
        ? firstPdfUrl.replace(/_\((piano|guitar)\)_(dark|light|vintage)\.pdf$/i, '')
        : `../Sheets_Data/${pageName}`;
    const instruments = [
        {
            value: 'piano',
            label: 'Piano',
            available: Boolean(document.querySelector('.sheet-card[data-category="piano"] .pdf-viewer'))
        },
        {
            value: 'guitar',
            label: 'Guitar',
            available: Boolean(document.querySelector('.sheet-card[data-category="guitar"] .pdf-viewer'))
        },
        {
            value: 'vocal',
            label: 'Vocal',
            available: false
        }
    ];

    const audioContainer = document.createElement('section');
    audioContainer.className = 'sheet-audio-container';
    audioContainer.setAttribute('aria-labelledby', 'sheet-audio-title');

    const heading = document.createElement('h2');
    heading.id = 'sheet-audio-title';
    heading.textContent = 'Listen to the Sheet';

    const description = document.createElement('p');
    description.className = 'sheet-audio-description';
    description.textContent = 'Choose an instrument to play its MIDI recording.';

    const controls = document.createElement('div');
    controls.className = 'sheet-audio-controls';

    const instrumentLabel = document.createElement('label');
    instrumentLabel.className = 'sheet-audio-instrument-control';
    instrumentLabel.textContent = 'Instrument';

    const instrumentSelect = document.createElement('select');
    instrumentSelect.className = 'sheet-audio-instrument-select';
    instrumentSelect.setAttribute('aria-label', 'Audio instrument');

    instruments.forEach(instrument => {
        const option = document.createElement('option');
        option.value = instrument.value;
        option.textContent = instrument.available
            ? instrument.label
            : `${instrument.label} (This isn't available)`;
        instrumentSelect.appendChild(option);
    });

    const playButton = document.createElement('button');
    playButton.className = 'sheet-audio-play-button';
    playButton.type = 'button';
    playButton.textContent = '▶ Play';

    const progressRow = document.createElement('div');
    progressRow.className = 'sheet-audio-progress-row';

    const progress = document.createElement('progress');
    progress.className = 'sheet-audio-progress';
    progress.max = 1;
    progress.value = 0;
    progress.setAttribute('aria-label', 'Audio playback progress');

    const progressLabel = document.createElement('span');
    progressLabel.className = 'sheet-audio-time';
    progressLabel.textContent = '00:00 / 00:00';

    const status = document.createElement('p');
    status.className = 'sheet-audio-status';
    status.setAttribute('aria-live', 'polite');

    instrumentLabel.appendChild(instrumentSelect);
    controls.append(instrumentLabel, playButton);
    progressRow.append(progress, progressLabel);
    audioContainer.append(heading, description, controls, progressRow, status);
    insertionPoint.insertAdjacentElement('afterend', audioContainer);

    function updateInstrument() {
        if (activeMidiPlayback) stopMidiPlayback('Playback stopped.');

        const selectedInstrument = instruments.find(
            instrument => instrument.value === instrumentSelect.value
        );
        const available = selectedInstrument && selectedInstrument.available;
        playButton.disabled = !available;
        playButton.textContent = '▶ Play';
        progress.value = 0;
        progressLabel.textContent = '00:00 / 00:00';
        status.textContent = available
            ? `${selectedInstrument.label} MIDI is ready.`
            : `${selectedInstrument ? selectedInstrument.label : 'This option'} isn't available.`;
    }

    instrumentSelect.addEventListener('change', updateInstrument);
    playButton.addEventListener('click', () => {
        if (activeMidiPlayback && activeMidiPlayback.button === playButton) {
            stopMidiPlayback('Playback stopped.');
            return;
        }

        const selectedInstrument = instruments.find(
            instrument => instrument.value === instrumentSelect.value
        );
        if (!selectedInstrument || !selectedInstrument.available) {
            status.textContent = `${selectedInstrument ? selectedInstrument.label : 'This option'} isn't available.`;
            return;
        }

        startMidiPlayback(
            `${sheetBaseUrl}_(${selectedInstrument.value}).mid`,
            { button: playButton, instrumentSelect, progress, progressLabel, status }
        );
    });

    const firstAvailableInstrument = instruments.find(instrument => instrument.available);
    instrumentSelect.value = firstAvailableInstrument
        ? firstAvailableInstrument.value
        : instruments[0].value;
    updateInstrument();
}

function formatMidiTime(seconds) {
    const totalSeconds = Math.floor(Math.max(0, seconds));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const remainingSeconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${remainingSeconds}`;
}

function updateMidiProgress(playback) {
    const elapsed = Math.min(playback.Tone.Transport.seconds, playback.duration);
    playback.progress.value = playback.duration ? elapsed / playback.duration : 0;
    playback.progressLabel.textContent =
        `${formatMidiTime(elapsed)} / ${formatMidiTime(playback.duration)}`;
}

function loadMidiLibraries() {
    if (!midiLibrariesPromise) {
        midiLibrariesPromise = Promise.all([
            import(midiModuleUrl),
            import(toneModuleUrl)
        ]);
    }
    return midiLibrariesPromise;
}

function stopMidiPlayback(statusMessage) {
    if (!activeMidiPlayback) return;

    const playback = activeMidiPlayback;
    activeMidiPlayback = null;
    window.clearTimeout(playback.timeout);
    window.clearInterval(playback.progressInterval);
    updateMidiProgress(playback);
    if (statusMessage === 'Playback finished.') playback.progress.value = 1;
    playback.Tone.Transport.stop();
    playback.Tone.Transport.cancel(0);
    playback.Tone.Transport.position = 0;
    playback.part.dispose();
    playback.synth.dispose();
    playback.button.textContent = '▶ Play';
    playback.button.disabled = false;
    playback.instrumentSelect.disabled = false;
    playback.status.textContent = statusMessage;
}

async function startMidiPlayback(midiUrl, controls) {
    if (pendingMidiButton) return;
    const { button, instrumentSelect, progress, progressLabel, status } = controls;
    pendingMidiButton = button;
    stopMidiPlayback('Playback stopped.');
    button.disabled = true;
    instrumentSelect.disabled = true;
    button.textContent = 'Loading MIDI...';
    status.textContent = 'Loading MIDI playback...';

    let Tone;
    let synth;
    let part;

    try {
        const [midiModule, toneModule] = await loadMidiLibraries();
        Tone = toneModule;
        await Tone.start();

        const response = await fetch(midiUrl);
        if (!response.ok) {
            throw new Error(`Failed to load MIDI file (${response.status}).`);
        }

        const midi = new midiModule.Midi(await response.arrayBuffer());
        const notes = midi.tracks.flatMap(track => track.notes);
        if (!notes.length) throw new Error('The MIDI file contains no playable notes.');
        const duration = notes.reduce(
            (lastNoteEnd, note) => Math.max(lastNoteEnd, note.time + note.duration),
            Math.max(midi.duration, 0.1)
        );

        synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.01, decay: 0.2, sustain: 0.25, release: 0.8 }
        }).toDestination();

        Tone.Transport.stop();
        Tone.Transport.cancel(0);
        Tone.Transport.position = 0;
        part = new Tone.Part((time, note) => {
            synth.triggerAttackRelease(note.name, note.duration, time, note.velocity);
        }, notes.map(note => [note.time, note]));
        part.start(0);
        Tone.Transport.start();

        const playback = {
            Tone,
            part,
            synth,
            button,
            instrumentSelect,
            progress,
            progressLabel,
            status,
            duration,
            timeout: null,
            progressInterval: null
        };
        activeMidiPlayback = playback;
        button.textContent = '■ Stop';
        status.textContent = 'Playing MIDI.';
        playback.progressInterval = window.setInterval(
            () => updateMidiProgress(playback),
            100
        );
        playback.timeout = window.setTimeout(
                () => {
                    if (activeMidiPlayback === playback) {
                        stopMidiPlayback('Playback finished.');
                    }
                },
                duration * 1000 + 500
            );
    } catch (error) {
        console.error('Error playing MIDI:', error);
        if (Tone) {
            Tone.Transport.stop();
            Tone.Transport.cancel(0);
            Tone.Transport.position = 0;
        }
        if (part) part.dispose();
        if (synth) synth.dispose();
        button.textContent = '▶ Play';
        status.textContent = `Unable to play MIDI: ${error.message}`;
    } finally {
        if (pendingMidiButton === button) pendingMidiButton = null;
        button.disabled = false;
        instrumentSelect.disabled = false;
    }
}

function initializeMusicNotes() {
    if (document.querySelector('.music-notes-container')) return;

    const container = document.createElement('div');
    container.className = 'music-notes-container';
    container.setAttribute('aria-hidden', 'true');
    container.innerHTML = `
        <span class="note note-1">♫</span>
        <span class="note note-2">♩</span>
        <span class="note note-3">♭</span>
        <span class="note note-4">♬</span>
        <span class="note note-5">𝄞</span>
    `;
    document.body.appendChild(container);
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
    initializeMusicNotes();
    initializeHeader();
    initializeSheetFilters();
    initializeSheetMediaControls();
    initializePdfViewers();

    const year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();
});

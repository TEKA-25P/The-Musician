// Get elements
const checkbox = document.getElementById('checkbox');
const body = document.body;
const collapseButton = document.querySelector('.collapse');
const sidebar = document.querySelector('.sidebar');
const label = document.querySelector('.label');

// Dark mode
if (localStorage.getItem('darkMode') === 'true') {
  body.classList.add('dark-mode');
  checkbox.checked = true;
}
checkbox.addEventListener('change', () => {
  body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', checkbox.checked);
});

// Collapse sidebar
if (localStorage.getItem('collapsed') === 'true') {
  sidebar.classList.add('collapsed');
  body.classList.add('collapsed');
  label.classList.add('collapsed');
}
collapseButton.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
  body.classList.toggle('collapsed');
  label.classList.toggle('collapsed');
  localStorage.setItem('collapsed', body.classList.contains('collapsed'));
  const icon = collapseButton.querySelector('i');
  icon.textContent = sidebar.classList.contains('collapsed') ? 'chevron_right' : 'chevron_left';
});

// Audio player
const audio = document.getElementById('myAudio');
const playPauseBtn = document.getElementById('playPauseBtn');
const progressBar = document.getElementById('progressBar');
let isPlaying = false;

playPauseBtn.addEventListener('click', () => {
  if (isPlaying) {
    audio.pause();
    playPauseBtn.textContent = '▶';
  } else {
    audio.play();
    playPauseBtn.textContent = '⏸';
  }
  isPlaying = !isPlaying;
});

audio.addEventListener('timeupdate', () => {
  const progress = (audio.currentTime / audio.duration) * 100;
  progressBar.value = progress || 0;
});
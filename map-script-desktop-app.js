document.addEventListener('DOMContentLoaded', () => {
  const sky = document.querySelector('.sky');
  const waitCount = document.getElementById('wait-count');
  const tickerTrack = document.getElementById('ticker-track');
  const notifyBtn = document.getElementById('notify-btn');
  const notifyToast = document.getElementById('notify-toast');

  const headlines = [
    'Dialing in glide curves for the next map drop',
    'Tuning bus timing for faster landings',
    'Simulating crosswinds to keep routes honest',
    'Polishing UI microinteractions',
    'Testing loot density overlays',
    'Warming up servers for early access',
    'Matching squads to the cleanest drop lanes',
  ];

  function buildTicker() {
    const items = [...headlines, ...headlines];
    tickerTrack.innerHTML = '';
    items.forEach((text, i) => {
      const pill = document.createElement('span');
      pill.className = 'ticker-pill';
      const dot = document.createElement('span');
      dot.className = 'dot';
      const label = document.createElement('span');
      label.textContent = text;
      pill.append(dot, label);
      tickerTrack.appendChild(pill);
    });
  }

  function randomRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  function spawnDropper() {
    if (!sky) return;
    const dropper = document.createElement('div');
    dropper.className = 'dropper';
    dropper.style.left = `${randomRange(-10, 100)}%`;
    dropper.style.animationDuration = `${randomRange(5.5, 8.5)}s`;
    dropper.style.opacity = `${randomRange(0.75, 1)}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    dropper.appendChild(avatar);
    sky.appendChild(dropper);

    setTimeout(() => {
      dropper.remove();
    }, 8500);
  }

  function loopDroppers() {
    spawnDropper();
    setInterval(spawnDropper, 800);
  }

  function animateCounter() {
    let count = Math.floor(randomRange(120, 260));
    waitCount.textContent = count.toLocaleString();

    setInterval(() => {
      const delta = Math.random() > 0.5 ? 1 : -1;
      count = Math.max(98, count + delta * Math.floor(randomRange(0, 4)));
      waitCount.textContent = count.toLocaleString();
    }, 2400);
  }

  function wireNotify() {
    notifyBtn?.addEventListener('click', () => {
      notifyToast?.classList.add('show');
      setTimeout(() => notifyToast?.classList.remove('show'), 2600);
    });
  }

  buildTicker();
  loopDroppers();
  animateCounter();
  wireNotify();
});

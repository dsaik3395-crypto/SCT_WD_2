/**
 * Stopwatch Web Application
 * SkillCraft Technology - Task 02
 *
 * Features:
 *  - High-precision delta timing (performance.now + rAF) — zero drift
 *  - Start / Pause / Resume / Reset
 *  - Lap recording with interval duration & split time
 *  - Fastest / Slowest / Average lap analytics
 *  - Circular SVG progress ring synced to 60-second cycle
 *  - Keyboard shortcuts: Space = Start/Pause, L = Lap, R = Reset
 *    (shortcuts still registered on all devices but only hinted on desktop)
 */

document.addEventListener('DOMContentLoaded', () => {

  // --------------------------------------------------------------------------
  // DOM References
  // --------------------------------------------------------------------------
  const hoursEl         = document.getElementById('hours');
  const minutesEl       = document.getElementById('minutes');
  const secondsEl       = document.getElementById('seconds');
  const millisecondsEl  = document.getElementById('milliseconds');
  const statusIndicator = document.getElementById('statusIndicator');
  const progressRing    = document.getElementById('progressRing');
  const stopwatchCard   = document.querySelector('.stopwatch-card');

  const startPauseBtn   = document.getElementById('startPauseBtn');
  const startPauseIcon  = document.getElementById('startPauseIcon');
  const startPauseText  = document.getElementById('startPauseText');
  const lapBtn          = document.getElementById('lapBtn');
  const resetBtn        = document.getElementById('resetBtn');
  const clearLapsBtn    = document.getElementById('clearLapsBtn');

  const lapCountBadge   = document.getElementById('lapCountBadge');
  const lapStatsGrid    = document.getElementById('lapStatsGrid');
  const fastestLapTimeEl= document.getElementById('fastestLapTime');
  const slowestLapTimeEl= document.getElementById('slowestLapTime');
  const averageLapTimeEl= document.getElementById('averageLapTime');
  const lapList         = document.getElementById('lapList');

  // --------------------------------------------------------------------------
  // SVG Ring Setup
  // The SVG viewBox is always 280×280 with the circle at cx=140 cy=140 r=128.
  // We compute the circumference once and let CSS scale the SVG element.
  // --------------------------------------------------------------------------
  const RING_RADIUS        = 128;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;   // ≈ 804.25 px

  progressRing.style.strokeDasharray  = `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`;
  progressRing.style.strokeDashoffset = RING_CIRCUMFERENCE; // start empty

  // --------------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------------
  let isRunning    = false;
  let startTime    = 0;      // performance.now() snapshot when last started
  let elapsedTime  = 0;      // accumulated ms when paused
  let lastLapTime  = 0;      // accumulated ms at last lap boundary
  let rafId        = null;   // requestAnimationFrame handle
  let laps         = [];     // array of { id, lapTime, splitTime }

  // --------------------------------------------------------------------------
  // Time Utilities
  // --------------------------------------------------------------------------

  /**
   * Break a millisecond value into display components.
   * @param {number} totalMs
   * @returns {{ hours: string, minutes: string, seconds: string, ms: string }}
   */
  function decompose(totalMs) {
    const h  = Math.floor(totalMs / 3_600_000);
    const m  = Math.floor((totalMs % 3_600_000) / 60_000);
    const s  = Math.floor((totalMs % 60_000) / 1_000);
    const cs = Math.floor((totalMs % 1_000) / 10);   // centiseconds (2-digit)
    return {
      hours:   pad(h),
      minutes: pad(m),
      seconds: pad(s),
      ms:      pad(cs),
    };
  }

  /** Zero-pad a number to at least 2 digits. */
  function pad(n) { return String(n).padStart(2, '0'); }

  /**
   * Render a ms value as a compact "HH:MM:SS.cs" string.
   * @param {number} totalMs
   * @returns {string}
   */
  function fmt(totalMs) {
    const { hours, minutes, seconds, ms } = decompose(totalMs);
    return `${hours}:${minutes}:${seconds}.${ms}`;
  }

  // --------------------------------------------------------------------------
  // Display Updater
  // --------------------------------------------------------------------------

  function updateDisplay(ms) {
    const t = decompose(ms);
    hoursEl.textContent        = t.hours;
    minutesEl.textContent      = t.minutes;
    secondsEl.textContent      = t.seconds;
    millisecondsEl.textContent = t.ms;

    // Animate ring on each 60-second cycle
    const offset = RING_CIRCUMFERENCE - ((ms % 60_000) / 60_000) * RING_CIRCUMFERENCE;
    progressRing.style.strokeDashoffset = offset;
  }

  // --------------------------------------------------------------------------
  // Core Engine
  // --------------------------------------------------------------------------

  /** rAF tick — called on every animation frame while running. */
  function tick() {
    const now     = performance.now();
    const current = elapsedTime + (now - startTime);
    updateDisplay(current);
    if (isRunning) rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (isRunning) return;
    isRunning = true;
    startTime = performance.now();
    rafId     = requestAnimationFrame(tick);
    setUIState('RUNNING');
  }

  function pause() {
    if (!isRunning) return;
    isRunning    = false;
    elapsedTime += performance.now() - startTime;
    cancelAnimationFrame(rafId);
    updateDisplay(elapsedTime);
    setUIState('PAUSED');
  }

  function reset() {
    isRunning   = false;
    elapsedTime = 0;
    lastLapTime = 0;
    cancelAnimationFrame(rafId);
    updateDisplay(0);
    progressRing.style.strokeDashoffset = RING_CIRCUMFERENCE;
    setUIState('READY');
  }

  function recordLap() {
    if (!isRunning) return;

    const now      = performance.now();
    const split    = elapsedTime + (now - startTime);
    const duration = split - lastLapTime;
    lastLapTime    = split;

    laps.unshift({ id: laps.length + 1, lapTime: duration, splitTime: split });
    renderLaps();
  }

  function clearLaps() {
    laps        = [];
    // Sync the lap baseline so next lap interval starts from now
    lastLapTime = isRunning
      ? elapsedTime + (performance.now() - startTime)
      : elapsedTime;
    renderLaps();
  }

  // --------------------------------------------------------------------------
  // UI State Machine
  // --------------------------------------------------------------------------

  /**
   * @param {'READY' | 'RUNNING' | 'PAUSED'} state
   */
  function setUIState(state) {
    stopwatchCard.classList.remove('is-running', 'is-paused');
    startPauseBtn.classList.remove('paused-state');
    statusIndicator.className = 'status-indicator';

    startPauseBtn.setAttribute('aria-label',
      state === 'RUNNING' ? 'Pause stopwatch' : 'Start stopwatch');

    switch (state) {
      case 'RUNNING':
        stopwatchCard.classList.add('is-running');
        statusIndicator.textContent = 'RUNNING';
        statusIndicator.classList.add('running');
        startPauseIcon.className    = 'fa-solid fa-pause';
        startPauseText.textContent  = 'Pause';
        startPauseBtn.classList.add('paused-state');
        lapBtn.disabled   = false;
        resetBtn.disabled = false;
        break;

      case 'PAUSED':
        stopwatchCard.classList.add('is-paused');
        statusIndicator.textContent = 'PAUSED';
        statusIndicator.classList.add('paused');
        startPauseIcon.className   = 'fa-solid fa-play';
        startPauseText.textContent = 'Resume';
        lapBtn.disabled   = true;
        resetBtn.disabled = false;
        break;

      default: // READY
        statusIndicator.textContent = 'READY';
        startPauseIcon.className    = 'fa-solid fa-play';
        startPauseText.textContent  = 'Start';
        lapBtn.disabled   = true;
        resetBtn.disabled = true;
        break;
    }
  }

  // --------------------------------------------------------------------------
  // Lap Renderer
  // --------------------------------------------------------------------------

  function renderLaps() {
    const count = laps.length;
    lapCountBadge.textContent = `${count} ${count === 1 ? 'Lap' : 'Laps'}`;
    clearLapsBtn.disabled     = count === 0;

    if (count === 0) {
      lapStatsGrid.classList.remove('visible');
      lapList.innerHTML = `
        <div class="empty-laps">
          <i class="fa-regular fa-clock" aria-hidden="true"></i>
          <p>No laps recorded yet</p>
          <span class="empty-tip">Tap &ldquo;Lap&rdquo; while the timer is running</span>
        </div>`;
      return;
    }

    // Find fastest / slowest / average
    let fastest = laps[0];
    let slowest = laps[0];
    let total   = 0;

    laps.forEach(l => {
      total += l.lapTime;
      if (l.lapTime < fastest.lapTime) fastest = l;
      if (l.lapTime > slowest.lapTime) slowest = l;
    });

    const avg = total / count;

    if (count >= 2) {
      lapStatsGrid.classList.add('visible');
      fastestLapTimeEl.textContent = fmt(fastest.lapTime);
      slowestLapTimeEl.textContent = fmt(slowest.lapTime);
      averageLapTimeEl.textContent = fmt(avg);
    } else {
      lapStatsGrid.classList.remove('visible');
    }

    // Build rows (newest first — already unshifted)
    lapList.innerHTML = laps.map(l => {
      const isFastest = count >= 2 && l.id === fastest.id;
      const isSlowest = count >= 2 && l.id === slowest.id;

      const rowClass = [
        'lap-row',
        isFastest ? 'is-fastest' : '',
        isSlowest ? 'is-slowest' : '',
      ].join(' ').trim();

      const tag = isFastest
        ? '<span class="lap-tag lap-tag-fastest">Best</span>'
        : isSlowest
          ? '<span class="lap-tag lap-tag-slowest">Slow</span>'
          : '';

      return `
        <div class="${rowClass}" role="listitem">
          <div class="lap-number-cell">
            <span>#${pad(l.id)}</span>${tag}
          </div>
          <div class="lap-time-cell">+${fmt(l.lapTime)}</div>
          <div class="split-time-cell">${fmt(l.splitTime)}</div>
        </div>`;
    }).join('');
  }

  // --------------------------------------------------------------------------
  // Button Events
  // --------------------------------------------------------------------------

  startPauseBtn.addEventListener('click', () => isRunning ? pause() : start());
  lapBtn.addEventListener('click',        () => recordLap());
  resetBtn.addEventListener('click',      () => reset());
  clearLapsBtn.addEventListener('click',  () => clearLaps());

  // --------------------------------------------------------------------------
  // Keyboard Shortcuts (functional on all devices, hinted only on desktop)
  // --------------------------------------------------------------------------
  window.addEventListener('keydown', e => {
    // Ignore when user is typing inside an input
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();                      // prevent page scroll
        isRunning ? pause() : start();
        break;
      case 'KeyL':
        if (isRunning) recordLap();
        break;
      case 'KeyR':
        if (!resetBtn.disabled) reset();
        break;
    }
  });

  // --------------------------------------------------------------------------
  // Init
  // --------------------------------------------------------------------------
  updateDisplay(0);
  setUIState('READY');
});


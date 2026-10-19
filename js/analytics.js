import { createId } from './core/identity.js';
import { localDayKey, shiftLocalDay } from './core/calendar.js';
// Analytics & Metrics Engine for Sharp — Radar Charts, Trend Lines, Heatmaps & Domain Insights
import { loadJSON, saveJSON, KEYS } from './storage.js';
import { getDomainRatings, getOverallSharpScore, DOMAINS } from './adaptive-engine.js';

export function getSessionHistory() {
  return loadJSON(KEYS.HISTORY, []);
}

export function logSessionRound({ gameId, domain, tier, accuracy, questionsCount, correctCount, averageLatencyMs, ratingBefore, ratingAfter }) {
  const history = getSessionHistory();
  const timestamp = Date.now();
  const round = {
    id: createId('sess'),
    gameId,
    domain,
    tier,
    accuracy: Number(accuracy.toFixed(3)),
    questionsCount,
    correctCount,
    averageLatencyMs: Math.round(averageLatencyMs),
    ratingBefore,
    ratingAfter,
    delta: ratingAfter - ratingBefore,
    timestamp,
    date: localDayKey(timestamp),
    calendarPolicy: 'local-v1'
  };

  history.push(round);
  // Keep up to 1000 rounds in local storage for deep historical tracking
  if (history.length > 1000) history.shift();
  saveJSON(KEYS.HISTORY, history);
  return round;
}

export function getStreaks() {
  const stored = loadJSON(KEYS.STREAKS, null);
  if (stored) return { ...stored, calendarPolicy: stored.calendarPolicy || 'utc-legacy' };
  return {
    current: 0,
    longest: 0,
    lastWorkoutDate: null,
    history: {},
    calendarPolicy: 'local-v1'
  };
}

// Keep existing UTC streaks intact until a versioned migration can reconcile them.
export function getWorkoutDay(streaks = getStreaks(), now = new Date()) {
  return streaks.calendarPolicy === 'utc-legacy' ? new Date(now).toISOString().slice(0, 10) : localDayKey(now);
}

export function recordWorkoutCompletion(now = new Date()) {
  const streaks = getStreaks();
  const today = getWorkoutDay(streaks, now);
  const yesterday = streaks.calendarPolicy === 'utc-legacy'
    ? getWorkoutDay(streaks, new Date(new Date(now).getTime() - 86400000))
    : localDayKey(shiftLocalDay(now, -1));

  if (streaks.lastWorkoutDate === today) {
    // Already recorded today, update workout count
    streaks.history[today] = (streaks.history[today] || 0) + 1;
    saveJSON(KEYS.STREAKS, streaks);
    return { streaks, isNewDay: false };
  }

  if (streaks.lastWorkoutDate === yesterday) {
    streaks.current += 1;
  } else {
    // Streak reset to 1
    streaks.current = 1;
  }

  if (streaks.current > streaks.longest) {
    streaks.longest = streaks.current;
  }

  streaks.lastWorkoutDate = today;
  streaks.history[today] = (streaks.history[today] || 0) + 1;

  saveJSON(KEYS.STREAKS, streaks);
  return { streaks, isNewDay: true };
}

/**
 * Computes domain-level aggregate metrics.
 */
export function getDomainMetrics() {
  const history = getSessionHistory();
  const ratings = getDomainRatings();
  const metrics = {};

  Object.values(DOMAINS).forEach((dom) => {
    const rounds = history.filter((r) => r.domain === dom);
    const totalRounds = rounds.length;
    const avgAcc = totalRounds > 0
      ? rounds.reduce((sum, r) => sum + r.accuracy, 0) / totalRounds
      : 0;
    const avgSpeed = totalRounds > 0
      ? rounds.reduce((sum, r) => sum + r.averageLatencyMs, 0) / totalRounds
      : 0;
    const bestRating = rounds.reduce((max, r) => Math.max(max, r.ratingAfter), ratings[dom] || 1000);

    metrics[dom] = {
      domain: dom,
      rating: ratings[dom] || 1000,
      totalRounds,
      averageAccuracy: Math.round(avgAcc * 100),
      averageLatencySeconds: (avgSpeed / 1000).toFixed(1),
      peakRating: bestRating
    };
  });

  return metrics;
}

/**
 * Generates responsive SVG markup for a 5-axis cognitive radar chart.
 */
export function renderRadarChartSVG(ratings = getDomainRatings(), size = 320) {
  const center = size / 2;
  const radius = size * 0.38;
  const axes = [
    { key: DOMAINS.MEMORY, label: 'Memory', angle: -Math.PI / 2 },
    { key: DOMAINS.MATH, label: 'Math', angle: -Math.PI / 2 + (Math.PI * 2) / 5 },
    { key: DOMAINS.LOGIC, label: 'Logic', angle: -Math.PI / 2 + (Math.PI * 4) / 5 },
    { key: DOMAINS.COMPREHENSION, label: 'Verbal', angle: -Math.PI / 2 + (Math.PI * 6) / 5 },
    { key: DOMAINS.FOCUS, label: 'Focus', angle: -Math.PI / 2 + (Math.PI * 8) / 5 }
  ];

  // Grid rings (representing 800, 1100, 1400, 1700 ratings)
  const ringRatings = [800, 1100, 1400, 1700];
  let ringsSVG = '';

  ringRatings.forEach((ringR) => {
    const frac = Math.min(1, Math.max(0.1, (ringR - 600) / 1200));
    const r = radius * frac;
    const points = axes.map((a) => {
      const x = center + r * Math.cos(a.angle);
      const y = center + r * Math.sin(a.angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    ringsSVG += `<polygon points="${points}" fill="none" stroke="var(--chart-grid, rgba(148,163,184,0.25))" stroke-width="1" stroke-dasharray="2,2"/>`;
  });

  // Spokes & labels
  let spokesSVG = '';
  axes.forEach((a) => {
    const xEnd = center + radius * Math.cos(a.angle);
    const yEnd = center + radius * Math.sin(a.angle);
    const xLabel = center + (radius + 24) * Math.cos(a.angle);
    const yLabel = center + (radius + 24) * Math.sin(a.angle);

    spokesSVG += `<line x1="${center}" y1="${center}" x2="${xEnd.toFixed(1)}" y2="${yEnd.toFixed(1)}" stroke="var(--chart-grid, rgba(148,163,184,0.25))" stroke-width="1"/>`;
    spokesSVG += `<text x="${xLabel.toFixed(1)}" y="${yLabel.toFixed(1)}" text-anchor="middle" dominant-baseline="central" fill="var(--muted, #64748b)" font-size="11" font-weight="600">${a.label}</text>`;
  });

  // Player data polygon
  const dataPoints = axes.map((a) => {
    const score = ratings[a.key] || 1000;
    // Map rating 600..1800 into fraction 0.1..1.0
    const frac = Math.min(1.0, Math.max(0.15, (score - 600) / 1200));
    const r = radius * frac;
    const x = center + r * Math.cos(a.angle);
    const y = center + r * Math.sin(a.angle);
    return { x, y, str: `${x.toFixed(1)},${y.toFixed(1)}` };
  });

  const polygonPoints = dataPoints.map((p) => p.str).join(' ');
  const nodesSVG = dataPoints.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="var(--primary, #6366f1)" stroke="var(--surface, #ffffff)" stroke-width="2"/>`).join('');

  return `
    <svg viewBox="0 0 ${size} ${size}" class="radar-chart-svg" width="100%" height="auto" aria-label="Cognitive Balance Radar Chart">
      <defs>
        <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="var(--primary, #6366f1)" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="var(--accent-cyan, #06b6d4)" stop-opacity="0.15"/>
        </radialGradient>
      </defs>
      ${ringsSVG}
      ${spokesSVG}
      <polygon points="${polygonPoints}" fill="url(#radarFill)" stroke="var(--primary, #6366f1)" stroke-width="2.5" stroke-linejoin="round"/>
      ${nodesSVG}
    </svg>
  `;
}

/**
 * Generates an SVG line trend chart for overall Sharp Score.
 */
export function renderTrendLineSVG(days = 14, width = 500, height = 180) {
  const history = getSessionHistory();
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Build daily average rating points
  const pointsByDate = new Map();
  history.forEach((r) => {
    if (!pointsByDate.has(r.date)) pointsByDate.set(r.date, []);
    pointsByDate.get(r.date).push(r.ratingAfter);
  });

  const dateList = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = localDayKey(shiftLocalDay(new Date(), -i));
    dateList.push(d);
  }

  let runningScore = 1000;
  const scoreSeries = dateList.map((date) => {
    if (pointsByDate.has(date)) {
      const arr = pointsByDate.get(date);
      runningScore = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    }
    return { date, score: runningScore };
  });

  const scores = scoreSeries.map((s) => s.score);
  const minScore = Math.floor(Math.min(...scores, 900) / 100) * 100;
  const maxScore = Math.ceil(Math.max(...scores, 1100) / 100) * 100;
  const range = Math.max(100, maxScore - minScore);

  const coords = scoreSeries.map((item, idx) => {
    const x = padding.left + (idx / (days - 1)) * chartW;
    const y = padding.top + chartH - ((item.score - minScore) / range) * chartH;
    return { x, y, item };
  });

  const polylineStr = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaStr = `${polylineStr} ${coords[coords.length - 1].x.toFixed(1)},${padding.top + chartH} ${coords[0].x.toFixed(1)},${padding.top + chartH}`;

  const circles = coords.filter((_, i) => i % 2 === 0 || i === coords.length - 1)
    .map((c) => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3.5" fill="var(--primary, #6366f1)" stroke="var(--surface, #ffffff)" stroke-width="1.5"/>`)
    .join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="trend-chart-svg" width="100%" height="auto">
      <defs>
        <linearGradient id="trendGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="var(--primary, #6366f1)" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="var(--primary, #6366f1)" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      <!-- Horizontal gridlines -->
      <line x1="${padding.left}" y1="${padding.top}" x2="${width - padding.right}" y2="${padding.top}" stroke="var(--chart-grid, rgba(148,163,184,0.15))" stroke-dasharray="3,3"/>
      <line x1="${padding.left}" y1="${padding.top + chartH / 2}" x2="${width - padding.right}" y2="${padding.top + chartH / 2}" stroke="var(--chart-grid, rgba(148,163,184,0.15))" stroke-dasharray="3,3"/>
      <line x1="${padding.left}" y1="${padding.top + chartH}" x2="${width - padding.right}" y2="${padding.top + chartH}" stroke="var(--chart-grid, rgba(148,163,184,0.15))"/>

      <!-- Y axis labels -->
      <text x="${padding.left - 8}" y="${padding.top + 4}" font-size="10" fill="var(--muted, #64748b)" text-anchor="end">${maxScore}</text>
      <text x="${padding.left - 8}" y="${padding.top + chartH + 4}" font-size="10" fill="var(--muted, #64748b)" text-anchor="end">${minScore}</text>

      <!-- Fill and line -->
      <polygon points="${areaStr}" fill="url(#trendGrad)"/>
      <polyline points="${polylineStr}" fill="none" stroke="var(--primary, #6366f1)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${circles}
    </svg>
  `;
}

/**
 * Generates an activity heatmap for the last 35 days (5 weeks).
 */
export function renderActivityHeatmapHTML() {
  const streaks = getStreaks();
  const history = streaks.history || {};
  const today = new Date();
  const cells = [];

  for (let i = 34; i >= 0; i--) {
    const d = shiftLocalDay(today, -i);
    const dateStr = localDayKey(d);
    const count = history[dateStr] || 0;
    const isToday = i === 0;

    let intensityClass = 'heat-0';
    if (count === 1) intensityClass = 'heat-1';
    else if (count === 2) intensityClass = 'heat-2';
    else if (count >= 3) intensityClass = 'heat-3';

    const shortDay = d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
    cells.push(`
      <div class="heatmap-cell ${intensityClass} ${isToday ? 'is-today' : ''}"
           title="${shortDay}: ${count} session${count === 1 ? '' : 's'}"
           aria-label="${shortDay}: ${count} sessions"></div>
    `);
  }

  return `
    <div class="activity-heatmap" role="img" aria-label="35-day activity heatmap">
      <div class="heatmap-grid">
        ${cells.join('')}
      </div>
      <div class="heatmap-legend">
        <span>Less</span>
        <span class="heatmap-cell heat-0"></span>
        <span class="heatmap-cell heat-1"></span>
        <span class="heatmap-cell heat-2"></span>
        <span class="heatmap-cell heat-3"></span>
        <span>More</span>
      </div>
    </div>
  `;
}

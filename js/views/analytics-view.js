// Analytics & Insights View — Radar Charts, Trends, Heatmap, and Domain Diagnostics
import { getDomainRatings, getOverallSharpScore, ratingToTier, getTierLabel, DOMAINS } from '../adaptive-engine.js';
import { getDomainMetrics, getSessionHistory, getStreaks, renderRadarChartSVG, renderTrendLineSVG, renderActivityHeatmapHTML } from '../analytics.js';
import { audio } from '../audio.js';

export function render(container) {
  const ratings = getDomainRatings();
  const overallScore = getOverallSharpScore(ratings);
  const overallTier = ratingToTier(overallScore);
  const tierName = getTierLabel(overallTier);
  const metrics = getDomainMetrics();
  const streaks = getStreaks();
  const history = getSessionHistory();

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Cognitive Analytics</h1>
        <p class="view-desc">Holistic diagnostics, long-term trends, and adaptive skill ratings.</p>
      </div>
      <div class="header-badges">
        <span class="sharp-score-badge">
          <small>Sharp Score</small>
          <strong>${overallScore}</strong>
        </span>
      </div>
    </div>

    <!-- Overview Hero: Radar & Score -->
    <div class="analytics-hero-grid">
      <div class="radar-card">
        <div class="card-headline">
          <h3>Brain Balance Profile</h3>
          <span class="tier-pill">Tier ${overallTier}: ${tierName}</span>
        </div>
        <div class="radar-container">
          ${renderRadarChartSVG(ratings, 340)}
        </div>
        <p class="radar-caption">5-domain balance based on active psychometric assessments.</p>
      </div>

      <div class="summary-stats-column">
        <div class="stat-card">
          <span class="stat-card-label">Daily Streak</span>
          <div class="stat-card-val-row">
            <span class="stat-big-val">🔥 ${streaks.current}</span>
            <small class="text-muted">Best: ${streaks.longest} days</small>
          </div>
        </div>

        <div class="stat-card">
          <span class="stat-card-label">Total Sessions Completed</span>
          <div class="stat-card-val-row">
            <span class="stat-big-val">🎮 ${history.length}</span>
            <small class="text-muted">Recorded offline</small>
          </div>
        </div>

        <div class="stat-card">
          <span class="stat-card-label">Memory Retention Average</span>
          <div class="stat-card-val-row">
            <span class="stat-big-val">🧠 ${metrics[DOMAINS.MEMORY]?.averageAccuracy || 0}%</span>
            <small class="text-muted">${metrics[DOMAINS.MEMORY]?.totalRounds || 0} recall rounds</small>
          </div>
        </div>

        <div class="stat-card">
          <span class="stat-card-label">Math Accuracy &amp; Speed</span>
          <div class="stat-card-val-row">
            <span class="stat-big-val">📐 ${metrics[DOMAINS.MATH]?.averageAccuracy || 0}%</span>
            <small class="text-muted">Avg: ${metrics[DOMAINS.MATH]?.averageLatencySeconds || '0.0'}s</small>
          </div>
        </div>
      </div>
    </div>

    <!-- Trend Line -->
    <div class="trend-section-card">
      <div class="card-headline">
        <h3>14-Day Performance Trajectory</h3>
        <span class="text-muted text-sm">Rating progression over time</span>
      </div>
      <div class="trend-chart-box">
        ${renderTrendLineSVG(14, 600, 190)}
      </div>
    </div>

    <!-- Heatmap -->
    <div class="heatmap-section-card">
      <div class="card-headline">
        <h3>35-Day Consistency Heatmap</h3>
        <span class="text-muted text-sm">Session frequency</span>
      </div>
      ${renderActivityHeatmapHTML()}
    </div>

    <!-- Domain Breakdown Grid -->
    <h3 class="section-heading">Domain Performance Diagnostics</h3>
    <div class="domain-metrics-grid">
      ${Object.values(DOMAINS).map((dom) => {
        const d = metrics[dom] || { rating: 1000, totalRounds: 0, averageAccuracy: 0, averageLatencySeconds: '0.0', peakRating: 1000 };
        const tier = ratingToTier(d.rating);
        const name = dom.charAt(0).toUpperCase() + dom.slice(1);

        return `
          <div class="domain-stat-card">
            <div class="domain-card-header">
              <strong>${name}</strong>
              <span class="domain-badge-small">Tier ${tier}</span>
            </div>
            <div class="domain-rating-display">
              <span class="domain-rating-val">${d.rating}</span>
              <small class="text-muted">Peak: ${d.peakRating}</small>
            </div>
            <div class="domain-substats">
              <div>
                <span class="substat-label">Accuracy</span>
                <strong>${d.averageAccuracy}%</strong>
              </div>
              <div>
                <span class="substat-label">Avg Speed</span>
                <strong>${d.averageLatencySeconds}s</strong>
              </div>
              <div>
                <span class="substat-label">Rounds</span>
                <strong>${d.totalRounds}</strong>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Recent Session Logs -->
    <div class="history-section-card">
      <div class="card-headline">
        <h3>Recent Training Log</h3>
        <span class="text-muted text-sm">Last 8 rounds</span>
      </div>
      ${history.length === 0 ? `
        <p class="empty-log-text">No session history yet. Complete your first workout or exercise to start tracking.</p>
      ` : `
        <div class="table-container">
          <table class="session-history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Exercise</th>
                <th>Domain</th>
                <th>Tier</th>
                <th>Accuracy</th>
                <th>Rating Delta</th>
              </tr>
            </thead>
            <tbody>
              ${history.slice(-8).reverse().map((h) => `
                <tr>
                  <td>${h.date}</td>
                  <td><strong>${h.gameId}</strong></td>
                  <td><span class="domain-pill">${h.domain}</span></td>
                  <td>Tier ${h.tier}</td>
                  <td>${Math.round(h.accuracy * 100)}%</td>
                  <td class="${h.delta >= 0 ? 'text-green' : 'text-amber'}">
                    ${h.delta >= 0 ? '+' : ''}${h.delta} (${h.ratingAfter})
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

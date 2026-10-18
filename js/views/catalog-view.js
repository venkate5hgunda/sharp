// Games Catalog View — Explore and Play Individual Cognitive Exercises
import { CATALOG } from '../games/catalog.js';
import { audio } from '../audio.js';
import { getDomainRatings, ratingToTier, getTierLabel, DOMAINS } from '../adaptive-engine.js';

export function render(container, navigateTo) {
  const ratings = getDomainRatings();

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Exercise Catalog</h1>
        <p class="view-desc">Select any targeted exercise to train specific cognitive skills at your adaptive tier.</p>
      </div>
      <div class="domain-filters" id="domainFilters" role="tablist" aria-label="Filter games">
        <button class="filter-chip is-active" data-filter="all" type="button">All Games</button>
        <button class="filter-chip" data-filter="${DOMAINS.MEMORY}" type="button">Memory</button>
        <button class="filter-chip" data-filter="${DOMAINS.MATH}" type="button">Math</button>
        <button class="filter-chip" data-filter="${DOMAINS.LOGIC}" type="button">Logic</button>
        <button class="filter-chip" data-filter="${DOMAINS.COMPREHENSION}" type="button">Verbal</button>
        <button class="filter-chip" data-filter="${DOMAINS.FOCUS}" type="button">Focus</button>
      </div>
    </div>

    <div class="games-grid" id="gamesGrid">
      ${CATALOG.map((game) => {
        const domainRating = ratings[game.domain] || 1000;
        const tier = ratingToTier(domainRating);
        const tierName = getTierLabel(tier);

        return `
          <div class="game-catalog-card" data-domain="${game.domain}">
            <div class="card-top">
              <span class="card-domain-badge">${game.badge}</span>
              <span class="card-tier-badge" title="Current skill level">Tier ${tier} (${tierName})</span>
            </div>
            <h3 class="card-title">${game.title}</h3>
            <p class="card-summary">${game.summary}</p>
            <div class="card-bottom">
              <span class="card-time">⏱️ ${game.timeEstimate}</span>
              <button class="btn btn-sm btn-primary play-btn" data-game-id="${game.id}" type="button">
                Train &rarr;
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  const filterChips = container.querySelectorAll('.filter-chip');
  const cards = container.querySelectorAll('.game-catalog-card');

  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      audio.tap();
      filterChips.forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');

      const filter = chip.dataset.filter;
      cards.forEach((card) => {
        if (filter === 'all' || card.dataset.domain === filter) {
          card.removeAttribute('hidden');
        } else {
          card.setAttribute('hidden', '');
        }
      });
    });
  });

  container.querySelectorAll('.play-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      audio.tap();
      const gameId = btn.dataset.gameId;
      navigateTo(`games/${gameId}`);
    });
  });
}

// Router for Sharp — Hash-based SPA Navigation with Lifecycle Cleanup
import * as WorkoutView from './views/workout-view.js';
import * as CatalogView from './views/catalog-view.js';
import * as AnalyticsView from './views/analytics-view.js';
import * as BackupView from './views/backup-view.js';
import * as SettingsView from './views/settings-view.js';

import * as DelayedMemoryGame from './games/delayed-memory.js';
import * as PatternFlashGame from './games/pattern-flash.js';
import * as MathChallengeGame from './games/math-challenge.js';
import * as LogicDeductionGame from './games/logic-deduction.js';
import * as ComprehensionGame from './games/comprehension-inference.js';
import * as CorsiSpanGame from './games/corsi-span.js';

const GAME_MODULES = {
  'delayed-memory': DelayedMemoryGame,
  'pattern-flash': PatternFlashGame,
  'math-arithmetic': {
    render: (el, onDone) => MathChallengeGame.renderArithmetic(el, onDone)
  },
  'story-math': {
    render: (el, onDone) => MathChallengeGame.renderStoryMath(el, onDone)
  },
  'logic-deduction': LogicDeductionGame,
  'comprehension-inference': ComprehensionGame,
  'corsi-span': CorsiSpanGame
};

export class SharpRouter {
  constructor(appContainer) {
    this.container = appContainer;
    this.currentRoute = null;
    this.activeCleanup = null;
  }

  init() {
    window.addEventListener('hashchange', () => this.handleHashChange());
    this.handleHashChange();
  }

  navigateTo(path) {
    window.location.hash = `#/${path.replace(/^#?\/?/, '')}`;
  }

  handleHashChange() {
    const rawHash = window.location.hash.slice(2); // Strip '#/'
    const [route, param] = rawHash.split('/');
    const effectiveRoute = route || 'workout';

    // Update navigation active states
    document.querySelectorAll('.nav-link').forEach((link) => {
      const target = link.dataset.route;
      const isActive = target === effectiveRoute || (effectiveRoute === 'games' && target === 'catalog');
      link.classList.toggle('is-active', isActive);
      link.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Cleanup previous view if needed
    if (typeof this.activeCleanup === 'function') {
      try {
        this.activeCleanup();
      } catch (err) {
        console.warn('Error during route cleanup:', err);
      }
      this.activeCleanup = null;
    }

    this.container.innerHTML = '';
    window.scrollTo({ top: 0, behavior: 'instant' });

    if (effectiveRoute === 'workout') {
      this.activeCleanup = WorkoutView.render(this.container, (path) => this.navigateTo(path));
    } else if (effectiveRoute === 'catalog') {
      this.activeCleanup = CatalogView.render(this.container, (path) => this.navigateTo(path));
    } else if (effectiveRoute === 'games' && param) {
      this.mountGame(param);
    } else if (effectiveRoute === 'analytics') {
      this.activeCleanup = AnalyticsView.render(this.container);
    } else if (effectiveRoute === 'backup') {
      this.activeCleanup = BackupView.render(this.container);
    } else if (effectiveRoute === 'settings') {
      this.activeCleanup = SettingsView.render(this.container);
    } else {
      this.navigateTo('workout');
    }
  }

  mountGame(gameId) {
    const module = GAME_MODULES[gameId];
    if (!module) {
      this.navigateTo('catalog');
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'game-route-wrapper';
    wrapper.innerHTML = `
      <div class="game-nav-bar">
        <button id="backToCatalogBtn" class="btn btn-sm btn-outline" type="button">
          &larr; Back to Catalog
        </button>
      </div>
      <div id="gameMountTarget"></div>
    `;
    this.container.appendChild(wrapper);

    wrapper.querySelector('#backToCatalogBtn').addEventListener('click', () => {
      this.navigateTo('catalog');
    });

    const target = wrapper.querySelector('#gameMountTarget');
    this.activeCleanup = module.render(target, () => this.navigateTo('catalog'));
  }
}

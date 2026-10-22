// One lifecycle for all routes. Resolve asynchronous dependencies before mounting a view.
const ALIASES = { workout: 'today', catalog: 'exercises', analytics: 'progress' };
const noop = () => {};

export function parseRoute(hash = '') {
  const [raw = 'today', param] = hash.replace(/^#\/?/, '').split('/');
  const path = ALIASES[raw] || raw || 'today';
  return {
    path,
    param,
    alias: Boolean(ALIASES[raw]),
    focused: path === 'session' || (path === 'games' && param === 'delayed-memory'),
  };
}

export class SharpRouter {
  constructor(
    container,
    {
      resolve,
      beforeRoute = noop,
      onRoute = noop,
      onError = noop,
      browser = globalThis.window,
      document = globalThis.document,
    }
  ) {
    this.container = container;
    this.resolve = resolve;
    this.beforeRoute = beforeRoute;
    this.onRoute = onRoute;
    this.onError = onError;
    this.browser = browser;
    this.document = document;
    this.activeCleanup = noop;
    this.version = 0;
    this.disposed = false;
    this.handleHashChange = () => this.render().catch(onError);
  }

  init() {
    this.browser.addEventListener('hashchange', this.handleHashChange);
    return this.render();
  }

  navigateTo(path) {
    this.browser.location.hash = `#/${path.replace(/^#?\/?/, '')}`;
  }

  async render() {
    const version = ++this.version;
    const cleanup = this.activeCleanup;
    this.activeCleanup = noop;
    cleanup();
    const route = parseRoute(this.browser.location.hash);
    await this.beforeRoute(route);
    if (this.disposed || version !== this.version) return;
    const mount = await this.resolve(route);
    if (this.disposed || version !== this.version) return;
    if (!mount) {
      this.navigateTo('today');
      return;
    }
    if (route.alias) this.browser.history.replaceState(null, '', `#/${route.path}`);
    this.updateShell(route);
    this.activeCleanup = mount() || noop;
    const heading = this.container.querySelector('h1');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    this.onRoute(route);
  }

  updateShell({ path, focused }) {
    this.document.querySelectorAll('.nav-link').forEach((link) => {
      const active =
        link.dataset.route === path ||
        (path === 'session' && link.dataset.route === 'today') ||
        (path === 'games' && link.dataset.route === 'exercises');
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    this.document.body.classList.toggle('is-training', focused);
    this.container.dataset.view = path;
    this.browser.scrollTo({ top: 0, behavior: 'instant' });
  }

  dispose() {
    this.disposed = true;
    ++this.version;
    this.browser.removeEventListener('hashchange', this.handleHashChange);
    const cleanup = this.activeCleanup;
    this.activeCleanup = noop;
    cleanup();
  }
}

import { downloadJSON } from '../persistence/backup-v2.js';
export function renderDiagnostics(container, repo) {
  container.innerHTML = '<h1 class="view-title">Local diagnostics</h1><p>Diagnostics and evaluation infrastructure is being integrated. All remote deployment flags remain disabled.</p><button id="exportDiagnostics" class="btn btn-primary">Export local diagnostics</button>';
  container.querySelector('#exportDiagnostics').onclick = () => downloadJSON({ version: 1, events: repo.snapshot().diagnostics, traces: repo.snapshot().traces }, 'sharp-diagnostics.json');
}

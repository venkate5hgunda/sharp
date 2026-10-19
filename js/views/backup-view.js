import { localDayKey } from '../core/calendar.js';
// Backup & Data Sovereignty View — Single-File JSON Export, Import, Checksum Validation & Schema Migrations
import { downloadBackupFile, downloadQuestionDatasetFile, validateAndMigrateBackup, applyBackup } from '../backup.js';
import { getStorageStats, loadJSON, KEYS, CURRENT_SCHEMA_VERSION } from '../storage.js';
import { getDatasetStats } from '../../data/questions-db.js';
import { audio } from '../audio.js';
import { haptics } from '../haptics.js';
import { burstConfetti } from '../celebration.js';
import { MAX_IMPORT_BYTES, escapeHTML } from '../content-validation.js';

export function render(container) {
  const meta = loadJSON(KEYS.BACKUP_META, {});
  const today = localDayKey();
  const isBackedUpToday = meta.lastBackupDate === today;
  const stats = getStorageStats();
  const datasetStats = getDatasetStats();

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Backup &amp; Data Sovereignty</h1>
        <p class="view-desc">Your cognitive data is 100% private and stored locally. Export daily backups to preserve your streaks across devices.</p>
      </div>
      <div class="backup-status-pill ${isBackedUpToday ? 'is-good' : 'is-pending'}">
        <span>${isBackedUpToday ? '✓ Protected Today' : '⚠️ Backup Recommended'}</span>
      </div>
    </div>

    <!-- Questions Dataset & Hydration Card -->
    <div class="backup-card dataset-card">
      <div class="card-icon-header">
        <span class="card-icon">📚</span>
        <div>
          <h3>Questions &amp; Answers Knowledge Base</h3>
          <p>Extensive curriculum across Logic, Math, Verbal, and Memory. Continuously hydrated with player performance metrics and explanations.</p>
        </div>
      </div>

      <div class="backup-meta-list">
        <div><span>Total Questions:</span> <strong>${datasetStats.totalQuestions} items</strong></div>
        <div><span>Hydrated Attempts:</span> <strong>${datasetStats.totalAttemptsRecorded} (${datasetStats.coveragePercent}% coverage)</strong></div>
        <div><span>Curriculum Breakdown:</span> <strong>Logic: ${datasetStats.byDomain.logic} • Math: ${datasetStats.byDomain.math} • Verbal: ${datasetStats.byDomain.comprehension} • Memory: ${datasetStats.byDomain.memory}</strong></div>
      </div>

      <div class="backup-action-row">
        <button id="downloadDatasetBtn" class="btn btn-secondary" type="button">
          📥 Export Hydrated Questions Dataset (.json)
        </button>
      </div>
    </div>

    <!-- Export Section -->
    <div class="backup-card">
      <div class="card-icon-header">
        <span class="card-icon">💾</span>
        <div>
          <h3>Export Daily Snapshot</h3>
          <p>Download a single, versioned JSON backup containing your skill ratings, delayed memory items, streaks, and session history.</p>
        </div>
      </div>

      <div class="backup-meta-list">
        <div><span>Schema Version:</span> <strong>v${CURRENT_SCHEMA_VERSION}</strong></div>
        <div><span>Last Backup:</span> <strong>${meta.lastBackupDate || 'Never'}</strong></div>
        <div><span>Storage Footprint:</span> <strong>${stats.kb} KB (${stats.itemCount} keys)</strong></div>
      </div>

      <div class="backup-action-row">
        <button id="downloadBackupBtn" class="btn btn-primary btn-large" type="button">
          📥 Download Backup (sharp-backup-${today}.json)
        </button>
      </div>
    </div>

    <!-- Import Section -->
    <div class="backup-card">
      <div class="card-icon-header">
        <span class="card-icon">📂</span>
        <div>
          <h3>Import &amp; Restore Backup</h3>
          <p>Restore or merge a previously exported Sharp JSON file. Supported schema and data integrity are checked before restoring. Legacy files without checksums show a warning.</p>
        </div>
      </div>

      <div class="drop-zone" id="dropZone">
        <span class="drop-icon">📄</span>
        <strong>Drag &amp; drop your backup JSON file here</strong>
        <small>or click to browse local files</small>
        <input type="file" id="fileInput" accept=".json,application/json" hidden>
      </div>

      <div id="importPreview" class="import-preview-box" hidden></div>
    </div>
  `;

  // Handle Download Dataset
  container.querySelector('#downloadDatasetBtn')?.addEventListener('click', () => {
    audio.chime();
    haptics.celebrate();
    burstConfetti();
    downloadQuestionDatasetFile();
  });

  // Handle Download Backup
  container.querySelector('#downloadBackupBtn').addEventListener('click', () => {
    audio.chime();
    haptics.celebrate();
    burstConfetti();
    downloadBackupFile();
    render(container); // Refresh UI to show up-to-date status
  });

  // Handle File Input / Drop
  const dropZone = container.querySelector('#dropZone');
  const fileInput = container.querySelector('#fileInput');
  const previewBox = container.querySelector('#importPreview');

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('is-dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('is-dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('is-dragover');
    if (e.dataTransfer.files.length) {
      processFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
      processFile(fileInput.files[0]);
    }
  });

  function processFile(file) {
    if (file.size > MAX_IMPORT_BYTES) {
      previewBox.textContent = 'Backup exceeds 5 MiB. Choose a smaller file.';
      previewBox.hidden = false;
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const res = validateAndMigrateBackup(event.target.result);
      if (!res.valid) {
        audio.buzz();
        previewBox.innerHTML = `
          <div class="error-notice">
            <strong>Invalid Backup:</strong> ${res.error}
          </div>
        `;
        previewBox.removeAttribute('hidden');
        return;
      }

      audio.tap();
      previewBox.innerHTML = `
        <div class="preview-card">
          <h4>${res.integrityVerified ? '✓ Verified Sharp Backup' : 'Legacy Sharp Backup'}</h4>
          ${res.warnings.map((warning) => `<p>${escapeHTML(warning)}</p>`).join('')}
          <div class="preview-stats">
            <div><span>Exported:</span> <strong>${new Date(res.exportedAt).toLocaleDateString()}</strong></div>
            <div><span>Schema:</span> <strong>v${res.schemaVersion}</strong></div>
            <div><span>Recorded Sessions:</span> <strong>${res.summary.sessionCount}</strong></div>
            <div><span>Streak Days:</span> <strong>${res.summary.streak}</strong></div>
          </div>

          <div class="preview-actions">
            <button id="mergeBackupBtn" class="btn btn-secondary" type="button">
              Merge with Current Data
            </button>
            <button id="replaceBackupBtn" class="btn btn-primary" type="button">
              Replace All Local Data
            </button>
          </div>
        </div>
      `;
      previewBox.removeAttribute('hidden');

      previewBox.querySelector('#mergeBackupBtn').addEventListener('click', () => {
        const result = applyBackup(res.data, 'merge');
        if (!result.success) { alert(result.error); return; }
        audio.chime();
        burstConfetti();
        alert('Backup successfully merged with your current profile!');
        render(container);
      });

      previewBox.querySelector('#replaceBackupBtn').addEventListener('click', () => {
        if (confirm('Are you sure you want to replace all current data with this backup?')) {
          const result = applyBackup(res.data, 'replace');
          if (!result.success) { alert(result.error); return; }
          audio.chime();
          burstConfetti();
          alert('Backup restored successfully!');
          render(container);
        }
      });
    };
    reader.onerror = () => {
      previewBox.textContent = 'Could not read this backup file. Try selecting it again.';
      previewBox.hidden = false;
    };
    reader.readAsText(file);
  }
}

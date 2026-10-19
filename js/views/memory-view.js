import { createSessionScope } from '../core/session-scope.js';
import { escapeHTML as h } from '../content-validation.js';
import { createId } from '../core/identity.js';
import { chooseCluster, shuffle } from '../session/content.js';
import { projectRatings } from '../session/metrics.js';
import { ratingToTier } from '../adaptive-engine.js';

export function renderMemory(container, { repo, controller, navigate }) {
  const scope = createSessionScope(); let studying = null;
  const run = async (action) => { try { await action(); if (scope.active) draw(); } catch (e) { if (scope.active) container.querySelector('#memoryError').textContent = e.message; } };
  function draw() {
    const state = repo.snapshot(), memory = state.memory;
    container.innerHTML = '<h1 class="view-title">Time-capsule recall</h1><p>Study a set now, then return later. Recognition and free recall are different kinds of practice.</p><p id="memoryError" role="alert"></p><div id="memoryStage" class="workout-card"></div>';
    const stage = container.querySelector('#memoryStage');
    if (studying) {
      stage.innerHTML = `<h2>${h(studying.title)}</h2><p>Read these items and their cues. Commit only when you have finished studying.</p><ul class="study-items">${studying.targetItems.map((i) => `<li><strong>${h(i.word)}</strong> — ${h(i.cue)}</li>`).join('')}</ul>
        <label><input id="quickStudy" type="checkbox"> Three-minute fast track (practice, does not affect ratings)</label>
        <p><button id="commitStudy" class="btn btn-primary">Commit study set</button> <button id="cancelStudy" class="btn btn-outline">Cancel</button></p>`;
      scope.listen(stage.querySelector('#cancelStudy'), 'click', () => { studying = null; draw(); });
      scope.listen(stage.querySelector('#commitStudy'), 'click', () => run(async () => {
        const quick = stage.querySelector('#quickStudy').checked, snapshot = structuredClone(studying), now = Date.now();
        await repo.update((s) => {
          if (s.memory?.status === 'committed') throw new Error('Another tab already committed a study set. Finish that recall first.');
          s.memory = { id: createId('memory'), status: 'committed', createdAt: now, readyAt: now + (quick ? 180000 : 21600000),
            type: quick ? 'quick_timer' : 'same_day', tier: snapshot.difficultyTier, clusterId: snapshot.id,
            items: snapshot.targetItems, foils: snapshot.distractorFoils, studyMode: 'self-paced', version: 1 };
          s.memoryExposure ||= {}; s.memoryExposure[snapshot.id] = (s.memoryExposure[snapshot.id] || 0) + 1; return s;
        }); studying = null;
      }));
    } else if (memory?.status === 'committed') {
      const ready = Date.now() >= memory.readyAt;
      stage.innerHTML = `<h2>${ready ? 'Your recall is ready' : 'Study set saved'}</h2><p>${memory.items.length} items committed ${new Date(memory.createdAt).toLocaleString()}.</p>
        <p>Recall opens ${new Date(memory.readyAt).toLocaleString()}. ${memory.type === 'quick_timer' ? 'Fast-track practice is reported separately.' : 'The actual elapsed interval is recorded with your result.'}</p>
        <p>Sharp cannot wake a closed app to remind you. Use a calendar reminder in Settings.</p>
        ${ready ? '<button id="recallStudy" class="btn btn-primary">Begin recognition recall</button><button id="freeRecall" class="btn btn-outline">Try free recall (unrated)</button>' : '<button id="checkReady" class="btn btn-outline">Check readiness</button>'}`;
      scope.listen(stage.querySelector('#checkReady') || new EventTarget(), 'click', draw);
      scope.listen(stage.querySelector('#recallStudy') || new EventTarget(), 'click', () => run(async () => { navigate(`session/${await controller.recallMemory()}`); }));
      scope.listen(stage.querySelector('#freeRecall') || new EventTarget(), 'click', () => {
        stage.innerHTML = '<h2>Free recall practice</h2><p>Enter one remembered item per line. Exact words are checked, ignoring case and punctuation. This practice makes later recognition unrated.</p><label for="recallWords">Remembered items</label><textarea id="recallWords" rows="7"></textarea><button id="scoreRecall" class="btn btn-primary">Check recall</button>';
        scope.listen(stage.querySelector('#scoreRecall'), 'click', () => run(async () => {
          const normalize = (t) => t.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
          const response = new Set(stage.querySelector('#recallWords').value.split('\n').map(normalize).filter(Boolean));
          const hits = memory.items.filter((i) => response.has(normalize(i.word))).length;
          await repo.update((s) => { if (s.memory?.id !== memory.id) throw new Error('The study set changed in another tab.'); s.memory.freeRecallPractised = true;
            s.memoryHistory ||= []; s.memoryHistory.push({ id: createId('recall'), memoryId: memory.id, mode: 'free-recall', practice: true,
              hits, responses: response.size, targets: memory.items.length, actualDelayMs: Date.now() - memory.createdAt, timestamp: Date.now() }); return s; });
          stage.innerHTML = `<h2>Free recall result</h2><p>${hits} of ${memory.items.length} items recalled exactly; ${Math.max(0, response.size - hits)} unmatched responses.</p><p>Saved as unrated practice.</p><a class="btn btn-primary" href="#/today">Return to Today</a>`;
        }));
      });
    } else {
      stage.innerHTML = `<h2>${memory ? 'Recall completed' : 'Build a memory practice habit'}</h2><p>Study a themed set, then return after six hours. A three-minute practice option is available.</p><button id="newStudy" class="btn btn-primary">Study a new set</button>`;
      scope.listen(stage.querySelector('#newStudy'), 'click', () => { studying = chooseCluster(repo.snapshot(), ratingToTier(projectRatings(repo.snapshot()).ratings.memory), createId('study')); draw(); });
    }
  }
  draw(); return scope.dispose;
}

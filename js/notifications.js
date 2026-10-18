// Notifications Engine for Sharp — Web Notifications + In-App Daily Prompts
import { loadJSON, saveJSON, KEYS } from './storage.js';

export class NotificationsManager {
  constructor() {
    this.inAppListeners = new Set();
  }

  isSupported() {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  getPermissionState() {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission; // 'granted', 'denied', 'default'
  }

  async requestPermission() {
    if (!this.isSupported()) return 'unsupported';
    try {
      const result = await Notification.requestPermission();
      const prefs = loadJSON(KEYS.PREFERENCES, {});
      prefs.notifications = result === 'granted';
      saveJSON(KEYS.PREFERENCES, prefs);
      return result;
    } catch (e) {
      console.warn('Notification permission request error:', e);
      return 'denied';
    }
  }

  onInAppNotice(callback) {
    this.inAppListeners.add(callback);
    return () => this.inAppListeners.delete(callback);
  }

  notify({ title, body, tag, url, icon = 'assets/icons/icon-192.png' }) {
    // 1. Always trigger in-app toast for visibility
    this.inAppListeners.forEach((fn) => {
      try {
        fn({ title, body, tag, url });
      } catch (err) {
        console.warn('Error in in-app notification listener:', err);
      }
    });

    // 2. If system permission granted, send system notification
    if (this.isSupported() && Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, {
              body,
              icon,
              badge: 'assets/favicon.svg',
              tag: tag || 'sharp-notice',
              renotify: true,
              data: { url: url || './index.html' }
            });
          });
        } else {
          new Notification(title, {
            body,
            icon,
            tag: tag || 'sharp-notice',
            data: { url: url || './index.html' }
          });
        }
      } catch (err) {
        console.warn('Error displaying system notification:', err);
      }
    }
  }

  checkPendingPrompts() {
    const delayed = loadJSON(KEYS.DELAYED_MEMORY, null);
    const workout = loadJSON(KEYS.DAILY_WORKOUT, null);
    const today = new Date().toISOString().slice(0, 10);
    const nowHour = new Date().getHours();
    const prompts = [];

    // Check 1: Delayed memory recall ready
    if (delayed && delayed.status === 'committed') {
      const readyTime = delayed.readyAt || (delayed.createdAt + 6 * 3600 * 1000);
      const isReady = Date.now() >= readyTime || (delayed.type === 'quick_timer' && Date.now() >= readyTime);
      if (isReady) {
        prompts.push({
          id: 'delayed-recall-ready',
          type: 'recall',
          title: '🌙 Time for Evening Recall!',
          body: `You committed ${delayed.items?.length || 5} items earlier. Test your retention now!`,
          actionHash: '#/games/delayed-memory',
          actionText: 'Begin Recall Test'
        });
      } else if (nowHour < 12 && (!delayed.createdAt || new Date(delayed.createdAt).toISOString().slice(0, 10) !== today)) {
        // Morning prompt to commit new items
        prompts.push({
          id: 'morning-commit-needed',
          type: 'morning',
          title: '🌅 Morning Memory Drop Ready',
          body: 'Study your daily memory items now and test your recall this evening.',
          actionHash: '#/games/delayed-memory',
          actionText: 'Study Morning Items'
        });
      }
    } else if (!delayed || (delayed.status === 'completed' && new Date(delayed.completedAt).toISOString().slice(0, 10) !== today)) {
      prompts.push({
        id: 'morning-commit-needed',
        type: 'morning',
        title: '🌅 New Memory Items Ready',
        body: 'Commit 5 new patterns & words to memory today to train long-term retention.',
        actionHash: '#/games/delayed-memory',
        actionText: 'Study Now'
      });
    }

    // Check 2: Daily workout not yet completed
    const streaks = loadJSON(KEYS.STREAKS, { current: 0, lastWorkoutDate: null });
    const workoutDoneToday = streaks.lastWorkoutDate === today;
    if (!workoutDoneToday) {
      prompts.push({
        id: 'daily-workout-pending',
        type: 'workout',
        title: '⚡ Daily Workout Waiting',
        body: streaks.current > 0
          ? `Protect your ${streaks.current}-day streak! Complete today\'s 4-puzzle challenge.`
          : 'Complete your 4-puzzle cognitive workout to build your daily streak.',
        actionHash: '#/workout',
        actionText: 'Start Workout'
      });
    }

    return prompts;
  }
}

export const notifications = new NotificationsManager();

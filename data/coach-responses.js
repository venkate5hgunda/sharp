// Project-authored offline encouragement. No model, network, scores or personal data.
export const COACH_RESPONSES = Object.freeze(Object.fromEntries(Object.entries({
  general: [
    'Try one small puzzle and look for a new clue.',
    'Choose a skill you feel curious about and explore one round.',
    'A small practice session is plenty. Begin whenever you feel ready.',
    'Bring your curiosity to the next puzzle and see what you notice.',
    'Try an untimed round and give your ideas room to unfold.'
  ],
  challenging: [
    'That one was tricky. Check the explanation and try a different strategy.',
    'Pause for a breath, then look for one clue at a time.',
    'A difficult round is a good moment to explore the explanation.',
    'Try slowing down and checking one step before choosing your answer.',
    'You can take a break and return whenever you feel ready.'
  ],
  memory: [
    'Picture a small story connecting the words, then try recalling them later.',
    'Give each item a vivid image and notice what comes back later.',
    'Try grouping the items into a few meaningful little scenes.',
    'Study one part at a time, then look away and recall it.',
    'A silly mental picture can make your next recall attempt more interesting.'
  ],
  math: [
    'Break the calculation into smaller steps, then check each operation in order.',
    'Try estimating first, then compare your calculation with that rough answer.',
    'Look for a friendly number that makes this calculation easier to handle.',
    'Read the units carefully before deciding which operation to use.',
    'Work through one operation at a time and check the result.'
  ],
  logic: [
    'Use only the given facts, then check which conclusion must follow.',
    'Try testing each option against the clues, one statement at a time.',
    'Look for a conclusion that holds even when you change your assumptions.',
    'Sketch a simple ordering if the clues feel hard to hold together.',
    'Separate what must be true from what could possibly be true.'
  ],
  comprehension: [
    'Look back at the passage and find evidence for your answer.',
    'Separate what the passage states from what it leaves uncertain.',
    'Find the sentence that supports your choice before moving ahead.',
    'Notice whether the passage describes an observation or explains its cause.',
    'Try summarizing the main idea in a few words before answering.'
  ],
  focus: [
    'Take a breath and give one detail your attention at a time.',
    'Slow down for a moment, then look for the next small clue.',
    'Let the extra details fade while you check the current instruction.',
    'Try a comfortable pace and notice which detail matters most.'
  ],
  weekly: [
    'Your weekly explorer badge is earned. Pause and enjoy the practice you completed.',
    'Notice the practice you completed, then choose a skill you feel curious about.',
    'Enjoy your weekly discoveries and leave room for a restful break.',
    'Your explorer badge reflects completed practice. Pick your next adventure whenever you like.'
  ],
  progress: [
    'Look for a skill you would enjoy exploring again next time.',
    'Notice the practice behind each result and choose one small next step.',
    'Compare similar rounds when reflecting on your practice over time.',
    'Progress takes different shapes. Use these results to guide your next choice.'
  ],
  settings: [
    'Choose the options that suit you, then explore at your own pace.',
    'Take your time with settings; practice will be here when you are ready.',
    'Keep the sounds and reminders that make practice comfortable for you.'
  ],
  backup: [
    'Keep a backup somewhere you can find it when you need it.',
    'A saved backup helps you carry your practice history to another device.',
    'Take a moment to check your backup before making changes to storage.'
  ]
}).map(([key, lines]) => [key, Object.freeze(lines)])));

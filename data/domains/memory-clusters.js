// Extensive Memory Clusters Dataset for Time-Capsule Recall & Long-Term Retention
// Themed clusters designed for Morning Study & Evening Delayed Recall

export const MEMORY_CLUSTERS = [
  {
    id: 'mem_cluster_celestial',
    title: 'Celestial Cartography & Deep Space',
    theme: 'Astronomy',
    difficultyTier: 2,
    targetItems: [
      { id: 'c1', word: 'Polaris', icon: '⭐', category: 'Navigation Star', cue: 'Northern pole anchor star', associativeFact: 'Polaris sits almost directly above Earth\'s true celestial north.' },
      { id: 'c2', word: 'Sextant', icon: '📐', category: 'Navigational Tool', cue: 'Mirrored celestial angle measurer', associativeFact: 'Used by navigators to calculate latitude from the horizon.' },
      { id: 'c3', word: 'Zenith', icon: '🌌', category: 'Coordinates', cue: 'Imaginary point directly overhead', associativeFact: 'The zenith is exactly 90 degrees above the astronomical horizon.' },
      { id: 'c4', word: 'Pulsar', icon: '💫', category: 'Cosmic Entity', cue: 'Rapidly spinning magnetized neutron star', associativeFact: 'Emits periodic pulses of radiation like a cosmic lighthouse.' },
      { id: 'c5', word: 'Code 842', icon: '🔐', category: 'Passkey', cue: '3-digit observatory access code', associativeFact: 'Evening verification pin: 842.' }
    ],
    distractorFoils: [
      { word: 'Sirius', icon: '✨', category: 'Star', foilType: 'semantic_sibling' },
      { word: 'Compass', icon: '🧭', category: 'Tool', foilType: 'category_cousin' },
      { word: 'Nadir', icon: '🌑', category: 'Coordinates', foilType: 'antonym' },
      { word: 'Quasar', icon: '☄️', category: 'Cosmic Entity', foilType: 'phonetic_cousin' },
      { word: 'Code 824', icon: '🔒', category: 'Passkey', foilType: 'digit_transposition' },
      { word: 'Telescope', icon: '🔭', category: 'Tool', foilType: 'thematic_distractor' }
    ],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'mem_cluster_maritime',
    title: 'Age of Exploration & Maritime Trade',
    theme: 'Maritime',
    difficultyTier: 3,
    targetItems: [
      { id: 'm1', word: 'Schooner', icon: '⛵', category: 'Vessel', cue: 'Fore-and-aft rigged sailing ship', associativeFact: 'Renowned for fast coastal trade and high maneuverability.' },
      { id: 'm2', word: 'Archipelago', icon: '🏝️', category: 'Geography', cue: 'Extensive cluster or chain of islands', associativeFact: 'Derived from the Aegean Sea\'s historical Greek name.' },
      { id: 'm3', word: 'Astrolabe', icon: '🧭', category: 'Navigation', cue: 'Two-dimensional model of the celestial sphere', associativeFact: 'Enabled sailors to determine local solar and sidereal time.' },
      { id: 'm4', word: 'Trade Winds', icon: '💨', category: 'Meteorology', cue: 'Permanent east-to-west prevailing tropical winds', associativeFact: 'Powered colonial merchant vessels crossing the Atlantic.' },
      { id: 'm5', word: 'Harbor', icon: '⚓', category: 'Haven', cue: 'Sheltered body of coastal mooring water', associativeFact: 'Protected fleets from open ocean swells.' },
      { id: 'm6', word: 'Code 519', icon: '🔐', category: 'Passkey', cue: '3-digit port manifest code', associativeFact: 'Customs clearance key: 519.' }
    ],
    distractorFoils: [
      { word: 'Caravel', icon: '🚢', category: 'Vessel', foilType: 'semantic_sibling' },
      { word: 'Peninsula', icon: '🏖️', category: 'Geography', foilType: 'category_cousin' },
      { word: 'Chronometer', icon: '⏱️', category: 'Tool', foilType: 'thematic_distractor' },
      { word: 'Monsoon', icon: '🌧️', category: 'Meteorology', foilType: 'phonetic_cousin' },
      { word: 'Marina', icon: '🚤', category: 'Haven', foilType: 'semantic_sibling' },
      { word: 'Code 591', icon: '🔒', category: 'Passkey', foilType: 'digit_transposition' }
    ],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'mem_cluster_acoustics',
    title: 'Acoustic Science & Classical Music',
    theme: 'Music',
    difficultyTier: 3,
    targetItems: [
      { id: 'a1', word: 'Harpsichord', icon: '🎹', category: 'Instrument', cue: 'Keyboard instrument with plucked strings', associativeFact: 'Preceded the modern piano with distinct quill plucks.' },
      { id: 'a2', word: 'Resonance', icon: '🔊', category: 'Physics', cue: 'Reinforcement of sound via matching frequency', associativeFact: 'Occurs when driving frequency matches natural frequency.' },
      { id: 'a3', word: 'Metronome', icon: '⏱️', category: 'Tool', cue: 'Inverted pendulum ticking acoustic tempo', associativeFact: 'Patented by Maelzel to enforce steady rhythmic beats.' },
      { id: 'a4', word: 'Timbre', icon: '🎻', category: 'Acoustics', cue: 'Unique tone color distinct from pitch and volume', associativeFact: 'Determined by the harmonic overtone profile.' },
      { id: 'a5', word: 'Concerto', icon: '🎼', category: 'Composition', cue: 'Piece for solo instrument with orchestral backing', associativeFact: 'Popularized by Vivaldi and Mozart.' },
      { id: 'a6', word: 'Code 736', icon: '🔐', category: 'Passkey', cue: '3-digit concert hall vault code', associativeFact: 'Auditorium key: 736.' }
    ],
    distractorFoils: [
      { word: 'Clavichord', icon: '🎹', category: 'Instrument', foilType: 'semantic_sibling' },
      { word: 'Reverberation', icon: '📢', category: 'Physics', foilType: 'category_cousin' },
      { word: 'Tuning Fork', icon: '🪕', category: 'Tool', foilType: 'thematic_distractor' },
      { word: 'Cadence', icon: '🎶', category: 'Composition', foilType: 'category_cousin' },
      { word: 'Sonata', icon: '📜', category: 'Composition', foilType: 'semantic_sibling' },
      { word: 'Code 763', icon: '🔒', category: 'Passkey', foilType: 'digit_transposition' }
    ],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'mem_cluster_architecture',
    title: 'Monumental Architecture & Classical Engineering',
    theme: 'Architecture',
    difficultyTier: 4,
    targetItems: [
      { id: 'ar1', word: 'Aqueduct', icon: '🏛️', category: 'Hydraulics', cue: 'Elevated bridge channel carrying water across valleys', associativeFact: 'Engineered with precise gravity gradients across miles.' },
      { id: 'ar2', word: 'Flying Buttress', icon: '🏗️', category: 'Gothic Engineering', cue: 'Masonry strut redirecting lateral vault thrust', associativeFact: 'Allowed soaring stained glass walls in Gothic cathedrals.' },
      { id: 'ar3', word: 'Colonnade', icon: '🏛️', category: 'Classical Form', cue: 'Long sequence of evenly spaced columns', associativeFact: 'Frames monumental porticos and temples.' },
      { id: 'ar4', word: 'Oculus', icon: '☀️', category: 'Dome Feature', cue: 'Circular opening at the apex of a dome', associativeFact: 'The Pantheon\'s open oculus remains open to sky and rain.' },
      { id: 'ar5', word: 'Cantilever', icon: '📐', category: 'Structural', cue: 'Projecting beam anchored only at one end', associativeFact: 'Enabled dramatic overhanging terraces in modern design.' },
      { id: 'ar6', word: 'Code 924', icon: '🔐', category: 'Passkey', cue: '3-digit archive vault code', associativeFact: 'Blueprint chamber key: 924.' }
    ],
    distractorFoils: [
      { word: 'Viaduct', icon: '🌉', category: 'Engineering', foilType: 'semantic_sibling' },
      { word: 'Gargoyle', icon: '🗿', category: 'Gothic', foilType: 'thematic_distractor' },
      { word: 'Arcade', icon: '🏛️', category: 'Form', foilType: 'category_cousin' },
      { word: 'Cupola', icon: '🏠', category: 'Feature', foilType: 'category_cousin' },
      { word: 'Keystone', icon: '🧱', category: 'Structural', foilType: 'structural_cousin' },
      { word: 'Code 942', icon: '🔒', category: 'Passkey', foilType: 'digit_transposition' }
    ],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  }
];

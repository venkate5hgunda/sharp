// Extensive Logic & Analytical Reasoning Dataset for Sharp
// Domains: Categorical Syllogisms, Conditionals, Constraint Ordering, Truth-Tellers & Knaves

export const LOGIC_PUZZLES = [
  {
    id: 'logic_syl_001',
    domain: 'logic',
    category: 'syllogisms',
    skill: 'categorical_deduction',
    difficultyTier: 1,
    estimatedSeconds: 20,
    title: 'Primate Classification',
    premises: [
      'All primates are mammals.',
      'All chimpanzees are primates.'
    ],
    question: 'Which conclusion MUST logically follow from the premises?',
    options: [
      'All chimpanzees are mammals.',
      'Some mammals are not primates.',
      'All mammals are chimpanzees.',
      'No chimpanzees are primates.'
    ],
    correctAnswer: 'All chimpanzees are mammals.',
    explanation: 'Transitive categorical deduction (Barbara syllogism): Since Chimpanzees ⊆ Primates and Primates ⊆ Mammals, Chimpanzees ⊆ Mammals necessarily.',
    distractorRationales: {
      'Some mammals are not primates.': 'While true in biology, it is not formally asserted or derived from the premises alone.',
      'All mammals are chimpanzees.': 'Illicit conversion: All A are B does not imply All B are A.',
      'No chimpanzees are primates.': 'Direct contradiction of Premise 2.'
    },
    hints: [
      'Primates is the bridge connecting chimpanzees and mammals.',
      'Think of nested concentric circles: Chimpanzees inside Primates, Primates inside Mammals.'
    ],
    tags: ['syllogism', 'transitive', 'biology', 'foundational'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'logic_syl_002',
    domain: 'logic',
    category: 'syllogisms',
    skill: 'negative_universal',
    difficultyTier: 1,
    estimatedSeconds: 20,
    title: 'Featherless Reptiles',
    premises: [
      'No reptiles have feathers.',
      'All geckos are reptiles.'
    ],
    question: 'Which statement is guaranteed to be true?',
    options: [
      'No geckos have feathers.',
      'Some geckos have feathers.',
      'All creatures without feathers are geckos.',
      'Geckos are closely related to birds.'
    ],
    correctAnswer: 'No geckos have feathers.',
    explanation: 'Universal negative deduction (Celarent syllogism): If category R has zero overlap with F, and G is entirely within R, G has zero overlap with F.',
    distractorRationales: {
      'Some geckos have feathers.': 'Direct contradiction of the derived deduction.',
      'All creatures without feathers are geckos.': 'Affirming the consequent fallacy; many creatures lack feathers without being geckos.',
      'Geckos are closely related to birds.': 'Extraneous claim unsupported by premises.'
    },
    hints: ['If a club bans feathers, and geckos are members, do geckos have feathers?'],
    tags: ['syllogism', 'universal-negative', 'foundational'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'logic_syl_003',
    domain: 'logic',
    category: 'syllogisms',
    skill: 'particular_affirmative',
    difficultyTier: 2,
    estimatedSeconds: 25,
    title: 'Architects & Cyclists',
    premises: [
      'Some architects are avid cyclists.',
      'All avid cyclists own helmets.'
    ],
    question: 'What can be conclusively deduced from these statements?',
    options: [
      'Some architects own helmets.',
      'All architects own helmets.',
      'Everyone who owns a helmet is an architect.',
      'No avid cyclists are architects.'
    ],
    correctAnswer: 'Some architects own helmets.',
    explanation: 'Darii syllogism: The non-empty intersection of Architects and Cyclists must also fall into the category of Helmet Owners.',
    distractorRationales: {
      'All architects own helmets.': 'Overgeneralization; we only know about the architects who cycle.',
      'Everyone who owns a helmet is an architect.': 'Reversal fallacy: Helmet owners is a broader group.',
      'No avid cyclists are architects.': 'Direct contradiction of Premise 1.'
    },
    hints: ['Focus only on the specific architects who cycle.'],
    tags: ['syllogism', 'particular-affirmative', 'intersection'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'logic_order_001',
    domain: 'logic',
    category: 'ordering',
    skill: 'transitive_ranking',
    difficultyTier: 2,
    estimatedSeconds: 25,
    title: 'The Marathon Finish',
    premises: [
      'Leo finished the race ahead of Maya.',
      'Maya finished ahead of Kai.',
      'Elena finished ahead of Leo.'
    ],
    question: 'Who finished in first place?',
    options: [
      'Elena',
      'Leo',
      'Maya',
      'Kai'
    ],
    correctAnswer: 'Elena',
    explanation: 'Construct the strict linear chain: Elena > Leo > Maya > Kai. Elena has no one ahead of her.',
    distractorRationales: {
      'Leo': 'Leo is ahead of Maya, but Elena is ahead of Leo.',
      'Maya': 'Maya finished behind both Elena and Leo.',
      'Kai': 'Kai finished last among the four.'
    },
    hints: ['Write out the > inequality symbols for each pair.'],
    tags: ['ordering', 'inequalities', 'deduction'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'logic_order_002',
    domain: 'logic',
    category: 'ordering',
    skill: 'conditional_ranking',
    difficultyTier: 3,
    estimatedSeconds: 30,
    title: 'Conference Presentation Order',
    premises: [
      'Five speakers (A, B, C, D, E) present one after another.',
      'B speaks immediately before C.',
      'D speaks before E, and E speaks before A.',
      'E is not the first speaker, and C is the final speaker.'
    ],
    question: 'Which speaker must present first?',
    options: [
      'D',
      'E',
      'B',
      'A'
    ],
    correctAnswer: 'D',
    explanation: 'C occupies slot 5 and B immediately precedes C in slot 4. The remaining three follow D before E before A, giving D, E, A, B, C. Therefore D must be first.',
    proof: { type: 'ordering', names: ['A', 'B', 'C', 'D', 'E'], before: [['D', 'E'], ['E', 'A'], ['A', 'B'], ['B', 'C']], position: 0 },
    distractorRationales: {
      'B': 'B is fixed in slot 4 immediately before C.',
      'E': 'E follows D, so E cannot be first.',
      'A': 'A must come after D.'
    },
    hints: ['Slot 5 is C, slot 4 is B. Place the remaining three in order.'],
    tags: ['ordering', 'slot-assignment', 'intermediate'],
    metadata: { version: 2, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'logic_syl_004',
    domain: 'logic',
    category: 'syllogisms',
    skill: 'particular_negative',
    difficultyTier: 3,
    estimatedSeconds: 30,
    title: 'Translucent Minerals',
    premises: [
      'No mineral is a living organism.',
      'All quartz specimens are minerals.',
      'Some quartz specimens are translucent.'
    ],
    question: 'Which deduction is validly justified?',
    options: [
      'Some translucent objects are not living organisms.',
      'All translucent objects are minerals.',
      'All living organisms are opaque.',
      'No quartz specimen is translucent.'
    ],
    correctAnswer: 'Some translucent objects are not living organisms.',
    explanation: 'The translucent quartz specimens are minerals. Since all minerals are non-living, those translucent specimens cannot be living organisms.',
    distractorRationales: {
      'All translucent objects are minerals.': 'Undistributed middle; water is translucent without being a mineral.',
      'All living organisms are opaque.': 'Jumping to a universal conclusion not asserted by premises (e.g. jellyfish are translucent).',
      'No quartz specimen is translucent.': 'Direct contradiction of Premise 3.'
    },
    hints: ['Focus on the specific quartz items that are translucent.'],
    tags: ['syllogism', 'particular-negative', 'intermediate'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'logic_cond_001',
    domain: 'logic',
    category: 'conditionals',
    skill: 'contrapositive',
    difficultyTier: 3,
    estimatedSeconds: 25,
    title: 'Subway Delay Rule',
    premises: [
      'If the central power grid trips, the express subway halts.',
      'The express subway is running smoothly on schedule.'
    ],
    question: 'What can be logically concluded with absolute certainty?',
    options: [
      'The central power grid did not trip.',
      'The local subway line is also running smoothly.',
      'The central power grid tripped but was repaired in seconds.',
      'No conclusion can be drawn without checking the grid directly.'
    ],
    correctAnswer: 'The central power grid did not trip.',
    explanation: 'Modus Tollens: If P → Q, then ¬Q → ¬P. Since the subway did not halt (¬Q), the power grid could not have tripped (¬P).',
    distractorRationales: {
      'The local subway line is also running smoothly.': 'Out-of-scope; premises only discuss the express line.',
      'The central power grid tripped but was repaired in seconds.': 'Violates the strict conditional rule: if it trips, the subway halts.',
      'No conclusion can be drawn without checking the grid directly.': 'Incorrect; Modus Tollens guarantees a deductive conclusion.'
    },
    hints: ['If P causes Q, and Q did not happen, could P have occurred?'],
    tags: ['conditionals', 'modus-tollens', 'contrapositive'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'logic_kk_001',
    domain: 'logic',
    category: 'knights_knaves',
    skill: 'paradox_resolution',
    difficultyTier: 4,
    estimatedSeconds: 35,
    title: 'The Island of Truth',
    premises: [
      'Knights always tell the absolute truth. Knaves always lie.',
      'Inhabitant A says: "At least one of us is a Knave."',
      'Inhabitant B says nothing.'
    ],
    question: 'What are Inhabitant A and Inhabitant B?',
    options: [
      'A is a Knight, and B is a Knave.',
      'Both A and B are Knaves.',
      'Both A and B are Knights.',
      'A is a Knave, and B is a Knight.'
    ],
    correctAnswer: 'A is a Knight, and B is a Knave.',
    explanation: 'Hypothesis 1: Assume A is a Knave. Then A\'s statement must be false. The negation of "at least one is a Knave" is "neither is a Knave" (both are Knights), which contradicts A being a Knave. Thus A cannot be a Knave. A must be a Knight (truthful). Since A tells the truth that "at least one is a Knave", and A is not a Knave, B must be the Knave.',
    distractorRationales: {
      'Both A and B are Knaves.': 'Self-defeating contradiction (a Knave would be speaking truth).',
      'Both A and B are Knights.': 'If both were Knights, A\'s statement that at least one is a Knave would be a lie, impossible for a Knight.',
      'A is a Knave, and B is a Knight.': 'If A were a Knave, A\'s statement would be true, which is impossible.'
    },
    hints: ['Test what happens if Inhabitant A were lying.'],
    tags: ['knights-and-knaves', 'truth-tables', 'advanced'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'logic_cond_002',
    domain: 'logic',
    category: 'conditionals',
    skill: 'affirming_the_consequent_fallacy',
    difficultyTier: 4,
    estimatedSeconds: 30,
    title: 'The Sprinkler Dilemma',
    premises: [
      'If it rains heavily, the garden soil will be thoroughly soaked.',
      'The garden soil is thoroughly soaked.'
    ],
    question: 'What can be conclusively deduced from these statements?',
    options: [
      'No definitive conclusion about rain can be drawn.',
      'It rained heavily.',
      'The automated sprinkler must have failed.',
      'It did not rain heavily.'
    ],
    correctAnswer: 'No definitive conclusion about rain can be drawn.',
    explanation: 'Fallacy of Affirming the Consequent: P → Q and Q does not imply P. The soil could be soaked due to lawn sprinklers, a burst hose, or melting snow.',
    distractorRationales: {
      'It rained heavily.': 'Classic fallacy of affirming the consequent; other causes could soak the soil.',
      'The automated sprinkler must have failed.': 'Speculation unsupported by the premise.',
      'It did not rain heavily.': 'Rain is not ruled out; it simply cannot be definitively concluded.'
    },
    hints: ['Can multiple different causes produce wet soil?'],
    tags: ['fallacies', 'affirming-consequent', 'conditionals', 'advanced'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'logic_syl_005',
    domain: 'logic',
    category: 'syllogisms',
    skill: 'contrapositive_chain',
    difficultyTier: 5,
    estimatedSeconds: 40,
    title: 'Musicians & Music Theory',
    premises: [
      'Every musician who studies theory plays the piano.',
      'No self-taught drummer plays the piano.',
      'Carlos is a self-taught drummer.'
    ],
    question: 'Which statement MUST be logically true about Carlos?',
    options: [
      'Carlos does not study theory as a musician.',
      'Carlos cannot read sheet music.',
      'Carlos wants to learn the piano.',
      'Carlos plays multiple percussion instruments.'
    ],
    correctAnswer: 'Carlos does not study theory as a musician.',
    explanation: 'Premise 2 & 3: Carlos is a self-taught drummer, so Carlos does not play piano (¬Piano). Premise 1 states: (Musician ∧ Studies Theory) → Piano. By contrapositive: ¬Piano → ¬(Musician ∧ Studies Theory). Therefore, Carlos cannot be a musician who studies theory.',
    distractorRationales: {
      'Carlos cannot read sheet music.': 'Not stated in premises; reading music is not synonymous with studying formal theory.',
      'Carlos wants to learn the piano.': 'Speculative personal desire unrelated to deductive premises.',
      'Carlos plays multiple percussion instruments.': 'Unsubstantiated detail.'
    },
    hints: ['Form the contrapositive of the first rule.'],
    tags: ['syllogism', 'contrapositive', 'expert'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'logic_kk_002',
    domain: 'logic',
    category: 'knights_knaves',
    skill: 'biconditional_deduction',
    difficultyTier: 5,
    estimatedSeconds: 45,
    title: 'The Two Gatekeepers',
    premises: [
      'Gatekeeper X and Gatekeeper Y each either always tell truth (Knight) or always lie (Knave).',
      'X says: "Y is a Knave if and only if I am a Knight."',
      'Y says: "At least one of us is a Knight."'
    ],
    question: 'What is the true identity of Gatekeeper X and Gatekeeper Y?',
    options: [
      'X is a Knave, and Y is a Knight.',
      'X is a Knight, and Y is a Knight.',
      'X is a Knave, and Y is a Knave.',
      'X is a Knight, and Y is a Knave.'
    ],
    correctAnswer: 'X is a Knave, and Y is a Knave.',
    explanation: 'Test all four assignments. If X is truthful, X forces Y to be a Knave, but then Y’s statement that at least one is a Knight would be true, a contradiction. If X is a Knave and Y a Knight, X’s biconditional is true (both sides are false), another contradiction. Both Knaves works: X’s biconditional is false (true iff false), and Y’s claim is false. This is the unique consistent assignment.',
    proof: { type: 'knights', labels: ['X', 'Y'], claims: [['iff', ['not', ['var', 'y']], ['var', 'x']], ['or', ['var', 'x'], ['var', 'y']]] },
    hints: ['A biconditional is true when both sides are false. Check all four assignments.'],
    tags: ['knights-and-knaves', 'biconditional', 'expert'],
    metadata: { version: 2, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  }
];

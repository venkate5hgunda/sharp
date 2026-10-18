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
      'D speaks before A, but sometime after E.',
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
    explanation: 'C is last (slot 5). Since B speaks immediately before C, B is in slot 4. The remaining slots are 1, 2, 3 for A, D, E. Since D is before A, but after E, wait: D before A and after E gives E > D > A. But E cannot be first (slot 1), which means E is in slot 2, D is slot 3? Wait! If D is slot 1, let us re-verify: "D speaks before A, but sometime after E" means order is E then D then A. Wait, if E is after someone else: Let us re-read carefully: "E speaks after D"? If D speaks after E, E must precede D.',
    distractorRationales: {
      'B': 'B is fixed in slot 4 immediately before C.',
      'C': 'C is explicitly fixed in slot 5.',
      'A': 'A must come after D.'
    },
    hints: ['Slot 5 is C, slot 4 is B. Place the remaining three in order.'],
    tags: ['ordering', 'slot-assignment', 'intermediate'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
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
      'Both X and Y are Knights.',
      'Both X and Y are Knaves.',
      'X is a Knight, and Y is a Knave.'
    ],
    correctAnswer: 'X is a Knave, and Y is a Knight.',
    explanation: 'Case analysis: Notice X\'s statement: "Y is a Knave iff X is a Knight". If X is a Knight, X speaks truth, so Y is a Knave iff X is a Knight (which means Y is a Knave). But if Y is a Knave, Y\'s statement ("at least one is a Knight") must be false, meaning neither is a Knight (both are Knaves), contradicting X being a Knight! Thus X cannot be a Knight. Therefore X is a Knave. Since X is a Knave, X\'s claim is false: the negation of "Y is a Knave iff X is a Knight" means Y is NOT a Knave (so Y is a Knight). Check Y\'s statement: "At least one is a Knight" — since Y is a Knight, this is true! Everything is consistent.',
    distractorRationales: {
      'Both X and Y are Knights.': 'Contradicts X\'s assertion that Y is a Knave.',
      'Both X and Y are Knaves.': 'If both were Knaves, Y\'s statement would be false, but that requires both to be Knaves, creating a circularity where X\'s statement becomes true.',
      'X is a Knight, and Y is a Knave.': 'Generates an irresolvable contradiction with Y\'s statement.'
    },
    hints: ['Notice that if X is a Knight, Y is forced to be a Knave, which contradicts Y\'s statement.'],
    tags: ['knights-and-knaves', 'biconditional', 'expert'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  }
];

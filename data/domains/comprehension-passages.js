// Extensive Verbal Comprehension & Inference Dataset for Sharp
// Domains: Scientific Inference, Historical Deduction, Critical Reasoning, Assumption Testing

export const COMPREHENSION_PASSAGES = [
  {
    id: 'comp_sci_001',
    domain: 'comprehension',
    category: 'science',
    skill: 'direct_inference',
    difficultyTier: 1,
    estimatedSeconds: 25,
    title: 'Marine Bio-acoustics in Abyssal Depths',
    passage: 'Deep-diving sperm whales emit powerful acoustic clicks not only to locate squid in abyssal darkness through echolocation, but also to coordinate group movements across miles of open ocean. Intriguingly, distinct pods develop unique rhythmic click patterns akin to regional dialects, which young calves take up to three years of social immersion to master.',
    question: 'Which deduction is directly supported by the passage?',
    options: [
      'Click sequences among sperm whales require learned vocal acquisition.',
      'Sperm whales hunt exclusively during daytime hours.',
      'Calves are born with innate proficiency in their pod’s dialect.',
      'Whale pods never interact with pods from other ocean regions.'
    ],
    correctAnswer: 'Click sequences among sperm whales require learned vocal acquisition.',
    explanation: 'The passage explicitly states that young calves take "up to three years of social immersion to master" their pod\'s dialect, which proves that the behavior is acquired through learning rather than pure instinct.',
    distractorRationales: {
      'Sperm whales hunt exclusively during daytime hours.': 'Contradicts the text, which mentions hunting in "abyssal darkness."',
      'Calves are born with innate proficiency in their pod’s dialect.': 'Directly contradicted by the statement that mastery takes three years of social immersion.',
      'Whale pods never interact with pods from other ocean regions.': 'Extraneous extrapolation not supported or stated in the text.'
    },
    hints: ['Focus on what the text says about young calves learning their dialect.'],
    tags: ['zoology', 'echolocation', 'communication', 'foundational'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'comp_eco_001',
    domain: 'comprehension',
    category: 'ecology',
    skill: 'necessary_assumption',
    difficultyTier: 2,
    estimatedSeconds: 30,
    title: 'Volatile Plant Signaling',
    passage: 'When attacked by leaf-stripping caterpillars, certain willow species release airborne volatile organic compounds. Neighboring unattacked willows absorb these airborne signals and begin synthesizing unpalatable tannins in their leaves before the insects arrive, thereby drastically reducing subsequent herbivore damage across the grove.',
    question: 'What necessary assumption does the success of this botanical defense rely upon?',
    options: [
      'The synthesized tannins deter or reduce caterpillar feeding.',
      'All willow species in the world possess identical chemical defense genes.',
      'Caterpillars prefer feeding on unattacked trees over attacked ones.',
      'Airborne volatiles are directly toxic to caterpillars on contact.'
    ],
    correctAnswer: 'The synthesized tannins deter or reduce caterpillar feeding.',
    explanation: 'For the defense mechanism to successfully "drastically reduce herbivore damage," the synthesized tannins must actually have a deterrent or protective effect against caterpillars. If caterpillars ate tannins unharmed, the signaling would fail to protect the trees.',
    distractorRationales: {
      'All willow species in the world possess identical chemical defense genes.': 'Overbroad universal claim; the passage specifies "certain willow species."',
      'Caterpillars prefer feeding on unattacked trees over attacked ones.': 'Irrelevant to whether the preemptive defense works.',
      'Airborne volatiles are directly toxic to caterpillars on contact.': 'The passage says volatiles trigger tannin synthesis in neighbors, not that volatiles kill insects directly.'
    },
    hints: ['Ask: If this assumption were false, would the defense mechanism still work?'],
    tags: ['ecology', 'botany', 'assumptions', 'intermediate'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'comp_hist_001',
    domain: 'comprehension',
    category: 'history',
    skill: 'author_intent',
    difficultyTier: 3,
    estimatedSeconds: 30,
    title: 'Medieval Portolan Charts',
    passage: 'Medieval portolan charts, constructed between the 13th and 15th centuries, depicted coastlines of the Mediterranean with remarkable navigational fidelity. Yet interior landmasses were either left completely blank or populated with fantastical mythical beasts. Rather than scientific ignorance, scholars argue this reflects the pragmatic intent of their creators: the maps were commercial sea instruments, where inland topography offered zero survival or economic utility to ship captains.',
    question: 'According to the passage, the absence of inland detail primarily demonstrates:',
    options: [
      'A deliberate functional prioritization tailored to maritime navigators.',
      'A complete lack of geographical exploration beyond coastal harbors.',
      'Strict religious censorship imposed by medieval merchant guilds.',
      'The inability of medieval cartographers to measure latitude.'
    ],
    correctAnswer: 'A deliberate functional prioritization tailored to maritime navigators.',
    explanation: 'The passage explicitly argues that omitting inland detail was a "pragmatic intent" because "inland topography offered zero survival or economic utility to ship captains," reflecting deliberate functional design rather than ignorance.',
    distractorRationales: {
      'A complete lack of geographical exploration beyond coastal harbors.': 'Refuted by the text, which says the omission was pragmatic rather than due to ignorance.',
      'Strict religious censorship imposed by medieval merchant guilds.': 'Fabricated explanation not mentioned in the text.',
      'The inability of medieval cartographers to measure latitude.': 'Irrelevant technical claim; the coastlines were actually mapped with "remarkable navigational fidelity."'
    },
    hints: ['Look for the sentence explaining why the mapmakers left landmasses blank.'],
    tags: ['cartography', 'history', 'pragmatism', 'intermediate'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'comp_phys_001',
    domain: 'comprehension',
    category: 'physics',
    skill: 'paradox_analysis',
    difficultyTier: 4,
    estimatedSeconds: 35,
    title: 'Urban Heat Island Paradox',
    passage: 'Urban heat islands stem from the replacement of permeable soil and vegetative canopies with impervious masonry and asphalt. While traditional city planning advocates planting street trees for shade, recent microclimate simulations demonstrate that dense tree canopies in narrow street canyons can paradoxically trap ground-level vehicle exhaust by dampening vertical turbulent ventilation, even while reducing local solar irradiation at the sidewalk.',
    question: 'Which of the following describes the environmental trade-off identified in the passage?',
    options: [
      'Canopies provide solar cooling yet can restrict the vertical dispersion of pollutants.',
      'Impervious masonry cools faster than organic topsoil during summer nights.',
      'Tree root networks destabilize the subterranean foundation of street canyons.',
      'Narrow street canyons receive higher cumulative solar irradiation than open boulevards.'
    ],
    correctAnswer: 'Canopies provide solar cooling yet can restrict the vertical dispersion of pollutants.',
    explanation: 'The text highlights the exact tension: trees provide shading ("reducing local solar irradiation"), but dense canopies simultaneously "trap ground-level vehicle exhaust by dampening vertical turbulent ventilation."',
    distractorRationales: {
      'Impervious masonry cools faster than organic topsoil during summer nights.': 'Factually opposite to the nature of urban heat islands.',
      'Tree root networks destabilize the subterranean foundation of street canyons.': 'Irrelevant point unmentioned in the text.',
      'Narrow street canyons receive higher cumulative solar irradiation than open boulevards.': 'Contradicts geometric physics and text.'
    },
    hints: ['Identify the two opposing effects of dense tree canopies described in the final sentence.'],
    tags: ['urban-planning', 'physics', 'trade-offs', 'advanced'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'comp_cog_001',
    domain: 'comprehension',
    category: 'cognitive_science',
    skill: 'counterfactual_analysis',
    difficultyTier: 5,
    estimatedSeconds: 40,
    title: 'The Forgetting Curve & Synaptic Pruning',
    passage: 'Early psychological models viewed memory decay as a passive degradation of neural traces over time. However, modern optogenetic research reveals that targeted forgetting is an active metabolic process governed by rac1-dependent synaptic remodeling. Far from being a flaw of human cognition, controlled forgetting enhances cognitive flexibility by clearing out dated associations, preventing over-fitting to past environments, and accelerating novel problem-solving in dynamic contexts.',
    question: 'Based on the author’s argument, an organism incapable of biological forgetting would most likely suffer from:',
    options: [
      'Cognitive rigidity when adapting to rapid environmental changes.',
      'An inability to retain childhood episodic memories.',
      'Accelerated neural fatigue due to reduced metabolic activity.',
      'A complete breakdown of sensory perception.'
    ],
    correctAnswer: 'Cognitive rigidity when adapting to rapid environmental changes.',
    explanation: 'The text argues that active forgetting "enhances cognitive flexibility by clearing out dated associations, preventing over-fitting to past environments." Inverting this (counterfactual deduction): an organism unable to forget would suffer from over-fitting and cognitive inflexibility when the environment changes.',
    distractorRationales: {
      'An inability to retain childhood episodic memories.': 'Opposite of what would happen if one could not forget.',
      'Accelerated neural fatigue due to reduced metabolic activity.': 'The text notes forgetting is an active metabolic process, not the lack thereof.',
      'A complete breakdown of sensory perception.': 'Unfounded extreme claim.'
    },
    hints: ['Consider what advantages forgetting provides according to the author, and imagine lacking them.'],
    tags: ['neuroscience', 'memory-consolidation', 'counterfactual', 'expert'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  }
];

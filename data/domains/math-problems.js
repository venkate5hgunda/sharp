// Extensive Math & Quantitative Reasoning Dataset for Sharp
// Domains: Word Problems, Mental Arithmetic, Rate & Ratio, Percentages, Multi-Step Algebra

export const MATH_PROBLEMS = [
  {
    id: 'math_word_001',
    domain: 'math',
    category: 'word_problems',
    skill: 'multi_step_arithmetic',
    difficultyTier: 1,
    estimatedSeconds: 20,
    title: 'Jack and Jill’s Fruit Basket',
    prompt: 'Jack starts with <strong>18 apples</strong>. He gives Jill <strong>7 apples</strong>. A neighbor later gifts Jack <strong>5 fresh pears</strong> and <strong>3 more apples</strong>. How many <em>apples</em> does Jack have now?',
    question: 'How many apples does Jack have currently?',
    options: [14, 19, 11, 16],
    correctAnswer: 14,
    explanation: 'Step 1: Jack has 18 apples and gives 7 to Jill: 18 - 7 = 11 apples.\nStep 2: The neighbor gives 5 pears and 3 apples. Pears are a distractor item!\nStep 3: Add only the 3 new apples: 11 + 3 = 14 apples.',
    distractorRationales: {
      19: 'Counted the 5 pears along with the apples (14 + 5 = 19).',
      11: 'Forgot to add the 3 newly gifted apples after giving 7 to Jill.',
      16: 'Subtracted 5 pears from 21.'
    },
    hints: [
      'Pay close attention to the distinction between apples and pears.',
      'Only calculate the count for apples.'
    ],
    tags: ['apples-and-pears', 'distractor-items', 'foundational'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'math_word_002',
    domain: 'math',
    category: 'word_problems',
    skill: 'fractional_reduction',
    difficultyTier: 2,
    estimatedSeconds: 25,
    title: 'The Artisanal Bakery',
    prompt: 'A bakery prepares <strong>60 croissants</strong> at dawn. By midday, they sell <strong>3/4</strong> of the batch. In the afternoon, the baker bakes <strong>25 additional croissants</strong> and sells <strong>16 more</strong> before closing.',
    question: 'How many croissants remain in the display at closing?',
    options: [24, 15, 30, 21],
    correctAnswer: 24,
    explanation: 'Step 1: Sold at midday: 3/4 of 60 = 45 croissants. Remainder: 60 - 45 = 15 croissants.\nStep 2: Afternoon baking adds 25: 15 + 25 = 40 croissants.\nStep 3: Afternoon sales: 40 - 16 = 24 croissants remaining.',
    distractorRationales: {
      15: 'Calculated the midday remainder (15) but ignored the afternoon bake and sales.',
      30: 'Calculated 60 - 45 + 25 = 40, then subtracted 10 instead of 16.',
      21: 'Computed 60 - 45 = 15, added 25 = 40, subtracted 19.'
    },
    hints: [
      'Find 3/4 of 60 first to see how many were sold in the morning.',
      'Add the newly baked croissants before subtracting afternoon sales.'
    ],
    tags: ['fractions', 'inventory', 'multi-step'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'math_word_003',
    domain: 'math',
    category: 'word_problems',
    skill: 'relative_motion',
    difficultyTier: 3,
    estimatedSeconds: 30,
    title: 'Two Commuters on the Coast Road',
    prompt: 'Maya departs Town A driving East toward Town B at <strong>60 km/h</strong>. Exactly <strong>30 minutes later</strong>, Leo leaves Town A driving the same route at <strong>80 km/h</strong>.',
    question: 'How many hours after Leo departs will he overtake Maya?',
    options: [1.5, 2.0, 1.0, 2.5],
    correctAnswer: 1.5,
    explanation: 'Step 1: In the 30 minutes (0.5 hours) before Leo leaves, Maya travels: 60 km/h × 0.5 h = 30 km.\nStep 2: Leo closes the distance at a relative speed of: 80 km/h - 60 km/h = 20 km/h.\nStep 3: Time for Leo to catch up: 30 km ÷ 20 km/h = 1.5 hours.',
    distractorRationales: {
      2.0: 'Divided 40 km head start by 20 km/h.',
      1.0: 'Forgot that Maya continues driving while Leo is in pursuit.',
      2.5: 'Calculated 1.5 hours and added Maya\'s 1-hour head start mistakenly.'
    },
    hints: [
      'Calculate Maya\'s head start in kilometers first.',
      'What is the speed difference between Leo and Maya?'
    ],
    tags: ['speed-distance-time', 'relative-velocity', 'intermediate'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'math_word_004',
    domain: 'math',
    category: 'word_problems',
    skill: 'successive_percentages',
    difficultyTier: 3,
    estimatedSeconds: 30,
    title: 'Seasonal Boutique Clearance',
    prompt: 'A winter coat has an original retail price of <strong>$120</strong>. During a holiday sale, it is discounted by <strong>25%</strong>. A loyalty club member then receives an <strong>additional 10% off</strong> the already discounted price at the register.',
    question: 'What is the final price paid by the loyalty member?',
    options: [81, 78, 84, 90],
    correctAnswer: 81,
    explanation: 'Step 1: First discount of 25%: 120 × (1 - 0.25) = 120 × 0.75 = $90.\nStep 2: Second discount of 10% on $90: 90 × (1 - 0.10) = 90 × 0.90 = $81.',
    distractorRationales: {
      78: 'Erroneously summed the percentages (25% + 10% = 35%) and calculated $120 × 0.65 = $78.',
      84: 'Subtracted $30 then subtracted only $6.',
      90: 'Stopped after the first 25% discount, forgetting the loyalty discount.'
    },
    hints: [
      'Successive discounts do not simply add together (25% + 10% ≠ 35%).',
      'Apply the 10% discount to the sale price of $90.'
    ],
    tags: ['percentages', 'successive-discount', 'finance'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'math_arith_001',
    domain: 'math',
    category: 'arithmetic',
    skill: 'order_of_operations',
    difficultyTier: 3,
    estimatedSeconds: 20,
    title: 'BODMAS Precision',
    prompt: 'Evaluate the expression: <strong>24 ÷ 3 × 2 + 15 − 4²</strong>',
    question: 'What is the value of the expression?',
    options: [15, 3, 27, 19],
    correctAnswer: 15,
    explanation: 'Follow strict order of operations (BODMAS/PEMDAS):\n1. Exponent: 4² = 16\n2. Division & Multiplication left-to-right: 24 ÷ 3 = 8, then 8 × 2 = 16\n3. Expression becomes: 16 + 15 - 16\n4. Addition and Subtraction left-to-right: 31 - 16 = 15.',
    distractorRationales: {
      3: 'Multiplied before dividing (24 ÷ 6 = 4), leading to 4 + 15 - 16 = 3.',
      27: 'Treated 4² as 8 instead of 16.',
      19: 'Calculated 16 + 15 = 31, then subtracted 12.'
    },
    hints: [
      'Multiplication and division have equal precedence—evaluate them from left to right.',
      'Compute 24 ÷ 3 before multiplying by 2.'
    ],
    tags: ['bodmas', 'pemdas', 'arithmetic'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'math_word_005',
    domain: 'math',
    category: 'word_problems',
    skill: 'work_rate',
    difficultyTier: 4,
    estimatedSeconds: 35,
    title: 'The Reservoir Pipes',
    prompt: 'Pipe A can fill a water tank in <strong>4 hours</strong>. Pipe B can fill the same tank in <strong>6 hours</strong>. If both pipes are opened simultaneously, how long will it take to fill the tank?',
    question: 'How long will both pipes take together?',
    options: ['2 hours 24 mins', '5 hours', '2 hours 30 mins', '3 hours'],
    correctAnswer: '2 hours 24 mins',
    explanation: 'Rate A = 1/4 tank per hour.\nRate B = 1/6 tank per hour.\nCombined Rate = 1/4 + 1/6 = 3/12 + 2/12 = 5/12 tank per hour.\nTotal Time = 1 ÷ (5/12) = 12/5 hours = 2.4 hours = 2 hours and 24 minutes (0.4 × 60 = 24 mins).',
    distractorRationales: {
      '5 hours': 'Averaged the two numbers (4 + 6) / 2 = 5 hours, ignoring that two pipes working together must be faster than one.',
      '2 hours 30 mins': 'Rounded 2.4 hours to 2.5 hours mistakenly.',
      '3 hours': 'Subtracted 6 - 4 + 1.'
    },
    hints: [
      'Two pipes together must fill the tank faster than the fastest individual pipe (less than 4 hours).',
      'Convert 12/5 into hours and decimal minutes.'
    ],
    tags: ['work-rate', 'algebra', 'fractions', 'advanced'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'math_arith_002',
    domain: 'math',
    category: 'arithmetic',
    skill: 'modular_arithmetic',
    difficultyTier: 4,
    estimatedSeconds: 25,
    title: 'Calendar Cycle Projection',
    prompt: 'Today is <strong>Tuesday</strong>. What day of the week will it be exactly <strong>100 days from today</strong>?',
    question: 'Which day of the week will it be?',
    options: ['Thursday', 'Wednesday', 'Friday', 'Tuesday'],
    correctAnswer: 'Thursday',
    explanation: 'A week has 7 days. We compute 100 mod 7:\n100 = 14 × 7 + 2 (remainder is 2).\nAdvancing 2 days from Tuesday lands on Thursday (Tuesday + 1 = Wednesday, + 2 = Thursday).',
    distractorRationales: {
      'Wednesday': 'Advanced by 1 day instead of the remainder 2.',
      'Friday': 'Advanced by 3 days.',
      'Tuesday': 'Assumed 100 days was an exact multiple of 7.'
    },
    hints: [
      'Divide 100 by 7 to find the remainder.',
      'Add the remainder to Tuesday.'
    ],
    tags: ['modular-arithmetic', 'cycles', 'calendar'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  },
  {
    id: 'math_word_006',
    domain: 'math',
    category: 'word_problems',
    skill: 'system_of_equations',
    difficultyTier: 5,
    estimatedSeconds: 40,
    title: 'Age Riddle',
    prompt: 'A father is currently <strong>3 times as old as his daughter</strong>. In <strong>12 years</strong>, the father will be exactly <strong>twice as old as his daughter</strong>.',
    question: 'How old is the daughter right now?',
    options: [12, 10, 15, 14],
    correctAnswer: 12,
    explanation: 'Let D = daughter\'s current age, F = father\'s current age.\nEquation 1: F = 3D\nEquation 2: F + 12 = 2(D + 12)\nSubstitute F: 3D + 12 = 2D + 24\nSubtract 2D and 12 from both sides: D = 12 years.\nFather is 36. In 12 years, daughter is 24 and father is 48 (which is 2 × 24). Perfectly verified!',
    distractorRationales: {
      10: 'If daughter was 10, father is 30. In 12 years: 22 and 42 (not double).',
      15: 'If daughter was 15, father is 45. In 12 years: 27 and 57 (not double).',
      14: 'Calculation error forgetting to distribute the 2 across (D + 12).'
    },
    hints: [
      'Set up two algebraic equations using current age and age in 12 years.',
      'Remember that both father and daughter age by 12 years.'
    ],
    tags: ['age-puzzle', 'algebra', 'systems-of-equations', 'expert'],
    metadata: { version: 1, dateAdded: '2026-10-18', timesServed: 0, userAccuracy: null }
  }
];

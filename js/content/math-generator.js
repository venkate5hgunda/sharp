// Seedable question generators. No DOM, persistence, or audio dependencies.
export function generateArithmeticProblem(config, random = Math.random) {
  const { operators, maxNumber, termsCount } = config;
  const op = operators[Math.floor(random() * operators.length)];

  let prompt = '';
  let answer = 0;

  if (op === '+') {
    const a = Math.floor(random() * maxNumber) + 5;
    const b = Math.floor(random() * maxNumber) + 5;
    if (termsCount === 3) {
      const c = Math.floor(random() * (maxNumber / 2)) + 2;
      prompt = `${a} + ${b} + ${c} = ?`;
      answer = a + b + c;
    } else {
      prompt = `${a} + ${b} = ?`;
      answer = a + b;
    }
  } else if (op === '-') {
    const a = Math.floor(random() * maxNumber) + 15;
    const b = Math.floor(random() * (a - 5)) + 3;
    prompt = `${a} − ${b} = ?`;
    answer = a - b;
  } else if (op === '*') {
    const a = Math.floor(random() * (config.tier >= 4 ? 25 : 12)) + 3;
    const b = Math.floor(random() * 12) + 2;
    prompt = `${a} × ${b} = ?`;
    answer = a * b;
  } else if (op === '/') {
    const b = Math.floor(random() * 11) + 2;
    const mult = Math.floor(random() * (config.tier >= 4 ? 20 : 12)) + 2;
    const a = b * mult;
    prompt = `${a} ÷ ${b} = ?`;
    answer = mult;
  } else if (op === '^') {
    const base = Math.floor(random() * 8) + 4;
    prompt = `${base}² = ?`;
    answer = base * base;
  } else {
    // Percentages: e.g. 15% of 80
    const percents = [10, 20, 25, 50];
    const p = percents[Math.floor(random() * percents.length)];
    const val = (Math.floor(random() * 10) + 1) * 20;
    prompt = `${p}% of ${val} = ?`;
    answer = Math.round((p / 100) * val);
  }

  const options = generateOptions(answer, random);
  return { prompt, correctAnswer: answer, options };
}

/**
 * Procedural story problem generator
 */
export function generateStoryProblem(tier, random = Math.random) {
  const templates = [
    // Template 1: Fruit/Item exchange (Jack & Jill style)
    () => {
      const names = [
        ['Jack', 'Jill'],
        ['Maya', 'Leo'],
        ['Emma', 'Noah'],
        ['Liam', 'Sophia'],
      ];
      const [p1, p2] = names[Math.floor(random() * names.length)];
      const item = ['apples', 'oranges', 'peaches', 'books'][Math.floor(random() * 4)];
      const start = Math.floor(random() * 20) + 15;
      const given = Math.floor(random() * 8) + 4;
      const found = Math.floor(random() * 6) + 3;

      if (tier <= 2) {
        return {
          prompt: `${p1} has <strong>${start} ${item}</strong>. ${p1} gives ${p2} <strong>${given}</strong>, then finds <strong>${found} more</strong>. How many ${item} does ${p1} have now?`,
          answer: start - given + found,
        };
      } else {
        const bonus = Math.floor(random() * 5) + 2;
        return {
          prompt: `${p1} has <strong>${start} ${item}</strong>. ${p1} gives ${p2} <strong>${given}</strong>. ${p2} shares half of those with a friend, and gives ${p1} back <strong>${bonus}</strong> as a thank you. How many ${item} does ${p1} have now?`,
          answer: start - given + bonus,
        };
      }
    },

    // Template 2: Bakery / Inventory
    () => {
      const baked = (Math.floor(random() * 5) + 3) * 12; // dozens
      const soldMorning = Math.floor(baked * 0.5);
      const afternoonBake = Math.floor(random() * 15) + 10;
      const soldAfternoon = Math.floor(random() * 12) + 5;
      return {
        prompt: `A bakery bakes <strong>${baked} muffins</strong> in the morning and sells <strong>${soldMorning}</strong>. In the afternoon, they bake <strong>${afternoonBake} more</strong> and sell <strong>${soldAfternoon}</strong>. How many muffins remain at closing?`,
        answer: baked - soldMorning + afternoonBake - soldAfternoon,
      };
    },

    // Template 3: Travel & Speed
    () => {
      const speed1 = 40 + Math.floor(random() * 4) * 10; // 40, 50, 60, 70
      const hours1 = 2;
      const speed2 = 60;
      const hours2 = 1.5;
      const totalDist = Math.round(speed1 * hours1 + speed2 * hours2);
      return {
        prompt: `A commuter drives at <strong>${speed1} km/h for ${hours1} hours</strong>, then takes the highway at <strong>${speed2} km/h for ${hours2} hours</strong>. What is the total distance traveled?`,
        answer: totalDist,
      };
    },

    // Template 4: Shopping discount & budget
    () => {
      const price = (Math.floor(random() * 6) + 4) * 10; // 40, 50, 60...
      const discountPercent = 20;
      const discountedPrice = price * 0.8;
      const coupon = 5;
      return {
        prompt: `A sweater priced at <strong>$${price}</strong> is on sale for <strong>${discountPercent}% off</strong>. At checkout, an additional <strong>$${coupon} coupon</strong> is applied. What is the final price?`,
        answer: discountedPrice - coupon,
      };
    },
  ];

  const chosen = templates[Math.floor(random() * templates.length)]();
  const options = generateOptions(chosen.answer, random);
  return { prompt: chosen.prompt, correctAnswer: chosen.answer, options };
}

function generateOptions(correctAnswer, random) {
  const options = new Set([correctAnswer]);
  const offsets = [-10, -5, -2, -1, 1, 2, 5, 10, 15];
  shuffleOptions(offsets, random);

  for (const offset of offsets) {
    if (options.size >= 4) break;
    const candidate = correctAnswer + offset;
    if (candidate > 0 && candidate !== correctAnswer) {
      options.add(candidate);
    }
  }

  // If still less than 4, add random nearby numbers
  let fallbackDelta = 3;
  while (options.size < 4) {
    options.add(correctAnswer + fallbackDelta);
    fallbackDelta += 2;
  }

  return shuffleOptions(Array.from(options), random);
}

function shuffleOptions(items, random) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

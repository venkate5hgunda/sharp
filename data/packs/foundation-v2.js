// Project-authored, deterministic practice templates. Tiers are provisional, not calibrated.
// Math/logic answers have independent proof models; passage answers cite exact evidence.
const question = (id, domain, skill, tier, prompt, options, explanation, extra = {}) => ({
  id, domain, skill, difficultyTier: tier, category: skill, question: prompt, prompt,
  options, correctAnswer: options[0], explanation, metadata: { version: 1 }, ...extra
});
const math = [];
for (let tier = 1; tier <= 7; tier++) for (let variant = 1; variant <= 8; variant++) {
  const start = 12 + tier * 13 + variant * 7, given = 3 + variant, added = 2 * tier + variant;
  const answer = start - given + added;
  math.push(question(`foundation.inventory.${tier}.${variant}`, 'math', 'quantity_tracking', tier,
    `A workshop has ${start} bolts. It uses ${given}, then receives ${added} more. A separate shelf holds ${variant + 10} washers. How many bolts remain?`,
    [answer, start + given + added, start - given, answer + given],
    `${start} − ${given} + ${added} = ${answer}. Washers do not change the bolt count.`, { proof: { type: 'inventory', start, given, added } }));
  const rate = tier * 4 + variant + 3, hours = 2 + variant % 3, extra = 3 * variant + tier, distance = rate * hours + extra;
  math.push(question(`foundation.rate.${tier}.${variant}`, 'math', 'rate_and_total', tier,
    `A cyclist rides ${hours} hours at ${rate} km/h, then travels ${extra} more kilometres. What is the total distance in kilometres?`,
    [distance, rate * hours, distance + hours, rate + hours + extra],
    `Distance equals rate times time: ${rate} × ${hours} + ${extra} = ${distance} km.`, { proof: { type: 'rate', rate, hours, extra } }));
  const price = (tier + variant + 2) * 20, percent = [10, 20, 25, 50][variant % 4], coupon = tier + 2;
  const final = price * (100 - percent) / 100 - coupon;
  math.push(question(`foundation.discount.${tier}.${variant}`, 'math', 'percentage_sequence', tier,
    `An item costs $${price}. A ${percent}% discount applies first, then a $${coupon} coupon. What is the final price in dollars?`,
    [final, price - coupon, final + coupon, price - price * percent / 100 + coupon],
    `Keep ${100 - percent}% of $${price}, then subtract $${coupon}: ${price} × ${(100 - percent) / 100} − ${coupon} = ${final}.`, { proof: { type: 'discount', price, percent, coupon } }));
}
const logic = [];
const names = ['Ari', 'Bo', 'Cleo', 'Dev', 'Ena', 'Finn', 'Gia', 'Hugo'];
for (let v = 0; v < 32; v++) {
  const order = Array.from({ length: 4 }, (_, i) => `${names[(v + i) % names.length]}-${Math.floor(v / 8) + 1}`);
  const position = v % 4, answer = order[position];
  logic.push(question(`foundation.order.${v}`, 'logic', 'constraint_ordering', 1 + v % 4,
    `Four people occupy distinct positions in a queue. Who is in position ${position + 1}?`,
    [answer, ...order.filter((n) => n !== answer)], `The unique order is ${order.join(' → ')}. Position ${position + 1} belongs to ${answer}.`,
    { premises: [`${order[0]} is before ${order[1]}.`, `${order[1]} is before ${order[2]}.`, `${order[2]} is before ${order[3]}.`], proof: { type: 'ordering', names: order, before: order.slice(0, 3).map((n, i) => [n, order[i + 1]]), position } }));
  const known = v % 2 ? 'not-q' : 'p', label = `device ${v + 1}`;
  logic.push(question(`foundation.conditional.${v}`, 'logic', known === 'p' ? 'modus_ponens' : 'modus_tollens', 1 + v % 3,
    `For ${label}, let P mean “the test passed” and Q mean “the green light is on”. Which statement must follow?`,
    known === 'p' ? ['Q is true.', 'Q is false.', 'P is false.', 'Nothing follows.'] : ['P is false.', 'P is true.', 'Q is true.', 'Nothing follows.'],
    known === 'p' ? 'If P then Q, and P is true. Therefore Q is true (modus ponens).' : 'If P then Q, but Q is false. Therefore P is false (modus tollens).',
    { premises: ['If P is true, Q is true.', known === 'p' ? 'P is true.' : 'Q is false.'], proof: { type: 'conditional', known } }));
  const total = 8 + v, offset = 2 + v % 5, target = offset + 1 + v % total, correct = target - offset;
  logic.push(question(`foundation.count.${v}`, 'logic', 'finite_constraints', 1 + v % 4,
    `How many of the ${total} sealed boxes are red?`, [correct, target, Math.max(0, correct - 1), correct + 1],
    `Let R be the red-box count. R + ${offset} = ${target}, so R = ${correct}. This is the only integer satisfying the equation.`,
    { premises: [`Each box is either red or blue.`, `The number of red boxes plus ${offset} is ${target}.`], proof: { type: 'truth-count', total, offset, target } }));
}
// Fictional scenarios: interpret the given passage rather than outside facts.
const scenarios = [
  ['Library pilot', 'A library stayed open two hours later on Fridays for eight weeks. Friday visits increased during the pilot. The pilot coincided with school holidays, and no comparison branch was tracked.', 'Friday visits increased during the pilot.', 'School holidays could also have influenced visits.', 'Track a comparison branch before attributing the increase to later hours.'],
  ['Garden records', 'A gardener recorded that the shaded bed needed less watering than the sunny bed. The beds also contained different soil. The record describes one summer and does not isolate the cause of the difference.', 'The shaded bed needed less watering.', 'Different soil could also explain the watering difference.', 'Compare similar soil before isolating the effect of shade.'],
  ['Bus survey', 'A transit survey asked riders on one morning route about punctuality. Most respondents were satisfied. Evening riders and people who stopped using the route were not surveyed.', 'Most surveyed morning riders were satisfied.', 'The sample does not represent all route users.', 'Include evening riders and former riders in a broader survey.'],
  ['Bakery batches', 'A bakery sold every loaf from a small test batch by noon. The test batch was half the usual size. The owner recorded units baked and units sold rather than customer requests after the stock ran out.', 'The small test batch sold out by noon.', 'Selling out does not reveal how much unmet demand remained.', 'Record requests after the stock runs out when estimating demand.'],
  ['Repair workshop', 'A repair group shortened its booking form. Completed bookings rose the next month, when the group also advertised in a local newsletter. The group did not separate visitors arriving from the newsletter.', 'Completed bookings rose after both changes.', 'The newsletter could also have increased bookings.', 'Track how visitors arrive before assigning the increase to the shorter form.'],
  ['Trail counter', 'A trail counter logged more entries on a festival weekend than on the previous weekend. The counter records entries, so one visitor entering twice is counted twice. It does not identify individuals.', 'The counter recorded more entries during the festival weekend.', 'Entries are not necessarily distinct visitors.', 'Use a method that distinguishes visitors when estimating the number of people.'],
  ['Classroom practice', 'One class chose to use optional practice sheets and later scored higher than another class. The first class also had higher scores before the sheets were offered. Students were not randomly assigned.', 'The class using the sheets had higher scores beforehand.', 'The classes differed before the practice sheets were introduced.', 'Compare changes from the initial scores rather than only the final scores.'],
  ['Market stall', 'A vendor offered reusable bags on Saturday. Bag uptake was higher than on Friday, when a different set of customers visited. No customer was observed on both days.', 'Bag uptake was higher on Saturday.', 'Different customer groups could explain the difference.', 'Compare similar customer groups before attributing the change to the offer.'],
  ['Museum labels', 'A museum replaced long labels with shorter ones in one gallery. Visitors spent less time reading each label but reported clearer wording. The study did not measure what visitors remembered afterward.', 'Visitors reported clearer wording on the shorter labels.', 'The study did not establish an effect on later memory.', 'Measure later recall before claiming that shorter labels improve retention.'],
  ['Water monitor', 'A building monitor reported lower water use after a leak was fixed. During the same week, half of the offices were closed. The monitor measures only the building total.', 'The building total fell after the repair and office closures.', 'Office closures could also have reduced water use.', 'Account for occupied offices when estimating water saved by the repair.'],
  ['Book club', 'A club invited members to vote online for the next book. Only one third voted. A clear majority of the votes favoured a mystery, but the preferences of nonvoters were not recorded.', 'Most recorded votes favoured a mystery.', 'The votes do not establish what most members preferred.', 'Ask nonvoters before claiming that the whole membership prefers mysteries.'],
  ['Delivery estimate', 'A shop calculated its delivery estimate using packages that arrived within seven days. Packages still in transit after seven days were left out of the calculation. The estimate therefore describes only the included packages.', 'Packages still in transit after seven days were excluded.', 'Excluding slower packages can bias the estimate toward shorter delivery times.', 'Include unresolved packages appropriately when estimating delivery performance.']
];
const comprehension = scenarios.flatMap(([title, passage, direct, limit, practical], v) => [
  ['direct_inference', 'Which statement is directly supported?', direct, ['The passage says every participant agreed.', 'The passage proves the same outcome always occurs.', 'No observation was recorded.']],
  ['scope_limit', 'Which limitation matters when interpreting this passage?', limit, ['All observations must be false.', 'A larger number automatically removes every bias.', 'The passage proves there can be only one cause.']],
  ['practical_implication', 'Which next step addresses a limitation described in the passage?', practical, ['Ignore the excluded evidence.', 'Treat one observed difference as a universal law.', 'Report a guaranteed outcome for every future case.']]
].map(([skill, prompt, answer, foils], i) => question(`foundation.reading.${v}.${i}`, 'comprehension', skill, 1 + v % 4,
  prompt, [answer, ...foils], `${answer} Evidence: ${passage}`, { title, passage, evidence: passage })));
export const FOUNDATION_QUESTIONS = [...math, ...logic, ...comprehension];
const themes = [
  ['Kitchen', 'ladle sieve whisk grater kettle', 'fork spoon bowl plate cup'], ['Garden', 'trowel rake hose seed mulch', 'spade pot weed leaf fence'],
  ['Studio', 'easel pigment brush canvas palette', 'ink pen ruler paper chalk'], ['Workshop', 'clamp plane chisel mallet vise', 'drill saw nail screw file'],
  ['Travel', 'ticket passport map suitcase hostel', 'taxi train bus plane boat'], ['Forest', 'fern moss pine birch acorn', 'oak maple cedar lichen ivy'],
  ['Seaside', 'shell dune tide reef pebble', 'sand wave cliff kelp bay'], ['Bakery', 'dough yeast oven loaf crust', 'flour butter sugar tray roll'],
  ['Sewing', 'needle thread thimble bobbin seam', 'button zipper fabric hem pin'], ['Camping', 'tent lantern flask rope compass', 'torch tarp blanket stove boots'],
  ['Stationery', 'stapler binder envelope folder eraser', 'pencil marker notebook clip stamp'], ['Weather', 'drizzle frost hail breeze mist', 'snow rain thunder cloud gust'],
  ['Music room', 'violin flute cello oboe harp', 'piano drum trumpet horn cymbal'], ['Sports', 'racket puck net helmet jersey', 'ball bat goal glove whistle'],
  ['Fruit stall', 'mango plum fig kiwi peach', 'apple pear grape lime melon'], ['Vegetables', 'carrot leek squash radish turnip', 'onion kale pepper bean potato'],
  ['Shapes', 'oval rhombus hexagon prism sphere', 'circle square triangle cube cone'], ['Colours', 'amber coral indigo ochre teal', 'red blue green pink violet'],
  ['Textiles', 'linen satin felt denim velvet', 'cotton silk wool tweed fleece'], ['River', 'brook delta rapid ford bank', 'creek stream lake spring canal'],
  ['Library', 'atlas index shelf bookmark catalogue', 'novel volume chapter page cover'], ['Observatory', 'lens tripod mirror shutter filter', 'dome mount cable screen chart'],
  ['Transport', 'tram ferry bicycle scooter subway', 'car coach cart truck van'], ['Birds', 'robin finch heron wren swallow', 'sparrow eagle hawk gull duck'],
  ['Furniture', 'stool dresser bench cabinet ottoman', 'chair desk sofa table bed'], ['Mountain', 'ridge summit scree crag glacier', 'peak valley slope pass cliff']
];
export const FOUNDATION_MEMORY = themes.map(([theme, targets, foils], i) => ({ id: `foundation.memory.${i}`, title: `${theme} word set`, theme,
  difficultyTier: 1 + i % 4, targetItems: targets.split(' ').map((word, n) => ({ id: `fm${i}.${n}`, word, icon: '•', category: theme, cue: `${theme} item ${n + 1}` })),
  distractorFoils: foils.split(' ').map((word) => ({ word, icon: '•', category: theme })), metadata: { version: 1 } }));

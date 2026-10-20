// Small finite, independently executable models. Never evaluate imported JavaScript.
export function permutations(values) {
  if (!values.length) return [[]];
  return values.flatMap((v, i) => permutations(values.filter((_, j) => i !== j)).map((tail) => [v, ...tail]));
}
export function solveProof(proof) {
  if (!proof || typeof proof !== 'object') throw new Error('Missing proof model.');
  if (proof.type === 'inventory') return proof.start - proof.given + proof.added;
  if (proof.type === 'rate') return proof.rate * proof.hours + proof.extra;
  if (proof.type === 'discount') return proof.price * (100 - proof.percent) / 100 - proof.coupon;
  if (proof.type === 'ordering') {
    const solutions = permutations(proof.names).filter((order) => proof.before.every(([a, b]) => order.indexOf(a) < order.indexOf(b)));
    const answers = new Set(solutions.map((order) => order[proof.position]));
    if (answers.size !== 1) throw new Error('Ordering does not have a unique answer.'); return [...answers][0];
  }
  if (proof.type === 'conditional') {
    const assignments = [false, true].flatMap((p) => [false, true].map((q) => ({ p, q })))
      .filter(({ p, q }) => (!p || q) && (proof.known === 'p' ? p : !q));
    const answers = new Set(assignments.map((a) => proof.known === 'p' ? a.q ? 'Q is true.' : 'Q is false.' : a.p ? 'P is true.' : 'P is false.'));
    if (answers.size !== 1) throw new Error('Conditional is ambiguous.'); return [...answers][0];
  }
  if (proof.type === 'truth-count') {
    const candidates = Array.from({ length: proof.total + 1 }, (_, i) => i).filter((n) => n + proof.offset === proof.target);
    if (candidates.length !== 1) throw new Error('No unique finite answer.'); return candidates[0];
  }
  if (proof.type === 'knights') {
    const evaluate = (expression, values) => {
      if (expression[0] === 'var' && ['x', 'y'].includes(expression[1])) return values[expression[1]];
      if (expression[0] === 'not') return !evaluate(expression[1], values);
      if (expression[0] === 'or') return evaluate(expression[1], values) || evaluate(expression[2], values);
      if (expression[0] === 'iff') return evaluate(expression[1], values) === evaluate(expression[2], values);
      throw new Error('Unsupported logical expression.');
    };
    const assignments = [false, true].flatMap((x) => [false, true].map((y) => ({ x, y })))
      .filter((v) => proof.claims.every((claim, i) => !claim || evaluate(claim, v) === v[i === 0 ? 'x' : 'y']));
    if (assignments.length !== 1) throw new Error('No unique consistent truth-teller assignment.');
    const v = assignments[0]; return `${proof.labels[0]} is a ${v.x ? 'Knight' : 'Knave'}, and ${proof.labels[1]} is a ${v.y ? 'Knight' : 'Knave'}.`;
  }
  throw new Error('Unsupported proof model.');
}
export function verifyProof(item) {
  try {
    if (!item.proof) return false;
    const answer = String(solveProof(item.proof));
    return item.options.find((o) => o.id === item.correctOptionId)?.text === answer;
  } catch { return false; }
}

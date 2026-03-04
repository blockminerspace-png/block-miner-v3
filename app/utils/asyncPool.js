async function runWithConcurrency(items, concurrency, worker) {
  const input = Array.isArray(items) ? items : [];
  const maxConcurrency = Math.max(1, Number(concurrency) || 1);
  const results = [];

  let cursor = 0;

  async function runner() {
    while (cursor < input.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(input[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrency, input.length) }, () => runner());
  await Promise.all(workers);

  return results;
}

module.exports = {
  runWithConcurrency
};

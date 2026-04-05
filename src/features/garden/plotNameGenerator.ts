import { verbs } from '../../data/words/verbs';
import { woods } from '../../data/words/woods';

/**
 * Generates a unique two-word CamelCase plot label prefix (e.g. "RunningMaple").
 * Checks `existingLabels` to avoid duplicates — any existing label starting with the
 * candidate prefix followed by a space or end-of-string is considered taken.
 *
 * @param existingLabels - Current plot labels (e.g. ["Plot 1", "RunningMaple 2"])
 * @returns A CamelCase prefix string that doesn't clash with any existing labels
 */
export function generatePlotPrefix(existingLabels: string[]): string {
  const taken = new Set(
    existingLabels.map((l) => {
      // Extract the prefix portion: everything before the trailing " <digits>"
      const match = l.match(/^(.*?)(\s+\d+)?$/);
      return match ? match[1].toLowerCase() : l.toLowerCase();
    }),
  );

  const maxAttempts = verbs.length * woods.length;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const verb = verbs[Math.floor(Math.random() * verbs.length)];
    const wood = woods[Math.floor(Math.random() * woods.length)];
    const prefix = capitalize(verb) + capitalize(wood);
    if (!taken.has(prefix.toLowerCase())) {
      return prefix;
    }
    attempts++;
  }

  // Exhaustion fallback — practically unreachable with 50×50 = 2500 combos
  return `Plot${Date.now()}`;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

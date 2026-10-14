/**
 * Normalizes text for comparison by lowercasing, stripping punctuation, and collapsing whitespace.
 *
 * @param {string} text
 * @returns {string}
 */
export const normalizeText = text => {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'’“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Splits text into an array of words while preserving word boundaries.
 *
 * @param {string} text
 * @returns {Array<string>}
 */
export const getWords = text => {
  if (!text) return [];
  return String(text)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
};

/**
 * Common low-information short stop words that should not be used as a 1-word boundary overlap match.
 */
const COMMON_SHORT_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'the',
  'in',
  'on',
  'at',
  'to',
  'of',
  'for',
  'or',
  'is',
  'it',
]);

/**
 * Determines whether a single word is substantial enough to indicate genuine boundary overlap.
 *
 * @param {string} word
 * @returns {boolean}
 */
const isSubstantialWord = word => {
  if (!word) return false;
  const clean = word.toLowerCase();
  return clean.length >= 4 && !COMMON_SHORT_STOP_WORDS.has(clean);
};

/**
 * Deduplicates and stitches consecutive transcript segments from the same speaker across chunk boundaries.
 *
 * Handles:
 * 1. Exact or near-exact duplicates (e.g. retransmissions, duplicate client streams).
 * 2. Full-containment duplicates (e.g. when an earlier slice already contained the text).
 * 3. Suffix-prefix word overlap caused by ASR re-transcribing audio at chunk boundaries.
 *
 * Preserves:
 * 1. Legitimate repeated speech within utterances (e.g. "no, no, no" or "I think, I think...").
 * 2. Original spoken wording, casing, and punctuation.
 *
 * @param {object} params
 * @param {object|null} params.lastSegment - The most recent finalized segment for this room/speaker
 * @param {string} params.text - The newly transcribed text
 * @param {string} params.speakerIdentity - Identity of current speaker
 * @param {number} [params.startTimeMs] - Segment start time in ms
 * @param {number} [params.timeDeltaMs] - Optional elapsed time since last segment
 * @returns {{ text: string, isDuplicate: boolean, trimmedWordsCount: number }}
 */
export const stitchAndDeduplicate = ({
  lastSegment = null,
  text = '',
  speakerIdentity = '',
  startTimeMs = 0,
  timeDeltaMs = null,
}) => {
  const cleanText = String(text || '').trim();
  if (!cleanText) {
    return { text: '', isDuplicate: true, trimmedWordsCount: 0 };
  }

  // If there's no previous segment or it's from a different speaker, no boundary overlap to stitch
  if (!lastSegment || !lastSegment.text) {
    return { text: cleanText, isDuplicate: false, trimmedWordsCount: 0 };
  }

  // If different speakers, do not deduplicate across them
  if (lastSegment.speakerIdentity && lastSegment.speakerIdentity !== speakerIdentity) {
    return { text: cleanText, isDuplicate: false, trimmedWordsCount: 0 };
  }

  const prevCleanText = String(lastSegment.text).trim();
  const normPrev = normalizeText(prevCleanText);
  const normNew = normalizeText(cleanText);

  if (!normNew) {
    return { text: '', isDuplicate: true, trimmedWordsCount: 0 };
  }

  // 1. Exact normalized match (reconnection, duplicate chunk, or retry)
  if (normPrev === normNew) {
    return { text: '', isDuplicate: true, trimmedWordsCount: 0 };
  }

  // 2. Full containment check: if the previous segment already contains this entire text
  if (normPrev.length >= normNew.length && normPrev.includes(normNew)) {
    return { text: '', isDuplicate: true, trimmedWordsCount: 0 };
  }

  // Check if consecutive chunks are within a reasonable time window (<= 15 seconds)
  const isConsecutiveChunk =
    timeDeltaMs !== null
      ? timeDeltaMs <= 15000
      : lastSegment.endTimeMs !== undefined && startTimeMs > 0
        ? Math.abs(startTimeMs - lastSegment.endTimeMs) <= 15000
        : true;

  // 3. Reverse containment: if new text starts with the entirety of previous text within consecutive window
  // (e.g. an interim result that was finalized with more words)
  if (isConsecutiveChunk && normNew.length > normPrev.length && normNew.startsWith(normPrev)) {
    const rawPrevWords = getWords(prevCleanText);
    const rawNewWords = getWords(cleanText);
    const remainingRawWords = rawNewWords.slice(rawPrevWords.length);
    if (remainingRawWords.length === 0) {
      return { text: '', isDuplicate: true, trimmedWordsCount: rawPrevWords.length };
    }
    const stitched = capitalizeFirst(remainingRawWords.join(' '));
    return { text: stitched, isDuplicate: false, trimmedWordsCount: rawPrevWords.length };
  }

  // 4. Suffix-prefix word overlap check across consecutive chunk boundary

  if (isConsecutiveChunk) {
    const prevWords = getWords(normPrev);
    const newWords = getWords(normNew);
    const rawNewWords = getWords(cleanText);

    const maxCheck = Math.min(prevWords.length, newWords.length, 12);
    let overlapCount = 0;

    for (let k = maxCheck; k >= 1; k--) {
      const prevSuffix = prevWords.slice(-k).join(' ');
      const newPrefix = newWords.slice(0, k).join(' ');

      if (prevSuffix === newPrefix) {
        // If single word overlap, ensure it is a substantial word to prevent trimming false positives on "the", "and"
        if (k === 1 && !isSubstantialWord(prevWords[prevWords.length - 1])) {
          continue;
        }
        overlapCount = k;
        break;
      }
    }

    if (overlapCount > 0) {
      const remainingRawWords = rawNewWords.slice(overlapCount);
      if (remainingRawWords.length === 0) {
        return { text: '', isDuplicate: true, trimmedWordsCount: overlapCount };
      }

      const stitched = capitalizeFirst(remainingRawWords.join(' '));
      return { text: stitched, isDuplicate: false, trimmedWordsCount: overlapCount };
    }
  }

  return { text: cleanText, isDuplicate: false, trimmedWordsCount: 0 };
};

/**
 * Capitalizes the first non-whitespace character of a string while preserving the rest.
 *
 * @param {string} str
 * @returns {string}
 */
const capitalizeFirst = str => {
  if (!str) return '';
  const trimmed = str.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

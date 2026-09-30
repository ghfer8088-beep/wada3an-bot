/**
 * Arabic NLP Normalization & Dialect Processing Engine
 * Designed for Medical & Commercial Clinic Messenger Conversations
 */

class ArabicNLP {
  /**
   * Comprehensive text normalization for robust search & intent classification
   */
  static normalize(text) {
    if (!text || typeof text !== 'string') return '';

    let normalized = text;

    // 1. Lowercase English and convert numbers
    normalized = normalized.toLowerCase();

    // 2. Remove Arabic Tashkeel (diacritics: Fatha, Damma, Kasra, Sukun, Tanween, Shadda)
    normalized = normalized.replace(/[\u064B-\u0652\u0670\u0640]/g, '');

    // 3. Unify Alef variants (أ, إ, آ, ٱ, ٵ, ٲ) -> ا
    normalized = normalized.replace(/[أإآٱٵٲ]/g, 'ا');

    // 4. Unify Yaa variants (ى -> ي, ئ -> ي)
    normalized = normalized.replace(/[ىئ]/g, 'ي');

    // 5. Unify Taa Marbuta & Haa (ة -> ه)
    normalized = normalized.replace(/ة/g, 'ه');

    // 6. Unify Waw with Hamza (ؤ -> و)
    normalized = normalized.replace(/ؤ/g, 'و');

    // 7. Collapse character repetitions (e.g., "سسسسعر" -> "سعر", "ببببدي" -> "بدي")
    normalized = normalized.replace(/(.)\1{2,}/g, '$1$1');

    // 8. Normalize whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * Check if text contains any of the search terms (with normalization)
   */
  static containsAny(rawText, terms) {
    const normText = this.normalize(rawText);
    for (const term of terms) {
      const normTerm = this.normalize(term);
      if (normText.includes(normTerm)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find all matching patterns from dictionary
   */
  static matchPatterns(rawText, patternMap) {
    const normText = this.normalize(rawText);
    const matches = [];

    for (const [key, patterns] of Object.entries(patternMap)) {
      for (const pattern of patterns) {
        const normPattern = this.normalize(pattern);
        if (normText.includes(normPattern)) {
          matches.push({ key, pattern, matched: normPattern });
          break; // Avoid duplicate matches for same key
        }
      }
    }
    return matches;
  }

  /**
   * Extract phone numbers (Jordanian local 07X, or international +962)
   */
  static extractPhoneNumber(text) {
    if (!text) return null;
    const clean = text.replace(/[\s\-\(\)]/g, '');
    const jordanianPattern = /(?:\+?962|0)?7[789]\d{7}/g;
    const matches = clean.match(jordanianPattern);
    return matches ? matches[0] : null;
  }
}

module.exports = ArabicNLP;

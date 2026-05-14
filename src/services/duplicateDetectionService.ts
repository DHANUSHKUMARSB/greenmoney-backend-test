import { Transaction } from '../services/database';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface DuplicateMatch {
  importedIndex: number;
  existingTx: any;
  confidence: ConfidenceLevel;
}

export const duplicateDetectionService = {
  normalizeDescription: (desc: string): string => {
    return desc
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  calculateSimilarity: (s1: string, s2: string): number => {
    const n1 = duplicateDetectionService.normalizeDescription(s1);
    const n2 = duplicateDetectionService.normalizeDescription(s2);
    
    if (n1 === n2) return 1.0;
    if (n1.includes(n2) || n2.includes(n1)) return 0.8;
    
    // Simple word overlap
    const w1 = new Set(n1.split(' '));
    const w2 = new Set(n2.split(' '));
    const intersection = new Set([...w1].filter(x => w2.has(x)));
    return (2.0 * intersection.size) / (w1.size + w2.size);
  },

  detectDuplicates: (imported: any[], existing: any[]): DuplicateMatch[] => {
    const matches: DuplicateMatch[] = [];

    imported.forEach((item, idx) => {
      // Find possible matches in existing data
      for (const ex of existing) {
        const isSameDate = ex.date.slice(0, 10) === item.date.slice(0, 10);
        const isSameAmount = Math.abs(ex.amount - item.amount) < 0.01;
        const isSameType = ex.type === item.type;

        if (isSameDate && isSameAmount && isSameType) {
          const similarity = duplicateDetectionService.calculateSimilarity(ex.note || '', item.description);
          const isSameCategory = ex.category_name?.toLowerCase() === item.category.toLowerCase();

          let confidence: ConfidenceLevel = 'LOW';
          if (isSameCategory && similarity > 0.8) confidence = 'HIGH';
          else if (similarity > 0.5) confidence = 'MEDIUM';
          
          matches.push({
            importedIndex: idx,
            existingTx: ex,
            confidence
          });
          break; // Found one match, move to next imported item
        }
      }
    });

    return matches;
  }
};

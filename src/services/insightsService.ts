export const detectSpendingPatterns = (transactions: any[], formatAmount: (val: number) => string) => {
  if (!transactions || transactions.length === 0) return [];
  
  const categories: Record<string, number> = {};
  const previousMonthCategories: Record<string, number> = {};

  const today = new Date();
  const currentMonthStr = today.toISOString().slice(0, 7);
  
  const lastMonth = new Date();
  lastMonth.setMonth(today.getMonth() - 1);
  const lastMonthStr = lastMonth.toISOString().slice(0, 7);

  transactions.forEach(tx => {
    if (tx.type === 'expense') {
      const month = tx.date.slice(0, 7);
      const category = tx.category_name || 'Uncategorized';
      
      if (month === currentMonthStr) {
        categories[category] = (categories[category] || 0) + tx.amount;
      } else if (month === lastMonthStr) {
        previousMonthCategories[category] = (previousMonthCategories[category] || 0) + tx.amount;
      }
    }
  });

  const patterns = [];
  for (const [cat, currentAmount] of Object.entries(categories)) {
    const prevAmount = previousMonthCategories[cat] || 0;
    if (prevAmount > 0) {
      const percentageIncrease = ((currentAmount - prevAmount) / prevAmount) * 100;
      if (percentageIncrease > 20) {
        patterns.push(`You spent ${percentageIncrease.toFixed(0)}% more on ${cat} this month compared to last month.`);
      }
    }
  }
  return patterns;
};

export const generateSavingsSuggestions = (transactions: any[], formatAmount: (val: number) => string) => {
  const suggestions = [];
  
  // Rule based: find highest expense category
  const categories: Record<string, number> = {};
  transactions.forEach(tx => {
    if (tx.type === 'expense') {
      const cat = tx.category_name || 'Uncategorized';
      categories[cat] = (categories[cat] || 0) + tx.amount;
    }
  });

  const sortedCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  if (sortedCategories.length > 0) {
    const highestCat = sortedCategories[0];
    const reduceTarget = highestCat[1] * 0.15; // suggest 15% reduction
    suggestions.push(`Reduce ${highestCat[0]} expenses by 15% to save ${formatAmount(reduceTarget)}/month.`);
  }

  return suggestions;
};

export const detectAnomalies = (transactions: any[], formatAmount: (val: number) => string) => {
  const anomalies = [];
  
  const amounts = transactions.filter(t => t.type === 'expense').map(t => t.amount);
  if (amounts.length === 0) return [];
  
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  // Variance
  const variance = amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);

  // Consider an anomaly if it's strictly > mean + 2 stdDev
  transactions.filter(t => t.type === 'expense').forEach(tx => {
    if (tx.amount > mean + 2 * stdDev && tx.amount > 50) { // filter out very small noise anomalies
      anomalies.push(`Anomaly: Unusually high expense of ${formatAmount(tx.amount)} on ${tx.category_name || 'Unknown'} (${new Date(tx.date).toLocaleDateString()}).`);
    }
  });
  
  return anomalies;
};

export const generateAllInsights = (transactions: any[], formatAmount: (val: number) => string) => {
  return {
    patterns: detectSpendingPatterns(transactions, formatAmount),
    suggestions: generateSavingsSuggestions(transactions, formatAmount),
    anomalies: detectAnomalies(transactions, formatAmount)
  };
};

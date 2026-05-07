export const getTotalBalance = (transactions: any[], accounts: any[] = []) => {
  const accountsTotal = accounts.reduce((acc, account) => acc + account.balance, 0);
  const totalIncome = getTotalIncome(transactions);
  const totalExpense = getTotalExpense(transactions);
  return accountsTotal + totalIncome - totalExpense;
};

export const getTotalIncome = (transactions: any[]) => {
  return transactions
    .filter(tx => tx.type === 'income')
    .reduce((acc, tx) => acc + tx.amount, 0);
};

export const getTotalExpense = (transactions: any[]) => {
  return transactions
    .filter(tx => tx.type === 'expense')
    .reduce((acc, tx) => acc + tx.amount, 0);
};

const COLORS = [
  '#4CAF50', '#2196F3', '#FFC107', '#E91E63', '#9C27B0', 
  '#00BCD4', '#FF5722', '#795548', '#607D8B', '#8BC34A'
];

export const getCategoryBreakdown = (transactions: any[], type: 'income' | 'expense' = 'expense') => {
  if (!transactions || transactions.length === 0) return [];
  
  const breakdown: Record<string, number> = {};
  transactions
    .filter(tx => tx.type === type)
    .forEach(tx => {
      const category = tx.category_name || 'Uncategorized';
      breakdown[category] = (breakdown[category] || 0) + tx.amount;
    });
    
  return Object.keys(breakdown).map((name, index) => ({
    name,
    amount: breakdown[name],
    color: COLORS[index % COLORS.length],
    legendFontColor: '#7F7F7F',
    legendFontSize: 12
  })).sort((a, b) => b.amount - a.amount);
};

export const getMonthlySummary = (transactions: any[]) => {
  if (!transactions || transactions.length === 0) {
    return { labels: ['No Data'], datasets: [{ data: [0] }] };
  }

  // Group by last 6 months
  const monthlyData: Record<string, number> = {};
  const today = new Date();
  
  // Initialize last 6 months
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthKey = d.toLocaleString('default', { month: 'short' });
    monthlyData[monthKey] = 0;
  }

  transactions.forEach(tx => {
    if (tx.type === 'expense') {
      const txDate = new Date(tx.date);
      // Only include if within the last 6 months
      const diffMonths = (today.getFullYear() - txDate.getFullYear()) * 12 + today.getMonth() - txDate.getMonth();
      if (diffMonths >= 0 && diffMonths <= 5) {
        const monthKey = txDate.toLocaleString('default', { month: 'short' });
        if (monthlyData[monthKey] !== undefined) {
          monthlyData[monthKey] += tx.amount;
        }
      }
    }
  });

  const labels = Object.keys(monthlyData);
  const data = Object.values(monthlyData);

  // Fallback if somehow empty
  if (labels.length === 0) return { labels: ['No Data'], datasets: [{ data: [0] }] };

  return {
    labels,
    datasets: [
      {
        data,
      }
    ]
  };
};

export const getWeeklyComparison = (transactions: any[]) => {
  if (!transactions) return { message: 'Add transactions to see insights' };

  const now = new Date();
  
  // Start of current week (Sunday or Monday, let's use a rolling 7 days for simplicity and accuracy)
  // Current week = Last 7 days, Previous week = 7-14 days ago
  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(now.getDate() - 7);
  
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);

  let currentSpent = 0;
  let previousSpent = 0;

  transactions.forEach(tx => {
    if (tx.type === 'expense') {
      const txDate = new Date(tx.date);
      if (txDate > currentWeekStart) {
        currentSpent += tx.amount;
      } else if (txDate > previousWeekStart && txDate <= currentWeekStart) {
        previousSpent += tx.amount;
      }
    }
  });

  const difference = currentSpent - previousSpent;
  let percentage = 0;
  if (previousSpent > 0) {
    percentage = (difference / previousSpent) * 100;
  } else if (currentSpent > 0) {
    percentage = 100;
  }

  let message = '';
  if (percentage > 0) {
    message = `You spent ${percentage.toFixed(0)}% more this week`;
  } else if (percentage < 0) {
    message = `You spent ${Math.abs(percentage).toFixed(0)}% less this week`;
  } else {
    message = `Your spending is the same as last week`;
  }

  return { currentSpent, previousSpent, percentage, message };
};

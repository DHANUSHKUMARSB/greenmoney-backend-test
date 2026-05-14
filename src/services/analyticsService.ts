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

export const getTrendData = (transactions: any[], type: 'income' | 'expense' | 'balance' = 'expense', range: '7D' | '1M' | '3M' | '6M' | '1Y' = '6M') => {
  if (!transactions || transactions.length === 0) {
    return { labels: [''], datasets: [{ data: [0] }] };
  }

  const today = new Date();
  const labels: string[] = [];
  const data: number[] = [];
  const monthlyData: Record<string, number> = {};

  let iterations = 6;
  let interval: 'day' | 'month' = 'month';

  if (range === '7D') { iterations = 7; interval = 'day'; }
  else if (range === '1M') { iterations = 30; interval = 'day'; }
  else if (range === '3M') { iterations = 3; interval = 'month'; }
  else if (range === '6M') { iterations = 6; interval = 'month'; }
  else if (range === '1Y') { iterations = 12; interval = 'month'; }

  // Initialize data points
  for (let i = iterations - 1; i >= 0; i--) {
    let key = '';
    if (interval === 'day') {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      key = d.toLocaleDateString('default', { day: 'numeric', month: 'short' });
    } else {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      key = d.toLocaleString('default', { month: 'short' });
    }
    monthlyData[key] = 0;
    labels.push(key);
  }

  // Aggregate transactions
  transactions.forEach(tx => {
    if (!tx.date) return;
    const txDate = new Date(tx.date);
    if (isNaN(txDate.getTime())) return;

    let key = '';
    if (interval === 'day') {
      const diffDays = Math.floor((today.getTime() - txDate.getTime()) / (1000 * 3600 * 24));
      if (diffDays >= 0 && diffDays < iterations) {
        key = txDate.toLocaleDateString('default', { day: 'numeric', month: 'short' });
      }
    } else {
      const diffMonths = (today.getFullYear() - txDate.getFullYear()) * 12 + today.getMonth() - txDate.getMonth();
      if (diffMonths >= 0 && diffMonths < iterations) {
        key = txDate.toLocaleString('default', { month: 'short' });
      }
    }

    if (key && monthlyData[key] !== undefined) {
      if (type === 'balance') {
        monthlyData[key] += (tx.type === 'income' ? tx.amount : -tx.amount);
      } else if (tx.type === type) {
        monthlyData[key] += tx.amount;
      }
    }
  });

  // For balance, we need to make it cumulative if it's a trend
  if (type === 'balance') {
    let cumulative = 0;
    labels.forEach(label => {
      cumulative += monthlyData[label];
      data.push(cumulative);
    });
  } else {
    labels.forEach(label => data.push(monthlyData[label]));
  }

  // Filter labels to prevent crowding
  const filteredLabels = labels.map((l, i) => {
    if (range === '1M' && i % 5 !== 0) return '';
    if (range === '7D' && i % 2 !== 0) return '';
    return l;
  });

  return {
    labels: filteredLabels,
    datasets: [{ data }]
  };
};

export const getCategoryBreakdown = (transactions: any[], type: 'income' | 'expense' = 'expense') => {
  if (!transactions || transactions.length === 0) return [];
  
  const breakdown: Record<string, number> = {};
  const filtered = transactions.filter(tx => tx.type === type);
  const total = filtered.reduce((acc, tx) => acc + tx.amount, 0);

  filtered.forEach(tx => {
    const category = tx.category_name || 'Uncategorized';
    breakdown[category] = (breakdown[category] || 0) + tx.amount;
  });
    
  return Object.keys(breakdown).map((name, index) => ({
    name,
    amount: breakdown[name],
    percentage: total > 0 ? (breakdown[name] / total) * 100 : 0,
    color: COLORS[index % COLORS.length],
  })).sort((a, b) => b.amount - a.amount);
};

export const getMonthlySummary = (transactions: any[]) => getTrendData(transactions, 'expense', '6M');

export const getWeeklyComparison = (transactions: any[]) => {
  if (!transactions || transactions.length === 0) return { message: 'Start tracking to see trends' };

  const now = new Date();
  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(now.getDate() - 7);
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);

  let currentSpent = 0;
  let previousSpent = 0;

  transactions.forEach(tx => {
    if (tx.type === 'expense') {
      const txDate = new Date(tx.date);
      if (txDate > currentWeekStart) currentSpent += tx.amount;
      else if (txDate > previousWeekStart && txDate <= currentWeekStart) previousSpent += tx.amount;
    }
  });

  const diff = currentSpent - previousSpent;
  const percentage = previousSpent > 0 ? (diff / previousSpent) * 100 : 0;
  
  let message = 'Spending stable this week';
  if (percentage > 5) message = `Spending increased by ${percentage.toFixed(0)}%`;
  else if (percentage < -5) message = `Great! Spending down ${Math.abs(percentage).toFixed(0)}%`;
  else if (currentSpent > 0 && previousSpent === 0) message = 'New spending activity detected';

  return { currentSpent, previousSpent, percentage, message };
};

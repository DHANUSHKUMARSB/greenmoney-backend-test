import { 
  getRecurringTransactions, 
  insertTransaction, 
  updateRecurringNextDate, 
  TransactionInput 
} from './database';

/**
 * Checks for all recurring transaction templates and generates 
 * new transactions if their 'next_date' has passed.
 */
export const processRecurringTransactions = async () => {
  try {
    const templates = await getRecurringTransactions();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const template of templates) {
      let nextDate = new Date(template.next_date);
      nextDate.setHours(0, 0, 0, 0);

      // Keep generating transactions until the next_date is in the future
      while (nextDate <= today) {
        console.log(`Generating recurring transaction for ${template.note} on ${nextDate.toISOString()}`);
        
        const tx: TransactionInput = {
          amount: template.amount,
          type: template.type,
          categoryId: template.category_id,
          accountId: template.account_id,
          date: nextDate.toISOString(),
          note: template.note ? `${template.note} (Auto)` : 'Recurring Transaction',
        };

        await insertTransaction(tx);

        // Calculate next occurrence
        if (template.frequency === 'daily') {
          nextDate.setDate(nextDate.getDate() + 1);
        } else if (template.frequency === 'weekly') {
          nextDate.setDate(nextDate.getDate() + 7);
        } else if (template.frequency === 'monthly') {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }

        // Update the template in the database
        await updateRecurringNextDate(template.id, nextDate.toISOString());
      }
    }
  } catch (error) {
    console.error('Error processing recurring transactions:', error);
  }
};

import { 
  getRecurringTransactions, 
  insertTransaction, 
  updateRecurringNextDate, 
  TransactionInput,
  deleteTransaction
} from './database';
import { RecurringTransaction } from './localStorage';

/**
 * The core engine for processing all automated financial workflows.
 * It handles both standard repeating subscriptions and installment-based loans/EMI.
 */
export const processRecurringTransactions = async () => {
  console.log('[RECURRING-ENGINE]: Starting automated processing cycle...');
  try {
    // Check if user is logged in first
    const { useAuthStore } = require('../store/authStore');
    const user = useAuthStore.getState().user;
    if (!user) {
      console.log('[RECURRING-ENGINE]: No user logged in, skipping cycle.');
      return;
    }

    const templates = await getRecurringTransactions();
    const activeTemplates = templates.filter(t => t.status === 'active');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const template of activeTemplates) {
      let nextDate = new Date(template.next_date);
      nextDate.setHours(0, 0, 0, 0);
      
      let iterations = 0;
      const MAX_ITERATIONS = 500; // Safety cap to prevent freezes

      // Processing catch-up
      while (nextDate <= today && template.status === 'active' && iterations < MAX_ITERATIONS) {
        iterations++;
        console.log(`[RECURRING-ENGINE]: Generating occurrence ${iterations} for: ${template.note || 'Unnamed'}`);
        
        const tx: TransactionInput = {
          amount: template.amount,
          type: template.type,
          categoryId: template.category_id,
          accountId: template.account_id,
          date: nextDate.toISOString(),
          note: template.recurring_type === 'installment' 
            ? `${template.note || 'EMI'} (${(template.completed_installments || 0) + 1}/${template.total_installments})`
            : `${template.note || 'Recurring'} (Auto)`,
          recurring_id: template.id,
        };

        // 1. Generate the actual transaction
        await insertTransaction(tx);

        // 2. Calculate next occurrence based on frequency and interval
        const jump = template.interval || 1;
        const newNextDate = new Date(nextDate);
        
        if (template.frequency === 'daily') newNextDate.setDate(newNextDate.getDate() + jump);
        else if (template.frequency === 'weekly') newNextDate.setDate(newNextDate.getDate() + (7 * jump));
        else if (template.frequency === 'monthly') newNextDate.setMonth(newNextDate.getMonth() + jump);
        else if (template.frequency === 'yearly') newNextDate.setFullYear(newNextDate.getFullYear() + jump);

        // 3. Update the template status and progress
        await updateRecurringNextDate(template.id, newNextDate.toISOString(), true);
        
        // Advance local counter for the while loop
        nextDate = newNextDate;
        
        // Refresh template state in loop for installments limit check
        const updatedTemplates = await getRecurringTransactions();
        const currentTemplate = updatedTemplates.find(t => t.id === template.id);
        if (!currentTemplate || currentTemplate.status !== 'active') break;
      }
    }
    console.log('[RECURRING-ENGINE]: Cycle completed.');
  } catch (error) {
    console.error('[RECURRING-ENGINE]: CRITICAL ERROR:', error);
  }
};

/**
 * Handles the logic when a user deletes an occurrence that belongs to a recurring series.
 */
export const handleRecurringDelete = async (transactionId: string, mode: 'single' | 'future' | 'all') => {
  // TODO: Implement sophisticated series deletion
  // For now, standard single delete is handled by database.ts
  await deleteTransaction(transactionId);
};

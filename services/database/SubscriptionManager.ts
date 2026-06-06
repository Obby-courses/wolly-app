import { SubscriptionRepository, Subscription, Frequency } from './repositories/SubscriptionRepository';
import { TransactionRepository } from './repositories/TransactionRepository';
import { ParsedExpense, LocationType } from '../../modules/registration/types';
import uuid from 'react-native-uuid';

// ─── Date Helpers ────────────────────────────────────────────────────────────

/**
 * Returns the number of days in a given month.
 * month is 0-based (0 = January).
 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * For a monthly subscription with recurrence_day = X:
 * if the current month has fewer than X days, fire on the last day of the month.
 * This complies with Italian Law 172/2017 (real monthly billing cycles).
 */
function effectiveMonthlyDay(desiredDay: number, year: number, month: number): number {
  return Math.min(desiredDay, daysInMonth(year, month));
}

/**
 * Given a subscription, returns the cycle date (YYYY-MM-DD) that would fall
 * on or within the current cycle relative to `today`.
 * Returns null if today is not the cycle day.
 */
function getCycleDateForToday(sub: Subscription, today: Date): string | null {
  const todayISO = today.toISOString().split('T')[0];
  const todayDay = today.getDate();
  const todayDow = (today.getDay() + 6) % 7; // 0=Mon…6=Sun
  const startDate = new Date(sub.start_date);
  const recurrenceDay = sub.recurrence_day;

  switch (sub.frequency) {
    case 'monthly': {
      if (recurrenceDay == null) return null;
      // Clamp to last day of current month (e.g. day 31 → 30 in April)
      const effective = effectiveMonthlyDay(recurrenceDay, today.getFullYear(), today.getMonth());
      if (todayDay === effective) return todayISO;
      return null;
    }

    case 'yearly': {
      // Fire on the same day+month as startDate
      const startMonth = startDate.getMonth(); // 0-based
      const startDay = startDate.getDate();
      if (today.getMonth() !== startMonth) return null;
      // Clamp for Feb 29 → Feb 28 in non-leap years
      const effectiveDay = effectiveMonthlyDay(startDay, today.getFullYear(), startMonth);
      if (todayDay === effectiveDay) return todayISO;
      return null;
    }

    case 'weekly': {
      // Fire on the selected days-of-week (bitmask: 0=Mon…6=Sun)
      if (recurrenceDay == null) return null;
      if ((recurrenceDay & (1 << todayDow)) !== 0) {
        return todayISO;
      }
      return null;
    }

    case 'biweekly': {
      // Fire on the selected days-of-week, every 2 weeks
      if (recurrenceDay == null) return null;
      if ((recurrenceDay & (1 << todayDow)) === 0) return null;
      
      const getMonday = (d: Date) => {
        const date = new Date(d);
        const dow = (date.getDay() + 6) % 7;
        date.setDate(date.getDate() - dow);
        date.setHours(0,0,0,0);
        return date;
      };
      
      const startMonday = getMonday(startDate);
      const todayMonday = getMonday(today);
      const weeksSinceStart = Math.round((todayMonday.getTime() - startMonday.getTime()) / (7 * 86400000));
      
      if (weeksSinceStart >= 0 && weeksSinceStart % 2 === 0) {
        return todayISO;
      }
      return null;
    }

    default:
      return null;
  }
}

// ─── Main Job ────────────────────────────────────────────────────────────────

/**
 * Called on every app open (from app/index.tsx).
 * Idempotent: safe to call multiple times per day.
 */
export class SubscriptionManager {
  static async processDueSubscriptions(): Promise<void> {
    try {
      const today = new Date();
      const active = await SubscriptionRepository.getActive();

      for (const sub of active) {
        const cycleDate = getCycleDateForToday(sub, today);
        if (!cycleDate) continue; // not due today

        const alreadyExists = await SubscriptionRepository.hasTransactionForCycle(sub.id!, cycleDate);
        if (alreadyExists) continue; // idempotency guard

        // Create the transaction
        const newTx: ParsedExpense = {
          id: uuid.v4().toString(),
          created_at: new Date().toISOString(),
          amount: sub.amount,
          net_amount: sub.amount,
          currency: sub.currency || 'EUR',
          payment_method: null,
          direction: (sub.direction || 'out') as 'in' | 'out',
          category_key: sub.category_key,
          subcategory_key: sub.category_key,
          category_confidence: 1,
          date: cycleDate,
          time: null,
          time_of_day: null,
          is_weekend: false,
          day_of_week: '',
          social_context: null,
          people_mentioned: [],
          group_size: null,
          is_social: false,
          location_type: (sub.location_type || null) as LocationType,
          location_name: sub.location_name || null,
          city: sub.city || null,
          address: sub.address || null,
          is_travel: false,
          is_online: !sub.location_name, // online se non c'è un luogo specifico impostato
          is_recurring_pattern: true,
          reason: sub.description || null,
          description: sub.name,
          refund: null,
          split: null,
          input_method: 'manual',
          raw_input: `Auto-generated by SubscriptionManager: ${sub.name}`,
          is_deleted: false,
          synced_at: null,
          holiday: null,
          tags: sub.tags ? sub.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        };

        await TransactionRepository.insert(newTx, sub.id);

        console.log(`[SubscriptionManager] Created transaction for "${sub.name}" on ${cycleDate}`);
      }
    } catch (error) {
      console.error('[SubscriptionManager] Error processing subscriptions:', error);
    }
  }
}

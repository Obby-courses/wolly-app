import uuid from 'react-native-uuid';
import { ParsedExpense } from './types';

export function parseFromManual(amount: number, description: string): ParsedExpense {
  const now = new Date();
  const currentTimestamp = now.toISOString();
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  return {
    id: uuid.v4().toString(),
    created_at: currentTimestamp,
    amount: amount,
    net_amount: amount,
    currency: 'EUR',
    payment_method: null,
    direction: 'out',
    category_key: 'acquisti',
    subcategory_key: 'tempo_libero',
    category_confidence: 1.0,
    date: currentTimestamp.split('T')[0],
    time: null,
    time_of_day: 'afternoon',
    is_weekend: now.getDay() === 0 || now.getDay() === 6,
    day_of_week: dayNames[now.getDay()],
    social_context: null,
    people_mentioned: [],
    group_size: null,
    is_social: false,
    location_type: 'physical_store',
    location_name: null,
    city: null,
    address: null,
    is_travel: false,
    is_online: false,
    is_recurring_pattern: false,
    reason: null,
    refund: null,
    split: null,
    description: description,
    input_method: 'manual',
    raw_input: `${amount} - ${description}`,
    holiday: null,
    tags: [],
    is_deleted: false,
    synced_at: null
  };
}

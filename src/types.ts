export type Category = 'accommodation' | 'transport' | 'food_activities' | 'shopping' | 'miscellaneous';

export interface Budget {
  accommodation: number;
  transport: number;
  food_activities: number;
  shopping: number;
  miscellaneous: number;
}

export interface Trip {
  id: string;
  trip_name: string;
  user_email: string;
  budget: Budget;
  trip_start_date: any;
  trip_end_date: any;
  created_at: any;
  archived?: boolean;
}

export interface Expense {
  id: string;
  date: any;
  category: Category;
  amount_inr: number;
  notes: string;
  created_at: any;
}

export const CATEGORIES: { value: Category; label: string; icon: string; color: string }[] = [
  { value: 'accommodation', label: 'Accommodation', icon: 'hotel', color: 'primary' },
  { value: 'transport', label: 'Transport', icon: 'train', color: 'secondary' },
  { value: 'food_activities', label: 'Food & Activities', icon: 'restaurant', color: 'tertiary' },
  { value: 'shopping', label: 'Shopping', icon: 'shopping_bag', color: 'error' },
  { value: 'miscellaneous', label: 'Miscellaneous', icon: 'more_horiz', color: 'outline' },
];

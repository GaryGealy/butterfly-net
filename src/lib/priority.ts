export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const DEFAULT_PRIORITY: Priority = 'medium';
export const PRIORITY_LABEL: Record<Priority, string> = {
	low: 'Low',
	medium: 'Medium',
	high: 'High'
};

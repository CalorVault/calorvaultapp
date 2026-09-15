import * as Notifications from 'expo-notifications';
import { ReminderSettings } from '../types';

export class ReminderError extends Error {}

/**
 * Clears any previously scheduled reminder (this app only ever schedules
 * this one recurring notification, so a full clear is safe) and, if
 * `settings.enabled`, schedules a new daily local reminder at the given
 * time. Returns normally on success; throws ReminderError if permission
 * was denied or notifications aren't supported in this environment.
 */
export async function applyReminderSettings(
  settings: ReminderSettings,
  content: { title: string; body: string }
): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Nothing was scheduled yet, or notifications aren't supported here --
    // either way there's nothing to clear.
  }

  if (!settings.enabled) return;

  let granted = false;
  try {
    const existing = await Notifications.getPermissionsAsync();
    granted = existing.granted;
    if (!granted) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }
  } catch {
    throw new ReminderError('Notifications are not supported in this environment.');
  }

  if (!granted) {
    throw new ReminderError('Enable notifications in your device settings to get reminders.');
  }

  const [hourStr, minuteStr] = settings.time.split(':');
  const hour = parseInt(hourStr, 10) || 0;
  const minute = parseInt(minuteStr, 10) || 0;

  await Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

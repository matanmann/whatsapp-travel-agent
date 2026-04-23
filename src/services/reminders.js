import cron from 'node-cron';
import config from '../config/index.js';
import { TaskModel } from '../models/index.js';
import { sendReminder } from './whatsapp.js';

let started = false;

export function startReminderService() {
  if (started) return;
  started = true;

  cron.schedule(config.reminderCron, async () => {
    try {
      const due = await TaskModel.getDueReminders();
      if (due.length === 0) return;

      for (const task of due) {
        if (!task.assignee?.phoneNumber) continue;

        // We only send reminders for assigned tasks to avoid leaking reminders.
        const tripName = task.trip?.name || 'Trip';
        const dueDate = task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : null;
        await sendReminder(`whatsapp:${task.assignee.phoneNumber}`, task.title, tripName, dueDate);
      }

      console.log(`[reminders] Sent ${due.length} reminder(s)`);
    } catch (error) {
      console.error('[reminders] Failed to process reminders:', error.message);
    }
  });

  console.log(`[reminders] Cron started (${config.reminderCron})`);
}

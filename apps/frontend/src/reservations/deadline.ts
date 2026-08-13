import type { PublicLocale } from '../catalog/public.types';

export type DeadlineUrgency = 'normal' | 'soon' | 'critical' | 'passed';

export type DeadlineSummary = {
  text: string;
  urgency: DeadlineUrgency;
};

function englishRemaining(hours: number, minutes: number): string {
  if (hours === 0) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} remaining`;
  const hoursText = `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return minutes
    ? `${hoursText} and ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} remaining`
    : `${hoursText} remaining`;
}

function arabicHours(hours: number): string {
  if (hours === 1) return 'ساعة';
  if (hours === 2) return 'ساعتان';
  if (hours >= 3 && hours <= 10) return `${hours} ساعات`;
  return `${hours} ساعة`;
}

function arabicMinutes(minutes: number): string {
  if (minutes === 1) return 'دقيقة';
  if (minutes === 2) return 'دقيقتان';
  if (minutes >= 3 && minutes <= 10) return `${minutes} دقائق`;
  return `${minutes} دقيقة`;
}

export function reservationDeadline(
  expiresAt: string,
  now: number,
  locale: PublicLocale,
): DeadlineSummary {
  const remainingMilliseconds = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(remainingMilliseconds) || remainingMilliseconds <= 0)
    return {
      text:
        locale === 'ar' ? 'جارٍ التحقق من حالة الحجز…' : 'Checking the current reservation status…',
      urgency: 'passed',
    };
  const totalMinutes = Math.max(1, Math.ceil(remainingMilliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const text =
    locale === 'ar'
      ? `متبقي ${hours ? arabicHours(hours) : ''}${hours && minutes ? ' و' : ''}${
          minutes ? arabicMinutes(minutes) : ''
        }`
      : englishRemaining(hours, minutes);
  return {
    text,
    urgency: totalMinutes <= 60 ? 'critical' : totalMinutes <= 360 ? 'soon' : 'normal',
  };
}

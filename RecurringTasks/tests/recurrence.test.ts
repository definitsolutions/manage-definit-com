import { describe, it, expect } from 'vitest';
import { RecurrenceService } from '../src/server/services/recurrence.js';

const svc = new RecurrenceService();

describe('RecurrenceService', () => {
  describe('isBusinessDay', () => {
    it('weekdays are business days', () => {
      // 2026-02-09 is Monday
      expect(svc.isBusinessDay(new Date(2026, 1, 9))).toBe(true);  // Mon
      expect(svc.isBusinessDay(new Date(2026, 1, 10))).toBe(true); // Tue
      expect(svc.isBusinessDay(new Date(2026, 1, 11))).toBe(true); // Wed
      expect(svc.isBusinessDay(new Date(2026, 1, 12))).toBe(true); // Thu
      expect(svc.isBusinessDay(new Date(2026, 1, 13))).toBe(true); // Fri
    });

    it('weekends are not business days', () => {
      expect(svc.isBusinessDay(new Date(2026, 1, 14))).toBe(false); // Sat
      expect(svc.isBusinessDay(new Date(2026, 1, 15))).toBe(false); // Sun
    });
  });

  describe('adjustForBusinessDay', () => {
    it('returns same date if already a business day', () => {
      const date = new Date(2026, 1, 9); // Mon
      const result = svc.adjustForBusinessDay(date, 'previous');
      expect(result.getDate()).toBe(9);
    });

    it('adjusts Saturday to previous Friday', () => {
      const date = new Date(2026, 1, 14); // Sat
      const result = svc.adjustForBusinessDay(date, 'previous');
      expect(result.getDate()).toBe(13); // Fri
    });

    it('adjusts Sunday to next Monday', () => {
      const date = new Date(2026, 1, 15); // Sun
      const result = svc.adjustForBusinessDay(date, 'next');
      expect(result.getDate()).toBe(16); // Mon
    });

    it('none returns the same date even on weekend', () => {
      const date = new Date(2026, 1, 14); // Sat
      const result = svc.adjustForBusinessDay(date, 'none');
      expect(result.getDate()).toBe(14);
    });
  });

  describe('getNthWeekdayOfMonth', () => {
    it('gets 1st Monday of Feb 2026', () => {
      // Feb 2026: 1st is Sun, so 1st Mon is Feb 2
      const result = svc.getNthWeekdayOfMonth(2026, 2, 1, 0); // weekday 0 = Mon
      expect(result).not.toBeNull();
      expect(result!.getDate()).toBe(2);
    });

    it('gets 3rd Friday of March 2026', () => {
      // March 2026: 1st is Sun, 1st Fri is Mar 6, 3rd Fri is Mar 20
      const result = svc.getNthWeekdayOfMonth(2026, 3, 3, 4); // weekday 4 = Fri
      expect(result).not.toBeNull();
      expect(result!.getDate()).toBe(20);
    });

    it('returns null if nth weekday is out of month', () => {
      // 5th Monday - might not exist
      const result = svc.getNthWeekdayOfMonth(2026, 2, 5, 0);
      expect(result).toBeNull();
    });
  });

  describe('getLastBusinessDay', () => {
    it('gets last business day of Feb 2026 (ends on Sat)', () => {
      // Feb 28, 2026 is Saturday → last business day is Fri Feb 27
      const result = svc.getLastBusinessDay(2026, 2);
      expect(result.getDate()).toBe(27);
      expect(result.getMonth()).toBe(1); // 0-based
    });

    it('gets last business day of March 2026 (ends on Tue)', () => {
      // March 31, 2026 is Tuesday
      const result = svc.getLastBusinessDay(2026, 3);
      expect(result.getDate()).toBe(31);
    });
  });

  describe('calculateDueDates - weekly', () => {
    it('generates weekly Monday tasks', () => {
      const start = new Date(2026, 1, 1); // Sun Feb 1
      const end = new Date(2026, 1, 28);  // Sat Feb 28
      const dates = svc.calculateDueDates('weekly', { weekday: 0 }, start, end); // 0 = Mon
      // Mondays in Feb 2026: 2, 9, 16, 23
      expect(dates.length).toBe(4);
      expect(dates[0].getDate()).toBe(2);
      expect(dates[1].getDate()).toBe(9);
      expect(dates[2].getDate()).toBe(16);
      expect(dates[3].getDate()).toBe(23);
    });

    it('generates weekly Friday tasks', () => {
      const start = new Date(2026, 1, 1);
      const end = new Date(2026, 1, 28);
      const dates = svc.calculateDueDates('weekly', { weekday: 4 }, start, end); // 4 = Fri
      // Fridays in Feb 2026: 6, 13, 20, 27
      expect(dates.length).toBe(4);
      expect(dates[0].getDate()).toBe(6);
      expect(dates[3].getDate()).toBe(27);
    });
  });

  describe('calculateDueDates - monthly', () => {
    it('generates monthly on day 5', () => {
      const start = new Date(2026, 0, 1); // Jan 1
      const end = new Date(2026, 2, 31);  // Mar 31
      const dates = svc.calculateDueDates('monthly', { dayOfMonth: 5 }, start, end);
      expect(dates.length).toBe(3);
      expect(dates[0].getDate()).toBe(5); // Jan 5 Mon
      expect(dates[1].getDate()).toBe(5); // Feb 5 Thu
      expect(dates[2].getDate()).toBe(5); // Mar 5 Thu
    });

    it('caps day at end of month (31st in Feb)', () => {
      const start = new Date(2026, 1, 1);
      const end = new Date(2026, 1, 28);
      const dates = svc.calculateDueDates('monthly', { dayOfMonth: 31 }, start, end);
      expect(dates.length).toBe(1);
      // Feb 28 is Sat → adjusted to previous Fri Feb 27
      expect(dates[0].getDate()).toBe(27);
    });

    it('generates monthly on last business day', () => {
      const start = new Date(2026, 0, 1);
      const end = new Date(2026, 2, 31);
      const dates = svc.calculateDueDates('monthly', { lastBusinessDay: true }, start, end);
      expect(dates.length).toBe(3);
      // Jan 30 is Fri → 30
      expect(dates[0].getDate()).toBe(30);
      // Feb 27 is Fri (28 is Sat)
      expect(dates[1].getDate()).toBe(27);
      // Mar 31 is Tue → 31
      expect(dates[2].getDate()).toBe(31);
    });

    it('generates monthly on nth weekday', () => {
      const start = new Date(2026, 0, 1);
      const end = new Date(2026, 2, 31);
      // 2nd Tuesday of each month
      const dates = svc.calculateDueDates('monthly', { nthWeekday: { n: 2, weekday: 1 } }, start, end);
      expect(dates.length).toBe(3);
      // Jan: 1st is Thu, 1st Tue = Jan 6, 2nd Tue = Jan 13
      expect(dates[0].getDate()).toBe(13);
    });
  });

  describe('calculateDueDates - quarterly', () => {
    it('generates quarterly on last business day of quarter-end months', () => {
      const start = new Date(2026, 0, 1);
      const end = new Date(2026, 11, 31);
      const dates = svc.calculateDueDates('quarterly', { lastBusinessDay: true }, start, end);
      expect(dates.length).toBe(4);
      // Mar 31 Tue, Jun 30 Tue, Sep 30 Wed, Dec 31 Thu
      expect(dates[0].getMonth()).toBe(2);  // March
      expect(dates[1].getMonth()).toBe(5);  // June
      expect(dates[2].getMonth()).toBe(8);  // September
      expect(dates[3].getMonth()).toBe(11); // December
    });

    it('generates quarterly on day 15', () => {
      const start = new Date(2026, 0, 1);
      const end = new Date(2026, 11, 31);
      const dates = svc.calculateDueDates('quarterly', { dayOfMonth: 15 }, start, end);
      expect(dates.length).toBe(4);
      expect(dates[0].getMonth()).toBe(2);  // Mar 15 (or adjusted)
      expect(dates[1].getMonth()).toBe(5);  // Jun 15
    });
  });

  describe('calculateDueDates - annual', () => {
    it('generates annual on Jan 15', () => {
      const start = new Date(2026, 0, 1);
      const end = new Date(2027, 0, 31);
      const dates = svc.calculateDueDates('annual', { month: 1, day: 15 }, start, end);
      expect(dates.length).toBe(2);
      expect(dates[0].getFullYear()).toBe(2026);
      expect(dates[0].getMonth()).toBe(0);
      expect(dates[0].getDate()).toBe(15); // Jan 15 2026 is Thu
      expect(dates[1].getFullYear()).toBe(2027);
      expect(dates[1].getDate()).toBe(15); // Jan 15 2027 is Fri
    });

    it('generates annual nth weekday', () => {
      const start = new Date(2026, 0, 1);
      const end = new Date(2026, 11, 31);
      // 3rd Wednesday of June
      const dates = svc.calculateDueDates('annual', { nthWeekday: { month: 6, n: 3, weekday: 2 } }, start, end);
      expect(dates.length).toBe(1);
      expect(dates[0].getMonth()).toBe(5); // June
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty range', () => {
      const start = new Date(2026, 1, 15);
      const end = new Date(2026, 1, 14); // end before start
      const dates = svc.calculateDueDates('weekly', { weekday: 0 }, start, end);
      expect(dates.length).toBe(0);
    });
  });
});

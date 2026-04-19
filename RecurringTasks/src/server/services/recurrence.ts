import { Cadence } from '@prisma/client';

// Weekday mapping: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
// JS Date uses: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

type BusinessDayAdjust = 'none' | 'previous' | 'next';

interface DailyRule {
  businessDaysOnly?: boolean; // default true
}

interface WeeklyRule {
  weekday: number; // 0-6 (Mon-Sun)
  businessDayAdjust?: BusinessDayAdjust;
}

interface MonthlyRuleDayOfMonth {
  dayOfMonth: number;
  businessDayAdjust?: BusinessDayAdjust;
}

interface MonthlyRuleNthWeekday {
  nthWeekday: { n: number; weekday: number };
  businessDayAdjust?: BusinessDayAdjust;
}

interface MonthlyRuleLastBusinessDay {
  lastBusinessDay: true;
}

type MonthlyRule = MonthlyRuleDayOfMonth | MonthlyRuleNthWeekday | MonthlyRuleLastBusinessDay;

type QuarterlyRule = (MonthlyRuleDayOfMonth | MonthlyRuleNthWeekday | MonthlyRuleLastBusinessDay) & {
  months?: number[]; // custom quarter months, default [3,6,9,12]
};

interface AnnualRuleFixed {
  month: number; // 1-12
  day: number;
  businessDayAdjust?: BusinessDayAdjust;
}

interface AnnualRuleNthWeekday {
  nthWeekday: { month: number; n: number; weekday: number };
  businessDayAdjust?: BusinessDayAdjust;
}

type AnnualRule = AnnualRuleFixed | AnnualRuleNthWeekday;

export type RecurrenceRule = DailyRule | WeeklyRule | MonthlyRule | QuarterlyRule | AnnualRule;

export class RecurrenceService {
  /** Convert our weekday (0=Mon..6=Sun) to JS Date weekday (0=Sun..6=Sat) */
  private toJsWeekday(weekday: number): number {
    return (weekday + 1) % 7;
  }

  isBusinessDay(date: Date): boolean {
    const day = date.getDay(); // 0=Sun, 6=Sat
    return day !== 0 && day !== 6;
  }

  adjustForBusinessDay(date: Date, adjust: BusinessDayAdjust = 'previous'): Date {
    if (adjust === 'none' || this.isBusinessDay(date)) return new Date(date);

    const result = new Date(date);
    const direction = adjust === 'previous' ? -1 : 1;

    while (!this.isBusinessDay(result)) {
      result.setDate(result.getDate() + direction);
    }
    return result;
  }

  /** Get the nth occurrence of a weekday in a given month */
  getNthWeekdayOfMonth(year: number, month: number, n: number, weekday: number): Date | null {
    const jsWeekday = this.toJsWeekday(weekday);
    const firstDay = new Date(year, month - 1, 1);
    let dayOffset = jsWeekday - firstDay.getDay();
    if (dayOffset < 0) dayOffset += 7;

    const day = 1 + dayOffset + (n - 1) * 7;
    const result = new Date(year, month - 1, day);

    // Verify still in the same month
    if (result.getMonth() !== month - 1) return null;
    return result;
  }

  /** Get the last business day (Mon-Fri) of a given month */
  getLastBusinessDay(year: number, month: number): Date {
    const lastDay = new Date(year, month, 0); // day 0 of next month = last day of this month
    while (!this.isBusinessDay(lastDay)) {
      lastDay.setDate(lastDay.getDate() - 1);
    }
    return lastDay;
  }

  calculateDueDates(cadence: Cadence, rule: RecurrenceRule, rangeStart: Date, rangeEnd: Date): Date[] {
    const dates: Date[] = [];

    switch (cadence) {
      case 'daily':
        this.calculateDaily(rule as DailyRule, rangeStart, rangeEnd, dates);
        break;
      case 'weekly':
        this.calculateWeekly(rule as WeeklyRule, rangeStart, rangeEnd, dates);
        break;
      case 'monthly':
        this.calculateMonthly(rule as MonthlyRule, rangeStart, rangeEnd, dates);
        break;
      case 'quarterly':
        this.calculateQuarterly(rule as QuarterlyRule, rangeStart, rangeEnd, dates);
        break;
      case 'annual':
        this.calculateAnnual(rule as AnnualRule, rangeStart, rangeEnd, dates);
        break;
    }

    return dates;
  }

  private calculateDaily(rule: DailyRule, rangeStart: Date, rangeEnd: Date, dates: Date[]): void {
    const businessOnly = rule.businessDaysOnly !== false; // default true
    const current = new Date(rangeStart);
    current.setHours(0, 0, 0, 0);

    while (current <= rangeEnd) {
      if (!businessOnly || this.isBusinessDay(current)) {
        dates.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }
  }

  private calculateWeekly(rule: WeeklyRule, rangeStart: Date, rangeEnd: Date, dates: Date[]): void {
    const jsWeekday = this.toJsWeekday(rule.weekday);
    const adjust = rule.businessDayAdjust ?? 'previous';

    // Find the first occurrence of the weekday on or after rangeStart
    const current = new Date(rangeStart);
    current.setHours(0, 0, 0, 0);
    const dayDiff = jsWeekday - current.getDay();
    if (dayDiff < 0) {
      current.setDate(current.getDate() + dayDiff + 7);
    } else if (dayDiff > 0) {
      current.setDate(current.getDate() + dayDiff);
    }

    while (current <= rangeEnd) {
      const adjusted = this.adjustForBusinessDay(current, adjust);
      if (adjusted >= rangeStart && adjusted <= rangeEnd) {
        dates.push(new Date(adjusted));
      }
      current.setDate(current.getDate() + 7);
    }
  }

  private calculateMonthlyForMonth(rule: MonthlyRule, year: number, month: number): Date | null {
    if ('lastBusinessDay' in rule && rule.lastBusinessDay) {
      return this.getLastBusinessDay(year, month);
    }

    if ('nthWeekday' in rule) {
      const date = this.getNthWeekdayOfMonth(year, month, rule.nthWeekday.n, rule.nthWeekday.weekday);
      if (!date) return null;
      const adjust = rule.businessDayAdjust ?? 'previous';
      return this.adjustForBusinessDay(date, adjust);
    }

    if ('dayOfMonth' in rule) {
      const adjust = rule.businessDayAdjust ?? 'previous';
      // Cap day at actual last day of month
      const lastDay = new Date(year, month, 0).getDate();
      const day = Math.min(rule.dayOfMonth, lastDay);
      const date = new Date(year, month - 1, day);
      return this.adjustForBusinessDay(date, adjust);
    }

    return null;
  }

  private calculateMonthly(rule: MonthlyRule, rangeStart: Date, rangeEnd: Date, dates: Date[]): void {
    let year = rangeStart.getFullYear();
    let month = rangeStart.getMonth() + 1; // 1-based

    while (true) {
      const date = this.calculateMonthlyForMonth(rule, year, month);
      if (date && date > rangeEnd) break;
      if (date && date >= rangeStart) {
        dates.push(date);
      }

      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
      // Safety: if we've gone well past rangeEnd
      if (new Date(year, month - 1, 1) > rangeEnd) break;
    }
  }

  private calculateQuarterly(rule: QuarterlyRule, rangeStart: Date, rangeEnd: Date, dates: Date[]): void {
    const quarterMonths = rule.months || [3, 6, 9, 12];
    let year = rangeStart.getFullYear();

    // Start from the year of rangeStart, go through all quarter months
    while (true) {
      for (const month of quarterMonths) {
        const date = this.calculateMonthlyForMonth(rule as MonthlyRule, year, month);
        if (date && date > rangeEnd) return;
        if (date && date >= rangeStart) {
          dates.push(date);
        }
      }
      year++;
      if (new Date(year, 0, 1) > rangeEnd) break;
    }
  }

  private calculateAnnual(rule: AnnualRule, rangeStart: Date, rangeEnd: Date, dates: Date[]): void {
    let year = rangeStart.getFullYear();

    while (true) {
      let date: Date | null = null;

      if ('nthWeekday' in rule) {
        const nw = rule.nthWeekday;
        date = this.getNthWeekdayOfMonth(year, nw.month, nw.n, nw.weekday);
        if (date) {
          const adjust = rule.businessDayAdjust ?? 'previous';
          date = this.adjustForBusinessDay(date, adjust);
        }
      } else if ('month' in rule && 'day' in rule) {
        const adjust = rule.businessDayAdjust ?? 'previous';
        const lastDay = new Date(year, rule.month, 0).getDate();
        const day = Math.min(rule.day, lastDay);
        date = new Date(year, rule.month - 1, day);
        date = this.adjustForBusinessDay(date, adjust);
      }

      if (date && date > rangeEnd) break;
      if (date && date >= rangeStart) {
        dates.push(date);
      }

      year++;
      if (year > rangeEnd.getFullYear() + 1) break;
    }
  }
}

export const recurrenceService = new RecurrenceService();

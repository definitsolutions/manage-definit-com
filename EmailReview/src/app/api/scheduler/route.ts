import { NextResponse } from 'next/server';
import { schedulerService } from '@/services/scheduler.service';

let started = false;

/** Start the scheduler. Called on first dashboard load. Idempotent. */
export async function POST() {
  if (!started) {
    schedulerService.start();
    started = true;
    return NextResponse.json({ started: true });
  }
  return NextResponse.json({ started: false, message: 'Already running' });
}

export async function GET() {
  return NextResponse.json({ running: started });
}

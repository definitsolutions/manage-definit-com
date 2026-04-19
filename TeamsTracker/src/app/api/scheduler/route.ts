import { NextResponse } from 'next/server';
import { schedulerService } from '@/services/scheduler.service';

let started = false;

export async function POST() {
  if (!started) { schedulerService.start(); started = true; return NextResponse.json({ started: true }); }
  return NextResponse.json({ started: false, message: 'Already running' });
}

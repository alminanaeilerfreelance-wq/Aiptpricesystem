import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

const DEMO_USERS = [
  {
    name: 'Demo Admin',
    email: 'admin@demo.com',
    password: 'demo1234',
    role: 'admin' as const,
    isActive: true,
    approvalStatus: 'approved' as const,
  },
  {
    name: 'Demo User',
    email: 'user@demo.com',
    password: 'demo1234',
    role: 'user' as const,
    isActive: true,
    approvalStatus: 'approved' as const,
  },
];

export async function POST() {
  try {
    await connectDB();

    const created: string[] = [];
    const skipped: string[] = [];

    for (const demo of DEMO_USERS) {
      const exists = await User.findOne({ email: demo.email });
      if (exists) {
        skipped.push(demo.email);
      } else {
        await User.create(demo);
        created.push(demo.email);
      }
    }

    return NextResponse.json({ created, skipped });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Seeding failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

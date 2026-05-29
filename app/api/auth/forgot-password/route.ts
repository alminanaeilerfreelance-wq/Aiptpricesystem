import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { sendMail } from '@/lib/mailer';

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    const genericMessage = 'If an account exists for that email, a password reset link has been sent.';

    if (!user) {
      return NextResponse.json({ message: genericMessage });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = hashToken(resetToken);
    user.resetPasswordExpires = new Date(Date.now() + 1000 * 60 * 30);
    await user.save();

    const resetLink = `${req.nextUrl.origin}/reset-password?token=${resetToken}`;

    try {
      await sendMail({
        to: user.email,
        subject: 'Reset your IP Law Firm password',
        html: `
          <p>Hello ${user.name},</p>
          <p>Use the link below to reset your password. This link expires in 30 minutes.</p>
          <p><a href="${resetLink}">Reset password</a></p>
          <p>If you did not request this, you can ignore this email.</p>
        `,
      });
      return NextResponse.json({ message: genericMessage });
    } catch {
      return NextResponse.json({
        message: genericMessage,
        resetLink,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to request password reset';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

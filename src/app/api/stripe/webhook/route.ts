import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const body = await req.text();
  const sig = (await headers()).get('stripe-signature')!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    const { userId, plan } = session.metadata;

    console.log(`💰 Payment completed for user ${userId}, plan: ${plan}`);

    // Update user plan and expiry (one year from now)
    await prisma.user.update({
      where: { id: userId },
      data: { 
        plan: plan,
        planExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      }
    });
  }

  return NextResponse.json({ received: true });
}

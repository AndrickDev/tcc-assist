import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type { Plan } from "@prisma/client";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const body = await req.text();
  const sig = (await headers()).get('stripe-signature')!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Webhook signature verification failed:', message);
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const checkout = event.data.object as { metadata?: { userId?: string; plan?: string } };
    const userId = checkout.metadata?.userId;
    const plan = checkout.metadata?.plan;
    if (!userId || !plan) {
      return NextResponse.json({ received: true });
    }

    console.log(`💰 Payment completed for user ${userId}, plan: ${plan}`);

    // Update user plan and expiry (one year from now)
    const nextPlan: Plan | null =
      plan === "FREE" || plan === "PRO" || plan === "VIP" ? (plan as Plan) : null;
    if (!nextPlan) return NextResponse.json({ received: true });

    await prisma.user.update({
      where: { id: userId },
      data: { 
        plan: nextPlan,
        planExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      }
    });
  }

  return NextResponse.json({ received: true });
}

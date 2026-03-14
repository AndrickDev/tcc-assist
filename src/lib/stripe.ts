import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27-acacia' as any, // Using a stable version
});

export async function createCheckoutSession({
  userId,
  plan
}: { userId: string, plan: 'PRO' | 'VIP' }) {
  // Use price IDs from env or hardcoded as per user request (with placeholders)
  const prices = {
    PRO: process.env.STRIPE_PRICE_PRO || 'price_pro_tcc_200',
    VIP: process.env.STRIPE_PRICE_VIP || 'price_vip_projeto_1000'
  };

  if (!prices[plan] || prices[plan].startsWith('price_')) {
    console.warn(`⚠️ Stripe Price ID for ${plan} is a placeholder or missing: ${prices[plan]}`);
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price: prices[plan],
        quantity: 1
      }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?cancel=true`,
      metadata: { userId, plan },
      payment_method_types: ['card'],
    });

    return { url: session.url };
  } catch (err: any) {
    console.error('❌ Stripe SDK Error:', err.message);
    throw err;
  }
}

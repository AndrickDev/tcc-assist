import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  // Define a versão mais recente ou omite
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiVersion: '2023-10-16' as any,
});

export const createCheckoutSession = async ({
  userId,
  plan,
}: {
  userId: string;
  plan: 'PRO' | 'VIP';
}) => {
  const priceId =
    plan === 'PRO'
      ? process.env.STRIPE_PRICE_PRO
      : process.env.STRIPE_PRICE_VIP;

  if (!priceId) {
    throw new Error('Preço do Stripe não configurado nas variáveis de ambiente (.env)');
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      plan,
    },
    success_url: `${baseUrl}/dashboard?stripe=success`,
    cancel_url: `${baseUrl}/dashboard?stripe=cancel`,
  });

  return { url: session.url };
};

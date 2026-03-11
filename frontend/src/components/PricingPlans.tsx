import type { ReactNode } from 'react'
import { useState } from 'react'

const checkIcon = '/assets/icons/check-mark.png'

type BillingMode = 'monthly' | 'yearly'

type PlanBadge =
    | { type: 'single'; text: string }
    | { type: 'toggle' }

type Plan = {
    name: string
    price?: string
    prices?: { monthly: string; yearly: string }
    interval: string
    badge: PlanBadge
    features: ReactNode[]
    cta: string
    variant: 'solid' | 'outline'
    featured?: boolean
}

const plans: Plan[] = [
    {
        name: 'Free',
        price: '0€',
        interval: '/month',
        badge: { type: 'single', text: 'Free Plan' },
        features: [
            'Create up to 5 course generations',
            'All content types available',
            'Advanced customization',
            'Full editor and PDF/Markdown export',
        ],
        cta: 'Start now, free',
        variant: 'outline',
    },
    {
        name: 'Pro',
        prices: { monthly: '20€', yearly: '15€' },
        interval: '/month',
        badge: { type: 'toggle' },
        features: [
            'Everything from free plan',
            <>
                Extended use (<span className="text-accent">+30</span> generations)
            </>,
            'Dedicated support in various forms',
            'Shareable links and collaboration with up to 3 teammates',
        ],
        cta: 'Start now, free',
        variant: 'solid',
        featured: true,
    },
    {
        name: 'Institutional',
        price: '100€',
        interval: '/month',
        badge: { type: 'single', text: 'Annual Billing Only' },
        features: [
            'Unlimited course generations',
            'All content types available',
            'Advanced customization',
            'Full editor and PDF/Markdown export',
        ],
        cta: 'Start now, free',
        variant: 'outline',
    },
]

function PlanBadge({
    badge,
    billing,
    onBillingChange,
}: {
    badge: PlanBadge
    billing: BillingMode
    onBillingChange: (mode: BillingMode) => void
}) {
    if (badge.type === 'toggle') {
        return (
            <div className="flex items-center gap-1 rounded-full bg-white/15 p-1">
                <button
                    type="button"
                    onClick={() => onBillingChange('monthly')}
                    aria-pressed={billing === 'monthly'}
                    className={`px-4 py-1.5 rounded-full font-sora text-sm font-semibold transition-colors ${billing === 'monthly'
                        ? 'bg-accent text-dark'
                        : 'text-white/70 hover:text-white'
                        }`}
                >
                    Monthly
                </button>
                <button
                    type="button"
                    onClick={() => onBillingChange('yearly')}
                    aria-pressed={billing === 'yearly'}
                    className={`px-4 py-1.5 rounded-full font-sora text-sm font-semibold transition-colors ${billing === 'yearly'
                        ? 'bg-accent text-dark'
                        : 'text-white/70 hover:text-white'
                        }`}
                >
                    Yearly
                </button>
            </div>
        )
    }

    return (
        <span className="rounded-full bg-white/15 px-5 py-1.5 font-sora text-sm font-semibold text-white whitespace-nowrap">
            {badge.text}
        </span>
    )
}

function PlanCard({
    plan,
    billing,
    onBillingChange,
}: {
    plan: Plan
    billing: BillingMode
    onBillingChange: (mode: BillingMode) => void
}) {
    const cardStyle = plan.featured
        ? 'border-2 border-accent shadow-elevated -mt-6 -mb-6 min-h-[580px]'
        : 'border border-accent shadow-card min-h-[520px]'

    const buttonStyle = plan.variant === 'solid'
        ? 'bg-accent text-dark hover:bg-accent/90'
        : 'border border-accent text-white hover:bg-accent/10'

    const price = plan.prices
        ? billing === 'monthly'
            ? plan.prices.monthly
            : plan.prices.yearly
        : plan.price

    return (
        <div className={`bg-dark rounded-sm px-8 py-7 flex flex-col ${cardStyle}`}>
            <div>
                <h3 className="font-sora text-2xl font-semibold text-white">{plan.name}</h3>
                <div className="mt-3 flex items-end gap-3">
                    <span className="font-sora text-5xl font-bold text-accent">{price}</span>
                    <span className="font-inter text-lg text-white/50">{plan.interval}</span>
                </div>

                <div className="mt-6 flex items-center gap-4">
                    <div className="h-px flex-1 bg-white/10" />
                    <PlanBadge badge={plan.badge} billing={billing} onBillingChange={onBillingChange} />
                    <div className="h-px flex-1 bg-white/10" />
                </div>
            </div>

            <ul className="mt-7 flex flex-col gap-4">
                {plan.features.map((feature, index) => (
                    <li key={index} className="flex gap-3">
                        <img src={checkIcon} alt="" className="h-6 w-6 mt-0.5" />
                        <span className="font-inter text-base text-white/80 leading-relaxed">
                            {feature}
                        </span>
                    </li>
                ))}
            </ul>

            <button
                type="button"
                className={`mt-10 self-center rounded-full px-12 py-3 text-base font-sora font-semibold transition-colors ${buttonStyle}`}
            >
                {plan.cta}
            </button>
        </div>
    )
}

function PricingPlans() {
    const [billing, setBilling] = useState<BillingMode>('yearly')

    return (
        <section className="w-full flex flex-col items-center py-16">
            <div className="w-[1120px] max-w-[95vw]">
                <h1 className="font-sora text-5xl font-bold text-dark text-center">
                    Flexible Plans for Every Need
                </h1>

                <div className="mt-14 grid grid-cols-3 gap-6 items-start">
                    {plans.map((plan) => (
                        <PlanCard key={plan.name} plan={plan} billing={billing} onBillingChange={setBilling} />
                    ))}
                </div>
            </div>
        </section>
    )
}

export default PricingPlans

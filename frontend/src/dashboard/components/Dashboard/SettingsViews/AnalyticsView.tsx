import { BarChart3, BookOpen, Clock, Sparkles, Target } from 'lucide-react'

export function AnalyticsView() {
    const stats = [
        { label: 'Units Created', value: '24', icon: BookOpen, color: '#4ADE80' },
        { label: 'AI Generations', value: '156', icon: Sparkles, color: '#3B82F6' },
        { label: 'Hours Saved', value: '42', icon: Clock, color: '#F59E0B' },
        { label: 'Completion Rate', value: '73%', icon: Target, color: '#EC4899' },
    ]

    return (
        <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-[80px] shrink-0 items-center border-b border-[#E5E5E7] bg-white/80 px-8 backdrop-blur-md">
                <div>
                    <h1 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">
                        Usage & Analytics
                    </h1>
                    <p className="mt-0.5 text-[13px] text-[#86868B]">
                        Track your productivity and usage
                    </p>
                </div>
            </header>

            <div className="p-8">
                <div className="max-w-[1200px] space-y-6">
                    <div className="grid grid-cols-4 gap-6">
                        {stats.map((stat) => (
                            <div
                                key={stat.label}
                                className="rounded-2xl border border-[#E5E5E7] bg-white p-6"
                            >
                                <div
                                    className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
                                    style={{ backgroundColor: `${stat.color}15` }}
                                >
                                    <stat.icon size={22} style={{ color: stat.color }} />
                                </div>
                                <div className="text-[28px] font-bold text-[#1D1D1F]">
                                    {stat.value}
                                </div>
                                <div className="mt-1 text-[13px] text-[#86868B]">
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-2xl border border-[#E5E5E7] bg-white p-8">
                        <h2 className="mb-6 text-[18px] font-bold text-[#1D1D1F]">
                            Activity Over Time
                        </h2>
                        <div className="flex h-[300px] items-center justify-center rounded-xl border-2 border-dashed border-[#E5E5E7]">
                            <div className="text-center">
                                <BarChart3 size={48} className="mx-auto mb-3 text-[#86868B]" />
                                <p className="text-[14px] text-[#86868B]">
                                    Chart visualization would go here
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

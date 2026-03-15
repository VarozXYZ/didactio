import { Lock } from 'lucide-react'

export function SecurityView() {
    return (
        <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-[80px] shrink-0 items-center border-b border-[#E5E5E7] bg-white/80 px-8 backdrop-blur-md">
                <div>
                    <h1 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">
                        Security Settings
                    </h1>
                    <p className="mt-0.5 text-[13px] text-[#86868B]">
                        Keep your account secure
                    </p>
                </div>
            </header>

            <div className="p-8">
                <div className="max-w-[700px] space-y-6">
                    <div className="rounded-[12px] border border-[#E5E5E7] bg-white p-8">
                        <h2 className="mb-6 text-[18px] font-bold text-[#1D1D1F]">
                            Change Password
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="mb-2 block text-[13px] font-semibold text-[#1D1D1F]">
                                    Current Password
                                </label>
                                <input
                                    type="password"
                                    className="w-full rounded-[8px] border border-[#E5E5E7] px-4 py-3 text-[14px] focus:border-[#4ADE80] focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-[13px] font-semibold text-[#1D1D1F]">
                                    New Password
                                </label>
                                <input
                                    type="password"
                                    className="w-full rounded-[8px] border border-[#E5E5E7] px-4 py-3 text-[14px] focus:border-[#4ADE80] focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-[13px] font-semibold text-[#1D1D1F]">
                                    Confirm New Password
                                </label>
                                <input
                                    type="password"
                                    className="w-full rounded-[8px] border border-[#E5E5E7] px-4 py-3 text-[14px] focus:border-[#4ADE80] focus:outline-none"
                                />
                            </div>
                            <button
                                type="button"
                                className="w-full rounded-[8px] bg-[#1D1D1F] px-4 py-3 text-[14px] font-semibold text-white transition-all hover:bg-[#333333]"
                            >
                                Update Password
                            </button>
                        </div>
                    </div>

                    <div className="rounded-[12px] border border-[#E5E5E7] bg-white p-8">
                        <div className="mb-4 flex items-start justify-between">
                            <div>
                                <h2 className="mb-1 text-[18px] font-bold text-[#1D1D1F]">
                                    Two-Factor Authentication
                                </h2>
                                <p className="text-[13px] text-[#86868B]">
                                    Add an extra layer of security to your account
                                </p>
                            </div>
                            <button
                                type="button"
                                className="rounded-[8px] bg-[#4ADE80] px-4 py-2 text-[13px] font-semibold text-white transition-all hover:bg-[#3BCD6F]"
                            >
                                Enable
                            </button>
                        </div>
                    </div>

                    <div className="rounded-[12px] border border-[#E5E5E7] bg-white p-8">
                        <h2 className="mb-6 text-[18px] font-bold text-[#1D1D1F]">
                            Active Sessions
                        </h2>
                        <div className="space-y-4">
                            {[
                                { device: 'MacBook Pro', location: 'New York, US', time: 'Active now' },
                                { device: 'iPhone 15', location: 'New York, US', time: '2 hours ago' },
                            ].map((session, index) => (
                                <div
                                    key={`${session.device}-${session.time}`}
                                    className="flex items-center justify-between rounded-[10px] border border-[#E5E5E7] p-4"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F5F7]">
                                            <Lock size={18} className="text-[#86868B]" />
                                        </div>
                                        <div>
                                            <div className="text-[14px] font-semibold text-[#1D1D1F]">
                                                {session.device}
                                            </div>
                                            <div className="text-[12px] text-[#86868B]">
                                                {session.location} {' \u00b7 '} {session.time}
                                            </div>
                                        </div>
                                    </div>
                                    {index !== 0 && (
                                        <button
                                            type="button"
                                            className="text-[13px] font-medium text-red-500 hover:underline"
                                        >
                                            Sign Out
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-[12px] border border-red-200 bg-red-50 p-8">
                        <h2 className="mb-2 text-[18px] font-bold text-red-600">
                            Danger Zone
                        </h2>
                        <p className="mb-4 text-[13px] text-red-600/80">
                            Once you delete your account, there is no going back. Please be certain.
                        </p>
                        <button
                            type="button"
                            className="rounded-[8px] bg-red-600 px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:bg-red-700"
                        >
                            Delete Account
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

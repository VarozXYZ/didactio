export function ProfileView() {
    return (
        <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-[80px] shrink-0 items-center border-b border-[#E5E5E7] bg-white/80 px-8 backdrop-blur-md">
                <div>
                    <h1 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">
                        Profile Settings
                    </h1>
                    <p className="mt-0.5 text-[13px] text-[#86868B]">
                        Manage your account information
                    </p>
                </div>
            </header>

            <div className="p-8">
                <div className="max-w-[700px] space-y-6">
                    <div className="rounded-2xl border border-[#E5E5E7] bg-white p-8">
                        <h2 className="mb-6 text-[18px] font-bold text-[#1D1D1F]">
                            Profile Photo
                        </h2>
                        <div className="flex items-center gap-6">
                            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#4ADE80] to-[#2D8F4B] text-3xl font-bold text-white">
                                JD
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    className="rounded-xl bg-[#1D1D1F] px-4 py-2 text-[13px] font-semibold text-white transition-all hover:bg-[#333333]"
                                >
                                    Upload Photo
                                </button>
                                <button
                                    type="button"
                                    className="rounded-xl border border-[#E5E5E7] px-4 py-2 text-[13px] font-semibold transition-all hover:border-[#4ADE80] hover:bg-[#4ADE80]/5"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-[#E5E5E7] bg-white p-8">
                        <h2 className="mb-6 text-[18px] font-bold text-[#1D1D1F]">
                            Basic Information
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="mb-2 block text-[13px] font-semibold text-[#1D1D1F]">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    defaultValue="John Doe"
                                    className="w-full rounded-xl border border-[#E5E5E7] px-4 py-3 text-[14px] focus:border-[#4ADE80] focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-[13px] font-semibold text-[#1D1D1F]">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    defaultValue="john.doe@example.com"
                                    className="w-full rounded-xl border border-[#E5E5E7] px-4 py-3 text-[14px] focus:border-[#4ADE80] focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-[13px] font-semibold text-[#1D1D1F]">
                                    Bio
                                </label>
                                <textarea
                                    rows={4}
                                    placeholder="Tell us about yourself..."
                                    className="w-full resize-none rounded-xl border border-[#E5E5E7] px-4 py-3 text-[14px] focus:border-[#4ADE80] focus:outline-none"
                                />
                            </div>
                            <button
                                type="button"
                                className="w-full rounded-xl bg-[#1D1D1F] px-4 py-3 text-[14px] font-semibold text-white transition-all hover:bg-[#333333]"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

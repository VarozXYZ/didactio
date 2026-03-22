const accentFilter =
    'brightness(0) saturate(100%) invert(64%) sepia(70%) saturate(463%) hue-rotate(83deg) brightness(95%) contrast(92%)'

function ContactForm() {
    return (
        <section className="w-[1040px] max-w-[95vw] py-16">
            <div className="flex flex-col items-center text-center">
                <h1 className="font-sora text-5xl font-bold text-dark">Get in touch with us</h1>
                <p className="mt-4 max-w-[720px] font-inter text-base text-dark/70 leading-relaxed">
                    Got questions, issues or recommendations? We are here to answer your requests!
                </p>
            </div>

            <div className="mt-10 flex justify-center">
                <form className="w-[500px] max-w-full rounded-md border border-accent bg-dark px-9 py-9 shadow-card">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
                            <img
                                src="/assets/icons/envelope-solid-full.png"
                                alt=""
                                className="h-5 w-5"
                                style={{ filter: accentFilter }}
                            />
                        </div>
                        <h2 className="font-sora text-2xl font-semibold text-white">Send us a message</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                        <label className="flex flex-col gap-2 font-inter text-base text-white/80">
                            First name
                            <input
                                type="text"
                                name="firstName"
                                placeholder="Jane"
                                autoComplete="given-name"
                                className="h-12 rounded-md border border-dark/10 bg-white px-3 text-sm text-dark shadow-sm outline-none focus:ring-2 focus:ring-accent/60"
                            />
                        </label>
                        <label className="flex flex-col gap-2 font-inter text-base text-white/80">
                            Last name
                            <input
                                type="text"
                                name="lastName"
                                placeholder="Doe"
                                autoComplete="family-name"
                                className="h-12 rounded-md border border-dark/10 bg-white px-3 text-sm text-dark shadow-sm outline-none focus:ring-2 focus:ring-accent/60"
                            />
                        </label>

                        <label className="col-span-2 flex flex-col gap-2 font-inter text-base text-white/80">
                            Email Address
                            <input
                                type="email"
                                name="email"
                                placeholder="jane@example.com"
                                autoComplete="email"
                                className="h-12 rounded-md border border-dark/10 bg-white px-3 text-sm text-dark shadow-sm outline-none focus:ring-2 focus:ring-accent/60"
                            />
                        </label>

                        <label className="col-span-2 flex flex-col gap-2 font-inter text-base text-white/80">
                            Subject
                            <div className="relative">
                                <select
                                    name="subject"
                                    className="h-12 w-full appearance-none rounded-md border border-dark/10 bg-white px-3 pr-10 text-sm text-dark shadow-sm outline-none focus:ring-2 focus:ring-accent/60"
                                >
                                    <option>General Inquiry</option>
                                    <option>Product Feedback</option>
                                    <option>Billing Question</option>
                                    <option>Partnership</option>
                                </select>
                                <img
                                    src="/assets/icons/angle-down-solid-full.png"
                                    alt=""
                                    className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2"
                                    style={{ filter: accentFilter }}
                                />
                            </div>
                        </label>

                        <label className="col-span-2 flex flex-col gap-2 font-inter text-base text-white/80">
                            Message
                            <textarea
                                name="message"
                                placeholder="How can we help you?"
                                rows={5}
                                className="min-h-[160px] rounded-md border border-dark/10 bg-white px-3 py-2 text-sm text-dark shadow-sm outline-none focus:ring-2 focus:ring-accent/60"
                            />
                        </label>
                    </div>

                    <button
                        type="submit"
                        className="mt-8 w-full rounded-md bg-accent py-3.5 text-base font-sora font-semibold text-dark transition-colors hover:bg-accent/90"
                    >
                        Send Message
                    </button>
                </form>
            </div>
        </section>
    )
}

export default ContactForm

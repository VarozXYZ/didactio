function TermsOfServicePage() {
	return (
		<section className="w-full px-6 py-16 font-inter text-dark">
			<div className="mx-auto max-w-3xl">
				<p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">
					Legal
				</p>
				<h1 className="mb-6 font-sora text-4xl font-bold">
					Terms of Service
				</h1>
				<p className="mb-8 text-dark/70">Last updated: May 27, 2026</p>

				<div className="space-y-7 text-base leading-8 text-dark/80">
					<p>
						These Terms of Service govern your use of Didactio, an AI-assisted
						learning workspace for creating, editing, studying, and exporting
						educational content. By using Didactio, you agree to these terms.
					</p>

					<section>
						<h2 className="mb-3 font-sora text-2xl font-bold text-dark">
							Use of the Service
						</h2>
						<p>
							You may use Didactio to create lawful educational content and manage
							your own learning materials. You are responsible for the information
							you submit, the content you create, and your use of exported
							materials.
						</p>
					</section>

					<section>
						<h2 className="mb-3 font-sora text-2xl font-bold text-dark">
							Accounts
						</h2>
						<p>
							Access to some features requires Google sign-in. You are responsible
							for keeping your account secure and for all activity that occurs
							under your account.
						</p>
					</section>

					<section>
						<h2 className="mb-3 font-sora text-2xl font-bold text-dark">
							AI Output
						</h2>
						<p>
							Didactio uses AI systems to generate educational material. AI output
							may be inaccurate, incomplete, or unsuitable for a specific context.
							You should review, edit, and validate generated content before
							relying on it in professional, academic, or classroom settings.
						</p>
					</section>

					<section>
						<h2 className="mb-3 font-sora text-2xl font-bold text-dark">
							Billing and Credits
						</h2>
						<p>
							Paid features, subscriptions, or credit packs may be processed by
							Stripe. Prices, included credits, and available plans may change
							over time. Billing terms shown at checkout apply to each purchase.
						</p>
					</section>

					<section>
						<h2 className="mb-3 font-sora text-2xl font-bold text-dark">
							Prohibited Use
						</h2>
						<p>
							You may not use Didactio to violate laws, infringe intellectual
							property rights, compromise security, abuse the service, attempt to
							bypass usage limits, or generate harmful content.
						</p>
					</section>

					<section>
						<h2 className="mb-3 font-sora text-2xl font-bold text-dark">
							Service Availability
						</h2>
						<p>
							We aim to provide a reliable service, but availability may be
							interrupted by maintenance, infrastructure issues, provider outages,
							or changes to third-party services.
						</p>
					</section>

					<section>
						<h2 className="mb-3 font-sora text-2xl font-bold text-dark">
							Contact
						</h2>
						<p>
							For questions about these terms, contact us through the Didactio
							contact page.
						</p>
					</section>
				</div>
			</div>
		</section>
	);
}

export default TermsOfServicePage;

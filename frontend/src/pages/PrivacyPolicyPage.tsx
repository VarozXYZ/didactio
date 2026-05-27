function PrivacyPolicyPage() {
	return (
		<section className="w-full px-6 py-16 font-inter text-dark">
			<div className="mx-auto max-w-3xl">
				<p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">
					Legal
				</p>
				<h1 className="mb-6 font-sora text-4xl font-bold">
					Privacy Policy
				</h1>
				<p className="mb-8 text-dark/70">Last updated: May 27, 2026</p>

				<div className="space-y-7 text-base leading-8 text-dark/80">
					<p>
						Didactio is an AI-assisted learning workspace that helps users
						create, edit, study, and export educational content. This Privacy
						Policy explains what information we collect, how we use it, and the
						choices available to users.
					</p>

					<section>
						<h2 className="mb-3 font-sora text-2xl font-bold text-dark">
							Information We Collect
						</h2>
						<p>
							When you sign in with Google, we may receive basic account
							information such as your name, email address, profile picture, and
							Google account identifier. We also collect information you create
							or save in Didactio, including didactic units, notes, folders,
							learning activities, preferences, generation history, usage
							analytics, credit transactions, and billing-related account state.
						</p>
					</section>

					<section>
						<h2 className="mb-3 font-sora text-2xl font-bold text-dark">
							How We Use Information
						</h2>
						<p>
							We use this information to authenticate users, provide the
							application, store learning content, personalize generation
							settings, process credits and billing, improve reliability, prevent
							abuse, and respond to support requests.
						</p>
					</section>

					<section>
						<h2 className="mb-3 font-sora text-2xl font-bold text-dark">
							Third-Party Services
						</h2>
						<p>
							Didactio uses third-party services including Google for
							authentication, Stripe for billing, MongoDB-compatible persistence,
							and AI providers or gateways for content generation. Information is
							shared with these providers only as needed to operate the service.
						</p>
					</section>

					<section>
						<h2 className="mb-3 font-sora text-2xl font-bold text-dark">
							AI-Generated Content
						</h2>
						<p>
							Prompts, educational topics, user instructions, and selected
							content may be sent to AI providers to generate learning material
							or feedback. Users should avoid submitting sensitive personal
							information in prompts or documents.
						</p>
					</section>

					<section>
						<h2 className="mb-3 font-sora text-2xl font-bold text-dark">
							Data Security
						</h2>
						<p>
							We use reasonable technical and organizational measures to protect
							user data, including HTTPS, authenticated sessions, access controls,
							and server-side storage for durable account state. No online service
							can guarantee absolute security.
						</p>
					</section>

					<section>
						<h2 className="mb-3 font-sora text-2xl font-bold text-dark">
							Your Choices
						</h2>
						<p>
							You may contact us to request access, correction, export, or
							deletion of your account data, subject to legal, security, billing,
							and operational retention requirements.
						</p>
					</section>

					<section>
						<h2 className="mb-3 font-sora text-2xl font-bold text-dark">
							Contact
						</h2>
						<p>
							For privacy questions, contact us through the Didactio contact page.
						</p>
					</section>
				</div>
			</div>
		</section>
	);
}

export default PrivacyPolicyPage;

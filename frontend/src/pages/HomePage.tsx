import Features from "@/components/marketing/Features";
import Faq from "@/components/marketing/Faq";
import Hero from "@/components/marketing/Hero";
import Testimonials from "@/components/marketing/Testimonials";

function HomePage() {
	return (
		<>
			<Hero />
			<Features />
			<Testimonials />
			<Faq />
		</>
	);
}

export default HomePage;

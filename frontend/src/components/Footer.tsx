import { Link } from 'react-router-dom'

function Footer() {
    return (
        <footer className="bg-secondary/55 rounded-b-xl rounded-t-ml w-[1040px] h-[500px] my-5">
            <div className="bg-dark rounded-xl h-[125px] px-16 flex items-center justify-between">
                <div>
                    <h3 className="font-sora text-3xl font-bold text-white mb-2">Join our newsletter</h3>
                    <h5 className="font-inter text-base text-white/70">Be the first to know about our new features</h5>
                </div>

                <div className="flex items-center border border-white/50 rounded-full pl-4 pr-1 py-1">
                    <input
                        type="email"
                        placeholder="Enter your email address"
                        className="w-[280px] bg-transparent font-inter text-sm text-white placeholder:text-white/50 outline-none"
                    />
                    <button className="w-[65px] h-[50px] bg-white rounded-full flex items-center justify-center hover:bg-white/90 transition-colors">
                        <img src="/assets/icons/paper-plane-solid-full.png" alt="Send" className="w-8 h-8" />
                    </button>
                </div>
            </div>

            <div className="px-16 pt-5 flex justify-between">
                <div className="w-[280px]">
                    <img src="/assets/logos/logo-horizontal.png" alt="Didactio" className="h-[50px] mb-6" />
                    <p className="font-inter text-md text-dark leading-relaxed mb-8">
                        AI-powered web platform that creates personalized, didactic syllabi for almost any topic and educational level in minutes.
                    </p>
                    <div className="flex items-center gap-3">
                        <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded-full bg-dark flex items-center justify-center hover:bg-dark/80 transition-colors">
                            <img src="/assets/icons/x-twitter.png" alt="X" className="w-10 h-10" />
                        </a>
                        <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded-full bg-dark flex items-center justify-center hover:bg-dark/80 transition-colors">
                            <img src="/assets/icons/instagram.png" alt="Instagram" className="w-10 h-10" />
                        </a>
                        <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded-full bg-dark flex items-center justify-center hover:bg-dark/80 transition-colors">
                            <img src="/assets/icons/discord-brands-solid-full.png" alt="Discord" className="w-10 h-10" />
                        </a>
                    </div>
                </div>

                <div className="flex gap-20 mt-5">
                    <div>
                        <h4 className="font-sora font-bold text-xl text-dark mb-4">Resources</h4>
                        <ul className="space-y-3">
                            <li><a href="#" className="font-inter text-md text-dark/70 hover:text-dark transition-colors">Documentation</a></li>
                            <li><a href="#" className="font-inter text-md text-dark/70 hover:text-dark transition-colors">Blog</a></li>
                            <li><a href="#" className="font-inter text-md text-dark/70 hover:text-dark transition-colors">Examples</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-sora font-bold text-xl text-dark mb-4">Support</h4>
                        <ul className="space-y-3">
                            <li><Link to="/pricing" className="font-inter text-md text-dark/70 hover:text-dark transition-colors">Pricing</Link></li>
                            <li><a href="#" className="font-inter text-md text-dark/70 hover:text-dark transition-colors">FAQ</a></li>
                            <li><a href="#" className="font-inter text-md text-dark/70 hover:text-dark transition-colors">Support</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-sora font-bold text-xl text-dark mb-4">Didactio</h4>
                        <ul className="space-y-3">
                            <li><a href="#" className="font-inter text-md text-dark/70 hover:text-dark transition-colors">About Us</a></li>
                            <li><Link to="/contact" className="font-inter text-md text-dark/70 hover:text-dark transition-colors">Contact Us</Link></li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="text-center pb-8 px-16">
                <p className="font-inter text-sm text-dark/75 mb-4">Copyright @ 2025</p>
                <div className="w-full h-[1px] bg-dark/50"></div>
            </div>
        </footer>
    )
}

export default Footer

import { Link, useLocation } from 'react-router-dom'

function Header() {
    const location = useLocation()
    const isActive = (path: string) => location.pathname === path

    return (
        <header className="max-w-[1440px] flex items-center justify-between gap-24 my-10">
            <Link to="/">
                <img src="/assets/logos/logo-horizontal.png" alt="Didactio" className="h-[60px]" />
            </Link>

            <nav className="bg-dark rounded-md px-8 py-3 w-[650px] flex items-center justify-center gap-18 shadow-card hover:shadow-elevated transition-shadow">
                <Link
                    to="/"
                    className={`font-sora text-xl font-medium transition-colors ${isActive('/') ? 'text-accent' : 'text-white hover:text-accent'
                        }`}
                >
                    Home
                </Link>
                <Link
                    to="/pricing"
                    className={`font-sora text-xl font-medium transition-colors ${isActive('/pricing') ? 'text-accent' : 'text-white hover:text-accent'
                        }`}
                >
                    Pricing
                </Link>
                <Link
                    to="/contact"
                    className={`font-sora text-xl font-medium transition-colors ${isActive('/contact') ? 'text-accent' : 'text-white hover:text-accent'
                        }`}
                >
                    Contact
                </Link>
                <Link
                    to="/dashboard"
                    className={`font-sora text-xl font-medium transition-colors flex items-center gap-2 ${isActive('/dashboard') ? 'text-accent' : 'text-white hover:text-accent'
                        }`}
                >
                    Dashboard
                    <img src="/assets/icons/dashboard-icon.png" alt="" className="h-4 w-4" />
                </Link>
            </nav>

            <Link
                to="/dashboard"
                className="w-[150px] h-[40px] bg-accent rounded-md border border-dark font-sora font-semibold text-xl text-dark flex items-center justify-center hover:bg-accent/90 transition-colors shadow-card hover:shadow-elevated"
            >
                Try it out
            </Link>
        </header>
    )
}

export default Header

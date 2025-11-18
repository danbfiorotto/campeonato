'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { User, Home, Gamepad2, Trophy, Users, Menu, X, Video, Award } from 'lucide-react'

export function Navbar() {
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const navLinks = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/jogos', label: 'Jogos', icon: Gamepad2 },
    { href: '/partidas', label: 'Partidas', icon: Trophy },
    { href: '/times', label: 'Times', icon: Users },
    { href: '/streams', label: 'Streams', icon: Video },
    { href: '/hall-da-fama', label: 'Hall da Fama', icon: Award },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-md">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold font-heading">
              <span className="text-orange-500 neon-glow">RAC</span>
              <span className="text-white mx-2">vs</span>
              <span className="text-red-500 neon-glow">AST</span>
            </Link>
            {/* Desktop Menu */}
            <div className="hidden md:flex gap-6">
              {navLinks.map((link) => {
                const Icon = link.icon
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`text-sm font-medium transition-all duration-300 flex items-center gap-2 relative ${
                      isActive 
                        ? 'text-blue-400 neon-glow nav-link-active' 
                        : 'text-gray-400 hover:text-blue-300 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{link.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
          
          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <>
                <Link href="/admin">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-purple-500/50 text-purple-300 hover:bg-purple-500/20 hover:border-purple-400 hover:text-purple-200 hover:shadow-[0_0_15px_rgba(147,51,234,0.5)]"
                  >
                    <User className="mr-2 h-4 w-4" />
                    Admin
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleLogout}
                  className="text-gray-300 hover:text-white hover:bg-white/10"
                >
                  Sair
                </Button>
              </>
            ) : (
              <Link href="/login">
                <Button 
                  variant="default" 
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)] hover:shadow-[0_0_30px_rgba(59,130,246,0.8)]"
                >
                  Login
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden text-white hover:bg-white/10"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </Button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-black/60 backdrop-blur-md">
            <div className="px-4 py-4 space-y-3">
              {navLinks.map((link) => {
                const Icon = link.icon
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                      isActive 
                        ? 'text-blue-400 bg-blue-500/20 border border-blue-500/50' 
                        : 'text-gray-300 hover:text-blue-300 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{link.label}</span>
                  </Link>
                )
              })}
              
              {/* Mobile Auth Buttons */}
              <div className="pt-4 border-t border-white/10 space-y-2">
                {user ? (
                  <>
                    <Link href="/admin" onClick={() => setMobileMenuOpen(false)}>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full border-purple-500/50 text-purple-300 hover:bg-purple-500/20"
                      >
                        <User className="mr-2 h-4 w-4" />
                        Admin
                      </Button>
                    </Link>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        handleLogout()
                        setMobileMenuOpen(false)
                      }}
                      className="w-full text-gray-300 hover:text-white hover:bg-white/10"
                    >
                      Sair
                    </Button>
                  </>
                ) : (
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button 
                      variant="default" 
                      size="sm"
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      Login
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}


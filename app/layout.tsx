import type { Metadata } from "next"
import { Rajdhani, Orbitron, Bebas_Neue } from "next/font/google"
import "./globals.css"
import { Navbar } from "@/components/layout/navbar"
import FireParticlesWrapper from "@/components/FireParticlesWrapper"

const rajdhani = Rajdhani({ 
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-rajdhani"
})

const orbitron = Orbitron({ 
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-orbitron"
})

const bebasNeue = Bebas_Neue({ 
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bebas"
})

export const metadata: Metadata = {
  title: "Campeonato RAC vs AST",
  description: "Campeonato multigames entre RAC e AST",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${rajdhani.className} ${rajdhani.variable} ${orbitron.variable} ${bebasNeue.variable} bg-dark-texture relative`}>
        <Navbar />
        <main className="min-h-screen pt-16 relative z-[4]">
          {children}
        </main>
        {/* Fire Particles Effect - Por cima do background e da imagem do hero, abaixo dos textos */}
        <div className="fixed inset-0 pointer-events-none bg-transparent" style={{ zIndex: 3 }}>
          <FireParticlesWrapper />
        </div>
      </body>
    </html>
  )
}


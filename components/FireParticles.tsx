'use client'

import { useCallback } from "react"
// @ts-ignore - react-tsparticles has type issues
import Particles from "react-tsparticles"
import { loadFirePreset } from "tsparticles-preset-fire"

export default function FireParticles() {
  const particlesInit = useCallback(async (engine: any) => {
    await loadFirePreset(engine)
  }, [])

  return (
    // @ts-ignore - react-tsparticles has type issues
    <Particles
      id="tsparticles"
      init={particlesInit}
      options={{
        preset: "fire",
        fullScreen: { enable: false },
        background: { 
          color: {
            value: "transparent"
          },
          opacity: 0
        },
        particles: {
          move: {
            direction: "top",
            enable: true,
            outModes: {
              default: "out"
            },
            speed: {
              min: 0.5,
              max: 2
            }
          },
          number: {
            value: 50,
            density: {
              enable: true,
              area: 800
            }
          }
        },
        detectRetina: true,
        fpsLimit: 120,
        interactivity: {
          detectOn: "window",
          events: {
            onClick: {
              enable: false
            },
            onHover: {
              enable: false
            },
            resize: true
          },
          modes: {
            push: {
              quantity: 0
            },
            repulse: {
              distance: 0
            }
          }
        }
      } as any}
      className="absolute top-0 left-0 w-full h-full z-[2] pointer-events-none"
      style={{
        background: 'transparent',
        backgroundColor: 'transparent'
      }}
    />
  )
}


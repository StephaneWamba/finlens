"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface AudioWaveformProps {
  src: string
  className?: string
  barCount?: number
  barWidth?: number
  barGap?: number
  color?: string
  activeColor?: string
  currentTime?: number
  duration?: number
}

export function AudioWaveform({
  src,
  className,
  barCount = 50,
  barWidth = 3,
  barGap = 2,
  color = "hsl(var(--muted-foreground))",
  activeColor = "hsl(var(--primary))",
  currentTime = 0,
  duration = 0,
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [waveformData, setWaveformData] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!src) {
      // Generate placeholder waveform data
      setWaveformData(Array.from({ length: barCount }, () => Math.random() * 0.5 + 0.3))
      setIsLoading(false)
      return
    }

    const audio = new Audio(src)
    audio.crossOrigin = "anonymous"
    audioRef.current = audio

    const initAudioContext = async () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.8

        const source = audioContext.createMediaElementSource(audio)
        source.connect(analyser)
        analyser.connect(audioContext.destination)

        audioContextRef.current = audioContext
        analyserRef.current = analyser
        sourceRef.current = source

        // Generate waveform data from audio
        const generateWaveformData = () => {
          const bufferLength = analyser.frequencyBinCount
          const dataArray = new Uint8Array(bufferLength)
          analyser.getByteFrequencyData(dataArray)

          // Normalize and sample data for bars
          const samples: number[] = []
          const step = Math.floor(bufferLength / barCount)

          for (let i = 0; i < barCount; i++) {
            const index = i * step
            const value = dataArray[index] / 255
            samples.push(value)
          }

          setWaveformData(samples)
        }

        audio.addEventListener("loadedmetadata", () => {
          setIsLoading(false)
          generateWaveformData()
        })

        audio.addEventListener("canplay", () => {
          setIsLoading(false)
          generateWaveformData()
        })

        audio.load()
      } catch (error) {
        console.error("Failed to initialize audio context:", error)
        setIsLoading(false)
        // Fallback: generate random waveform data
        setWaveformData(Array.from({ length: barCount }, () => Math.random() * 0.5 + 0.3))
      }
    }

    initAudioContext()

    return () => {
      audio.pause()
      audio.src = ""
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [src, barCount])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || waveformData.length === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    const totalBarWidth = barWidth + barGap
    const totalWidth = barCount * totalBarWidth - barGap
    const startX = (width - totalWidth) / 2

    ctx.clearRect(0, 0, width, height)

    const progress = duration > 0 ? currentTime / duration : 0
    const activeBarIndex = Math.floor(progress * barCount)

    waveformData.forEach((value, index) => {
      const x = startX + index * totalBarWidth
      const barHeight = Math.max(value * height * 0.8, 2) // Minimum height of 2px
      const y = (height - barHeight) / 2

      const isActive = index <= activeBarIndex
      ctx.fillStyle = isActive ? activeColor : color

      // Draw bar with rounded top
      ctx.beginPath()
      ctx.roundRect(x, y, barWidth, barHeight, 2)
      ctx.fill()
    })
  }, [waveformData, currentTime, duration, barCount, barWidth, barGap, color, activeColor])

  if (isLoading && waveformData.length === 0) {
    // Show placeholder bars
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {Array.from({ length: barCount }).map((_, i) => (
          <div
            key={i}
            className="bg-muted rounded-sm animate-pulse"
            style={{
              width: `${barWidth}px`,
              height: `${Math.random() * 40 + 20}px`,
              animationDelay: `${i * 20}ms`,
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className={cn("w-full", className)}
      width={300}
      height={60}
      style={{ maxWidth: "100%" }}
    />
  )
}


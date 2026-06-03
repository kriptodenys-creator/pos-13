import { useRef, useState, useCallback } from "react"

export function useAudioEffects() {
  const audioContextRef = useRef<AudioContext | null>(null)
  const [audioInitialized, setAudioInitialized] = useState(false)

  const initAudio = useCallback(async () => {
    if (audioContextRef.current || audioInitialized) return
    
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) return
      
      audioContextRef.current = new AudioContextClass()
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume()
      }
      
      setAudioInitialized(true)
      console.log('Audio context initialized')
    } catch (error) {
      console.log('Audio initialization failed:', error)
    }
  }, [audioInitialized])

  const playSound = useCallback(async (type: 'add' | 'remove' | 'complete' | 'click' | 'error') => {
    try {
      if (!audioInitialized) {
        await initAudio()
      }
      
      const audioContext = audioContextRef.current
      if (!audioContext || audioContext.state !== 'running') {
        if (audioContext && audioContext.state === 'suspended') {
          await audioContext.resume()
        } else {
          return
        }
      }
      
      const createBeep = (frequency: number, duration: number, volume: number = 0.1, delay: number = 0) => {
        const startTime = audioContext.currentTime + delay
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        
        oscillator.frequency.setValueAtTime(frequency, startTime)
        oscillator.type = 'sine'
        
        gainNode.gain.setValueAtTime(0, startTime)
        gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01)
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
        
        oscillator.start(startTime)
        oscillator.stop(startTime + duration)
      }

      switch (type) {
        case 'add':
          createBeep(800, 0.15, 0.15, 0)
          createBeep(1000, 0.1, 0.1, 0.1)
          break
        case 'remove':
          createBeep(400, 0.2, 0.1, 0)
          break
        case 'complete':
          createBeep(523, 0.2, 0.15, 0)
          createBeep(659, 0.2, 0.15, 0.15)
          createBeep(784, 0.3, 0.15, 0.3)
          break
        case 'click':
          createBeep(600, 0.05, 0.05, 0)
          break
        case 'error':
          createBeep(200, 0.3, 0.1, 0)
          break
      }
    } catch (error) {
      console.log('Sound playback failed:', error)
    }
  }, [audioInitialized, initAudio])

  const cleanup = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
    }
  }, [])

  return {
    initAudio,
    playSound,
    cleanup
  }
}

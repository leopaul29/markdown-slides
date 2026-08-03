declare module 'reveal.js/dist/reveal.esm.js' {
  export interface RevealIndices {
    h: number
    v: number
  }

  export interface RevealSlideEvent {
    indexh: number
    indexv: number
    currentSlide: HTMLElement
  }

  export interface RevealApi {
    initialize(config?: Record<string, unknown>): Promise<void>
    destroy(): void
    sync(): void
    layout(): void
    slide(h: number, v?: number, f?: number): void
    next(): void
    prev(): void
    getIndices(): RevealIndices
    getTotalSlides(): number
    isOverview(): boolean
    toggleOverview(override?: boolean): void
    on(type: string, listener: (event: RevealSlideEvent) => void): void
    off(type: string, listener: (event: RevealSlideEvent) => void): void
  }

  const Reveal: new (element: HTMLElement, config?: Record<string, unknown>) => RevealApi
  export default Reveal
}

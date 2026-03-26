declare global {
  interface Window {
    infraPanel?: { version: string; platform: string; restart?: () => void }
  }
}

export {}

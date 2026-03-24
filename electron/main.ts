import { app, BrowserWindow } from 'electron'
import path from 'path'
import { spawn, ChildProcess } from 'child_process'

let mainWindow: BrowserWindow | null = null
let backendProcess: ChildProcess | null = null

function startBackend() {
  const projectRoot = path.join(__dirname, '..', '..')
  backendProcess = spawn('bash', ['-c', `source ${projectRoot}/venv/bin/activate && uvicorn backend.main:app --port 8000`], {
    cwd: projectRoot, env: { ...process.env }, stdio: 'pipe'
  })
  backendProcess.stdout?.on('data', (d: Buffer) => console.log('[Backend]', d.toString()))
  backendProcess.stderr?.on('data', (d: Buffer) => console.error('[Backend]', d.toString()))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600, title: 'InfraPanel',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.js') }
  })
  mainWindow.loadURL('http://localhost:3000')
  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(async () => {
  startBackend()
  await new Promise(r => setTimeout(r, 2500))
  createWindow()
})

app.on('window-all-closed', () => { backendProcess?.kill(); app.quit() })
app.on('before-quit', () => { backendProcess?.kill() })

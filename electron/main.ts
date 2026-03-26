import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { spawn, ChildProcess } from 'child_process'

const PID_FILE = '/tmp/infra-panel.pid'

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

ipcMain.on('app:restart', () => {
  if (backendProcess) {
    backendProcess.once('exit', () => {
      app.relaunch()
      app.exit(0)
    })
    backendProcess.kill()
    // Fallback: if process doesn't exit within 3s, force quit
    setTimeout(() => {
      app.relaunch()
      app.exit(0)
    }, 3000)
  } else {
    app.relaunch()
    app.exit(0)
  }
})

app.whenReady().then(async () => {
  // Write our PID so we can be killed without affecting other Electron apps (e.g. Discord)
  fs.writeFileSync(PID_FILE, String(process.pid))
  startBackend()
  await new Promise(r => setTimeout(r, 2500))
  createWindow()
})

app.on('window-all-closed', () => {
  backendProcess?.kill()
  try { fs.unlinkSync(PID_FILE) } catch {}
  app.quit()
})
app.on('before-quit', () => {
  backendProcess?.kill()
  try { fs.unlinkSync(PID_FILE) } catch {}
})

import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import path from 'path'

const REMOTE_URL = 'http://45.13.227.179:8001'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600, title: 'InfraPanel',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.js') }
  })
  mainWindow.loadURL(REMOTE_URL)
  mainWindow.on('closed', () => { mainWindow = null })
}

ipcMain.on('app:restart', () => {
  // process.env.APPIMAGE is set by the AppImage runtime to the .AppImage file path
  const execPath = process.env.APPIMAGE ?? app.getPath('exe')
  app.relaunch({ execPath, args: process.argv.slice(1) })
  app.exit(0)
})

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})

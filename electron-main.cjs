const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const { autoUpdater } = require('electron-updater');
const login = require('electron-log');

// Log ayarları (Hata ayıklama için)
autoUpdater.logger = login;
autoUpdater.logger.transports.file.level = 'info';
console.log('[App] Başlatılıyor...');

let mainWindow;
let serverProcess;

function startServer() {
  // server.cjs'i ayrı bir process olarak başlatıyoruz
  serverProcess = fork(path.join(__dirname, 'server.cjs'));
  
  serverProcess.on('message', (msg) => {
    console.log('[SUNUCU]:', msg);
  });

  serverProcess.on('error', (err) => {
    console.error('[SUNUCU HATASI]:', err);
  });
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width,
    height,
    fullscreen: true, // Tam ekran başlat
    autoHideMenuBar: true, // Menü çubuğunu gizle
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, 'public/vite.svg') // Varsa ikon yolu
  });

  // Geliştirme aşamasında Vite dev server'ı yükle, 
  // Production'da ise build edilmiş index.html'i yükle
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools(); // Geliştirici araçlarını açmak istersen
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', () => {
  startServer(); // Sunucuyu başlat
  createWindow(); // Pencereyi oluştur

  // Otomatik güncelleme kontrolü
  autoUpdater.checkForUpdatesAndNotify().catch(err => {
    console.error('[GÜNCELLEME HATASI]:', err);
  });
});

// Güncelleme Eventleri
autoUpdater.on('update-available', () => {
  console.log('[GÜNCELLEME]: Yeni sürüm bulundu, indiriliyor...');
});

autoUpdater.on('update-downloaded', () => {
  console.log('[GÜNCELLEME]: Yeni sürüm indirildi. Uygulama yeniden başlatıldığında kurulacak.');
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    if (serverProcess) serverProcess.kill(); // Pencere kapandığında sunucuyu da kapat
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

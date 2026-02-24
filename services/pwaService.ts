// PWA Service Worker 注册
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    });
  }
}

// 监听PWA安装事件
export function listenForInstallPrompt() {
  let deferredPrompt: any;
  
  window.addEventListener('beforeinstallprompt', (e) => {
    // 防止Chrome 67及更早版本自动显示安装提示
    e.preventDefault();
    // 存储事件以便稍后触发
    deferredPrompt = e;
    
    // 可以在这里显示自定义的安装按钮
    console.log('PWA安装提示已准备就绪');
    
    // 如果需要，可以显示自定义安装UI
    showInstallPromotion();
  });

  // 监听应用安装状态
  window.addEventListener('appinstalled', () => {
    console.log('PWA已安装');
    // 隐藏安装按钮等UI
    hideInstallPromotion();
  });

  function showInstallPromotion() {
    // 这里可以添加自定义的安装提示UI
    console.log('显示PWA安装提示');
  }

  function hideInstallPromotion() {
    // 隐藏安装提示UI
    console.log('隐藏PWA安装提示');
  }
}

// 检查显示模式（浏览器/独立应用）
export function checkDisplayMode() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isInWebAppiOS = (window.navigator as any).standalone;
  
  if (isStandalone || isInWebAppiOS) {
    console.log('应用正在以独立模式运行');
    return 'standalone';
  } else {
    console.log('应用正在浏览器中运行');
    return 'browser';
  }
}

// 初始化PWA功能
export function initPWA() {
  registerServiceWorker();
  listenForInstallPrompt();
  checkDisplayMode();
}
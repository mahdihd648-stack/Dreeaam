// ۰.۱۲ — service worker پایه: فقط رجیستر می‌شه، فعلاً هیچ کشی انجام نمی‌ده.
// منطق کش (برای کارکرد آفلاین) در فازهای بعدی، در صورت نیاز، اینجا اضافه می‌شه.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

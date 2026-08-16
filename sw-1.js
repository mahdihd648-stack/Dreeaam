// Service worker — کاملاً یک‌بارمصرف (self-unregistering).
//
// این اپ یه اپِ نیتیوِ Capacitorـه: index.html/app.js از قبل داخلِ خودِ APK باندل شدن و
// بدونِ هیچ کشی هم آفلاین در دسترسن. کشِ app-shell که این فایل قبلاً انجام می‌داد
// (stale-while-revalidate رویِ index.html/app.js/manifest/آیکون‌ها) هیچ فایده‌ی
// اضافه‌ای نداشت — و چون Service Worker registration + Cache Storage با آپدیتِ
// این‌جاییِ APK (نصبِ نسخه‌ی جدید رویِ قدیم، بدونِ حذف/کلیردیتا) پاک نمی‌شه، این کش
// نسخه‌ی قدیمیِ app.js رو به‌جایِ فایلِ تازه‌ی نیتیو سرو می‌کرد و باعثِ به‌هم‌ریختنِ
// لِی‌اوت/اسکرولِ بعدِ هر آپدیت می‌شد.
//
// این نسخه دیگه هیچی کش نمی‌کنه: فقط یه‌بار خودشو (و هر کشِ قدیمی‌ای که از نسخه‌های
// قبل مونده) پاک می‌کنه، صفحه‌ی بازِ فعلی رو یه‌بار رفرش می‌کنه تا از دستِ نسخه‌ی
// استیل خلاص بشه، و بعدش دیگه کاری به کارِ هیچ fetchـی نداره. __SW_CACHE_VERSION__
// فقط برایِ اینه که هر ریلیز، بایتِ این فایل عوض بشه تا مرورگر/وب‌ویو حتماً
// آپدیتش رو تشخیص بده.
// build: __SW_CACHE_VERSION__

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clientsList) => {
        clientsList.forEach((client) => {
          try { client.navigate(client.url); } catch (e) { /* بی‌خیال، دفعه‌ی بعد خودش درست می‌شه */ }
        });
      })
  );
});

// دیگه هیچ fetch handler ای نداریم — هر درخواستی مستقیم و بدون واسطه به شبکه/فایلِ
// نیتیو می‌ره، دقیقاً همون چیزی که یه اپِ Capacitorـی از اول لازم داشت.

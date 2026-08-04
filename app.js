/* ==================== پنل تشخیصی سراسری — همون اول فایل ====================
   عمداً اولین چیزیه که تو کل app.js اجرا می‌شه. یه پنل کوچیک گوشه‌ی پایین صفحه
   می‌سازه و از همین لحظه، سه چیز رو مستقیم رو صفحه (بدون نیاز به کامپیوتر یا
   chrome://inspect) ثبت می‌کنه:
     ۱) هر throw مدیریت‌نشده، هرجای کل فایل، حتی خیلی قبل‌تر از بخش خرید —
        چون اگه یه خطای کاملاً بی‌ربط جایی وسط فایل بترکه، خودِ اجرای اسکریپت از
        همونجا متوقف می‌شه و کدهای بعدش (از جمله ثبتِ addEventListener رو دکمه‌ی
        خرید) اصلاً هیچ‌وقت اجرا نمی‌شن — همون حالتی که از بیرون دقیقاً شبیه
        «دکمه هیچ کاری نمی‌کنه» به‌نظر می‌رسه، بدون هیچ توست یا خطایی.
     ۲) هر Promise ردشده‌ی مدیریت‌نشده (unhandled rejection).
     ۳) هر console.error، هرجای فایل — نه فقط بخش خرید.
   خودِ تابع‌های iabDebugPanel/iabDebugStep/iabDebugReset پایین‌تر تو همین بخش
   تعریف شدن و از همه‌جای بقیه‌ی فایل (بخش خرید و هرجای دیگه) صداشون می‌زنیم.
   بعد از رفع مشکل، برای برداشتنش کافیه IAB_DEBUG_PANEL رو false کنی، یا کلاً
   از اول این بلاک تا همینجا رو حذف کنی. */
const IAB_DEBUG_PANEL = true;
function iabDebugPanel(){
  let panel = document.getElementById('iabDebugPanel');
  if(!panel){
    panel = document.createElement('div');
    panel.id = 'iabDebugPanel';
    panel.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:999999;background:#111;color:#0f0;font:11px/1.7 monospace;padding:10px 12px;border-radius:10px;max-height:46vh;overflow:auto;direction:ltr;text-align:left;box-shadow:0 4px 24px rgba(0,0,0,.5);';
    const closeBtn = document.createElement('div');
    closeBtn.textContent = '✕ بستن پنل تشخیصی';
    closeBtn.style.cssText = 'direction:rtl;text-align:center;color:#f66;font:12px sans-serif;margin-bottom:6px;cursor:pointer;padding:4px;border-bottom:1px solid #333;';
    closeBtn.onclick = ()=>{ panel.style.display = 'none'; };
    panel.appendChild(closeBtn);
    (document.body || document.documentElement).appendChild(panel);
  }
  return panel;
}
function iabDebugStep(label, ok, detail){
  if(!IAB_DEBUG_PANEL) return;
  try{
    const panel = iabDebugPanel();
    panel.style.display = 'block';
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:5px;white-space:pre-wrap;word-break:break-all;';
    const icon = ok === null ? '⏳' : (ok ? '✅' : '❌');
    row.textContent = icon + ' ' + label + (detail !== undefined ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '');
    panel.appendChild(row);
    panel.scrollTop = panel.scrollHeight;
  }catch(_){ /* خودِ پنل تشخیصی هیچ‌وقت نباید چیزی رو خراب کنه */ }
}
function iabDebugReset(){
  if(!IAB_DEBUG_PANEL) return;
  try{
    const panel = iabDebugPanel();
    panel.querySelectorAll('div:not(:first-child)').forEach(el => el.remove());
    panel.style.display = 'block';
  }catch(_){}
}
// اگه document.body هنوز آماده نباشه (اسکریپت تو <head> بدون defer باشه)، اولین
// تلاش برای ساختن پنل رو به بعد از لود شدن DOM موکول می‌کن.
document.addEventListener('DOMContentLoaded', function(){ try{ iabDebugPanel(); }catch(_){} });

window.addEventListener('error', function(e){
  iabDebugStep('خطای جاوااسکریپت', false, (e && e.message) + ' — ' + (e && e.filename) + ':' + (e && e.lineno) + ':' + (e && e.colno));
});
window.addEventListener('unhandledrejection', function(e){
  const reason = e && e.reason;
  iabDebugStep('Promise ردشده‌ی مدیریت‌نشده', false, (reason && (reason.message || reason.toString && reason.toString())) || String(reason));
});
(function(){
  const _origConsoleError = console.error;
  console.error = function(){
    try{
      const parts = Array.prototype.slice.call(arguments).map(function(a){
        if(typeof a === 'string') return a;
        try{ return JSON.stringify(a); }catch(_){ return String(a); }
      });
      iabDebugStep('console.error', false, parts.join(' '));
    }catch(_){}
    return _origConsoleError.apply(console, arguments);
  };
})();

/* ================= window.storage compatibility shim =================
   window.storage.get/set/delete/list is an API that only exists inside
   Claude.ai's artifact sandbox. On a real, independently-hosted site it
   doesn't exist at all — so if it's missing, we polyfill it here with a
   localStorage-backed version that has the exact same interface. Every
   other place in this file that calls window.storage.* keeps working
   unchanged, whether running inside Claude or on a real domain.
   Note: localStorage has a per-origin quota (commonly ~5-10MB depending
   on the browser). The checklist JSON itself is small, but the selfie
   photos (stored as base64 images) can add up over a long journey. If
   that ever becomes a real problem, this shim is the one place to swap
   out for an IndexedDB-backed version instead — nothing else would need
   to change. */
if(!window.storage){
  const LS_PREFIX = 'checklistApp:';
  window.storage = {
    async get(key, shared){
      const raw = localStorage.getItem(LS_PREFIX+key);
      if(raw===null){ const err = new Error('Key not found: '+key); err.code='NOT_FOUND'; throw err; }
      return { key, value: raw, shared: !!shared };
    },
    async set(key, value, shared){
      try{ localStorage.setItem(LS_PREFIX+key, value); }
      catch(err){ console.error('localStorage quota/write error', err); return null; }
      return { key, value, shared: !!shared };
    },
    async delete(key, shared){
      localStorage.removeItem(LS_PREFIX+key);
      return { key, deleted:true, shared: !!shared };
    },
    async list(prefix, shared){
      const keys = [];
      for(let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i);
        if(k && k.indexOf(LS_PREFIX)===0){
          const realKey = k.slice(LS_PREFIX.length);
          if(!prefix || realKey.indexOf(prefix)===0) keys.push(realKey);
        }
      }
      return { keys, prefix, shared: !!shared };
    }
  };
}

/* ================= Sound effects (short, synthesized on-device via Web Audio API —
   no audio files, nothing downloaded, so there's no copyright concern and nothing to
   regenerate; each effect is a small fixed function that renders the same couple of
   tones every time it's called). Respects the user's on/off + volume choice from
   Settings → Appearance. Kept deliberately subtle/short so the app still feels
   professional rather than like a game. ================= */
let sfxCtx = null, sfxMaster = null;
function sfxAllowed(){ return !(typeof storeData!=='undefined' && storeData && storeData.sfxEnabled===false); }
function sfxVolumeLevel(){
  const v = (typeof storeData!=='undefined' && storeData && storeData.sfxVolume!==undefined) ? storeData.sfxVolume : 10;
  return Math.max(0, Math.min(100, v)) / 100 * 0.55; // headroom so effects stay subtle even at 100%
}
function sfxEnsureCtx(){
  if(!sfxAllowed()) return null;
  try{
    if(!sfxCtx){
      sfxCtx = new (window.AudioContext||window.webkitAudioContext)();
      sfxMaster = sfxCtx.createGain();
      sfxMaster.connect(sfxCtx.destination);
    }
    if(sfxCtx.state==='suspended') sfxCtx.resume().catch(()=>{});
    sfxMaster.gain.value = sfxVolumeLevel();
    return sfxCtx;
  }catch(e){ return null; }
}
// A single short tone with a quick attack/decay envelope (a "blip").
function sfxTone(freq, dur, type, delay, endFreq){
  const ctx = sfxEnsureCtx(); if(!ctx) return;
  const t0 = ctx.currentTime + (delay||0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if(endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0+dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(1, t0+Math.min(0.02,dur*0.25));
  g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
  osc.connect(g); g.connect(sfxMaster);
  osc.start(t0); osc.stop(t0+dur+0.03);
}
// Filtered noise burst (used for the whoosh/spin sound).
function sfxNoiseSweep(dur, fromHz, toHz){
  const ctx = sfxEnsureCtx(); if(!ctx) return;
  const t0 = ctx.currentTime;
  const buffer = ctx.createBuffer(1, Math.max(1,Math.floor(ctx.sampleRate*dur)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0;i<data.length;i++) data[i] = Math.random()*2-1;
  const noise = ctx.createBufferSource(); noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass'; filter.Q.value = 0.9;
  filter.frequency.setValueAtTime(fromHz, t0);
  filter.frequency.exponentialRampToValueAtTime(toHz, t0+dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(1, t0+dur*0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
  noise.connect(filter); filter.connect(g); g.connect(sfxMaster);
  noise.start(t0); noise.stop(t0+dur+0.03);
}
// Ordinary touches: a soft, warm "tock" — gentle attack, slight downward
// pitch glide, and a lowpass filter to round off any harsh edge. Deliberately
// mellower than the other cues below, since this one plays constantly.
function sfxTap(){
  const ctx = sfxEnsureCtx(); if(!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(620, t0);
  osc.frequency.exponentialRampToValueAtTime(420, t0+0.06);
  filter.type = 'lowpass';
  filter.frequency.value = 1400;
  filter.Q.value = 0.3;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.85, t0+0.014);
  g.gain.exponentialRampToValueAtTime(0.0001, t0+0.065);
  osc.connect(filter); filter.connect(g); g.connect(sfxMaster);
  osc.start(t0); osc.stop(t0+0.09);
}
function sfxPop(){ sfxTone(520, 0.08, 'sine', 0, 980); }                   // something appears/gets checked
function sfxError(){ sfxTone(230, 0.1, 'square'); sfxTone(170, 0.13, 'square', 0.1); } // something went wrong
function sfxSuccess(){ sfxTone(660,0.08,'sine'); sfxTone(880,0.08,'sine',0.075); sfxTone(1320,0.15,'sine',0.15); } // a win / cash-register-ish chime
function sfxWhoosh(){ sfxNoiseSweep(0.28, 350, 2200); }                    // spin / zoom transition
// A single warm, rounded tone: lowpass-filtered sine with a gentle attack/release, used for
// the calm entry/exit chimes below (softer and slower than sfxTone's plain "blip" envelope).
function sfxSoftTone(freq, dur, delay){
  const ctx = sfxEnsureCtx(); if(!ctx) return;
  const t0 = ctx.currentTime + (delay||0);
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  filter.type = 'lowpass';
  filter.frequency.value = 2200;
  filter.Q.value = 0.35;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.9, t0+Math.min(0.06,dur*0.22));
  g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
  osc.connect(filter); filter.connect(g); g.connect(sfxMaster);
  osc.start(t0); osc.stop(t0+dur+0.05);
}
// Soft ascending 3-note chime — plays once the splash intro finishes and the app opens.
function sfxAppEnter(){ sfxSoftTone(523.25,0.5,0); sfxSoftTone(659.25,0.55,0.16); sfxSoftTone(783.99,0.75,0.34); } // C5-E5-G5
// Soft descending 3-note chime — mirror of the entry cue, played on the exit-confirm screen.
function sfxAppExit(){ sfxSoftTone(783.99,0.45,0); sfxSoftTone(659.25,0.5,0.15); sfxSoftTone(523.25,0.7,0.32); } // G5-E5-C5

// Generic touch feedback: a soft tap on ordinary controls (tabs, menu items,
// accordions, segmented buttons, plain buttons). Elements that already trigger a
// more specific effect elsewhere (checklist rows, wheel spins, etc.) aren't
// buttons/menu items, so there's no double-sound.
document.addEventListener('click', (e)=>{
  const el = e.target.closest('.tab-btn, .side-menu-item, .settings-group-head, .theme-swatch, .chat-auth-tab, .subseg button, .seg button, button');
  if(el) sfxTap();
}, true);

/* ---------------- Phase-based evolving tasks ---------------- */
const PHASES = [
  { max:6, key:"p1", name:"مرحله ۱ — پایه‌ریزی", items:[
    "بیدار شدن سر ساعت مشخص",
    "یک لیوان آب بلافاصله بعد بیدار شدن",
    "۱۰-۱۵ دقیقه بیرون از اتاق",
    "وعده صبحانه سر وقت",
    "وعده ناهار سر وقت",
    "وعده شام سر وقت",
    "پیاده‌روی ۱۵-۲۰ دقیقه",
    "یک گفتگوی واقعی با یکی از اطرافیان",
    "خاموش کردن گوشی سر ساعت مشخص شب",
    "یادداشت یک کار کوچیک که درست انجام دادم",
    "دور نگه داشتن گوشی از تخت‌خواب حین خواب",
    "خاموش کردن اعلان‌های غیرضروری گوشی",
    "۵-۱۰ دقیقه کتاب یا مطلب مفید خوندن"
  ]},
  { max:15, key:"p2", name:"مرحله ۲ — تثبیت", items:[
    "بیدار شدن سر ساعت مشخص، بدون تأخیر زیاد",
    "یک لیوان آب صبح",
    "۲۰-۲۵ دقیقه بیرون از خونه",
    "سه وعده غذایی سر وقت",
    "۲۵-۳۰ دقیقه پیاده‌روی یا ورزش سبک",
    "یک فعالیت اجتماعی واقعی (تماس یا دیدار حضوری)",
    "محدود کردن بازی/گوشی به زیر ۳ ساعت آزاد",
    "خاموش کردن گوشی حداقل نیم ساعت قبل خواب",
    "یادداشت روزانه",
    "کم‌نور کردن محیط و قطع صفحه‌نمایش ۳۰-۶۰ دقیقه قبل خواب",
    "آماده کردن وسایل/برنامه‌ی فردا از شب قبل",
    "یه بازه‌ی مشخص برای چک کردن گوشی، نه چک مداوم"
  ]},
  { max:30, key:"p3", name:"مرحله ۳ — رشد", items:[
    "بیدار شدن سر ساعت مشخص، بدون کم و زیاد",
    "۳۰ دقیقه فعالیت بدنی (پیاده‌روی سریع یا باشگاه)",
    "سه وعده غذایی منظم و متنوع",
    "یک هدف کوچیک کاری/شخصی امروز تعریف و انجام دادم",
    "حداقل یک تعامل اجتماعی معنادار",
    "محدود کردن بازی/گوشی به زیر ۲ ساعت آزاد",
    "خواب قبل از ساعت ۱۲",
    "یادداشت روزانه با تمرکز روی نقطه قوت امروز",
    "قرار گرفتن در معرض نور طبیعی صبح",
    "یه مرور ۱۰ دقیقه‌ای از هفته: چی جواب داد؟",
    "پاداش دادن به خودم برای ثبات، نه فقط کمال"
  ]},
  { max:60, key:"p4", name:"مرحله ۴ — تقویت", items:[
    "بیدار شدن ثابت، بدون نیاز به یادآوری",
    "جلسه ورزش واقعی حداقل ۳۰-۴۵ دقیقه",
    "برنامه غذایی منظم روزانه",
    "پیشرفت در یک هدف بزرگ‌تر (کاری/تحصیلی/شخصی)",
    "حفظ ارتباط اجتماعی فعال",
    "گوشی/بازی فقط در زمان مشخص و محدود",
    "رعایت زمان خواب سالم",
    "مرور کوتاه پیشرفت این هفته",
    "حفظ ثبات خواب حتی آخر هفته‌ها",
    "تمرکز روی رفتارهای روزانه‌ام، نه فقط نتیجه‌ی نهایی",
    "بازبینی و تنظیم برنامه‌ام هر ۲-۴ هفته"
  ]},
  { max:90, key:"p5", name:"مرحله ۵ — نسخه‌ی نهایی", items:[
    "روتین صبح پایدار و خودکار",
    "ورزش منظم به‌عنوان بخشی از روزت",
    "تغذیه منظم و متعادل",
    "پیگیری اهداف بلندمدتت",
    "ارتباطات اجتماعی سالم و مستمر",
    "کنترل کامل روی زمان صفحه",
    "خواب باکیفیت و منظم",
    "یادداشت رشدی که این هفته کردی",
    "یه نماد قابل‌مشاهده از پیشرفتم رو به‌روز نگه می‌دارم",
    "برنامه‌ریزی از قبل برای موقعیت‌های پرخطر پیش رو"
  ]},
  { max:Infinity, key:"peak", name:"به قله رسیدی 🏔️", items:[
    "روتین صبح پایدار و خودکار",
    "ورزش منظم به‌عنوان بخشی از روزت",
    "تغذیه منظم و متعادل",
    "پیگیری اهداف بلندمدتت",
    "ارتباطات اجتماعی سالم و مستمر",
    "کنترل کامل روی زمان صفحه",
    "خواب باکیفیت و منظم",
    "یادداشت رشدی که این هفته کردی",
    "یه نماد قابل‌مشاهده از پیشرفتم رو به‌روز نگه می‌دارم",
    "برنامه‌ریزی از قبل برای موقعیت‌های پرخطر پیش رو"
  ]}
];

const BASE_MOMENT_ITEMS = [
  "وقتی حس فرار اومد سراغم، ۵ دقیقه صبر کردم",
  "یه کار جایگزین انجام دادم (دوش، پیاده‌روی، نوشتن، تماس)",
  "اگه برنامه‌ی «اگر-آنگاه» خودمو داشتم، همونو اجرا کردم",
  "به‌جای واکنش خودکار، یه لحظه مکث کردم و آگاهانه انتخاب کردم",
  "دلیل اصلیمو برای این مسیر با خودم مرور کردم",
  "یه پیشرفت کوچیک امروزمو، هر چقدرم ناچیز، به رسمیت شناختم"
];
const BASE_AVOID_ITEMS = [
  "بردن گوشی به تخت‌خواب",
  "سرزنش شدید خودم بابت لغزش",
  "تصمیم «از فردا همه‌چیزو کامل ترک می‌کنم»",
  "نادیده گرفتن سرگیجه یا بی‌اشتهایی",
  "ماندن تنها با این موضوع بدون صحبت با کسی",
  "قرار گرفتن تو موقعیت پرخطر بدون برنامه‌ی از قبل آماده",
  "رد کردن وعده‌های غذایی و خواب به بهانه‌ی مشغله",
  "مقایسه‌ی پیشرفتم با آدم‌های دیگه به‌جای مسیر خودم"
];

/* ================= Personalization engine =================
   Everyone gets the same evidence-informed core habits (sleep,
   hydration, daylight/movement, regular meals, exercise, real
   social contact, screen boundaries, journaling) because these
   apply broadly regardless of the specific habit someone's
   working on. On top of that core, each selected habit/addiction
   contributes its own phase-scaled item, its own avoid-item, and
   shapes the AI prompts, phone limits and nutrition targets — so
   two people with different profiles get visibly different
   programs instead of one fixed checklist for everyone. */
const ADDICTION_LABELS = {
  phone:"گوشی / شبکه‌های اجتماعی", porn:"محرک‌های جنسی / خودارضایی اجباری",
  gaming:"بازی‌های ویدیویی", smoking:"سیگار / دخانیات", alcohol:"الکل",
  binge:"پرخوری یا خوردن هیجانی", sleep:"بی‌نظمی خواب", procrastination:"تعلل و اهمال‌کاری",
  shopping:"خرید وسواسی", nailbiting:"ناخن‌جویدن", anxiety:"اضطراب",
  other:"یه موضوع شخصی دیگه"
};
/* ---- Health/medication self-report tags (onboarding step "سلامت"). This is a light,
   non-clinical flag set: it only ever softens tone/pacing (see getHealthFlags +
   its use in getCoachData/updateWorkoutCoach). It never drives dosing, diagnosis,
   or any drug-specific logic — that would be practicing medicine, which this app
   must not do. 'mood' tags (depression/anxiety/bipolar/ocd) are tracked separately
   from 'other' tags because they're the ones allowed to nudge tone on hard days. ---- */
const HEALTH_TAG_LABELS = {
  depression:"افسردگی", anxiety_h:"اضطراب", bipolar:"دوقطبی", ocd:"وسواس فکری/عملی",
  heart:"بیماری قلبی‌عروقی", diabetes:"دیابت", thyroid:"مشکل تیروئید", migraine:"میگرن/سردرد مزمن",
  back:"کمردرد/مشکل حرکتی", gi:"بیماری گوارشی", asthma:"آسم/مشکل تنفسی", allergy:"حساسیت/آلرژی",
  other:"یه چیز دیگه"
};
const HEALTH_MOOD_TAGS = ['depression','anxiety_h','bipolar','ocd'];
const ADDICTION_ITEMS = {
  porn: ["امروز از محتوای محرک جنسی دوری کردم","وقتی محرک دیدم، به‌جای واکنش خودکار، چند دقیقه صبر کردم",
    "به‌جای دنبال محرک گشتن، یه فعالیت جایگزین از قبل‌برنامه‌ریزی‌شده انجام دادم",
    "این هفته بدون نیاز به یادآوری، از محرک‌ها فاصله گرفتم","این عادت داره بخشی خودکار از روزم می‌شه، نه یه جنگ روزانه",
    "حتی تو یه روز سخت یا استرس‌زا هم این کنترل رو حفظ کردم"],
  smoking: ["مصرف سیگار امروزمو نسبت به روال قبلی ثبت و کم‌تر کردم","یه بار وسوسه‌ی سیگار اومد و بدون کشیدن ازش رد شدم",
    "یه روز کامل با مصرف خیلی کمتر یا صفر سیگار داشتم","این هفته مصرفم محسوس کمتر از هفته‌ی قبل بود",
    "دیگه سیگار اولین واکنشم به استرس نیست","تو یه موقعیت اجتماعی که قبلاً حتماً می‌کشیدم، امروز نکشیدم"],
  alcohol: ["مصرف امروزمو صادقانه ثبت کردم","یه موقعیت اجتماعی داشتم و بدون نوشیدن الکل ازش لذت بردم",
    "یه روز کامل بدون الکل رو تجربه کردم","این هفته مصرفم محسوس کمتر از هفته‌ی قبل بود",
    "دیگه برای آروم شدن اول سراغ الکل نمی‌رم","حتی تو یه شب سخت هم بدون الکل از پسش براومدم"],
  gaming: ["زمان بازی امروز رو از قبل مشخص کردم و بهش پایبند موندم","بازی رو به یه بازه‌ی مشخص و محدود از روز منتقل کردم",
    "یه روز بدون بازی رو تجربه کردم و به‌جاش یه کار دیگه کردم","بازی دیگه اولین کاری نیست که سراغش می‌رم وقتی بیکارم",
    "بازی برام یه سرگرمی کنترل‌شده‌ست، نه یه فرار روزانه","حتی تو یه روز پرحوصله یا بیکار هم به سقف زمانی بازی پایبند موندم"],
  binge: ["قبل از خوردن به‌خاطر حس بد، یه لحظه مکث کردم و پرسیدم واقعاً گرسنمه؟","به‌جای خوردن هیجانی، یه واکنش جایگزین امتحان کردم",
    "وعده‌هامو بدون حواس‌پرتی گوشی/تلویزیون خوردم","این هفته کمتر به‌خاطر استرس یا خلق بد پرخوری کردم",
    "غذا خوردنم بیشتر بر اساس گرسنگی واقعیه، نه احساسات","تو یه روز پراسترس هم بدون پرخوری از پسش براومدم"],
  sleep: ["امشب حداقل نیم ساعت زودتر از معمول به رختخواب رفتم","یه ساعت مشخص برای خواب تعیین کردم و بهش نزدیک موندم",
    "قبل خواب گوشی رو کنار گذاشتم و یه کار آرامش‌بخش انجام دادم","این هفته ساعت خوابم نسبت به قبل باثبات‌تر بود",
    "خوابیدن سرساعت دیگه نیاز به تلاش نداره","حتی یه شب پراسترس یا شلوغ هم ساعت خوابمو حفظ کردم"],
  procrastination: ["سخت‌ترین کار امروزمو اول صبح شروع کردم، حتی کوچیک","یه کار مهم عقب‌افتاده رو امروز جلو بردم",
    "یه هدف مشخص روزانه تعیین کردم و تا انتها پیش بردمش","این هفته کمتر کارامو به لحظه‌ی آخر موکول کردم",
    "شروع کردن کارها دیگه اونقدر سخت نیست که قبلاً بود","حتی سخت‌ترین و کسل‌کننده‌ترین کارمم رو امروز بدون معطلی شروع کردم"],
  shopping: ["قبل از خرید، ۱۰ دقیقه صبر کردم و پرسیدم واقعاً لازمه؟","اپ‌های خرید رو از صفحه‌ی اول گوشیم برداشتم",
    "یه روز کامل بدون خرید غیرضروری رو تجربه کردم","این هفته خرید تفننی‌ام محسوس کمتر از قبل بود",
    "دیگه برای پر کردن یه حس خالی، اول سراغ خرید نمی‌رم","حتی وسط یه تخفیف یا پیشنهاد وسوسه‌انگیز هم به لیست خریدم پایبند موندم"],
  nailbiting: ["دقیقاً ثبت کردم کِی، کجا و با چه حسی شروع به جویدن ناخن می‌کنم (آموزش آگاهی)",
    "به‌محض اولین نشونه‌ی هشدار (کشش/ناهمواری لبه‌ی ناخن)، به‌جاش مشت کردم یا یه فیجت تو دستم گرفتم",
    "از لاک تلخ‌مزه یا ناخن کوتاه و صاف استفاده کردم تا جویدن سخت‌تر بشه",
    "وقتی استرس یا بی‌حوصلگی محرک جویدن بود، به‌جاش یه تکنیک آرامش‌بخش (نفس عمیق، فشردن یه توپ استرس) امتحان کردم",
    "دیگه نیازی به یادآوری مداوم ندارم؛ دستام خودکار از دهنم دور می‌مونن",
    "حتی تو یه موقعیت پراسترس (امتحان، جلسه، ترافیک) هم دستام سمت دهنم نرفت"],
  anxiety: ["افکار نگران‌کننده‌ی امروزمو بدون قضاوت تو یه دفترچه نوشتم",
    "وقتی اضطراب اومد سراغم، یه تکنیک تنفسی (مثلاً ۴ ثانیه دم، ۷ ثانیه نگه‌داشتن، ۸ ثانیه بازدم) امتحان کردم",
    "یکی از افکار نگران‌کننده‌ام رو نوشتم و شواهد موافق و مخالفش رو کنار هم گذاشتم",
    "قبل از یه موقعیت که معمولاً اضطرابم می‌ده، از قبل یه برنامه‌ی آرامش‌بخش آماده داشتم",
    "اضطراب دیگه کنترل کل روزمو دست نمی‌گیره؛ باهاش خیلی آروم‌تر کنار میام",
    "حتی تو یه روز پراضطراب هم از تکنیک آرام‌سازیم به‌موقع استفاده کردم"],
  other: ["امروز یه قدم کوچیک در مسیر کنترل «{X}» برداشتم","وقتی وسوسه‌ی «{X}» اومد سراغم، یه فعالیت جایگزین انجام دادم",
    "یه روز کامل با کنترل بهتر روی «{X}» داشتم","این هفته پیشرفت محسوسی نسبت به «{X}» داشتم",
    "کنترل «{X}» داره برام عادی و خودکار می‌شه","حتی تو سخت‌ترین موقعیت‌ها هم رو کنترل «{X}» موندم"]
};
const ADDICTION_AVOID_EXTRA = {
  phone:["چک کردن گوشی به محض بیدار شدن","اسکرول بی‌هدف موقع بی‌حوصلگی، بدون هیچ هدف مشخصی","نگه داشتن اعلان‌های غیرضروری روشن که مدام حواسمو پرت کنن","بردن گوشی به هر اتاق و هر موقعیت، حتی وقتی لازم نیست"],
  porn:["دنبال کردن حساب‌ها یا سایت‌های محرک","باز گذاشتن مرورگر تو حالت ناشناس برای «فقط یه نگاه»","ذخیره کردن محتوای محرک برای «بعداً»","قرار گرفتن تو محیط یا لحظه‌ای که قبلاً همیشه به محرک ختم می‌شده"],
  smoking:["نگه داشتن سیگار در دسترس آسان","قبول کردن سیگار تعارفی از دیگران","رفتن به مکان همیشگی سیگار کشیدن بدون برنامه‌ی جایگزین","جبران ترک سیگار با محدود کردن شدید غذا به‌جای تغذیه و تحرک منظم"],
  alcohol:["نگه داشتن نوشیدنی الکلی در دسترس آسان","قبول دعوت به جمع‌های الکل‌محور بدون برنامه‌ی قبلی","توجیه «فقط یه لیوان» وقتی قبلاً جواب نداده","رفتن به مکان‌های مرتبط با نوشیدن، مخصوصاً تو هفته‌های اول"],
  gaming:["باز گذاشتن بازی به‌عنوان تب پس‌زمینه برای «فقط یه نگاه»","نصب دوباره‌ی بازی‌ای که قبلاً به‌خاطرش حذفش کرده بودم","بازی کردن بدون تایمر یا سقف زمانی مشخص","جبران یه روز کم‌بازی با یه روز بازی افراطی"],
  binge:["خرید و انبار کردن تنقلات پرکالری برای موقع استرس","غذا خوردن جلوی گوشی یا تلویزیون بدون توجه به سیری","گرسنه موندن طولانی که به پرخوری ختم می‌شه","نگه داشتن بسته‌ی بزرگ تنقلات به‌جای پرس‌های تک‌نفره‌ی از قبل آماده"],
  sleep:["دراز کشیدن با گوشی روشن تو تخت","بی‌نظمی کامل تو ساعت خواب آخر هفته‌ها","چرت طولانی و دیروقت بعدازظهر که خواب شب رو خراب کنه","مصرف کافئین یا غذای سنگین نزدیک ساعت خواب"],
  procrastination:["برنامه‌ریزی روز رو به تعویق انداختن","شروع کار مهم رو موکول کردن به «حال بهتر» یا «انگیزه‌ی بیشتر»","غرق شدن تو کارهای کوچیک و بی‌اهمیت به‌جای کار اصلی","نداشتن هیچ ددلاین یا زمان مشخص برای کار مهم"],
  shopping:["باز نگه‌داشتن اپ‌ها یا تب‌های فروشگاهی برای «فقط دیدن»","ذخیره کردن اطلاعات کارت بانکی تو اپ‌های خرید برای خرید یه‌کلیکی","دنبال کردن پیج‌ها و تبلیغات فروش ویژه","خرید برای پر کردن یه حس بد یا خالی، بدون نیاز واقعی"],
  nailbiting:["نگه‌داشتن ناخن‌های بلند و ناهموار در دسترس دندون","نشستن جلوی تلویزیون یا کامپیوتر بدون هیچ چیز جایگزین تو دست","نادیده گرفتن اولین نشونه‌ی هشدار (کشش لبه‌ی ناخن)","فراموش کردن ابزار کمکی (فیجت، لاک تلخ) تو موقعیت‌های پرخطر"],
  anxiety:["غرق شدن تو فکرهای نگران‌کننده بدون هیچ اقدام آرامش‌بخش","مصرف بی‌حد اخبار یا محتوای اضطراب‌زا","اجتناب کامل از موقعیت‌هایی که فقط باعث تشدید اضطراب بلندمدت می‌شن","نگه داشتن نگرانی‌ها تو دل، بدون گفتنشون به کسی"],
  other:["نادیده گرفتن علائم هشدار مربوط به «{X}»","توجیه کردن یه لغزش کوچیک با «فقط همین یه‌بار»","قرار گرفتن آگاهانه تو موقعیت‌های پرخطر مربوط به «{X}»","تنها موندن با «{X}» بدون گفتنش به کسی"]
};
function pickAvoidExtra(id){
  const v = ADDICTION_AVOID_EXTRA[id];
  if(!v) return null;
  return Array.isArray(v) ? v[Math.floor(Math.random()*v.length)] : v;
}

/* ---- phone now gets its own evolving item like every other habit ---- */
ADDICTION_ITEMS.phone = ["امروز قبل از خواب گوشی رو دور از تخت گذاشتم",
  "یه اپ حواس‌پرت‌کننده رو محدود یا موقتاً حذف کردم",
  "یه بازه‌ی مشخص و کامل از روز رو بدون گوشی گذروندم",
  "زمان استفاده‌ام از شبکه‌های اجتماعی رو ثبت و نسبت به قبل کمتر کردم",
  "گوشی دیگه اولین و آخرین کاری نیست که تو روزم انجام می‌دم",
  "حتی تو یه لحظه‌ی بی‌حوصلگی هم گوشی اولین واکنشم نبود"];

/* ---- good habits to BUILD (the complementary opposite of the addictions to
   quit above): same 5-stage phase-scaled structure, one evolving item per
   selected goal so the checklist grows in ambition across the program. ---- */
const GOOD_HABIT_ITEMS = {
  reading: ["امروز حداقل چند صفحه یا ۱۰ دقیقه کتاب خوندم","یه کتاب مشخص رو شروع کردم و بهش پایبند موندم",
    "یه روتین ثابت مطالعه (مثلاً قبل خواب) رو رعایت کردم","این هفته حجم مطالعه‌ام نسبت به قبل بیشتر شد",
    "مطالعه‌ی روزانه دیگه بخش خودکار روزمه، نه یه تلاش اضافه","کتاب خوندن دیگه بخش خودکار روزمه؛ حتی دلم براش تنگ می‌شه اگه یه روز نخونم"],
  voice: ["امروز چند دقیقه تمرین صداسازی و تلفظ انجام دادم","یه تمرین مشخص فن بیان (خوندن بلند، ضبط صدا) رو تکرار کردم",
    "از ضبط صدای خودم بازخورد گرفتم و نقطه‌ضعفمو پیدا کردم","این هفته اعتماد به نفسم تو صحبت جلوی جمع بیشتر شد",
    "صحبت کردن رسا و شمرده دیگه نیاز به تلاش آگاهانه نداره","فن بیان خوب دیگه بخشی از شخصیتمه؛ دیگه نیاز به تمرین آگاهانه‌ی هرروزه نداره"],
  skill: ["امروز حداقل ۱۵ تا ۲۰ دقیقه رو مهارت جدیدم گذاشتم","یه بخش مشخص از دوره یا منبع آموزشیم رو جلو بردم",
    "یه تمرین عملی از چیزی که یاد گرفتم رو انجام دادم","این هفته پیشرفت محسوسی تو این مهارت داشتم",
    "تمرین این مهارت دیگه بخش طبیعی و روزمره‌ی زندگیمه","این مهارت دیگه واقعاً بخشی از توانایی‌های روزمره‌امه"],
  social: ["امروز با یه نفر جدید یا آشنا یه گفتگوی واقعی داشتم","تو یه موقعیت اجتماعی خودمو جلو کشیدم به‌جای کنار کشیدن",
    "با یه دوست یا اعضای خانواده وقت باکیفیت گذروندم","این هفته ارتباطات اجتماعیم فعال‌تر از قبل بود",
    "برقراری ارتباط با آدم‌های جدید دیگه اونقدر که قبلاً بود سخت نیست","برقراری ارتباط با آدم‌های جدید دیگه اضطراب نداره؛ برام طبیعی و راحته"],
  language: ["امروز چند لغت یا یه درس کوتاه از زبان دوم یاد گرفتم","یه تمرین گوش‌دادن یا صحبت‌کردن به زبان جدید انجام دادم",
    "لغات جدیدمو مرور و تکرار کردم تا یادم نره","این هفته واژگان و مهارت زبانیم نسبت به قبل بیشتر شد",
    "تمرین روزانه‌ی زبان دوم دیگه یه عادت جا افتاده‌ست","تمرین روزانه‌ی زبان دیگه بدون فکر کردن اتفاق می‌افته؛ بخشی از روتینمه"],
  instrument: ["امروز حداقل ۱۰ تا ۱۵ دقیقه با سازم تمرین کردم","یه قطعه یا تکنیک مشخص رو تمرین کردم",
    "یه بخش از قطعه رو بدون نگاه به نت از حفظ زدم","این هفته مهارتم با ساز نسبت به قبل بهتر شد",
    "نشستن پای ساز دیگه نیاز به انگیزه‌ی اضافه نداره","نواختن دیگه نیاز به انگیزه نداره؛ خودش بخشی از روز خوبمه"],
  exercise: ["امروز یه جلسه نرمش یا ورزش سبک انجام دادم","یه برنامه‌ی ورزشی مشخص رو دنبال کردم",
    "حرکات کششی و نرمشی رو با تمرکز بیشتری انجام دادم","این هفته منظم‌تر از هفته‌ی قبل ورزش کردم",
    "ورزش کردن دیگه نیاز به اراده‌ی زیاد نداره، بخشی از روتینمه","ورزش دیگه بخش خودکار روزمه؛ حتی دلم می‌خواد اگه یه روز نکنم"],
  other: ["امروز یه قدم کوچیک در مسیر «{X}» برداشتم","یه تمرین مشخص برای پیشرفت تو «{X}» انجام دادم",
    "زمان مشخصی رو به «{X}» اختصاص دادم","این هفته پیشرفت محسوسی تو «{X}» داشتم",
    "کار کردن رو «{X}» دیگه بخش طبیعی از روزمه","«{X}» دیگه واقعاً بخشی از روتین روزمره‌امه"]
};

/* ---- extra items unlocked only for people who marked frequency as
   «زیاد، تقریباً هر روز» یا «خیلی زیاد، چند بار در روز» (f3/f4) — so
   two people with the same habit but different severity get a
   noticeably different, more intense list of tasks. ---- */
const ADDICTION_ITEMS_HEAVY = {
  phone: ["اپ‌های پرمصرفم رو با محدودیت زمانی روزانه قفل کردم","تعداد دفعاتی که گوشی رو برداشتم رو زیر یه سقف مشخص نگه داشتم",
    "یه اپ اضافه‌ی دیگه رو کامل حذف یا برای مدتی غیرفعال کردم","حداقل یک بازه‌ی ۲ ساعته‌ی کامل بدون گوشی داشتم",
    "کنترل مصرف گوشیم دیگه نیاز به تلاش زیاد نداره","کنترل گوشی دیگه بدون فکر کردن اتفاق می‌افته؛ حتی دیگه نیازی به قفل و محدودیت زمانی حس نمی‌کنم"],
  porn: ["فیلتر یا مسدودکننده‌ی محتوای محرک رو روی گوشی/کامپیوترم فعال کردم","به‌محض اولین حس وسوسه، بلافاصله محیط یا اتاقم رو عوض کردم",
    "تنها موندن بی‌هدف با گوشی تو ساعات پرخطر رو حذف کردم","این هفته حتی یه لغزش کوچیک هم نداشتم",
    "دیگه نیازی به تلاش آگاهانه‌ی لحظه‌به‌لحظه برای دوری از محرک حس نمی‌کنم","دیگه واقعاً نیازی به فیلتر و مراقبت مداوم ندارم؛ این عادت از زندگیم بیرون رفته"],
  smoking: ["تعداد دقیق نخ‌های امروزمو از صبح شمردم و ثبت کردم","یه موقعیت پرخطر (بعد غذا، قهوه، استرس) رو بدون سیگار رد کردم",
    "فاصله‌ی بین سیگارها رو نسبت به دیروز عمداً بیشتر کردم","این هفته مصرف روزانه‌ام به‌وضوح نسبت به هفته‌ی قبل افت کرد",
    "کشیدن سیگار دیگه بخش خودکار و بی‌فکر روزم نیست","سیگار دیگه بخشی از هویتم نیست؛ حتی بوش هم دیگه وسوسه‌ام نمی‌کنه"],
  alcohol: ["مصرف امروزمو ساعت به ساعت و صادقانه ثبت کردم","یه موقعیت اجتماعی پرخطر رو کامل بدون هیچ نوشیدنی الکلی رد کردم",
    "یه جایگزین غیرالکلی از قبل برای موقعیت‌های پرخطر آماده داشتم","این هفته مصرفم به‌وضوح نسبت به هفته‌ی قبل کمتر شد",
    "دیگه برای آروم شدن یا جمع بودن، اول سراغ الکل نمی‌رم","الکل دیگه هیچ جایی تو زندگی روزمره‌ام نداره؛ فکرشم دیگه وسوسه‌ام نمی‌کنه"],
  gaming: ["از یه تایمر یا قفل‌کننده برای محدود کردن زمان بازی استفاده کردم","بازی رو فقط تو یه بازه‌ی از پیش تعیین‌شده و کوتاه انجام دادم",
    "وقتی زمان بازی تموم شد، بدون بحث با خودم بازی رو بستم","این هفته ساعت کل بازی‌ام نسبت به هفته‌ی قبل محسوس کمتر شد",
    "بازی دیگه فرار من از بقیه‌ی زندگیم نیست","بازی دیگه فقط تو زمان‌بندی مشخص خودش جا داره؛ حتی وسوسه‌ی رد کردن مرزش هم کمرنگ شده"],
  binge: ["پیش از هر وعده یا میان‌وعده، چند لحظه مکث کردم و سطح گرسنگی واقعیمو سنجیدم","یه بار که خواستم از استرس بخورم، به‌جاش یه واکنش جایگزین رو امتحان کردم",
    "تنقلات پرکالری رو از دسترس فوری خودم دور کردم","این هفته دفعات پرخوری هیجانی‌ام نسبت به قبل کمتر شد",
    "رابطه‌ام با غذا داره آروم‌تر و کمتر احساسی می‌شه","دیگه هیچ غذایی رو به‌عنوان جایگزین احساساتم استفاده نمی‌کنم"],
  sleep: ["ساعت خواب و بیداری امروزمو دقیق ثبت کردم","نور و صفحه‌نمایش رو حداقل یک ساعت قبل خواب کم کردم",
    "یه روتین آرام‌بخش ثابت قبل خواب رو اجرا کردم","این هفته ساعت خوابم نسبت به هفته‌ی قبل باثبات‌تر شد",
    "خوابیدن و بیدار شدن سرساعت دیگه به زور و اجبار نیاز نداره","خواب باکیفیت و منظم دیگه پیش‌فرض بدنمه، نه یه هدف که باید براش تلاش کنم"],
  procrastination: ["سخت‌ترین و مهم‌ترین کار امروزمو تو ۳۰ دقیقه‌ی اول بعد بیدار شدن شروع کردم","یه کار عقب‌افتاده‌ی قدیمی رو امروز بالاخره تموم کردم",
    "کارهای امروزمو از قبل و به‌ترتیب اهمیت نوشتم","این هفته لیست کارهای عقب‌افتاده‌ام نسبت به قبل کوتاه‌تر شد",
    "شروع کردن کارها دیگه اون‌قدر که قبلاً بود ترسناک نیست","تعلل دیگه واقعاً بخشی از رفتار روزمره‌ام نیست؛ شروع کردن برام طبیعیه"],
  shopping: ["قبل از هر خرید غیرضروری، حداقل ۲۴ ساعت صبر کردم","اعلان‌ها و ایمیل‌های تبلیغاتی فروشگاه‌ها رو غیرفعال کردم",
    "یه لیست خرید مشخص داشتم و فقط همونا رو خریدم","این هفته هزینه‌ی خرید تفننی‌ام نسبت به هفته‌ی قبل محسوس کمتر شد",
    "دیگه برای پر کردن یه حس خالی، اول سراغ خرید نمی‌رم","خرید تفننی دیگه اصلاً بخشی از روتینم نیست"],
  nailbiting: ["یه «جعبه‌ی کمکی» (فیجت، لاک تلخ، سوهان) همیشه در دسترسم گذاشتم","تو موقعیت‌های پرخطر (تماشای تلویزیون، کار پشت کامپیوتر) از دستکش نازک یا چسب‌زخم روی نوک انگشت استفاده کردم",
    "هر بار که واکنش رقیب رو به‌جای جویدن انجام دادم، برای خودم ثبتش کردم","این هفته تعداد دفعات جویدنم به‌وضوح نسبت به هفته‌ی قبل کمتر شد",
    "دستام دیگه خودکار سمت دهنم نمی‌رن","جویدن ناخن دیگه واقعاً از عادت‌های روزمره‌ام حذف شده"],
  anxiety: ["علائم جسمی اضطراب (تپش قلب، تنش عضلانی) رو همون لحظه شناسایی و ثبت کردم","حداقل دو بار امروز تمرین تنفس یا آرام‌سازی عضلانی پیش‌رونده انجام دادم",
    "مصرف اخبار/محتوای اضطراب‌زا رو به یه بازه‌ی زمانی مشخص و کوتاه محدود کردم","این هفته شدت اضطرابم نسبت به هفته‌ی قبل محسوس کمتر شد",
    "دیگه اضطراب منو از انجام کارهای روزمره‌ام باز نمی‌داره","اضطراب دیگه کنترلم رو دست نمی‌گیره؛ همیشه یه راه سریع برای آروم شدن دارم"],
  other: ["امروز یه قدم محسوس و بزرگ‌تر در کنترل «{X}» برداشتم","به‌محض اولین نشونه‌ی وسوسه‌ی «{X}»، فوراً محیط یا کارمو عوض کردم",
    "یه مانع عملی جلوی دسترسی آسون به «{X}» گذاشتم","این هفته پیشرفت محسوسی نسبت به هفته‌ی قبل در «{X}» داشتم",
    "کنترل «{X}» دیگه نیاز به جنگ روزانه نداره","«{X}» دیگه واقعاً از زندگی روزمره‌ام کنار رفته"]
};

/* ================= Marital-status-aware coping layer =================
   Every habit gets one extra "do" item (pushed into the daily checklist,
   same slot as STRESS_COPING_ITEM/SLEEP_HYGIENE_ITEM below) and one extra
   "avoid" item (added to getAvoidFullPool), each with a single-vs-married
   variant. The core idea: a single person genuinely can't resolve things
   like a compulsive sexual urge inside a relationship, so their path has
   to be self-control and removing triggers; a married person has a partner
   they can be honest with and troubleshoot together with, so isolating
   from that partner (rather than leaning on them) is itself the risk —
   e.g. someone married struggling with alcohol should stay close to their
   spouse during an urge, not withdraw from them. Only used once the person
   has actually picked a marital status in onboarding; profiles created
   before this field existed (maritalStatus:"") simply don't get these
   extra lines, same as any other optional signal. ---- */
const MARITAL_COPING_ITEMS = {
  porn: {
    single: "چون الان مجردم و راه رابطه‌ای برای این نیاز باز نیست، امروز تمرکزم فقط رو خودکنترلی واقعی و دور نگه‌داشتن محرک‌ها از دسترسم بود، نه هیچ راه‌حل موقت دیگه",
    married: "به‌جای سرکوب تنهایی این نیاز، صادقانه با همسرم درباره‌ش حرف زدم و باهم دنبال ریشه‌ی وسوسه (کمبود صمیمیت، استرس، عادت قدیمی) گشتیم"
  },
  alcohol: {
    single: "وقتی وسوسه‌ی مصرف اومد سراغم، به‌جای تنها موندن، رفتم پیش یه دوست یا خانواده تا تنهایی این وسوسه رو تشدید نکنه",
    married: "به‌جای اینکه موقع وسوسه از همسرم فاصله بگیرم یا مخفی‌کاری کنم، پیشش موندم و بهش گفتم چه حسی دارم"
  },
  phone: {
    single: "به‌جای پر کردن وقت تنهایی با اسکرول بی‌هدف، یه فعالیت واقعی (دیدار دوست، ورزش، سرگرمی) جایگزینش کردم",
    married: "گوشی رو کنار گذاشتم و یه بخش کامل از امروز رو بدون حواس‌پرتی با همسرم بودم"
  },
  gaming: {
    single: "به‌جای ساعت‌ها بازی تنها، امروز یه بخش از وقتمو صرف یه ارتباط یا فعالیت اجتماعی واقعی کردم",
    married: "زمان بازی امروزمو طوری تنظیم کردم که وقت مشترکم با همسرم ازش آسیب نبینه"
  },
  smoking: {
    single: "به‌جای سیگار کشیدن تو تنهایی، وقتی وسوسه شدم رفتم سراغ یه فعالیت یا آدم دیگه",
    married: "به همسرم گفتم دارم تلاش می‌کنم سیگار رو کنار بذارم و ازش خواستم کمکم کنه، نه اینکه تنها با این وسوسه بجنگم"
  },
  binge: {
    single: "وعده‌ی غذایی امروزمو به‌جای تنها و جلوی گوشی، با آرامش و تمرکز بیشتری خوردم",
    married: "وعده‌ی غذایی امروز رو سر یه سفره‌ی مشترک با همسرم خوردم، نه جدا و با عجله"
  },
  sleep: {
    single: "چون کسی نیست بهم یادآوری کنه، خودم یه ساعت مشخص برای خواب گذاشتم و بدون بهونه بهش پایبند موندم",
    married: "ساعت خوابمو با همسرم هماهنگ کردم تا روتین مشترکمون به‌هم نریزه"
  },
  procrastination: {
    single: "چون کسی پیگیر کارهام نیست، خودم یه لیست از کارهای عقب‌افتاده نوشتم و حداقل یکیشو جلو بردم",
    married: "یکی از کارهای عقب‌افتاده‌مو با همسرم در میون گذاشتم و ازش کمک یا پیگیری خواستم"
  },
  shopping: {
    single: "قبل از خرید غیرضروری امروز، خودم یه مکث ۱۰ دقیقه‌ای گذاشتم و بدون هیچ‌کس دیگه تصمیم گرفتم",
    married: "خرید امروزمو با همسرم هماهنگ کردم و هیچ هزینه‌ای رو ازش پنهون نکردم"
  },
  nailbiting: {
    single: "چون کسی نیست بهم یادآوری کنه، خودم مراقب دستام بودم و به‌محض شروع جویدن، جلوشو گرفتم",
    married: "از همسرم خواستم وقتی می‌بینه دارم ناخنمو می‌جوم، با یه اشاره بهم یادآوری کنه"
  },
  anxiety: {
    single: "نگرانی امروزمو به‌جای نگه‌داشتن تو دلم، تو یه دفترچه نوشتم تا تنها باهاش کلنجار نرم",
    married: "نگرانی امروزمو با همسرم در میون گذاشتم، به‌جای تنها نگه‌داشتنش تو دلم"
  },
  other: {
    single: "چون فعلاً مجردم، رو خودکنترلی و حمایت دوستان/خانواده برای «{X}» تمرکز کردم، نه یه راه‌حل رابطه‌ای",
    married: "درباره‌ی «{X}» با همسرم صادق بودم و باهم دنبال راه‌حل مشترک گشتیم"
  }
};
/* ---- companion "avoid" item per habit — same single/married split, but
   framed as the pitfall to stay away from rather than the action to take.
   Appended to getAvoidFullPool() alongside ADDICTION_AVOID_EXTRA. ---- */
const MARITAL_AVOID_EXTRA = {
  porn: { single: "دنبال کردن یه راه‌حل موقت و ناسالم به‌جای خودکنترلی واقعی", married: "پنهان‌کاری این موضوع از همسرم و تنها گذاشتنش باهاش" },
  alcohol: { single: "موندن تنها و بی‌برنامه تو موقعیت‌هایی که مصرف توشون راحته", married: "دوری از همسرم یا مخفی‌کاری موقع وسوسه، به‌جای نزدیک موندن بهش" },
  phone: { single: "پر کردن تنهایی و وقت آزاد با اسکرول بی‌هدف به‌جای یه فعالیت واقعی", married: "غرق گوشی بودن به‌جای گذروندن وقت باکیفیت با همسرم" },
  gaming: { single: "جایگزین کردن ارتباط واقعی با آدم‌ها با ساعت‌ها بازی تنها", married: "بازی کردن به‌جای وقت گذاشتن روی رابطه‌ام با همسرم" },
  smoking: { single: "کشیدن سیگار تنها، به‌عنوان تنها راه آروم شدنم", married: "کشیدن سیگار جلوی همسرم یا پنهون‌کاری مصرفم ازش" },
  binge: { single: "خوردن هیجانی تنها و بی‌برنامه، جلوی تلویزیون یا گوشی", married: "غذا خوردن جدا و عجله‌ای به‌جای سرِ سفره‌ی مشترک با همسرم" },
  sleep: { single: "بی‌برنامگی کامل تو خواب چون کسی نیست ازم بپرسه کی می‌خوابم", married: "بی‌توجهی به ساعت خواب مشترک و به‌هم‌ریختن روتین همسرم" },
  procrastination: { single: "نبود هیچ‌کس که کارهای عقب‌افتاده‌مو ازم بپرسه یا پیگیری کنه", married: "پنهون‌کردن کارهای عقب‌افتاده از همسرم به‌جای کمک گرفتن ازش" },
  shopping: { single: "خرید تکانشی برای پر کردن یه خلأ یا تنهایی", married: "خرید بدون هماهنگی با همسر و پنهون‌کردن هزینه‌ها ازش" },
  nailbiting: { single: "نبود کسی که موقع جویدن ناخن یادآوریم کنه", married: "نادیده گرفتن یادآوری‌های همسرم وقتی حواسم به جویدن ناخن نیست" },
  anxiety: { single: "غرق شدن تنها تو نگرانی‌ها بدون در میون گذاشتنش با کسی", married: "نگه‌داشتن اضطرابم برای خودم به‌جای درددل کردن با همسرم" },
  other: { single: "تنها موندن با «{X}» بدون هیچ حمایتی از بیرون", married: "پنهون‌کردن «{X}» از همسرم به‌جای کمک خواستن ازش" }
};

/* ---- one persistent task per selected high-risk time of day, since
   the same habit needs a different guard depending on when it hits. ---- */
const RISK_TIME_ITEMS = {
  morning: "صبح، قبل از هر کار دیگه‌ای، به‌جای واکنش خودکار قبلی یه کار جایگزین کوچیک انجام دادم",
  noon: "ظهر/عصر که معمولاً وسوسه می‌شم، از قبل یه فعالیت جایگزین آماده داشتم و ازش استفاده کردم",
  night: "شب سر ساعت مشخص، محیط اطرافمو طوری چیدم که وسوسه نشم",
  latenight: "سحر/دیروقت بیدار نموندم و محرک‌ها رو کاملاً از دسترسم دور نگه داشتم"
};
/* one-off tasks tied to stress level / how long the person has struggled */
const STRESS_COPING_ITEM = "امروز به‌جای فرار به عادت قدیمی، یه روش آروم‌سازی امتحان کردم (نفس عمیق، پیاده‌روی، نوشتن)";
const TRIGGER_MAP_ITEM = "موقعیت‌ها و محرک‌هایی که بیشتر وسوسه‌ام می‌کنن رو امروز یه‌جا یادداشت کردم (نقشه‌ی محرک‌ها)";
/* tied to the sleep-pattern question from onboarding (step 6) — previously collected but never used in the checklist */
const SLEEP_HYGIENE_ITEM = "ساعت خواب و بیداریم رو نسبت به دیروز باثبات‌تر نگه داشتم و قبل خواب صفحه‌نمایش رو کنار گذاشتم";

function otherLabel(){ return (storeData.profile && storeData.profile.otherAddictionText) ? storeData.profile.otherAddictionText : "این موضوع"; }
function fillX(text){ return text.replace(/\{X\}/g, otherLabel()); }
function otherGoodLabel(){ return (storeData.profile && storeData.profile.otherGoodHabitText) ? storeData.profile.otherGoodHabitText : "این هدف"; }
function fillGoodX(text){ return text.replace(/\{X\}/g, otherGoodLabel()); }
function personalizeExerciseLine(text, profile){
  let t = text;
  if(profile.exerciseAccess==='home') t = t.replace('باشگاه','تمرین خونگی بدون وسیله');
  else if(profile.exerciseAccess==='none') t = t.replace('باشگاه','یه پیاده‌روی سبک یا حرکات کششی بدون وسیله');
  if(/جلسه ورزش واقعی/.test(t)){
    if(profile.goal==='gain') t += ' (با تمرکز روی قدرت و حجم)';
    else if(profile.goal==='lose') t += ' (با تمرکز روی هوازی و کالری‌سوزی)';
    if(profile.exerciseLevel==='beginner') t += ' — تازه‌کاری، پس با شدت کم‌تر و تکرار بیشتر شروع کن';
    else if(profile.exerciseLevel==='advanced'){
      // an active, considered-in-plan health condition should soften "push harder" advice
      // the same way it already softens coach-message tone elsewhere (see getHealthFlags) —
      // never a specific medical adjustment, just less pressure to escalate intensity.
      const hf = (typeof getHealthFlags==='function') ? getHealthFlags() : {active:false};
      if(hf.active) t += ' — امروز به بدنت گوش بده و شدتشو بر اساس حالت الانت تنظیم کن';
      else t += ' — می‌تونی شدت یا وزنه رو نسبت به هفته‌ی قبل بالا ببری';
    }
  }
  return t;
}
/* ---- deterministic per-user rewording so the same base habit doesn't read
   identical for every person in the same phase; each user gets a stable
   seed from their own profile, and each core line either keeps its default
   wording or swaps to its paraphrase based on that seed — no randomness
   between reloads, just variety between different people. ---- */
function hashSeed(str){
  let h = 2166136261;
  for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function profileSeed(profile){
  const parts = [profile.firstName||'', profile.lastName||'', profile.age||'', profile.height||'', profile.weight||'', profile.goal||'', profile.gender||''];
  return hashSeed(parts.join('|'));
}
const CORE_VARIANTS = {
  "بیدار شدن سر ساعت مشخص": "زنگ صبح رو سر همون ساعت همیشگی جواب دادم",
  "یک لیوان آب بلافاصله بعد بیدار شدن": "همون اول صبح یک لیوان آب کامل نوشیدم",
  "۱۰-۱۵ دقیقه بیرون از اتاق": "حداقل ۱۰-۱۵ دقیقه از اتاق بیرون رفتم و نور روز گرفتم",
  "وعده صبحانه سر وقت": "صبحانه رو سر ساعت مشخص خوردم",
  "وعده ناهار سر وقت": "ناهار رو سر ساعت مشخص خوردم",
  "وعده شام سر وقت": "شام رو سر ساعت مشخص خوردم",
  "پیاده‌روی ۱۵-۲۰ دقیقه": "۱۵ تا ۲۰ دقیقه پیاده‌روی کردم",
  "یک گفتگوی واقعی با یکی از اطرافیان": "با یکی از اطرافیانم یه گفتگوی واقعی و حضوری داشتم",
  "خاموش کردن گوشی سر ساعت مشخص شب": "شب سر یه ساعت مشخص گوشی رو خاموش یا کنار گذاشتم",
  "یادداشت یک کار کوچیک که درست انجام دادم": "یه کار کوچیک که امروز درست پیش رفت رو یادداشت کردم",
  "بیدار شدن سر ساعت مشخص، بدون تأخیر زیاد": "زنگ صبح رو بدون چرت زدن زیاد جواب دادم",
  "یک لیوان آب صبح": "صبح یک لیوان آب کامل نوشیدم",
  "۲۰-۲۵ دقیقه بیرون از خونه": "۲۰ تا ۲۵ دقیقه از خونه بیرون بودم",
  "سه وعده غذایی سر وقت": "هر سه وعده‌ی غذایی رو سر ساعت مشخص خوردم",
  "۲۵-۳۰ دقیقه پیاده‌روی یا ورزش سبک": "۲۵ تا ۳۰ دقیقه پیاده‌روی یا یه حرکت ورزشی سبک انجام دادم",
  "یک فعالیت اجتماعی واقعی (تماس یا دیدار حضوری)": "یه تماس یا دیدار حضوری واقعی با کسی داشتم",
  "محدود کردن بازی/گوشی به زیر ۳ ساعت آزاد": "زمان آزاد بازی/گوشی رو زیر ۳ ساعت نگه داشتم",
  "خاموش کردن گوشی حداقل نیم ساعت قبل خواب": "حداقل نیم ساعت قبل خواب گوشی رو کنار گذاشتم",
  "یادداشت روزانه": "چند خط یادداشت روزانه نوشتم",
  "بیدار شدن سر ساعت مشخص، بدون کم و زیاد": "دقیقاً سر همون ساعت همیشگی از خواب بیدار شدم",
  "۳۰ دقیقه فعالیت بدنی (پیاده‌روی سریع یا باشگاه)": "۳۰ دقیقه فعالیت بدنی جدی (پیاده‌روی تند یا باشگاه) انجام دادم",
  "سه وعده غذایی منظم و متنوع": "سه وعده‌ی غذایی منظم و متنوع خوردم",
  "یک هدف کوچیک کاری/شخصی امروز تعریف و انجام دادم": "یه هدف کوچیک شخصی/کاری برای امروز تعریف کردم و تمومش کردم",
  "حداقل یک تعامل اجتماعی معنادار": "حداقل یه تعامل اجتماعی با معنا داشتم",
  "محدود کردن بازی/گوشی به زیر ۲ ساعت آزاد": "زمان آزاد بازی/گوشی رو زیر ۲ ساعت نگه داشتم",
  "خواب قبل از ساعت ۱۲": "قبل از ساعت ۱۲ شب خوابیدم",
  "یادداشت روزانه با تمرکز روی نقطه قوت امروز": "یادداشت امروزمو با تمرکز روی یه نقطه‌قوت نوشتم",
  "بیدار شدن ثابت، بدون نیاز به یادآوری": "بدون نیاز به آلارم اضافه، سر ساعت ثابت بیدار شدم",
  "جلسه ورزش واقعی حداقل ۳۰-۴۵ دقیقه": "امروز یه جلسه ورزش واقعی حداقل ۳۰ تا ۴۵ دقیقه‌ای داشتم",
  "برنامه غذایی منظم روزانه": "برنامه‌ی غذایی روزانه‌ام رو منظم رعایت کردم",
  "پیشرفت در یک هدف بزرگ‌تر (کاری/تحصیلی/شخصی)": "یه قدم واقعی تو مسیر یه هدف بزرگ‌تر برداشتم",
  "حفظ ارتباط اجتماعی فعال": "ارتباطات اجتماعی‌ام رو فعال نگه داشتم",
  "گوشی/بازی فقط در زمان مشخص و محدود": "گوشی و بازی رو فقط تو یه بازه‌ی مشخص و محدود استفاده کردم",
  "رعایت زمان خواب سالم": "زمان خواب سالم و ثابتی رو رعایت کردم",
  "مرور کوتاه پیشرفت این هفته": "یه مرور کوتاه از پیشرفت این هفته‌ام داشتم",
  "روتین صبح پایدار و خودکار": "روتین صبحم دیگه خودکار و بدون تلاش زیاد اجرا می‌شه",
  "ورزش منظم به‌عنوان بخشی از روزت": "ورزش تبدیل به یه بخش ثابت از روزم شده",
  "تغذیه منظم و متعادل": "تغذیه‌ام منظم و متعادل بود",
  "پیگیری اهداف بلندمدتت": "یه قدم دیگه تو مسیر اهداف بلندمدتم برداشتم",
  "ارتباطات اجتماعی سالم و مستمر": "ارتباطات اجتماعی سالمم رو ادامه دادم",
  "کنترل کامل روی زمان صفحه": "کنترل کاملی روی زمان صفحه‌نمایشم داشتم",
  "خواب باکیفیت و منظم": "یه خواب باکیفیت و منظم داشتم",
  "یادداشت رشدی که این هفته کردی": "رشدی که این هفته داشتم رو یادداشت کردم"
};
function personalizeCoreLine(text, profile, idx){
  const variant = CORE_VARIANTS[text];
  if(!variant) return text;
  const pick = (profileSeed(profile) + idx*2654435761) % 2;
  return pick === 0 ? text : variant;
}
function getPersonalizedPhaseItems(basePhase, phaseIdx){
  const profile = storeData.profile || defaultProfile();
  const isHeavy = profile.frequency==='f3' || profile.frequency==='f4';
  const core = basePhase.items.map((t,i)=>personalizeExerciseLine(personalizeCoreLine(t, profile, i), profile));

  // one main item per selected addiction — this is the core personalization signal, always kept
  const addictions = profile.addictions || [];
  const addictionMain = addictions.map(id=>{
    const pool = ADDICTION_ITEMS[id];
    return pool ? fillX(pool[Math.min(phaseIdx, pool.length-1)]) : null;
  }).filter(Boolean);

  // one main item per selected good habit to build — the complementary opposite
  // of addictionMain above (habits to start, not just habits to stop)
  const goodHabits = profile.goodHabits || [];
  const goodHabitMain = goodHabits.map(id=>{
    const pool = GOOD_HABIT_ITEMS[id];
    return pool ? fillGoodX(pool[Math.min(phaseIdx, pool.length-1)]) : null;
  }).filter(Boolean);
  const primary = addictionMain.concat(goodHabitMain);

  // secondary personalization signals, only added if there's still room in the daily budget
  const extras = [];
  if(isHeavy){
    addictions.forEach(id=>{
      const heavyPool = ADDICTION_ITEMS_HEAVY[id];
      if(heavyPool) extras.push(fillX(heavyPool[Math.min(phaseIdx, heavyPool.length-1)]));
    });
  }
  (profile.riskTimes||[]).forEach(rt=>{ if(RISK_TIME_ITEMS[rt]) extras.push(RISK_TIME_ITEMS[rt]); });
  if((profile.stressLevel||0) >= 4) extras.push(STRESS_COPING_ITEM);
  if(phaseIdx===0 && (profile.duration==='d3' || profile.duration==='d4')) extras.push(TRIGGER_MAP_ITEM);
  if(profile.sleepPattern==='irregular' || profile.sleepPattern==='poor') extras.push(SLEEP_HYGIENE_ITEM);
  if(profile.maritalStatus==='single' || profile.maritalStatus==='married'){
    addictions.forEach(id=>{
      const m = MARITAL_COPING_ITEMS[id];
      if(m && m[profile.maritalStatus]) extras.push(fillX(m[profile.maritalStatus]));
    });
  }

  // ---- previously-collected-but-unused onboarding signals: these fields were only ever
  // read by the AI mentor prompt (personaSystemPrompt) and the onboarding form itself,
  // never by the checklist generator — so two people with wildly different if-then plans
  // or short-term goals still got byte-identical daily items. Wiring them in here as extras
  // follows the exact same "only added if there's still room in the daily budget" pattern
  // as the existing stress/sleep/marital extras above. ----
  const ifThenText = (profile.ifThenPlan||'').trim();
  if(ifThenText) extras.push('طبق پلن اگر-پسِ خودم عمل کردم: «'+ifThenText+'»');
  const goalShortText = (profile.goalShort||'').trim();
  if(goalShortText) extras.push('امروز یه قدم واقعی برای «'+goalShortText+'» برداشتم');
  // high self-reported motivation only ever adds an optional bonus item — low motivation
  // should mean less pressure, not more, so nothing is added (or removed) on the low end.
  if((profile.motivationLevel||7) >= 9) extras.push('امروز فراتر از حداقل برنامه، یه قدم اضافه‌ی داوطلبانه هم برداشتم');
  // mood-related health tags (depression/anxiety/bipolar/ocd) that the user asked to have
  // considered: same 'only ever nudges tone/adds supportive framing, never medical' rule
  // that getHealthFlags is already used for elsewhere (coach messages, workout tone).
  if(getHealthFlags().hasMoodTag) extras.push('امروز یه کار کوچیک برای مراقبت از حال روانیم انجام دادم (چند نفس عمیق، یه وقفه‌ی کوتاه، یا صحبت با یکی)');

  // interleave the habit-specific items with the generic routine items so the
  // most personally relevant tasks (the actual reasons someone is using the
  // app) always come first in the list — this ordering matters because the
  // daily checklist is revealed gradually (see revealCounts), not all at once.
  // 18 gives the "کامل" intensity (up to 12 do-items/day at its peak) enough
  // headroom, while still leaving room for every extra signal below (heavy/
  // risk-time/marital/if-then-plan/goal/motivation/mood) to coexist in the pool
  // rather than some getting truncated before the daily reveal even sees them.
  const MAX_TASKS = 18;
  let items = [];
  const maxLen = Math.max(primary.length, core.length);
  for(let i=0; i<maxLen && items.length < MAX_TASKS; i++){
    if(primary[i]) items.push(primary[i]);
    if(core[i] && items.length < MAX_TASKS) items.push(core[i]);
  }
  for(const extra of extras){
    if(items.length >= MAX_TASKS) break;
    items.push(extra);
  }
  return items;
}
/* ---- overall program intensity (سبک/متوسط/سنگین/کامل): controls how many total
   daily tasks (do + avoid combined) the checklist grows to across the program.
   Day 1 always shows the intensity's minimum; the program's final day (based
   on storeData.programLength) shows its maximum; days in between are spread
   linearly across the program length. «متوسط» is the free default; سبک،
   سنگین and کامل are premium-only (see currentIntensityRange below). ---- */
const INTENSITY_RANGES = { light:{min:2,max:5}, medium:{min:3,max:8}, heavy:{min:5,max:12}, full:{min:6,max:16} };
const INTENSITY_LABELS = { light:'سبک', medium:'متوسط', heavy:'سنگین', full:'کامل' };
function currentIntensityRange(){
  const key = (storeData.intensity !== 'medium' && !(storeData.premium || isInTrial())) ? 'medium' : storeData.intensity;
  return INTENSITY_RANGES[key] || INTENSITY_RANGES.medium;
}
function totalTasksForDay(day, len, min, max){
  const d = Math.max(1, day||1);
  const L = Math.max(1, len||90);
  if(L<=1) return max;
  const ratio = Math.min(1, Math.max(0, (d-1)/(L-1)));
  return Math.round(min + (max-min)*ratio);
}
/* ---- how many of today's full (personalized) task list actually get shown,
   based on how many days the program has been running and its intensity
   (see above). The total is split between "do" and "avoid" items, with
   avoid items kept as the smaller share (~1/4, minimum 1 once the total
   reaches 2). Each following day unlocks a bit more, until the full
   personalized list for the current phase is reached. ---- */
function revealCounts(day){
  const range = currentIntensityRange();
  const len = (storeData && storeData.programLength) ? storeData.programLength : 90;
  const total = totalTasksForDay(day, Math.min(len, PROGRESSION_CAP_DAYS), range.min, range.max);
  let avoidCount = total < 2 ? 0 : Math.max(1, Math.round(total/4));
  let doCount = total - avoidCount;
  if(doCount < 1){ doCount = Math.min(1, total); avoidCount = Math.max(0, total - doCount); }
  return { doCount, avoidCount };
}
/* ---- Special day (روز خاص): وقتی فعاله، تعداد کارهای باقی‌مونده نسبت به همون‌قدری
   که آن روز به‌طور عادی (طبق روند تدریجی برنامه) نشون داده می‌شد حساب می‌شه — نه یه
   عدد ثابت. فقط یک‌سوم تعداد فعلی (گرد به بالا، حداقل ۱) می‌مونه، و همون یکی مهم‌ترین
   آیتم انجام‌دادنی (اول پول شخصی‌سازی‌شده) در اولویته؛ اگه بودجه اجازه بده، یه آیتم
   انجام‌ندادنی هم اضافه می‌شه. آیتم‌های سفارشی موقتاً کنار می‌رن. ---- */
function getActiveSpecialDay(){
  if(!storeData.specialDays || !storeData.specialDays.length) return null;
  return storeData.specialDays.find(sd => !sd.stoppedAt && today >= sd.startDate && today <= sd.endDate) || null;
}
function getAvoidFullPool(){
  const profile = storeData.profile || defaultProfile();
  const extra = (profile.addictions||[]).map(id=>pickAvoidExtra(id)).filter(Boolean).map(fillX);
  const maritalExtra = [];
  if(profile.maritalStatus==='single' || profile.maritalStatus==='married'){
    (profile.addictions||[]).forEach(id=>{
      const m = MARITAL_AVOID_EXTRA[id];
      if(m && m[profile.maritalStatus]) maritalExtra.push(fillX(m[profile.maritalStatus]));
    });
  }
  return extra.concat(maritalExtra).concat(BASE_AVOID_ITEMS);
}
function getLightModeCounts(doFullLen, avoidFullLen){
  const { doCount, avoidCount } = revealCounts(programDay());
  const normalDoCount = Math.min(doCount, doFullLen) + (storeData.customItems||[]).length;
  const normalAvoidCount = Math.min(avoidCount, avoidFullLen);
  const normalTotal = normalDoCount + normalAvoidCount;
  const lightTotal = Math.max(1, Math.ceil(normalTotal / 3));
  const lightAvoidCount = lightTotal >= 2 ? 1 : 0;
  const lightDoCount = lightTotal - lightAvoidCount;
  return { lightDoCount, lightAvoidCount };
}
function getDoItems(){
  const phases = scaledPhases();
  const phaseIdx = Math.max(0, phases.findIndex(p=>p.key===currentPhase.key));
  const fullPool = getPersonalizedPhaseItems(currentPhase, phaseIdx);
  const extra = (entry && entry.extraDoItems) || [];
  let items;
  if(getActiveSpecialDay()){
    const { lightDoCount } = getLightModeCounts(fullPool.length, getAvoidFullPool().length);
    items = fullPool.slice(0, Math.min(lightDoCount, fullPool.length)).concat(extra);
  } else {
    const { doCount } = revealCounts(programDay());
    items = fullPool.slice(0, Math.min(doCount, fullPool.length)).concat(storeData.customItems || []).concat(extra);
  }
  return applyItemOverrides(items, entry && entry.doOverrides);
}
function getMomentItems(){ return BASE_MOMENT_ITEMS; }
function getAvoidItems(){
  const fullPool = getAvoidFullPool();
  const extra = (entry && entry.extraAvoidItems) || [];
  let items;
  if(getActiveSpecialDay()){
    const phases = scaledPhases();
    const phaseIdx = Math.max(0, phases.findIndex(p=>p.key===currentPhase.key));
    const doFullLen = getPersonalizedPhaseItems(currentPhase, phaseIdx).length;
    const { lightAvoidCount } = getLightModeCounts(doFullLen, fullPool.length);
    items = fullPool.slice(0, Math.min(lightAvoidCount, fullPool.length)).concat(extra);
  } else {
    const { avoidCount } = revealCounts(programDay());
    items = fullPool.slice(0, Math.min(avoidCount, fullPool.length)).concat(storeData.customAvoidItems || []).concat(extra);
  }
  return applyItemOverrides(items, entry && entry.avoidOverrides);
}
/* ---- Per-day text edits: the user can rename any task shown today (whether it's an
   auto-generated program item or a custom one) via the pencil icon in renderList(). The
   edit is keyed by that item's position in today's list and stored on the day's entry
   (entry.doOverrides / entry.avoidOverrides), so it only affects today — exactly like
   entry.done — and both getDoItems/getAvoidItems apply it last, which means the daily
   report (getTaskReportData, which reads these same two functions) always shows whatever
   text is currently on screen, edited or not. ---- */
function applyItemOverrides(items, overrides){
  if(!overrides) return items;
  return items.map((label, idx)=> (overrides[idx] !== undefined ? overrides[idx] : label));
}
/* ---- «برنامه فردا»: پیش‌نمایش آیتم‌هایی که فردا به‌صورت خودکار (بر اساس فاز/روز برنامه)
   تو چک‌لیست ظاهر می‌شن. برای روزهای خاص (روز خاص) این پیش‌نمایش دقیق نیست چون وضعیت
   روز خاص فردا هنوز معلوم نمی‌شه. ---- */
function getTomorrowProgramDay(){
  if(!storeData.startDate) return 0;
  return programDay() + 1;
}
function getTomorrowPreviewDoItems(){
  const tDay = getTomorrowProgramDay();
  if(tDay <= 0) return [];
  const phase = getPhase(tDay);
  const phases = scaledPhases();
  const phaseIdx = Math.max(0, phases.findIndex(p=>p.key===phase.key));
  const fullPool = getPersonalizedPhaseItems(phase, phaseIdx);
  const { doCount } = revealCounts(tDay);
  return fullPool.slice(0, Math.min(doCount, fullPool.length)).concat(storeData.customItems || []);
}
function getTomorrowPreviewAvoidItems(){
  const tDay = getTomorrowProgramDay();
  if(tDay <= 0) return [];
  const fullPool = getAvoidFullPool();
  const { avoidCount } = revealCounts(tDay);
  return fullPool.slice(0, Math.min(avoidCount, fullPool.length));
}
function computeNutritionTargets(profile){
  const w = profile.weight || 70, h = profile.height || 170, age = profile.age || 25;
  const bmr = profile.gender==='female' ? (10*w + 6.25*h - 5*age - 161) : (10*w + 6.25*h - 5*age + 5);
  let calorieTarget = bmr * 1.4;
  if(profile.goal==='gain') calorieTarget += 350; else if(profile.goal==='lose') calorieTarget -= 400;
  const proteinPerKg = profile.goal==='gain' ? 2.0 : profile.goal==='lose' ? 1.8 : 1.6;
  return { calorieTarget: Math.round(calorieTarget), proteinTarget: Math.round(w*proteinPerKg) };
}
function goalLabel(g){
  return {gain:'افزایش وزن و عضله‌سازی سالم', lose:'کاهش وزن و چربی‌سوزی', maintain:'حفظ وزن و تناسب اندام',
    lifestyle:'صرفاً بهبود سبک زندگی، بدون تمرکز روی وزن'}[g] || 'مشخص نشده';
}
function addictionsText(){
  const profile = storeData.profile || defaultProfile();
  const list = (profile.addictions||[]).map(a=> a==='other' ? otherLabel() : (ADDICTION_LABELS[a]||a));
  return list.length ? list.join('، ') : 'ثبت نشده';
}
function goodHabitsText(){
  const profile = storeData.profile || defaultProfile();
  const list = (profile.goodHabits||[]).map(g=> g==='other' ? otherGoodLabel() : (GOOD_HABIT_LABELS[g]||g));
  return list.length ? list.join('، ') : 'ثبت نشده';
}

/* ================= Goals roadmap =================
   A personalized vertical milestone roadmap, auto-derived from the same
   profile/phase engine that drives the daily checklist: each finite phase
   threshold (day 6/15/30/60/90, scaled to programLength) becomes a "day
   node", and every selected addiction/good-habit contributes its
   phase-matched item text as an expected milestone for that day. This is
   only a suggestion — the person can hide any auto item (stored by id in
   storeData.goalsCustom.removed) and/or add their own custom goals tied to
   any day (storeData.goalsCustom.added), fully independent of the
   auto-generated set so edits survive profile changes. */
function buildGoalGroups(){
  const profile = storeData.profile || defaultProfile();
  const phases = scaledPhases().filter(p=>p.max!==Infinity);
  const removed = (storeData.goalsCustom && storeData.goalsCustom.removed) || {};
  const groupsByDay = {};
  function ensureGroup(day){
    if(!groupsByDay[day]) groupsByDay[day] = { day:day, items:[] };
    return groupsByDay[day];
  }
  function pushAuto(day, id, text, srcLabel){
    if(removed[id]) return;
    ensureGroup(day).items.push({ id:id, text:text, srcLabel:srcLabel||null, custom:false });
  }
  phases.forEach((phase, idx)=>{
    const day = phase.max;
    if(!day || day<1) return;
    pushAuto(day, 'auto_core_'+idx, 'رسیدن به «'+phase.name+'»');
    (profile.addictions||[]).forEach(aid=>{
      const pool = ADDICTION_ITEMS[aid];
      if(!pool) return;
      const text = fillX(pool[Math.min(idx, pool.length-1)]);
      const label = aid==='other' ? otherLabel() : (ADDICTION_LABELS[aid]||aid);
      pushAuto(day, 'auto_add_'+aid+'_'+idx, text, label);
    });
    (profile.goodHabits||[]).forEach(gid=>{
      const pool = GOOD_HABIT_ITEMS[gid];
      if(!pool) return;
      const text = fillGoodX(pool[Math.min(idx, pool.length-1)]);
      const label = gid==='other' ? otherGoodLabel() : (GOOD_HABIT_LABELS[gid]||gid);
      pushAuto(day, 'auto_good_'+gid+'_'+idx, text, label);
    });
  });
  ((storeData.goalsCustom && storeData.goalsCustom.added) || []).forEach(g=>{
    if(removed[g.id]) return;
    const day = Math.max(1, parseInt(g.day,10)||1);
    ensureGroup(day).items.push({ id:g.id, text:g.text, srcLabel:'سفارشی من', custom:true });
  });
  return Object.keys(groupsByDay).map(k=>groupsByDay[k]).sort((a,b)=>a.day-b.day);
}
function isGoalsEditing(){
  const btn = document.getElementById('goalsEditToggleBtn');
  return !!(btn && btn.classList.contains('active'));
}
let goalsFilter = 'all';
function renderGoalsStats(groups){
  const row = document.getElementById('goalsStatsRow');
  if(!row) return;
  if(!groups.length){ row.style.display = 'none'; return; }
  row.style.display = 'flex';
  const day = programDay();
  let totalItems = 0, doneItems = 0, nextGroup = null;
  groups.forEach(g=>{
    totalItems += g.items.length;
    if(day >= g.day) doneItems += g.items.length;
    else if(!nextGroup) nextGroup = g;
  });
  const pct = totalItems ? Math.round(doneItems/totalItems*100) : 0;
  const doneEl = document.getElementById('goalsStatDone');
  const pctEl = document.getElementById('goalsStatPct');
  const nextEl = document.getElementById('goalsStatNext');
  if(doneEl) doneEl.textContent = toFa(doneItems)+'/'+toFa(totalItems);
  if(pctEl) pctEl.textContent = toFa(pct)+'٪';
  if(nextEl){
    if(nextGroup){
      const remain = Math.max(0, nextGroup.day - day);
      nextEl.textContent = remain>0 ? (toFa(remain)+' روز مونده') : 'امروزه! 🎉';
    } else {
      nextEl.textContent = 'رسیدی به قله 🏔️';
    }
  }
}
function renderGoalsRoadmap(){
  const track = document.getElementById('goalsTrack');
  if(!track) return;
  updateGoalsCoach();
  const groups = buildGoalGroups();
  renderGoalsStats(groups);
  if(!groups.length){
    track.innerHTML = '<div class="goals-empty">هنوز هدفی تعریف نشده — از دکمه‌ی «افزودن هدف» یه هدف اضافه کن.</div>';
    return;
  }
  const day = programDay();
  const editing = isGoalsEditing();
  const filter = goalsFilter;
  const nodesHtml = groups.map(g=>{
    let stateClass, stateLabel, filterKey;
    if(day >= g.day){ stateClass='is-done'; stateLabel='رسیدی ✅'; filterKey='done'; }
    else if(g.day - day <= 3){ stateClass='is-current'; stateLabel='نزدیکه'; filterKey='current'; }
    else { stateClass='is-future'; stateLabel='پیش رو'; filterKey='future'; }
    if(filter !== 'all' && filter !== filterKey) return '';
    const itemsHtml = g.items.map(it=>{
      const delBtn = editing ? '<button type="button" class="goal-item-del" data-goal-id="'+it.id+'">✕</button>' : '';
      const srcHtml = it.srcLabel ? '<span class="goal-item-src">'+escapeHtml(it.srcLabel)+'</span>' : '';
      const ic = stateClass==='is-done' ? '✅' : '🎯';
      return '<div class="goal-item"><span class="goal-item-ic">'+ic+'</span><span class="goal-item-text">'+escapeHtml(it.text)+srcHtml+'</span>'+delBtn+'</div>';
    }).join('');
    return '<div class="goal-day-node '+stateClass+'"><span class="goal-day-dot"></span>'+
      '<div class="goal-day-label"><span class="goal-day-badge">روز '+toFa(g.day)+'</span><span class="goal-day-status">'+stateLabel+'</span></div>'+
      '<div class="goal-item-list">'+itemsHtml+'</div></div>';
  }).filter(Boolean).join('');
  track.innerHTML = nodesHtml || '<div class="goals-empty">هدفی با این فیلتر پیدا نشد.</div>';
}
document.getElementById('goalsFilterRow').addEventListener('click', (e)=>{
  const chip = e.target.closest('.goals-filter-chip');
  if(!chip) return;
  goalsFilter = chip.dataset.filter;
  document.querySelectorAll('.goals-filter-chip').forEach(c=>c.classList.toggle('active', c===chip));
  renderGoalsRoadmap();
});
document.getElementById('goalsEditToggleBtn').addEventListener('click', ()=>{
  const btn = document.getElementById('goalsEditToggleBtn');
  const on = !btn.classList.contains('active');
  btn.classList.toggle('active', on);
  btn.textContent = on ? '✓ پایان ویرایش' : '✎ ویرایش';
  document.getElementById('goalsToolbar').style.display = on ? 'flex' : 'none';
  renderGoalsRoadmap();
});
document.getElementById('goalsTrack').addEventListener('click', (e)=>{
  const delBtn = e.target.closest('.goal-item-del');
  if(!delBtn) return;
  const id = delBtn.dataset.goalId;
  if(id.indexOf('auto_')===0){
    storeData.goalsCustom.removed[id] = true;
  } else {
    storeData.goalsCustom.added = storeData.goalsCustom.added.filter(g=>g.id!==id);
  }
  saveData();
  renderGoalsRoadmap();
});
document.getElementById('goalsAddBtn').addEventListener('click', ()=>{
  document.getElementById('addGoalDayInput').value = '';
  document.getElementById('addGoalTextInput').value = '';
  document.getElementById('addGoalOverlay').classList.add('show');
});
document.getElementById('addGoalCloseBtn').addEventListener('click', ()=>{
  document.getElementById('addGoalOverlay').classList.remove('show');
});
document.getElementById('addGoalOverlay').addEventListener('click', (e)=>{
  if(e.target.id==='addGoalOverlay') document.getElementById('addGoalOverlay').classList.remove('show');
});
document.getElementById('addGoalSubmitBtn').addEventListener('click', ()=>{
  const dayVal = parseInt(document.getElementById('addGoalDayInput').value, 10);
  const text = document.getElementById('addGoalTextInput').value.trim();
  if(!dayVal || dayVal<1){ showToast('روز رو درست وارد کن', 'error'); return; }
  if(!text){ showToast('متن هدف رو بنویس', 'error'); return; }
  storeData.goalsCustom.added.push({ id:'custom_'+Date.now()+'_'+Math.floor(Math.random()*1000), day:dayVal, text:text });
  saveData();
  document.getElementById('addGoalOverlay').classList.remove('show');
  renderGoalsRoadmap();
  showToast('هدف اضافه شد', 'success');
});
document.getElementById('goalsResetBtn').addEventListener('click', ()=>{
  if(!confirm('همه‌ی تغییرات سفارشی‌ات روی نقشه‌ی اهداف پاک بشه و به حالت پیشنهادی پیش‌فرض برگرده؟')) return;
  storeData.goalsCustom = { removed:{}, added:[] };
  saveData();
  renderGoalsRoadmap();
  showToast('نقشه‌ی اهداف به پیش‌فرض برگشت', 'success');
});
function profileSummaryText(){
  const p = storeData.profile || defaultProfile();
  const name = [p.firstName,p.lastName].filter(Boolean).join(' ') || 'کاربر';
  const genderText = p.gender==='male'?'مرد':p.gender==='female'?'زن':'ترجیح داده نگه';
  const maritalText = p.maritalStatus==='married' ? 'متاهل' : p.maritalStatus==='single' ? 'مجرد' : 'نامشخص';
  const supportText = p.supportStyle==='direct' ? 'مستقیم و جدی، بدون تعارف، ولی همچنان محترمانه' : 'ملایم و همدلانه';
  const durationText = DURATION_LABELS[p.duration] || 'نامشخص';
  const freqText = FREQUENCY_LABELS[p.frequency] || 'نامشخص';
  const riskText = (p.riskTimes||[]).map(id=>RISK_TIME_LABELS[id]).filter(Boolean).join('، ') || 'ثبت نشده';
  let s = `نام: ${name}. سن: ${p.age||'نامشخص'}. جنسیت: ${genderText}. وضعیت تاهل: ${maritalText}. قد/وزن: ${p.height||'?'} سانتی‌متر / ${p.weight||'?'} کیلوگرم. `+
    `هدف بدنی: ${goalLabel(p.goal)}. عادت‌هایی که روشون کار می‌کنه: ${addictionsText()}. `+
    `چند وقته درگیره: ${durationText}. شدت تکرار: ${freqText}. زمان‌های پرخطرش: ${riskText}. `+
    `سطح استرس: ${p.stressLevel||3} از ۵. سطح انگیزه: ${p.motivationLevel||7} از ۱۰. لحن ترجیحی: ${supportText}. `+
    `هدف کوتاه‌مدت این دوره: ${p.goalShort||'ثبت نشده'}. هدف بلندمدت: ${p.goalLong||'ثبت نشده'}.`;
  if(p.maritalStatus==='single') s += ' توجه مهم: این فرد مجرده، پس برای نیازهایی مثل محرک جنسی/خودارضایی هیچ‌وقت راه‌حل رابطه‌ای پیشنهاد نده؛ تمرکز رو بذار روی خودکنترلی، دورکردن محرک‌ها، و تکیه به دوستان/خانواده به‌جای تنهایی.';
  if(p.maritalStatus==='married') s += ' توجه مهم: این فرد متاهله. برای نیازهایی مثل محرک جنسی/خودارضایی، به‌جای سرکوب تنها، تشویقش کن این نیاز رو صادقانه با همسرش مطرح کنه و باهم ریشه‌یابی کنن؛ برای عادت‌هایی مثل الکل هم بهش بگو موقع وسوسه از همسرش فاصله نگیره و مخفی‌کاری نکنه، بلکه بهش نزدیک بمونه و در جریانش بذاره.';
  if(p.age && p.age < 18) s += ' توجه: این فرد زیر ۱۸ سالشه؛ لحن رو کاملاً مناسب سن نگه دار، از جزئیات بزرگسالانه (مکمل‌های خاص، جزئیات جنسی صریح) پرهیز کن، و در جای مناسب به‌آرومی پیشنهاد بده با یه بزرگ‌تر مورد اعتماد یا مشاور مدرسه هم صحبت کنه.';
  return s;
}
const AI_SAFETY_SYSTEM = "تو یه دستیار همراه داخل یه اپ خودیاریِ تغییر عادته، نه یه درمانگر، روان‌پزشک یا پزشک، و هیچ‌وقت نباید جای اونا رو بگیری یا تشخیص پزشکی/روانی بدی. اگه تو پیام کاربر نشونه‌ای از افکار خودکشی، آسیب جدی به خود یا دیگران، یا یه بحران فوری دیدی، با لحنی آروم و حمایتگر بهش بگو این موضوع مهمه و واقعاً صلاح می‌بینی هرچه زودتر با خط اورژانس اجتماعی ۱۲۳ یا مشاوره تلفنی بهزیستی ۱۴۸۰ تماس بگیره یا کنار یه آدم مورد اعتماد باشه؛ این کارو به‌جای یه جواب انگیزشی معمولی انجام بده، نه در کنارش به‌عنوان یه خط اضافه. هیچ‌وقت جزئیات روش آسیب‌رسوندن به خود رو توضیح نده یا تایید نکن.";
function personaSystemPrompt(extra){ return AI_SAFETY_SYSTEM + "\n" + profileSummaryText() + (extra?("\n"+extra):""); }

/* ---- content-progression cap: phase growth and task-count ramp-up are capped
   to this many days even on long (180/365-day) programs, so the checklist
   reaches its full, varied final stage within ~6 months instead of crawling
   through the same early, thin phase for most of a year. Programs longer than
   this just spend their extra days in the final/peak (maintenance) stage. ---- */
const PROGRESSION_CAP_DAYS = 180;
function scaledPhases(){
  const len = (storeData && storeData.programLength) ? storeData.programLength : 90;
  const ratio = Math.min(len, PROGRESSION_CAP_DAYS)/90;
  return PHASES.map(p=> p.max===Infinity ? p : {...p, max: Math.round(p.max*ratio)});
}
function getPhase(day){
  const phases = scaledPhases();
  if(day <= 0) return phases[0];
  for(const p of phases){ if(day <= p.max) return p; }
  return phases[phases.length-1];
}

const ENCOURAGEMENTS = [
  "آفرین! 👏", "عالی بود!", "همینطوری ادامه بده", "قدم خوبی برداشتی",
  "بهت افتخار می‌کنم", "داری خوب پیش میری", "دمت گرم!", "خودتو دست‌کم نگیر"
];
const CHECK_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" pathLength="1"></polyline></svg>';

const todayKey = () => {
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
};
const dateOnly = (str) => new Date(str+'T00:00:00');
const addDaysToKey = (key, n) => {
  const d = dateOnly(key);
  d.setDate(d.getDate() + n);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
};
const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
const toFa = (n) => String(n).replace(/[0-9]/g, d=>FA_DIGITS[d]);

function defaultProfile(){
  return { firstName:"", lastName:"", age:null, gender:"", maritalStatus:"", height:null, weight:null, goalWeight:null,
    goal:"", addictions:[], otherAddictionText:"", goodHabits:[], otherGoodHabitText:"", exerciseAccess:"", exerciseLevel:"",
    sleepPattern:"", stressLevel:3, motivationLevel:7, supportStyle:"gentle",
    goalShort:"", goalLong:"", ifThenPlan:"", duration:"", frequency:"", riskTimes:[],
    commitmentReward:"", commitmentRewardOther:"", commitmentPunishment:"", commitmentPunishOther:"",
    health:{ hasCondition:false, tags:[], otherTagText:"", detailsText:"", medicationsText:"", considerInPlan:true },
    onboardingComplete:false, accountCreated:false };
}
function defaultStoreData(){
  return { entries:{}, startDate:null, startTimestamp:null, peakCelebrated:false, profile:defaultProfile(), whyText:"", urgeLog:[],
    theme:"brand", programLength:90, intensity:"medium", customItems:[], customAvoidItems:[], customTasks:[], customTaskNotifSeq:0, badges:{}, maxStreak:0, maxPhaseIndex:0, selfieCount:0,
    reminder:{enabled:false, morning:"08:00", night:"22:30"}, smartReminder:{enabled:false, offsetMinutes:20}, streakMilestonesHit:{}, libraryDeepDive:{}, libraryWeekly:{}, courseProgress:{}, chatHistory:[],
    customCounters:[], customCounterMilestonesHit:{},
    supportContact:{name:"", phone:""}, lastModified:null,
    premium:false, premiumPhone:"", aiUsage:{}, firstDayCompleteShown:false,
    lifeJournal:{}, lifeAnalyzerReport:null, inviteNudge:{lastShownAt:null, count:0},
    musicEnabled:true, musicVolume:35,
    sfxEnabled:true, sfxVolume:10, specialDays:[],
    tomorrowPlan:{forKey:null, doItems:[], avoidItems:[]},
    lbPrivacy:{age:false, habit:false, programLen:false, titles:false}, lbLastRank:null,
    reportSentDates:{}, aiFeatureUseCount:{}, xpPenaltyStartDate:null,
    riskNudge:{dismissedKey:null, lastNotifLevel:null} };
}
let storeData = defaultStoreData();
let today = todayKey();

/* ---- «برنامه فردا»: storeData.tomorrowPlan یه لیست موقته که کاربر برای روز بعد
   می‌نویسه. هر بار که تاریخ عوض می‌شه (چه با بازکردن مجدد اپ، چه با رد شدن از نیمه‌شب
   وقتی اپ بازه)، applyTomorrowPlanIfDue بررسی می‌کنه اون پلن برای همون روزیه که تازه
   شروع شده؛ اگه بله، آیتم‌هاش رو به‌صورت دائم به entry همون روز (extraDoItems/
   extraAvoidItems) اضافه می‌کنه و بعد پلن رو برای «فردای جدید» خالی می‌کنه. ---- */
function ensureTomorrowPlan(){
  if(!storeData.tomorrowPlan) storeData.tomorrowPlan = { forKey:null, doItems:[], avoidItems:[] };
  if(!storeData.tomorrowPlan.doItems) storeData.tomorrowPlan.doItems = [];
  if(!storeData.tomorrowPlan.avoidItems) storeData.tomorrowPlan.avoidItems = [];
}
function applyTomorrowPlanIfDue(){
  ensureTomorrowPlan();
  const plan = storeData.tomorrowPlan;
  if(plan.forKey && plan.forKey <= today && (plan.doItems.length || plan.avoidItems.length)){
    const e = storeData.entries[plan.forKey] || { done:{}, avoidDone:{}, momentDone:{}, note:"", lesson:"", milestonesHit:{}, total:0,
      phoneHours:null, meals:{b:"",l:"",d:"",snacks:""}, nightReview:null, mood:null, energy:null, weight:null, symptoms:{} };
    if(!e.extraDoItems) e.extraDoItems = [];
    if(!e.extraAvoidItems) e.extraAvoidItems = [];
    e.extraDoItems = e.extraDoItems.concat(plan.doItems);
    e.extraAvoidItems = e.extraAvoidItems.concat(plan.avoidItems);
    storeData.entries[plan.forKey] = e;
  }
  if(!plan.forKey || plan.forKey <= today){
    plan.forKey = addDaysToKey(today, 1);
    plan.doItems = [];
    plan.avoidItems = [];
  }
}

/* ==================== Generic premium gate helper ====================
   isAppOwner (OWNER_EMAIL) always has storeData.premium forced true elsewhere,
   so this one check transparently covers the owner too — no separate bypass needed.
   isInTrial() (defined below, near the AI-gating helpers) also unlocks everything
   during the 48-hour free trial. */
function requirePremium(){
  if(storeData.premium || isInTrial()) return true;
  if(typeof openPremiumOverlay === 'function') openPremiumOverlay();
  return false;
}
/* تب‌های کاملاً پرمیوم: کتابخانه، هم‌مسیر. (لیدربورد طبق درخواست همیشه باز و رایگانه —
   دیگه تو این لیست نیست.) */
const PREMIUM_ONLY_TABS = { library:1, buddy:1 };
/* Small 🔒 badge on every premium-only entry point in the UI, kept in sync from render(). */
const PREMIUM_LOCK_SELECTORS = [
  '.tab-btn[data-tab="library"]',
  '.pub-subnav-btn[data-tab="buddy"]',
  '.side-menu-item[data-tab="goals"]', '#telegramMenuItem',
  '.settings-group-head[data-target="sgBody-checklist"]',
  '#tab-meditation .subseg button[data-sub="bodyscan"]',
  '#tab-meditation .subseg button[data-sub="gratitude"]',
  '#tab-meditation .subseg button[data-sub="voidmind"]',
  '#tab-today .subseg button[data-sub="tomorrow"]'
];
function applyPremiumLocksUI(){
  const locked = !(storeData.premium || isInTrial());
  PREMIUM_LOCK_SELECTORS.forEach(sel=>{
    document.querySelectorAll(sel).forEach(el=> el.classList.toggle('feature-locked', locked));
  });
  if(typeof applyWoPremiumLocksUI === 'function') applyWoPremiumLocksUI();
  if(typeof applySpeechPremiumLocksUI === 'function') applySpeechPremiumLocksUI();
  renderPremiumPurchaseUI();
  updatePlanBadge();
  if(typeof renderFocusModeGrid === 'function') renderFocusModeGrid();
}
/* Header plan badge (🆓 پلن رایگان / 👑 پرمیوم). Kept in sync from applyPremiumLocksUI,
   which already runs on every event that can change premium status (session load,
   purchase success, restore success). Trial time also shows as premium, matching
   every other premium check in the app. */
function updatePlanBadge(){
  const badge = document.getElementById('planBadge');
  if(!badge) return;
  const iconEl = document.getElementById('planBadgeIcon');
  const textEl = document.getElementById('planBadgeText');
  const isPremiumNow = !!(storeData.premium || isInTrial());
  badge.classList.toggle('is-premium', isPremiumNow);
  badge.classList.toggle('is-free', !isPremiumNow);
  if(isPremiumNow){
    iconEl.textContent = '👑';
    textEl.textContent = 'پرمیوم';
    badge.title = 'اشتراک پرمیوم فعاله';
    badge.onclick = null;
  } else {
    iconEl.textContent = '🆓';
    textEl.textContent = 'پلن رایگان';
    badge.title = 'برای ارتقا بزن';
    badge.onclick = ()=>{ if(typeof openPremiumPage === 'function') openPremiumPage(); };
  }
}
/* Buy-button vs. already-owned state on the premium page itself. Called every time
   premium status is (re)computed anywhere (login/session refresh, purchase success,
   restore success) so the button can never be left showing "buy" once the user
   already owns premium. */
function renderPremiumPurchaseUI(){
  const owned = !!storeData.premium;
  const priceCard = document.getElementById('premPriceCard');
  const ownedBox = document.getElementById('premAlreadyOwnedBox');
  const restoreDivider = document.getElementById('premRestoreDivider');
  const restoreBtn = document.getElementById('premiumCheckBtn');
  if(priceCard) priceCard.style.display = owned ? 'none' : '';
  if(ownedBox) ownedBox.style.display = owned ? '' : 'none';
  if(restoreDivider) restoreDivider.style.display = owned ? 'none' : '';
  if(restoreBtn) restoreBtn.style.display = owned ? 'none' : '';
  renderLifetimeScarcity();
}

/* ==================== Premium gating for AI features ==================== */
const WORKER_BASE = "https://groq-proxy.mahdihd648.workers.dev";
/* هر درخواستی که به Worker می‌ره و نیاز به احراز هویت داره (AI، iab/verify، referral/apply،
   wheel/spin) باید این هدر رو داشته باشه؛ Worker از روش می‌فهمه واقعاً کی داره درخواست می‌ده
   و دیگه چیزی که کلاینت درباره‌ی پرمیوم/رفرال ادعا می‌کنه رو کورکورانه قبول نمی‌کنه. */
// خودِ فایل گیف (نه فقط جواب جستجو) هم باید از Worker رد بشه، وگرنه تگ <img>/<video> مستقیم
// از گوشیِ کاربر به media*.giphy.com وصل می‌شه که بدون فیلترشکن لود نمی‌شه ("این مدیا منقضی
// شده"). آدرس‌های غیر-Giphy (blob:، عکس/ویدیوی خودمون رو Supabase Storage) دست‌نخورده می‌مونن.
function giphyProxyIfNeeded(u){
  if(!u || !/^https:\/\/([a-z0-9-]+\.)?giphy\.com\//i.test(u)) return u;
  return WORKER_BASE + '/giphy/media?url=' + encodeURIComponent(u);
}
async function authHeaders(){
  try{
    if(!sb) return {};
    const { data } = await sb.auth.getSession();
    const token = data && data.session && data.session.access_token;
    return token ? { "Authorization": "Bearer " + token } : {};
  }catch(err){ return {}; }
}
/* وقتی Worker یه درخواست AI رو به‌خاطر محدودیت پرمیوم/سهمیه رد می‌کنه (402)، کاربر قبلاً فقط
   یه توست خطا می‌دید و همون‌جا می‌موند — هیچ راهی برای رفتن به خرید نداشت مگه اینکه خودش
   دستی از منو بره تو صفحه‌ی پرمیوم. الان علاوه بر توست، مستقیم می‌بریمش صفحه/باکس خرید
   پرمیوم؛ یعنی هر قابلیت پرمیومی که بهش برنخوره (چه با پیش‌چک کلاینت رد بشه، چه واقعاً از
   خودِ سرور 402 بگیره) آخرش به همون مقصد ختم می‌شه. برای بقیه‌ی خطاها (400/401/500 و ...)
   فقط همون توست قبلی نشون داده می‌شه، چون ربطی به پرمیوم ندارن. */
function handleAiWorkerError(response, data){
  const msg = (data && data.error) || 'مشکلی پیش اومد، دوباره امتحان کن';
  showToast(msg, 'error');
  if(response.status === 402){
    setTimeout(()=>{ if(typeof openPremiumPage === 'function') openPremiumPage(); }, 700);
  }
}
const AI_FEATURE_LABELS = { nightReview:'تحلیل شب', weeklyReview:'گزارش هفتگی', letter:'نامه‌ی آینده', libDeep:'کتابخونه‌ی عمیق', libWeekly:'مقاله‌ی هفته', lifeAnalyzer:'دفترچه هوشمند زندگی' };
const LJ_REQUIRED_DAYS = 90;
function daysLeftForFeature(key){
  if(storeData.premium) return 0;
  const last = storeData.aiUsage && storeData.aiUsage[key];
  if(!last) return 0;
  const daysPassed = (Date.now() - new Date(last).getTime()) / 86400000;
  return Math.max(0, Math.ceil(7 - daysPassed));
}
/* ==================== بازه‌ی آزمایشی رایگان (۴۸ ساعت) — وابسته به اکانت/دستگاه، نه به داده‌ی محلی ====================
   قبلاً isInTrial() از storeData.startTimestamp (کاملاً محلی، رو گوشی کاربر) استفاده می‌کرد که با
   «پاک کردن داده‌های برنامه» صفر می‌شد و یعنی هر بار می‌شد از اول ۷ روز پرمیوم مجانی گرفت.
   حالا بازه‌ی ۴۸ساعته از هر کدوم زودتر باشه حساب می‌شه:
     ۱) زمان واقعی ساخته‌شدن اکانت تو Supabase Auth (publicChatUser.created_at) — سرور نگهش
        می‌داره، نه گوشی، پس پاک کردن داده و لاگین دوباره با همون ایمیل چیزی رو ریست نمی‌کنه.
     ۲) اولین باری که همین دستگاه دیده شده (جدول device_trials تو Supabase) — یعنی حتی اگه
        بعد از پاک کردن داده با یه جیمیل کاملاً جدید ثبت‌نام کنه، چون خودِ دستگاه قبلاً یه بار
        دیده شده، بازه‌ی آزمایشی تازه‌ای بهش تعلق نمی‌گیره.
   resolveTrialStart() این دو رو یه‌بار در هر سشن (موقع لاگین/بازشدن برنامه) چک می‌کنه و نتیجه رو
   تو effectiveTrialStartMs کش می‌کنه؛ isInTrial() همون‌جا رو سینک می‌خونه. */
const TRIAL_HOURS = 48;
let effectiveTrialStartMs = null;
async function computeDeviceFingerprint(){
  try{
    const raw = [
      navigator.userAgent || '', navigator.language || '',
      (screen.width||0)+'x'+(screen.height||0),
      (Intl.DateTimeFormat().resolvedOptions().timeZone) || '',
      navigator.hardwareConcurrency || ''
    ].join('|');
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }catch(err){ return null; }
}
async function resolveTrialStart(){
  // بازه‌ی آزمایشی حذف شده (پایین‌تر در isInTrial())، پس دیگه لازم نیست این تابع
  // به Supabase (جدول device_trials) سر بزنه — فقط برای سازگاری با جاهایی از کد که
  // صداش می‌زنن نگه داشته شده.
  effectiveTrialStartMs = null;
}
function isInTrial(){
  // طبق درخواست: بازه‌ی آزمایشی رایگان کاملاً و برای همیشه غیرفعاله. همه‌ی بخش‌های
  // پرمیوم از همون اولین لحظه قفلن — هیچ استثنایی، هیچ باگی. این تابع تنها جایی‌ه
  // که همه‌ی چک‌های پرمیوم تو کل اپ (storeData.premium || isInTrial()) بهش وابسته‌ن؛
  // پس یه return false همیشگی همینجا کافیه که این قابلیت هیچ‌وقت، از هیچ مسیری،
  // دوباره فعال نشه. اگه یه روز خواستین دوباره یه بازه‌ی آزمایشی بدین، فقط همینجا
  // باید تغییر کنه.
  return false;
}
function markAIFeatureUsed(key){
  if(!storeData.aiUsage) storeData.aiUsage = {};
  storeData.aiUsage[key] = new Date().toISOString();
  if(!storeData.aiFeatureUseCount) storeData.aiFeatureUseCount = {};
  storeData.aiFeatureUseCount[key] = (storeData.aiFeatureUseCount[key]||0) + 1;
  saveData();
}
function gateAIFeature(key){
  if(storeData.premium) return true;
  if(isInTrial()) return true;
  const dl = daysLeftForFeature(key);
  if(dl <= 0) return true;
  showAIGate(key, dl);
  return false;
}
function sameDay(iso){
  if(!iso) return false;
  const d = new Date(iso);
  const k = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  return k === todayKey();
}
function gateDailyFeature(key, label){
  return gatePeriodicFeature(key, label, 1);
}
// «مشاور شخصی» — هر بخش (مرور شب، گزارش هفتگی/ماهانه، جمع‌بندی درس‌ها، نامه‌ی آینده،
// دفترچه هوشمند) برای کاربر رایگان فقط یک‌بار در کل در دسترسه؛ کاربر پرمیوم نامحدود.
function gatePeriodicFeature(key, label, periodDays){
  if(storeData.premium || isInTrial()) return true;
  const last = storeData.aiUsage && storeData.aiUsage[key];
  if(!last) return true;
  const coachEl = document.getElementById('aiGateCoachAvatar');
  if(coachEl) coachEl.innerHTML = buildCoachSVG('gentle', 'aigate');
  document.getElementById('aiGateMsgText').textContent =
    `${label} تو نسخه‌ی رایگان فقط یک‌بار در دسترسه — قبلاً ازش استفاده کردی. با پرمیوم هر وقت بخوای نامحدود ازش استفاده می‌کنی.`;
  document.getElementById('aiGatePremiumBtn').style.display = '';
  document.getElementById('aiGateCloseBtn').textContent = 'باشه، صبر می‌کنم';
  document.getElementById('aiGateOverlay').classList.add('show');
  return false;
}
function showAIGate(key, daysLeft){
  const coachEl = document.getElementById('aiGateCoachAvatar');
  if(coachEl) coachEl.innerHTML = buildCoachSVG('gentle', 'aigate');
  const label = AI_FEATURE_LABELS[key] || 'این قابلیت';
  document.getElementById('aiGateMsgText').textContent =
    `خوشحالیم که از ${label} استفاده کردی 🙂 تو نسخه‌ی رایگان هفته‌ای یه‌بار در دسترسه — ${toFa(daysLeft)} روز دیگه دوباره بازمی‌شه. اگه برات مفید بوده، با پرمیوم هر وقت بخوای نامحدود ازش استفاده می‌کنی.`;
  document.getElementById('aiGatePremiumBtn').style.display = '';
  document.getElementById('aiGateCloseBtn').textContent = 'باشه، صبر می‌کنم';
  document.getElementById('aiGateOverlay').classList.add('show');
}
function hideAIGate(){ document.getElementById('aiGateOverlay').classList.remove('show'); }

let entry = { done:{}, avoidDone:{}, momentDone:{}, note:"", milestonesHit:{}, total:0,
  phoneHours:null, meals:{b:"",l:"",d:"",snacks:""}, nightReview:null, mood:null, energy:null, weight:null, symptoms:{},
  extraDoItems:[], extraAvoidItems:[], doOverrides:{}, avoidOverrides:{} };
let currentPhase = PHASES[0];

/* ---------------- "Why" motivation card ---------------- */
document.getElementById('whyArea').addEventListener('input',(e)=>{
  storeData.whyText = e.target.value;
  saveData();
});

/* ---------------- SOS urge-support ---------------- */
const SOS_ACTIVITIES = [
  "یه دوش آب سرد بگیر",
  "۱۰ دقیقه برو بیرون قدم بزن",
  "به یکی از نزدیکات زنگ بزن و حرف بزن",
  "بشین بنویس الان چه حسی داری و چرا اومد سراغت",
  "۲۰ تا شنا یا اسکوات برو بزن",
  "یه لیوان آب سرد بخور و صورتتو بشور",
  "پنجره رو باز کن و چندتا نفس عمیق بکش",
  "برو تو یه اتاق دیگه و چراغو روشن کن",
  "یه آهنگ پرانرژی بذار و چند دقیقه باهاش حرکت کن",
  "ظرف بشور یا اتاقتو مرتب کن تا دستات مشغول بشه",
  "یه تسک کوچیک از کارای عقب‌افتاده‌تو همین الان انجام بده",
  "۱۰-۱۵ دقیقه فقط این وسوسه رو observe کن بدون عمل کردن بهش، ببین خودش کم می‌شه",
  "از خودت بپرس: الان واقعاً چی می‌خوام؟ آرامش، توجه، یا فرار از یه حس بد؟"
];
const BREATH_TEXTS = ["دم بگیر... 🫁","نگه‌دار...","بازدم بده...","نگه‌دار..."];
let sosTimerInterval=null, breathInterval=null, sosSecondsLeft=300;

// Each temptation has its own tailored set of instant alternatives —
// masturbation keeps the original pool (it already works great); the rest get their own.
const TEMPTATION_CATEGORIES = [
  { id:'masturbation', emoji:'🔥', label:'خودارضایی', activities: SOS_ACTIVITIES },
  { id:'porn', emoji:'🚫', label:'محتوای نامناسب', activities: [
    "مطمئن شو فیلتر/مسدودکننده‌ت فعاله، اگه نیست همین الان روشنش کن",
    "بلافاصله گوشی یا لپ‌تاپ رو ببند و از همون اتاق برو بیرون",
    "به همون آدم مورد اعتمادت پیام بده: «الان تحت فشارم»، فقط همین یه خط کافیه",
    "برو یه پیاده‌روی ۵ دقیقه‌ای تند، فقط برای عوض شدن حال و هوا",
    "۲۰ تا شنا یا دراز و نشست برو بزن تا انرژی اضافه خالی شه",
    "چراغ اتاق رو روشن کن و برو یه جای دیگه‌ی خونه که پر رفت‌وآمده",
    "از حساب‌های ناشناس/مخفی که استفاده می‌کنی لاگ‌اوت کن",
    "به‌جای گوشی، یه کتاب یا مجله‌ی فیزیکی دستت بگیر",
    "یادت باشه این میل معمولاً زیر ۱۰ دقیقه فروکش می‌کنه، فقط از همین لحظه رد شو",
    "اگه یه اپ یا صفحه‌ی خاص همیشه محرکته، همین الان موقتاً حذفش کن",
    "به‌جای قضاوت خودت، فقط از همین محیط یا لحظه‌ی خاص فاصله بگیر"
  ]},
  { id:'fastfood', emoji:'🍔', label:'فست‌فود / پرخوری', activities: [
    "یه لیوان آب بزرگ بخور و ۱۰ دقیقه صبر کن، بعد دوباره تصمیم بگیر",
    "اگه واقعاً گرسنه‌ای، همون میان‌وعده‌ی سالمی که از قبل آماده داشتی رو بخور",
    "مسواک بزن — طعم دهنت عوض می‌شه و میل کمتر می‌شه",
    "از خودت بپرس: الان واقعاً گرسنمه یا دارم با خوردن یه حس دیگه رو جبران می‌کنم؟",
    "اگه بازم خواستی، فقط یه پرس کوچیک بردار و بقیه رو فوراً از جلوی چشمت جمع کن",
    "غذای موردعلاقه‌تو خودت خونه درست کن، به‌جای سفارش بیرون",
    "وعده‌ی بعدیت رو از همین الان تو ذهنت مشخص کن تا با فشار تصمیم نگیری",
    "۵ دقیقه یه کار دیگه انجام بده و بعد دوباره ببین واقعاً میلشو داری",
    "اگه واقعاً گرسنه‌ای، یه چیز پروتئین‌دار یا فیبردار بخور که سیرتر نگهت داره",
    "به‌جای غذا، یه پاداش کوچیک غیرغذایی برای خودت در نظر بگیر"
  ]},
  { id:'phone', emoji:'📱', label:'گوشی / شبکه‌های اجتماعی', activities: [
    "گوشی رو بذار تو یه اتاق دیگه یا یه کشوی دور از دسترس، ۱۰ دقیقه",
    "حالت خاکستری (grayscale) صفحه رو فعال کن، اسکرول کردن جذابیتشو از دست می‌ده",
    "یه تایمر ۱۰ دقیقه‌ای بذار و یه کار کوتاه آفلاین انجام بده",
    "اپ رو ببند و اعلان‌هاشو برای امروز موقتاً خاموش کن",
    "به‌جاش زنگ بزن به یه آدم واقعی و چند دقیقه باهاش حرف بزن"
  ]},
  { id:'smoking', emoji:'🚬', label:'سیگار', activities: [
    "یه لیوان آب بخور یا یه آدامس بجو",
    "تنفس ۴-۷-۸: ۴ ثانیه دم بگیر، ۷ ثانیه نگه‌دار، ۸ ثانیه بازدم بده، چندبار تکرار کن",
    "۱۰ دقیقه صبر کن؛ اگه بعدش هنوزم خواستی، آگاهانه تصمیم بگیر",
    "محیطی که توش سیگار می‌کشیدی رو عوض کن، برو یه جای دیگه",
    "دستتو با یه فعالیت دیگه اشغال کن، مثلاً یه توپ استرس یا خودکار بازی کردن",
    "همون دلیل اصلیتو برای ترک کردن یه بار با خودت مرور کن",
    "به‌جای سیگار، یه لیوان آب سرد یا یه چای بخور",
    "اگه بعد غذا وسوسه شدی، بلافاصله مسواک بزن",
    "پیشرفتت (ساعت/روز بدون سیگار) رو همین الان یه‌جا ثبت کن، حتی با یادداشت گوشی",
    "اگه به‌جای سیگار ویپ می‌کشی، یادت باشه اونم باید کم بشه، نه جایگزین همیشگی"
  ]},
  { id:'procrastination', emoji:'⏳', label:'تعلل و اهمال‌کاری', activities: [
    "فقط ۲ دقیقه شروع کن، نه بیشتر — اکثر وقتا همون شروع کوچیک کافیه که ادامه بدی",
    "کاری که ازش فرار می‌کنی رو به کوچیک‌ترین قدم ممکن بشکن و فقط همون یه قدم رو انجام بده",
    "گوشی و تب‌های حواس‌پرت‌کن رو ببند و یه تایمر ۱۰ دقیقه‌ای فقط برای همین کار بذار",
    "از خودت بپرس: دارم فرار می‌کنم چون سخته یا چون می‌ترسم خوب انجامش ندم؟",
    "به‌جای «باید کامل تمومش کنم»، فقط بگو «همینو الان شروع می‌کنم»"
  ]},
  { id:'other', emoji:'💭', label:'یه چیز دیگه', activities: SOS_ACTIVITIES }
];
let pendingCategory = null;
/* ---- same single/married split as the checklist, but for the in-the-moment
   SOS screen — shown only when the category is one where marital status
   changes the actual right move (see MARITAL_COPING_ITEMS above). ---- */
const SOS_MARITAL_TIPS = {
  masturbation: {
    single: "چون الان مجردی، راه رابطه باز نیست — تمرکز فقط رو خودکنترلی و دور کردن خودت از محرکه، نه هیچ راه‌حل موقت دیگه",
    married: "به‌جای سرکوب تنها، بعد از این لحظه با همسرت درباره‌ی این نیاز صادق باش — این مسیر با هم رفتن خیلی راحت‌تره"
  },
  porn: {
    single: "همون قانونیه که برای خودارضایی هم هست: چون مجردی، تنها راه واقعی خودکنترلیه، نه هیچ جایگزین دیگه",
    married: "این وسوسه رو به‌جای مخفی نگه‌داشتن، یه فرصت ببین برای صحبت صادقانه با همسرت درباره‌ی این نیاز"
  },
  fastfood: {
    single: "اگه تنهایی داره این ولع رو بیشتر می‌کنه، به‌جای خوردن، به یکی زنگ بزن",
    married: "می‌تونی از همسرت بخوای همین چند دقیقه رو کنارت باشه یا حواستو پرت کنه"
  },
  phone: {
    single: "به‌جای اسکرول بی‌هدف تو تنهایی، به یه آدم واقعی زنگ بزن",
    married: "گوشی رو بذار کنار و چند دقیقه رو با همسرت باش"
  },
  smoking: {
    single: "این وسوسه رو با یه فعالیت یا آدم دیگه جایگزین کن، نه با سیگار تو تنهایی",
    married: "به همسرت بگو الان وسوسه شدی — نگفتنش تنهات می‌ذاره با این فشار"
  },
  procrastination: {
    single: "چون کسی پیگیرت نیست، خودت همین الان یه قدم کوچیک بردار",
    married: "به همسرت بگو رو چی گیر کردی؛ شاید کمکت کنه شروعش کنی"
  }
};
function getSOSMaritalTip(catId){
  const marital = storeData.profile && storeData.profile.maritalStatus;
  if(marital!=='single' && marital!=='married') return '';
  const t = SOS_MARITAL_TIPS[catId];
  return (t && t[marital]) ? t[marital] : '';
}

function renderSOSCatGrid(){
  const grid = document.getElementById('sosCatGrid');
  grid.innerHTML = TEMPTATION_CATEGORIES.map(c=>
    `<button type="button" class="sos-cat-btn${c.id==='other'?' other-cat':''}" data-cat="${c.id}">
      <span class="sos-cat-emoji">${c.emoji}</span><span>${escapeHtml(c.label)}</span>
    </button>`
  ).join('');
  grid.querySelectorAll('.sos-cat-btn').forEach(btn=>{
    btn.addEventListener('click', ()=> selectTemptationCategory(btn.dataset.cat));
  });
}
renderSOSCatGrid();

function updateSOSTimerDisplay(){
  const m=Math.floor(sosSecondsLeft/60), s=sosSecondsLeft%60;
  document.getElementById('sosTimer').textContent = String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}
function openSOS(){
  const overlay=document.getElementById('sosOverlay');
  pendingCategory = null;
  document.getElementById('sosCatStep').style.display='block';
  ['sosWhyBox','sosContactBox','sosMaritalBox','breathCircle','sosTimer','sosActivity','sosOutcomeRow'].forEach(id=>{
    document.getElementById(id).style.display='none';
  });
  document.getElementById('sosHaltStep').style.display='none';
  document.getElementById('sosSkip').style.display='none';
  overlay.classList.add('show');
}
function selectTemptationCategory(catId){
  const cat = TEMPTATION_CATEGORIES.find(c=>c.id===catId) || TEMPTATION_CATEGORIES[TEMPTATION_CATEGORIES.length-1];
  pendingCategory = cat.id;
  document.getElementById('sosCatStep').style.display='none';
  document.getElementById('sosSkip').style.display='block';

  const whyBox=document.getElementById('sosWhyBox');
  if(storeData.whyText && storeData.whyText.trim()){
    whyBox.style.display='block';
    whyBox.textContent = 'یادت باشه چرا شروع کردی: ' + storeData.whyText;
  } else { whyBox.style.display='none'; }
  const contactBox = document.getElementById('sosContactBox');
  const contact = storeData.supportContact;
  if(contact && contact.name){
    contactBox.style.display='block';
    contactBox.innerHTML = contact.phone
      ? `می‌تونی الان به <a href="tel:${escapeHtml(contact.phone)}">${escapeHtml(contact.name)}</a> زنگ بزنی یا پیام بدی`
      : `می‌تونی الان به ${escapeHtml(contact.name)} پیام بدی یا زنگ بزنی`;
  } else { contactBox.style.display='none'; contactBox.innerHTML=''; }
  const maritalBox = document.getElementById('sosMaritalBox');
  const maritalTip = getSOSMaritalTip(cat.id);
  if(maritalTip){ maritalBox.style.display='block'; maritalBox.textContent = maritalTip; }
  else { maritalBox.style.display='none'; maritalBox.textContent=''; }
  const myPlan = storeData.profile && storeData.profile.ifThenPlan && storeData.profile.ifThenPlan.trim();
  const pool = cat.activities && cat.activities.length ? cat.activities : SOS_ACTIVITIES;
  document.getElementById('sosActivity').style.display='block';
  document.getElementById('sosActivity').textContent = myPlan ? ('برنامه‌ی خودت: ' + myPlan) : pool[Math.floor(Math.random()*pool.length)];
  document.getElementById('breathCircle').style.display='flex';
  document.getElementById('sosTimer').style.display='block';
  document.getElementById('sosOutcomeRow').style.display='flex';

  sosSecondsLeft = 300;
  updateSOSTimerDisplay();
  clearInterval(sosTimerInterval);
  sosTimerInterval = setInterval(()=>{
    sosSecondsLeft--;
    if(sosSecondsLeft<=0){
      sosSecondsLeft=0;
      clearInterval(sosTimerInterval);
      document.getElementById('sosTimer').textContent='گذشت! 👏';
    } else updateSOSTimerDisplay();
  },1000);
  let bIdx=0;
  const circle=document.getElementById('breathCircle');
  circle.textContent = BREATH_TEXTS[0];
  clearInterval(breathInterval);
  breathInterval = setInterval(()=>{
    bIdx=(bIdx+1)%BREATH_TEXTS.length;
    circle.textContent = BREATH_TEXTS[bIdx];
  },4000);
}
function closeSOS(){
  document.getElementById('sosOverlay').classList.remove('show');
  clearInterval(sosTimerInterval); clearInterval(breathInterval);
  document.getElementById('sosOutcomeRow').style.display='flex';
  document.getElementById('sosHaltStep').style.display='none';
}
function logUrgeEvent(resisted, halt, category){
  if(!storeData.urgeLog) storeData.urgeLog=[];
  storeData.urgeLog.push({ ts: new Date().toISOString(), hour: new Date().getHours(), resisted: !!resisted, halt: halt||{}, category: category||'other' });
  saveData();
  renderUrgeStats();
  try{ renderSmartReminderUI(); }catch(err){}
  try{ scheduleSmartReminders(); }catch(err){}
  if(!resisted){ try{ schedulePostSlipCheckin(); }catch(err){} }
}
/* ---- «وسوسه شدم» دکمه: تپ سریع = همون فلوی همیشگی. نگه‌داشتن ۴ ثانیه = دکمه قرمز
   و «آتیش می‌گیره» و همون درخواست SOS فوری قبلی (sendUrgentSOSAlert، دقیقاً با همون
   قوانین/کول‌داون/جدول موجود) فرستاده می‌شه. ---- */
const SOS_LONGPRESS_MS = 4000;
let sosPressTimer = null, sosPressRAF = null, sosPressStartTs = 0, sosLongPressFired = false;
const sosFabEl = document.getElementById('sosFab');
const sosFabFillEl = document.getElementById('sosFabFill');
function sosPressClearTimers(){
  if(sosPressTimer){ clearTimeout(sosPressTimer); sosPressTimer = null; }
  if(sosPressRAF){ cancelAnimationFrame(sosPressRAF); sosPressRAF = null; }
}
function sosPressTick(){
  const pct = Math.min(1, (Date.now() - sosPressStartTs) / SOS_LONGPRESS_MS);
  sosFabFillEl.style.opacity = String(pct);
  if(pct < 1) sosPressRAF = requestAnimationFrame(sosPressTick);
}
function sosPressBegin(e){
  if(e.button !== undefined && e.button !== 0) return; // فقط کلیک چپ/لمس، نه راست‌کلیک
  sosPressClearTimers();
  sosLongPressFired = false;
  sosPressStartTs = Date.now();
  sosFabFillEl.style.transition = 'none';
  sosFabFillEl.style.opacity = '0';
  sosFabEl.classList.add('charging');
  sosPressRAF = requestAnimationFrame(sosPressTick);
  sosPressTimer = setTimeout(()=>{
    sosLongPressFired = true;
    sosFabEl.classList.remove('charging');
    sosFabEl.classList.add('ignited');
    if(navigator.vibrate) navigator.vibrate([25,35,25]);
    sendUrgentSOSAlert();
    setTimeout(()=>{
      sosFabFillEl.style.transition = 'opacity .5s ease';
      sosFabFillEl.style.opacity = '0';
      sosFabEl.classList.remove('ignited');
    }, 500);
  }, SOS_LONGPRESS_MS);
}
function sosPressEnd(){
  sosPressClearTimers();
  sosFabEl.classList.remove('charging');
  if(!sosFabEl.classList.contains('ignited')){
    sosFabFillEl.style.transition = 'opacity .25s ease';
    sosFabFillEl.style.opacity = '0';
  }
}
sosFabEl.addEventListener('pointerdown', sosPressBegin);
['pointerup','pointerleave','pointercancel'].forEach(evt=> sosFabEl.addEventListener(evt, sosPressEnd));
sosFabEl.addEventListener('contextmenu', e=> e.preventDefault());
sosFabEl.addEventListener('click', (e)=>{
  if(sosLongPressFired){ sosLongPressFired = false; e.preventDefault(); e.stopPropagation(); return; }
  openSOS();
});
document.getElementById('sosSkip').addEventListener('click', closeSOS);
document.getElementById('sosCatSkip').addEventListener('click', closeSOS);

let pendingResisted = null;
const activeHalt = { hungry:false, angry:false, lonely:false, tired:false };
function resetHaltChips(){
  Object.keys(activeHalt).forEach(k=>activeHalt[k]=false);
  document.querySelectorAll('.halt-chip').forEach(c=>c.classList.remove('active'));
}
document.querySelectorAll('.halt-chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    const key = chip.dataset.halt;
    activeHalt[key] = !activeHalt[key];
    chip.classList.toggle('active', activeHalt[key]);
  });
});
function showHaltStep(resisted){
  pendingResisted = resisted;
  resetHaltChips();
  document.getElementById('sosOutcomeRow').style.display='none';
  document.getElementById('sosHaltStep').style.display='block';
}
document.getElementById('sosWinBtn').addEventListener('click', ()=> showHaltStep(true));
document.getElementById('sosSlipBtn').addEventListener('click', ()=> showHaltStep(false));
document.getElementById('haltConfirmBtn').addEventListener('click', ()=>{
  logUrgeEvent(pendingResisted, {...activeHalt}, pendingCategory);
  closeSOS();
  showToast(pendingResisted ? 'دمت گرم، همینو ادامه بده 💪' : 'مهم نیست، فردا دوباره شروع کن 💛');
  document.getElementById('sosOutcomeRow').style.display='flex';
  document.getElementById('sosHaltStep').style.display='none';
});

function bucketLabel(hour){
  if(hour>=6 && hour<12) return 'صبح';
  if(hour>=12 && hour<18) return 'ظهر/عصر';
  if(hour>=18 && hour<24) return 'شب';
  return 'سحر';
}
function renderUrgeStats(){
  const log = storeData.urgeLog || [];
  const row = document.getElementById('urgeStatsRow');
  const barsEl = document.getElementById('urgeBars');
  const emptyEl = document.getElementById('urgeEmptyMsg');
  const haltEl = document.getElementById('haltBreakdown');
  const hintEl = document.getElementById('urgeHint');
  if(log.length===0){
    row.innerHTML=''; barsEl.innerHTML=''; haltEl.innerHTML=''; hintEl.style.display='none';
    emptyEl.style.display='block';
    return;
  }
  emptyEl.style.display='none';
  const total=log.length;
  const resisted=log.filter(e=>e.resisted).length;
  const rate=Math.round((resisted/total)*100);
  row.innerHTML = `<span>کل وسوسه‌های ثبت‌شده: <b>${total}</b></span><span>نرخ مقاومت: <b>${rate}%</b></span>`;
  const buckets=['صبح','ظهر/عصر','شب','سحر'];
  const counts={};
  buckets.forEach(b=>counts[b]=0);
  log.forEach(e=>{ counts[bucketLabel(e.hour)]++; });
  const maxCount = Math.max(1, ...buckets.map(b=>counts[b]));
  barsEl.innerHTML = buckets.map(b=>{
    const h = Math.round((counts[b]/maxCount)*56)+6;
    return `<div class="urge-bar-col"><div class="urge-bar" style="height:${h}px"></div><div class="urge-bar-label">${b}<br>${counts[b]}</div></div>`;
  }).join('');
  const haltLabels = {hungry:'گرسنگی',angry:'عصبانیت/استرس',lonely:'تنهایی',tired:'خستگی'};
  const haltCounts = {hungry:0,angry:0,lonely:0,tired:0};
  log.forEach(e=>{ if(e.halt){ Object.keys(haltCounts).forEach(k=>{ if(e.halt[k]) haltCounts[k]++; }); } });
  const topHalt = Object.keys(haltCounts).sort((a,b)=>haltCounts[b]-haltCounts[a])[0];
  if(haltCounts[topHalt]>0){
    haltEl.textContent = `بیشترین عامل همراه وسوسه: ${haltLabels[topHalt]} (${haltCounts[topHalt]} بار)`;
  } else { haltEl.textContent=''; }
  hintEl.style.display = total>=5 ? 'block' : 'none';
}

/* ---------------- Crisis safety net (local, instant, no API needed) ---------------- */
const CRISIS_PATTERNS = [
  /خودکش/i, /خودم\s*رو\s*بکشم/i, /خودمو\s*بکشم/i, /نمی[‌ ]?خوام\s*زندگی\s*کنم/i,
  /دیگه\s*نمی[‌ ]?تونم\s*ادامه\s*بدم/i, /به\s*زندگیم\s*پایان/i, /می[‌ ]?خوام\s*بمیرم/i,
  /دلم\s*می[‌ ]?خواد\s*بمیرم/i, /خودآزاری/i, /به\s*خودم\s*آسیب/i, /ارزش\s*زندگی\s*کردن\s*ندارم/i
];
function checkCrisisText(text){
  if(!text) return false;
  return CRISIS_PATTERNS.some(rx=>rx.test(text));
}
function renderCrisisBanner(targetElId){
  const el = document.getElementById(targetElId);
  if(!el) return;
  el.innerHTML = `<div class="crisis-banner">
    <h4>🤍 لطفاً با این حس تنها نمون</h4>
    <p>چیزی که نوشتی نشون می‌ده این روزها واقعاً سخت گذشته. این حس مهمه؛ ارزش داره همین الان با یه آدم واقعی درموردش حرف بزنی، نه فقط یه اپ.</p>
    <div class="crisis-numbers">
      <a href="tel:123">📞 ۱۲۳ (اورژانس اجتماعی، شبانه‌روزی و رایگان)</a>
      <a href="tel:1480">📞 ۱۴۸۰ (مشاوره روان‌شناسی بهزیستی)</a>
    </div>
    <span class="crisis-dismiss" id="crisisDismiss_${targetElId}">فهمیدم، بستن</span>
  </div>`;
  const dismiss = document.getElementById('crisisDismiss_'+targetElId);
  if(dismiss) dismiss.addEventListener('click', ()=>{ el.innerHTML=''; });
}
let noteCheckTimeout=null;
document.getElementById('noteArea').addEventListener('input', ()=>{
  clearTimeout(noteCheckTimeout);
  noteCheckTimeout = setTimeout(()=>{
    if(checkCrisisText(entry.note)) renderCrisisBanner('crisisBannerSlot');
  }, 700);
});
let lessonCheckTimeout=null;
document.getElementById('lessonArea').addEventListener('input', ()=>{
  clearTimeout(lessonCheckTimeout);
  lessonCheckTimeout = setTimeout(()=>{
    if(checkCrisisText(entry.lesson)) renderCrisisBanner('crisisBannerSlot');
  }, 700);
});

/* ---------------- Mood check-in (slider) ---------------- */
const MOOD_SLIDER_META = {
  1:{emoji:'😞',label:'افتضاح'},
  2:{emoji:'😕',label:'بد'},
  3:{emoji:'😐',label:'معمولی'},
  4:{emoji:'🙂',label:'خوب'},
  5:{emoji:'😄',label:'عالی'}
};
const moodSliderEl = document.getElementById('moodSlider');
if(moodSliderEl){
  moodSliderEl.addEventListener('input', (e)=>{
    entry.mood = parseInt(e.target.value,10);
    renderMoodUI();
    saveData();
  });
}
function renderMoodUI(){
  const val = entry.mood!=null ? entry.mood : 3;
  const meta = MOOD_SLIDER_META[val] || MOOD_SLIDER_META[3];
  const slider = document.getElementById('moodSlider'); if(slider) slider.value = val;
  const emojiEl = document.getElementById('moodSliderEmoji'); if(emojiEl) emojiEl.textContent = meta.emoji;
  const labelEl = document.getElementById('moodSliderLabel'); if(labelEl) labelEl.textContent = meta.label;
}

/* ---------------- If-then plan (implementation intention) ---------------- */
document.getElementById('ifThenArea').addEventListener('input', (e)=>{
  storeData.profile.ifThenPlan = e.target.value;
  saveData();
});
function renderIfThenUI(){
  const box = document.getElementById('ifThenSection');
  const area = document.getElementById('ifThenArea');
  const has = storeData.profile && storeData.profile.ifThenPlan;
  area.value = has || '';
  box.style.display = has ? 'block' : 'none';
}

/* ---------------- Weight check-in (compared against goal weight, if set) ---------------- */
document.getElementById('nightWeightInput').addEventListener('input', (e)=>{
  entry.weight = e.target.value===""? null : parseFloat(e.target.value);
  saveData();
  renderNightWeightNote();
  renderWeightProgress();
});
function renderNightWeightNote(){
  const note = document.getElementById('nightWeightNote');
  if(!note) return;
  const goal = storeData.profile.goalWeight;
  const w = entry.weight;
  if(!goal){
    note.textContent = 'اگه تو «ویرایش پروفایل» وزن هدف رو مشخص کنی، اینجا می‌تونی وزن روزانه‌تو ثبت کنی و پیشرفتتو ببینی.';
    return;
  }
  if(w==null){
    note.textContent = 'وزن امشب رو ثبت کن تا با وزن هدفت ('+toFa(goal)+' kg) مقایسه‌ش کنم.';
    return;
  }
  const diff = +(w - goal).toFixed(1);
  if(Math.abs(diff) < 0.05){
    note.textContent = '🎉 دقیقاً به وزن هدفت رسیدی!';
  } else if(diff > 0){
    note.textContent = toFa(Math.abs(diff))+' کیلوگرم بالاتر از وزن هدفت ('+toFa(goal)+' kg) هستی.';
  } else {
    note.textContent = toFa(Math.abs(diff))+' کیلوگرم پایین‌تر از وزن هدفت ('+toFa(goal)+' kg) هستی.';
  }
}

/* ---------------- Energy + physical symptom check-in ---------------- */
document.getElementById('energyInput').addEventListener('input', (e)=>{
  entry.energy = parseInt(e.target.value,10);
  document.getElementById('energyNum').textContent = toFa(entry.energy);
  saveData();
});
document.querySelectorAll('#symptomGrid .symptom-chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    const key = chip.dataset.val;
    if(!entry.symptoms) entry.symptoms = {};
    entry.symptoms[key] = !entry.symptoms[key];
    chip.classList.toggle('active', !!entry.symptoms[key]);
    saveData();
    checkWellnessStreak();
  });
});

/* ---------------- Phone usage ---------------- */
const PHONE_LIMITS_STRICT = { p1:4, p2:3, p3:2, p4:1.5, p5:1.5, peak:1.5 };
const PHONE_LIMITS_LOOSE  = { p1:6, p2:5, p3:4.5, p4:4, p5:3.5, peak:3.5 };
function getPhoneLimit(){
  const isFocus = (storeData.profile && storeData.profile.addictions || []).includes('phone');
  const table = isFocus ? PHONE_LIMITS_STRICT : PHONE_LIMITS_LOOSE;
  return table[currentPhase.key] || 2;
}
function updatePhoneStatus(){
  const el = document.getElementById('phoneStatus');
  const val = entry.phoneHours;
  if(val===null || val===undefined || val===""){ el.textContent=""; el.className="phone-status"; return; }
  const limit = getPhoneLimit();
  if(val<=limit){
    el.textContent = "خوبه، امروز کنترل خوبی روی گوشی داشتی 👏";
    el.className = "phone-status good";
  } else if(val<=limit*1.4){
    el.textContent = "یکم بالاتر از حد این مرحله («+ زیر "+limit+" ساعت») بود — فردا بیشتر مراقب باش.";
    el.className = "phone-status warn";
  } else {
    el.textContent = "امروز گوشی خیلی وقتتو گرفت، این با هدفت هم‌مسیر نیست. جدی‌تر روش کار کن.";
    el.className = "phone-status bad";
  }
}
document.getElementById('phoneHoursInput').addEventListener('input',(e)=>{
  const v = e.target.value;
  entry.phoneHours = v===""? null : parseFloat(v);
  updatePhoneStatus();
  saveData();
});

/* ---------------- Selfie archive ---------------- */
function resizeImageFile(file, maxW){
  return new Promise((resolve,reject)=>{
    const img = new Image();
    const reader = new FileReader();
    reader.onload = ()=>{ img.src = reader.result; };
    reader.onerror = reject;
    img.onload = ()=>{
      const scale = Math.min(1, maxW/img.width);
      const w = Math.round(img.width*scale), h = Math.round(img.height*scale);
      const c = document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      resolve(c.toDataURL('image/jpeg', 0.65));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function loadTodaySelfie(){
  try{
    const res = await window.storage.get('checklist:selfie:'+today, false);
    if(res && res.value){
      document.getElementById('selfieTodayThumb').style.backgroundImage = `url(${res.value})`;
      document.getElementById('selfieTodayThumb').textContent = "";
      document.getElementById('selfieHint').textContent = "سلفی امروز ثبت شده — برای عوض کردن دوباره بزن";
    }
  }catch(e){ /* no selfie yet for today */ }
}
document.getElementById('selfieTodayThumb').addEventListener('click', ()=>{
  document.getElementById('selfieInput').click();
});
document.getElementById('selfieInput').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  try{
    const dataUrl = await resizeImageFile(file, 480);
    await window.storage.set('checklist:selfie:'+today, dataUrl, false);
    document.getElementById('selfieTodayThumb').style.backgroundImage = `url(${dataUrl})`;
    document.getElementById('selfieTodayThumb').textContent = "";
    document.getElementById('selfieHint').textContent = "سلفی امروز ثبت شد ✅";
    showToast("سلفی امروز ذخیره شد");
    selfieGalleryCache = null;
    storeData.selfieCount = (storeData.selfieCount||0) + 1;
    saveData();
    renderBadges();
  }catch(err){ showToast("مشکلی تو ذخیره عکس پیش اومد", 'error'); }
  e.target.value = "";
});
let selfieGalleryLoaded = false;
let selfieGalleryCache = null;
document.getElementById('galleryToggle').addEventListener('click', async ()=>{
  const grid = document.getElementById('selfieGrid');
  const toggle = document.getElementById('galleryToggle');
  const opening = grid.style.display === 'none';
  grid.style.display = opening ? 'grid' : 'none';
  toggle.textContent = opening ? 'بستن آرشیو ▴' : 'دیدن آرشیو ▾';
  if(opening && !selfieGalleryCache){
    grid.innerHTML = '<div class="selfie-empty">در حال بارگذاری...</div>';
    try{
      const list = await window.storage.list('checklist:selfie:', false);
      const keys = (list && list.keys) ? list.keys.slice().sort().reverse() : [];
      if(keys.length===0){ grid.innerHTML = '<div class="selfie-empty">هنوز سلفی‌ای ثبت نشده.</div>'; return; }
      const cells = [];
      for(const k of keys){
        try{
          const r = await window.storage.get(k, false);
          if(r && r.value){
            const dateLabel = k.replace('checklist:selfie:','');
            cells.push(`<div class="cell"><img src="${r.value}"><span class="d">${dateLabel.slice(5)}</span></div>`);
          }
        }catch(e){}
      }
      selfieGalleryCache = cells.join('');
      grid.innerHTML = selfieGalleryCache || '<div class="selfie-empty">هنوز سلفی‌ای ثبت نشده.</div>';
    }catch(e){ grid.innerHTML = '<div class="selfie-empty">خطا در بارگذاری آرشیو.</div>'; }
  }
});

/* ---------------- Workout body compare (today vs start) ---------------- */
function setWoBodyBox(boxId, dataUrl){
  const box = document.getElementById(boxId);
  if(!box) return;
  box.style.backgroundImage = `url(${dataUrl})`;
  box.classList.add('has-img');
}
async function loadWoBodyPhotos(){
  try{
    const startRes = await window.storage.get('checklist:wobodystart', false);
    if(startRes && startRes.value) setWoBodyBox('woBodyStartBox', startRes.value);
  }catch(e){ /* no start photo yet */ }
  try{
    const todayRes = await window.storage.get('checklist:wobody:'+today, false);
    if(todayRes && todayRes.value) setWoBodyBox('woBodyTodayBox', todayRes.value);
  }catch(e){ /* no today photo yet */ }
}
document.getElementById('woBodyTodayBox').addEventListener('click', ()=>{
  document.getElementById('woBodyTodayInput').click();
});
document.getElementById('woBodyStartBox').addEventListener('click', ()=>{
  document.getElementById('woBodyStartInput').click();
});
document.getElementById('woBodyTodayInput').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  try{
    const dataUrl = await resizeImageFile(file, 480);
    await window.storage.set('checklist:wobody:'+today, dataUrl, false);
    setWoBodyBox('woBodyTodayBox', dataUrl);
    let hadStart = true;
    try{ await window.storage.get('checklist:wobodystart', false); }catch(err){ hadStart = false; }
    if(!hadStart){
      await window.storage.set('checklist:wobodystart', dataUrl, false);
      setWoBodyBox('woBodyStartBox', dataUrl);
    }
    showToast('عکس امروز ذخیره شد ✅');
  }catch(err){ showToast('مشکلی تو ذخیره عکس پیش اومد', 'error'); }
  e.target.value = '';
});
document.getElementById('woBodyStartInput').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  try{
    const dataUrl = await resizeImageFile(file, 480);
    await window.storage.set('checklist:wobodystart', dataUrl, false);
    setWoBodyBox('woBodyStartBox', dataUrl);
    showToast('عکس شروع مسیر ذخیره شد ✅');
  }catch(err){ showToast('مشکلی تو ذخیره عکس پیش اومد', 'error'); }
  e.target.value = '';
});

/* ---------------- Night review (meals + AI mentor) ---------------- */
document.getElementById('heightInput').addEventListener('input',(e)=>{
  storeData.profile.height = e.target.value===""? null : parseFloat(e.target.value);
  saveData();
  renderProfileSummaryCard();
});
document.getElementById('weightInput').addEventListener('input',(e)=>{
  storeData.profile.weight = e.target.value===""? null : parseFloat(e.target.value);
  saveData();
  renderProfileSummaryCard();
});
document.getElementById('goalWeightInput').addEventListener('input',(e)=>{
  storeData.profile.goalWeight = e.target.value===""? null : parseFloat(e.target.value);
  saveData();
  renderProfileSummaryCard();
  renderNightWeightNote();
  renderWeightProgress();
});
function renderProfileSummaryCard(){
  const card = document.getElementById('profileSummaryCard');
  if(!card) return;
  const p = storeData.profile || defaultProfile();
  const name = [p.firstName,p.lastName].filter(Boolean).join(' ') || 'دوست من';
  const tags = [];
  if(p.age) tags.push(toFa(p.age)+' ساله');
  if(p.maritalStatus) tags.push(MARITAL_LABELS[p.maritalStatus]||'');
  if(p.goal) tags.push(goalLabel(p.goal));
  if(p.exerciseAccess) tags.push({gym:'دسترسی به باشگاه',home:'تمرین در خونه',none:'فعلاً بدون ورزش'}[p.exerciseAccess]||'');
  (p.addictions||[]).forEach(a=> tags.push(a==='other'? otherLabel() : (ADDICTION_LABELS[a]||a)));
  (p.goodHabits||[]).forEach(g=> tags.push('🌱 '+(g==='other'? otherGoodLabel() : (GOOD_HABIT_LABELS[g]||g))));
  if(p.health && p.health.hasCondition && p.health.considerInPlan!==false) tags.push('🩺 سلامت: در نظر گرفته می‌شه');
  const rw = rewardText(p), pn = punishText(p);
  const commitmentHtml =
    (rw ? `<div class="commitment-row reward">🟢 <span>پاداش هدفت: <b>${rw}</b></span></div>` : '') +
    (pn ? `<div class="commitment-row punish">🔴 <span>تاوان لغزش بزرگ: <b>${pn}</b></span></div>` : '');
  card.innerHTML = `<div class="profile-summary-name">👋 ${name}</div>
    <div class="profile-tags">${tags.filter(Boolean).map(t=>`<span class="profile-tag">${t}</span>`).join('')}</div>
    ${commitmentHtml}`;
}
document.getElementById('editProfileBtn').addEventListener('click', ()=>{
  openOnboarding(true);
});
['mealBreakfast','mealLunch','mealDinner','mealSnacks'].forEach((id,i)=>{
  const map=['b','l','d','snacks'];
  document.getElementById(id).addEventListener('input',(e)=>{
    entry.meals[map[i]] = e.target.value;
    saveData();
  });
});
function renderNightResult(){
  const box = document.getElementById('nightResult');
  const r = entry.nightReview;
  if(!r){ box.style.display='none'; return; }
  const targets = computeNutritionTargets(storeData.profile);
  const pct = Math.max(0, Math.min(100, Math.round((r.protein/targets.proteinTarget)*100)));
  box.innerHTML = `
    <div class="result-row"><span>کالری تقریبی امروز</span><b>${r.calories||'-'} / ~${targets.calorieTarget} kcal</b></div>
    <div class="result-row"><span>پروتئین تقریبی</span><b>${r.protein||0} / ${targets.proteinTarget} گرم</b></div>
    <div class="protein-bar-wrap"><div class="protein-bar-fill" style="width:${pct}%"></div></div>
    <div class="result-feedback">${r.feedback||''}</div>
    ${(r.issues&&r.issues.length)?`<div class="result-list-title">مهم‌ترین ایرادهای امروز</div><ul class="result-list issues">${r.issues.map(i=>`<li>${i}</li>`).join('')}</ul>`:''}
    ${(r.tips&&r.tips.length)?`<div class="result-list-title">برای فردا</div><ul class="result-list tips">${r.tips.map(i=>`<li>${i}</li>`).join('')}</ul>`:''}
  `;
  box.style.display='block';
}
const SYMPTOM_LABELS = {dizzy:'سرگیجه',noappetite:'بی‌اشتهایی',headache:'سردرد شدید',heartrace:'تپش قلب',lowsleep:'بی‌خوابی شدید'};
function checkWellnessStreak(){
  const days = Object.keys(storeData.entries||{}).sort().slice(-5);
  let concerningDays = 0;
  days.forEach(k=>{ const e=storeData.entries[k]; if(e && e.symptoms && Object.values(e.symptoms).some(Boolean)) concerningDays++; });
  const banner = document.getElementById('wellnessBanner');
  if(!banner) return;
  if(concerningDays>=2){
    banner.style.display='block';
    banner.textContent = 'چند روز اخیر علائم جسمی ثبت کردی. این تشخیص پزشکی نیست، ولی بهتره این علائم رو با یه پزشک واقعی در میون بذاری، مخصوصاً اگه ادامه‌دار بودن.';
  } else { banner.style.display='none'; }
}
document.getElementById('nightReviewBtn').addEventListener('click', async ()=>{
  if(!gateDailyFeature('nightReview', 'مرور شب')) return;
  const btn = document.getElementById('nightReviewBtn');
  btn.disabled = true; btn.textContent = 'در حال تحلیل...';
  try{
    const pct = Math.round((computeChecked()/totalToday())*100);
    const targets = computeNutritionTargets(storeData.profile);
    const phone = entry.phoneHours!==null && entry.phoneHours!==undefined ? entry.phoneHours : 'ثبت نشده';
    const symptomsList = Object.keys(entry.symptoms||{}).filter(k=>entry.symptoms[k]).map(k=>SYMPTOM_LABELS[k]).join('، ') || 'چیزی گزارش نشده';
    const moodLabels = {1:'افتضاح',2:'بد',3:'معمولی',4:'خوب',5:'عالی'};
    const moodText = entry.mood ? (entry.mood+'/۵ ('+moodLabels[entry.mood]+')') : 'ثبت نشده';
    const goalW = storeData.profile.goalWeight;
    let weightLine = '';
    if(entry.weight!=null && goalW){
      const diff = +(entry.weight - goalW).toFixed(1);
      weightLine = Math.abs(diff)<0.05
        ? `وزن امروزش: ${entry.weight} کیلوگرم — دقیقاً به وزن هدفش (${goalW} کیلوگرم) رسیده. `
        : `وزن امروزش: ${entry.weight} کیلوگرم. وزن هدفش: ${goalW} کیلوگرم (فعلاً ${Math.abs(diff)} کیلوگرم ${diff>0?'بالاتر':'پایین‌تر'} از هدفشه). اگه به‌نظرت مربوطه، یه اشاره‌ی کوتاه و دلگرم‌کننده به این روند تو feedback بکن. `;
    }
    const sys = personaSystemPrompt("تو یه مربی و منتور سبک‌زندگی سالم برای همین کاربر هستی، لحن مستقیم و صادق ولی حمایتگر داری، دقیقاً بر اساس هدف بدنی و عادت‌هایی که بالا نوشته شده صحبت کن، نه یه فرض کلی.");
    const prompt = `امروز روز ${programDay()} از یه برنامه‌ی ${storeData.programLength} روزه است، مرحله فعلی: ${currentPhase.name}.
درصد انجام کارهای امروز چک‌لیست: ${pct}%.
ساعت استفاده از گوشی امروز: ${phone} ساعت (سقف پیشنهادی این مرحله حدود ${getPhoneLimit()} ساعت).
حال‌وهوای امروز (۱ تا ۵، با اسلایدر ثبت شده): ${moodText}.
سطح انرژی امروز (۱ تا ۵): ${entry.energy||'ثبت نشده'}. علائم جسمی گزارش‌شده: ${symptomsList}.
${weightLine}هدف تقریبی کالری/پروتئین امروز بر اساس مشخصاتش: حدود ${targets.calorieTarget} کالری و ${targets.proteinTarget} گرم پروتئین.
وعده‌های غذایی امروز:
صبحانه: ${entry.meals.b||'چیزی ثبت نشده'}
ناهار: ${entry.meals.l||'چیزی ثبت نشده'}
شام: ${entry.meals.d||'چیزی ثبت نشده'}
متفرقه: ${entry.meals.snacks||'چیزی ثبت نشده'}

فقط و فقط یک آبجکت JSON معتبر برگردون (بدون هیچ متن اضافه، بدون Markdown، بدون backtick) دقیقاً با این ساختار:
{"calories": <عدد صحیح، تخمین کل کالری وعده‌ها>, "protein": <عدد صحیح، تخمین گرم پروتئین دریافتی>, "feedback": "<۲ تا ۳ جمله کوتاه فارسی، صادقانه و مربی‌گونه درباره عملکرد کلی امروز، با توجه به هدف، حال‌وهوا و انرژی/علائمش>", "issues": ["<حداکثر ۳ مورد کوتاه فارسی، مهم‌ترین ایرادهای امروز>"], "tips": ["<حداکثر ۳ پیشنهاد کوتاه و عملی فارسی برای فردا>"]}`;
    const __auth = await authHeaders();
    const response = await fetch("https://groq-proxy.mahdihd648.workers.dev", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, __auth),
      body: JSON.stringify({
        feature: "nightReview",
        max_tokens: 1000,
        system: sys,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await response.json();
    if(!response.ok){
      handleAiWorkerError(response, data);
      return;
    }
    const rawText = data.reply || '';
    const clean = rawText.replace(/```json|```/g,'').trim();
    const parsed = JSON.parse(clean);
    entry.nightReview = parsed;
    saveData();
    markAIFeatureUsed('nightReview');
    renderNightResult();
    checkWellnessStreak();
    showToast('تحلیل امشب آماده شد', 'success');
  }catch(err){
    console.error(err);
    showToast('پاسخ نامعتبر بود، دوباره امتحان کن', 'error');
  }finally{
    btn.disabled = false;
    btn.textContent = entry.nightReview ? '🔄 دوباره تحلیل کن' : '✅ تایید و تحلیل امشب';
  }
});

function programDay(){
  if(!storeData.startDate) return 0;
  const diff = Math.floor((dateOnly(today) - dateOnly(storeData.startDate)) / 86400000);
  return diff + 1;
}
// همون معیاری که خودِ روزشمار زنده‌ی کارت «امروز» (streakLiveGrid / updateLiveCounter)
// نشون می‌ده: تعداد روزهای کامل و دقیقاً سپری‌شده از startTimestamp تا همین لحظه —
// نه شماره‌ی روزِ تقویمیِ برنامه (programDay، که با +۱ و بر مبنای تاریخ حساب می‌شه و
// می‌تونه از روزشمار واقعی جلوتر بزنه، مثلاً وقتی نیمه‌شب رد شده ولی هنوز ۲۴ ساعت
// کامل نگذشته). فقط همون‌جاهایی استفاده می‌شه که باید دقیقاً با عددِ کارتِ روزشمار
// یکی باشه: ارسال/مقایسه‌ی day_count برای رتبه‌بندی (لیدربورد) و کارت «روز برنامه»ی
// تب پروفایل. بقیه‌ی جاهایی که از programDay() استفاده می‌کنن (باز شدن محتوا بر اساس
// روز، مرحله‌ی برنامه، پرامپت‌های هوش مصنوعی، تطبیق سطح تو SOS و...) دست‌نخورده می‌مونن.
function liveElapsedDays(){
  if(!storeData.startTimestamp) return 0;
  const startMs = new Date(storeData.startTimestamp).getTime();
  if(isNaN(startMs)) return 0;
  return Math.floor(Math.max(0, Date.now() - startMs) / 86400000);
}

function computeChecked(){
  let c=0;
  getDoItems().forEach((_,i)=>{ if(entry.done[i]) c++; });
  getAvoidItems().forEach((_,i)=>{ if(entry.avoidDone[i]) c++; });
  return c;
}
function totalToday(){ return getDoItems().length + getAvoidItems().length; }

function milestoneLabel(pct){
  if(pct===0) return "شروع کن";
  if(pct<34) return "شروع خوبیه";
  if(pct<67) return "داره جلو میره";
  if(pct<100) return "به فینال نزدیکی";
  return "امروز رو بردی 🎉";
}

const MINI_CIRC = 2*Math.PI*29;
function updateMiniRing(){
  const pct = Math.round((computeChecked()/totalToday())*100);
  document.getElementById('miniFg').style.strokeDashoffset = MINI_CIRC - (pct/100)*MINI_CIRC;
  document.getElementById('miniPct').textContent = pct+'%';
  checkMilestones(pct);
  updateTodayTabBadge();
}

// Small "N/M" counter badge shown on the today (daily plan) tab button itself,
// so progress is visible without opening the tab.
function updateTodayTabBadge(){
  const badge = document.getElementById('tabBadgeToday');
  if(!badge) return;
  const total = totalToday();
  const done = computeChecked();
  if(total <= 0){ badge.style.display='none'; return; }
  badge.style.display='';
  badge.textContent = toFa(done)+'/'+toFa(total);
  badge.classList.toggle('tab-count-done', done>=total);
}

const MILESTONES=[25,50,75,100];
const MILESTONE_MSG={
  25:{emoji:"🌱",title:"شروع خوبی بود!",text:"یه قدم برداشتی، همینو ادامه بده."},
  50:{emoji:"🌿",title:"نصف راه رو رفتی!",text:"داری واقعاً جلو می‌ری."},
  75:{emoji:"🌼",title:"به خط پایان نزدیکی!",text:"فقط چندتا مونده، ادامه بده."},
  100:{emoji:"🌻🎉",title:"امروز رو بردی!",text:"خودتو ببین چقدر جلو اومدی."}
};
function checkMilestones(pct){
  MILESTONES.forEach(m=>{
    if(pct>=m && !entry.milestonesHit[m]){
      entry.milestonesHit[m]=true;
      if(m===100 && !storeData.premium && !storeData.firstDayCompleteShown){
        storeData.firstDayCompleteShown = true; saveData();
        showCelebration({emoji:MILESTONE_MSG[100].emoji, title:MILESTONE_MSG[100].title,
          text: MILESTONE_MSG[100].text + " این اولین باریه که یه روز رو کامل می‌کنی 👏 هر وقت خواستی، تو منو می‌تونی ببینی نسخه‌ی پرمیوم چه امکانات بیشتری داره 🌟"});
      } else {
        showCelebration(MILESTONE_MSG[m]);
        if(m===100) pendingInviteNudgeReason = 'daily100';
      }
      if(m===100) launchConfetti();
    }
  });
}
function showCelebration(info){
  sfxSuccess();
  const coachEl = document.getElementById('celebrateCoach');
  if(coachEl){ const genderCel = (storeData.profile && storeData.profile.gender) || ''; coachEl.innerHTML = buildCoachSVG('excited', 'celebrate', genderCel); coachEl.dataset.mood = 'excited'; coachEl.dataset.gender = genderCel; }
  document.getElementById('celebrateEmoji').textContent=info.emoji;
  document.getElementById('celebrateTitle').textContent=info.title;
  document.getElementById('celebrateText').textContent=info.text;
  document.getElementById('celebrateOverlay').classList.add('show');
}
/* Shown once, right after a premium purchase (or restore) is confirmed by the server —
   a dedicated hopeful/motivating moment (message + journey visualizer), separate from the
   generic daily-milestone celebrateOverlay above. */
function showPremiumSuccessCelebration(){
  sfxSuccess();
  document.getElementById('premSuccessOverlay').classList.add('show');
  launchConfetti();
}
document.getElementById('premSuccessClose').addEventListener('click',()=>{
  document.getElementById('premSuccessOverlay').classList.remove('show');
});
document.getElementById('celebrateClose').addEventListener('click',()=>{
  document.getElementById('celebrateOverlay').classList.remove('show');
  if(typeof celebrationQueue !== 'undefined' && celebrationQueue.length){
    setTimeout(()=>showNextQueuedCelebration(), 400);
    return;
  }
  if(pendingInviteNudgeReason){
    const reason = pendingInviteNudgeReason;
    pendingInviteNudgeReason = null;
    setTimeout(()=>maybeShowInviteNudge(reason), 450);
  }
});

function computeStreak(){
  let streak=0; let d=new Date();
  for(let i=0;i<365;i++){
    const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const e=storeData.entries[key];
    if(!e) break;
    const done=Object.values(e.done||{}).filter(Boolean).length
      + Object.values(e.avoidDone||{}).filter(Boolean).length
      + Object.values(e.momentDone||{}).filter(Boolean).length;
    const tot = e.total || totalToday();
    const pct = Math.round((done/tot)*100);
    if(pct>=60){ streak++; d.setDate(d.getDate()-1); } else break;
  }
  return streak;
}
function updateStreakUI(){
  const s=computeStreak();
  if(s > (storeData.maxStreak||0)) storeData.maxStreak = s;
  // Header streak badge (🔥 N روز پشت‌سرهم) was removed — it widened .app-header-right and
  // broke the header layout as soon as the streak hit 1 day. Streak is still fully tracked
  // and shown elsewhere (streak-live-card, stats, milestones) — only this header pill is gone.
  try{ updateHeaderFlame(s); }catch(err){}
  try{ checkStreakMilestone(s); }catch(err){}
  try{ scheduleDailyReminders(); }catch(err){}
  try{ if(typeof syncMyBuddyDailyStatus === 'function') syncMyBuddyDailyStatus(); }catch(err){}
  try{ updateRiskNudgeUI(); }catch(err){ console.error('updateRiskNudgeUI failed', err); }
}
/* ================= Header "catches fire" with the streak =================
   Anchor days -> intensity (0..1), linearly interpolated between anchors so the glow visibly
   grows a little every single day rather than only jumping on milestone days. Capped at day 365.
   Kept deliberately subtle (alpha tops out well under 1) and fully static — no pulse/flicker —
   per instruction to not make it distracting. Color comes straight from the active theme's own
   --accent, so it's always the same hue as whatever theme the user picked, not a fixed orange. */
const FLAME_STAGES = [
  {d:0,   i:0},
  {d:1,   i:0.03},
  {d:3,   i:0.09},
  {d:7,   i:0.17},
  {d:21,  i:0.30},
  {d:30,  i:0.40},
  {d:60,  i:0.55},
  {d:90,  i:0.68},
  {d:120, i:0.80},
  {d:365, i:1.0}
];
function flameIntensityForStreak(s){
  if(!s || s<=0) return 0;
  if(s>=365) return 1;
  for(let k=0;k<FLAME_STAGES.length-1;k++){
    const a=FLAME_STAGES[k], b=FLAME_STAGES[k+1];
    if(s>=a.d && s<=b.d) return a.i + (b.i-a.i) * ((s-a.d)/(b.d-a.d));
  }
  return 1;
}
function hexToRgba(hex, alpha){
  const h=(hex||'#4338ca').replace('#','');
  const r=parseInt(h.substring(0,2),16), g=parseInt(h.substring(2,4),16), b=parseInt(h.substring(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function updateHeaderFlame(streak){
  const root = document.documentElement.style;
  const flameEl = document.getElementById('headerFlame');
  const fabFlameEl = document.getElementById('modeFabFlame');
  const s = (streak!==undefined) ? streak : computeStreak();
  const intensity = flameIntensityForStreak(s);
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4338ca';
  root.setProperty('--flame-shadow', hexToRgba(accent, (0.10 + intensity*0.42).toFixed(2)));
  root.setProperty('--flame-blur', (6 + intensity*22).toFixed(0)+'px');
  root.setProperty('--flame-spread', (intensity*5).toFixed(1)+'px');
  const active = intensity > 0.02;
  if(flameEl) flameEl.classList.toggle('flame-active', active);
  if(fabFlameEl) fabFlameEl.classList.toggle('flame-active', active);
}

/* ==================== Motivation risk engine (early churn detection) ====================
   Everything the app tracked before only reacted AFTER the streak was already fully broken
   (see the streak===0 branch in getCoachData). This looks one layer earlier: it trends the
   last 10 real days of entries and catches a *fading* pattern — completion quietly dropping —
   while the user is often still opening the app and the streak may still technically be alive.
   A missing day counts as 0%. Entirely local/derived from storeData.entries; no server call. */
function dayCompletionPct(key){
  const e = storeData.entries[key];
  if(!e) return 0;
  const done = Object.values(e.done||{}).filter(Boolean).length
    + Object.values(e.avoidDone||{}).filter(Boolean).length
    + Object.values(e.momentDone||{}).filter(Boolean).length;
  const tot = e.total || totalToday();
  return tot>0 ? Math.round((done/tot)*100) : 0;
}
function computeMotivationRisk(){
  if(!storeData.startDate || programDay() < 5) return { level:'none' }; // not enough history yet
  const pctList = [];
  for(let i=1;i<=10;i++) pctList.push(dayCompletionPct(addDaysToKey(todayKey(), -i))); // [yesterday..10 days ago]
  const recent3 = pctList.slice(0,3), prior4 = pctList.slice(3,7);
  const avgRecent = recent3.reduce((a,b)=>a+b,0)/recent3.length;
  const avgPrior = prior4.reduce((a,b)=>a+b,0)/prior4.length;
  if(avgPrior < 20) return { level:'none' }; // wasn't really engaged before either — nothing new to flag
  const lowDays = recent3.filter(p=>p<40).length;
  const drop = avgPrior - avgRecent;
  if(lowDays>=3 || drop>=35) return { level:'high', avgRecent, avgPrior, drop };
  if(lowDays>=2 || drop>=18) return { level:'watch', avgRecent, avgPrior, drop };
  return { level:'none', avgRecent, avgPrior, drop };
}
const RISK_NUDGE_MSGS = {
  watch:[
    'چند روز اخیر یکم کم‌رنگ‌تر بودی. طبیعیه — فقط برای امروز، سبک‌ترش کن.',
    'حس می‌کنم داری آروم‌آروم فاصله می‌گیری. یه کار کوچیک امروز کافیه که برگردی به مسیر.',
    'روند این چند روزت یکم نزولی بوده. لازم نیست همه چی رو جبران کنی، همین امروز رو ساده شروع کن.'
  ],
  high:[
    'چند روزیه خیلی کم بهم سر زدی. نگران نیستم که ول کردی، نگرانم که سخت‌ترش کردی. بیا امروز خیلی ساده شروع کنیم.',
    'می‌دونم این روزا سخت بوده. به‌جای کل برنامه، فقط یکی از کارای امروز رو با هم تیک بزنیم؟',
    'رکورد قبلیت رو یادمه. یه شروع کوچیک امروز، دقیقاً همون چیزیه که لازم داری.'
  ]
};
function riskNudgeCopy(level){
  const name = (storeData.profile && storeData.profile.firstName) ? storeData.profile.firstName.trim() : '';
  const namePart = name ? (name+'، ') : '';
  return namePart + seededPick(RISK_NUDGE_MSGS[level], todayKey()+'-risk-'+level);
}
/* Shows at most once per day per level, and respects an explicit dismiss for today —
   this is a gentle nudge, not a nag. Re-appears tomorrow if the pattern is still there. */
function updateRiskNudgeUI(){
  const banner = document.getElementById('riskNudgeBanner');
  if(!banner) return;
  const risk = computeMotivationRisk();
  if(!storeData.riskNudge) storeData.riskNudge = {dismissedKey:null, lastNotifLevel:null};
  const dismissedToday = storeData.riskNudge.dismissedKey === todayKey();
  if(risk.level==='none' || dismissedToday){
    banner.style.display = 'none';
  } else {
    document.getElementById('riskNudgeText').textContent = riskNudgeCopy(risk.level);
    banner.style.display = 'flex';
  }
  try{ scheduleRiskInterventionNudge(risk); }catch(err){ console.error('scheduleRiskInterventionNudge failed', err); }
}
/* Proactive local notification (separate from the reactive 2-day "you went silent" one):
   scheduled for tomorrow morning WHILE the user is still opening the app, the moment the
   fading pattern is detected — this is the part that actually catches someone before they
   go fully silent, instead of only reacting after the fact. Cancelled/rescheduled on every
   render so it always reflects the current risk level and never stacks duplicates. */
const RISK_NOTIF_ID = 9302;
async function scheduleRiskInterventionNudge(risk){
  const plugin = getLN();
  if(!plugin) return;
  try{ await plugin.cancel({ notifications:[{id:RISK_NOTIF_ID}] }); }catch(err){}
  if(!storeData.reminder.enabled || !risk || risk.level==='none') return;
  try{
    const perm = await plugin.requestPermissions();
    if(perm.display !== 'granted') return;
  }catch(err){ return; }
  const at = new Date(Date.now() + 24*60*60*1000);
  at.setHours(10,0,0,0);
  if(at.getTime() <= Date.now()) at.setDate(at.getDate()+1);
  try{
    await plugin.schedule({ notifications:[{ id:RISK_NOTIF_ID, title:'🌱 یه شروع کوچیک امروز', body: riskNudgeCopy(risk.level), schedule:{ at } }] });
  }catch(err){ console.error('scheduleRiskInterventionNudge failed', err); }
}
document.getElementById('riskNudgeCloseBtn').addEventListener('click', ()=>{
  storeData.riskNudge.dismissedKey = todayKey();
  saveData();
  document.getElementById('riskNudgeBanner').style.display = 'none';
});
document.getElementById('riskNudgeBtn').addEventListener('click', ()=>{
  storeData.riskNudge.dismissedKey = todayKey();
  saveData();
  document.getElementById('riskNudgeBanner').style.display = 'none';
  // Jump to the daily program and highlight the first unfinished item — the whole point
  // is to remove friction: don't ask them to plan, just point at ONE easy next action.
  const subBtn = document.querySelector('.subseg button[data-sub="program"]');
  if(subBtn) subBtn.click();
  setTimeout(()=>{
    const items = document.querySelectorAll('#doList .item:not(.checked), #avoidList .item:not(.checked)');
    const first = items[0];
    if(first){
      first.scrollIntoView({behavior:'smooth', block:'center'});
      first.classList.add('risk-nudge-highlight');
      setTimeout(()=> first.classList.remove('risk-nudge-highlight'), 2600);
    }
  }, 250);
  showToast('همین یکی برای امروز کافیه 🌱', 'success');
});

/* ---------------- Mountain journey ---------------- */
const trailPath = document.getElementById('trailPath');
function pointOnQuad(t, p0, p1, p2){
  const x = (1-t)*(1-t)*p0.x + 2*(1-t)*t*p1.x + t*t*p2.x;
  const y = (1-t)*(1-t)*p0.y + 2*(1-t)*t*p1.y + t*t*p2.y;
  return {x,y};
}
const P0={x:45,y:172}, P1={x:120,y:150}, P2={x:165,y:60};

function toFaNum2(n){ return toFa(String(n).padStart(2,'0')); }
function renderPersianDateLine(){
  const el = document.getElementById('streakLiveDate');
  if(!el) return;
  try{
    const fmt = new Intl.DateTimeFormat('fa-IR', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
    const parts = {};
    fmt.formatToParts(new Date()).forEach(p=>{ parts[p.type] = p.value; });
    if(parts.day && parts.month && parts.year){
      el.textContent = `امروز ${parts.weekday?parts.weekday+'، ':''}${parts.day} ${parts.month} ${parts.year}`;
    } else {
      el.textContent = 'امروز ' + fmt.format(new Date());
    }
  }catch(err){
    try{ el.textContent = 'امروز ' + new Date().toLocaleDateString('fa-IR'); }
    catch(err2){ el.textContent = ''; }
  }
}
/* ---------------- Real midnight day rollover ----------------
   `today` is normally only computed once at page load. If the app
   stays open across real midnight, this detects the clock-date change
   (not the program's day-counter) and refreshes the Today tab in place:
   new/blank entry, all checklist state cleared, inputs reset. */
function checkDayRollover(){
  const freshKey = todayKey();
  if(freshKey === today) return;
  today = freshKey;
  applyTomorrowPlanIfDue();
  currentPhase = getPhase(programDay());
  entry = storeData.entries[today] || { done:{}, avoidDone:{}, momentDone:{}, note:"", lesson:"", milestonesHit:{}, total: totalToday(),
    phoneHours:null, meals:{b:"",l:"",d:"",snacks:""}, nightReview:null, mood:null, energy:null, weight:null, symptoms:{} };
  if(!entry.milestonesHit) entry.milestonesHit={};
  if(!entry.meals) entry.meals = {b:"",l:"",d:"",snacks:""};
  if(entry.phoneHours===undefined) entry.phoneHours = null;
  if(entry.nightReview===undefined) entry.nightReview = null;
  if(entry.mood===undefined) entry.mood = null;
  if(entry.energy===undefined) entry.energy = null;
  if(entry.weight===undefined) entry.weight = null;
  if(entry.lesson===undefined) entry.lesson = "";
  if(!entry.symptoms) entry.symptoms = {};
  if(!entry.extraDoItems) entry.extraDoItems = [];
  if(!entry.extraAvoidItems) entry.extraAvoidItems = [];
  if(!entry.doOverrides) entry.doOverrides = {};
  if(!entry.avoidOverrides) entry.avoidOverrides = {};

  const noteArea = document.getElementById('noteArea'); if(noteArea) noteArea.value = entry.note||'';
  const lessonArea = document.getElementById('lessonArea'); if(lessonArea) lessonArea.value = entry.lesson||'';
  const phoneInput = document.getElementById('phoneHoursInput'); if(phoneInput) phoneInput.value = entry.phoneHours!=null?entry.phoneHours:'';
  const mB=document.getElementById('mealBreakfast'); if(mB) mB.value = entry.meals.b||'';
  const mL=document.getElementById('mealLunch'); if(mL) mL.value = entry.meals.l||'';
  const mD=document.getElementById('mealDinner'); if(mD) mD.value = entry.meals.d||'';
  const mS=document.getElementById('mealSnacks'); if(mS) mS.value = entry.meals.snacks||'';
  const nrBtn = document.getElementById('nightReviewBtn'); if(nrBtn) nrBtn.textContent = '✅ تایید و تحلیل امشب';
  const nightWeightInput = document.getElementById('nightWeightInput'); if(nightWeightInput) nightWeightInput.value = entry.weight!=null?entry.weight:'';
  const energyInput = document.getElementById('energyInput'); if(energyInput) energyInput.value = entry.energy!=null?entry.energy:3;
  const energyNum = document.getElementById('energyNum'); if(energyNum) energyNum.textContent = toFa(entry.energy!=null?entry.energy:3);
  document.querySelectorAll('#symptomGrid .symptom-chip').forEach(chip=> chip.classList.remove('active'));
  const crisisSlot = document.getElementById('crisisBannerSlot'); if(crisisSlot) crisisSlot.innerHTML = '';

  try{ renderMoodUI(); }catch(err){}
  try{ updatePhoneStatus(); }catch(err){}
  try{ renderNightResult(); }catch(err){}
  try{ renderNightWeightNote(); }catch(err){}
  try{ checkWellnessStreak(); }catch(err){}
  try{ render(); }catch(err){}
  saveData();
  try{ showToast('روز جدید شروع شد 🌅'); }catch(err){}
}
function updateLiveCounter(){
  try{
    checkDayRollover();
    renderPersianDateLine();
    const grid = document.getElementById('streakLiveGrid');
    const empty = document.getElementById('streakLiveEmpty');
    if(!grid || !empty) return;
    const startMs = storeData.startTimestamp ? new Date(storeData.startTimestamp).getTime() : NaN;
    if(!storeData.startTimestamp || isNaN(startMs)){
      grid.style.display = 'none';
      empty.style.display = 'block';
      return;
    }
    grid.style.display = 'flex';
    empty.style.display = 'none';
    let diff = Math.max(0, Date.now() - startMs);
    const days = Math.floor(diff / 86400000); diff -= days*86400000;
    const hours = Math.floor(diff / 3600000); diff -= hours*3600000;
    const minutes = Math.floor(diff / 60000); diff -= minutes*60000;
    const seconds = Math.floor(diff / 1000);
    document.getElementById('slDays').textContent = toFa(days);
    document.getElementById('slHours').textContent = toFaNum2(hours);
    document.getElementById('slMinutes').textContent = toFaNum2(minutes);
    document.getElementById('slSeconds').textContent = toFaNum2(seconds);
    try{ updateCustomCountersLive(); }catch(err2){}
  }catch(err){ console.error('Live counter error', err); }
}
let liveCounterInterval = null;
function startLiveCounter(){
  updateLiveCounter();
  clearInterval(liveCounterInterval);
  liveCounterInterval = setInterval(updateLiveCounter, 1000);
}

/* ================= Custom day-counters (user-defined, private, no rewards) =================
   The main streak-live-card above stays exactly as-is. Users can additionally create their own
   simple day-counters (e.g. "ترک ناخن جویدن") from the + card at the end of the scroll row.
   Each just tracks a name + start timestamp, is shown only to the user, and fires a congrats
   message (via the celebration queue) the first time it crosses a milestone day-count. */
const CUSTOM_COUNTER_MILESTONES = [3,7,14,21,30,45,60,90,120,180,270,365];

function daysSince(startMs){
  return Math.floor(Math.max(0, Date.now() - startMs) / 86400000);
}

function renderCustomCounters(){
  const slot = document.getElementById('customCountersSlot');
  if(!slot) return;
  const list = storeData.customCounters || [];
  slot.innerHTML = list.map(c=>{
    const days = daysSince(new Date(c.start).getTime());
    return `<div class="custom-counter-card" data-id="${c.id}">
      <div class="custom-counter-name">${escapeHtml(c.name)}</div>
      <div class="custom-counter-days-wrap">
        <span class="custom-counter-days">${toFa(days)}</span>
        <span class="custom-counter-days-label">روز</span>
      </div>
      <button class="counter-del-btn" data-del-id="${c.id}" title="حذف">✕</button>
    </div>`;
  }).join('');
  slot.querySelectorAll('.counter-del-btn').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const id = btn.getAttribute('data-del-id');
      const c = (storeData.customCounters||[]).find(x=>x.id===id);
      if(c && confirm('روزشمار «'+c.name+'» حذف بشه؟')){
        storeData.customCounters = storeData.customCounters.filter(x=>x.id!==id);
        delete storeData.customCounterMilestonesHit[id];
        saveData();
        renderCustomCounters();
      }
    });
  });
}
function updateCustomCountersLive(){
  const slot = document.getElementById('customCountersSlot');
  if(!slot) return;
  const list = storeData.customCounters || [];
  list.forEach(c=>{
    const card = slot.querySelector('.custom-counter-card[data-id="'+c.id+'"] .custom-counter-days');
    if(card) card.textContent = toFa(daysSince(new Date(c.start).getTime()));
  });
}
function openAddCounterModal(){
  const input = document.getElementById('addCounterNameInput');
  if(input) input.value = '';
  document.getElementById('addCounterOverlay').classList.add('show');
  setTimeout(()=>{ if(input) input.focus(); }, 200);
}
function closeAddCounterModal(){
  document.getElementById('addCounterOverlay').classList.remove('show');
}
function addCustomCounter(){
  const input = document.getElementById('addCounterNameInput');
  const name = (input && input.value || '').trim();
  if(!name){ if(input) input.focus(); return; }
  const c = { id: 'cc_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), name, start: new Date().toISOString() };
  if(!storeData.customCounters) storeData.customCounters = [];
  storeData.customCounters.push(c);
  saveData();
  renderCustomCounters();
  closeAddCounterModal();
  try{ showToast('روزشمار «'+name+'» ساخته شد 🎯'); }catch(err){}
  setTimeout(()=>{
    const scroller = document.getElementById('countersScroll');
    if(scroller) scroller.scrollTo({top: scroller.scrollHeight, behavior:'smooth'});
  }, 150);
}
document.getElementById('counterAddBtn') && document.getElementById('counterAddBtn').addEventListener('click', openAddCounterModal);
document.getElementById('addCounterCloseBtn') && document.getElementById('addCounterCloseBtn').addEventListener('click', closeAddCounterModal);
document.getElementById('addCounterSubmitBtn') && document.getElementById('addCounterSubmitBtn').addEventListener('click', addCustomCounter);
document.getElementById('addCounterOverlay') && document.getElementById('addCounterOverlay').addEventListener('click', (e)=>{
  if(e.target.id === 'addCounterOverlay') closeAddCounterModal();
});
document.getElementById('addCounterNameInput') && document.getElementById('addCounterNameInput').addEventListener('keydown', (e)=>{
  if(e.key === 'Enter') addCustomCounter();
});

/* Small celebration queue so several milestones hit on the same app-open (rare, but
   possible with multiple counters) are shown one after another instead of overwriting. */
let celebrationQueue = [];
function queueCelebration(info){
  celebrationQueue.push(info);
  const overlay = document.getElementById('celebrateOverlay');
  if(overlay && !overlay.classList.contains('show')) showNextQueuedCelebration();
}
function showNextQueuedCelebration(){
  if(celebrationQueue.length === 0) return;
  const info = celebrationQueue.shift();
  showCelebration(info);
}
function checkCustomCounterMilestones(){
  if(!storeData.customCounterMilestonesHit) storeData.customCounterMilestonesHit = {};
  (storeData.customCounters||[]).forEach(c=>{
    const days = daysSince(new Date(c.start).getTime());
    if(!storeData.customCounterMilestonesHit[c.id]) storeData.customCounterMilestonesHit[c.id] = {};
    CUSTOM_COUNTER_MILESTONES.forEach(m=>{
      if(days >= m && !storeData.customCounterMilestonesHit[c.id][m]){
        storeData.customCounterMilestonesHit[c.id][m] = true;
        queueCelebration({emoji:'🎉', title: toFa(m)+' روز!',
          text: 'تبریک می‌گم! روزشمار «'+c.name+'» به '+toFa(m)+' روز رسید 👏'});
      }
    });
  });
  if(celebrationQueue.length) saveData();
}

function updateMountain(){
  const day = programDay();
  currentPhase = getPhase(day);
  const phIdx = PHASES.findIndex(p=>p.key===currentPhase.key);
  if(phIdx > (storeData.maxPhaseIndex||0)) storeData.maxPhaseIndex = phIdx;
  const progLen = storeData.programLength || 90;
  const t = Math.max(0, Math.min(1, day/progLen));
  const pos = pointOnQuad(t, P0, P1, P2);
  document.getElementById('marker').setAttribute('cx', pos.x);
  document.getElementById('marker').setAttribute('cy', pos.y);
  const me = document.getElementById('markerEmoji');
  me.setAttribute('x', pos.x); me.setAttribute('y', pos.y+4);

  const greetEl = document.getElementById('userGreeting');
  if(greetEl){
    const fn = storeData.profile && storeData.profile.firstName;
    greetEl.textContent = fn ? ('سلام ' + fn + ' 👋') : '';
  }
  const dayCounterEl = document.getElementById('dayCounter');
  const phaseNameEl = document.getElementById('phaseName');
  const daySubEl = document.getElementById('daySub');

  if(day<=0){
    dayCounterEl.textContent = "هنوز شروع نکردی";
    phaseNameEl.textContent = "";
    daySubEl.textContent = "اولین کار امروزت رو تیک بزن تا سفر "+toFa(progLen)+" روزه‌ات شروع بشه";
  } else if(day<=progLen){
    dayCounterEl.textContent = "روز "+toFa(day)+" از "+toFa(progLen);
    phaseNameEl.textContent = currentPhase.name;
    daySubEl.textContent = "اگه همینطوری ادامه بدی، به بهترین نسخه از خودت می‌رسی";
  } else {
    dayCounterEl.textContent = "روز "+toFa(day)+" — به قله رسیدی 🏔️";
    phaseNameEl.textContent = currentPhase.name;
    daySubEl.textContent = "داری همون نسخه‌ای زندگی می‌کنی که می‌خواستی بشی";
    if(!storeData.peakCelebrated){
      storeData.peakCelebrated = true;
      const rw = rewardText(storeData.profile);
      const celebText = "۹۰ روز پشتکار، الان اینجایی. واقعاً به خودت افتخار کن." + (rw ? ` وقتشه اون پاداشی که برای خودت در نظر گرفته بودی رو بگیری: ${rw} 🎁` : '');
      showCelebration({emoji:"🏔️🎉", title:"به قله رسیدی!", text: celebText});
      launchConfetti();
      saveData();
    }
  }
}

/* ---------------- Coach mascot ---------------- */
function hashCode(str){
  let h=0;
  for(let i=0;i<str.length;i++){ h=(h<<5)-h+str.charCodeAt(i); h|=0; }
  return h;
}
function seededPick(arr, seed){
  const idx = Math.abs(hashCode(seed)) % arr.length;
  return arr[idx];
}
function shadeColor(hex, percent){
  hex = hex.replace('#','');
  const num = parseInt(hex,16);
  let r = (num>>16) + Math.round(255*percent/100);
  let g = ((num>>8)&0xFF) + Math.round(255*percent/100);
  let b = (num&0xFF) + Math.round(255*percent/100);
  r=Math.max(0,Math.min(255,r)); g=Math.max(0,Math.min(255,g)); b=Math.max(0,Math.min(255,b));
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
function buildCoachSVG(mood, idSuffix, gender){
  const uid = idSuffix || 'x';
  const th = (typeof THEMES!=='undefined' && THEMES[storeData.theme]) ? THEMES[storeData.theme] : {accent:'#ff9a3d', accent2:'#ffb347'};
  const hoodieTop = th.accent2, hoodieBottom = th.accent, stringColor = shadeColor(th.accent, -22);
  const isFemale = gender === 'female';
  const hairColor = '#3a2c1c';
  const parts = {
    gentle:{
      brow:'<path d="M31,36 Q37.5,32.5 44,35.5" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/><path d="M56,35.5 Q62.5,32.5 69,36" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/>',
      eyes:'<circle cx="38.5" cy="45.5" r="2.7" fill="#2f2418"/><circle cx="61.5" cy="45.5" r="2.7" fill="#2f2418"/>',
      mouth:'<path d="M43,59.5 Q50,64 57,59.5" stroke="#2f2418" stroke-width="2.5" fill="none" stroke-linecap="round"/>',
      extra:'', blush:.5
    },
    happy:{
      brow:'<path d="M31,35 Q38,30.5 45,34" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/><path d="M55,34 Q62,30.5 69,35" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/>',
      eyes:'<path d="M34,45.5 Q38.5,41 43,45.5" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/><path d="M57,45.5 Q61.5,41 66,45.5" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/>',
      mouth:'<path d="M40.5,58.5 Q50,68.5 59.5,58.5" stroke="#2f2418" stroke-width="2.7" fill="none" stroke-linecap="round"/>',
      extra:'', blush:.85
    },
    excited:{
      brow:'<path d="M30,33 Q38,27.5 46,32" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/><path d="M54,32 Q62,27.5 70,33" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/>',
      eyes:'<path d="M34,44.5 Q38.5,40 43,44.5" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/><path d="M57,44.5 Q61.5,40 66,44.5" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/>',
      mouth:'<ellipse cx="50" cy="61" rx="9.5" ry="7.5" fill="#2f2418"/><ellipse cx="50" cy="58.5" rx="6.2" ry="3.6" fill="#e2665a"/>',
      extra:'<text x="13" y="27" font-size="13" opacity=".9">✨</text><text x="82" y="22" font-size="11" opacity=".9">✨</text><text x="85" y="60" font-size="10" opacity=".8">✨</text>',
      blush:1
    },
    concerned:{
      brow:'<path d="M31,38 Q38,33.5 46,37.5" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/><path d="M54,37.5 Q62,33.5 69,38" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/>',
      eyes:'<circle cx="38.5" cy="47" r="2.5" fill="#2f2418"/><circle cx="61.5" cy="47" r="2.5" fill="#2f2418"/>',
      mouth:'<path d="M44,62.5 Q50,58.5 56,62.5" stroke="#2f2418" stroke-width="2.5" fill="none" stroke-linecap="round"/>',
      extra:'', blush:.2
    },
    cheer:{
      brow:'<path d="M30,34 Q38,28 46,32.5" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/><path d="M54,32.5 Q62,28 70,34" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/>',
      eyes:'<path d="M34,45 Q38.5,40.5 43,45" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/><path d="M57,45 Q61.5,40.5 66,45" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/>',
      mouth:'<path d="M40,58.5 Q50,69 60,58.5" stroke="#2f2418" stroke-width="2.7" fill="none" stroke-linecap="round"/>',
      extra:'<text x="80" y="70" font-size="15">💪</text>',
      blush:.9
    },
    proud:{
      brow:'<path d="M31,35 Q38,30 45,33.5" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/><path d="M55,33.5 Q62,30 69,35" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/>',
      eyes:'<path d="M34,45.5 Q38.5,41.5 43,45.5" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/><path d="M57,45.5 Q61.5,41.5 66,45.5" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/>',
      mouth:'<path d="M41,58.5 Q50,67.5 59,58.5" stroke="#2f2418" stroke-width="2.7" fill="none" stroke-linecap="round"/>',
      extra:'<text x="14" y="26" font-size="14">🏅</text>',
      blush:.85
    },
    thinking:{
      brow:'<path d="M31,35.5 Q38,32.5 45,35" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/><path d="M55,33 Q62,29 69,32.5" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/>',
      eyes:'<circle cx="38.5" cy="45.5" r="2.5" fill="#2f2418"/><circle cx="63" cy="44.5" r="2.5" fill="#2f2418"/>',
      mouth:'<path d="M44,60 Q50,58.5 57,60.5" stroke="#2f2418" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
      extra:'<text x="78" y="30" font-size="13">💡</text>',
      blush:.35
    }
  };
  const p = parts[mood] || parts.happy;
  const blush = p.blush ? `<ellipse cx="32.5" cy="53" rx="5.2" ry="3.1" fill="#ff8a3d" opacity="${p.blush*0.32}"/><ellipse cx="67.5" cy="53" rx="5.2" ry="3.1" fill="#ff8a3d" opacity="${p.blush*0.32}"/>` : '';
  const longHair = isFemale ? `<path d="M25,34 Q9,46 12,74 Q13.5,90 27,92 Q19,76 23,60 Q17,47 25,34 Z" fill="url(#hairGrad-${uid})"/>
    <path d="M75,34 Q91,46 88,74 Q86.5,90 73,92 Q81,76 77,60 Q83,47 75,34 Z" fill="url(#hairGrad-${uid})"/>` : '';
  const hairBow = isFemale ? `<path d="M62,15 L70,11 L70,19 Z" fill="${th.accent2}"/>
    <path d="M78,15 L70,11 L70,19 Z" fill="${th.accent2}"/>
    <circle cx="70" cy="15" r="2.2" fill="${shadeColor(th.accent2,-18)}"/>` : '';
  /* Raised hand: two poses share the same arm/sleeve, only the hand shape at the end changes.
     - Default everywhere: a "V" / victory sign (index + middle extended, ring+pinky folded,
       thumb crossed over) — a success/win gesture.
     - Exit-confirmation screen only (idSuffix 'exitconfirm'): an open "stop!" palm (four
       fingers together + thumb), a little joke gesture for "wait, don't go" on that one page.
     Shared arm styling:
     - Sleeve is filled with hoodieBottom (the exact same color as the torso/hoodie shape
       below), not hoodieTop, so the arm color matches the clothing exactly.
     - The shoulder patch circle is centered exactly on the group's transform-origin, so it
       never shifts during the idle rotation animation — the arm stays visually fused to the
       body at every frame instead of showing a seam/gap.
     - Arm stroke-width and hand size were both increased (and the shoulder anchor moved
       deeper into the body silhouette) so the limb reads as proportionate to the torso
       instead of a thin wire with a small blob on the end.
     Wrapped in a single <g> with transform-origin pinned at the shoulder so the CSS gesture
     animation (coachHandGesture) pivots the whole limb naturally. */
  const armMarkup = `<circle cx="70" cy="76" r="8.5" fill="url(#hoodieGrad-${uid})"/>
    <path d="M70,76 Q78,68 84,62" stroke="url(#hoodieGrad-${uid})" stroke-width="11" fill="none" stroke-linecap="round"/>
    <ellipse cx="83" cy="63" rx="6" ry="4" fill="${shadeColor(hoodieBottom,16)}" transform="rotate(-45 83 63)"/>`;
  const vSignHand = `<ellipse cx="87" cy="60" rx="8" ry="7.5" fill="#ffdab3"/>
    <ellipse cx="93" cy="64" rx="4.5" ry="4" fill="${shadeColor('#ffdab3',-10)}"/>
    <rect x="76" y="48.5" width="6" height="13.5" rx="3" fill="#ffdab3" transform="rotate(73 79 62)"/>
    <rect x="80" y="38" width="6" height="16" rx="3" fill="#ffdab3" transform="rotate(-16 83 54)"/>
    <rect x="87.9" y="34" width="6.2" height="19" rx="3.1" fill="#ffdab3" transform="rotate(12 91 53)"/>
    <path d="M81,47.5 Q83.5,46.2 86,47.5" stroke="${shadeColor('#ffdab3',-20)}" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".6"/>
    <path d="M89,43.5 Q91.5,42.2 94,43.5" stroke="${shadeColor('#ffdab3',-20)}" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".6"/>
    <path d="M88,50.5 Q90.5,49.2 93,50.5" stroke="${shadeColor('#ffdab3',-20)}" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".55"/>`;
  const stopHand = `<ellipse cx="89" cy="63" rx="8.5" ry="7.5" fill="#ffdab3"/>
    <circle cx="77" cy="66" r="4.2" fill="#ffdab3"/>
    <circle cx="79.5" cy="57" r="3.7" fill="#ffdab3"/>
    <circle cx="84.5" cy="53" r="4" fill="#ffdab3"/>
    <circle cx="90" cy="51.5" r="4.2" fill="#ffdab3"/>
    <circle cx="95.5" cy="53.5" r="4" fill="#ffdab3"/>
    <path d="M82,56 Q84.5,54.3 87,56" stroke="${shadeColor('#ffdab3',-20)}" stroke-width="1.1" fill="none" stroke-linecap="round" opacity=".55"/>
    <path d="M87.5,54.5 Q90,52.8 92.5,54.5" stroke="${shadeColor('#ffdab3',-20)}" stroke-width="1.1" fill="none" stroke-linecap="round" opacity=".55"/>`;
  /* Pointing hand: a closed fist (palm ellipse + two folded-finger circles, same skin
     tone and stroke style as the other two gestures) with a single index finger extended
     straight up — the «tip / نکته» gesture from the reference photo. Same rect-based
     finger construction, fill and knuckle-line treatment as vSignHand so it reads as the
     same hand/arm, just a different pose; used only on tabs where the coach is giving
     guidance rather than a plain check-in (see TIP_COACH_SUFFIXES below). */
  const pointingHand = `<ellipse cx="87" cy="62" rx="8" ry="7.5" fill="#ffdab3"/>
    <circle cx="79.5" cy="65.5" r="4.3" fill="#ffdab3"/>
    <circle cx="83.5" cy="69" r="3.8" fill="${shadeColor('#ffdab3',-10)}"/>
    <rect x="83.6" y="33.5" width="6.4" height="27" rx="3.2" fill="#ffdab3" transform="rotate(4 86.8 47.5)"/>
    <path d="M83.7,40 Q86.8,38.5 89.9,40" stroke="${shadeColor('#ffdab3',-20)}" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".55"/>
    <path d="M84,47.3 Q87,45.8 90,47.3" stroke="${shadeColor('#ffdab3',-20)}" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".55"/>`;
  /* idSuffixes whose coach-msg is guidance/a tip rather than a plain daily check-in
     (تب «امروز» keeps the default vSignHand, unaffected). Matched with .includes()
     rather than strict equality because switchTheme() re-renders avatars passing the
     DOM element id (e.g. "coachAvatarWorkout") instead of the short suffix ("workout")
     — .includes() keeps the pointing pose correct after a theme switch too. */
  const TIP_COACH_SUFFIXES = ['workout','progress','goals','library','meditation','speech'];
  const suffixLower = String(idSuffix).toLowerCase();
  const isExitConfirm = suffixLower.includes('exitconfirm') || suffixLower.includes('exitcoach');
  const isTipCoach = TIP_COACH_SUFFIXES.some(s => suffixLower.includes(s));
  const raisedHand = `<g class="coach-hand" style="transform-origin:70px 76px">
    ${armMarkup}
    ${isExitConfirm ? stopHand : (isTipCoach ? pointingHand : vSignHand)}
  </g>`;
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="skinGrad-${uid}" cx="38%" cy="30%" r="78%">
        <stop offset="0%" stop-color="${shadeColor('#ffdab3',18)}"/>
        <stop offset="58%" stop-color="#ffdab3"/>
        <stop offset="100%" stop-color="${shadeColor('#ffdab3',-16)}"/>
      </radialGradient>
      <linearGradient id="hoodieGrad-${uid}" x1="12%" y1="0%" x2="88%" y2="100%">
        <stop offset="0%" stop-color="${shadeColor(hoodieBottom,22)}"/>
        <stop offset="52%" stop-color="${hoodieBottom}"/>
        <stop offset="100%" stop-color="${shadeColor(hoodieBottom,-22)}"/>
      </linearGradient>
      <linearGradient id="hairGrad-${uid}" x1="18%" y1="0%" x2="78%" y2="100%">
        <stop offset="0%" stop-color="${shadeColor(hairColor,26)}"/>
        <stop offset="55%" stop-color="${hairColor}"/>
        <stop offset="100%" stop-color="${shadeColor(hairColor,-16)}"/>
      </linearGradient>
      <radialGradient id="glowGrad-${uid}" cx="50%" cy="46%" r="52%">
        <stop offset="0%" stop-color="${hoodieTop}" stop-opacity=".24"/>
        <stop offset="100%" stop-color="${hoodieTop}" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <circle cx="50" cy="50" r="48" fill="url(#glowGrad-${uid})"/>
    <path d="M17,101 Q17,65 50,65 Q83,65 83,101 Z" fill="url(#hoodieGrad-${uid})"/>
    <path d="M50,65 Q59,65 65,69.5 L58.5,80.5 Q50,76.5 41.5,80.5 L35,69.5 Q41,65 50,65 Z" fill="#ffffff" opacity=".22"/>
    <circle cx="40" cy="72.5" r="1.6" fill="${stringColor}"/><line x1="40" y1="72.5" x2="37.5" y2="86" stroke="${stringColor}" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="60" cy="72.5" r="1.6" fill="${stringColor}"/><line x1="60" y1="72.5" x2="62.5" y2="86" stroke="${stringColor}" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="22.5" cy="48.5" r="5.2" fill="url(#skinGrad-${uid})"/><circle cx="77.5" cy="48.5" r="5.2" fill="url(#skinGrad-${uid})"/>
    <circle cx="50" cy="45.5" r="25.5" fill="url(#skinGrad-${uid})"/>
    <ellipse cx="41" cy="34.5" rx="10.5" ry="6.5" fill="#ffffff" opacity=".16"/>
    ${longHair}
    <path d="M24,39 Q20,12.5 50,11.5 Q80,12.5 76,39 Q78,25.5 65,22.5 Q68.5,31 56,21.5 Q50.5,32.5 45,20.5 Q40,31.5 30,25 Q34,32 24,39 Z" fill="url(#hairGrad-${uid})"/>
    <path d="M27,26 Q34,17 44,15" stroke="#6b5136" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".55"/>
    ${hairBow}
    ${blush}
    <circle cx="38.5" cy="45.5" r="11" fill="rgba(255,255,255,.92)" stroke="#2f2418" stroke-width="2.5"/>
    <circle cx="61.5" cy="45.5" r="11" fill="rgba(255,255,255,.92)" stroke="#2f2418" stroke-width="2.5"/>
    <ellipse cx="35" cy="41.5" rx="2.6" ry="1.7" fill="#ffffff" opacity=".8"/>
    <ellipse cx="58" cy="41.5" rx="2.6" ry="1.7" fill="#ffffff" opacity=".8"/>
    <line x1="49" y1="45.5" x2="51" y2="45.5" stroke="#2f2418" stroke-width="2.5"/>
    <line x1="27.5" y1="44" x2="22.5" y2="46.5" stroke="#2f2418" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="72.5" y1="44" x2="77.5" y2="46.5" stroke="#2f2418" stroke-width="2.2" stroke-linecap="round"/>
    ${p.eyes}
    ${p.brow}
    <g class="coach-mouth-talk">${p.mouth}</g>
    ${p.extra}
    ${raisedHand}
  </svg>`;
}
/* ---- Reads the optional self-reported health/medication info from onboarding and turns
   it into a small, non-clinical signal: "is today plausibly a harder day for this person".
   This never diagnoses, never reasons about specific drugs, and never changes checklist
   totals/scoring/streaks — it only ever adds a little extra gentleness to the coach's
   wording in getCoachData/updateWorkoutCoach on days that already look tough (broken
   streak, high self-reported stress, or a low logged mood). That keeps the "influence"
   small and safe, exactly as intended: softer tone, not clinical decisions. ---- */
function getHealthFlags(){
  const h = (storeData.profile && storeData.profile.health) || {};
  const active = !!(h.hasCondition && h.considerInPlan!==false);
  const hasMoodTag = active && (h.tags||[]).some(t=> HEALTH_MOOD_TAGS.indexOf(t)>=0);
  const hasMeds = active && !!(h.medicationsText && h.medicationsText.trim());
  const hasAnyDetail = active && (hasMoodTag || hasMeds || (h.detailsText && h.detailsText.trim()) || (h.tags||[]).length>0);
  const todayEntry = storeData.entries ? storeData.entries[todayKey()] : null;
  const lowMoodToday = !!(todayEntry && todayEntry.mood!=null && todayEntry.mood<=2);
  const highStress = (storeData.profile && storeData.profile.stressLevel>=4);
  const hardDay = lowMoodToday || highStress;
  return { active: active && hasAnyDetail, hasMoodTag, hasMeds, hardDay };
}
/* ==================== Special-occasion coach messages: Iranian national/cultural occasions
   (Persian-calendar, deliberately non-religious — no Islamic/Islamic-Republic dates here,
   except روز معلم که به‌درخواست صریح کاربر همون تاریخ رسمی ۱۲ اردیبهشت نگه داشته شده) ====================
   منبع تاریخ همون Intl.DateTimeFormat('fa-IR', calendar persian) هست که renderPersianDateLine
   هم ازش استفاده می‌کنه — پس نیازی به پیاده‌سازی دستی تقویم جلالی نیست. */
const OCCASION_JALALI = [
  { month:'فروردین', day:1,  mood:'excited', text:'🌸 عیدت مبارک! امسال رو با همین انرژی شروع کن.' },
  { month:'فروردین', day:13, mood:'excited', text:'سیزده‌به‌در مبارک! امروز رو با آرامش بگذرون.' },
  { month:'اردیبهشت', day:1,  mood:'happy', text:'روز بزرگداشت سعدی مبارک؛ یه جمله از گلستان بخون، حالتو خوب می‌کنه.' },
  { month:'اردیبهشت', day:3,  mood:'happy', text:'روز معماری مبارک 🏛️' },
  { month:'اردیبهشت', day:10, mood:'happy', text:'روز ملی خلیج فارس مبارک 🌊' },
  { month:'اردیبهشت', day:12, mood:'happy', text:'روز معلم مبارک 🍎' },
  { month:'اردیبهشت', day:25, mood:'happy', text:'روز بزرگداشت فردوسی مبارک؛ زبونی که باهاش حرف می‌زنیم رو مدیون همینه.' },
  { month:'اردیبهشت', day:28, mood:'happy', text:'روز بزرگداشت خیام مبارک؛ یه رباعی از حکیم نیشابور بخون امروز.' },
  { month:'تیر', day:13, mood:'happy', text:'جشن تیرگان مبارک 💧' },
  { month:'مرداد', day:17, mood:'happy', text:'روز خبرنگار مبارک 📰' },
  { month:'شهریور', day:1,  mood:'happy', text:'روز پزشک مبارک 🩺' },
  { month:'شهریور', day:4,  mood:'happy', text:'روز کارمند و زادروز کوروش بزرگ مبارک.' },
  { month:'شهریور', day:5,  mood:'happy', text:'روز داروسازی مبارک 💊' },
  { month:'شهریور', day:27, mood:'gentle', text:'روز شعر و ادب فارسی و یاد استاد شهریار گرامی.' },
  { month:'مهر', day:7,  mood:'happy', text:'روز آتش‌نشانی و ایمنی مبارک 🚒' },
  { month:'مهر', day:8,  mood:'happy', text:'روز بزرگداشت مولانا مبارک؛ یه بیت از مثنوی بخون امروز.' },
  { month:'مهر', day:14, mood:'happy', text:'روز دامپزشکی مبارک 🐾' },
  { month:'مهر', day:16, mood:'happy', text:'جشن مهرگان مبارک 🍂' },
  { month:'مهر', day:20, mood:'happy', text:'روز بزرگداشت حافظ مبارک؛ یه فال حافظ امروز بد نیست.' },
  { month:'آبان', day:7,  mood:'happy', text:'روز جهانی کوروش بزرگ مبارک.' },
  { month:'آذر', day:15, mood:'happy', text:'روز حسابدار مبارک 📊' },
  { month:'آذر', day:30, mood:'gentle', text:'شب یلدات مبارک 🍉 طولانی‌ترین شب سال، کنار آدمای دوست‌داشتنیت.' },
  { month:'بهمن', day:10, mood:'happy', text:'جشن سده مبارک 🔥' },
  { month:'اسفند', day:5,  mood:'happy', text:'سپندارمذگان و روز مهندس مبارک 💛⚙️' },
  { month:'اسفند', day:7,  mood:'happy', text:'روز وکیل مدافع مبارک ⚖️' },
  { month:'اسفند', day:29, mood:'happy', text:'روز ملی شدن صنعت نفت مبارک.' }
];
const OCCASION_GREGORIAN = [
  { month:0, day:1,  mood:'happy', text:'سال میلادی نو مبارک 🎉' },
  { month:2, day:8,  mood:'happy', text:'روز جهانی زن مبارک.' },
  { month:3, day:22, mood:'happy', text:'امروز روز جهانی زمینه؛ یه قدم کوچیک برای محیط‌زیست هم بردار.' },
  { month:4, day:1,  mood:'happy', text:'روز جهانی کارگر مبارک.' },
  { month:4, day:12, mood:'happy', text:'روز جهانی پرستار مبارک 💉' },
  { month:5, day:5,  mood:'happy', text:'روز جهانی محیط‌زیست مبارک 🌱' },
  { month:9, day:10, mood:'gentle', text:'امروز روز جهانی سلامت روانه؛ مراقب خودت هم باش، نه فقط برنامه‌ت.' },
  { month:11, day:10, mood:'happy', text:'امروز روز جهانی حقوق بشره.' }
];
const faDigitsToNum = (str) => {
  const map = {'۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};
  return parseInt(String(str).replace(/[۰-۹]/g, d=>map[d]||d), 10);
};
function getTodayOccasion(){
  try{
    const now = new Date();
    const g = OCCASION_GREGORIAN.find(o=> o.month===now.getMonth() && o.day===now.getDate());
    if(g) return g;
    const fmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {month:'long', day:'numeric'});
    const parts = {};
    fmt.formatToParts(now).forEach(p=>{ parts[p.type] = p.value; });
    const jDay = faDigitsToNum(parts.day);
    const jMonth = parts.month;
    return OCCASION_JALALI.find(o=> o.month===jMonth && o.day===jDay) || null;
  }catch(err){ return null; }
}
function getCoachData(){
  const day = programDay();
  const name = (storeData.profile && storeData.profile.firstName) ? storeData.profile.firstName.trim() : '';
  const namePart = name ? (name+'، ') : '';
  const occasion = getTodayOccasion();
  if(occasion){
    return { mood: occasion.mood, text: namePart + occasion.text };
  }
  const streak = computeStreak();
  const maxStreak = storeData.maxStreak || 0;
  const tot = totalToday();
  const pct = tot>0 ? Math.round((computeChecked()/tot)*100) : 0;
  const seed = todayKey();
  const progLen = storeData.programLength || 90;

  if(!storeData.startDate || day<=0){
    const msgs = [
      namePart+'من همینجام تا کنار تو باشم. هر وقت آماده بودی، اولین کارو تیک بزن تا شروع بشه.',
      'خیلیا فکر می‌کنن باید کامل آماده باشن تا شروع کنن. کافیه همین امروز یه قدم کوچیک برداری.',
      namePart+'شروع کردن سخت‌ترین قسمت راهه. من اینجام، هر وقت خواستی شروع کن.'
    ];
    return { mood:'gentle', text: seededPick(msgs, seed+'-start') };
  }
  if(streak===0 && maxStreak>=3){
    const msgs = [
      namePart+'یه وقفه پایان راه نیست. رکورد قبلیت رو دیدم، می‌دونم دوباره از پسش برمیای.',
      namePart+'مهم نیست چندبار زمین بخوری، مهم اینه دوباره بلند شی. امروز رو با من شروع کن.',
      namePart+'هیچ آدم موفقی مسیر صاف نداشته. برگرد سر خط، من پشتتم.'
    ];
    const hf = getHealthFlags();
    if(hf.active && (hf.hardDay || hf.hasMoodTag)){
      msgs.push(namePart+'روزهای سخت‌تر طبیعیَن، مخصوصاً وقتی یه چیز دیگه هم همزمان داری باهاش کنار میای. سخت نگیر رو خودت، فقط یه قدم کوچیک کافیه.');
      msgs.push(namePart+'گاهی فقط سرپا موندن خودش یه پیروزیه. امروز رو ساده بگیر.');
    }
    return { mood:'concerned', text: seededPick(msgs, seed+'-broken') };
  }
  if(day > progLen){
    const msgs = [
      namePart+'تو به جایی رسیدی که خیلیا فقط آرزوشو دارن. بهت افتخار می‌کنم.',
      namePart+'روز '+toFa(day)+'ـه که داری بهترین نسخه‌ی خودتو می‌سازی. همینطور ادامه بده.'
    ];
    return { mood:'excited', text: seededPick(msgs, seed+'-peak') };
  }
  const milestoneDays = [3,7,14,21,30,45,60,75,90];
  if(milestoneDays.indexOf(streak)>=0){
    const msgs = [
      namePart+toFa(streak)+' روز پشت‌سرهم! این دیگه داره عادت می‌شه، نه فقط تلاش.',
      namePart+toFa(streak)+' روزه که داری قولتو به خودت نگه می‌داری. فوق‌العاده‌ست.'
    ];
    return { mood:'excited', text: seededPick(msgs, seed+'-milestone') };
  }
  if(pct>=100){
    const msgs = [
      namePart+'امروز رو کامل بردی. دقیقاً همین باعث فرق می‌شه.',
      namePart+'هر کاری که برای امروز گفتی رو انجام دادی. همینو ادامه بده.'
    ];
    return { mood:'excited', text: seededPick(msgs, seed+'-done') };
  }
  const msgs = [
    namePart+'امروز روز '+toFa(day)+' توئه. بیشتر آدم‌ها همین‌جاها رها می‌کنن. تو جزو کسایی هستی که ادامه می‌دن.',
    namePart+'روز '+toFa(day)+'ـته. هنوز کارای امروزت مونده، بریم تمومش کنیم.',
    namePart+'هر روزی که ادامه می‌دی، از دیروزت قوی‌تر می‌شی. روز '+toFa(day)+' رو بساز.',
    namePart+'یادت باشه چرا شروع کردی. روز '+toFa(day)+'ـه، هنوز وقت داری امروزم بسازی.'
  ];
  const hf = getHealthFlags();
  if(hf.active && hf.hardDay){
    msgs.push(namePart+'اگه امروز حس سنگینی داری، لازم نیست همه‌چی رو صددرصد انجام بدی. حتی یکی-دوتا کار کوچیک هم روز '+toFa(day)+' رو نگه می‌داره.');
    if(hf.hasMeds) msgs.push(namePart+'روتین امروزت (از جمله داروهات) رو یادت نره؛ برنامه رو با همون سرعتی که امروز حالت اجازه می‌ده جلو ببر.');
  }
  return { mood: (hf.active && hf.hardDay) ? 'gentle' : 'happy', text: seededPick(msgs, seed+'-daily') };
}
/* ---- Face-only mood boost: as the user checks off more of today's items, the coach's
   FACE gets progressively happier/more excited — the message text is untouched and still
   comes straight from getCoachData(). Special narrative moods are left exactly as they
   were so the story still makes sense: a broken streak still looks 'concerned', the
   start/no-plan state and hard-day softness still look 'gentle', and a 100%/milestone/peak
   day still looks 'excited'. Only the plain daily-default 'happy' mood is the one that
   scales with today's percentage — and it only ever moves between 'happy' → 'cheer' →
   'proud' → 'excited' at 100%, all of which are existing, already-tuned face variants from
   buildCoachSVG's parts{} table, so eyes/brows/mouth stay in the same proportions the
   original designs use — nothing here invents new coordinates. ---- */
function getProgressFaceMood(baseMood){
  if(baseMood !== 'happy') return baseMood;
  const tot = totalToday();
  const pct = tot>0 ? Math.round((computeChecked()/tot)*100) : 0;
  if(pct >= 100) return 'excited';
  if(pct >= 70) return 'proud';
  if(pct >= 40) return 'cheer';
  return 'happy';
}
function updateCoach(){
  const avatarEl = document.getElementById('coachAvatar');
  const msgEl = document.getElementById('coachMsg');
  if(!avatarEl || !msgEl) return;
  const data = getCoachData();
  const gender = (storeData.profile && storeData.profile.gender) || '';
  const faceMood = getProgressFaceMood(data.mood);
  avatarEl.innerHTML = buildCoachSVG(faceMood, 'today', gender);
  avatarEl.dataset.mood = faceMood;
  avatarEl.dataset.gender = gender;
  msgEl.textContent = data.text;
}
function updateWorkoutCoach(){
  const avatarEl = document.getElementById('coachAvatarWorkout');
  const msgEl = document.getElementById('coachMsgWorkout');
  if(!avatarEl || !msgEl) return;
  const template = SPLIT_TEMPLATES[woSplit];
  const day = template ? template[woActiveDay] : null;
  const seed = todayKey()+'-wo-'+woActiveDay+'-'+woSplit;
  const msgs = day ? [
    'امروز نوبت '+day.sub+'ـه. تمرکزتو بذار رو فرم درست، نه فقط وزنه.',
    day.sub+' امروز — بدنت هم لایق همون توجهیه که به بقیه‌ی زندگیت می‌دی.',
    'هر ست که کامل می‌کنی، یه پیام به مغزت می‌فرستی که رو خودت حساب می‌کنی.'
  ] : ['یه برنامه‌ی تمرینی متناسب با خودت اینجا برات آماده‌ست.'];
  const hfWo = getHealthFlags();
  if(day && hfWo.active && hfWo.hardDay){
    msgs.push('اگه امروز انرژیت کمه، با شدت کمتر یا نصفه‌ی برنامه هم پیش برو — مهم اینه که وصل بمونی، نه اینکه فشار بیاری.');
  }
  msgEl.textContent = seededPick(msgs, seed);
  const genderWo = (storeData.profile && storeData.profile.gender) || '';
  avatarEl.innerHTML = buildCoachSVG('cheer', 'workout', genderWo);
  avatarEl.dataset.mood = 'cheer';
  avatarEl.dataset.gender = genderWo;
}
function updateProgressCoach(){
  const avatarEl = document.getElementById('coachAvatarProgress');
  const msgEl = document.getElementById('coachMsgProgress');
  if(!avatarEl || !msgEl) return;
  const earnedCount = BADGES.filter(b=> storeData.badges && storeData.badges[b.id]).length;
  const maxStreak = storeData.maxStreak || 0;
  const seed = todayKey()+'-prog';
  let mood = 'proud', msgs;
  if(earnedCount===0 && maxStreak<3){
    mood = 'thinking';
    msgs = [
      'هر نشان یه داستانه. بذار اولین‌شون رو با هم بسازیم.',
      'هنوز اول راهی، ولی هر آمار اینجا از همین روزا شکل می‌گیره.'
    ];
  } else {
    msgs = [
      'تا الان '+toFa(earnedCount)+' نشان گرفتی. هرکدوم یعنی یه روز که تسلیم نشدی.',
      'بهترین رکوردت '+toFa(maxStreak)+' روزه. بیا ببینیم چقدر جلوتر می‌ری.',
      'این آمارا فقط عدد نیستن، مسیر واقعی تو رو نشون می‌دن.'
    ];
  }
  msgEl.textContent = seededPick(msgs, seed);
  const genderProg = (storeData.profile && storeData.profile.gender) || '';
  avatarEl.innerHTML = buildCoachSVG(mood, 'progress', genderProg);
  avatarEl.dataset.mood = mood;
  avatarEl.dataset.gender = genderProg;
}
function updateLibraryCoach(){
  const avatarEl = document.getElementById('coachAvatarLibrary');
  const msgEl = document.getElementById('coachMsgLibrary');
  if(!avatarEl || !msgEl) return;
  const seed = todayKey()+'-lib';
  const phaseName = (typeof currentPhase!=='undefined' && currentPhase) ? currentPhase.name : '';
  const msgs = [
    'این مطلبا رو بر اساس مرحله‌ی «'+phaseName+'» برات چیدم.',
    'خوندن دو دقیقه‌ای امروز، می‌تونه فردات رو راحت‌تر کنه.',
    'هر مرحله دام‌های خودشو داره؛ این مطالب دقیقاً برای همینه.'
  ];
  msgEl.textContent = seededPick(msgs, seed);
  const genderLib = (storeData.profile && storeData.profile.gender) || '';
  avatarEl.innerHTML = buildCoachSVG('thinking', 'library', genderLib);
  avatarEl.dataset.mood = 'thinking';
  avatarEl.dataset.gender = genderLib;
}
function updateGoalsCoach(){
  const avatarEl = document.getElementById('coachAvatarGoals');
  const msgEl = document.getElementById('coachMsgGoals');
  if(!avatarEl || !msgEl) return;
  const seed = todayKey()+'-goals';
  const msgs = [
    'این نقشه فقط یه پیشنهاده؛ هر جا خواستی می‌تونی خودت تغییرش بدی.',
    'به‌جای نگاه‌کردن به کل مسیر، فقط روی هدف بعدی تمرکز کن.',
    'هر هدفی که بهش می‌رسی، یعنی یه قدم واقعی به سمت زندگی‌ای که می‌خوای.'
  ];
  msgEl.textContent = seededPick(msgs, seed);
  const genderGoals = (storeData.profile && storeData.profile.gender) || '';
  avatarEl.innerHTML = buildCoachSVG('proud', 'goals', genderGoals);
  avatarEl.dataset.mood = 'proud';
  avatarEl.dataset.gender = genderGoals;
}
function updateMeditationCoach(){
  const avatarEl = document.getElementById('coachAvatarMeditation');
  const msgEl = document.getElementById('coachMsgMeditation');
  if(!avatarEl || !msgEl) return;
  const seed = todayKey()+'-med';
  const msgs = [
    'چند دقیقه سکوت، بهت کمک می‌کنه بقیه‌ی روز رو آروم‌تر جلو بری.',
    'لازم نیست ذهنت کاملاً خالی بشه؛ فقط برگرد به نفس، همین کافیه.',
    'این چند دقیقه مال خودته؛ بدون عجله انجامش بده.'
  ];
  msgEl.textContent = seededPick(msgs, seed);
  const genderMed = (storeData.profile && storeData.profile.gender) || '';
  avatarEl.innerHTML = buildCoachSVG('gentle', 'meditation', genderMed);
  avatarEl.dataset.mood = 'gentle';
  avatarEl.dataset.gender = genderMed;
}
function updateSpeechCoach(){
  const avatarEl = document.getElementById('coachAvatarSpeech');
  const msgEl = document.getElementById('coachMsgSpeech');
  if(!avatarEl || !msgEl) return;
  const seed = todayKey()+'-speech';
  const msgs = [
    'روون حرف‌زدن مثل هر مهارت دیگه‌ای، فقط با تمرین جا می‌افته.',
    'هر بار که صدات رو تمرین می‌کنی، اعتماد به‌نفست تو حرف‌زدن بیشتر می‌شه.',
    'امروز رو با یکی از این تمرینا شروع کن، حتی چند دقیقه هم فرق می‌کنه.'
  ];
  msgEl.textContent = seededPick(msgs, seed);
  const genderSp = (storeData.profile && storeData.profile.gender) || '';
  avatarEl.innerHTML = buildCoachSVG('cheer', 'speech', genderSp);
  avatarEl.dataset.mood = 'cheer';
  avatarEl.dataset.gender = genderSp;
}
/* ---- تمرین‌های فن بیانِ پرمیوم: از ۵ تمرین این تب، فقط ۲ تای اول (شافل کارت احساسات و
   بداهه‌گویی) تو پلن رایگان بازن؛ داستان‌سازی با کلمات، گرم کردن صدا و شاخه‌ی کلمات
   مخصوص پرمیوم/دوره‌ی آزمایشی‌ان. ---- */
const SPEECH_PREMIUM_SECTIONS = ['speechExStory', 'speechExWarmup', 'speechExWordTree'];
function applySpeechPremiumLocksUI(){
  const isPremiumUser = !!(storeData.premium || (typeof isInTrial === 'function' && isInTrial()));
  SPEECH_PREMIUM_SECTIONS.forEach(id=>{
    const sec = document.getElementById(id);
    if(sec) sec.classList.toggle('premium-section-locked', !isPremiumUser);
  });
}
document.addEventListener('click', (e)=>{
  const overlay = e.target.closest('.premium-lock-overlay');
  if(!overlay) return;
  const sec = overlay.closest('.section');
  if(sec && sec.classList.contains('premium-section-locked')) requirePremium();
});
/* ---- Themed replacement for the browser's native prompt(): used for both editing an
   existing checklist task's text and adding a brand-new custom task. Keeping this as one
   shared helper (instead of two near-identical prompt() calls) means both dialogs always
   look and behave the same, and any future tweak (styling, validation, RTL handling) only
   needs to happen in one place. ---- */
function showItemTextModal({title, value, placeholder, onSave}){
  const overlay = document.getElementById('itemTextModal');
  const titleEl = document.getElementById('itemTextModalTitle');
  const input = document.getElementById('itemTextModalInput');
  const saveBtn = document.getElementById('itemTextModalSaveBtn');
  const cancelBtn = document.getElementById('itemTextModalCancelBtn');
  if(!overlay || !input) return;
  titleEl.textContent = title || '';
  input.value = value || '';
  input.placeholder = placeholder || '';
  overlay.classList.add('show');
  setTimeout(()=>{ input.focus(); input.select(); }, 60);

  function close(){
    overlay.classList.remove('show');
    saveBtn.removeEventListener('click', onSaveClick);
    cancelBtn.removeEventListener('click', onCancelClick);
    overlay.removeEventListener('click', onBackdropClick);
    input.removeEventListener('keydown', onKeydown);
  }
  function onSaveClick(){
    const trimmed = input.value.trim();
    close();
    if(trimmed) onSave(trimmed);
  }
  function onCancelClick(){ close(); }
  function onBackdropClick(e){ if(e.target === overlay) close(); }
  function onKeydown(e){
    if(e.key === 'Enter'){ e.preventDefault(); onSaveClick(); }
    else if(e.key === 'Escape'){ onCancelClick(); }
  }
  saveBtn.addEventListener('click', onSaveClick);
  cancelBtn.addEventListener('click', onCancelClick);
  overlay.addEventListener('click', onBackdropClick);
  input.addEventListener('keydown', onKeydown);
}
/* ---------------- Rendering ---------------- */
function renderList(containerId, items, stateObj, avoid){
  const container=document.getElementById(containerId);
  container.innerHTML='';
  items.forEach((label,idx)=>{
    const row=document.createElement('div');
    row.className='item'+(avoid?' avoid':'')+(stateObj[idx]?' checked':'');
    row.innerHTML=`<div class="box">${CHECK_SVG}</div><span class="label">${label}</span>
      <button type="button" class="item-edit-btn" aria-label="ویرایش این کار">✏️</button>`;
    row.addEventListener('click',(e)=>{
      if(e.target.closest('.item-edit-btn')) return; // handled by its own listener below
      const wasStarted = !!storeData.startDate;
      const turningOn=!stateObj[idx];
      stateObj[idx]=turningOn;
      row.classList.toggle('checked');
      if(turningOn){
        sfxPop();
        showToast(ENCOURAGEMENTS[Math.floor(Math.random()*ENCOURAGEMENTS.length)]);
        if(!storeData.startDate){
          storeData.startDate = today;
          storeData.startTimestamp = new Date().toISOString();
          updateLiveCounter();
        }
      } else {
        sfxTap();
      }
      entry.total = totalToday();
      updateMiniRing();
      updateStreakUI();
      updateMountain();
      saveData();
      renderXP();
      renderBadges();
    });
    row.querySelector('.item-edit-btn').addEventListener('click', (e)=>{
      e.stopPropagation();
      const plain = String(label).replace(/<[^>]+>/g,'');
      showItemTextModal({
        title: 'متن این کار رو ویرایش کن',
        value: plain,
        onSave: (trimmed)=>{
          const overrides = avoid ? entry.avoidOverrides : entry.doOverrides;
          overrides[idx] = trimmed;
          saveData();
          render();
          showToast('کار ویرایش شد ✏️');
        }
      });
    });
    container.appendChild(row);
  });
  const addRow = document.createElement('div');
  addRow.className = 'item item-add-row';
  addRow.innerHTML = `<div class="box item-add-plus">+</div><span class="label">افزودن کار ${avoid ? 'انجام‌ندادنی' : 'انجام‌دادنی'} جدید</span>`;
  addRow.addEventListener('click', ()=>{
    showItemTextModal({
      title: `متن کار ${avoid ? 'انجام‌ندادنی' : 'انجام‌دادنی'} جدید رو بنویس`,
      value: '',
      placeholder: 'مثلاً: ۱۰ دقیقه پیاده‌روی',
      onSave: (trimmed)=>{
        if(avoid){
          if(!storeData.customAvoidItems) storeData.customAvoidItems = [];
          storeData.customAvoidItems.push(trimmed);
        } else {
          if(!storeData.customItems) storeData.customItems = [];
          storeData.customItems.push(trimmed);
        }
        saveData();
        render();
        if(typeof renderCustomList === 'function') renderCustomList();
        showToast('کار جدید اضافه شد ➕');
      }
    });
  });
  container.appendChild(addRow);
}

let saveTimeout=null;
function saveData(){
  storeData.entries[today]=entry;
  storeData.lastModified = new Date().toISOString();
  clearTimeout(saveTimeout);
  saveTimeout=setTimeout(async()=>{
    try{ await window.storage.set('checklist:data', JSON.stringify(storeData)); }
    catch(e){ console.error('Storage error', e); }
    pushCloudData();
    syncTaskWidget();
  },350);
  if(typeof updateReportBtnState === 'function') updateReportBtnState();
}

/* ---------------- Home-screen task widget bridge (native app only, no-op in browser) ---------------- */
function syncTaskWidget(){
  try{
    if(!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TaskWidget)) return;
    const items = getDoItems().slice(0,4);
    const tasks = items.map((label,i)=>({
      id: i,
      label: String(label).replace(/<[^>]+>/g,'').slice(0,40),
      done: !!entry.done[i]
    }));
    window.Capacitor.Plugins.TaskWidget.updateTasks({ tasks });
    window.Capacitor.Plugins.TaskWidget.updateDayProgress({ dayNumber: programDay() });
    pushWidgetTheme();
  }catch(e){ /* not running inside the native app — ignore */ }
}
// Pushes the app's current theme colors to the native widgets, so the checklist/day-progress
// home-screen widgets always match whatever theme the user picked inside the app instead of
// showing a hardcoded color. Cheap no-op in the browser / before the native plugin exists.
function pushWidgetTheme(){
  try{
    if(!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TaskWidget)) return;
    if(typeof window.Capacitor.Plugins.TaskWidget.updateTheme !== 'function') return;
    const t = (typeof THEMES!=='undefined' && THEMES[storeData.theme]) ? THEMES[storeData.theme] : THEMES.brand;
    window.Capacitor.Plugins.TaskWidget.updateTheme({
      accent: t.accent,
      accent2: t.accent2,
      card: t.card,
      text: t.text,
      muted: t.muted
    });
  }catch(e){ /* not running inside the native app — ignore */ }
}
async function applyPendingWidgetToggles(){
  try{
    if(!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TaskWidget)) return;
    const res = await window.Capacitor.Plugins.TaskWidget.getPendingToggles();
    const ids = (res && res.ids) || [];
    if(!ids.length) return;
    ids.forEach(id=>{ entry.done[id] = !entry.done[id]; });
    render(); saveData();
  }catch(e){ /* ignore */ }
}
/* Tiny badge = the real coach mascot's head (boy: same hair/face as buildCoachSVG), just
   cropped tight above the hoodie collar so it reads clearly at ~20px. Reuses the exact
   skin/hair/eye/brow/mouth markup from buildCoachSVG for the 'happy' and 'concerned' moods
   so the toast badge always matches the same character seen in the coach cards. */
function buildToastMascotHeadSVG(mood){
  const hairColor = '#3a2c1c';
  const moods = {
    happy:{
      brow:'<path d="M31,35 Q38,30.5 45,34" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/><path d="M55,34 Q62,30.5 69,35" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/>',
      eyes:'<path d="M34,45.5 Q38.5,41 43,45.5" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/><path d="M57,45.5 Q61.5,41 66,45.5" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/>',
      mouth:'<path d="M40.5,58.5 Q50,68.5 59.5,58.5" stroke="#2f2418" stroke-width="2.7" fill="none" stroke-linecap="round"/>', blush:.85
    },
    concerned:{
      brow:'<path d="M31,38 Q38,33.5 46,37.5" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/><path d="M54,37.5 Q62,33.5 69,38" stroke="#2f2418" stroke-width="2.3" fill="none" stroke-linecap="round"/>',
      eyes:'<circle cx="38.5" cy="47" r="2.5" fill="#2f2418"/><circle cx="61.5" cy="47" r="2.5" fill="#2f2418"/>',
      mouth:'<path d="M44,62.5 Q50,58.5 56,62.5" stroke="#2f2418" stroke-width="2.5" fill="none" stroke-linecap="round"/>', blush:.2
    }
  };
  const p = moods[mood] || moods.happy;
  const blush = `<ellipse cx="32.5" cy="53" rx="5.2" ry="3.1" fill="#ff8a3d" opacity="${p.blush*0.32}"/><ellipse cx="67.5" cy="53" rx="5.2" ry="3.1" fill="#ff8a3d" opacity="${p.blush*0.32}"/>`;
  return `<svg viewBox="14 6 72 66" xmlns="http://www.w3.org/2000/svg">
    <circle cx="22.5" cy="48.5" r="5.2" fill="#ffdab3"/><circle cx="77.5" cy="48.5" r="5.2" fill="#ffdab3"/>
    <circle cx="50" cy="45.5" r="25.5" fill="#ffdab3"/>
    <path d="M24,39 Q20,12.5 50,11.5 Q80,12.5 76,39 Q78,25.5 65,22.5 Q68.5,31 56,21.5 Q50.5,32.5 45,20.5 Q40,31.5 30,25 Q34,32 24,39 Z" fill="${hairColor}"/>
    <path d="M27,26 Q34,17 44,15" stroke="#6b5136" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".55"/>
    ${blush}
    <circle cx="38.5" cy="45.5" r="11" fill="rgba(255,255,255,.92)" stroke="#2f2418" stroke-width="2.5"/>
    <circle cx="61.5" cy="45.5" r="11" fill="rgba(255,255,255,.92)" stroke="#2f2418" stroke-width="2.5"/>
    <ellipse cx="35" cy="41.5" rx="2.6" ry="1.7" fill="#ffffff" opacity=".8"/>
    <ellipse cx="58" cy="41.5" rx="2.6" ry="1.7" fill="#ffffff" opacity=".8"/>
    <line x1="49" y1="45.5" x2="51" y2="45.5" stroke="#2f2418" stroke-width="2.5"/>
    <line x1="27.5" y1="44" x2="22.5" y2="46.5" stroke="#2f2418" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="72.5" y1="44" x2="77.5" y2="46.5" stroke="#2f2418" stroke-width="2.2" stroke-linecap="round"/>
    ${p.eyes}
    ${p.brow}
    ${p.mouth}
  </svg>`;
}
function showToast(msg, kind){
  const t=document.getElementById('toast');
  const badge=document.getElementById('toastBadge');
  const msgEl=document.getElementById('toastMsg');
  msgEl.textContent=msg;
  badge.innerHTML = buildToastMascotHeadSVG(kind==='error' ? 'concerned' : 'happy');
  // restart the pop/shimmer animations even on back-to-back toasts
  t.classList.remove('show'); void t.offsetWidth;
  badge.style.animation='none'; void badge.offsetWidth; badge.style.animation='';
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t=setTimeout(()=>t.classList.remove('show'),1500);
  if(kind==='error') sfxError();
  else if(kind==='success') sfxSuccess();
}

async function loadData(){
  try{
    const res = await window.storage.get('checklist:data');
    if(res && res.value) storeData = JSON.parse(res.value);
  }catch(e){ storeData = defaultStoreData(); }
  normalizeAndRenderStoreData();
}
// Re-applies defaults/fixups to storeData and re-renders the whole UI from it.
// Called on first load, and again after pulling newer data from the cloud on login.
function normalizeAndRenderStoreData(){
  if(!storeData.entries) storeData.entries={};
  if(!storeData.customCounters) storeData.customCounters = [];
  if(!storeData.customCounterMilestonesHit) storeData.customCounterMilestonesHit = {};
  storeData.profile = Object.assign(defaultProfile(), storeData.profile||{});
  if(storeData.whyText===undefined) storeData.whyText = "";
  if(!storeData.urgeLog) storeData.urgeLog = [];
  if(!storeData.slipHistory) storeData.slipHistory = [];
  if(!storeData.theme) storeData.theme = "brand";
  if(storeData.sfxEnabled===undefined) storeData.sfxEnabled = true;
  if(storeData.sfxVolume===undefined) storeData.sfxVolume = 10;
  if(!storeData.programLength) storeData.programLength = 90;
  if(!storeData.intensity) storeData.intensity = 'medium';
  if(!storeData.customItems) storeData.customItems = [];
  if(!storeData.customAvoidItems) storeData.customAvoidItems = [];
  if(!storeData.customTasks) storeData.customTasks = [];
  if(!storeData.focusSessions) storeData.focusSessions = {};
  if(storeData.customTaskNotifSeq===undefined) storeData.customTaskNotifSeq = 0;
  if(!storeData.badges) storeData.badges = {};
  if(storeData.maxStreak===undefined) storeData.maxStreak = 0;
  if(!storeData.lbPrivacy) storeData.lbPrivacy = {age:false, habit:false, programLen:false, titles:false};
  if(storeData.lbPrivacy.titles===undefined) storeData.lbPrivacy.titles = false;
  if(storeData.maxPhaseIndex===undefined) storeData.maxPhaseIndex = 0;
  if(!storeData.riskNudge) storeData.riskNudge = {dismissedKey:null, lastNotifLevel:null};
  if(storeData.selfieCount===undefined) storeData.selfieCount = 0;
  if(!storeData.reminder) storeData.reminder = {enabled:false, morning:"08:00", night:"22:30"};
  if(!storeData.smartReminder) storeData.smartReminder = {enabled:false, offsetMinutes:20};
  if(!storeData.streakMilestonesHit) storeData.streakMilestonesHit = {};
  if(!storeData.libraryDeepDive) storeData.libraryDeepDive = {};
  if(!storeData.libraryWeekly) storeData.libraryWeekly = {};
  if(!storeData.courseProgress) storeData.courseProgress = {};
  if(!storeData.chatHistory) storeData.chatHistory = [];
  if(!storeData.supportContact) storeData.supportContact = {name:"", phone:""};
  if(!storeData.lifeJournal) storeData.lifeJournal = {};
  if(!storeData.specialDays) storeData.specialDays = [];
  if(storeData.lifeAnalyzerReport===undefined) storeData.lifeAnalyzerReport = null;
  if(!storeData.goalsCustom) storeData.goalsCustom = { removed:{}, added:[] };
  if(!storeData.goalsCustom.removed) storeData.goalsCustom.removed = {};
  if(!storeData.goalsCustom.added) storeData.goalsCustom.added = [];
  if(!storeData.reportSentDates) storeData.reportSentDates = {};
  if(!storeData.aiFeatureUseCount) storeData.aiFeatureUseCount = {};
  // Stamped once, the first time this runs on a given account — the incomplete-day/
  // no-report XP penalty only ever looks at days from this date onward, so it can
  // never retroactively dock XP for days logged before the penalty existed.
  if(!storeData.xpPenaltyStartDate) storeData.xpPenaltyStartDate = today;
  if(storeData.musicEnabled === undefined) storeData.musicEnabled = true;
  if(storeData.musicVolume === undefined) storeData.musicVolume = 35;
  if(!storeData.appLock) storeData.appLock = {enabled:false, method:'pin', pinHash:null, salt:null, recoveryHash:null, recoverySalt:null};
  if(storeData.appLock && !storeData.appLock.method) storeData.appLock.method = 'pin';
  if(storeData.startDate && !storeData.startTimestamp){
    storeData.startTimestamp = dateOnly(storeData.startDate).toISOString();
  }
  if((storeData.profile.onboardingComplete || storeData.profile.onboardingSkipped) && !storeData.startDate){
    storeData.startDate = today;
    storeData.startTimestamp = new Date().toISOString();
  }
  ensureTomorrowPlan();
  applyTomorrowPlanIfDue();
  currentPhase = getPhase(programDay());
  entry = storeData.entries[today] || { done:{}, avoidDone:{}, momentDone:{}, note:"", lesson:"", milestonesHit:{}, total: totalToday(),
    phoneHours:null, meals:{b:"",l:"",d:"",snacks:""}, nightReview:null, mood:null, energy:null, weight:null, symptoms:{} };
  if(!entry.milestonesHit) entry.milestonesHit={};
  if(!entry.meals) entry.meals = {b:"",l:"",d:"",snacks:""};
  if(entry.phoneHours===undefined) entry.phoneHours = null;
  if(entry.nightReview===undefined) entry.nightReview = null;
  if(entry.mood===undefined) entry.mood = null;
  if(entry.energy===undefined) entry.energy = null;
  if(entry.weight===undefined) entry.weight = null;
  if(entry.lesson===undefined) entry.lesson = "";
  if(!entry.symptoms) entry.symptoms = {};
  if(!entry.extraDoItems) entry.extraDoItems = [];
  if(!entry.extraAvoidItems) entry.extraAvoidItems = [];
  if(!entry.doOverrides) entry.doOverrides = {};
  if(!entry.avoidOverrides) entry.avoidOverrides = {};

  // Onboarding: نه ساخت اکانت اجباریه و نه پیش‌نیاز آنبوردینگه. کل بخش خصوصی
  // (این ویزارد شخصی‌سازی و کل تب‌های امروز/تمرین/کتابخونه/... ) بدون حساب در
  // دسترسه. حساب فقط وقتی لازم می‌شه که کاربر خودش وارد بخش عمومی (چت/لیدربورد/
  // هم‌مسیر/پروفایل) بشه — آنجا showAuthGate() خودش نمایش داده می‌شه.
  // ویزارد پروفایل هم اختیاریه — کاربر می‌تونه ردش کنه (obSkipBtn -> skipOnboarding())
  // و هر وقت خواست از منوی «شخصی‌سازی برنامه» تکمیل/ویرایشش کنه.
  const overlay = document.getElementById('onboardOverlay');
  document.getElementById('accountCreateOverlay').classList.remove('show');
  if(!storeData.profile.onboardingComplete && !storeData.profile.onboardingSkipped){
    overlay.classList.add('show');
    openOnboarding(false);
    setJourneyStep(1);
  } else {
    overlay.classList.remove('show');
  }

  // Start the live day/hour/minute/second counter immediately — this must not be
  // blocked by any other widget below failing to render.
  try{ startLiveCounter(); }catch(err){ console.error('startLiveCounter failed', err); }
  try{ render(); }catch(err){ console.error('render failed', err); }
  try{ renderCustomCounters(); }catch(err){ console.error('renderCustomCounters failed', err); }
  try{ checkCustomCounterMilestones(); }catch(err){ console.error('checkCustomCounterMilestones failed', err); }

  const safeRun = (fn, label)=>{ try{ fn(); }catch(err){ console.error(label+' failed', err); } };

  safeRun(()=>{
    document.getElementById('noteArea').value = entry.note || '';
    document.getElementById('lessonArea').value = entry.lesson || '';
    document.getElementById('whyArea').value = storeData.whyText || '';
  }, 'note/why fields');
  safeRun(renderUrgeStats, 'renderUrgeStats');
  safeRun(()=>{
    document.getElementById('heightInput').value = storeData.profile.height ?? '';
    document.getElementById('weightInput').value = storeData.profile.weight ?? '';
    document.getElementById('goalWeightInput').value = storeData.profile.goalWeight ?? '';
    document.getElementById('phoneHoursInput').value = entry.phoneHours ?? '';
    document.getElementById('mealBreakfast').value = entry.meals.b || '';
    document.getElementById('mealLunch').value = entry.meals.l || '';
    document.getElementById('mealDinner').value = entry.meals.d || '';
    document.getElementById('mealSnacks').value = entry.meals.snacks || '';
    document.getElementById('nightWeightInput').value = entry.weight!=null ? entry.weight : '';
    document.getElementById('energyInput').value = entry.energy || 3;
    document.getElementById('energyNum').textContent = toFa(entry.energy || 3);
  }, 'profile/meal fields');
  safeRun(renderNightWeightNote, 'renderNightWeightNote');
  safeRun(()=>{
    document.querySelectorAll('#symptomGrid .symptom-chip').forEach(chip=>{
      chip.classList.toggle('active', !!entry.symptoms[chip.dataset.val]);
    });
  }, 'symptom chips');
  safeRun(()=>{
    document.getElementById('nightReviewBtn').textContent = entry.nightReview ? '🔄 دوباره تحلیل کن' : '✅ تایید و تحلیل امشب';
    document.getElementById('weeklyReviewBtn').textContent = storeData.weeklyReview ? '🔄 دوباره تحلیل کن' : 'تحلیل هفته اخیر';
    document.getElementById('monthlyReviewBtn').textContent = storeData.monthlyReview ? '🔄 دوباره تحلیل کن' : 'تحلیل ماه اخیر';
    document.getElementById('lessonsReviewBtn').textContent = storeData.lessonsReview ? '🔄 دوباره جمع‌بندی کن' : 'جمع‌بندی درس‌های این هفته';
    document.getElementById('letterBtn').textContent = storeData.futureLetter ? '🔄 دوباره بنویس' : 'بنویس نامه‌ی من';
    document.getElementById('contactNameInput').value = storeData.supportContact.name || '';
    document.getElementById('contactPhoneInput').value = storeData.supportContact.phone || '';
  }, 'button labels/contact fields');
  safeRun(renderLessonsReviewResult, 'renderLessonsReviewResult');
  safeRun(renderLifeJournalUI, 'renderLifeJournalUI');
  safeRun(renderMoodUI, 'renderMoodUI');
  safeRun(renderIfThenUI, 'renderIfThenUI');
  safeRun(renderProfileSummaryCard, 'renderProfileSummaryCard');
  safeRun(renderWeeklyResult, 'renderWeeklyResult');
  safeRun(renderMonthlyResult, 'renderMonthlyResult');
  safeRun(renderLetter, 'renderLetter');
  safeRun(updatePhoneStatus, 'updatePhoneStatus');
  safeRun(renderNightResult, 'renderNightResult');
  safeRun(checkWellnessStreak, 'checkWellnessStreak');
  safeRun(loadTodaySelfie, 'loadTodaySelfie');
  safeRun(loadWoBodyPhotos, 'loadWoBodyPhotos');
  safeRun(()=>{ applyTheme(storeData.theme, false); }, 'applyTheme');
  safeRun(initTimeOfDay, 'initTimeOfDay');
  safeRun(renderThemeRow, 'renderThemeRow');
  safeRun(renderSfxSettings, 'renderSfxSettings');
  safeRun(renderMusicSettings, 'renderMusicSettings');
  safeRun(initAmbientMusicAutoplay, 'initAmbientMusicAutoplay');
  safeRun(renderAppLockUI, 'renderAppLockUI');
  safeRun(()=>{ if(storeData.appLock && storeData.appLock.enabled) openLockScreen('unlock'); }, 'appLockInitialCheck');
  safeRun(renderLengthSeg, 'renderLengthSeg');
  safeRun(renderReminderUI, 'renderReminderUI');
  safeRun(renderLbPrivacyUI, 'renderLbPrivacyUI');
  safeRun(renderSmartReminderUI, 'renderSmartReminderUI');
  safeRun(scheduleSmartReminders, 'scheduleSmartReminders');
  safeRun(scheduleDailyReminders, 'scheduleDailyReminders');
  safeRun(scheduleInactivityNudge, 'scheduleInactivityNudge');
  safeRun(renderLibDeep, 'renderLibDeep');
  safeRun(renderMedTrackList, 'renderMedTrackList');
  safeRun(initWorkoutTab, 'initWorkoutTab');
  safeRun(checkCustomTaskReminders, 'checkCustomTaskReminders');
  safeRun(scheduleAllCustomTaskNotifs, 'scheduleAllCustomTaskNotifs');
  safeRun(render, 'render (final)');
}

function render(){
  const onboardedForPlan = !!(storeData.profile && storeData.profile.onboardingComplete);
  const doSectionEl = document.getElementById('doSection');
  const avoidSectionEl = document.getElementById('avoidSection');
  if(doSectionEl) doSectionEl.style.display = onboardedForPlan ? '' : 'none';
  if(avoidSectionEl) avoidSectionEl.style.display = onboardedForPlan ? '' : 'none';
  if(onboardedForPlan){
    renderList('doList', getDoItems(), entry.done, false);
    renderList('avoidList', getAvoidItems(), entry.avoidDone, true);
  }
  updateMiniRing();
  updateStreakUI();
  updateMountain();
  updateCoach();
  renderXP();
  renderBadges();
  if(typeof renderFocusStats === 'function') renderFocusStats();
  updateProgressCoach();
  renderGoalsRoadmap();
  renderHeatmap();
  renderPhaseCompare();
  renderStreakHistory();
  renderWeightProgress();
  renderCustomList();
  renderTomorrowTab();
  renderCustomTaskList();
  renderLibrary();
  renderSpecialDaySection();
  renderIntensitySection();
  updateMeditationCoach();
  updateSpeechCoach();
  applyPremiumLocksUI();
  updatePersonalizeHints();
}

/* ---- Program intensity card: shows which of light/medium/heavy/full is active
   and today's resulting task count, given the program's current day/length.
   «متوسط» is free; سبک، سنگین and کامل are locked behind premium/trial. ---- */
function renderIntensitySection(){
  const seg = document.getElementById('intensitySeg');
  if(!seg) return;
  const isPremiumUser = storeData.premium || isInTrial();
  const cur = (storeData.intensity !== 'medium' && !isPremiumUser) ? 'medium' : (storeData.intensity || 'medium');
  seg.querySelectorAll('button').forEach(b=>{
    b.classList.toggle('active', b.dataset.intensity===cur);
    b.classList.toggle('seg-locked', b.dataset.intensity!=='medium' && !isPremiumUser);
  });
  const desc = document.getElementById('intensityDesc');
  if(desc){
    const range = currentIntensityRange();
    const { doCount, avoidCount } = revealCounts(programDay());
    desc.textContent = `روز اول با ${toFa(range.min)} تسک شروع می‌شه و روز آخر برنامه‌ات به ${toFa(range.max)} تسک می‌رسه. امروز: ${toFa(doCount+avoidCount)} تسک.`;
  }
}

/* ---- Special day card: idle (پیشنهاد شروع) یا active (وضعیت فعلی + لغو) ---- */
function renderSpecialDaySection(){
  const card = document.getElementById('specialDayCard');
  if(!card) return;
  const active = getActiveSpecialDay();
  if(active){
    const dayIndex = Math.max(1, Math.floor((dateOnly(today) - dateOnly(active.startDate)) / 86400000) + 1);
    card.innerHTML = `<div class="special-day-active">
        <div class="special-day-active-title">برنامه‌ت الان سبک‌تره 🌤️</div>
        <div class="special-day-active-reason">دلیلت: ${escapeHtml(active.reason)}</div>
        <div class="special-day-active-days">روز ${toFa(dayIndex)} از ${toFa(active.days)}</div>
        <button class="special-day-cancel-btn" id="specialDayCancelBtn">برگردون به برنامه‌ی کامل</button>
      </div>`;
    const cancelBtn = document.getElementById('specialDayCancelBtn');
    if(cancelBtn) cancelBtn.addEventListener('click', cancelActiveSpecialDay);
  } else {
    card.innerHTML = `<div class="special-day-idle">
        <div class="special-day-idle-text">بعضی روزا کار مهمی داری و نمی‌تونی کل برنامه‌رو انجام بدی. برنامه‌ت رو موقتاً سبک‌تر کن تا فقط مهم‌ترین کارها بمونه.</div>
        <button class="special-day-btn" id="specialDayOpenBtn">📌 امروز روز خاصمه</button>
      </div>`;
    const openBtn = document.getElementById('specialDayOpenBtn');
    if(openBtn) openBtn.addEventListener('click', openSpecialDayOverlay);
  }
}
function openSpecialDayOverlay(){
  if(!requirePremium()) return;
  document.getElementById('specialDayReasonInput').value = '';
  document.getElementById('specialDayDaysInput').value = '';
  document.getElementById('specialDayOverlay').classList.add('show');
}
function closeSpecialDayOverlay(){
  document.getElementById('specialDayOverlay').classList.remove('show');
}
function cancelActiveSpecialDay(){
  const active = getActiveSpecialDay();
  if(!active) return;
  active.stoppedAt = new Date().toISOString();
  entry.total = totalToday();
  saveData();
  render();
  showToast('برگشتی به برنامه‌ی کامل 💪', 'success');
}

document.getElementById('noteArea').addEventListener('input',(e)=>{
  entry.note=e.target.value; saveData();
});
document.getElementById('lessonArea').addEventListener('input',(e)=>{
  entry.lesson=e.target.value; saveData();
});
document.getElementById('lessonArea').addEventListener('focus',(e)=>{
  if(!requirePremium()){ e.target.blur(); }
});
/* ---------------- Restart journey (relapse reset) ---------------- */
let journeyResetInProgress = false;
const streakResetBtnEl = document.getElementById('streakResetBtn');
if(streakResetBtnEl){
  streakResetBtnEl.addEventListener('click', (e)=>{
    e.stopPropagation();
    const modal = document.getElementById('journeyResetModal');
    if(modal) modal.classList.add('visible');
  });
}
const journeyResetCancelBtnEl = document.getElementById('journeyResetCancelBtn');
if(journeyResetCancelBtnEl){
  journeyResetCancelBtnEl.addEventListener('click', ()=>{
    const modal = document.getElementById('journeyResetModal');
    if(modal) modal.classList.remove('visible');
  });
}
document.querySelectorAll('#resetReasonList .reset-reason-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{ performJourneyReset(btn.dataset.reason); });
});
async function performJourneyReset(reasonKey){
  if(journeyResetInProgress) return;
  journeyResetInProgress = true;
  document.querySelectorAll('#resetReasonList .reset-reason-btn').forEach(b=> b.disabled = true);
  clearTimeout(saveTimeout);
  const finishedStreakDays = storeData.startDate ? computeStreak() : 0;
  storeData.startDate = today;
  storeData.startTimestamp = new Date().toISOString();
  storeData.entries = {};
  storeData.badges = {};
  storeData.streakMilestonesHit = {};
  storeData.maxStreak = 0;
  storeData.maxPhaseIndex = 0;
  storeData.firstDayCompleteShown = false;
  storeData.peakCelebrated = false;
  storeData.urgeLog = [];
  storeData.selfieCount = 0;
  storeData.weeklyReview = null;
  storeData.monthlyReview = null;
  storeData.lessonsReview = null;
  if(!storeData.slipHistory) storeData.slipHistory = [];
  storeData.slipHistory.push({date: today, reason: reasonKey, days: finishedStreakDays});
  storeData.lastModified = new Date().toISOString();
  try{ await window.storage.set('checklist:data', JSON.stringify(storeData)); }
  catch(e){ console.error('Storage error', e); }
  try{ await pushCloudData(); }catch(e){}
  // روزشمار که همین بالا صفر شد، همون لحظه به سرور هم اطلاع بدیم — وگرنه تا دفعه‌ی
  // بعد که تب لیدربورد رو باز کنی یا اپ رو دوباره لاگین کنی، بقیه هنوز عدد قدیمیِ
  // day_count رو می‌بینن. lbLastSyncedKey رو null می‌کنیم تا syncMyLeaderboardData
  // مطمئن باشه این تغییر رو (حتی اگه به‌طرز عجیبی با آخرین کلید سینک‌شده یکی بود) رد نکنه.
  try{
    if(typeof syncMyLeaderboardData === 'function'){
      lbLastSyncedKey = null;
      await syncMyLeaderboardData();
    }
  }catch(e){ console.error('Post-reset leaderboard sync failed', e); }

  // Re-render everything from the freshly-reset storeData, in place — no page
  // reload, so the intro splash never replays and there's no risky round-trip
  // through storage (which could momentarily fail to read back what we just wrote).
  const modal = document.getElementById('journeyResetModal');
  if(modal) modal.classList.remove('visible');
  document.querySelectorAll('#resetReasonList .reset-reason-btn').forEach(b=> b.disabled = false);
  journeyResetInProgress = false;
  try{ normalizeAndRenderStoreData(); }catch(err){ console.error('normalizeAndRenderStoreData failed after reset', err); }
  showToast('مسیرت از نو شروع شد 🌱');
}

/* ---------------- Confetti ---------------- */
const canvas=document.getElementById('confettiCanvas');
const ctx=canvas.getContext('2d');
function resizeCanvas(){ canvas.width=window.innerWidth; canvas.height=window.innerHeight; }
resizeCanvas(); window.addEventListener('resize', resizeCanvas);
function launchConfetti(){
  const colors=['#ff9a3d','#ffb347','#3fb87f','#e2665a','#ffd166'];
  const pieces=[];
  for(let i=0;i<120;i++){
    pieces.push({x:Math.random()*canvas.width,y:-20-Math.random()*canvas.height*0.3,
      w:6+Math.random()*6,h:8+Math.random()*8,color:colors[Math.floor(Math.random()*colors.length)],
      speedY:2+Math.random()*3,speedX:-1.5+Math.random()*3,rot:Math.random()*360,rotSpeed:-6+Math.random()*12});
  }
  let frame=0;
  function animate(){
    ctx.clearRect(0,0,canvas.width,canvas.height); frame++;
    let active=false;
    pieces.forEach(p=>{
      p.y+=p.speedY; p.x+=p.speedX; p.rot+=p.rotSpeed;
      if(p.y<canvas.height+20) active=true;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180);
      ctx.fillStyle=p.color; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h); ctx.restore();
    });
    if(active && frame<240) requestAnimationFrame(animate);
    else ctx.clearRect(0,0,canvas.width,canvas.height);
  }
  animate();
}

/* ---------------- Background music: single background track played from an actual
   audio file (assets/bg-music.mp3), looped seamlessly. Volume is user-adjustable and
   saved in storeData.musicVolume (0-100), on/off state saved in storeData.musicEnabled. */
const bgMusicEl = document.getElementById('bgMusic');
let musicOn = false;

function musicVolumeLevel(){
  const v = (storeData && storeData.musicVolume !== undefined) ? storeData.musicVolume : 35;
  return Math.max(0, Math.min(100, v)) / 100;
}
function applyMusicVolume(){
  if(bgMusicEl) bgMusicEl.volume = musicVolumeLevel();
}
function setMusicButtonState(){
  const btn = document.getElementById('musicBtn');
  if(!btn) return;
  btn.classList.toggle('on', musicOn);
  btn.textContent = musicOn ? '🎶' : '🎵';
}
async function startMusic(){
  if(!bgMusicEl) return;
  applyMusicVolume();
  try{ await bgMusicEl.play(); musicOn = true; }
  catch(e){ musicOn = false; }
  setMusicButtonState();
}
function stopMusic(){
  if(bgMusicEl){ bgMusicEl.pause(); }
  musicOn = false;
  setMusicButtonState();
}
// دکمه‌ی موزیک از هدر حذف شد (کنترل موزیک فقط از تنظیمات → «موزیک پس‌زمینه» انجام می‌شه، هندلر musicToggle پایین‌تر).
const musicBtnElHeader = document.getElementById('musicBtn');
if(musicBtnElHeader){
  musicBtnElHeader.addEventListener('click', async (e)=>{
    e.stopPropagation();
    if(musicOn){
      stopMusic();
      storeData.musicEnabled = false;
    } else {
      await startMusic();
      storeData.musicEnabled = true;
    }
    saveData();
  });
}
// Try to start the background music automatically when the app opens (if enabled last time).
// Browsers/webviews block audio autoplay until there's been at least one tap on the page,
// so if the automatic attempt is blocked we fall back to starting it on the very first tap.
function initAmbientMusicAutoplay(){
  applyMusicVolume();
  if(storeData.musicEnabled === false){ setMusicButtonState(); return; }
  startMusic().catch(()=>{});
  const startOnFirstGesture = ()=>{
    if(!musicOn && storeData.musicEnabled !== false){ startMusic().catch(()=>{}); }
    document.removeEventListener('click', startOnFirstGesture);
    document.removeEventListener('touchstart', startOnFirstGesture);
  };
  document.addEventListener('click', startOnFirstGesture, {once:true});
  document.addEventListener('touchstart', startOnFirstGesture, {once:true});
}

/* ---------------- Voice narrations (app intro / today-tab explainer / premium explainer) ----------------
   Three short pre-recorded voice-overs. Premium's button always lives inside the premium panel.
   The intro and today-tab ones are offered once as a dismissible "می‌خوای گوش بدی؟" suggestion
   (intro: when onboarding opens; today-tab: the first time the کاربر opens "برنامه‌ی روزانه"),
   and after that stay reachable only from the Guide tab. Playing one pauses the background music
   (and any other narration) and resumes it afterwards if it was on. Multiple buttons can control
   the same audio element (e.g. a suggestion banner + its Guide-tab counterpart) and stay in sync. */
const narrationButtonRegistry = {}; // audioId -> [{btn, baseLabel}]
let narrationMusicWasOn = false;

function narrationSetUI(audioId, playing){
  (narrationButtonRegistry[audioId]||[]).forEach(({btn, baseLabel})=>{
    btn.textContent = playing ? ('⏸️ ' + baseLabel.replace(/^🔊\s*/, '')) : baseLabel;
    btn.classList.toggle('playing', playing);
  });
}
function narrationReset(audioId){
  narrationSetUI(audioId, false);
  if(narrationMusicWasOn && bgMusicEl && bgMusicEl.paused) startMusic();
  narrationMusicWasOn = false;
}
async function narrationToggle(audioId){
  const audio = document.getElementById(audioId);
  if(!audio) return;
  if(!audio.paused){ audio.pause(); narrationReset(audioId); return; }
  document.querySelectorAll('audio.narration-audio').forEach(a=>{ if(a.id !== audioId && !a.paused){ a.pause(); narrationReset(a.id); } });
  narrationMusicWasOn = musicOn;
  if(bgMusicEl && !bgMusicEl.paused) bgMusicEl.pause();
  try{
    await audio.play();
    narrationSetUI(audioId, true);
  }catch(e){
    showToast('پخش صدا با مشکل مواجه شد', 'error');
    narrationReset(audioId);
  }
}
function registerNarrationButton(audioId, btn){
  if(!btn) return;
  const audio = document.getElementById(audioId);
  if(!audio) return;
  if(!narrationButtonRegistry[audioId]) narrationButtonRegistry[audioId] = [];
  narrationButtonRegistry[audioId].push({ btn, baseLabel: btn.textContent });
  btn.addEventListener('click', ()=>narrationToggle(audioId));
  if(!audio.dataset.narrationEndedWired){
    audio.addEventListener('ended', ()=>narrationReset(audioId));
    audio.dataset.narrationEndedWired = '1';
  }
}
registerNarrationButton('narrationIntroAudio', document.getElementById('narrationIntroGuideBtn'));
registerNarrationButton('narrationTodayAudio', document.getElementById('narrationTodayGuideBtn'));
registerNarrationButton('narrationPremiumAudio', document.getElementById('narrationPremiumBtn'));

function buildNarrationSuggestBanner(audioId, text, playLabel){
  const wrap = document.createElement('div');
  wrap.className = 'narration-suggest-banner';
  wrap.innerHTML = `<div class="nsb-text">${text}</div>
    <div class="nsb-actions">
      <button type="button" class="narration-play-btn nsb-play">${playLabel}</button>
      <button type="button" class="nsb-dismiss">بعداً</button>
    </div>`;
  registerNarrationButton(audioId, wrap.querySelector('.nsb-play'));
  wrap.querySelector('.nsb-dismiss').addEventListener('click', ()=> wrap.remove());
  return wrap;
}
function maybeSuggestIntroNarration(){
  if(storeData.narrationIntroSuggested) return;
  const slot = document.getElementById('narrationIntroSuggestSlot');
  if(!slot) return;
  slot.innerHTML = '';
  slot.appendChild(buildNarrationSuggestBanner('narrationIntroAudio',
    'می‌خوای قبل از شروع، یه معرفی صوتی کوتاه از برنامه بشنوی؟', '▶️ گوش بده'));
  storeData.narrationIntroSuggested = true;
  saveData();
}
function maybeSuggestTodayNarration(){
  if(storeData.narrationTodaySuggested) return;
  const slot = document.getElementById('narrationTodaySuggestSlot');
  if(!slot) return;
  slot.innerHTML = '';
  slot.appendChild(buildNarrationSuggestBanner('narrationTodayAudio',
    'اولین باره اینجایی — می‌خوای یه توضیح صوتی کوتاه از این بخش بشنوی؟', '▶️ گوش بده'));
  storeData.narrationTodaySuggested = true;
  saveData();
}


/* ---------------- App lock (PIN / Pattern / Color) ---------------- */
let lockMode = null, lockEnteredDigits = [], lockEnteredColors = [], lockPendingCode = null, appLockSessionUnlocked = false;
let lockActiveMethod = 'pin', pendingMethodSwitch = null, lockRecoveryMode = false;
let patternPath = [], patternDragging = false;

const LOCK_TEXTS = {
  pin: {
    unlock:          ['اپ قفله', 'پین رو وارد کن'],
    setup1:          ['یه پین ۴ رقمی انتخاب کن', 'این پین رو هر بار موقع باز کردن اپ لازم داری'],
    setup2:          ['یه بار دیگه پین رو وارد کن', 'برای تایید'],
    'change-verify': ['پین فعلی رو وارد کن', 'برای تغییر پین'],
    'disable-verify':['پین فعلی رو وارد کن', 'برای غیرفعال کردن قفل'],
    'recovery-verify':['پین فعلی رو وارد کن', 'برای گرفتن کد بازیابی جدید']
  },
  pattern: {
    unlock:          ['اپ قفله', 'الگو رو بکش'],
    setup1:          ['یه الگو انتخاب کن', 'حداقل ۴ نقطه رو به هم وصل کن'],
    setup2:          ['یه بار دیگه الگو رو بکش', 'برای تایید'],
    'change-verify': ['الگوی فعلی رو بکش', 'برای تغییر الگو'],
    'disable-verify':['الگوی فعلی رو بکش', 'برای غیرفعال کردن قفل'],
    'recovery-verify':['الگوی فعلی رو بکش', 'برای گرفتن کد بازیابی جدید']
  },
  color: {
    unlock:          ['اپ قفله', '۴ رنگ رو به ترتیب لمس کن'],
    setup1:          ['۴ رنگ به ترتیب دلخواه انتخاب کن', 'این ترتیب رو هر بار موقع باز کردن اپ لازم داری'],
    setup2:          ['یه بار دیگه رنگ‌ها رو انتخاب کن', 'برای تایید'],
    'change-verify': ['رمز رنگی فعلی رو وارد کن', 'برای تغییر رمز رنگی'],
    'disable-verify':['رمز رنگی فعلی رو وارد کن', 'برای غیرفعال کردن قفل'],
    'recovery-verify':['رمز رنگی فعلی رو وارد کن', 'برای گرفتن کد بازیابی جدید']
  }
};

function genLockSalt(){
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function hashPin(code, salt){
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(salt + ':' + code));
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function genRecoveryCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — avoids look-alike mistakes when typing back
  const arr = new Uint8Array(10);
  crypto.getRandomValues(arr);
  let out = '';
  for(let i=0;i<10;i++){ out += chars[arr[i] % chars.length]; }
  return out.slice(0,5) + '-' + out.slice(5);
}
function currentLockMethodForMode(mode){
  if(mode === 'setup1' || mode === 'setup2'){
    return pendingMethodSwitch || (storeData.appLock && storeData.appLock.method) || 'pin';
  }
  return (storeData.appLock && storeData.appLock.method) || 'pin';
}
function renderLockDots(){
  const dots = document.querySelectorAll('#lockDots .lock-dot');
  const len = lockActiveMethod === 'color' ? lockEnteredColors.length : lockEnteredDigits.length;
  dots.forEach((d,i)=>{ d.classList.toggle('filled', i < len); });
}
function resetPattern(){
  patternPath = [];
  document.querySelectorAll('#patternSvg .pattern-dot').forEach(d=>d.classList.remove('active'));
  updatePatternLine();
}
function updatePatternLine(x,y){
  const line = document.getElementById('patternLine');
  if(!line) return;
  const pts = patternPath.map(idx=>{
    const d = document.querySelector('#patternSvg .pattern-dot[data-idx="'+idx+'"]');
    return d ? (d.getAttribute('cx')+','+d.getAttribute('cy')) : '';
  }).filter(Boolean);
  if(x !== undefined) pts.push(x+','+y);
  line.setAttribute('points', pts.join(' '));
}
function resetLockInputUI(){
  lockEnteredDigits = [];
  lockEnteredColors = [];
  renderLockDots();
  resetPattern();
  const recInput = document.getElementById('lockRecoveryInput');
  if(recInput) recInput.value = '';
}
function lockError(msg){
  const errEl = document.getElementById('lockError');
  if(errEl) errEl.textContent = msg;
  const shakeTarget = lockRecoveryMode ? document.getElementById('lockRecoveryWrap')
                     : lockActiveMethod === 'pattern' ? document.getElementById('lockPatternGrid')
                     : lockActiveMethod === 'color' ? document.getElementById('lockColorGrid')
                     : document.getElementById('lockDots');
  if(shakeTarget){
    shakeTarget.classList.add('shake');
    setTimeout(()=>{ shakeTarget.classList.remove('shake'); }, 400);
  }
  setTimeout(resetLockInputUI, 380);
}
function updateLockInputVisibility(){
  const method = lockActiveMethod;
  const dotsEl = document.getElementById('lockDots');
  const keypadEl = document.getElementById('lockKeypad');
  const patternEl = document.getElementById('lockPatternGrid');
  const colorEl = document.getElementById('lockColorGrid');
  const recoveryEl = document.getElementById('lockRecoveryWrap');
  const forgotLink = document.getElementById('lockForgotLink');
  const canRecover = (lockMode === 'unlock' || lockMode === 'change-verify' || lockMode === 'disable-verify' || lockMode === 'recovery-verify');
  if(forgotLink) forgotLink.style.display = canRecover ? 'block' : 'none';
  if(lockRecoveryMode && canRecover){
    if(dotsEl) dotsEl.style.display = 'none';
    if(keypadEl) keypadEl.style.display = 'none';
    if(patternEl) patternEl.style.display = 'none';
    if(colorEl) colorEl.style.display = 'none';
    if(recoveryEl) recoveryEl.style.display = 'block';
  } else {
    if(dotsEl) dotsEl.style.display = (method === 'pin' || method === 'color') ? 'flex' : 'none';
    if(keypadEl) keypadEl.style.display = (method === 'pin') ? 'grid' : 'none';
    if(patternEl) patternEl.style.display = (method === 'pattern') ? 'block' : 'none';
    if(colorEl) colorEl.style.display = (method === 'color') ? 'block' : 'none';
    if(recoveryEl) recoveryEl.style.display = 'none';
  }
}
function applyLockModeUI(mode, subOverride){
  lockMode = mode;
  lockRecoveryMode = false;
  const method = currentLockMethodForMode(mode);
  lockActiveMethod = method;
  const texts = (LOCK_TEXTS[method] || LOCK_TEXTS.pin)[mode] || LOCK_TEXTS.pin.unlock;
  const titleEl = document.getElementById('lockTitle');
  const subEl = document.getElementById('lockSub');
  const cancelBtn = document.getElementById('lockCancelBtn');
  const errEl = document.getElementById('lockError');
  const forgotLink = document.getElementById('lockForgotLink');
  if(titleEl) titleEl.textContent = texts[0];
  if(subEl) subEl.textContent = subOverride || texts[1];
  if(cancelBtn) cancelBtn.style.display = (mode === 'unlock') ? 'none' : 'block';
  if(errEl) errEl.textContent = '';
  if(forgotLink) forgotLink.textContent = 'رمزت یادت رفته؟';
  updateLockInputVisibility();
  resetLockInputUI();
}
function openLockScreen(mode){
  lockPendingCode = null;
  applyLockModeUI(mode);
  const screen = document.getElementById('appLockScreen');
  if(screen) screen.classList.add('visible');
}
function closeLockScreen(){
  const screen = document.getElementById('appLockScreen');
  if(screen) screen.classList.remove('visible');
  const errEl = document.getElementById('lockError');
  if(errEl) errEl.textContent = '';
  lockEnteredDigits = [];
  lockEnteredColors = [];
  lockMode = null;
  lockPendingCode = null;
  pendingMethodSwitch = null;
  lockRecoveryMode = false;
  resetPattern();
}
function renderAppLockUI(){
  const enabled = !!(storeData.appLock && storeData.appLock.enabled);
  const method = (storeData.appLock && storeData.appLock.method) || 'pin';
  const toggle = document.getElementById('appLockToggle');
  if(toggle) toggle.checked = enabled;
  const changeBtn = document.getElementById('appLockChangePin');
  if(changeBtn){
    changeBtn.style.display = enabled ? 'inline-block' : 'none';
    changeBtn.textContent = method === 'pattern' ? 'تغییر الگو' : method === 'color' ? 'تغییر رمز رنگی' : 'تغییر پین';
  }
  const newRecoveryBtn = document.getElementById('appLockNewRecoveryBtn');
  if(newRecoveryBtn) newRecoveryBtn.style.display = enabled ? 'inline-block' : 'none';
  document.querySelectorAll('#lockMethodSeg button[data-method]').forEach(b=>{
    b.classList.toggle('active', b.getAttribute('data-method') === method);
  });
}
function showRecoveryCodeModal(code){
  const modal = document.getElementById('recoveryCodeModal');
  const textEl = document.getElementById('recoveryCodeText');
  if(textEl) textEl.textContent = code;
  if(modal) modal.classList.add('visible');
}
async function processLockCode(code){
  const wrongMsg = lockActiveMethod === 'pattern' ? 'الگو اشتباهه، دوباره امتحان کن'
                  : lockActiveMethod === 'color' ? 'ترتیب رنگ‌ها اشتباهه، دوباره امتحان کن'
                  : 'پین اشتباهه، دوباره امتحان کن';
  if(lockMode === 'unlock'){
    const hash = await hashPin(code, storeData.appLock.salt);
    if(hash === storeData.appLock.pinHash){
      appLockSessionUnlocked = true;
      closeLockScreen();
    } else {
      lockError(wrongMsg);
    }
  } else if(lockMode === 'setup1'){
    lockPendingCode = code;
    applyLockModeUI('setup2');
  } else if(lockMode === 'setup2'){
    if(code === lockPendingCode){
      const salt = genLockSalt();
      const hash = await hashPin(code, salt);
      const targetMethod = pendingMethodSwitch || (storeData.appLock && storeData.appLock.method) || 'pin';
      const recoveryCode = genRecoveryCode();
      const recoverySalt = genLockSalt();
      const recoveryHash = await hashPin(recoveryCode, recoverySalt);
      storeData.appLock = {enabled:true, method:targetMethod, pinHash:hash, salt:salt, recoveryHash:recoveryHash, recoverySalt:recoverySalt};
      pendingMethodSwitch = null;
      saveData();
      appLockSessionUnlocked = true;
      renderAppLockUI();
      closeLockScreen();
      showRecoveryCodeModal(recoveryCode);
    } else {
      lockPendingCode = null;
      const targetMethod = currentLockMethodForMode('setup1');
      const mismatchMsg = targetMethod === 'pattern' ? 'الگوها یکسان نبودن، دوباره امتحان کن'
                         : targetMethod === 'color' ? 'ترتیب رنگ‌ها یکسان نبودن، دوباره امتحان کن'
                         : 'پین‌ها یکسان نبودن، دوباره امتحان کن';
      applyLockModeUI('setup1', mismatchMsg);
    }
  } else if(lockMode === 'change-verify'){
    const hash = await hashPin(code, storeData.appLock.salt);
    if(hash === storeData.appLock.pinHash){
      applyLockModeUI('setup1');
    } else {
      lockError(wrongMsg);
    }
  } else if(lockMode === 'disable-verify'){
    const hash = await hashPin(code, storeData.appLock.salt);
    if(hash === storeData.appLock.pinHash){
      storeData.appLock.enabled = false;
      storeData.appLock.pinHash = null;
      storeData.appLock.salt = null;
      storeData.appLock.recoveryHash = null;
      storeData.appLock.recoverySalt = null;
      saveData();
      renderAppLockUI();
      closeLockScreen();
    } else {
      lockError(wrongMsg);
    }
  } else if(lockMode === 'recovery-verify'){
    const hash = await hashPin(code, storeData.appLock.salt);
    if(hash === storeData.appLock.pinHash){
      const newCode = genRecoveryCode();
      const newSalt = genLockSalt();
      storeData.appLock.recoveryHash = await hashPin(newCode, newSalt);
      storeData.appLock.recoverySalt = newSalt;
      saveData();
      closeLockScreen();
      showRecoveryCodeModal(newCode);
    } else {
      lockError(wrongMsg);
    }
  }
}
async function handleRecoverySubmit(){
  const input = document.getElementById('lockRecoveryInput');
  if(!input) return;
  const code = input.value.trim().toUpperCase();
  if(!code){ lockRecoveryInputError('کد رو وارد کن'); return; }
  if(!storeData.appLock || !storeData.appLock.recoveryHash){
    lockRecoveryInputError('کد بازیابی‌ای برای این قفل ثبت نشده'); return;
  }
  const hash = await hashPin(code, storeData.appLock.recoverySalt);
  if(hash !== storeData.appLock.recoveryHash){
    lockRecoveryInputError('کد بازیابی درست نیست');
    return;
  }
  if(lockMode === 'disable-verify'){
    storeData.appLock.enabled = false;
    storeData.appLock.pinHash = null;
    storeData.appLock.salt = null;
    storeData.appLock.recoveryHash = null;
    storeData.appLock.recoverySalt = null;
    saveData();
    renderAppLockUI();
    closeLockScreen();
  } else if(lockMode === 'recovery-verify'){
    const newCode = genRecoveryCode();
    const newSalt = genLockSalt();
    storeData.appLock.recoveryHash = await hashPin(newCode, newSalt);
    storeData.appLock.recoverySalt = newSalt;
    saveData();
    closeLockScreen();
    showRecoveryCodeModal(newCode);
  } else {
    // unlock or change-verify → let them in, then have them pick a fresh code
    appLockSessionUnlocked = true;
    lockRecoveryMode = false;
    applyLockModeUI('setup1', 'رمز قبلی پاک شد؛ یه رمز جدید انتخاب کن');
  }
}
function lockRecoveryInputError(msg){
  const errEl = document.getElementById('lockError');
  if(errEl) errEl.textContent = msg;
  const wrap = document.getElementById('lockRecoveryWrap');
  if(wrap){ wrap.classList.add('shake'); setTimeout(()=>wrap.classList.remove('shake'), 400); }
}
const lockKeypadEl = document.getElementById('lockKeypad');
if(lockKeypadEl){
  lockKeypadEl.addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-k]');
    if(!btn) return;
    const k = btn.getAttribute('data-k');
    const errEl = document.getElementById('lockError');
    if(k === 'del'){
      lockEnteredDigits.pop();
      renderLockDots();
      return;
    }
    if(lockEnteredDigits.length >= 4) return;
    if(lockEnteredDigits.length === 0 && errEl) errEl.textContent = '';
    lockEnteredDigits.push(k);
    renderLockDots();
    if(lockEnteredDigits.length === 4){
      setTimeout(()=>processLockCode(lockEnteredDigits.join('')), 120);
    }
  });
}
const lockColorGridEl = document.getElementById('lockColorGrid');
if(lockColorGridEl){
  lockColorGridEl.addEventListener('click', (e)=>{
    const tile = e.target.closest('.lock-color-tile');
    if(tile){
      if(lockEnteredColors.length >= 4) return;
      const errEl = document.getElementById('lockError');
      if(lockEnteredColors.length === 0 && errEl) errEl.textContent = '';
      lockEnteredColors.push(tile.getAttribute('data-color'));
      renderLockDots();
      if(lockEnteredColors.length === 4){
        setTimeout(()=>processLockCode(lockEnteredColors.join('-')), 150);
      }
      return;
    }
    if(e.target.closest('#lockColorUndo')){
      lockEnteredColors.pop();
      renderLockDots();
    }
  });
}

/* pattern grid interaction */
function getPatternPoint(evt, svgEl){
  const rect = svgEl.getBoundingClientRect();
  const scaleX = 240 / rect.width, scaleY = 240 / rect.height;
  return { x:(evt.clientX - rect.left) * scaleX, y:(evt.clientY - rect.top) * scaleY };
}
function findNearestPatternDot(x,y){
  const dots = document.querySelectorAll('#patternSvg .pattern-dot');
  for(const d of dots){
    const cx = parseFloat(d.getAttribute('cx')), cy = parseFloat(d.getAttribute('cy'));
    if(Math.hypot(cx-x, cy-y) <= 22) return d;
  }
  return null;
}
function addPatternDot(dotEl){
  const idx = parseInt(dotEl.getAttribute('data-idx'),10);
  if(patternPath.includes(idx)) return;
  patternPath.push(idx);
  dotEl.classList.add('active');
}
const patternSvgEl = document.getElementById('patternSvg');
if(patternSvgEl){
  const patternStart = (evt)=>{
    evt.preventDefault();
    resetPattern();
    patternDragging = true;
    const {x,y} = getPatternPoint(evt, patternSvgEl);
    const dot = findNearestPatternDot(x,y);
    if(dot) addPatternDot(dot);
    updatePatternLine(x,y);
    const errEl = document.getElementById('lockError');
    if(errEl) errEl.textContent = '';
  };
  const patternMove = (evt)=>{
    if(!patternDragging) return;
    evt.preventDefault();
    const {x,y} = getPatternPoint(evt, patternSvgEl);
    const dot = findNearestPatternDot(x,y);
    if(dot) addPatternDot(dot);
    updatePatternLine(x,y);
  };
  const patternEnd = ()=>{
    if(!patternDragging) return;
    patternDragging = false;
    updatePatternLine();
    if(patternPath.length >= 4){
      setTimeout(()=>processLockCode(patternPath.join('-')), 150);
    } else if(patternPath.length > 0){
      lockError('حداقل ۴ نقطه رو وصل کن');
    }
  };
  patternSvgEl.addEventListener('pointerdown', patternStart);
  patternSvgEl.addEventListener('pointermove', patternMove);
  patternSvgEl.addEventListener('pointerup', patternEnd);
  patternSvgEl.addEventListener('pointerleave', patternEnd);
  patternSvgEl.addEventListener('pointercancel', patternEnd);
}

const lockCancelBtnEl = document.getElementById('lockCancelBtn');
if(lockCancelBtnEl) lockCancelBtnEl.addEventListener('click', closeLockScreen);
const appLockToggleEl = document.getElementById('appLockToggle');
if(appLockToggleEl){
  appLockToggleEl.addEventListener('change', (e)=>{
    if(e.target.checked){
      e.target.checked = false; // stays off until the new PIN/pattern is confirmed
      openLockScreen('setup1');
    } else {
      e.target.checked = true; // stays on until the current PIN/pattern is verified
      openLockScreen('disable-verify');
    }
  });
}
const appLockChangePinEl = document.getElementById('appLockChangePin');
if(appLockChangePinEl) appLockChangePinEl.addEventListener('click', ()=>{ openLockScreen('change-verify'); });
const appLockNewRecoveryBtnEl = document.getElementById('appLockNewRecoveryBtn');
if(appLockNewRecoveryBtnEl) appLockNewRecoveryBtnEl.addEventListener('click', ()=>{ openLockScreen('recovery-verify'); });
const lockForgotLinkEl = document.getElementById('lockForgotLink');
if(lockForgotLinkEl){
  lockForgotLinkEl.addEventListener('click', ()=>{
    lockRecoveryMode = !lockRecoveryMode;
    lockForgotLinkEl.textContent = lockRecoveryMode ? '‹ بازگشت' : 'رمزت یادت رفته؟';
    const errEl = document.getElementById('lockError');
    if(errEl) errEl.textContent = '';
    resetLockInputUI();
    updateLockInputVisibility();
  });
}
const lockRecoveryInputEl = document.getElementById('lockRecoveryInput');
if(lockRecoveryInputEl){
  lockRecoveryInputEl.addEventListener('input', ()=>{
    let v = lockRecoveryInputEl.value.toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(v.length > 10) v = v.slice(0,10);
    if(v.length > 5) v = v.slice(0,5) + '-' + v.slice(5);
    lockRecoveryInputEl.value = v;
  });
  lockRecoveryInputEl.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter') handleRecoverySubmit();
  });
}
const lockRecoverySubmitEl = document.getElementById('lockRecoverySubmit');
if(lockRecoverySubmitEl) lockRecoverySubmitEl.addEventListener('click', handleRecoverySubmit);
async function copyRecoveryCode(code){
  // Modern Clipboard API — needs a secure context, which not every WebView/local test provides
  if(navigator.clipboard && navigator.clipboard.writeText){
    try{
      await navigator.clipboard.writeText(code);
      return true;
    }catch(e){ /* fall through to the legacy method below */ }
  }
  // Legacy fallback — works in far more embedded WebViews and non-HTTPS contexts
  try{
    const ta = document.createElement('textarea');
    ta.value = code;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, code.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if(ok) return true;
  }catch(e){ /* still failed — caller shows a manual-copy hint */ }
  return false;
}
const recoveryCopyBtnEl = document.getElementById('recoveryCopyBtn');
if(recoveryCopyBtnEl){
  recoveryCopyBtnEl.addEventListener('click', async ()=>{
    const code = document.getElementById('recoveryCodeText').textContent;
    const ok = await copyRecoveryCode(code);
    if(ok){
      recoveryCopyBtnEl.textContent = '✅ کپی شد';
      setTimeout(()=>{ recoveryCopyBtnEl.textContent = '📋 کپی کد'; }, 1500);
    } else {
      recoveryCopyBtnEl.textContent = '⚠️ کپی خودکار نشد — کد رو لمس کن و دستی کپی کن';
      setTimeout(()=>{ recoveryCopyBtnEl.textContent = '📋 کپی کد'; }, 2600);
    }
  });
}
const recoveryConfirmBtnEl = document.getElementById('recoveryConfirmBtn');
if(recoveryConfirmBtnEl){
  recoveryConfirmBtnEl.addEventListener('click', ()=>{
    const modal = document.getElementById('recoveryCodeModal');
    if(modal) modal.classList.remove('visible');
  });
}
const lockMethodSegEl = document.getElementById('lockMethodSeg');
if(lockMethodSegEl){
  lockMethodSegEl.addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-method]');
    if(!btn) return;
    const newMethod = btn.getAttribute('data-method');
    const curMethod = (storeData.appLock && storeData.appLock.method) || 'pin';
    if(newMethod === curMethod) return;
    if(storeData.appLock && storeData.appLock.enabled){
      pendingMethodSwitch = newMethod;
      openLockScreen('change-verify');
    } else {
      if(!storeData.appLock) storeData.appLock = {enabled:false, method:newMethod, pinHash:null, salt:null, recoveryHash:null, recoverySalt:null};
      else storeData.appLock.method = newMethod;
      saveData();
      renderAppLockUI();
    }
  });
}
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden){
    appLockSessionUnlocked = false;
  } else {
    const screen = document.getElementById('appLockScreen');
    const alreadyOpen = screen && screen.classList.contains('visible');
    if(storeData.appLock && storeData.appLock.enabled && !appLockSessionUnlocked && !alreadyOpen){
      openLockScreen('unlock');
    }
  }
});

/* ---------------- Weekly AI report ---------------- */
function gatherStats(numDays){
  const days=[];
  const d=new Date();
  for(let i=0;i<numDays;i++){
    const key = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const e = storeData.entries[key];
    if(e){
      const doneCount = Object.values(e.done||{}).filter(Boolean).length
        + Object.values(e.avoidDone||{}).filter(Boolean).length
        + Object.values(e.momentDone||{}).filter(Boolean).length;
      const tot = e.total || 1;
      days.push({ date:key, pct: Math.round((doneCount/tot)*100), phoneHours: e.phoneHours });
    }
    d.setDate(d.getDate()-1);
  }
  const sinceMs = Date.now() - numDays*86400000;
  const periodUrges = (storeData.urgeLog||[]).filter(u=> new Date(u.ts).getTime() >= sinceMs);
  const resisted = periodUrges.filter(u=>u.resisted).length;
  return { days, urgeTotal: periodUrges.length, urgeResisted: resisted };
}
function gatherWeekStats(){ return gatherStats(7); }
document.getElementById('weeklyReviewBtn').addEventListener('click', async ()=>{
  if(!gatePeriodicFeature('weeklyReview', 'گزارش هفتگی', 7)) return;
  const btn = document.getElementById('weeklyReviewBtn');
  btn.disabled = true; btn.textContent = 'در حال تحلیل...';
  try{
    const stats = gatherWeekStats();
    const daysText = stats.days.map(d=>`${d.date}: ${d.pct}% انجام‌شده${d.phoneHours!=null?', گوشی '+d.phoneHours+' ساعت':''}${d.mood?', حال‌وهوا '+d.mood+'/۵':''}`).join('\n') || 'داده‌ای برای این هفته ثبت نشده';
    const prevSummary = storeData.weeklyReview && storeData.weeklyReview.data && storeData.weeklyReview.data.summary;
    const sys = personaSystemPrompt("تو یه مشاور و منتور سبک‌زندگی سالم هستی که مسیر این کاربر رو از اول دنبال می‌کنی. جمع‌بندی‌هات رو دقیقاً بر اساس هدف و عادت‌هایی که بالا نوشته شده بنویس.");
    const prompt = `این خلاصه‌ی ۷ روز اخیر همین کاربره که تو یه برنامه‌ی ${storeData.programLength} روزه تغییر عادت شرکت کرده:
مرحله فعلی: ${currentPhase.name}
دلیل شخصی‌اش برای تغییر: ${storeData.whyText || 'ثبت نشده'}
عملکرد روزانه این هفته:
${daysText}
تعداد وسوسه‌های ثبت‌شده این هفته: ${stats.urgeTotal}، تعداد دفعاتی که مقاومت کرده: ${stats.urgeResisted}
${prevSummary ? 'جمع‌بندی هفته‌ی قبل این بود: "'+prevSummary+'" — اگه لازمه به روند نسبت به هفته قبل هم اشاره کن.' : ''}

فقط یک آبجکت JSON معتبر برگردون (بدون Markdown و بدون متن اضافه) دقیقاً با این ساختار:
{"summary": "<۲ تا ۳ جمله فارسی، جمع‌بندی صادقانه از روند این هفته>", "wins": ["<حداکثر ۳ نکته کوتاه فارسی، چیزهایی که خوب پیش رفته>"], "struggles": ["<حداکثر ۳ نکته کوتاه فارسی، جاهایی که کم آورده>"], "focus": ["<حداکثر ۳ پیشنهاد عملی فارسی برای هفته بعد>"]}`;
    const __auth = await authHeaders();
    const response = await fetch("https://groq-proxy.mahdihd648.workers.dev", {
      method:"POST", headers: Object.assign({"Content-Type":"application/json"}, __auth),
      body: JSON.stringify({ feature: "weeklyReview", max_tokens:1000, system: sys, messages:[{role:"user", content:prompt}] })
    });
    const data = await response.json();
    if(!response.ok){
      handleAiWorkerError(response, data);
      return;
    }
    const rawText = data.reply || '';
    const parsed = JSON.parse(rawText.replace(/```json|```/g,'').trim());
    storeData.weeklyReview = { generatedAt: new Date().toISOString(), data: parsed };
    saveData();
    markAIFeatureUsed('weeklyReview');
    renderWeeklyResult();
    showToast('گزارش هفتگی آماده شد', 'success');
  }catch(err){
    console.error(err);
    showToast('پاسخ نامعتبر بود، دوباره امتحان کن', 'error');
  }finally{
    btn.disabled=false;
    btn.textContent = storeData.weeklyReview ? '🔄 دوباره تحلیل کن' : 'تحلیل هفته اخیر';
  }
});
function renderWeeklyResult(){
  const box = document.getElementById('weeklyResult');
  const wr = storeData.weeklyReview;
  if(!wr){ box.style.display='none'; return; }
  const r = wr.data;
  box.innerHTML = `
    <div class="result-feedback">${r.summary||''}</div>
    ${(r.wins&&r.wins.length)?`<div class="result-list-title">نقاط قوت این هفته</div><ul class="result-list tips">${r.wins.map(i=>`<li>${i}</li>`).join('')}</ul>`:''}
    ${(r.struggles&&r.struggles.length)?`<div class="result-list-title">جاهایی که کم آوردی</div><ul class="result-list issues">${r.struggles.map(i=>`<li>${i}</li>`).join('')}</ul>`:''}
    ${(r.focus&&r.focus.length)?`<div class="result-list-title">تمرکز هفته بعد</div><ul class="result-list tips">${r.focus.map(i=>`<li>${i}</li>`).join('')}</ul>`:''}
  `;
  box.style.display='block';
}

/* ---------------- Weekly "Today's Lesson" digest ---------------- */
// Pulls entry.lesson (the "درس امروز" box on the Overview tab) for each of the last
// numDays, oldest-first, skipping days with no lesson text.
function gatherLessons(numDays){
  const list=[];
  const d=new Date();
  for(let i=0;i<numDays;i++){
    const key = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const e = storeData.entries[key];
    if(e && e.lesson && e.lesson.trim()) list.push({date:key, text:e.lesson.trim()});
    d.setDate(d.getDate()-1);
  }
  return list.reverse();
}
document.getElementById('lessonsReviewBtn').addEventListener('click', async ()=>{
  if(!gatePeriodicFeature('lessonsReview', 'جمع‌بندی درس‌های هفته', 7)) return;
  const btn = document.getElementById('lessonsReviewBtn');
  const lessons = gatherLessons(7);
  if(!lessons.length){
    showToast('این هفته هنوز چیزی تو «درس امروز» ننوشتی', 'error');
    return;
  }
  btn.disabled = true; btn.textContent = 'در حال جمع‌بندی...';
  try{
    const lessonsText = lessons.map(l=>`${l.date}: ${l.text}`).join('\n');
    const prevSummary = storeData.lessonsReview && storeData.lessonsReview.data && storeData.lessonsReview.data.summary;
    const sys = personaSystemPrompt("تو یه مشاور و منتور سبک‌زندگی سالم هستی که مسیر این کاربر رو از اول دنبال می‌کنی. الان داری نکته‌هایی که کاربر هر روز زیر «درس امروز» نوشته رو مرور می‌کنی تا ببینی با فهمیدن این چیزها چه تغییری تو نگاه یا رفتارش نسبت به قبل ایجاد شده.");
    const prompt = `این نکته‌هاییه که همین کاربر تو ۷ روز اخیر، هر روز زیر «درس امروز» نوشته (فقط روزهایی که چیزی نوشته آورده شده):
${lessonsText}
${prevSummary ? 'جمع‌بندی هفته‌ی قبل این بود: "'+prevSummary+'" — اگه لازمه به روند و تغییر نسبت به هفته قبل هم اشاره کن.' : ''}

فقط یک آبجکت JSON معتبر برگردون (بدون Markdown و بدون متن اضافه) دقیقاً با این ساختار:
{"summary": "<۲ تا ۳ جمله فارسی، جمع‌بندی صادقانه از درس‌های این هفته و این‌که چه موضوع یا الگویی بین‌شون مشترکه>", "shift": "<۱ تا ۲ جمله فارسی، این‌که با فهمیدن این نکته‌ها چه تغییری تو نگاه یا رفتار کاربر نسبت به قبل ایجاد شده>", "themes": ["<حداکثر ۳ نکته کوتاه فارسی، مضمون‌های تکرارشونده تو درس‌هاش>"], "next": ["<حداکثر ۲ پیشنهاد کوتاه فارسی برای این‌که این درس‌ها رو بیشتر تو عمل به‌کار بگیره>"]}`;
    const __auth = await authHeaders();
    const response = await fetch(WORKER_BASE, {
      method:"POST", headers: Object.assign({"Content-Type":"application/json"}, __auth),
      body: JSON.stringify({ feature: "lessonsReview", max_tokens:1000, system: sys, messages:[{role:"user", content:prompt}] })
    });
    const data = await response.json();
    if(!response.ok){
      handleAiWorkerError(response, data);
      return;
    }
    const rawText = data.reply || '';
    const parsed = JSON.parse(rawText.replace(/```json|```/g,'').trim());
    storeData.lessonsReview = { generatedAt: new Date().toISOString(), data: parsed };
    saveData();
    markAIFeatureUsed('lessonsReview');
    renderLessonsReviewResult();
    showToast('جمع‌بندی درس‌های هفته آماده شد', 'success');
  }catch(err){
    console.error(err);
    showToast('پاسخ نامعتبر بود، دوباره امتحان کن', 'error');
  }finally{
    btn.disabled=false;
    btn.textContent = storeData.lessonsReview ? '🔄 دوباره جمع‌بندی کن' : 'جمع‌بندی درس‌های این هفته';
  }
});
function renderLessonsReviewResult(){
  const box = document.getElementById('lessonsReviewResult');
  if(!box) return;
  const lr = storeData.lessonsReview;
  if(!lr){ box.style.display='none'; return; }
  const r = lr.data;
  box.innerHTML = `
    <div class="result-feedback">${r.summary||''}</div>
    ${r.shift?`<div class="result-list-title">با فهمیدن این چیزها چه تغییری کردی</div><div class="result-feedback">${r.shift}</div>`:''}
    ${(r.themes&&r.themes.length)?`<div class="result-list-title">مضمون‌های تکرارشونده</div><ul class="result-list tips">${r.themes.map(i=>`<li>${i}</li>`).join('')}</ul>`:''}
    ${(r.next&&r.next.length)?`<div class="result-list-title">قدم بعدی</div><ul class="result-list tips">${r.next.map(i=>`<li>${i}</li>`).join('')}</ul>`:''}
  `;
  box.style.display='block';
}

document.getElementById('monthlyReviewBtn').addEventListener('click', async ()=>{
  if(!gatePeriodicFeature('monthlyReview', 'گزارش ماهانه', 30)) return;
  const btn = document.getElementById('monthlyReviewBtn');
  btn.disabled = true; btn.textContent = 'در حال تحلیل...';
  try{
    const stats = gatherStats(30);
    const activeDays = stats.days.length;
    const avgPct = activeDays ? Math.round(stats.days.reduce((s,d)=>s+d.pct,0)/activeDays) : 0;
    const daysText = stats.days.map(d=>`${d.date}: ${d.pct}%`).join('\n') || 'داده‌ای برای این ماه ثبت نشده';
    const prevSummary = storeData.monthlyReview && storeData.monthlyReview.data && storeData.monthlyReview.data.summary;
    const sys = personaSystemPrompt("تو یه مشاور و منتور سبک‌زندگی سالم هستی که مسیر این کاربر رو از اول دنبال می‌کنی. این‌بار داری نمای کلی‌تر و بلندمدت‌تر (یک ماه) رو تحلیل می‌کنی، نه جزئیات روزانه.");
    const prompt = `این خلاصه‌ی ۳۰ روز اخیر همین کاربره که تو یه برنامه‌ی ${storeData.programLength} روزه تغییر عادت شرکت کرده:
مرحله فعلی: ${currentPhase.name}
دلیل شخصی‌اش برای تغییر: ${storeData.whyText || 'ثبت نشده'}
میانگین درصد انجام کارها تو این ۳۰ روز: ${avgPct}%، تعداد روزهای فعال ثبت‌شده: ${activeDays}
عملکرد روزانه:
${daysText}
تعداد وسوسه‌های ثبت‌شده این ماه: ${stats.urgeTotal}، تعداد دفعاتی که مقاومت کرده: ${stats.urgeResisted}
${prevSummary ? 'جمع‌بندی ماه قبل این بود: "'+prevSummary+'" — اگه لازمه به روند نسبت به ماه قبل هم اشاره کن.' : ''}

فقط یک آبجکت JSON معتبر برگردون (بدون Markdown و بدون متن اضافه) دقیقاً با این ساختار:
{"summary": "<۳ تا ۴ جمله فارسی، جمع‌بندی کلی و بلندمدت از روند این ماه>", "wins": ["<حداکثر ۳ نکته کوتاه فارسی، بزرگ‌ترین پیشرفت‌های این ماه>"], "struggles": ["<حداکثر ۳ نکته کوتاه فارسی، الگوهای تکرارشونده‌ی مشکل‌ساز>"], "focus": ["<حداکثر ۳ پیشنهاد عملی فارسی برای ماه بعد>"]}`;
    const __auth = await authHeaders();
    const response = await fetch("https://groq-proxy.mahdihd648.workers.dev", {
      method:"POST", headers: Object.assign({"Content-Type":"application/json"}, __auth),
      body: JSON.stringify({ feature: "monthlyReview", max_tokens:1000, system: sys, messages:[{role:"user", content:prompt}] })
    });
    const data = await response.json();
    if(!response.ok){
      handleAiWorkerError(response, data);
      return;
    }
    const rawText = data.reply || '';
    const parsed = JSON.parse(rawText.replace(/```json|```/g,'').trim());
    storeData.monthlyReview = { generatedAt: new Date().toISOString(), data: parsed };
    saveData();
    markAIFeatureUsed('monthlyReview');
    renderMonthlyResult();
    showToast('گزارش ماهانه آماده شد', 'success');
  }catch(err){
    console.error(err);
    showToast('پاسخ نامعتبر بود، دوباره امتحان کن', 'error');
  }finally{
    btn.disabled=false;
    btn.textContent = storeData.monthlyReview ? '🔄 دوباره تحلیل کن' : 'تحلیل ماه اخیر';
  }
});
function renderMonthlyResult(){
  const box = document.getElementById('monthlyResult');
  const mr = storeData.monthlyReview;
  if(!mr){ box.style.display='none'; return; }
  const r = mr.data;
  box.innerHTML = `
    <div class="result-feedback">${r.summary||''}</div>
    ${(r.wins&&r.wins.length)?`<div class="result-list-title">بزرگ‌ترین پیشرفت‌های این ماه</div><ul class="result-list tips">${r.wins.map(i=>`<li>${i}</li>`).join('')}</ul>`:''}
    ${(r.struggles&&r.struggles.length)?`<div class="result-list-title">الگوهای تکرارشونده</div><ul class="result-list issues">${r.struggles.map(i=>`<li>${i}</li>`).join('')}</ul>`:''}
    ${(r.focus&&r.focus.length)?`<div class="result-list-title">تمرکز ماه بعد</div><ul class="result-list tips">${r.focus.map(i=>`<li>${i}</li>`).join('')}</ul>`:''}
  `;
  box.style.display='block';
}

function escapeHtml(s){ const d=document.createElement('div'); d.textContent=s==null?'':s; return d.innerHTML; }
// Names shown in the public chat (message author, replies, block list, leaderboard) must
// always be a display name — never someone's raw email. If what we have looks like an
// email address (old data, a missing profile row, etc.) only the part before "@" is shown.
function displayName(name){
  if(!name) return 'کاربر';
  const s = String(name).trim();
  if(!s) return 'کاربر';
  const at = s.indexOf('@');
  if(at > 0) return s.slice(0, at);
  return s;
}

/* ---------------- Future-self letter ---------------- */
async function generateLetter(){
  if(!gateDailyFeature('letter', 'نامه‌ی خودِ آینده')) return;
  const btn = document.getElementById('letterBtn');
  btn.disabled = true; btn.textContent = 'در حال نوشتن...';
  try{
    const sys = personaSystemPrompt("قراره تو نقش خودِ همین کاربر، دقیقاً در پایان دوره‌ی برنامه‌اش، برای خودِ الانش نامه بنویسی.");
    const prompt = `یه نامه‌ی کوتاه (حداکثر ۸ خط)، گرم، صمیمی و باورپذیر به زبان فارسی بنویس، انگار خودِ آینده‌ی همین کاربر (دقیقاً بعد از تموم شدن موفق برنامه‌ی ${storeData.programLength} روزه‌اش، با هدف بدنی «${goalLabel(storeData.profile.goal)}» و کار روی «${addictionsText()}») داره به خودِ الانش نامه می‌نویسه.
دلیل شخصی‌اش برای شروع این مسیر این بود: "${storeData.whyText || 'یه نسخه بهتر از خودش بشه'}". هدف کوتاه‌مدتش: "${storeData.profile.goalShort||'مشخص نشده'}".
درباره‌ی اینکه چقدر ارزششو داشت، چه سختی‌هایی رو گذروند، و چرا نباید الان جا بزنه بنویس. فقط متن نامه رو بنویس، بدون هیچ توضیح اضافه یا JSON.`;
    const __auth = await authHeaders();
    const response = await fetch("https://groq-proxy.mahdihd648.workers.dev", {
      method:"POST", headers: Object.assign({"Content-Type":"application/json"}, __auth),
      body: JSON.stringify({ feature: "letter", max_tokens:600, system: sys, messages:[{role:"user", content:prompt}] })
    });
    const data = await response.json();
    if(!response.ok){
      handleAiWorkerError(response, data);
      return;
    }
    const rawText = (data.reply || '').trim();
    storeData.futureLetter = rawText;
    saveData();
    markAIFeatureUsed('letter');
    renderLetter();
    showToast('نامه‌ات آماده شد', 'success');
  }catch(err){
    console.error(err);
    showToast('مشکلی پیش اومد، دوباره امتحان کن', 'error');
  }finally{
    btn.disabled=false;
    btn.textContent = storeData.futureLetter ? '🔄 دوباره بنویس' : 'بنویس نامه‌ی من';
  }
}
document.getElementById('letterBtn').addEventListener('click', generateLetter);
function renderLetter(){
  const card = document.getElementById('letterCard');
  if(!storeData.futureLetter){ card.style.display='none'; return; }
  card.textContent = storeData.futureLetter;
  card.style.display='block';
}

/* ---------------- Life Analyzer (دفترچه هوشمند زندگی) ---------------- */
const LJ_FIELD_MAP = [['ljQ1','success'],['ljQ2','failReason'],['ljQ3','peakHours'],['ljQ4','positiveInfluence'],['ljQ5','badFood'],['ljQ6','moodHabit']];
function renderLifeJournalUI(){
  if(!storeData.lifeJournal) storeData.lifeJournal = {};
  const count = Object.keys(storeData.lifeJournal).length;
  const pct = Math.min(100, Math.round((count/LJ_REQUIRED_DAYS)*100));
  const fillEl = document.getElementById('ljProgressFill');
  const labelEl = document.getElementById('ljProgressLabel');
  if(fillEl) fillEl.style.width = pct+'%';
  if(labelEl) labelEl.textContent = `${toFa(count)} از ${toFa(LJ_REQUIRED_DAYS)} شب ثبت شده`;
  const lockNote = document.getElementById('ljLockNote');
  const insightsBtn = document.getElementById('ljInsightsBtn');
  if(count >= LJ_REQUIRED_DAYS){
    if(lockNote) lockNote.style.display = 'none';
    if(insightsBtn){ insightsBtn.disabled = false; insightsBtn.textContent = storeData.lifeAnalyzerReport ? '🔄 دوباره تحلیل کن' : '🔍 کشف الگوهای زندگیت'; }
  } else {
    if(lockNote){ lockNote.style.display = 'block'; lockNote.textContent = `🔒 این قابلیت بعد از ${toFa(LJ_REQUIRED_DAYS)} شب ثبت جواب باز میشه — ${toFa(LJ_REQUIRED_DAYS-count)} شب دیگه مونده.`; }
    if(insightsBtn){ insightsBtn.disabled = true; insightsBtn.textContent = '🔒 کشف الگوهای زندگیت'; }
  }
  const todayEntry = storeData.lifeJournal[today];
  LJ_FIELD_MAP.forEach(([id,key])=>{
    const el = document.getElementById(id);
    if(el) el.value = todayEntry ? (todayEntry[key]||'') : '';
  });
  const saveBtn = document.getElementById('ljSaveBtn');
  if(saveBtn) saveBtn.textContent = todayEntry ? '🔄 به‌روزرسانی پاسخ‌های امشب' : '📓 ثبت پاسخ‌های امشب';
  renderLifeAnalyzerResult();
}
document.getElementById('ljSaveBtn').addEventListener('click', ()=>{
  const vals = {};
  LJ_FIELD_MAP.forEach(([id,key])=>{ vals[key] = (document.getElementById(id).value||'').trim(); });
  const hasAny = Object.values(vals).some(v=>v);
  if(!hasAny){ showToast('حداقل به یکی از سؤال‌ها جواب بده', 'error'); return; }
  if(!storeData.lifeJournal) storeData.lifeJournal = {};
  storeData.lifeJournal[today] = Object.assign({ dow: new Date().getDay(), ts: new Date().toISOString() }, vals);
  saveData();
  renderLifeJournalUI();
  showToast('پاسخ‌های امشب ثبت شد 📓');
});
const LJ_DOW_FA = ["یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه","جمعه","شنبه"];
document.getElementById('ljInsightsBtn').addEventListener('click', async ()=>{
  const count = Object.keys(storeData.lifeJournal||{}).length;
  if(count < LJ_REQUIRED_DAYS){
    showToast(`هنوز ${toFa(LJ_REQUIRED_DAYS-count)} شب دیگه مونده تا این قابلیت باز بشه`);
    return;
  }
  if(!gatePeriodicFeature('lifeAnalyzer', 'دفترچه هوشمند زندگی', 30)) return;
  const btn = document.getElementById('ljInsightsBtn');
  btn.disabled = true; btn.textContent = 'در حال تحلیل...';
  try{
    const keys = Object.keys(storeData.lifeJournal).sort().slice(-90);
    const daysText = keys.map(k=>{
      const e = storeData.lifeJournal[k];
      const dow = LJ_DOW_FA[e.dow!=null ? e.dow : new Date(k).getDay()];
      return `${k} (${dow}): موفقیت: ${e.success||'-'} | دلیل لغزش: ${e.failReason||'-'} | ساعت پربازده: ${e.peakHours||'-'} | تأثیر مثبت افراد: ${e.positiveInfluence||'-'} | غذای بد: ${e.badFood||'-'} | عامل خلق‌وخو: ${e.moodHabit||'-'}`;
    }).join('\n');
    const sys = personaSystemPrompt("تو یه تحلیل‌گر دقیق الگوهای رفتاری و سبک‌زندگی هستی که داره داده‌های دفترچه‌ی شبانه‌ی همین کاربر رو در طول چند ماه بررسی می‌کنه تا الگوهای واقعی و تکرارشونده رو پیدا کنه، نه حدس کلی و نه چیزی که تو داده‌ها نیومده.");
    const prompt = `این خلاصه‌ی پاسخ‌های دفترچه‌ی شبانه‌ی همین کاربره در ${toFa(keys.length)} شب اخیر (هر شب به ۶ سؤال کوتاه جواب داده):
${daysText}

با دقت الگوهای تکرارشونده رو تو این داده‌ها پیدا کن (مثلاً ارتباط بین روزهای هفته و لغزش‌ها، غذاهای تکرارشونده‌ی مضر، ساعت‌های پرتکرار برای بازده بالا، آدم‌های پرتکرار در تأثیر مثبت، و عادت‌های پرتکرار در خلق‌وخو). فقط یک آبجکت JSON معتبر برگردون (بدون Markdown و بدون هیچ متن اضافه) دقیقاً با این ساختار:
{"successFactor":"<۱ تا ۲ جمله فارسی، بزرگ‌ترین عامل مشترک موفقیت‌هاش>","failureReason":"<۱ تا ۲ جمله فارسی، مهم‌ترین و تکرارشونده‌ترین دلیل لغزش/شکست‌هاش>","positiveInfluencers":"<۱ تا ۲ جمله فارسی، چه آدم‌هایی بیشترین تأثیر مثبت رو روش دارن>","productiveHours":"<۱ تا ۲ جمله فارسی، چه ساعت‌هایی بیشترین بازده رو داره>","badFoods":"<۱ تا ۲ جمله فارسی، چه غذاهایی روی انرژیش اثر منفی دارن>","riskyDays":"<۱ تا ۲ جمله فارسی، چه روزهایی از هفته احتمال لغزشش بیشتره، دقیقاً بر اساس تاریخ‌ها و روزهای هفته‌ی بالا>","moodHabits":"<۱ تا ۲ جمله فارسی، چه عادت‌هایی بیشترین تأثیر رو روی خلق‌وخوش داشتن>"}`;
    const __auth = await authHeaders();
    const response = await fetch(WORKER_BASE, {
      method:"POST", headers: Object.assign({"Content-Type":"application/json"}, __auth),
      body: JSON.stringify({ feature: "lifeAnalyzer", max_tokens:1000, system: sys, messages:[{role:"user", content:prompt}] })
    });
    const data = await response.json();
    if(!response.ok){
      handleAiWorkerError(response, data);
      return;
    }
    const rawText = data.reply || '';
    const parsed = JSON.parse(rawText.replace(/```json|```/g,'').trim());
    storeData.lifeAnalyzerReport = { generatedAt: new Date().toISOString(), data: parsed };
    saveData();
    markAIFeatureUsed('lifeAnalyzer');
    renderLifeAnalyzerResult();
    showToast('الگوهای زندگیت آماده شد ✨', 'success');
  }catch(err){
    console.error(err);
    showToast('پاسخ نامعتبر بود، دوباره امتحان کن', 'error');
  }finally{
    btn.disabled = false;
    btn.textContent = storeData.lifeAnalyzerReport ? '🔄 دوباره تحلیل کن' : '🔍 کشف الگوهای زندگیت';
  }
});
function renderLifeAnalyzerResult(){
  const box = document.getElementById('ljResult');
  if(!box) return;
  const rep = storeData.lifeAnalyzerReport;
  if(!rep){ box.style.display='none'; return; }
  const r = rep.data||{};
  const items = [
    ['🏆','بزرگ‌ترین عامل موفقیتت', r.successFactor],
    ['⚠️','مهم‌ترین دلیل شکست‌هات', r.failureReason],
    ['🤝','این آدم‌ها بیشترین تأثیر مثبت رو دارن', r.positiveInfluencers],
    ['⏰','پربازده‌ترین ساعت‌هات', r.productiveHours],
    ['🍽️','این غذاها انرژیتو پایین می‌برن', r.badFoods],
    ['📅','روزهایی که احتمال لغزش بیشتره', r.riskyDays],
    ['🔄','عادت‌هایی که بیشترین اثر رو رو خلقت دارن', r.moodHabits]
  ].filter(i=>i[2]);
  box.innerHTML = items.map(i=>`
    <div class="lj-insight-item">
      <div class="lj-insight-title">${i[0]} ${i[1]}</div>
      <div class="lj-insight-text">${escapeHtml(i[2])}</div>
    </div>
  `).join('');
  box.style.display = items.length ? 'block' : 'none';
}

/* ================= Account gate: بخش عمومی (چت/لیدربورد/هم‌مسیر/پروفایل) نیاز به حساب داره؛
   «دعوت از دوستان» و «اهداف من» هم چون فنی به حساب کاربر وابسته‌ان (کد رفرال و خرید
   پرمیوم سمت سرور ثبت می‌شن) نیاز به حساب دارن. بقیه‌ی بخش خصوصی (امروز، تمرین،
   کتابخونه، مدیتیشن، فن بیان، مشاور شخصی، پیشرفت، تنظیمات و...) بدون اکانت و کاملاً آزاده. ================= */
const AUTH_GATE_TAB_LABELS = {
  chat:'چت', leaderboard:'لیدربورد', buddy:'هم‌مسیر', profile:'پروفایل',
  invite:'دعوت از دوستان', goals:'اهداف من'
};
const PUBLIC_AUTH_TABS = { chat:1, leaderboard:1, buddy:1, profile:1, invite:1, goals:1 };
let pendingAuthTab = null;
function isLoggedIn(){ return !!publicChatUser; }
function tabNeedsAuth(tabId){ return !!PUBLIC_AUTH_TABS[tabId] && !isLoggedIn(); }
function showAuthGate(tabId, isWelcome){
  pendingAuthTab = tabId || null;
  const coachEl = document.getElementById('authGateCoachAvatar');
  if(coachEl) coachEl.innerHTML = buildCoachSVG('gentle', 'authgate');
  const label = AUTH_GATE_TAB_LABELS[tabId] || 'این بخش';
  document.getElementById('authGateMsgText').textContent = isWelcome
    ? 'به Dreamlife خوش اومدی! کل بخش خصوصی (امروز، تمرین، کتابخونه، مدیتیشن، فن بیان، مشاور شخصی، پیشرفت و...) همیشه رایگان و بدون اکانته. فقط برای بخش عمومی (چت، لیدربورد، هم‌مسیر، پروفایل) یه حساب رایگان لازمه 🙂'
    : `برای استفاده از «${label}» باید یه حساب رایگان بسازی یا وارد شو. بخش خصوصی برنامه همیشه بدون اکانت در دسترسه، ولی بخش عمومی به چند ثانیه ثبت‌نام نیاز داره.`;
  document.getElementById('authGateOverlay').classList.add('show');
}
function hideAuthGate(){ document.getElementById('authGateOverlay').classList.remove('show'); }
document.getElementById('authGateCloseBtn').addEventListener('click', ()=>{ pendingAuthTab = null; hideAuthGate(); });
/* Jumps straight to the login/signup wizard living inside the "چت" panel
   (chatLoggedOutBox), bypassing showPublicTab/tabNeedsAuth entirely — going through
   those would re-trigger the auth gate on 'chat' itself (it's in PUBLIC_AUTH_TABS
   too) and just loop back to nothing happening. setAppMode() has no auth check,
   so it's safe to call directly here. */
function goToAuthPage(tabId, formToShow){
  pendingAuthTab = tabId || null;
  hideAuthGate();
  closeSideMenu();
  setAppMode('public', 'chat');
  showAuthForm(formToShow || 'signup');
}
document.getElementById('authGateSignupBtn').addEventListener('click', ()=>{
  goToAuthPage(pendingAuthTab, 'signup');
});
function goToTabAfterAuth(tabId){
  if(!tabId || tabId==='chat') return;
  if(tabId === 'focusmode'){ setAppMode('private', 'focusmode'); return; }
  const mainBtn = document.querySelector('.tab-btn[data-tab="'+tabId+'"]');
  if(mainBtn){ mainBtn.click(); return; }
  enterSubPage(tabId);
  if(tabId === 'leaderboard') loadLeaderboard();
  if(tabId === 'buddy' && typeof loadBuddyTab === 'function') loadBuddyTab();
  if(tabId === 'sos' && typeof loadSosTab === 'function') loadSosTab();
}


/* ================= Tabs ================= */
let lastMainTab = 'today';
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const targetTab = btn.dataset.tab;
    if(tabNeedsAuth(targetTab)){ goToAuthPage(targetTab); return; }
    if(PREMIUM_ONLY_TABS[targetTab] && !requirePremium()) return;
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-'+targetTab).classList.add('active');
    document.getElementById('tabbar').scrollIntoView({block:'nearest'});
    lastMainTab = targetTab;
    // همون ضامنی که setAppMode/showPublicTabInner در انتهاشون صدا می‌زنن، این‌جا هم صدا
    // می‌زنیم: تضمین می‌کنه با سوییچ بین تب‌های خصوصی (امروز/تمرین/...) هیچ‌وقت یه پنل یا
    // دکمه‌ی بخش عمومی جا نمونه فعال، حتی اگه از یه مسیر غیرمنتظره به این‌جا رسیده باشیم.
    if(typeof assertModeSeparation === 'function') assertModeSeparation();
  });
});

/* ================= Focus / Situation Modes (حالت) =================
   هر حالت یه موقعیت واقعیه (باشگاه، پارک، کافه، ...). با انتخابش، اپ وارد
   یه صفحه‌ی اختصاصی می‌شه: تایمر کار عمیق + راهنما/انگیزش + چک‌لیست مخصوص
   همون کار. کاربر با دکمه‌ی «پایان» خودش از حالت خارج می‌شه.
   حالت‌های جدید همینجا به FOCUS_MODES اضافه می‌شن. */
const FOCUS_MODES = {
  gym: {
    title: 'حالت باشگاه',
    free: true,
    icon: '🏋️',
    subtitle: 'رو فرم درست تمرکز کن، نه فقط عدد وزنه',
    color: ['#f97316','#ef4444'],
    timerLabel: 'زمان تمرکز',
    tip: 'گوشیتو بذار تو کیف یا حالت مزاحم نشو؛ فقط بین ست‌ها بهش نگاه کن. رو فرم درست حرکات تمرکز کن، نه فقط عدد وزنه — یه ست تمیز خیلی بهتر از یه ست سنگین با فرم غلطه.',
    checklist: [
      'گرم کردن (۵ تا ۱۰ دقیقه) قبل از شروع',
      'یه بطری آب همراهمه',
      'می‌دونم برنامه‌ی امروز رو کدوم عضله/حرکته',
      'گوشی رو بی‌صدا یا دور از دسترس گذاشتم',
      'بین ست‌ها فقط به‌اندازه استراحت می‌کنم، نه بیشتر',
      'آخر تمرین چند دقیقه کشش و سرد کردن'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه تمرکز داشتی 💪` : 'حالت باشگاه پایان یافت'
  },
  sleep: {
    title: 'حالت خواب',
    free: true,
    icon: '😴',
    subtitle: 'یه پایان آروم برای امروز',
    color: ['#5b4b9a','#293868'],
    timerLabel: 'زمان آماده‌شدن برای خواب',
    tip: 'نور صفحه‌ی گوشی به مغزت می‌گه هنوز روزه؛ گوشی رو کنار بذار و نور اتاق رو کم کن. اگه فکر یا نگرانی‌ای تو ذهنته، همین الان یه‌جا بنویسش تا بذاریش برای فردا و ذهنت آزاد بشه.',
    checklist: [
      'گوشی رو دور از تخت گذاشتم یا رو حالت مزاحم نشو',
      'نور اتاق رو کم یا خاموش کردم',
      'آلارم فردا صبح رو تنظیم کردم',
      'بعد از ظهر/عصر کافئین نخوردم',
      'چند نفس عمیق کشیدم تا بدنم آروم بشه',
      'فکرا و کارای فردا رو یه‌جا نوشتم که تو ذهنم نمونه'
    ],
    endMessage: (min)=> 'شب بخیر 😴 حالا وقتشه چراغا رو خاموش کنی و بخوابی'
  },
  morning: {
    title: 'حالت بیداری صبح',
    free: true,
    icon: '🌅',
    subtitle: 'یه شروع تازه، با آرامش',
    color: ['#fb923c','#f472b6'],
    timerLabel: 'زمان روتین صبحگاهی',
    tip: 'اولین کاری که بعد از بیدار شدن می‌کنی، رنگ کل روزت رو می‌زنه. قبل از اینکه گوشی رو بردار و بری تو اخبار و پیام‌های بقیه، چند دقیقه رو بده به خودت.',
    checklist: [
      'قبل از چک‌کردن گوشی چند نفس عمیق کشیدم',
      'یه لیوان آب خوردم',
      'پرده رو باز کردم یا چند دقیقه زیر نور طبیعی بودم',
      'کمی کش‌وقوس به بدنم دادم',
      'مهم‌ترین کار امروزم رو تو ذهنم مرور کردم',
      'تخت رو مرتب کردم'
    ],
    endMessage: (min)=> 'صبح بخیر ☀️ یه شروع خوب برای امروز داشتی'
  },
  walk: {
    title: 'حالت پیاده‌روی',
    icon: '🚶',
    subtitle: 'هر قدم، یه لحظه حضور',
    color: ['#22c55e','#0d9488'],
    timerLabel: 'زمان پیاده‌روی',
    tip: 'گوشی رو بذار تو جیب یا کیفت، نه تو دستت. سعی کن به‌جای اسکرول‌کردن یا فکر کردن به کارای عقب‌افتاده، همین قدم‌ها، نفس‌کشیدن، و چیزایی که دور و برت می‌بینی رو حس کنی.',
    checklist: [
      'گوشی رو تو جیب یا کیف گذاشتم، نه تو دستم',
      'به تنفسم و ریتم قدم‌هام توجه می‌کنم',
      'به اطرافم نگاه می‌کنم، نه فقط زیر پام',
      'وضعیت بدنم رو چک کردم (قد راست، شونه‌ها آزاد)',
      'آب همراهمه',
      'سعی می‌کنم همین لحظه رو حس کنم، نه کارای بعدی'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه پیاده‌روی با حضور ذهن داشتی 🚶` : 'حالت پیاده‌روی پایان یافت'
  },
  football: {
    title: 'حالت سالن فوتبال',
    icon: '⚽',
    subtitle: 'رو بازی و هم‌تیمی‌هات تمرکز کن',
    color: ['#16a34a','#0ea5e9'],
    timerLabel: 'زمان بازی',
    tip: 'قبل از شروع، گرم کن و با هم‌تیمی‌هات هماهنگ شو. تو زمین فقط رو توپ، بازی، و ارتباط با تیمت تمرکز کن؛ نگرانی‌های بیرون سالن رو بذار برای بعد از بازی.',
    checklist: [
      'گرم کردن و کشش قبل از بازی',
      'کفش و لباس مناسب سالن پوشیدم',
      'آب همراهمه',
      'گوشی رو تو کیف یا رختکن گذاشتم',
      'با هم‌تیمی‌هام درباره‌ی نقش امروزم هماهنگ شدم',
      'بعد از بازی چند دقیقه کشش برای سرد کردن'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه بازی خوب داشتی ⚽` : 'حالت سالن فوتبال پایان یافت'
  },
  nap: {
    title: 'حالت چرت بعد از ظهر',
    icon: '💤',
    subtitle: 'یه چرت کوتاه، نه یه خواب بلند',
    color: ['#60a5fa','#818cf8'],
    timerLabel: 'زمان چرت',
    tip: 'چرت خوب، کوتاهه — ۲۰ تا ۳۰ دقیقه کافیه تا سرحال بشی، بدون اینکه گیج و منگ بیدار شی یا خواب شبت خراب شه. قبل از هر چیز آلارم بذار تا خیالت راحت باشه و بتونی واقعاً ریلکس کنی.',
    checklist: [
      'آلارم برای ۲۰ تا ۳۰ دقیقه دیگه تنظیم کردم',
      'گوشی رو رو حالت مزاحم نشو گذاشتم',
      'یه جای نسبتاً ساکت و کم‌نور پیدا کردم',
      'گردن و کمرم تو وضعیت راحتیه',
      'نگرانی کارای عقب‌افتاده رو گذاشتم برای بعد از چرت',
      'بعد از بیدار شدن، یه لیوان آب می‌خورم'
    ],
    endMessage: (min)=> 'چرت خوبی داشتی 💤 حالا دوباره سرحال شو'
  },
  travel: {
    title: 'حالت مسافرت',
    icon: '🧳',
    subtitle: 'سفرتو زندگی کن، نه فقط ثبتش کن',
    color: ['#38bdf8','#6366f1'],
    timerLabel: 'زمان سفر',
    tip: 'گوشی فقط برای نقشه، بلیط و چندتا عکس یادگاری خوبه؛ بقیه‌ی وقتتو بده به چیزایی که واقعاً دور و برته. جاهای جدید، آدما، بوها و صداها رو حس کن، نه اینکه فقط از پشت دوربین ببینیشون.',
    checklist: [
      'بلیط، پاسپورت/کارت شناسایی و مدارک لازم رو چک کردم',
      'آدرس اقامتگاه و مسیر برگشت رو ذخیره کردم',
      'گوشیم شارژ کامله و پاوربانک همراهمه',
      'یه لیست کوتاه از مهم‌ترین جاهایی که می‌خوام ببینم دارم',
      'کمی پول نقد یا کارت یدک همراهمه',
      'به‌جای فقط عکس گرفتن، چند لحظه رو فقط برای دیدن و حس‌کردن می‌ذارم'
    ],
    endMessage: (min)=> min>0 ? `چه سفر خوبی! ${min} دقیقه رو با حضور ذهن گذروندی 🧳` : 'حالت مسافرت پایان یافت'
  },
  cooking: {
    title: 'حالت آشپزی',
    icon: '🍳',
    subtitle: 'تمرکز رو دستور پخت، نه رو گوشی',
    color: ['#f59e0b','#ef4444'],
    timerLabel: 'زمان آشپزی',
    tip: 'قبل از شروع، دستور پخت رو یه بار کامل بخون و مواد لازم رو آماده و اندازه‌گیری کن؛ این کار جلوی سردرگمی وسط کار رو می‌گیره. گوشی رو فقط برای دیدن دستور پخت بردار، نه اسکرول‌کردن بین مراحل.',
    checklist: [
      'دستور پخت رو یه بار کامل خوندم',
      'همه‌ی مواد لازم رو از قبل آماده و اندازه‌گیری کردم',
      'گوشی رو فقط برای دیدن دستور پخت استفاده می‌کنم',
      'وسایل تیز و شعله رو با احتیاط استفاده می‌کنم',
      'حواسم به زمان‌بندی پخت هست تا چیزی نسوزه',
      'بعد از پخت، آشپزخونه رو تمیز می‌کنم'
    ],
    endMessage: (min)=> min>0 ? `دستت درد نکنه! ${min} دقیقه با تمرکز آشپزی کردی 🍳` : 'حالت آشپزی پایان یافت'
  },
  coffeeshop: {
    title: 'حالت کافی شاپ',
    icon: '☕',
    subtitle: 'یه محیط تازه برای کار یا مطالعه‌ی عمیق',
    color: ['#b45309','#78350f'],
    timerLabel: 'زمان تمرکز',
    tip: 'تغییر محیط می‌تونه تمرکزتو چند برابر کنه، به شرطی که گوشی و شبکه‌های اجتماعی حواستو پرت نکنن. یه هدف مشخص برای همین نشستن تعیین کن و فقط رو همون کار بمون.',
    checklist: [
      'هدفم از اومدن به کافی‌شاپ رو مشخص کردم (کار، مطالعه، ...)',
      'گوشی رو رو حالت مزاحم نشو گذاشتم',
      'یه نوشیدنی سفارش دادم و جامو مرتب کردم',
      'هدفون همراهمه اگه به سکوت بیشتری نیاز دارم',
      'شارژر لپ‌تاپ یا گوشی همراهمه',
      'فقط رو همون کاری که اومدم انجام بدم تمرکز می‌کنم، نه شبکه‌های اجتماعی'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با تمرکز کار/مطالعه کردی ☕` : 'حالت کافی شاپ پایان یافت'
  },
  clothesShopping: {
    title: 'حالت خرید لباس',
    icon: '👕',
    subtitle: 'خرید هدفمند، نه خرید احساسی',
    color: ['#ec4899','#f97316'],
    timerLabel: 'زمان خرید',
    tip: 'قبل از رفتن، یه نگاه به کمدت بنداز ببین واقعاً به چی نیاز داری، نه اینکه سر صحنه با دیدن ویترین تصمیم بگیری. هر چیزی رو حتماً پرو کن و اگه مطمئن نیستی، همون‌جا نخرش؛ بذار چند ساعت بگذره و بعد تصمیم بگیر.',
    checklist: [
      'قبل از رفتن، لیست چیزایی که واقعاً نیاز دارم رو نوشتم',
      'یه بودجه‌ی مشخص برای این خرید تو ذهنم دارم',
      'کمدم رو چک کردم که چی واقعاً کم دارم',
      'هر چیزی رو قبل از خرید حتماً پرو می‌کنم',
      'اگه از چیزی مطمئن نیستم، همون‌جا نمی‌خرمش',
      'به تخفیف و «فرصت محدود» فقط برای چیزی که تو لیستمه توجه می‌کنم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه خرید هدفمند داشتی 👕` : 'حالت خرید لباس پایان یافت'
  },
  supermarket: {
    title: 'حالت خرید سوپرمارکت',
    icon: '🛒',
    subtitle: 'با شکم سیر برو، نه با چشم گشنه',
    color: ['#65a30d','#22c55e'],
    timerLabel: 'زمان خرید',
    tip: 'قبل از رفتن یه چیزی بخور — رفتن با شکم گشنه باعث می‌شه چشمت دنبال هرچیز خوشمزه‌ای بره و چیزای اضافه و خارج از نیازت رو تو سبد بذاری. فقط طبق لیستی که نوشتی حرکت کن.',
    checklist: [
      'قبل از رفتن یه چیزی خوردم و با شکم گشنه نرفتم',
      'لیست خرید رو از قبل نوشتم و فقط همونا رو می‌خرم',
      'دقیقاً می‌دونم چقدر از هر چیز نیاز دارم، نه بیشتر',
      'به تنقلات و چیزای وسوسه‌انگیز کنار قفسه‌ها و صندوق توجه نمی‌کنم',
      'تاریخ انقضای محصولات رو چک می‌کنم',
      'قبل از پرداخت، فاکتور رو با لیستم مقایسه می‌کنم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه خرید هوشمندانه داشتی 🛒` : 'حالت خرید سوپرمارکت پایان یافت'
  },
  onlineShopping: {
    title: 'حالت خرید آنلاین',
    icon: '📦',
    subtitle: 'یه سفارش فکرشده، نه یه کلیک لحظه‌ای',
    color: ['#0ea5e9','#8b5cf6'],
    timerLabel: 'زمان خرید',
    tip: 'قبل از زدن دکمه‌ی خرید، سبدت رو چند ساعت به حالش بذار و دوباره سراغش برو؛ خیلی وقتا اشتیاق اولیه از بین می‌ره و می‌فهمی واقعاً بهش نیاز نداشتی. نظرات و قیمت رو تو چند جا مقایسه کن.',
    checklist: [
      'قبل از خرید نهایی، چند ساعت صبر می‌کنم و دوباره سبدم رو نگاه می‌کنم',
      'نظرات و امتیاز محصول رو چک کردم',
      'قیمت رو با یکی دو سایت دیگه مقایسه کردم',
      'شرایط مرجوعی و گارانتی رو خوندم',
      'فقط چیزی که واقعاً نیاز دارم رو اضافه کردم، نه هرچی که تبلیغش جلوم اومد',
      'اعتبار فروشنده و امن‌بودن درگاه پرداخت رو چک کردم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه خرید فکرشده داشتی 📦` : 'حالت خرید آنلاین پایان یافت'
  },
  friendHangout: {
    title: 'حالت گشت و گذار با رفیق',
    icon: '🧑‍🤝‍🧑',
    subtitle: 'با کسی که کنارته باش، نه با گوشیت',
    color: ['#fbbf24','#fb7185'],
    timerLabel: 'زمان با رفیق',
    tip: 'وقتی با یه دوست بیرونی، بهترین هدیه‌ای که می‌تونی بدی، حضور کاملته. گوشی رو کمتر چک کن و بذار مکالمه و لحظه‌های با هم بودن، جای عکسا و پیام‌های نخونده رو بگیره.',
    checklist: [
      'گوشیمو رو حالت مزاحم نشو گذاشتم یا کمتر چکش می‌کنم',
      'می‌خوام واقعاً به حرفای رفیقم گوش بدم، نه فقط منتظر نوبت خودم باشم',
      'به‌جای عکس گرفتن مداوم، چند لحظه رو فقط برای با هم بودن می‌ذارم',
      'از قبل هماهنگ کردیم کجا بریم و کی همو ببینیم',
      'وسط صحبت، گوشیمو برنمی‌دارم چک کنم',
      'سعی می‌کنم تو این وقت، کامل پیش کسی که باهامه حاضر باشم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه وقت خوب با رفیقت گذشت 🧑‍🤝‍🧑` : 'حالت گشت و گذار پایان یافت'
  },
  restaurant: {
    title: 'حالت رستوران',
    icon: '🍽️',
    subtitle: 'لذت از غذا و لحظه، نه فقط عکس براش',
    color: ['#dc2626','#f59e0b'],
    timerLabel: 'زمان رستوران',
    tip: 'قبل از سفارش، گشنگی واقعیتو بسنج تا غذا اضافه سفارش ندی و حروم نشه. موقع غذا خوردن، گوشی رو کنار بذار و رو طعم غذا و مکالمه با همراهات تمرکز کن؛ عجله نکن.',
    checklist: [
      'قبل از سفارش، منو رو با خیال راحت نگاه کردم',
      'گوشی رو رو میز نمی‌ذارم یا فقط برای یه عکس ازش استفاده می‌کنم',
      'غذا رو آروم و با تمرکز می‌خورم، نه با عجله',
      'به مکالمه با همراهام توجه می‌کنم',
      'قبل از سفارش زیاد، به اندازه‌ی گرسنگیم فکر می‌کنم که غذا حروم نشه',
      'قبل از پرداخت، صورت‌حساب رو چک می‌کنم'
    ],
    endMessage: (min)=> min>0 ? `نوش جان! ${min} دقیقه با آرامش غذا خوردی 🍽️` : 'حالت رستوران پایان یافت'
  },
  pool: {
    title: 'حالت استخر',
    icon: '🏊',
    subtitle: 'شنا و آرامش، دور از گوشی',
    color: ['#06b6d4','#3b82f6'],
    timerLabel: 'زمان شنا',
    tip: 'قبل از ورود به آب حتماً بدنتو گرم کن تا از گرفتگی عضله جلوگیری بشه. تو آب فقط رو تنفس و حرکاتت تمرکز کن؛ این وقتیه که گوشی طبیعتاً کنارته، پس ازش برای یه استراحت واقعی ذهنی استفاده کن.',
    checklist: [
      'وسایل استخر (لباس شنا، حوله، کلاه) رو آماده کردم',
      'قبل از ورود به آب، کمی گرم کردم',
      'گوشی رو تو کمد یا جای امن گذاشتم',
      'به تنفس و حرکاتم موقع شنا توجه می‌کنم',
      'به‌اندازه‌ی توانم شنا می‌کنم، فشار زیادی به خودم نمیارم',
      'بعد از استخر، دوش می‌گیرم و بدنم رو خشک می‌کنم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه شنا و آرامش داشتی 🏊` : 'حالت استخر پایان یافت'
  },
  gamingCafe: {
    title: 'حالت گیم‌نت',
    icon: '🎮',
    subtitle: 'بازی با کنترل، نه بی‌حدومرز',
    color: ['#8b5cf6','#ec4899'],
    timerLabel: 'زمان بازی',
    tip: 'تو گیم‌نت خیلی راحت زمان از دستت در می‌ره؛ قبل از شروع یه سقف زمانی یا بودجه برای خودت مشخص کن و یه آلارم بذار تا وقتی رسید، بدون بحث با خودت تمومش کنی.',
    checklist: [
      'قبل از شروع، مدت‌زمان یا بودجه‌ی مشخصی برای امروز تعیین کردم',
      'آلارم یا یادآور برای وقتی که باید تموم کنم گذاشتم',
      'به رفقایی که باهاشون بازی می‌کنم توجه دارم، نه فقط به صفحه',
      'بین بازی‌ها کمی به چشمام استراحت می‌دم',
      'آب یا نوشیدنی همراهمه',
      'بعد از تموم شدن وقتم، بدون غر زدن پا می‌شم می‌رم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه بازی با کنترل داشتی 🎮` : 'حالت گیم‌نت پایان یافت'
  },
  freeStudy: {
    title: 'حالت مطالعه آزاد',
    icon: '📖',
    subtitle: 'یادگیری با کنجکاوی، نه استرس',
    color: ['#4f46e5','#06b6d4'],
    timerLabel: 'زمان مطالعه',
    tip: 'چون امتحانی در کار نیست، از این وقت برای واقعاً یاد گرفتن استفاده کن، نه فقط رد کردن صفحات. با تکنیک پومودورو (۲۵ تا ۳۰ دقیقه تمرکز، بعد چند دقیقه استراحت) پیش برو و سعی کن مطلب رو با صدای بلند یا نوشتن برای خودت توضیح بدی؛ این خیلی بیشتر از فقط خوندن تو ذهنت می‌مونه.',
    checklist: [
      'قبل از شروع، مشخص کردم امروز دقیقاً رو چه بخش یا فصلی کار می‌کنم',
      'گوشی رو رو حالت مزاحم نشو گذاشتم یا تو یه اتاق دیگه گذاشتم',
      'یه لیوان آب یا نوشیدنی کنارمه که وسط درس بلند نشم',
      'هر ۲۵ تا ۳۰ دقیقه یه استراحت کوتاه برای خودم در نظر گرفتم',
      'به‌جای فقط خوندن، سعی می‌کنم مطلب رو با صدای بلند یا نوشتن خلاصه کنم',
      'یادم هست هدف امروز یاد گرفتنه، نه فقط تموم کردن صفحات'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با تمرکز مطالعه کردی 📖` : 'حالت مطالعه پایان یافت'
  },
  exam: {
    title: 'حالت امتحان',
    icon: '📝',
    subtitle: 'آروم و متمرکز، برای بهترین نتیجه',
    color: ['#7c3aed','#2563eb'],
    timerLabel: 'زمان آماده‌سازی',
    tip: 'استرس امتحان طبیعیه، ولی نباید مانع نشونت بده. چند نفس عمیق قبل از شروع، تمرکز رو سوالایی که بلدی (قبل از رفتن سراغ سخت‌ترا)، و یادآوری اینکه نتیجه‌ی این یه امتحان کل ارزش تو رو تعیین نمی‌کنه، کمکت می‌کنه سرت خنک‌تر بمونه و بهتر عمل کنی.',
    checklist: [
      'وسایل لازم (مداد، پاک‌کن، کارت، ماشین‌حساب و...) رو از شب قبل آماده کردم',
      'قبل از شروع، چند نفس عمیق کشیدم تا استرسم کم بشه',
      'به‌جای مرور کل مطالب در آخرین لحظه، فقط یه نگاه سریع به نکات مهم انداختم',
      'اول سوالایی که بلدم رو جواب می‌دم، بعد می‌رم سراغ سخت‌ترا',
      'اگه یه سوال گیرم داد، ازش رد می‌شم و بعداً برمی‌گردم، روش گیر نمی‌کنم',
      'یادم هست نتیجه‌ی این یه امتحان، کل ارزش من رو تعیین نمی‌کنه',
      'قبل از تحویل، اگه وقت داشتم یه بار دیگه جواب‌ها رو چک کردم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با آرامش و تمرکز کار کردی 📝` : 'حالت امتحان پایان یافت'
  },
  war: {
    title: 'حالت جنگ',
    free: true,
    icon: '🛡️',
    subtitle: 'آروم موندن وسط صدای آژیر و انفجار، قدم‌به‌قدم',
    color: ['#0f766e','#1e293b'],
    timerLabel: 'زمان آرام‌سازی',
    tip: 'صدای موشک، انفجار یا آژیر، بدنت رو فوری می‌بره تو حالت جنگ‌وگریز — قلب تند می‌زنه، دست‌وپا می‌لرزه، ذهن قفل می‌کنه. این یه واکنش کاملاً طبیعیِ بدن به یه تهدید واقعیه، نه ضعف یا بی‌منطقی بودن تو. وقتی این حس اومد سراغت، اول از هر چیز نفس بکش: یه نفس از بینی بکش تو، چند لحظه نگه دار، بعد آروم و کشیده از دهن بیرون بده — چندبار تکرار کن تا ضربان قلبت پایین بیاد. بعد با حواس‌پنجگانه‌ات به لحظه‌ی حال برگرد: چند چیزی که می‌بینی، می‌شنوی و لمس می‌کنی رو تو ذهنت اسم ببر. سعی کن اخبار رو فقط از منابع مطمئن و در بازه‌های مشخص چک کنی، نه با اسکرول بی‌وقفه و دیدن مکرر فیلم‌های ناراحت‌کننده که فقط استرس رو بیشتر می‌کنه. تنها موندن با این ترس سخت‌تره؛ به یکی از عزیزات پیام بده یا زنگ بزن، هم خیال خودت راحت می‌شه هم خیال اون.',
    checklist: [
      'می‌دونم امن‌ترین جای خونه یا محل کارم کجاست (دور از پنجره و شیشه)',
      'یه نفس عمیق از بینی کشیدم، چند لحظه نگه داشتم و آروم از دهن بیرون دادم',
      'با حواس‌پنجگانه‌ام به این لحظه برگشتم: چیزایی که می‌بینم، می‌شنوم و لمس می‌کنم رو تو ذهنم اسم بردم',
      'به‌جای اسکرول بی‌وقفه‌ی اخبار و فیلم‌های ناراحت‌کننده، فقط از منابع مطمئن و در بازه‌های مشخص خبر می‌گیرم',
      'با یکی از عزیزام تماس گرفتم یا پیام دادم، هم خیال خودم راحت شد هم خیال اون',
      'کیف یا وسایل ضروری (مدارک، آب، شارژر، داروی لازم) رو آماده و در دسترس گذاشتم',
      'به بدنم اجازه دادم لرزش یا تنشِ بعد از ترس رو با یه حرکت کوچیک (تکون دادن دست‌وپا، قدم زدن) آزاد کنه',
      'به خودم یادآوری کردم ترسیدن از این صداها یه واکنش طبیعیه، نه عیب یا ضعف من',
      'اگه حالم خیلی سنگین بود، به‌جای تنها موندن با ترسم، کنار یکی که بهش اعتماد دارم بودم'
    ],
    endMessage: (min)=> min>0 ? `${min} دقیقه رو صرف آروم کردن خودت کردی؛ این خودش یه قدم بزرگه 🕊️` : 'مراقب خودت باش؛ هر وقت لازم بود، دوباره برگرد به این حالت 🕊️'
  },
  loneliness: {
    title: 'حالت تنهایی',
    icon: '🌙',
    subtitle: 'تنها بودن، نه لزوماً تنهاییِ دردناک',
    color: ['#6366f1','#a855f7'],
    timerLabel: 'زمان با خودم',
    tip: 'حس تنهایی معمولاً با اسکرول بی‌هدف تو گوشی بدتر می‌شه، نه بهتر. به‌جای فرار از این حس، بذار چند لحظه بدون قضاوت حسش کنی، بعد یه قدم کوچیک بردار: به یه نفر پیام بده، یا یه کار کوچیک که واقعاً دوست داری انجام بده. یادت باشه تنها بودن الان، به معنی تنها موندن همیشه نیست.',
    checklist: [
      'به‌جای فقط اسکرول کردن شبکه‌های اجتماعی، به یکی از دوستام یا خانواده‌ام پیام دادم',
      'یه کار کوچیک که دوست دارم انجام دادم (موسیقی، پیاده‌روی، کتاب، ...)',
      'به‌جای سرکوب کردن این حس، اجازه دادم چند لحظه بدون قضاوت حسش کنم',
      'به خودم یادآوری کردم تنها بودن الان، به معنی تنها موندن همیشه نیست',
      'یه فعالیت برای این وقت تنهایی برنامه‌ریزی کردم، نه فقط دراز کشیدن با گوشی',
      'اگه حسم خیلی سنگین بود، به یکی که بهش اعتماد دارم گفتم چه حسی دارم'
    ],
    endMessage: (min)=> 'کارت خوب بود؛ یادت باشه همیشه یکی هست که می‌تونی باهاش حرف بزنی 💛'
  },
  cleaning: {
    title: 'حالت نظافت',
    icon: '🧹',
    subtitle: 'قدم به قدم، بدون فرار به گوشی',
    color: ['#10b981','#059669'],
    timerLabel: 'زمان نظافت',
    tip: 'نظافت رو به بخش‌های کوچیک تقسیم کن و یه اتاق یا قسمت رو کامل تموم کن قبل از رفتن سراغ بعدی؛ این کار حس پیشرفت واقعی بهت می‌ده. یه پلی‌لیست یا پادکست بذار و بذار موسیقی همراهت باشه، نه چک کردن گوشی وسط کار.',
    checklist: [
      'مشخص کردم امروز دقیقاً کدوم قسمت‌ها رو تمیز می‌کنم',
      'وسایل نظافت (دستمال، مواد شوینده، جارو) رو از قبل آماده کردم',
      'گوشی رو کنار گذاشتم یا فقط برای پلی‌لیست موسیقی ازش استفاده می‌کنم',
      'هر اتاق یا بخش رو کامل تموم می‌کنم قبل از رفتن سراغ بعدی',
      'بین کارا، به‌جای چک کردن گوشی، چند نفس عمیق می‌کشم و ادامه می‌دم',
      'در آخر، چند دقیقه به فضای تمیزشده نگاه می‌کنم و از نتیجه لذت می‌برم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه فضای اطرافتو مرتب کردی 🧹` : 'حالت نظافت پایان یافت'
  },
  editing: {
    title: 'حالت ادیت و تدوین',
    icon: '🎬',
    subtitle: 'کار عمیق و دقیق، فریم به فریم',
    color: ['#111827','#6366f1'],
    timerLabel: 'زمان تدوین',
    tip: 'تدوین کاریه که تمرکز پیوسته می‌خواد؛ هر بار قطع‌شدن حواس، چند دقیقه طول می‌کشه تا دوباره برگردی تو ریتم کار. قبل از شروع فوتیج‌ها رو مرتب کن، هدف همین جلسه رو مشخص کن، و بذار گوشی و اعلان‌ها بی‌صدا بمونن تا بتونی رو جزئیات ریز — کات دقیق، سینک صدا، رنگ و ریتم — تمرکز کنی.',
    checklist: [
      'قبل از شروع، فوتیج و فایل‌های پروژه رو مرتب و دسته‌بندی کردم',
      'گوشی رو رو حالت مزاحم نشو گذاشتم تا تمرکزم قطع نشه',
      'هدفم از این جلسه‌ی تدوین رو مشخص کردم (چه بخشی رو تموم کنم)',
      'هر چند دقیقه یه بار پروژه رو سیو می‌کنم که کارم از دست نره',
      'هر ۳۰ تا ۴۵ دقیقه چند لحظه چشمامو از مانیتور برمی‌دارم',
      'سینک بودن صدا و تصویر رو با دقت چک می‌کنم',
      'قبل از خروجی نهایی، تنظیمات رزولوشن و فرمت رو یه بار دیگه چک می‌کنم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با تمرکز عمیق تدوین کردی 🎬` : 'حالت ادیت و تدوین پایان یافت'
  },
  party: {
    title: 'حالت میهمانی',
    icon: '🎉',
    subtitle: 'حضور واقعی، نه فقط عکس یادگاری',
    color: ['#ec4899','#f59e0b'],
    timerLabel: 'زمان میهمانی',
    tip: 'تو یه میهمانی، بهترین چیزی که می‌تونی به بقیه و به خودت بدی، حضور کاملته. گوشی رو کمتر چک کن، بذار مکالمه‌ها و خنده‌های واقعی جای اسکرول و عکس گرفتن بی‌وقفه رو بگیرن؛ خاطره‌ی خوب از یه لحظه، بیشتر تو ذهن می‌مونه تا صد تا عکس ازش.',
    checklist: [
      'گوشیمو رو حالت مزاحم نشو گذاشتم یا خیلی کم چکش می‌کنم',
      'به‌جای عکس گرفتن مداوم، چند لحظه رو فقط برای حضور و لذت بردن می‌ذارم',
      'با آدمای جدید یا کمتر‌آشنا هم چند کلمه‌ای حرف می‌زنم',
      'به حرفای بقیه با دقت گوش می‌دم، نه فقط منتظر نوبت خودم',
      'اگه میزبانم، حواسم به راحتی مهمونام هم هست',
      'اگه چیزی برای میهمانی لازم بود (هدیه، غذا) از قبل آماده کردم',
      'می‌دونم کِی وقت رفتنه و بی‌دلیل طولش نمی‌دم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با حضور واقعی خوش گذروندی 🎉` : 'حالت میهمانی پایان یافت'
  },
  youtube: {
    title: 'حالت یوتیوب',
    icon: '▶️',
    subtitle: 'تماشای هدفمند، نه اسکرول بی‌پایان پیشنهادها',
    color: ['#dc2626','#7f1d1d'],
    timerLabel: 'زمان تماشا',
    tip: 'الگوریتم یوتیوب طوری طراحی شده که هر ویدیو، تو رو به یکی دیگه وصل کنه و زمان از دستت در بره. قبل از باز کردن اپ، مشخص کن دنبال چی هستی؛ یه سقف زمانی برای خودت بذار و وقتی به هدفت رسیدی، اپ رو ببند، نه اینکه بذاری ویدیوی بعدی خودش شروع بشه.',
    checklist: [
      'قبل از باز کردن اپ، می‌دونم دقیقاً دنبال چه ویدیویی هستم',
      'یه سقف زمانی برای تماشا تعیین کردم و آلارمشو گذاشتم',
      'پخش خودکار (Autoplay) رو خاموش کردم تا خودم انتخاب کنم بعدش چی ببینم',
      'به پیشنهادهای گوشه‌ی صفحه فقط اگه واقعاً بهم مربوطه توجه می‌کنم',
      'وقتی ویدیوی هدفم تموم شد، اپ رو می‌بندم، نه اینکه یکی دیگه بزنم',
      'اگه نزدیک وقت خوابه، از تماشای محتوای پراسترس یا تحریک‌کننده پرهیز می‌کنم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه تماشای هدفمند داشتی ▶️` : 'حالت یوتیوب پایان یافت'
  },
  instagram: {
    title: 'حالت اینستاگرام',
    free: true,
    icon: '📸',
    subtitle: 'چک کردن هدفمند، نه اسکرول بی‌هدف',
    color: ['#f59e0b','#d6249f'],
    timerLabel: 'زمان استفاده',
    tip: 'خیلی وقتا با یه هدف کوچیک وارد اینستاگرام می‌شیم و بعد از چند دقیقه اسکرول بی‌هدف، متوجه می‌شیم نیم ساعت گذشته و حس بدتری هم داریم. قبل از باز کردن اپ، هدفتو مشخص کن؛ وقتی به همون هدف رسیدی، ببندش. یادت باشه چیزی که تو فید می‌بینی، فقط بخش انتخاب‌شده‌ی زندگی بقیه‌ست، نه کل ماجرا.',
    checklist: [
      'قبل از باز کردن اپ، می‌دونم دقیقاً برای چی اومدم (پیام، استوری خاص، پست کردن)',
      'یه سقف زمانی برای این‌بار چک کردن تعیین کردم',
      'وقتی حس مقایسه یا حسادت اومد سراغم، یادم می‌مونه که فقط بخش انتخاب‌شده‌ی زندگی بقیه رو می‌بینم',
      'اکانت‌هایی که حس بدی بهم می‌دن رو بی‌صدا یا آنفالو می‌کنم',
      'به‌جای اسکرول بی‌هدف صفحه‌ی اصلی، فقط سراغ چیزی که براش اومدم می‌رم',
      'وقتی کارم تموم شد، اپ رو می‌بندم، نه اینکه دوباره بازش کنم چک کنم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه استفاده‌ی هدفمند داشتی 📸` : 'حالت اینستاگرام پایان یافت'
  },
  instrumentPractice: {
    title: 'حالت تمرین ساز',
    icon: '🎸',
    subtitle: 'تمرکز رو نت‌ها و حس آهنگ، نه فقط پر کردن وقت',
    color: ['#b45309','#78350f'],
    timerLabel: 'زمان تمرین',
    tip: 'قبل از شروع، ساز رو کوک کن و مشخص کن امروز دقیقاً رو کدوم قطعه یا تکنیک می‌خوای کار کنی. قسمت‌های سخت رو آروم و جداگانه تمرین کن، نه با سرعت کامل و از اول تا آخر؛ سرعت و روانی بعداً خودش میاد. به وضعیت بدن و دستات هم توجه کن تا فشار یا کشیدگی بی‌مورد نندازی.',
    checklist: [
      'ساز رو کوک کردم',
      'می‌دونم امروز دقیقاً رو کدوم قطعه یا تکنیک تمرکز می‌کنم',
      'گوشی رو بی‌صدا یا دور از دسترس گذاشتم',
      'قسمت‌های سخت رو آروم و جدا تمرین می‌کنم، نه با سرعت کامل',
      'حواسم به وضعیت بدن و دستامه، فشار بی‌مورد نمی‌ذارم',
      'آخر تمرین، یه بار قطعه رو کامل و بدون توقف می‌زنم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه تمرین با تمرکز داشتی 🎸` : 'حالت تمرین ساز پایان یافت'
  },
  salon: {
    title: 'حالت آرایشگاه',
    icon: '💈',
    subtitle: 'یه وقفه‌ی آروم، بدون عجله',
    color: ['#ec4899','#a855f7'],
    timerLabel: 'زمان حضور تو آرایشگاه',
    tip: 'قبل از رفتن، مدل یا کاری که می‌خوای رو تو ذهنت (یا با یه عکس) مشخص کن تا سر جلسه دودل نشی. گوشی رو کنار بذار و بذار این وقفه، یه استراحت کوچیک از روز شلوغت باشه؛ اگه چیزی رو دوست نداشتی، همون لحظه آروم و واضح بگو، نه بعداً که کار تموم شده.',
    checklist: [
      'قبل از رفتن، مدل یا کاری که می‌خوام رو مشخص کردم',
      'گوشی رو کنار گذاشتم و از این وقفه لذت می‌برم',
      'اگه چیزی رو دوست نداشتم، همون موقع آروم و واضح می‌گم',
      'این وقتو یه استراحت کوچیک می‌دونم، نه یه کار عجله‌ای',
      'به حرف و پیشنهاد آرایشگر با احترام گوش می‌دم',
      'آخر کار، از نتیجه و زحمتش قدردانی می‌کنم'
    ],
    endMessage: (min)=> min>0 ? `به‌به! ${min} دقیقه رو با آرامش گذروندی 💈` : 'حالت آرایشگاه پایان یافت'
  },
  hospital: {
    title: 'حالت بیمارستان',
    icon: '🏥',
    subtitle: 'آروم بمون، حواست به همینجا و همین لحظه باشه',
    color: ['#0ea5e9','#14b8a6'],
    timerLabel: 'زمان حضور تو بیمارستان',
    tip: 'بیمارستان بودن -چه برای خودت چه برای همراهیِ یکی از عزیزات- می‌تونه استرس‌زا باشه. سوالاتی که می‌خوای بپرسی رو از قبل بنویس تا یادت نره. رو چیزی که الان تو کنترلته تمرکز کن: نفس آروم کشیدن، سوال روشن پرسیدن، و حضور کنار کسی که بهش نیاز داره. نگرانی از قبل چیزی رو عوض نمی‌کنه؛ وقتی خبری اومد، باهاش روبه‌رو می‌شی.',
    checklist: [
      'مدارک و وسایل لازم (کارت ملی/بیمه، سوابق پزشکی) همراهمه',
      'سوالاتی که می‌خوام از دکتر یا پرستار بپرسم رو از قبل نوشتم',
      'گوشی رو بی‌صدا یا رو حالت مزاحم نشو گذاشتم',
      'چند نفس عمیق می‌کشم تا استرسم کمتر بشه',
      'تو زمان انتظار، با یه کار آروم (کتاب، موسیقی ملایم) حواسمو جمع می‌کنم، نه چک کردن مدام گوشی',
      'اگه چیزی برام روشن نبود، همون‌جا می‌پرسم، نه بعداً که نگرانیش بمونه'
    ],
    endMessage: (min)=> min>0 ? `${min} دقیقه رو با آرامش گذروندی؛ مراقب خودت باش 🏥` : 'حالت بیمارستان پایان یافت'
  },
  calligraphy: {
    title: 'حالت خوشنویسی',
    icon: '🖋️',
    subtitle: 'تمرکز رو حرکت قلم و نفس، نه عجله برای تموم کردن',
    color: ['#1e293b','#475569'],
    timerLabel: 'زمان تمرین خوشنویسی',
    tip: 'قبل از شروع، قلم و مرکب و کاغذ رو آماده کن و درست بشین تا نور و زاویه‌ی دستت راحت باشه. حرکت قلم رو آروم و هماهنگ با نفست جلو ببر؛ خوشنویسی عجله برنمی‌داره، هر چه آروم‌تر و با حضور بیشتر تمرین کنی، خط بهتر می‌شینه. رو یه حرف یا کلمه بمون تا واقعاً جا بیفته، نه اینکه فقط رد کنی و بری جلو.',
    checklist: [
      'قلم، مرکب و کاغذ رو آماده کردم',
      'می‌دونم امروز دقیقاً رو کدوم حرف یا کلمه تمرین می‌کنم',
      'نشستنم صافه و نور کافی دارم',
      'گوشی رو کنار گذاشتم تا تمرکزم به‌هم نخوره',
      'حرکت قلم رو آروم و هماهنگ با نفسم پیش می‌برم، نه با عجله',
      'آخر تمرین، بهترین خط امروزمو نگه می‌دارم تا پیشرفتمو ببینم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با آرامش خوشنویسی تمرین کردی ✍️` : 'حالت خوشنویسی پایان یافت'
  },
  painting: {
    title: 'حالت نقاشی',
    icon: '🎨',
    subtitle: 'رو لحظه‌ی کشیدن تمرکز کن، نه نتیجه‌ی نهایی',
    color: ['#f472b6','#a855f7'],
    timerLabel: 'زمان نقاشی',
    tip: 'قبل از شروع، بوم یا کاغذ، رنگ‌ها و وسایلتو آماده کن و یه فضای با نور کافی پیدا کن. به جای عجله برای تموم کردن، رو هر ضربه‌قلم و انتخاب رنگ حضور داشته باش؛ نقاشی قرار نیست کامل باشه، قراره یه لحظه‌ی خالص تمرکز و لذت باشه. اگه یه جا گیر کردی، به‌جای پاک کردن مدام، یکم عقب وایسا و نفس بکش.',
    checklist: [
      'بوم/کاغذ، رنگ‌ها و وسایلمو آماده کردم',
      'می‌دونم امروز دقیقاً می‌خوام چی بکشم',
      'نور و فضای کار کافیه',
      'گوشی رو کنار گذاشتم تا تمرکزم به‌هم نخوره',
      'به‌جای عجله برای تموم کردن، رو جزئیات و رنگ‌ها تمرکز می‌کنم',
      'آخر کار، عکسی از نقاشی امروز می‌گیرم تا پیشرفتمو ببینم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با آرامش نقاشی کشیدی 🎨` : 'حالت نقاشی پایان یافت'
  },
  languageLearning: {
    title: 'حالت یادگیری زبان',
    icon: '🗣️',
    subtitle: 'کمی هر روز، به‌جای خیلی یه‌بار',
    color: ['#0891b2','#7c3aed'],
    timerLabel: 'زمان تمرین زبان',
    tip: 'مغز زبان رو با تمرین کوتاه و مداوم بهتر از یه جلسه‌ی طولانی و فشرده یاد می‌گیره. به‌جای فقط ضربه‌زدن رو گزینه‌های اپ، سعی کن جمله‌ها رو با صدای بلند بگی و لغات جدید رو تو یه جمله‌ی خودت به‌کار ببری؛ این خیلی بیشتر از دیدن صرف تو ذهنت می‌مونه.',
    checklist: [
      'مشخص کردم امروز دقیقاً رو چی کار می‌کنم (لغت، گرامر، مکالمه، شنیداری)',
      'گوشی رو رو حالت مزاحم نشو گذاشتم تا وسط تمرین حواسم پرت نشه',
      'حداقل چندتا جمله رو با صدای بلند تمرین کردم، نه فقط تو ذهنم',
      'لغات یا نکاتی که یاد گرفتم رو یه‌جا نوشتم تا بعداً مرور کنم',
      'یه بخش از تمرین امروز با محتوای واقعی بود (پادکست، فیلم کوتاه، متن)، نه فقط اپ',
      'قبل از تموم کردن، چیزی که امروز یاد گرفتم رو یه بار برای خودم مرور کردم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با تمرکز زبان تمرین کردی 🗣️` : 'حالت یادگیری زبان پایان یافت'
  },
  amusementPark: {
    title: 'حالت شهربازی',
    icon: '🎡',
    subtitle: 'هیجان و خنده، دور از گوشی',
    color: ['#f43f5e','#fbbf24'],
    timerLabel: 'زمان شهربازی',
    tip: 'قبل از رفتن، یه بودجه‌ی تقریبی برای بلیط و خوراکی تو ذهنت داشته باش تا سر صحنه با هیجان لحظه زیادی خرج نکنی. گوشی رو تو کیف بذار، نه تو دستت؛ بذار هیجان واقعی سواری‌ها و خنده با همراهات جای اسکرول و عکس گرفتن مداوم رو بگیره.',
    checklist: [
      'قبل از رفتن، یه بودجه‌ی مشخص برای بلیط و خرید و خوراکی تو ذهنم دارم',
      'وسایل ضروری (کیف پول، شارژر، لباس راحت) رو آماده کردم',
      'گوشی رو تو کیف گذاشتم، نه تو دستم، تا واقعاً تو لحظه باشم',
      'قبل از سوار شدن هر وسیله، به قوانین ایمنی‌اش توجه می‌کنم',
      'اگه با بچه یا کسی هستم، همیشه حواسم بهش هست',
      'به‌جای فقط عکس گرفتن، چند لحظه رو فقط برای هیجان و خنده‌ی واقعی می‌ذارم'
    ],
    endMessage: (min)=> min>0 ? `چه روز خوبی! ${min} دقیقه با هیجان و حضور گذشت 🎡` : 'حالت شهربازی پایان یافت'
  },
  movie: {
    title: 'حالت تماشای فیلم',
    icon: '🍿',
    subtitle: 'تماشای آگاهانه، نه فقط پر کردن وقت',
    color: ['#1e1b4b','#9333ea'],
    timerLabel: 'زمان تماشا',
    tip: 'خیلی وقتا بیشتر وقت رو صرف گشتن دنبال «چی ببینیم» می‌کنیم تا خود تماشا. قبل از شروع، فیلم یا قسمتی که می‌خوای ببینی رو مشخص کن، گوشی رو کنار بذار و بذار تمرکزت کامل رو داستان باشه؛ بعد از تموم شدن هم چند لحظه به چیزی که دیدی فکر کن، نه اینکه فوری بری سراغ بعدی.',
    checklist: [
      'قبل از شروع، فیلم یا سریالی که می‌خوام ببینم رو مشخص کردم، نه اینکه وسط پلتفرم بگردم',
      'گوشی رو رو حالت مزاحم نشو گذاشتم یا از اتاق دور کردم',
      'نور و صدا رو برای یه تجربه‌ی بهتر تنظیم کردم',
      'حواسم به فیلمه، نه چک کردن مدام گوشی وسط تماشا',
      'اگه با کسی می‌بینم، وسط فیلم زیاد حرف نمی‌زنم که تجربه‌ی هردومون خراب نشه',
      'بعد از تموم شدن، چند لحظه به چیزی که دیدم فکر می‌کنم، نه اینکه فوری برم سراغ فیلم بعدی'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه تماشای آگاهانه داشتی 🍿` : 'حالت تماشای فیلم پایان یافت'
  },
  dance: {
    title: 'حالت رقص',
    icon: '💃',
    subtitle: 'حرکت با بدن، حضور با ریتم',
    color: ['#db2777','#f97316'],
    timerLabel: 'زمان تمرین رقص',
    tip: 'قبل از شروع بدنتو گرم و کمی کشش بده تا از کشیدگی عضله جلوگیری بشه. رو حس ریتم و حرکت بدنت تمرکز کن، نه فقط تکرار مکانیکی حرکات؛ گوشی رو فقط برای پخش موسیقی نگه دار، نه چک کردن پیام وسط تمرین.',
    checklist: [
      'قبل از شروع، کمی بدنم رو گرم و کشش دادم',
      'پلی‌لیست یا آهنگ مناسب تمرین امروز رو آماده کردم',
      'می‌دونم امروز دقیقاً رو کدوم حرکت یا کوریوگرافی کار می‌کنم',
      'گوشی رو فقط برای پخش موسیقی استفاده می‌کنم، نه چک کردن پیام',
      'رو حس ریتم و حرکت بدنم تمرکز می‌کنم، نه فقط تکرار مکانیکی',
      'آخر تمرین چند دقیقه کشش برای سرد کردن بدن'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با انرژی رقصیدی 💃` : 'حالت رقص پایان یافت'
  },
  date: {
    title: 'حالت قرار ملاقات',
    icon: '🌹',
    subtitle: 'حضور واقعی، نه فقط عکس یا نمایش',
    color: ['#e11d48','#fb7185'],
    timerLabel: 'زمان قرار',
    tip: 'بهترین چیزی که تو یه قرار می‌تونی بدی، حضور و خودِ واقعیته، نه یه نسخه‌ی نمایشی از خودت. گوشی رو کمتر چک کن و رو گوش‌دادن واقعی تمرکز کن؛ اگه اولین قراره، حتماً به یکی بگو کجایی و با کی، فقط برای احتیاط.',
    checklist: [
      'گوشی رو رو حالت مزاحم نشو گذاشتم یا خیلی کم چکش می‌کنم',
      'محل قرار رو از قبل هماهنگ و مشخص کردیم',
      'اگه اولین قراره، به یکی از دوستام گفتم کجام و با کی‌ام',
      'می‌خوام واقعاً به حرفاش گوش بدم، نه فقط منتظر نوبت خودم باشم',
      'سعی می‌کنم خودِ واقعیم باشم، نه نسخه‌ی نمایشی از خودم',
      'به‌جای قضاوت زودهنگام، می‌ذارم قرار طبیعی پیش بره',
      'بعد از قرار، بدون تحلیل بیش‌ازحد، می‌ذارم احساس واقعیم شکل بگیره'
    ],
    endMessage: (min)=> min>0 ? `امیدوارم قرار خوبی بود! ${min} دقیقه با حضور واقعی گذشت 🌹` : 'حالت قرار ملاقات پایان یافت'
  },
  meeting: {
    title: 'حالت جلسه کاری',
    icon: '📋',
    subtitle: 'حضور کامل، گوشی کنار',
    color: ['#0f172a','#0891b2'],
    timerLabel: 'زمان جلسه',
    tip: 'قبل از جلسه یه نگاه به دستور کار بنداز تا آماده باشی. گوشی رو کنار بذار یا بی‌صدا کن؛ چک کردن ایمیل یا پیام وسط جلسه، هم به بقیه بی‌احترامیه، هم باعث می‌شه نکات مهم رو از دست بدی.',
    checklist: [
      'قبل از جلسه، دستور کار یا نکاتی که باید مطرح کنم رو مرور کردم',
      'گوشی رو رو حالت مزاحم نشو گذاشتم یا کنار گذاشتم',
      'به‌جای چک کردن ایمیل یا پیام وسط جلسه، کامل حواسم به بحثه',
      'نکات مهم رو یادداشت می‌کنم تا بعداً یادم نره',
      'اگه حرفی دارم، واضح و مختصر می‌گم، نه پراکنده',
      'به حرف بقیه با دقت گوش می‌دم، نه فقط منتظر نوبت خودم',
      'آخر جلسه، جمع‌بندی و کارای بعدی برام روشنه'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با تمرکز کامل تو جلسه بودی 📋` : 'حالت جلسه کاری پایان یافت'
  },
  gardening: {
    title: 'حالت باغبانی',
    icon: '🌱',
    subtitle: 'دستات تو خاک، ذهنت تو آرامش',
    color: ['#65a30d','#166534'],
    timerLabel: 'زمان باغبانی',
    tip: 'باغبانی یکی از بهترین راه‌ها برای برگشتن به لحظه‌ی حاله. به‌جای عجله برای تموم کردن، به رشد و تغییرات کوچیک گیاه‌هات با دقت نگاه کن؛ گوشی رو کنار بذار و بذار دستات و طبیعت دور و برت کل حواستو بگیرن.',
    checklist: [
      'وسایل باغبانی (بیل کوچیک، آب‌پاش، دستکش) رو آماده کردم',
      'می‌دونم امروز دقیقاً رو کدوم گیاه یا بخش از باغچه کار می‌کنم',
      'گوشی رو کنار گذاشتم یا فقط برای موسیقی ازش استفاده می‌کنم',
      'به رشد و تغییرات کوچیک گیاه‌ها با دقت نگاه می‌کنم',
      'حواسم به وضعیت بدنم هست تا کمر یا زانوم اذیت نشه',
      'آخر کار، از نتیجه و فضای سبزی که ساختم لذت می‌برم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با آرامش باغبانی کردی 🌱` : 'حالت باغبانی پایان یافت'
  },
  worship: {
    title: 'حالت عبادت',
    icon: '🤲',
    subtitle: 'چند دقیقه فقط برای دل و روحت',
    color: ['#065f46','#0f766e'],
    timerLabel: 'زمان عبادت',
    tip: 'قبل از شروع، گوشی رو کاملاً کنار بذار و یه فضای آروم و تمیز برای خودت آماده کن. عجله نکن؛ بذار این چند دقیقه، یه جزیره‌ی آرامش وسط روز شلوغت باشه، جایی که تمرکزت کامل همینجا و همین لحظه‌ست، نه پیش دغدغه‌های بعدی.',
    checklist: [
      'گوشی رو رو حالت مزاحم نشو گذاشتم یا از خودم دور کردم',
      'یه جای آروم و تمیز برای عبادت آماده کردم',
      'قبل از شروع، چند نفس عمیق کشیدم تا ذهنم از دغدغه‌های روز خالی بشه',
      'سعی می‌کنم عجله نکنم و با حضور کامل انجامش بدم',
      'به‌جای فکر کردن به کارای بعدی، تمرکزم همینجا و همین لحظه‌ست',
      'بعد از تموم شدن، چند لحظه رو فقط برای آرامش و سکوت نگه می‌دارم'
    ],
    endMessage: (min)=> min>0 ? `${min} دقیقه رو با آرامش و حضور گذروندی 🤲` : 'حالت عبادت پایان یافت'
  },
  driving: {
    title: 'حالت رانندگی',
    icon: '🚗',
    subtitle: 'گوشی کنار، چشم به جاده',
    color: ['#1e3a8a','#facc15'],
    timerLabel: 'زمان رانندگی',
    tip: 'حتی یه نگاه چندثانیه‌ای به گوشی وسط رانندگی، مثل اینه که چند ثانیه با چشم بسته رانندگی کنی. قبل از حرکت، مقصد رو تو نقشه تنظیم کن و گوشی رو رو حالت رانندگی یا مزاحم نشو بذار؛ هر پیام یا تماسی می‌تونه صبر کنه تا برسی.',
    checklist: [
      'قبل از حرکت، مقصد و مسیر رو تو نقشه تنظیم کردم',
      'گوشی رو رو حالت رانندگی/مزاحم نشو گذاشتم تا پیام و تماس هوشیاریمو نگیره',
      'گوشی رو تو جاپیدار یا خارج از دسترس دستم گذاشتم، نه رو پام یا صندلی',
      'کمربند ایمنی همه‌ی سرنشینا بسته‌ست',
      'آینه‌ها و وضعیت نشستنم رو تنظیم کردم',
      'اگه خسته یا عصبانی‌ام، قبل از حرکت چند لحظه آروم می‌شم یا رانندگی رو به بعد موکول می‌کنم',
      'تو مسیرهای طولانی، هر یکی دو ساعت یه توقف کوتاه برای استراحت دارم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با تمرکز و امن رانندگی کردی 🚗` : 'حالت رانندگی پایان یافت'
  },
  daydream: {
    title: 'حالت خیال‌پردازی',
    icon: '💭',
    subtitle: 'به‌جای فرار از واقعیت، رویاتو دقیق‌تر ببین',
    color: ['#a78bfa','#67e8f9'],
    timerLabel: 'زمان خیال‌پردازی',
    tip: 'خیال‌پردازیِ هدفمند با فرار از واقعیت فرق داره؛ اینجا قراره رویای زندگیت رو دقیق و روشن تصور کنی، نه فقط توش غرق بشی. جزئیاتشو ببین: کجایی، با کی‌ای، چه حسی داری — این تصویر روشن بعداً تبدیل به انگیزه‌ی واقعی می‌شه.',
    checklist: [
      'یه جای آروم و بی‌مزاحم پیدا کردم',
      'گوشی رو بی‌صدا یا کنار گذاشتم',
      'یه هدف یا رویای مشخص رو انتخاب کردم، نه چیزای پراکنده',
      'جزئیاتشو با تمام حس‌ها تصور کردم (دیدن، شنیدن، حس کردن)',
      'حداقل یه قدم کوچیک که امروز می‌تونم بردارم رو پیدا کردم',
      'چیزی که تصور کردم رو یه‌جا یادداشت کردم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با رویاتو روشن‌تر کردی ✨` : 'حالت خیال‌پردازی پایان یافت'
  },
  sales: {
    title: 'حالت فروشندگی',
    icon: '🤝',
    subtitle: 'با اعتمادبه‌نفس بفروش، نه با اصرار',
    color: ['#f59e0b','#16a34a'],
    timerLabel: 'زمان فروش',
    tip: 'بهترین فروشنده کسیه که اول گوش می‌ده، بعد پیشنهاد می‌ده؛ مشتری وقتی حس کنه فهمیدیش، راحت‌تر بهت اعتماد می‌کنه. به محصول یا خدمتت مثل یه راه‌حل برای مشکل مشتری نگاه کن، نه چیزی که فقط باید بفروشیش.',
    checklist: [
      'ویژگی‌ها و مزایای محصول/خدمتم رو مرور کردم',
      'به سوال‌ها و ایرادهای احتمالی مشتری از قبل فکر کردم',
      'قبل از پیشنهاد دادن، به نیاز واقعی مشتری گوش می‌دم',
      'به چیزی که واقعیت نداره وعده نمی‌دم',
      'لحن و ظاهرم آروم و حرفه‌ایه',
      'بعد از هر مکالمه، پیگیری یا جمع‌بندیش رو یادداشت می‌کنم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با تمرکز فروش داشتی 🤝` : 'حالت فروشندگی پایان یافت'
  },
  familyTime: {
    title: 'حالت وقت گذرانی با خانواده',
    icon: '👨‍👩‍👧‍👦',
    subtitle: 'گوشی کنار، توجهت واقعی',
    color: ['#f97316','#fbbf24'],
    timerLabel: 'زمان با خانواده',
    tip: 'بودن جسمی تو یه اتاق با بودن ذهنی خیلی فرق داره؛ خانواده حواسشون هست که گوشیت دستته یا چشمت تو چشمشونه. این وقت رو کامل بده به‌شون، بقیه‌ی دنیا می‌تونه چند ساعت صبر کنه.',
    checklist: [
      'گوشی رو بی‌صدا یا تو یه اتاق دیگه گذاشتم',
      'حرف کار و مسائل روزمره رو کنار گذاشتم',
      'واقعاً گوش می‌دم، نه فقط منتظر نوبت حرف زدنم',
      'یه فعالیت مشترک (بازی، غذا، گپ) شروع کردیم',
      'اگه بحثی پیش اومد، آروم و بدون قضاوت جلو رفتم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه وقت باکیفیت با خانواده گذروندی 👨‍👩‍👧‍👦` : 'حالت وقت گذرانی با خانواده پایان یافت'
  },
  photography: {
    title: 'حالت عکاسی',
    icon: '📷',
    subtitle: 'با چشم ببین، نه فقط با لنز',
    color: ['#1f2937','#38bdf8'],
    timerLabel: 'زمان عکاسی',
    tip: 'قبل از اینکه دوربین رو بالا بیاری، چند ثانیه فقط با چشم صحنه رو ببین؛ نور، قاب و لحظه رو حس کن. عکس خوب از دیدنِ درست شروع می‌شه، نه از تنظیمات دوربین.',
    checklist: [
      'باتری و حافظه‌ی دوربین/گوشی رو چک کردم',
      'نور صحنه رو بررسی کردم (طلایی، سایه، نور مستقیم...)',
      'قبل از گرفتن عکس، چند زاویه و قاب مختلف رو در نظر گرفتم',
      'صبر کردم تا لحظه‌ی مناسب برسه، عجله نکردم',
      'بعد از هر عکس، نتیجه رو نگاه کردم تا یاد بگیرم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با تمرکز عکاسی کردی 📷` : 'حالت عکاسی پایان یافت'
  },
  trading: {
    title: 'حالت ترید',
    icon: '📈',
    subtitle: 'با برنامه معامله کن، نه با احساس',
    color: ['#16a34a','#dc2626'],
    timerLabel: 'زمان معامله',
    tip: 'معامله‌ی احساسی، بزرگ‌ترین دشمن سرمایه‌ست؛ قبل از ورود، حد ضرر و برنامه‌ت رو مشخص کن و بهش پایبند بمون. اگه ضرر کردی، دنبال جبرانِ سریع نباش — همون لحظه از صفحه فاصله بگیر.',
    checklist: [
      'قبل از ورود، نقطه‌ی خروج و حد ضرر رو مشخص کردم',
      'حداکثر ضرر قابل‌قبول امروزم رو از قبل تعیین کردم',
      'با پول یا سرمایه‌ای معامله می‌کنم که از دست دادنش زندگیمو بهم نمی‌ریزه',
      'بعد از یه ضرر، برای جبران سریع وارد معامله‌ی احساسی نمی‌شم',
      'هر معامله رو با دلیلش یادداشت می‌کنم',
      'اگه به سقف ضرر امروزم رسیدم، صفحه رو می‌بندم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با برنامه و انضباط معامله کردی 📈` : 'حالت ترید پایان یافت'
  },
  farming: {
    title: 'حالت کشاورزی',
    icon: '🌾',
    subtitle: 'صبر و پیوستگی، رمز محصول خوب',
    color: ['#84cc16','#a16207'],
    timerLabel: 'زمان کار مزرعه',
    tip: 'کشاورزی نتیجه‌ی فوری نمی‌ده؛ هر روز یه قدم کوچیک و پیوسته، از یه هجوم کاری یک‌روزه مؤثرتره. به زمین و گیاه دقت کن، خیلی از مشکلا رو می‌شه زودتر از اینکه بزرگ بشن دید.',
    checklist: [
      'وضعیت آبیاری و رطوبت خاک رو چک کردم',
      'گیاه‌ها رو برای آفت یا بیماری بررسی کردم',
      'کارای امروز (کاشت، وجین، برداشت...) رو مشخص کردم',
      'لباس و ابزار مناسب کار همراهمه',
      'پیشرفت یا مشاهدات امروز رو یادداشت کردم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با تمرکز رو زمین کار کردی 🌾` : 'حالت کشاورزی پایان یافت'
  },
  livestock: {
    title: 'حالت دام‌داری',
    icon: '🐄',
    subtitle: 'یه رسیدگی منظم برای موجوداتی که بهت وابسته‌ن',
    color: ['#78350f','#ca8a04'],
    timerLabel: 'زمان رسیدگی به دام',
    tip: 'دام‌ها به یه برنامه‌ی منظم وابسته‌ن و نمی‌تونن بگن چیزی کم دارن؛ به رفتار و ظاهرشون دقت کن، چون اولین نشونه‌ی بیماری معمولاً همونجاست. یه روتین ثابت برای غذا و رسیدگی، هم به سلامت اون‌ها کمک می‌کنه هم به آرامش خودت.',
    checklist: [
      'آب و خوراک دام‌ها رو چک و تأمین کردم',
      'رفتار و ظاهر دام‌ها رو برای علائم بیماری بررسی کردم',
      'محل نگهداری/آغل رو تمیز و مرتب کردم',
      'هر تغییر غیرعادی رو یادداشت کردم تا لازم شد به دامپزشک بگم',
      'قبل از ترک، مطمئن شدم محل امن و درِ آغل بسته‌ست'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با دقت به دام‌ها رسیدگی کردی 🐄` : 'حالت دام‌داری پایان یافت'
  },
  accounting: {
    title: 'حالت حسابداری',
    icon: '🧮',
    subtitle: 'دقت الان، دردسر کمتر بعداً',
    color: ['#0f766e','#facc15'],
    timerLabel: 'زمان حسابداری',
    tip: 'حسابداری کاریه که یه اشتباه کوچیک می‌تونه بعداً ساعت‌ها وقت بگیره تا پیدا بشه؛ به‌جای عجله، هر عدد رو دوبار چک کن. یه محیط بی‌سروصدا و تمرکز کامل، از هر ترفند سریعی برای اجتناب از اشتباه مؤثرتره.',
    checklist: [
      'مدارک و فایل‌های لازم رو آماده کردم',
      'گوشی و اعلان‌های مزاحم رو خاموش کردم',
      'قبل از ثبت هر عدد، منبعشو چک می‌کنم',
      'در پایان کار، جمع‌ها و تراز رو یه‌بار مرور می‌کنم',
      'نکات یا موارد مبهم رو برای بعد یادداشت کردم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با دقت حسابداری کار کردی 🧮` : 'حالت حسابداری پایان یافت'
  },
  secretary: {
    title: 'حالت منشی‌گری',
    icon: '🗂️',
    subtitle: 'هماهنگ و منظم، پشت‌صحنه‌ی کار رو نگه دار',
    color: ['#0ea5e9','#f472b6'],
    timerLabel: 'زمان منشی‌گری',
    tip: 'کار منشی‌گری از بیرون ساده به‌نظر می‌رسه ولی هماهنگیِ نامرئیه که کل کار رو سرپا نگه می‌داره؛ هر تماس، پیام و قرار رو دقیق ثبت کن تا چیزی از قلم نیفته. اولویت‌بندی درست، مهم‌تر از سرعت جواب دادنه.',
    checklist: [
      'لیست تماس‌ها و پیام‌های امروز رو مرور کردم',
      'قرارها و جلسات رو تو تقویم چک کردم',
      'هر درخواست جدید رو فوراً یادداشت می‌کنم، نه که به حافظه بسپرمش',
      'قبل از جواب دادن، اولویت هر کار رو مشخص می‌کنم',
      'در پایان، کارهای انجام‌نشده رو برای فردا آماده کردم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه منظم و هماهنگ کار کردی 🗂️` : 'حالت منشی‌گری پایان یافت'
  },
  consulting: {
    title: 'حالت مشاوره',
    icon: '💡',
    subtitle: 'اول بفهم، بعد راه‌حل بده',
    color: ['#6366f1','#22c55e'],
    timerLabel: 'زمان مشاوره',
    tip: 'یه مشاوره‌ی خوب با گوش دادنِ کامل شروع می‌شه، نه با پریدن سریع سراغ راه‌حل؛ بذار طرف مقابل کامل حرفشو بزنه. راه‌حلی که به مسئله‌ی واقعی جواب نده، هرچقدرم هوشمندانه باشه، به درد نمی‌خوره.',
    checklist: [
      'قبل از جلسه، زمینه و سوابق موضوع رو مرور کردم',
      'اول کامل گوش می‌دم، بعد نظر می‌دم',
      'سوال می‌پرسم تا مطمئن شم مسئله‌ی واقعی رو فهمیدم',
      'پیشنهادهام رو شفاف و قابل‌اجرا بیان می‌کنم',
      'نکات کلیدی جلسه رو یادداشت و جمع‌بندی می‌کنم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با تمرکز مشاوره دادی 💡` : 'حالت مشاوره پایان یافت'
  },
  construction: {
    title: 'حالت کارگری ساختمان',
    icon: '👷',
    subtitle: 'ایمنی اول، بعد سرعت',
    color: ['#eab308','#1f2937'],
    timerLabel: 'زمان کار ساختمانی',
    tip: 'تو کار ساختمونی، یه لحظه غفلت می‌تونه قیمتش خیلی بیشتر از چند دقیقه‌ای باشه که با رعایت ایمنی از دست می‌دی. قبل از شروع هر کار، وسایل و ایمنی رو چک کن؛ خستگی هم نشونه‌ست که باید استراحت کنی، نه که فشار بیشتر بیاری.',
    checklist: [
      'وسایل ایمنی (کلاه، دستکش، کفش...) رو پوشیدم',
      'ابزار و وسایل کار رو چک کردم که سالم و آماده باشن',
      'محیط کار رو برای خطرات احتمالی بررسی کردم',
      'کار امروز رو با همکارها هماهنگ کردم',
      'هر چند ساعت یه‌بار برای آب خوردن و استراحت وقت گذاشتم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با تمرکز و ایمنی کار کردی 👷` : 'حالت کارگری ساختمان پایان یافت'
  },
  programming: {
    title: 'حالت برنامه‌نویسی',
    icon: '💻',
    subtitle: 'یه مسئله رو در یه لحظه حل کن',
    color: ['#0f172a','#22d3ee'],
    timerLabel: 'زمان برنامه‌نویسی',
    tip: 'تعویض مداوم بین تسک‌ها، تمرکز عمیقی که کدنویسی بهش نیاز داره رو از بین می‌بره؛ سعی کن رو یه مسئله بمونی تا تهش. قبل از نوشتن کد، چند ثانیه به راه‌حل فکر کن — کدی که قبلش فکر شده، بعداً دیباگش خیلی کمتر طول می‌کشه.',
    checklist: [
      'اعلان‌ها و تب‌های حواس‌پرت‌کن رو بستم',
      'می‌دونم دقیقاً رو چه تسک یا مسئله‌ای کار می‌کنم',
      'قبل از نوشتن کد، چند لحظه به راه‌حل فکر کردم',
      'تغییرات کوچیک و قابل‌تست انجام می‌دم، نه یه بلوک بزرگ یهویی',
      'قبل از پایان، کدمو یه‌بار مرور یا تست می‌کنم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با تمرکز کد زدی 💻` : 'حالت برنامه‌نویسی پایان یافت'
  },
  writing: {
    title: 'حالت نویسندگی',
    icon: '✍️',
    subtitle: 'اول بنویس، بعد ویرایش کن',
    color: ['#1e293b','#f59e0b'],
    timerLabel: 'زمان نویسندگی',
    tip: 'بزرگ‌ترین دشمن نوشتن، ویرایش هم‌زمانه؛ تا وقتی متن اول رو تموم نکردی، برنگرد و پاکش نکن. اول بذار متن خام بیاد بیرون، ویرایش و دقت رو بذار برای مرحله‌ی بعد.',
    checklist: [
      'گوشی و اعلان‌های مزاحم رو خاموش کردم',
      'می‌دونم امروز دقیقاً قراره چی بنویسم',
      'تا رسیدن به یه بند/صفحه، برنمی‌گردم ویرایش کنم',
      'اگه گیر کردم، به‌جای توقف کامل، هرچی به ذهنم رسید نوشتم',
      'در پایان، یه‌بار متن رو برای غلط و روانی مرور کردم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه نوشتی ✍️` : 'حالت نویسندگی پایان یافت'
  },
  sewing: {
    title: 'حالت خیاطی',
    icon: '🧵',
    subtitle: 'اندازه رو دوبار چک کن، یه‌بار ببر',
    color: ['#be185d','#f59e0b'],
    timerLabel: 'زمان خیاطی',
    tip: 'تو خیاطی، بریدن پارچه برگشت نداره؛ قبل از قیچی زدن، اندازه و الگو رو دوباره چک کن. صبر و دقت تو مرحله‌ی آماده‌سازی، از هر اصلاح بعدی سریع‌تره.',
    checklist: [
      'الگو و اندازه‌ها رو قبل از برش دوباره چک کردم',
      'ابزار (سوزن، نخ، قیچی...) آماده و در دسترسه',
      'نور کار برای دیدن دقیق کافیه',
      'قبل از دوخت نهایی، یه تست یا سنجاق‌زنی انجام دادم',
      'در پایان، درزها و دوخت‌ها رو یه‌بار بازرسی کردم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با دقت خیاطی کردی 🧵` : 'حالت خیاطی پایان یافت'
  },
  makeup: {
    title: 'حالت آرایش و میکاپ',
    icon: '💄',
    subtitle: 'نور خوب و دست آروم، رمز کار تمیز',
    color: ['#ec4899','#fde68a'],
    timerLabel: 'زمان آرایش',
    tip: 'بدون نور مناسب، حتی بهترین دست هم نتیجه‌ی درستی نمی‌ده؛ قبل از شروع، نور کارتو چک کن. لایه‌های نازک و پشت‌سرهم، همیشه از یه لایه‌ی ضخیم و عجولانه بهتر جواب می‌ده.',
    checklist: [
      'پوست یا صورت رو قبل از شروع آماده کردم',
      'نور محیط برای دیدن رنگ‌های واقعی کافیه',
      'ابزار و محصولات مورد نیاز رو کنار دستم چیدم',
      'لایه‌به‌لایه و بدون عجله جلو می‌رم',
      'در پایان، از چند زاویه و نور نتیجه رو چک می‌کنم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با دقت کار کردی 💄` : 'حالت آرایش و میکاپ پایان یافت'
  },
  wedding: {
    title: 'حالت جشن عروسی',
    icon: '💍',
    subtitle: 'تو لحظه بمون، نگران عکس و برنامه نباش',
    color: ['#fbbf24','#db2777'],
    timerLabel: 'زمان جشن عروسی',
    tip: 'جشن عروسی یه بار اتفاق می‌افته؛ به‌جای اینکه همش دنبال عکس گرفتن یا کنترل جزئیات باشی، چند لحظه فقط لذت ببر. اگه تو برگزاریش کمک می‌کنی، یه چک‌لیست ساده بهتر از حافظه‌ات عمل می‌کنه.',
    checklist: [
      'کارهای مهم امروز (لباس، وسایل، هماهنگی‌ها) رو از قبل چک کردم',
      'گوشی رو گذاشتم کنار تا واقعاً تو لحظه باشم',
      'اگه تو برگزاری کمک می‌کنم، وظیفه‌ی خودمو می‌دونم چیه',
      'برای عکس و فیلم گرفتن وسواس به خرج نمی‌دم',
      'یه لحظه وقت گذاشتم که فقط از جشن لذت ببرم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه از جشن لذت بردی 💍` : 'حالت جشن عروسی پایان یافت'
  },
  marketing: {
    title: 'حالت بازاریابی',
    icon: '📣',
    subtitle: 'پیام روشن برای مخاطب درست',
    color: ['#f43f5e','#6366f1'],
    timerLabel: 'زمان بازاریابی',
    tip: 'بازاریابیِ خوب یعنی حرف درست رو به آدم درست بزنی، نه اینکه به همه یه چیز بگی. قبل از هر محتوا یا کمپین، مشخص کن دقیقاً برای کی می‌نویسی و چه مشکلی رو براش حل می‌کنی.',
    checklist: [
      'مخاطب هدف امروزم رو مشخص کردم',
      'پیام اصلی رو تو یه جمله‌ی ساده خلاصه کردم',
      'قبل از انتشار، از دید مخاطب به محتوا نگاه کردم',
      'داده یا نتیجه‌ی کارهای قبلی رو چک کردم تا کورکورانه پیش نرم',
      'کارهای امروز رو با یه لیست مشخص جلو بردم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با تمرکز رو بازاریابی کار کردی 📣` : 'حالت بازاریابی پایان یافت'
  },
  voiceOver: {
    title: 'حالت گویندگی',
    icon: '🎙️',
    subtitle: 'صدا رو گرم کن، بعد ضبط کن',
    color: ['#7c2d12','#f97316'],
    timerLabel: 'زمان گویندگی',
    tip: 'صدا هم مثل عضله نیاز به گرم کردن داره؛ چند دقیقه تمرین قبل از ضبط، کیفیت نهایی رو خیلی بهتر می‌کنه. رو ریتم و مکث‌ها دقت کن، سرعت زیاد باعث می‌شه شنونده جا بمونه.',
    checklist: [
      'صدام رو با چند تمرین کوتاه گرم کردم',
      'متن رو قبل از ضبط یه‌بار کامل خوندم',
      'محیط ضبط از سروصدای اضافه خالیه',
      'رو مکث‌ها و ریتم گفتار دقت می‌کنم، نه فقط سرعت',
      'بعد از ضبط، یه‌بار گوش می‌دم تا نکات قابل بهبود رو پیدا کنم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با تمرکز گویندگی کردی 🎙️` : 'حالت گویندگی پایان یافت'
  },
  singing: {
    title: 'حالت خوانندگی',
    icon: '🎤',
    subtitle: 'قبل از خوندن، صدات رو باز کن',
    color: ['#9333ea','#ec4899'],
    timerLabel: 'زمان تمرین خوانندگی',
    tip: 'خوندن بدون گرم کردن صدا، هم به کیفیت اجرا لطمه می‌زنه هم به تارهای صوتیت فشار میاره. چند دقیقه تمرین تنفس و صدا قبل از شروع، تفاوت محسوسی تو اجرات ایجاد می‌کنه.',
    checklist: [
      'صدام رو با چند تمرین تنفسی و ووکال گرم کردم',
      'آب کافی همراهمه',
      'قطعه یا تمرین امروز رو مشخص کردم',
      'رو تنفس درست موقع خوندن تمرکز می‌کنم',
      'بخشی از تمرین رو ضبط می‌کنم تا بعداً گوش بدم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با تمرکز تمرین خوندی 🎤` : 'حالت خوانندگی پایان یافت'
  },
  freelancing: {
    title: 'حالت فریلنسری',
    icon: '🧑‍💻',
    subtitle: 'خودتی و خودت، برنامه‌ی خودتو بچین',
    color: ['#0891b2','#facc15'],
    timerLabel: 'زمان فریلنسری',
    tip: 'وقتی رئیس خودتی، بزرگ‌ترین چالش نه پیدا کردن کار، که مدیریت زمانه؛ بدون یه برنامه‌ی مشخص، روز راحت هدر می‌ره. کارهای امروز رو اولویت‌بندی کن و بین کار و استراحت مرز مشخص بذار.',
    checklist: [
      'لیست کارهای امروز و اولویت‌شون رو مشخص کردم',
      'قبل از شروع، پیام‌ها و ایمیل‌های مهم رو چک کردم',
      'زمان مشخصی برای هر تسک در نظر گرفتم',
      'محیط کارم از حواس‌پرتی خونه دوره',
      'در پایان روز، پیشرفت کارها رو یادداشت یا فاکتور می‌کنم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با تمرکز فریلنسری کار کردی 🧑‍💻` : 'حالت فریلنسری پایان یافت'
  },
  massage: {
    title: 'حالت ماساژوری',
    icon: '💆',
    subtitle: 'با فشار درست، نه فقط دست تند',
    color: ['#134e4a','#5eead4'],
    timerLabel: 'زمان ماساژ',
    tip: 'ماساژ خوب به فشار ثابت و آگاهی از واکنش بدن مراجع نیاز داره، نه سرعت یا زور زیاد؛ گوش بده بدن کجا گرفتگی داره و آروم روش وقت بذار. قبل از شروع، محیط آروم و گرم باشه تا عضلات راحت‌تر شل بشن.',
    checklist: [
      'محیط کار گرم، آروم و بی‌سروصداست',
      'دست‌ها و روغن/کرم مورد نیاز آماده‌ست',
      'قبل از شروع از مراجع پرسیدم کجا گرفتگی یا درد داره',
      'فشار دستم رو متناسب با واکنش بدنش تنظیم می‌کنم',
      'بعد از پایان، آب کافی به مراجع پیشنهاد می‌دم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با دقت ماساژ دادی 💆` : 'حالت ماساژوری پایان یافت'
  },
  mobileGaming: {
    title: 'حالت گیم موبایل',
    icon: '🎮',
    subtitle: 'بازی کن، نه اینکه بازی وقتتو بخوره',
    color: ['#8b5cf6','#3b82f6'],
    timerLabel: 'زمان بازی',
    tip: 'بازی‌های موبایل با اعلان و جایزه‌های پشت‌سرهم طراحی شدن که ولت نکنن؛ قبل از شروع، یه سقف زمانی برای خودت بذار و بهش پایبند بمون. قبل از هر خرید داخل‌برنامه‌ای، چند ثانیه مکث کن و ببین واقعاً بهش نیاز داری یا فقط لحظه‌ایه.',
    checklist: [
      'زمان بازی امروزمو از قبل مشخص کردم',
      'آلارم یا تایمر برای پایان بازی گذاشتم',
      'قبل از هر خرید داخل‌برنامه‌ای، یه لحظه مکث می‌کنم',
      'بین دورهای بازی چند لحظه استراحت می‌دم',
      'وقتی به زمانی که تعیین کردم رسیدم، بازی رو می‌بندم'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با کنترل بازی کردی 🎮` : 'حالت گیم موبایل پایان یافت'
  },
  knitting: {
    title: 'حالت بافتنی',
    icon: '🧶',
    subtitle: 'هر رج، آروم و با دقت',
    color: ['#f472b6','#a855f7'],
    timerLabel: 'زمان بافتنی',
    tip: 'بافتنی کاریه که با عجله خراب می‌شه؛ قبل از شروع، الگو و تعداد رج‌های امروزتو مشخص کن. هر چند رج یه‌بار کارتو با الگو مقایسه کن تا اشتباه زود دیده بشه، نه آخر کار.',
    checklist: [
      'الگو یا تعداد رج‌های امروز رو مشخص کردم',
      'نخ و میل بافتنی مناسب آماده‌ست',
      'نور کار برای دیدن دقیق دونه‌ها کافیه',
      'هر چند رج، کارمو با الگو مقایسه می‌کنم',
      'در پایان، جای بافتم رو نشونه‌گذاری می‌کنم که بعداً گم نشه'
    ],
    endMessage: (min)=> min>0 ? `آفرین! ${min} دقیقه با آرامش بافتنی بافتی 🧶` : 'حالت بافتنی پایان یافت'
  }
};

/* ---- Grouping the ۶۰ حالت into browsable categories — purely a UI grouping
   over the FOCUS_MODES data above; it doesn't change how any mode behaves,
   just how it's found/filtered in the picker. Every FOCUS_MODES key should
   appear in exactly one category here (a key left out of every list here
   simply won't show up in the picker, so keep this in sync when adding a
   new mode above). ---- */
const FOCUS_MODE_CATEGORIES = [
  { id:'health', label:'💪 سلامت و بدن', keys:['gym','walk','football','pool','nap','sleep','morning','massage'] },
  { id:'home', label:'🏠 خونه و کارهای روزمره', keys:['cleaning','driving','gardening','cooking'] },
  { id:'shopping', label:'🛍️ خرید', keys:['clothesShopping','supermarket','onlineShopping'] },
  { id:'social', label:'🎉 اجتماعی، خانواده و مناسبت‌ها', keys:['friendHangout','party','date','meeting','familyTime','wedding'] },
  { id:'leisure', label:'🎬 تفریح و بیرون از خونه', keys:['coffeeshop','gamingCafe','restaurant','amusementPark','movie','travel','salon'] },
  { id:'study', label:'🎓 مطالعه و یادگیری', keys:['freeStudy','exam','languageLearning'] },
  { id:'hard', label:'💭 موقعیت‌های سخت و احساسی', keys:['war','loneliness','hospital','daydream'] },
  { id:'art', label:'🎨 هنر و خلاقیت', keys:['painting','calligraphy','instrumentPractice','singing','dance','writing','photography','voiceOver','editing','knitting'] },
  { id:'work', label:'🧑‍💼 کار و کسب‌وکار', keys:['sales','trading','accounting','secretary','consulting','construction','programming','sewing','makeup','marketing','freelancing','farming','livestock'] },
  { id:'social_media', label:'📵 گوشی و شبکه‌های اجتماعی', keys:['youtube','instagram','mobileGaming'] },
  { id:'spiritual', label:'🙏 معنویت', keys:['worship'] }
];
function focusModeCategoryOf(key){
  const cat = FOCUS_MODE_CATEGORIES.find(c=> c.keys.includes(key));
  return cat ? cat.id : null;
}

let focusActiveMode = null;
let focusChecklistState = {};
let focusTimerInterval = null;
let focusSecondsElapsed = 0;

function focusFormatTime(totalSec){
  const m = Math.floor(totalSec/60), s = totalSec%60;
  return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}

function focusModeColorStyle(m){
  const c = m.color || [getComputedStyle(document.documentElement).getPropertyValue('--accent'), getComputedStyle(document.documentElement).getPropertyValue('--accent-2')];
  return `--mc1:${c[0]};--mc2:${c[1]};`;
}

let focusModeActiveCat = 'all';
function renderFocusModeGrid(){
  const grid = document.getElementById('focusModeGrid');
  const chipsEl = document.getElementById('focusModeCatChips');
  if(!grid) return;
  const isPremiumUser = !!(storeData.premium || (typeof isInTrial === 'function' && isInTrial()));
  function modeCardHtml(key){
    const m = FOCUS_MODES[key];
    if(!m) return '';
    const locked = !m.free && !isPremiumUser;
    return `<button type="button" class="focus-mode-card${locked ? ' feature-locked' : ''}" data-mode="${key}" data-locked="${locked ? '1' : '0'}">`
      + `<span class="fmc-icon-wrap" style="${focusModeColorStyle(m)}">${m.icon}</span>`
      + `<span class="fmc-label">${m.title.replace('حالت ','')}</span></button>`;
  }
  grid.innerHTML = FOCUS_MODE_CATEGORIES.map(cat=> `
    <div class="fm-category-block" data-cat="${cat.id}">
      <div class="fm-category-head">${cat.label}<span class="fm-category-count">(${toFa(cat.keys.length)})</span></div>
      <div class="focus-mode-grid">${cat.keys.map(modeCardHtml).join('')}</div>
    </div>`).join('');

  if(chipsEl){
    chipsEl.innerHTML = '<button type="button" class="fm-cat-chip'+(focusModeActiveCat==='all'?' active':'')+'" data-cat="all">همه</button>'
      + FOCUS_MODE_CATEGORIES.map(cat=> `<button type="button" class="fm-cat-chip${focusModeActiveCat===cat.id?' active':''}" data-cat="${cat.id}">${cat.label}</button>`).join('');
    chipsEl.querySelectorAll('.fm-cat-chip').forEach(chip=>{
      chip.addEventListener('click', ()=>{
        focusModeActiveCat = chip.dataset.cat;
        chipsEl.querySelectorAll('.fm-cat-chip').forEach(c=> c.classList.toggle('active', c===chip));
        grid.querySelectorAll('.fm-category-block').forEach(block=>{
          block.style.display = (focusModeActiveCat==='all' || block.dataset.cat===focusModeActiveCat) ? '' : 'none';
        });
      });
    });
    // Re-apply whatever filter was active before this re-render (e.g. after
    // unlocking premium) instead of always resetting back to "همه".
    if(focusModeActiveCat !== 'all'){
      grid.querySelectorAll('.fm-category-block').forEach(block=>{
        block.style.display = block.dataset.cat===focusModeActiveCat ? '' : 'none';
      });
    }
  }

  grid.querySelectorAll('.focus-mode-card').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(btn.dataset.locked === '1'){ requirePremium(); return; }
      startFocusMode(btn.dataset.mode);
    });
  });
}
renderFocusModeGrid();

function renderFocusChecklist(mode){
  const wrap = document.getElementById('focusChecklist');
  const items = FOCUS_MODES[mode].checklist;
  focusChecklistState = {};
  wrap.innerHTML = '';
  items.forEach((label, idx)=>{
    focusChecklistState[idx] = false;
    const row = document.createElement('div');
    row.className = 'item';
    row.innerHTML = `<div class="box">${CHECK_SVG}</div><span class="label">${label}</span>`;
    row.addEventListener('click', ()=>{
      focusChecklistState[idx] = !focusChecklistState[idx];
      row.classList.toggle('checked');
      if(focusChecklistState[idx]) sfxPop(); else sfxTap();
    });
    wrap.appendChild(row);
  });
}

function startFocusMode(mode){
  const m = FOCUS_MODES[mode];
  if(!m) return;
  if(!m.free && !requirePremium()) return;
  focusActiveMode = mode;
  document.getElementById('focusModeGrid').style.display = 'none';
  const catChipsEl = document.getElementById('focusModeCatChips');
  if(catChipsEl) catChipsEl.style.display = 'none';
  document.getElementById('focusSession').style.display = 'block';
  const colorStyle = focusModeColorStyle(m);
  document.getElementById('focusSessionIconBadge').setAttribute('style', colorStyle);
  document.getElementById('focusTimerCard').setAttribute('style', colorStyle);
  document.getElementById('focusSessionIcon').textContent = m.icon;
  document.getElementById('focusSessionTitle').textContent = m.title;
  document.getElementById('focusSessionSubtitle').textContent = m.subtitle || '';
  document.getElementById('focusTimerLabel').textContent = m.timerLabel || 'زمان تمرکز';
  document.getElementById('focusTipCard').textContent = m.tip;
  renderFocusChecklist(mode);
  focusSecondsElapsed = 0;
  document.getElementById('focusTimerDisplay').textContent = focusFormatTime(0);
  clearInterval(focusTimerInterval);
  focusTimerInterval = setInterval(()=>{
    focusSecondsElapsed++;
    document.getElementById('focusTimerDisplay').textContent = focusFormatTime(focusSecondsElapsed);
  }, 1000);
}

let focusPendingEnd = null; // {mode, minutes} — session waiting for a quality rating before being saved

function endFocusMode(){
  clearInterval(focusTimerInterval);
  focusTimerInterval = null;
  const mode = focusActiveMode;
  const minutes = Math.round(focusSecondsElapsed/60);
  focusActiveMode = null;
  document.getElementById('focusSession').style.display = 'none';
  document.getElementById('focusModeGrid').style.display = '';
  const catChipsEl2 = document.getElementById('focusModeCatChips');
  if(catChipsEl2) catChipsEl2.style.display = '';
  if(!mode) return;
  focusPendingEnd = { mode, minutes };
  const m = FOCUS_MODES[mode];
  const fqIcon = document.getElementById('fqIcon');
  if(fqIcon) fqIcon.textContent = m ? m.icon : '🎯';
  document.querySelectorAll('#fqStars .fq-star').forEach(b=> b.classList.remove('active'));
  const modal = document.getElementById('focusQualityModal');
  if(modal) modal.classList.add('visible');
  else finalizeFocusSession(null); // fallback in case the modal markup isn't present
}
document.getElementById('focusEndBtn').addEventListener('click', endFocusMode);

// Saves the just-finished session (count + minutes + optional quality rating) into
// storeData.focusSessions[mode], keeps a capped recent-session history so weekly-frequency
// checks (used for the identity badges below) can work, then refreshes progress/profile UI.
function finalizeFocusSession(quality){
  const pending = focusPendingEnd;
  focusPendingEnd = null;
  const modal = document.getElementById('focusQualityModal');
  if(modal) modal.classList.remove('visible');
  if(!pending) return;
  const { mode, minutes } = pending;
  if(!storeData.focusSessions) storeData.focusSessions = {};
  if(!storeData.focusSessions[mode]) storeData.focusSessions[mode] = {count:0, totalMinutes:0, qualitySum:0, qualityCount:0, history:[]};
  const fs = storeData.focusSessions[mode];
  fs.count = (fs.count||0) + 1;
  fs.totalMinutes = (fs.totalMinutes||0) + minutes;
  if(quality){ fs.qualitySum = (fs.qualitySum||0) + quality; fs.qualityCount = (fs.qualityCount||0) + 1; }
  if(!fs.history) fs.history = [];
  fs.history.push({ ts: Date.now(), minutes, quality: quality || null });
  if(fs.history.length > 60) fs.history = fs.history.slice(-60); // enough for weekly/monthly checks without growing forever
  saveData();
  const m = FOCUS_MODES[mode];
  showToast(m && m.endMessage ? m.endMessage(minutes) : 'حالت تمرکز پایان یافت');
  renderBadges();
  renderXP();
  if(typeof renderFocusStats === 'function') renderFocusStats();
}
document.querySelectorAll('#fqStars .fq-star').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('#fqStars .fq-star').forEach(b=>{
      b.classList.toggle('active', Number(b.dataset.q) <= Number(btn.dataset.q));
    });
    setTimeout(()=> finalizeFocusSession(Number(btn.dataset.q)), 140);
  });
});
const fqSkipBtn = document.getElementById('fqSkipBtn');
if(fqSkipBtn) fqSkipBtn.addEventListener('click', ()=> finalizeFocusSession(null));

// How many sessions of this mode happened in the last N days — powers the weekly-frequency
// identity badges (e.g. 3x/week of حالت باشگاه => «ورزشکار»).
function focusModeSessionsInDays(mode, days){
  const fs = (storeData.focusSessions||{})[mode];
  if(!fs || !fs.history || !fs.history.length) return 0;
  const cutoff = Date.now() - days*86400000;
  return fs.history.filter(h=> h.ts >= cutoff).length;
}
function focusModeAvgQuality(mode){
  const fs = (storeData.focusSessions||{})[mode];
  if(!fs || !fs.qualityCount) return 0;
  return fs.qualitySum / fs.qualityCount;
}
function focusStarsHtml(avg){
  const rounded = Math.round(avg);
  let s = '';
  for(let i=1;i<=5;i++) s += (i<=rounded ? '⭐' : '☆');
  return s;
}

/* Derived "identity" titles: use a mode regularly enough (checked via recent-session
   history above) and the app recognizes you as that kind of person, e.g. حالت باشگاه
   ۳ بار در هفته → «ورزشکار». These are plugged into the existing BADGES/XP system
   further down, right after BADGES is defined. */
const FOCUS_IDENTITIES = [
  {mode:'gym', id:'identity_athlete', emoji:'🏋️', title:'ورزشکار', weeklyNeeded:3},
  {mode:'painting', id:'identity_painter', emoji:'🎨', title:'نقاش', weeklyNeeded:2},
  {mode:'calligraphy', id:'identity_calligrapher', emoji:'🖋️', title:'خوشنویس', weeklyNeeded:2},
  {mode:'instrumentPractice', id:'identity_musician', emoji:'🎸', title:'نوازنده', weeklyNeeded:3},
  {mode:'freeStudy', id:'identity_scholar', emoji:'📖', title:'کتاب‌خوان', weeklyNeeded:3},
  {mode:'walk', id:'identity_walker', emoji:'🚶', title:'ورزشکار هوازی', weeklyNeeded:3},
  {mode:'cooking', id:'identity_chef', emoji:'🍳', title:'آشپز', weeklyNeeded:3},
  {mode:'morning', id:'identity_early_riser', emoji:'🌅', title:'صبح‌خیز', weeklyNeeded:5},
  {mode:'sleep', id:'identity_good_sleeper', emoji:'😴', title:'خوش‌خواب', weeklyNeeded:5},
  {mode:'football', id:'identity_footballer', emoji:'⚽', title:'فوتبالیست', weeklyNeeded:2},
  {mode:'pool', id:'identity_swimmer', emoji:'🏊', title:'شناگر', weeklyNeeded:2},
  {mode:'friendHangout', id:'identity_social', emoji:'🧑‍🤝‍🧑', title:'اجتماعی', weeklyNeeded:2},
  {mode:'coffeeshop', id:'identity_cafe_worker', emoji:'☕', title:'کافی‌نشین', weeklyNeeded:3},
  {mode:'editing', id:'identity_editor', emoji:'🎬', title:'تدوینگر', weeklyNeeded:3},
  {mode:'cleaning', id:'identity_tidy', emoji:'🧹', title:'مرتب', weeklyNeeded:2},
  {mode:'languageLearning', id:'identity_language_learner', emoji:'🗣️', title:'زبان‌آموز', weeklyNeeded:4},
  {mode:'movie', id:'identity_cinephile', emoji:'🍿', title:'فیلم باز', weeklyNeeded:2},
  {mode:'dance', id:'identity_dancer', emoji:'💃', title:'رقاص', weeklyNeeded:2},
  {mode:'worship', id:'identity_religious', emoji:'🤲', title:'مذهبی', weeklyNeeded:5},
  {mode:'gardening', id:'identity_gardener', emoji:'🌱', title:'باغبان', weeklyNeeded:2},
  {mode:'driving', id:'identity_cautious_driver', emoji:'🚗', title:'محتاط', weeklyNeeded:5},
  {mode:'daydream', id:'identity_dreamer', emoji:'💭', title:'رویاپرداز', weeklyNeeded:3},
  {mode:'sales', id:'identity_salesperson', emoji:'🤝', title:'فروشنده', weeklyNeeded:3},
  {mode:'familyTime', id:'identity_family_person', emoji:'👨‍👩‍👧‍👦', title:'خانواده‌دوست', weeklyNeeded:2},
  {mode:'photography', id:'identity_photographer', emoji:'📷', title:'عکاس', weeklyNeeded:2},
  {mode:'trading', id:'identity_disciplined_trader', emoji:'📈', title:'معامله‌گر منظم', weeklyNeeded:3},
  {mode:'farming', id:'identity_farmer', emoji:'🌾', title:'کشاورز', weeklyNeeded:2},
  {mode:'livestock', id:'identity_herder', emoji:'🐄', title:'دام‌دار', weeklyNeeded:2},
  {mode:'accounting', id:'identity_accountant', emoji:'🧮', title:'حسابدار', weeklyNeeded:3},
  {mode:'secretary', id:'identity_secretary', emoji:'🗂️', title:'منشی منظم', weeklyNeeded:3},
  {mode:'consulting', id:'identity_consultant', emoji:'💡', title:'مشاور', weeklyNeeded:2},
  {mode:'construction', id:'identity_builder', emoji:'👷', title:'کارگر ساختمان', weeklyNeeded:3},
  {mode:'programming', id:'identity_programmer', emoji:'💻', title:'برنامه‌نویس', weeklyNeeded:3},
  {mode:'writing', id:'identity_writer', emoji:'✍️', title:'نویسنده', weeklyNeeded:3},
  {mode:'sewing', id:'identity_tailor', emoji:'🧵', title:'خیاط', weeklyNeeded:2},
  {mode:'makeup', id:'identity_makeup_artist', emoji:'💄', title:'آرایشگر', weeklyNeeded:2},
  {mode:'marketing', id:'identity_marketer', emoji:'📣', title:'بازاریاب', weeklyNeeded:3},
  {mode:'voiceOver', id:'identity_narrator', emoji:'🎙️', title:'گوینده', weeklyNeeded:2},
  {mode:'singing', id:'identity_singer', emoji:'🎤', title:'خواننده', weeklyNeeded:2},
  {mode:'freelancing', id:'identity_freelancer', emoji:'🧑‍💻', title:'فریلنسر', weeklyNeeded:3},
  {mode:'massage', id:'identity_masseur', emoji:'💆', title:'ماساژور', weeklyNeeded:2},
];

// Per-mode usage cards for تب «پیشرفت»، و لیست عنوان‌های کسب‌شده برای تب «پروفایل».
// Combined totals across ALL focus modes together (not per-mode) — used for the
// summary card shown in both تب پیشرفت and تب پروفایل.
function totalFocusSessionsCount(){
  const sessions = storeData.focusSessions || {};
  return Object.values(sessions).reduce((sum, fs)=> sum + (fs && fs.count ? fs.count : 0), 0);
}
function totalFocusMinutes(){
  const sessions = storeData.focusSessions || {};
  return Object.values(sessions).reduce((sum, fs)=> sum + (fs && fs.totalMinutes ? fs.totalMinutes : 0), 0);
}
function formatFocusDuration(totalMinutes){
  const h = Math.floor(totalMinutes/60), m = totalMinutes%60;
  if(h<=0) return toFa(m)+' دقیقه';
  if(m<=0) return toFa(h)+' ساعت';
  return toFa(h)+' ساعت و '+toFa(m)+' دقیقه';
}
function renderFocusStats(){
  const grid = document.getElementById('focusStatsGrid');
  const list = document.getElementById('profileIdentityList');
  const totalCard = document.getElementById('focusTotalCard');
  const profileTotalCard = document.getElementById('profileFocusTotalCard');
  const sessions = storeData.focusSessions || {};
  const usedModes = Object.keys(sessions).filter(k => sessions[k] && sessions[k].count > 0 && FOCUS_MODES[k]);

  const totalCount = totalFocusSessionsCount();
  const totalMinutes = totalFocusMinutes();
  const totalHtml = `
    <div style="text-align:center;flex:1;"><div class="ftl-num">${toFa(totalCount)}</div><div class="ftl-label">مجموع جلسه‌ها</div></div>
    <div class="ftl-div"></div>
    <div style="text-align:center;flex:1;"><div class="ftl-num">${formatFocusDuration(totalMinutes)}</div><div class="ftl-label">مجموع زمان تمرکز</div></div>
  `;
  if(totalCard) totalCard.innerHTML = totalHtml;
  if(profileTotalCard) profileTotalCard.innerHTML = totalHtml;

  if(grid){
    if(!usedModes.length){
      grid.innerHTML = '<div style="padding:0 14px;font-size:11.5px;color:var(--muted);line-height:1.8;">هنوز از هیچ‌کدوم از حالت‌های تب «حالت» استفاده نکردی.</div>';
    } else {
      grid.innerHTML = usedModes.map(key=>{
        const m = FOCUS_MODES[key];
        const fs = sessions[key];
        const avg = focusModeAvgQuality(key);
        const ident = FOCUS_IDENTITIES.find(f=> f.mode === key);
        const unlocked = ident && storeData.badges && storeData.badges[ident.id];
        return `<div class="focus-stat-card">
            <div class="fsc-top"><span class="fsc-icon">${m.icon}</span><span class="fsc-title">${m.title.replace('حالت ','')}</span>${unlocked ? `<span class="fsc-identity">${ident.emoji} ${ident.title}</span>` : ''}</div>
            <div class="fsc-row"><span>تعداد جلسه</span><span>${toFa(fs.count||0)}</span></div>
            <div class="fsc-row"><span>مجموع زمان</span><span>${toFa(fs.totalMinutes||0)} دقیقه</span></div>
            ${fs.qualityCount ? `<div class="fsc-row"><span>میانگین کیفیت</span><span>${focusStarsHtml(avg)}</span></div>` : ''}
          </div>`;
      }).join('');
    }
  }
  if(list){
    const earned = FOCUS_IDENTITIES.filter(f=> storeData.badges && storeData.badges[f.id]);
    list.innerHTML = earned.length
      ? earned.map(f=> `<span class="identity-chip">${f.emoji} ${f.title}</span>`).join('')
      : '<div style="padding:0 14px;font-size:11px;color:var(--muted);line-height:1.8;">هنوز عنوانی کسب نکردی؛ با استفاده‌ی منظم از حالت‌ها (مثلاً چند بار در هفته) عنوان‌هایی مثل «ورزشکار» یا «نقاش» باز می‌شن.</div>';
  }
}

/* ================= Speech tab (فن بیان) ================= */
function faDigits(v){ return String(v).replace(/[0-9]/g, d=>'۰۱۲۳۴۵۶۷۸۹'[d]); }

/* ---- Emotion shuffle card ---- */
const SPEECH_EMOTIONS = [
  {emoji:'😊', name:'شاد', color:'#ffb347'},
  {emoji:'😠', name:'عصبانی', color:'#e2665a'},
  {emoji:'😢', name:'غمگین', color:'#5b8def'},
  {emoji:'😲', name:'هیجان‌زده', color:'#f0b429'},
  {emoji:'😨', name:'ترسیده', color:'#8e6fce'},
  {emoji:'😌', name:'آرام', color:'#3fb87f'}
];
const SPEECH_NEUTRAL_SENTENCES = [
  'فردا صبح ساعت هفت باید بیدار بشم و قبل از رفتن به سر کار، یه سر به بانک بزنم.',
  'این کتاب رو هفته‌ی پیش از کتابخونه‌ی محل امانت گرفتم و هنوز حتی نصفشم نخوندم.',
  'هوا از دیروز تا امروز خیلی تغییر کرده و انگار قراره تا آخر هفته همین‌جوری بمونه.',
  'قرار بود ساعت پنج برسه، اما به‌خاطر ترافیک سنگین نیم ساعت دیرتر رسید.',
  'غذا رو گذاشتم روی میز و منتظر موندم تا بقیه هم بیان و با هم شام بخوریم.',
  'فردا یه جلسه‌ی مهم داریم که قراره درباره‌ی برنامه‌ی سه‌ماه آینده تصمیم بگیریم.',
  'ماشین رو صبح بردم تعمیرگاه، چون چند روزی بود یه صدای عجیب می‌داد.',
  'این خبر رو همین الان از یکی از همکارام شنیدم و هنوز مطمئن نیستم درست باشه یا نه.',
  'کلید خونه رو یه‌جایی گم کردم و الان دارم تو کل خونه دنبالش می‌گردم.',
  'چمدون‌ها آماده‌ست، فقط منتظریم تاکسی برسه تا حرکت کنیم سمت فرودگاه.',
  'برق محله از دیشب یک ساعتی قطع بود و همین باعث شد یخچال خاموش بشه.',
  'نتیجه‌ی آزمایش امروز عصر رسید و قراره فردا با دکتر درباره‌ش صحبت کنیم.',
  'اتوبوس امروز پنج دقیقه دیرتر از همیشه سر خط رسید و همه منتظر بودن.',
  'دیروز بعد از ظهر رفتم بازار و چندتا چیز برای خونه خریدم.',
  'همسایه‌ی طبقه‌ی بالا گفت که آخر هفته می‌خوان یه مهمونی کوچیک بگیرن.',
  'گوشیم از صبح شارژش تموم شده و هنوز فرصت نکردم بزنمش به شارژر.',
  'قرار بود این هفته بارون بیاد، ولی هوا همچنان آفتابیه.',
  'دیروز یه ایمیل از شرکت قبلیم گرفتم که درباره‌ی یه پروژه‌ی مشترک بود.',
  'بلیط قطار رو دو هفته پیش رزرو کردم و امروز قراره بگیرمش.',
  'کتابخونه‌ی جدید محله هفته‌ی بعد رسماً باز می‌شه و یه افتتاحیه هم داره.',
  'دیشب تا دیر وقت بیدار بودم، چون داشتم یه سریال قدیمی رو تموم می‌کردم.',
  'فردا باید سند خونه رو ببرم دفترخونه تا کارهای اداریش تموم بشه.',
  'ماه پیش یه دوره‌ی آنلاین ثبت‌نام کردم که هفته‌ی دیگه شروع می‌شه.',
  'صبح زود از خواب بیدار شدم، چون صدای بارون روی پنجره میومد.',
  'این هفته قراره یه گروه جدید تو محل کارمون برای یه پروژه تشکیل بشه.',
  'دیروز عصر رفتم پارک و یه ساعتی همون‌جا نشستم و کتاب خوندم.',
  'یکی از همکلاسی‌های قدیمیم بعد از چند سال باهام تماس گرفت.',
  'فردا قراره یه بازدید کوتاه از دفتر جدید شرکت داشته باشیم.',
  'این آخر هفته می‌خوایم بریم یه شهر نزدیک که تا حالا ندیدیمش.',
  'صبح وقتی از خواب بیدار شدم، دیدم برف سنگینی روی حیاط نشسته.',
  'دیروز یه بسته برام رسید که چند هفته پیش سفارش داده بودم.',
  'این ماه قراره قبض‌های برق و آب رو زودتر از همیشه پرداخت کنم.',
  'هفته‌ی پیش یه دستگاه جدید برای آشپزخونه خریدم که هنوز امتحانش نکردم.',
  'دیشب یه فیلم مستند دیدم درباره‌ی یه شهر قدیمی که هیچ‌وقت نرفتم اونجا.',
  'صبح زود یه پیام از یکی از دوستام رسید که خبر از یه سفر ناگهانی می‌داد.'
];
let lastCardSentenceIdx = -1;
let lastCardEmotionIdx = -1;
const shuffleCardBtn = document.getElementById('shuffleCardBtn');
if(shuffleCardBtn){
  shuffleCardBtn.addEventListener('click', ()=>{
    sfxWhoosh();
    const cardInner = document.getElementById('emotionCardInner');
    shuffleCardBtn.disabled = true;
    shuffleCardBtn.style.opacity = '.6';
    cardInner.classList.remove('is-flipped');
    cardInner.classList.remove('is-shuffling');
    void cardInner.offsetWidth; /* restart shuffle animation */
    cardInner.classList.add('is-shuffling');
    setTimeout(()=>{
      let idx = Math.floor(Math.random()*SPEECH_EMOTIONS.length);
      if(SPEECH_EMOTIONS.length > 1 && idx === lastCardEmotionIdx){
        idx = (idx + 1) % SPEECH_EMOTIONS.length;
      }
      lastCardEmotionIdx = idx;
      const em = SPEECH_EMOTIONS[idx];
      let sIdx = Math.floor(Math.random()*SPEECH_NEUTRAL_SENTENCES.length);
      if(SPEECH_NEUTRAL_SENTENCES.length > 1 && sIdx === lastCardSentenceIdx){
        sIdx = (sIdx + 1) % SPEECH_NEUTRAL_SENTENCES.length;
      }
      lastCardSentenceIdx = sIdx;
      const sentence = SPEECH_NEUTRAL_SENTENCES[sIdx];
      document.getElementById('cardResultEmotion').textContent = em.emoji + ' با لحن ' + em.name + ' بگو:';
      document.getElementById('cardResultSentence').textContent = sentence;
      sfxPop();
      cardInner.classList.remove('is-shuffling');
      cardInner.classList.add('is-flipped');
      shuffleCardBtn.disabled = false;
      shuffleCardBtn.style.opacity = '1';
    }, 550);
  });
}

/* ---- Impromptu speaking ---- */
const SPEECH_IMPROMPTU_TOPICS = [
  'بهترین سفری که تا حالا رفتی',
  'یه عادت که دوست داری عوض کنی',
  'اگه یه ابرقدرت داشتی چی می‌خواستی باشه',
  'یه خاطره‌ی خنده‌دار از دوران مدرسه',
  'شهری که دوست داری توش زندگی کنی',
  'یه کتاب یا فیلم که رو تو تأثیر گذاشته',
  'اگه یه روز وقت آزاد کامل داشتی چیکار می‌کردی',
  'یه مهارت که این روزها داری یاد می‌گیری',
  'غذایی که هیچ‌وقت خسته نمی‌شی بخوریش',
  'یه نصیحت که به خودِ ده‌سال‌پیشت می‌کردی',
  'برنامه‌ی یه روز تعطیلات ایده‌آل',
  'چیزی که امسال یاد گرفتی',
  'یه صنعت یا فناوری که فکر می‌کنی آینده داره',
  'یه خاطره از دوستی صمیمی',
  'اگه می‌تونستی یه قانون جدید بذاری چی بود',
  'یه چیز کوچیک که هر روز حالت رو بهتر می‌کنه'
];
let speechImpromptuTimer = null;
const impromptuNewBtn = document.getElementById('impromptuNewBtn');
const impromptuStartBtn = document.getElementById('impromptuStartBtn');
if(impromptuNewBtn){
  impromptuNewBtn.addEventListener('click', ()=>{
    clearInterval(speechImpromptuTimer);
    const topic = SPEECH_IMPROMPTU_TOPICS[Math.floor(Math.random()*SPEECH_IMPROMPTU_TOPICS.length)];
    document.getElementById('impromptuTopic').textContent = topic;
    document.getElementById('impromptuTimerWrap').style.display = 'none';
    document.getElementById('impromptuBarFill').style.width = '0%';
    document.getElementById('impromptuTimer').textContent = '۰۱:۰۰';
    impromptuStartBtn.style.display = 'block';
    impromptuStartBtn.disabled = false;
    impromptuStartBtn.textContent = '▶️ شروع ۶۰ ثانیه';
  });
}
if(impromptuStartBtn){
  impromptuStartBtn.addEventListener('click', ()=>{
    const total = 60;
    let remaining = total;
    document.getElementById('impromptuTimerWrap').style.display = 'block';
    impromptuStartBtn.disabled = true;
    impromptuStartBtn.textContent = '🎙️ در حال حرف‌زدنه...';
    const fill = document.getElementById('impromptuBarFill');
    const timerEl = document.getElementById('impromptuTimer');
    function render(){
      const m = String(Math.floor(remaining/60)).padStart(2,'0');
      const s = String(remaining%60).padStart(2,'0');
      timerEl.textContent = faDigits(m+':'+s);
      fill.style.width = ((total-remaining)/total*100) + '%';
    }
    render();
    clearInterval(speechImpromptuTimer);
    speechImpromptuTimer = setInterval(()=>{
      remaining--;
      if(remaining <= 0){
        remaining = 0;
        render();
        clearInterval(speechImpromptuTimer);
        timerEl.textContent = '✅ آفرین، تموم شد!';
        impromptuStartBtn.disabled = false;
        impromptuStartBtn.textContent = '▶️ شروع ۶۰ ثانیه';
      } else {
        render();
      }
    }, 1000);
  });
}

/* ---- Story building (unrelated words) ---- */
const STORY_WORD_POOL = ['فضانورد','شیر','گاو','فیل','زرافه','پنگوئن','کانگورو','روباه','گرگ','لاک‌پشت','کرگدن','اسب','میمون','عقاب','جغد','کلاغ','ماهی','هشت‌پا','نهنگ','دلفین','زنبور','پروانه','عنکبوت','مورچه','چتر','ساعت','عینک','کفش','کلید','آینه','صندوق','چمدان','شمع','مداد','کتاب','نقشه','بادکنک','گیتار','طبل','تلسکوپ','فانوس','قایق','دوچرخه','قطار','هواپیما','موشک','ربات','دریا','کوه','جنگل','رودخانه','آتشفشان','غار','جزیره','صحرا','رنگین‌کمان','ستاره','ماه','ابر','طوفان','برف','باران','آتش','صخره','اژدها','جن','پری','غول','جادوگر','گنج','تاج','شمشیر','سپر','قصر','یونیکورن','هندوانه','نان','عسل','پنیر','سیب','انار','فلفل','دلقک','ماهیگیر','نجار','خلبان','نگهبان','نوازنده','پنجره','در','چراغ','صندلی','میز','یخچال','تخت','توپ','عروسک','ساز','قفس','نردبان','پل'];
let speechStoryCount = 3;
let speechStoryTimer = null;
const storyCountSeg = document.getElementById('storyCountSeg');
if(storyCountSeg){
  storyCountSeg.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      storyCountSeg.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      speechStoryCount = parseInt(btn.dataset.count, 10);
    });
  });
}
const storyNewBtn = document.getElementById('storyNewBtn');
const storyStartBtn = document.getElementById('storyStartBtn');
if(storyNewBtn){
  storyNewBtn.addEventListener('click', ()=>{
    clearInterval(speechStoryTimer);
    const pool = STORY_WORD_POOL.slice();
    const picked = [];
    for(let i=0; i<speechStoryCount && pool.length; i++){
      const idx = Math.floor(Math.random()*pool.length);
      picked.push(pool.splice(idx,1)[0]);
    }
    document.getElementById('storyWords').innerHTML = picked.map(w=>`<div class="story-word-chip">${w}</div>`).join('');
    document.getElementById('storyTimerWrap').style.display = 'none';
    document.getElementById('storyBarFill').style.width = '0%';
    document.getElementById('storyTimer').textContent = '۰۱:۳۰';
    storyStartBtn.style.display = 'block';
    storyStartBtn.disabled = false;
    storyStartBtn.textContent = '▶️ شروع داستان';
  });
}
if(storyStartBtn){
  storyStartBtn.addEventListener('click', ()=>{
    const total = 90;
    let remaining = total;
    document.getElementById('storyTimerWrap').style.display = 'block';
    storyStartBtn.disabled = true;
    storyStartBtn.textContent = '📖 در حال داستان‌گفتنه...';
    const fill = document.getElementById('storyBarFill');
    const timerEl = document.getElementById('storyTimer');
    function render(){
      const m = String(Math.floor(remaining/60)).padStart(2,'0');
      const s = String(remaining%60).padStart(2,'0');
      timerEl.textContent = faDigits(m+':'+s);
      fill.style.width = ((total-remaining)/total*100) + '%';
    }
    render();
    clearInterval(speechStoryTimer);
    speechStoryTimer = setInterval(()=>{
      remaining--;
      if(remaining <= 0){
        remaining = 0;
        render();
        clearInterval(speechStoryTimer);
        timerEl.textContent = '✅ آفرین، داستانت تموم شد!';
        storyStartBtn.disabled = false;
        storyStartBtn.textContent = '▶️ شروع داستان';
      } else {
        render();
      }
    }, 1000);
  });
}
const SPEECH_WARMUP_CONSONANTS = ['ب','پ','ت','ث','ج','چ','ح','خ','د','ذ','ر','ز','ژ','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ک','گ','ل','م','ن','و','ه','ی'];
function buildWarmupLines(c){
  const combos = [c+'\u064E', c+'\u0650', c+'\u064F', c+'ا', c+'ی', c+'و'];
  return combos.map(u => Array(4).fill(u).join('   '));
}
let speechWarmupIdx = 0;
function renderWarmup(){
  const c = SPEECH_WARMUP_CONSONANTS[speechWarmupIdx];
  const lines = buildWarmupLines(c);
  document.getElementById('warmupLines').innerHTML = lines.map(l=>`<div class="warmup-line">${l}</div>`).join('');
  document.getElementById('warmupProgress').textContent = faDigits(speechWarmupIdx+1) + ' / ' + faDigits(SPEECH_WARMUP_CONSONANTS.length);
  document.getElementById('warmupPrevBtn').disabled = speechWarmupIdx === 0;
  document.getElementById('warmupPrevBtn').style.opacity = speechWarmupIdx === 0 ? '.5' : '1';
  document.getElementById('warmupNextBtn').textContent = speechWarmupIdx === SPEECH_WARMUP_CONSONANTS.length-1 ? '🔁 از اول' : 'بعدی ▶';
}
const warmupNextBtn = document.getElementById('warmupNextBtn');
const warmupPrevBtn = document.getElementById('warmupPrevBtn');
if(warmupNextBtn){
  warmupNextBtn.addEventListener('click', ()=>{
    speechWarmupIdx = (speechWarmupIdx === SPEECH_WARMUP_CONSONANTS.length-1) ? 0 : speechWarmupIdx+1;
    renderWarmup();
  });
}
if(warmupPrevBtn){
  warmupPrevBtn.addEventListener('click', ()=>{
    if(speechWarmupIdx > 0){ speechWarmupIdx--; renderWarmup(); }
  });
}
renderWarmup();

/* ---- Word branch game (شاخه‌ی کلمات) ---- */
let wtTree = null;
let wtQueue = [];
let wtCurrentNode = null;
let wtExpandedCount = 0;
const WT_TOTAL_EXPANSIONS = 13; /* 1 (root) + 3 (level1) + 9 (level2) */

function wtPickRootWord(){
  return STORY_WORD_POOL[Math.floor(Math.random()*STORY_WORD_POOL.length)];
}

function wtLevelLabel(depth){
  if(depth === 0) return 'دور ۱ از ۳ — کلمه‌ی ریشه';
  if(depth === 1) return 'دور ۲ از ۳ — کلمه‌های شاخه‌ها';
  return 'دور ۳ از ۳ — کلمه‌های آخر';
}

function wtRenderNode(node){
  const isCurrent = (node === wtCurrentNode);
  let html = '<div class="wt-node">';
  html += '<span class="wt-word-chip wt-depth-'+node.depth+(isCurrent?' wt-current':'')+'">'+escapeHtml(node.word)+'</span>';
  if(node.children && node.children.length){
    html += '<div class="wt-children">' + node.children.map(wtRenderNode).join('') + '</div>';
  }
  html += '</div>';
  return html;
}

function wtRenderTreeLive(){
  const wrap = document.getElementById('wtTreeLive');
  if(wrap && wtTree) wrap.innerHTML = wtRenderNode(wtTree);
}

function wtNextPrompt(){
  if(wtQueue.length === 0){
    wtFinish();
    return;
  }
  wtCurrentNode = wtQueue.shift();
  document.getElementById('wtPromptWord').textContent = wtCurrentNode.word;
  document.getElementById('wtProgressLabel').textContent =
    wtLevelLabel(wtCurrentNode.depth) + ' (' + faDigits(wtExpandedCount+1) + '/' + faDigits(WT_TOTAL_EXPANSIONS) + ')';
  document.getElementById('wtProgressFill').style.width = (wtExpandedCount/WT_TOTAL_EXPANSIONS*100) + '%';
  const inputsWrap = document.getElementById('wtInputs');
  inputsWrap.innerHTML = '';
  for(let i=0;i<3;i++){
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'wt-word-input';
    inp.placeholder = 'کلمه‌ی ' + faDigits(i+1);
    inputsWrap.appendChild(inp);
  }
  const firstInput = inputsWrap.querySelector('input');
  if(firstInput) setTimeout(()=>firstInput.focus(), 50);
  wtRenderTreeLive();
}

function wtStart(){
  const rootWord = wtPickRootWord();
  wtTree = {word: rootWord, depth: 0, children: []};
  wtQueue = [wtTree];
  wtCurrentNode = null;
  wtExpandedCount = 0;
  document.getElementById('wtIdle').style.display = 'none';
  document.getElementById('wtDone').style.display = 'none';
  document.getElementById('wtActive').style.display = 'block';
  document.getElementById('wtStartBtn').style.display = 'none';
  sfxWhoosh();
  wtNextPrompt();
}

function wtSubmit(){
  const inputs = document.querySelectorAll('#wtInputs .wt-word-input');
  const words = [];
  let hasEmpty = false;
  inputs.forEach(inp=>{
    const v = inp.value.trim();
    if(!v) hasEmpty = true;
    words.push(v);
  });
  if(hasEmpty){
    sfxError();
    inputs.forEach(inp=>{ if(!inp.value.trim()) inp.classList.add('wt-input-error'); });
    return;
  }
  sfxPop();
  words.forEach(w=>{
    const child = {word: w, depth: wtCurrentNode.depth+1, children: []};
    wtCurrentNode.children.push(child);
    if(child.depth < 3) wtQueue.push(child);
  });
  wtExpandedCount++;
  wtNextPrompt();
}

function wtFinish(){
  sfxSuccess();
  if(typeof launchConfetti === 'function') launchConfetti();
  document.getElementById('wtActive').style.display = 'none';
  document.getElementById('wtDone').style.display = 'block';
  document.getElementById('wtTreeView').innerHTML = wtRenderNode(wtTree);
  const startBtn = document.getElementById('wtStartBtn');
  startBtn.style.display = 'block';
  startBtn.textContent = '🎲 یه دور جدید بساز';
}

const wtStartBtn = document.getElementById('wtStartBtn');
if(wtStartBtn) wtStartBtn.addEventListener('click', wtStart);
const wtSubmitBtn = document.getElementById('wtSubmitBtn');
if(wtSubmitBtn) wtSubmitBtn.addEventListener('click', wtSubmit);
const wtResetBtn = document.getElementById('wtResetBtn');
if(wtResetBtn) wtResetBtn.addEventListener('click', wtStart);
const wtInputsWrap = document.getElementById('wtInputs');
if(wtInputsWrap){
  wtInputsWrap.addEventListener('input', (e)=>{
    if(e.target.classList && e.target.classList.contains('wt-word-input')) e.target.classList.remove('wt-input-error');
  });
  wtInputsWrap.addEventListener('keydown', (e)=>{
    if(e.key !== 'Enter') return;
    e.preventDefault();
    const inputs = Array.from(document.querySelectorAll('#wtInputs .wt-word-input'));
    const idx = inputs.indexOf(e.target);
    if(idx > -1 && idx < inputs.length-1){ inputs[idx+1].focus(); }
    else { wtSubmit(); }
  });
}

/* ================= Public chat moderation: block + abuse filter ================= */
function getBlockedChatUsers(){
  try{ return JSON.parse(localStorage.getItem('checklistApp:blockedChatUsers') || '[]'); }
  catch(err){ return []; }
}
function setBlockedChatUsers(list){
  try{ localStorage.setItem('checklistApp:blockedChatUsers', JSON.stringify(list)); }catch(err){}
}
function isChatUserBlocked(id){
  return getBlockedChatUsers().some(u=>u.id===id);
}
function blockChatUser(id, username){
  if(publicChatUser && id === publicChatUser.id) return;
  if(!confirm(`${username} رو مسدود کنی؟ پیام‌هاش دیگه برات نمایش داده نمی‌شه.`)) return;
  const list = getBlockedChatUsers();
  if(!list.some(u=>u.id===id)) list.push({id, username});
  setBlockedChatUsers(list);
  document.querySelectorAll(`.chat-msg[data-user-id="${id}"]`).forEach(el=>el.remove());
  document.querySelectorAll('#chatMessages .cm-group').forEach(g=>{ if(!g.querySelector('.chat-msg')) g.remove(); });
  const wrap = document.getElementById('chatMessages');
  if(wrap && !wrap.querySelector('.chat-msg')) wrap.innerHTML = '<div class="chat-empty-msg">هنوز پیامی نیست، اولین نفر باش!</div>';
  renderBlockedUsersSettings();
  showToast('مسدود شد');
}
function unblockChatUser(id){
  setBlockedChatUsers(getBlockedChatUsers().filter(u=>u.id!==id));
  renderBlockedUsersSettings();
  if(typeof loadPublicChatMessages === 'function') loadPublicChatMessages();
  showToast('رفع مسدودیت شد');
}
function renderBlockedUsersSettings(){
  const section = document.getElementById('blockedUsersSection');
  const list = document.getElementById('blockedUsersList');
  if(!section || !list) return;
  const blocked = getBlockedChatUsers();
  if(blocked.length===0){ section.style.display='none'; return; }
  section.style.display='block';
  list.innerHTML = blocked.map(u=>`
    <div class="blocked-user-row">
      <span>${escapeHtml(displayName(u.username))}</span>
      <span class="cm-action" data-unblock-id="${u.id}" style="cursor:pointer;color:var(--accent);">رفع مسدودیت</span>
    </div>`).join('');
  list.querySelectorAll('[data-unblock-id]').forEach(btn=>{
    btn.addEventListener('click', ()=> unblockChatUser(btn.dataset.unblockId));
  });
}
renderBlockedUsersSettings();

const ABUSIVE_CHAT_PATTERNS = [
  /کس[کث]ش/i, /جنده/i, /حروم[زذ]اده/i, /کیرم/i, /عوضی/i
];
function containsAbusiveLanguage(text){
  return ABUSIVE_CHAT_PATTERNS.some(rx=>rx.test(text));
}

/* ================= Privacy policy + account deletion ================= */
document.getElementById('privacyPolicyBtn').addEventListener('click', ()=>{
  document.getElementById('privacyOverlay').classList.add('show');
});
document.getElementById('privacyCloseBtn').addEventListener('click', ()=>{
  document.getElementById('privacyOverlay').classList.remove('show');
});
document.getElementById('privacyOverlay').addEventListener('click', (e)=>{
  if(e.target.id === 'privacyOverlay') document.getElementById('privacyOverlay').classList.remove('show');
});
document.getElementById('chatRulesBtn').addEventListener('click', ()=>{
  document.getElementById('chatRulesOverlay').classList.add('show');
});
document.getElementById('chatRulesCloseBtn').addEventListener('click', ()=>{
  document.getElementById('chatRulesOverlay').classList.remove('show');
});
document.getElementById('chatRulesOverlay').addEventListener('click', (e)=>{
  if(e.target.id === 'chatRulesOverlay') document.getElementById('chatRulesOverlay').classList.remove('show');
});

/* ================= Special day (روز خاص) overlay ================= */
document.getElementById('specialDayCloseBtn').addEventListener('click', closeSpecialDayOverlay);
document.getElementById('specialDayOverlay').addEventListener('click', (e)=>{
  if(e.target.id === 'specialDayOverlay') closeSpecialDayOverlay();
});
document.getElementById('specialDaySubmitBtn').addEventListener('click', ()=>{
  const reason = document.getElementById('specialDayReasonInput').value.trim();
  const daysRaw = document.getElementById('specialDayDaysInput').value;
  const days = parseInt(daysRaw, 10);
  if(!reason){ showToast('اول دلیلشو بنویس', 'error'); return; }
  if(!days || days < 1){ showToast('تعداد روزها رو درست وارد کن', 'error'); return; }
  const clampedDays = Math.min(days, 30);
  if(!storeData.specialDays) storeData.specialDays = [];
  storeData.specialDays.push({
    reason,
    days: clampedDays,
    startDate: today,
    endDate: addDaysToKey(today, clampedDays - 1),
    createdAt: new Date().toISOString()
  });
  entry.total = totalToday();
  saveData();
  closeSpecialDayOverlay();
  render();
  showToast('باشه، برنامه‌ت سبک‌تر شد 🌤️', 'success');
});

document.getElementById('deleteAccountBtn').addEventListener('click', async ()=>{
  if(!sb) return;
  if(!confirm('مطمئنی می‌خوای حساب و همه‌ی اطلاعاتت رو برای همیشه پاک کنی؟ این کار برگشت‌ناپذیره.')) return;
  if(!confirm('این آخرین تاییده. با تایید، حسابت همین الان حذف میشه.')) return;
  try{
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
    if(!token){ showToast('اول باید وارد اکانتت باشی', 'error'); return; }
    const res = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const result = await res.json().catch(()=>({}));
    if(!res.ok || !result.ok){ showToast(result.error || 'حذف حساب انجام نشد، دوباره امتحان کن', 'error'); return; }
    await sb.auth.signOut();
    showToast('حسابت با موفقیت حذف شد', 'success');
    setTimeout(()=>{ location.reload(); }, 1200);
  }catch(err){ showToast('مشکلی پیش اومد، دوباره امتحان کن', 'error'); }
});

/* ================= Collapsible sections (today tab + guide tab) ================= */
document.addEventListener('click', (e)=>{
  const head = e.target.closest('.section-head.collapsible');
  if(!head) return;
  head.classList.toggle('open');
  const body = document.getElementById(head.dataset.target);
  if(body) body.classList.toggle('open');
});

/* ================= Sub-tab navigation within tabs (today / workout / library) ================= */
document.querySelectorAll('.subseg').forEach(seg=>{
  const panel = seg.closest('.tab-panel');
  if(!panel) return;
  seg.querySelectorAll('button[data-sub]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const sub = btn.dataset.sub;
      if(panel.id === 'tab-meditation' && (sub === 'bodyscan' || sub === 'gratitude' || sub === 'voidmind') && !requirePremium()) return;
      if(panel.id === 'tab-today' && sub === 'tomorrow' && !requirePremium()) return;
      seg.querySelectorAll('button[data-sub]').forEach(b=>b.classList.remove('active'));
      panel.querySelectorAll('.sub-panel').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      const target = panel.querySelector('.sub-panel[data-sub="'+btn.dataset.sub+'"]');
      if(target) target.classList.add('active');
      if(panel.id === 'tab-today' && btn.dataset.sub === 'program') maybeSuggestTodayNarration();
      if(panel.id === 'tab-today' && btn.dataset.sub === 'tomorrow') renderTomorrowTab();
      if(panel.id === 'tab-workout' && btn.dataset.sub === 'history') renderWoHistory();
      if(panel.id === 'tab-meditation'){
        stopMeditation();
        stopBodyScan();
        stopGratitude();
        stopVoidMind();
      }
    });
  });
});

/* ================= Library: scientific research search (Semantic Scholar + MyMemory) =================
   Semantic Scholar: free, no key, and its `tldr` field already gives a ready-made one-line AI
   summary for a lot of papers — so we get search AND summarization for free, not just search.
   MyMemory: free, no key, CORS-enabled translation to Persian, called directly from the user's
   own phone (not our server) — so its daily quota is per-user/per-IP, never a shared bottleneck. */
const researchSearchInput = document.getElementById('researchSearchInput');
const researchSearchBtn = document.getElementById('researchSearchBtn');
const researchResultsWrap = document.getElementById('researchResultsWrap');

// MyMemory's free tier is ~500 chars per single call, so we trim to a safe length,
// cutting at a sentence boundary where possible instead of mid-sentence.
function trimForTranslate(text, max){
  if(!text) return '';
  text = text.trim();
  if(text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastDot = cut.lastIndexOf('. ');
  return (lastDot > max * 0.5 ? cut.slice(0, lastDot + 1) : cut) + '…';
}

async function translateToFa(text){
  const trimmed = trimForTranslate(text, 480);
  if(!trimmed) return '';
  try{
    const res = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(trimmed) + '&langpair=en|fa');
    if(!res.ok) throw new Error('translate-http');
    const data = await res.json();
    const out = data && data.responseData && data.responseData.translatedText;
    if(!out || /INVALID|MYMEMORY WARNING|NO QUERY/i.test(out)) throw new Error('translate-bad');
    return out;
  }catch(e){
    return null; // caller falls back to showing the original English text
  }
}

async function runResearchSearch(){
  const q = (researchSearchInput.value || '').trim();
  if(!q){ showToast('اول یه موضوع بنویس', 'error'); return; }
  researchSearchBtn.disabled = true;
  researchSearchInput.disabled = true;
  const prevLabel = researchSearchBtn.textContent;
  researchSearchBtn.textContent = '...';
  researchResultsWrap.innerHTML = '<div class="lib-research-loading">🔎 در حال جستجوی مقاله‌ها...</div>';
  try{
    const searchUrl = 'https://api.semanticscholar.org/graph/v1/paper/search?query=' + encodeURIComponent(q) +
      '&fields=title,abstract,tldr,year,authors,venue,url,citationCount&limit=8';
    const res = await fetch(searchUrl);
    if(!res.ok) throw new Error('search-http');
    const data = await res.json();
    const papers = (data && Array.isArray(data.data)) ? data.data.filter(p => p && p.title) : [];
    if(!papers.length){
      researchResultsWrap.innerHTML = '<div class="sub-panel-empty"><span class="spe-ic">🔬</span>چیزی برای این موضوع پیدا نشد؛ یه عبارت دیگه امتحان کن.</div>';
      return;
    }
    researchResultsWrap.innerHTML = '<div class="lib-research-loading">📝 در حال ترجمه‌ی خلاصه‌ها...</div>';
    const cards = [];
    for(const p of papers){
      const summarySrc = (p.tldr && p.tldr.text) ? p.tldr.text : (p.abstract || '');
      const [titleFa, summaryFa] = await Promise.all([
        translateToFa(p.title),
        summarySrc ? translateToFa(summarySrc) : Promise.resolve('')
      ]);
      const authors = (p.authors || []).slice(0, 3).map(a => a.name).join('، ') +
        ((p.authors || []).length > 3 ? ' و دیگران' : '');
      cards.push({
        titleFa: titleFa || p.title,
        summaryFa: summaryFa,
        summaryEn: summarySrc,
        year: p.year, venue: p.venue, citationCount: p.citationCount,
        authors, url: p.url
      });
    }
    researchResultsWrap.innerHTML = cards.map(c=>{
      const metaBits = [];
      if(c.year) metaBits.push('<span>' + escapeHtml(c.year) + '</span>');
      if(c.citationCount != null) metaBits.push('<span>' + escapeHtml(c.citationCount) + ' ارجاع</span>');
      let summaryHtml;
      if(c.summaryFa) summaryHtml = escapeHtml(c.summaryFa);
      else if(c.summaryEn) summaryHtml = '(ترجمه انجام نشد) ' + escapeHtml(c.summaryEn);
      else summaryHtml = 'خلاصه‌ای برای این مقاله ثبت نشده.';
      return '<div class="lib-paper-card">' +
        '<div class="lib-paper-title">' + escapeHtml(c.titleFa) + '</div>' +
        (c.authors ? '<div class="lib-paper-authors">' + escapeHtml(c.authors) + (c.venue ? ' · ' + escapeHtml(c.venue) : '') + '</div>' : '') +
        '<div class="lib-paper-summary">' + summaryHtml + '</div>' +
        (metaBits.length ? '<div class="lib-paper-meta">' + metaBits.join('') + '</div>' : '') +
        (c.url ? '<a class="lib-paper-link" href="' + c.url + '" target="_blank" rel="noopener">مشاهده مقاله اصلی ↗</a>' : '') +
        '</div>';
    }).join('');
  }catch(e){
    researchResultsWrap.innerHTML = '<div class="sub-panel-empty"><span class="spe-ic">📡</span>مشکلی در اتصال پیش اومد؛ اتصال اینترنتت رو چک کن و دوباره امتحان کن.</div>';
  }finally{
    researchSearchBtn.disabled = false;
    researchSearchInput.disabled = false;
    researchSearchBtn.textContent = prevLabel;
  }
}

if(researchSearchBtn) researchSearchBtn.addEventListener('click', runResearchSearch);
if(researchSearchInput){
  researchSearchInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){ e.preventDefault(); runResearchSearch(); }
  });
}

/* ================= Swipe between tabs ================= */
const SWIPE_TAB_ORDER = ['today','workout','meditation','speech','ai','library'];
// ترتیب تب‌های بخش عمومی، دقیقاً هم‌ترازِ دکمه‌های #pubSubnav (چت، لیدربورد، هم‌مسیر، پروفایل)
const PUB_SWIPE_TAB_ORDER = ['chat','profile','leaderboard','buddy','sos'];
let swipeStartX = 0, swipeStartY = 0, swipeBlocked = false;
document.addEventListener('touchstart', (e)=>{
  const t = e.touches[0];
  swipeStartX = t.clientX;
  swipeStartY = t.clientY;
  swipeBlocked = !!(e.target.closest('#tabbar') || e.target.closest('#sideMenu') ||
    e.target.closest('#modeBar') || e.target.closest('#pubSubnav') ||
    e.target.closest('.subseg') || e.target.closest('#countersScroll') ||
    e.target.closest('#lbStrip') || e.target.closest('#lbPodium') ||
    e.target.closest('.sos-overlay.show') || e.target.closest('.onboard-overlay') ||
    e.target.closest('.wo-session-overlay.show') || e.target.closest('.focus-quality-modal.visible') ||
    e.target.closest('input[type="range"]') ||
    // پیام‌های چت خودشون با کشیدن به راست ریپلای می‌شن (ژست جدا و اولویت‌دار)؛
    // پس وقتی لمس از داخل لیست پیام‌ها شروع بشه، سوییچ بین تب‌ها (نه به راست، نه
    // به چپ) اصلاً وارد عمل نمی‌شه تا این دو ژست هیچ‌وقت با هم تداخل نکنن.
    e.target.closest('#chatMessages'));
}, {passive:true});
document.addEventListener('touchend', (e)=>{
  if(swipeBlocked) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - swipeStartX;
  const dy = t.clientY - swipeStartY;
  if(Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
  const activePanel = document.querySelector('.tab-panel.active');
  if(!activePanel) return;
  const currentTab = activePanel.id.replace('tab-', '');
  const isPublic = currentAppMode === 'public';
  const order = isPublic ? PUB_SWIPE_TAB_ORDER : SWIPE_TAB_ORDER;
  const idx = order.indexOf(currentTab);
  if(idx === -1) return;
  const nextIdx = dx < 0 ? idx - 1 : idx + 1;
  if(nextIdx < 0 || nextIdx >= order.length) return;
  const targetBtn = isPublic
    ? document.querySelector('.pub-subnav-btn[data-tab="'+order[nextIdx]+'"]')
    : document.querySelector('.tab-btn[data-tab="'+order[nextIdx]+'"]');
  if(targetBtn) targetBtn.click();
}, {passive:true});

/* ================= Side menu (chat + settings) ================= */
function closeSideMenu(){ document.getElementById('sideMenuOverlay').classList.remove('show'); }
document.getElementById('menuBtn').addEventListener('click', ()=>{
  document.getElementById('sideMenuOverlay').classList.add('show');
});
document.getElementById('sideMenuClose').addEventListener('click', closeSideMenu);
document.getElementById('sideMenuOverlay').addEventListener('click', (e)=>{
  if(e.target.id === 'sideMenuOverlay') closeSideMenu();
});
function enterSubPage(tabId){
  // چت/لیدربورد/پروفایل/هم‌مسیر زندگی‌شون رو بردیم به بخش «عمومی» — دیگه به‌عنوان ساب‌پیج
  // (با دکمه‌ی بازگشت) وارد نمی‌شن، بلکه از طریق نوار حالت پایین صفحه.
  if(tabId === 'chat' || tabId === 'leaderboard' || tabId === 'profile' || tabId === 'buddy'){
    showPublicTab(tabId);
    return;
  }
  // یادش می‌مونه قبل از باز شدن این ساب‌پیج تو حالت خصوصی بودیم یا عمومی، تا exitSubPage
  // بتونه دقیقاً به همون‌جا برگرده (وگرنه، مثلاً اگه از تب «پروفایل» عمومی وارد «تنظیمات»
  // شده باشیم، دکمه‌ی بازگشت/بک همیشه می‌بردمون بخش خصوصی درحالی که نوار بالا و پایین
  // همچنان عمومی رو نشون می‌دادن، چون کلاس‌هاشون دست‌نخورده می‌موند).
  subpageReturnMode = currentAppMode;
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('tab-'+tabId).classList.add('active');
  document.getElementById('tabbar').classList.add('hidden-for-subpage');
  document.body.classList.add('subpage-open');
  window.scrollTo(0, 0);
}
function exitSubPage(){
  document.getElementById('tabbar').classList.remove('hidden-for-subpage');
  document.body.classList.remove('subpage-open');
  document.body.classList.remove('chat-subpage-open');
  document.body.classList.remove('chat-fullscreen');
  window.scrollTo(0, 0);
  // برگشت دقیقاً به همون حالتی که قبل از ورود به ساب‌پیج توش بودیم (خصوصی یا عمومی).
  // setAppMode خودش مسئول یکدست‌کردن همه‌ی کلاس‌های نوار بالا/پایین (mode-btn،
  // pub-subnav-btn، tab-btn) و نمایش پنل درسته، پس دیگه اینجا دستی این کارو نمی‌کنیم.
  if(subpageReturnMode === 'public'){
    setAppMode('public', lastPublicTab);
  } else {
    setAppMode('private', lastMainTab);
  }
}
['settingsBackBtn','progressBackBtn','goalsBackBtn','inviteBackBtn','guideBackBtn','updateBackBtn','premiumBackBtn'].forEach(id=>{
  const btn = document.getElementById(id);
  if(btn) btn.addEventListener('click', exitSubPage);
});
document.getElementById('guideStartBtn').addEventListener('click', exitSubPage);

/* ================= Private / Public mode bar (bottom) ================= */
// "خصوصی" = the app's original personal/offline tabs (امروز، تمرین، کتابخونه...).
// "عمومی" = چت، لیدربورد، پروفایل — grouped together since they all depend on
// being online / signed in and involve other people.
let currentAppMode = 'private';
// حالتی (خصوصی/عمومی) که قبل از باز شدن یه ساب‌پیج قدیمی‌سبک (تنظیمات/پیشرفت/دعوت/راهنما/
// پرمیوم/اهداف) توش بودیم — exitSubPage باهاش دقیقاً به همون‌جا برمی‌گرده، نه همیشه خصوصی.
let subpageReturnMode = 'private';
let lastPublicTab = 'chat';
// آخرین تب واقعی بخش خصوصی (امروز/تمرین/...) — جدا از lastMainTab نگه داشته می‌شه چون
// وقتی داخل تب «حالت» هستیم lastMainTab خودش می‌شه 'focusmode' و دیگه نمی‌شه باهاش
// به تب قبلی برگشت.
let lastPrivateContentTab = 'today';
// ضامن نهایی جدایی دو بخش: صرف‌نظر از این‌که کدوم مسیر کد (فعلی یا هر کدی که بعداً
// اضافه بشه) به این‌جا رسیده، این تابع تضمین می‌کنه هیچ‌وقت هم‌زمان یه پنل از بخش
// خصوصی و یه پنل از بخش عمومی «active» نمونن، و نوار بالا (pubSubnav) و کلاس بدنه
// (public-active) هم دقیقاً با currentAppMode یکی باشن. جایگزین منطق اصلیِ setAppMode/
// showPublicTabInner نیست — یه لایه‌ی دفاعیِ اضافه‌ست که در انتهای هر دوی اون‌ها اجرا می‌شه.
function assertModeSeparation(){
  const isPublic = currentAppMode === 'public';
  const otherPanelIds = isPublic ? SWIPE_TAB_ORDER.concat(['focusmode']) : PUB_SWIPE_TAB_ORDER;
  const otherBtnSelector = isPublic ? '.tab-btn' : '.pub-subnav-btn';
  otherPanelIds.forEach(id=>{
    const panel = document.getElementById('tab-'+id);
    if(panel) panel.classList.remove('active');
  });
  document.querySelectorAll(otherBtnSelector).forEach(b=>b.classList.remove('active'));
  const pubSubnavEl = document.getElementById('pubSubnav');
  if(pubSubnavEl) pubSubnavEl.classList.toggle('show', isPublic);
  document.body.classList.toggle('public-active', isPublic);
}
function setAppMode(mode, targetTab){
  // Instant feedback: highlight the tapped bottom button right away, before any
  // animation, so the tap itself never feels laggy — only the content swap is eased.
  const isFocusTabForHighlight = (mode === 'private' && (targetTab || lastMainTab) === 'focusmode');
  document.querySelectorAll('.mode-btn').forEach(b=> b.classList.toggle('active', b.dataset.mode === mode && !isFocusTabForHighlight));
  const focusFabBtnEarly = document.getElementById('modeFocusBtn');
  if(focusFabBtnEarly) focusFabBtnEarly.classList.toggle('active', isFocusTabForHighlight);

  const oldPanel = document.querySelector('.tab-panel.active');
  const runSwitch = ()=>{
    currentAppMode = mode;
    document.body.classList.remove('chat-fullscreen');
    document.body.classList.toggle('public-active', mode === 'public');
    // تب «حالت» یه حالت تمام‌صفحه‌ی مستقله: تب‌های بالای بخش خصوصی (امروز/تمرین/...) و
    // هایلایت‌شدن دکمه‌ی «خصوصی» پایین، هیچ ارجاعی به بخش خصوصی نباید نشون بدن.
    const isFocusTab = (mode === 'private' && (targetTab || lastMainTab) === 'focusmode');
    document.querySelectorAll('.mode-btn').forEach(b=> b.classList.toggle('active', b.dataset.mode === mode && !isFocusTab));
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    const focusFabBtn = document.getElementById('modeFocusBtn');
    if(focusFabBtn) focusFabBtn.classList.toggle('active', isFocusTab);
    document.querySelectorAll('.pub-subnav-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p=>{p.classList.remove('active');p.classList.remove('tab-exiting');});
    // switching mode always backs out of any old-style subpage (progress/invite/guide/settings)
    document.getElementById('tabbar').classList.remove('hidden-for-subpage');
    document.body.classList.remove('subpage-open');
    if(mode === 'public'){
      document.getElementById('tabbar').style.display = 'none';
      document.getElementById('pubSubnav').classList.add('show');
      showPublicTabInner(targetTab || lastPublicTab);
    } else {
      document.getElementById('tabbar').style.display = isFocusTab ? 'none' : '';
      document.getElementById('pubSubnav').classList.remove('show');
      const tId = targetTab || lastMainTab;
      const targetBtn = document.querySelector('.tab-btn[data-tab="'+tId+'"]');
      if(targetBtn) targetBtn.classList.add('active');
      const targetPanel = document.getElementById('tab-'+tId);
      if(targetPanel) targetPanel.classList.add('active');
      lastMainTab = tId;
      if(tId !== 'focusmode') lastPrivateContentTab = tId;
    }
    assertModeSeparation();
    // Instant, not smooth: a smooth-scroll animation running at the same time as the
    // panel fade was stacking two animations back to back and made the whole switch
    // feel sluggish. The fade already carries the motion, so the scroll reset can (and
    // should) be instant.
    window.scrollTo(0, 0);
  };
  // Ease the content swap itself: fade+lift the currently-visible panel out for a
  // beat, then run the actual switch (whose target panel already fades/slides in
  // via the existing tabIn animation) — so the change reads as one smooth motion
  // instead of an abrupt cut, while staying quick (~50ms out + ~110ms in).
  if(oldPanel && !document.body.classList.contains('subpage-open')){
    oldPanel.classList.add('tab-exiting');
    setTimeout(runSwitch, 50);
  } else {
    runSwitch();
  }
}
function showPublicTabInner(tabId){
  if(PREMIUM_ONLY_TABS[tabId] && !requirePremium()) tabId = 'chat';
  lastPublicTab = tabId;
  document.body.classList.toggle('chat-fullscreen', tabId === 'chat');
  document.querySelectorAll('.pub-subnav-btn').forEach(b=> b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  const panel = document.getElementById('tab-'+tabId);
  if(panel) panel.classList.add('active');
  if(tabId === 'leaderboard' && typeof loadLeaderboard === 'function') loadLeaderboard();
  if(tabId === 'chat' && typeof updateChatModeUI === 'function') updateChatModeUI();
  if(tabId === 'profile' && typeof renderProfileTab === 'function') renderProfileTab();
  if(tabId === 'buddy' && typeof loadBuddyTab === 'function') loadBuddyTab();
  if(tabId === 'sos' && typeof loadSosTab === 'function') loadSosTab();
  assertModeSeparation();
}
function showPublicTab(tabId){
  if(tabNeedsAuth(tabId)){ goToAuthPage(tabId); return; }
  setAppMode('public', tabId);
}
document.querySelectorAll('.mode-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const mode = btn.dataset.mode;
    // اگه داخل تب «حالت» هستیم، دکمه‌ی «خصوصی» باید برگردونه به آخرین تب واقعی بخش
    // خصوصی، نه اینکه چون currentAppMode از قبل 'private' بوده هیچ اتفاقی نیفته.
    if(mode === 'private' && currentAppMode === 'private' && lastMainTab === 'focusmode'){
      setAppMode('private', lastPrivateContentTab || 'today');
      return;
    }
    if(currentAppMode === mode && !document.body.classList.contains('subpage-open')) return;
    if(mode === 'public' && tabNeedsAuth(lastPublicTab)){ goToAuthPage(lastPublicTab); return; }
    setAppMode(mode);
  });
});
document.querySelectorAll('.pub-subnav-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const tabId = btn.dataset.tab;
    if(tabNeedsAuth(tabId)){ goToAuthPage(tabId); return; }
    showPublicTabInner(tabId);
  });
});
document.getElementById('modeFocusBtn').addEventListener('click', ()=>{
  const tabId = 'focusmode';
  if(currentAppMode === 'private' && lastMainTab === tabId && !document.body.classList.contains('subpage-open')) return;
  if(tabNeedsAuth(tabId)){ goToAuthPage(tabId); return; }
  setAppMode('private', tabId);
});
document.querySelectorAll('.side-menu-item[data-tab]').forEach(item=>{
  item.addEventListener('click', ()=>{
    const targetTab = item.dataset.tab;
    if(tabNeedsAuth(targetTab)){
      goToAuthPage(targetTab);
      return;
    }
    if(targetTab === 'goals' && !requirePremium()){ closeSideMenu(); return; }
    closeSideMenu();
    enterSubPage(targetTab);
    if(targetTab === 'leaderboard') loadLeaderboard();
    if(targetTab === 'chat' && typeof updateChatModeUI === 'function') updateChatModeUI();
    if(targetTab === 'profile') renderProfileTab();
    if(targetTab === 'update') checkForAppUpdate();
  });
});
document.getElementById('premiumMenuItem').addEventListener('click', ()=>{
  closeSideMenu();
  openPremiumPage();
});

/* ---------------- Telegram group join (robust, WebView-safe) ----------------
   Plain <a target="_blank"> links are unreliable inside the Capacitor Android
   WebView (no system browser handler by default), so this opens the link via
   the Capacitor Browser plugin when running natively, with layered fallbacks
   for when the plugin isn't installed yet or the app runs in a normal browser. */
function openTelegramGroup(){
  const url = 'https://t.me/Dreamlifetel';
  const isNative = window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform();
  try{
    if(isNative && Capacitor.Plugins && Capacitor.Plugins.Browser && Capacitor.Plugins.Browser.open){
      Capacitor.Plugins.Browser.open({ url });
    } else if(isNative){
      // Capacitor/Cordova convention: '_system' forces the OS browser/app chooser
      window.open(url, '_system');
    } else {
      window.open(url, '_blank', 'noopener');
    }
  }catch(err){
    console.error('Telegram link open failed', err);
    try{ window.location.href = url; }catch(err2){}
  }
}
document.getElementById('telegramMenuItem').addEventListener('click', ()=>{
  if(!requirePremium()) return;
  closeSideMenu();
  openTelegramGroup();
});

/* ================= Settings accordion (collapsed by default) ================= */
document.addEventListener('click', (e)=>{
  const head = e.target.closest('.settings-group-head');
  if(!head) return;
  if(head.dataset.target === 'sgBody-checklist' && !requirePremium()) return;
  const isOpen = head.classList.contains('open');
  // Scope to the current tab/subpage so opening a group here (e.g. guide)
  // can't reach into and collapse a group in another tab (e.g. settings).
  const scope = head.closest('.tab-panel') || document;
  scope.querySelectorAll('.settings-group-head').forEach(h=>{
    h.classList.remove('open');
    const b = document.getElementById(h.dataset.target);
    if(b) b.classList.remove('open');
  });
  if(!isOpen){
    head.classList.add('open');
    const body = document.getElementById(head.dataset.target);
    if(body) body.classList.add('open');
  }
});

/* ================= XP / Levels =================
   Levels now go up to MAX_LEVEL (100). Thresholds are generated from a smooth curve
   instead of a hand-typed table (see levelThreshold) — reaching level 100 takes
   XP_CURVE_FINAL total XP, spread out on an accelerating curve so early levels stay
   quick and satisfying while the top levels are a long-term goal. Titles are grouped
   in tiers of LEVELS_PER_TIER levels each, reusing the original title set. */
const LEVEL_TIER_TITLES = ["نوپا","مصمم","پیگیر","استوار","منظم","قوی‌اراده","الگو","استاد عادت","فاتح قله","سرسخت",
  "پولادین","بی‌باک","راسخ","شکست‌ناپذیر","نمونه","حرفه‌ای","سرآمد","قهرمان","اسطوره","جاودان"];
const MAX_LEVEL = 100;
const LEVELS_PER_TIER = 5; // LEVEL_TIER_TITLES.length * LEVELS_PER_TIER === MAX_LEVEL
const XP_CURVE_FINAL = 200000; // total XP needed to reach MAX_LEVEL
const XP_CURVE_EXP = 2.2;      // >1 => each level asks for more than the last (accelerating curve)
function levelThreshold(level){
  if(level<=1) return 0;
  const t = (level-1)/(MAX_LEVEL-1);
  return Math.round(XP_CURVE_FINAL * Math.pow(t, XP_CURVE_EXP));
}
function levelTitleFor(level){
  const idx = Math.min(LEVEL_TIER_TITLES.length-1, Math.floor((level-1)/LEVELS_PER_TIER));
  return LEVEL_TIER_TITLES[idx];
}
const LEVELS = Array.from({length:MAX_LEVEL}, (_,i)=>({ min: levelThreshold(i+1), title: levelTitleFor(i+1) }));

/* ---- Daily XP penalty: leaving a program-day substantially incomplete, or not sending
   the group work-report that day, quietly costs some XP. Only counted from the day this
   feature shipped onward (storeData.xpPenaltyStartDate, stamped once in
   normalizeAndRenderStoreData) — never retroactive against days logged before it existed.
   "Left incomplete" reuses the same 60%-of-tasks bar computeStreak() already uses for a
   day to count as a streak day, so the two systems agree with each other. */
const XP_PENALTY_INCOMPLETE_DAY = 40;
const XP_PENALTY_NO_REPORT = 25;
function computeXPPenalty(){
  if(!storeData.xpPenaltyStartDate) return 0;
  let key = storeData.xpPenaltyStartDate;
  const todayK = todayKey();
  let penalty = 0, guard = 0;
  while(key < todayK && guard < 3650){
    guard++;
    const entry = (storeData.entries||{})[key];
    const total = entry ? (entry.total||0) : 0;
    if(total > 0){
      const done = Object.values(entry.done||{}).filter(Boolean).length
        + Object.values(entry.avoidDone||{}).filter(Boolean).length
        + Object.values(entry.momentDone||{}).filter(Boolean).length;
      if(done/total < 0.6) penalty += XP_PENALTY_INCOMPLETE_DAY;
    }
    if(!(storeData.reportSentDates && storeData.reportSentDates[key])) penalty += XP_PENALTY_NO_REPORT;
    key = addDaysToKey(key, 1);
  }
  return penalty;
}
/* ---- XP sources: essentially every capability in the app feeds this. Existing
   per-item/per-task/per-badge XP is unchanged; everything from "Object.values(storeData.focusSessions..."
   onward is new, pulling from features that previously earned no XP at all. */
/* ---- Streak XP bonus: separate from the 7/14/30/60/100/200/365-day milestone badges.
   Uses storeData.maxStreak (the best streak ever reached, already tracked and never
   decreases — same field the milestone badges read) rather than the live streak, so
   this bonus never disappears if today's streak later breaks; it only ever grows.
   A power curve (exponent > 1) makes each additional streak day worth more than the
   last, i.e. the longer the streak gets, the faster its XP payoff accelerates. */
const STREAK_XP_FACTOR = 2;
const STREAK_XP_EXP = 1.6;
function computeStreakBonusXP(){
  const s = storeData.maxStreak||0;
  if(s<=0) return 0;
  return Math.round(STREAK_XP_FACTOR * Math.pow(s, STREAK_XP_EXP));
}
function computeXP(){
  let xp=0;
  Object.values(storeData.entries||{}).forEach(e=>{
    const done=Object.values(e.done||{}).filter(Boolean).length
      + Object.values(e.avoidDone||{}).filter(Boolean).length
      + Object.values(e.momentDone||{}).filter(Boolean).length;
    xp += done*10;
    if(e.total && done>=e.total) xp += 20;
    if(e.nightReview) xp += 12;              // wrote a night reflection that day
    if(e.phoneHours!==null && e.phoneHours!==undefined && e.phoneHours!=='') xp += 4; // logged phone-usage
  });
  xp += computeStreakBonusXP();                                                                      // best-ever streak, accelerating
  xp += (storeData.urgeLog||[]).filter(u=>u.resisted).length*15;
  xp += (storeData.customTasks||[]).filter(t=>t.done).length*15;
  xp += Object.keys(storeData.badges||{}).length*25;
  Object.values(storeData.focusSessions||{}).forEach(fs=>{ xp += (fs && fs.count||0)*12; });      // focus/meditation sessions
  xp += ((storeData.woHistory && storeData.woHistory.count) || 0)*12;                              // logged workouts
  Object.values(storeData.customCounterMilestonesHit||{}).forEach(hit=>{ xp += Object.keys(hit||{}).length*20; }); // counter milestones
  xp += (storeData.selfieCount||0)*4;                                                                // progress selfies
  xp += Object.keys(storeData.lifeJournal||{}).length*8;                                             // life-journal entries
  xp += Object.values(storeData.libraryDeepDive||{}).filter(Boolean).length*20;                      // library deep-dive write-ups
  xp += Object.values(storeData.libraryWeekly||{}).filter(Boolean).length*20;                        // weekly library essays
  xp += Object.values(storeData.courseProgress||{}).reduce((sum,c)=> sum + ((c&&c.completed)?c.completed.length:0), 0)*10; // finished course lessons
  if(storeData.futureLetter) xp += 30;                                                                // letter to future self
  xp += ((storeData.goalsCustom && storeData.goalsCustom.added) || []).length*3;                      // custom goals created
  Object.values(storeData.aiFeatureUseCount||{}).forEach(c=>{ xp += (c||0)*18; });                    // AI coach features used
  xp += Object.keys(storeData.reportSentDates||{}).length*18;                                         // work reports sent
  xp = Math.max(0, xp - computeXPPenalty());
  return xp;
}
function renderXP(){
  const xp = computeXP();
  let levelIdx = 0;
  for(let i=0;i<LEVELS.length;i++){ if(xp>=LEVELS[i].min) levelIdx=i; }
  const cur = LEVELS[levelIdx];
  const next = LEVELS[levelIdx+1];
  document.getElementById('levelNum').textContent = toFa(levelIdx+1);
  document.getElementById('levelTitle').textContent = cur.title;
  document.getElementById('xpNum').textContent = toFa(xp)+' XP';
  const hlbNum = document.getElementById('headerLevelNum');
  if(hlbNum) hlbNum.textContent = toFa(levelIdx+1);
  const hlbWrap = document.getElementById('headerLevelBadge');
  if(hlbWrap) hlbWrap.title = 'سطح '+toFa(levelIdx+1)+' — '+cur.title;
  const hlbFill = document.getElementById('headerXpFill');
  if(next){
    const span = next.min - cur.min;
    const prog = Math.max(0, Math.min(100, Math.round(((xp-cur.min)/span)*100)));
    document.getElementById('xpBarFill').style.width = prog+'%';
    document.getElementById('xpNext').textContent = toFa(next.min-xp)+' XP تا سطح بعد ('+next.title+')';
    if(hlbFill) hlbFill.style.width = prog+'%';
  } else {
    document.getElementById('xpBarFill').style.width = '100%';
    document.getElementById('xpNext').textContent = 'به بالاترین سطح رسیدی 🏆';
    if(hlbFill) hlbFill.style.width = '100%';
  }
}

/* ================= Badges ================= */
const BADGES = [
  {id:'first_day', emoji:'🌱', title:'اولین قدم', check:()=>Object.keys(storeData.entries||{}).length>=1},
  {id:'streak_7', emoji:'🔥', title:'۷ روز پشت‌هم', check:()=>(storeData.maxStreak||0)>=7},
  {id:'streak_30', emoji:'💪', title:'۳۰ روز پشت‌هم', check:()=>(storeData.maxStreak||0)>=30},
  {id:'streak_60', emoji:'🚀', title:'۶۰ روز پشت‌هم', check:()=>(storeData.maxStreak||0)>=60},
  {id:'resist_1', emoji:'🛡️', title:'اولین مقاومت', check:()=>(storeData.urgeLog||[]).some(u=>u.resisted)},
  {id:'resist_10', emoji:'⚔️', title:'۱۰ بار مقاومت', check:()=>(storeData.urgeLog||[]).filter(u=>u.resisted).length>=10},
  {id:'perfect_day', emoji:'🌻', title:'یه روز کامل', check:()=>Object.values(storeData.entries||{}).some(e=>e.total && (
      (Object.values(e.done||{}).filter(Boolean).length+Object.values(e.avoidDone||{}).filter(Boolean).length+Object.values(e.momentDone||{}).filter(Boolean).length) >= e.total))},
  {id:'phase2', emoji:'🌿', title:'رسیدن به مرحله ۲', check:()=>(storeData.maxPhaseIndex||0)>=1},
  {id:'phase3', emoji:'🌳', title:'رسیدن به مرحله ۳', check:()=>(storeData.maxPhaseIndex||0)>=2},
  {id:'peak', emoji:'🏔️', title:'فتح قله', check:()=>!!storeData.peakCelebrated},
  {id:'night_7', emoji:'🌙', title:'۷ مرور شب', check:()=>Object.values(storeData.entries||{}).filter(e=>e.nightReview).length>=7},
  {id:'night_30', emoji:'🌌', title:'۳۰ مرور شب', check:()=>Object.values(storeData.entries||{}).filter(e=>e.nightReview).length>=30},
  {id:'selfie_7', emoji:'📸', title:'۷ سلفی', check:()=>(storeData.selfieCount||0)>=7},
  {id:'selfie_30', emoji:'🖼️', title:'۳۰ سلفی', check:()=>(storeData.selfieCount||0)>=30},
  {id:'planner_5', emoji:'🗂️', title:'۵ برنامه‌ی دستی', check:()=>(storeData.customTasks||[]).filter(t=>t.done).length>=5},
  {id:'planner_20', emoji:'📋', title:'۲۰ برنامه‌ی دستی', check:()=>(storeData.customTasks||[]).filter(t=>t.done).length>=20},
  {id:'planner_50', emoji:'📑', title:'۵۰ برنامه‌ی دستی', check:()=>(storeData.customTasks||[]).filter(t=>t.done).length>=50},
  {id:'streak_14', emoji:'🔥', title:'۱۴ روز پشت‌هم', check:()=>(storeData.maxStreak||0)>=14},
  {id:'streak_100', emoji:'🏅', title:'۱۰۰ روز پشت‌هم', check:()=>(storeData.maxStreak||0)>=100},
  {id:'streak_200', emoji:'👑', title:'۲۰۰ روز پشت‌هم', check:()=>(storeData.maxStreak||0)>=200},
  {id:'streak_365', emoji:'🏵️', title:'یک سال پشت‌هم', check:()=>(storeData.maxStreak||0)>=365},
  {id:'resist_25', emoji:'🗡️', title:'۲۵ بار مقاومت', check:()=>(storeData.urgeLog||[]).filter(u=>u.resisted).length>=25},
  {id:'resist_50', emoji:'🏹', title:'۵۰ بار مقاومت', check:()=>(storeData.urgeLog||[]).filter(u=>u.resisted).length>=50},
  {id:'resist_100', emoji:'🛡️', title:'۱۰۰ بار مقاومت', check:()=>(storeData.urgeLog||[]).filter(u=>u.resisted).length>=100},
  {id:'resist_250', emoji:'⚜️', title:'۲۵۰ بار مقاومت', check:()=>(storeData.urgeLog||[]).filter(u=>u.resisted).length>=250},
  {id:'perfect_7', emoji:'🌼', title:'۷ روز کامل', check:()=>Object.values(storeData.entries||{}).filter(e=>e.total && (
      (Object.values(e.done||{}).filter(Boolean).length+Object.values(e.avoidDone||{}).filter(Boolean).length+Object.values(e.momentDone||{}).filter(Boolean).length) >= e.total)).length>=7},
  {id:'perfect_30', emoji:'🌺', title:'۳۰ روز کامل', check:()=>Object.values(storeData.entries||{}).filter(e=>e.total && (
      (Object.values(e.done||{}).filter(Boolean).length+Object.values(e.avoidDone||{}).filter(Boolean).length+Object.values(e.momentDone||{}).filter(Boolean).length) >= e.total)).length>=30},
  {id:'days_logged_30', emoji:'📅', title:'۳۰ روز فعالیت', check:()=>Object.keys(storeData.entries||{}).length>=30},
  {id:'days_logged_90', emoji:'🗓️', title:'۹۰ روز فعالیت', check:()=>Object.keys(storeData.entries||{}).length>=90},
  {id:'days_logged_180', emoji:'📆', title:'۱۸۰ روز فعالیت', check:()=>Object.keys(storeData.entries||{}).length>=180},
  {id:'items_100', emoji:'✅', title:'۱۰۰ کار انجام‌شده', check:()=>{
      let n=0; Object.values(storeData.entries||{}).forEach(e=>{ n += Object.values(e.done||{}).filter(Boolean).length
        + Object.values(e.avoidDone||{}).filter(Boolean).length + Object.values(e.momentDone||{}).filter(Boolean).length; });
      return n>=100; }},
  {id:'items_500', emoji:'✳️', title:'۵۰۰ کار انجام‌شده', check:()=>{
      let n=0; Object.values(storeData.entries||{}).forEach(e=>{ n += Object.values(e.done||{}).filter(Boolean).length
        + Object.values(e.avoidDone||{}).filter(Boolean).length + Object.values(e.momentDone||{}).filter(Boolean).length; });
      return n>=500; }},
  {id:'items_1000', emoji:'💠', title:'۱۰۰۰ کار انجام‌شده', check:()=>{
      let n=0; Object.values(storeData.entries||{}).forEach(e=>{ n += Object.values(e.done||{}).filter(Boolean).length
        + Object.values(e.avoidDone||{}).filter(Boolean).length + Object.values(e.momentDone||{}).filter(Boolean).length; });
      return n>=1000; }},
  {id:'phase4', emoji:'🏞️', title:'رسیدن به مرحله ۴', check:()=>(storeData.maxPhaseIndex||0)>=3},
  {id:'level_10', emoji:'⭐', title:'رسیدن به سطح ۱۰', check:()=>{
      const xp=computeXP(); let idx=0; for(let i=0;i<LEVELS.length;i++){ if(xp>=LEVELS[i].min) idx=i; } return (idx+1)>=10; }},
  {id:'level_20', emoji:'🌟', title:'رسیدن به سطح ۲۰', check:()=>{
      const xp=computeXP(); let idx=0; for(let i=0;i<LEVELS.length;i++){ if(xp>=LEVELS[i].min) idx=i; } return (idx+1)>=20; }},
  {id:'level_50', emoji:'💫', title:'رسیدن به سطح ۵۰', check:()=>{
      const xp=computeXP(); let idx=0; for(let i=0;i<LEVELS.length;i++){ if(xp>=LEVELS[i].min) idx=i; } return (idx+1)>=50; }},
  {id:'level_100', emoji:'👑', title:'رسیدن به سطح ۱۰۰ (حداکثر)', check:()=>{
      const xp=computeXP(); let idx=0; for(let i=0;i<LEVELS.length;i++){ if(xp>=LEVELS[i].min) idx=i; } return (idx+1)>=100; }},
  {id:'badges_10', emoji:'🎖️', title:'۱۰ نشان جمع‌شده', check:()=>Object.keys(storeData.badges||{}).length>=10},
  {id:'badges_20', emoji:'🏆', title:'۲۰ نشان جمع‌شده', check:()=>Object.keys(storeData.badges||{}).length>=20},
];
// «عنوان»های مبتنی بر استفاده‌ی منظم هفتگی از یه حالت تمرکز (مثلاً ۳ بار در هفته حالت باشگاه => ورزشکار)
// همینجا به سیستم نشان‌ها/XP اضافه می‌شن تا هم تو تب «پیشرفت» دیده بشن، هم تو تب «پروفایل».
FOCUS_IDENTITIES.forEach(fi=>{
  BADGES.push({ id: fi.id, emoji: fi.emoji, title: fi.title, check: ()=> focusModeSessionsInDays(fi.mode, 7) >= fi.weeklyNeeded });
});
function renderBadges(){
  const grid = document.getElementById('badgeGrid');
  if(!grid) return;
  let changed=false;
  const html = BADGES.map(b=>{
    const earned = !!b.check();
    if(earned && !storeData.badges[b.id]){ storeData.badges[b.id]=true; changed=true;
      showCelebration({emoji:b.emoji, title:'نشان جدید: '+b.title, text:'یه دستاورد دیگه به مجموعه‌ات اضافه شد.'});
      launchConfetti();
    }
    return `<div class="badge-item${earned?' earned':''}"><span class="b-emoji-wrap"><span class="b-emoji">${b.emoji}</span></span><span class="b-title">${b.title}</span></div>`;
  }).join('');
  grid.innerHTML = html;
  if(changed) saveData();
}

/* ================= Heatmap ================= */
function renderHeatmap(){
  const grid = document.getElementById('heatmapGrid');
  if(!grid) return;
  const len = storeData.programLength || 90;
  const start = storeData.startDate ? dateOnly(storeData.startDate) : dateOnly(today);
  let html = '';
  for(let i=0;i<len;i++){
    const d = new Date(start); d.setDate(d.getDate()+i);
    const key = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const e = storeData.entries[key];
    let cls = 'heatmap-cell';
    if(d > dateOnly(today) && !e){ cls += ' future'; }
    else if(e){
      const done=Object.values(e.done||{}).filter(Boolean).length+Object.values(e.avoidDone||{}).filter(Boolean).length+Object.values(e.momentDone||{}).filter(Boolean).length;
      const pct = e.total ? Math.round((done/e.total)*100) : 0;
      if(pct>=90) cls+=' l4'; else if(pct>=60) cls+=' l3'; else if(pct>=25) cls+=' l2'; else if(pct>0) cls+=' l1';
    }
    html += `<div class="${cls}" title="${key}"></div>`;
  }
  grid.innerHTML = html;
}

/* ================= Phase comparison ================= */
function renderPhaseCompare(){
  const wrap = document.getElementById('compareBars');
  if(!wrap) return;
  if(!storeData.startDate){ wrap.innerHTML = '<div class="urge-empty" style="padding:0">هنوز برنامه شروع نشده.</div>'; return; }
  const phases = scaledPhases().filter(p=>p.max!==Infinity);
  const sums = phases.map(()=>({tot:0,cnt:0}));
  Object.keys(storeData.entries).forEach(key=>{
    const e = storeData.entries[key];
    const diff = Math.floor((dateOnly(key)-dateOnly(storeData.startDate))/86400000)+1;
    if(diff<1) return;
    let idx = phases.findIndex(p=>diff<=p.max);
    if(idx===-1) idx = phases.length-1;
    const done=Object.values(e.done||{}).filter(Boolean).length+Object.values(e.avoidDone||{}).filter(Boolean).length+Object.values(e.momentDone||{}).filter(Boolean).length;
    const pct = e.total ? (done/e.total)*100 : 0;
    sums[idx].tot += pct; sums[idx].cnt++;
  });
  const maxAvg = Math.max(1, ...sums.map(s=> s.cnt? s.tot/s.cnt : 0));
  wrap.innerHTML = phases.map((p,i)=>{
    const avg = sums[i].cnt ? Math.round(sums[i].tot/sums[i].cnt) : 0;
    const h = sums[i].cnt ? Math.round((avg/maxAvg)*70)+6 : 4;
    const isCurrent = p.key === currentPhase.key;
    return `<div class="compare-col"><div class="compare-bar${isCurrent?' current':''}" style="height:${h}px"></div><div class="compare-label">${p.name.replace('مرحله ','م')}<br>${sums[i].cnt? toFa(avg)+'%':'—'}</div></div>`;
  }).join('');
}
function renderStreakHistory(){
  const wrap = document.getElementById('streakHistBars');
  const empty = document.getElementById('streakHistEmpty');
  if(!wrap) return;
  const history = (storeData.slipHistory || []).filter(s => typeof s.days === 'number');
  const current = storeData.startDate ? computeStreak() : 0;
  const bars = history.map((s,i)=>({ label:'#'+toFa(i+1), days:s.days, isCurrent:false }));
  if(storeData.startDate){ bars.push({ label:'الان', days:current, isCurrent:true }); }
  if(bars.length===0){ wrap.innerHTML=''; if(empty) empty.style.display='block'; return; }
  if(empty) empty.style.display='none';
  const maxDays = Math.max(1, ...bars.map(b=>b.days));
  const best = Math.max(0, ...history.map(s=>s.days));
  wrap.innerHTML = bars.map(b=>{
    const h = Math.round((b.days/maxDays)*70)+6;
    const isBest = !b.isCurrent && best>0 && b.days===best;
    return `<div class="compare-col"><div class="compare-bar${b.isCurrent?' current':''}" style="height:${h}px"></div><div class="compare-label">${b.label}${isBest?' 🏆':''}<br>${toFa(b.days)} روز</div></div>`;
  }).join('');
}

/* ================= Weight progress (goal-weight tracking) ================= */
function renderWeightProgress(){
  const body = document.getElementById('weightProgressBody');
  if(!body) return;
  const goal = storeData.profile.goalWeight;
  if(!goal){
    body.innerHTML = '<div class="wp-empty">اول تو «ویرایش پروفایل» وزن هدفتو مشخص کن تا این بخش فعال بشه — چه برای کاهش وزن بخوای استفاده‌ش کنی چه افزایش.</div>';
    return;
  }
  const logs = Object.keys(storeData.entries)
    .filter(k => storeData.entries[k] && storeData.entries[k].weight != null)
    .sort()
    .map(k => ({ date:k, weight: storeData.entries[k].weight }));
  if(logs.length===0){
    body.innerHTML = '<div class="wp-empty">هنوز وزنی ثبت نکردی. هر شب تو بخش «مرور شب» می‌تونی وزن اون روزو ثبت کنی تا این نمودار پر بشه.</div>';
    return;
  }
  const start = storeData.profile.weight!=null ? storeData.profile.weight : logs[0].weight;
  const current = logs[logs.length-1].weight;
  let remaining, direction;
  if(goal < start){
    direction = 'کاهش وزن';
    remaining = Math.max(0, +(current-goal).toFixed(1));
  } else if(goal > start){
    direction = 'افزایش وزن';
    remaining = Math.max(0, +(goal-current).toFixed(1));
  } else {
    direction = 'حفظ وزن';
    remaining = Math.max(0, +Math.abs(current-goal).toFixed(1));
  }
  let progressPct = null;
  if(start !== goal){
    progressPct = Math.round(((start-current)/(start-goal))*100);
    progressPct = Math.max(0, Math.min(100, progressPct));
  }
  const remainingText = remaining<=0.05
    ? '🎉 به وزن هدفت رسیدی!'
    : toFa(remaining)+' کیلوگرم تا وزن هدفت مونده';

  const recent = logs.slice(-10);
  const barsMin = Math.min(...recent.map(l=>l.weight), goal);
  const barsMax = Math.max(...recent.map(l=>l.weight), goal);
  const range = Math.max(0.5, barsMax-barsMin);
  const barsHtml = recent.map(l=>{
    const h = Math.round(((l.weight-barsMin)/range)*70)+6;
    const d = new Date(l.date);
    const lbl = toFa(d.getDate())+'/'+toFa(d.getMonth()+1);
    return `<div class="compare-col"><div class="compare-bar" style="height:${h}px"></div><div class="compare-label">${lbl}<br>${toFa(l.weight)}</div></div>`;
  }).join('');
  const goalH = Math.round(((goal-barsMin)/range)*70)+6;

  body.innerHTML = `
    <div class="wp-stats-row">
      <div class="wp-stat"><b>${toFa(current)}</b><span>وزن فعلی (kg)</span></div>
      <div class="wp-stat"><b>${toFa(goal)}</b><span>وزن هدف (kg)</span></div>
      <div class="wp-stat"><b>${direction}</b><span>مسیر</span></div>
    </div>
    ${progressPct!=null ? `<div class="wp-progress-wrap"><div class="wp-progress-fill" style="width:${progressPct}%"></div></div><div class="wp-progress-label">${toFa(progressPct)}% به وزن هدفت نزدیک شدی</div>` : ''}
    <div class="wp-remaining">${remainingText}</div>
    <div class="wp-chart-wrap">
      <div class="compare-bars">${barsHtml}</div>
      <div class="wp-goal-line" style="bottom:${goalH+6}px"><span>هدف</span></div>
    </div>
  `;
}

/* ================= Custom items ================= */
document.getElementById('customItemAdd').addEventListener('click', ()=>{
  const input = document.getElementById('customItemInput');
  const val = input.value.trim();
  if(!val) return;
  storeData.customItems.push(val);
  input.value='';
  saveData();
  render();
  showToast('آیتم اضافه شد');
});
function renderCustomList(){
  const box = document.getElementById('customList');
  if(!box) return;
  if(!storeData.customItems || storeData.customItems.length===0){ box.innerHTML=''; return; }
  box.innerHTML = storeData.customItems.map((item,i)=>
    `<div class="c-row"><span>${item}</span><span class="rm" data-idx="${i}">✕</span></div>`).join('');
  box.querySelectorAll('.rm').forEach(el=>{
    el.addEventListener('click', ()=>{
      const idx = parseInt(el.dataset.idx,10);
      storeData.customItems.splice(idx,1);
      saveData();
      render();
    });
  });
}

/* ================= «برنامه فردا» (Today > برنامه فردا) ================= */
function renderTomorrowTab(){
  const autoDoBox = document.getElementById('tmrwAutoDoList');
  if(!autoDoBox) return; // پنل هنوز رندر نشده
  ensureTomorrowPlan();

  const autoDo = getTomorrowPreviewDoItems();
  const autoAvoid = getTomorrowPreviewAvoidItems();
  autoDoBox.innerHTML = autoDo.length
    ? autoDo.map(item=>`<div class="c-row"><span>${item}</span></div>`).join('')
    : '<div class="sub-panel-empty" style="padding:14px 0;"><span class="spe-ic">🌙</span>هنوز برنامه‌ی خودکار فردا مشخص نشده</div>';
  const autoAvoidBox = document.getElementById('tmrwAutoAvoidList');
  if(autoAvoidBox){
    autoAvoidBox.innerHTML = autoAvoid.length
      ? autoAvoid.map(item=>`<div class="c-row"><span>${item}</span></div>`).join('')
      : '<div class="sub-panel-empty" style="padding:14px 0;"><span class="spe-ic">🌙</span>هنوز پرهیز خودکاری برای فردا مشخص نشده</div>';
  }

  const plan = storeData.tomorrowPlan;
  const doBox = document.getElementById('tmrwDoList');
  const doEmpty = document.getElementById('tmrwDoEmpty');
  if(doBox){
    doBox.innerHTML = plan.doItems.map((item,i)=>
      `<div class="c-row"><span>${item}</span><span class="rm" data-idx="${i}">✕</span></div>`).join('');
    doBox.querySelectorAll('.rm').forEach(el=>{
      el.addEventListener('click', ()=>{
        const idx = parseInt(el.dataset.idx,10);
        storeData.tomorrowPlan.doItems.splice(idx,1);
        saveData();
        renderTomorrowTab();
      });
    });
    if(doEmpty) doEmpty.style.display = plan.doItems.length ? 'none' : 'block';
  }

  const avoidBox = document.getElementById('tmrwAvoidList');
  const avoidEmpty = document.getElementById('tmrwAvoidEmpty');
  if(avoidBox){
    avoidBox.innerHTML = plan.avoidItems.map((item,i)=>
      `<div class="c-row"><span>${item}</span><span class="rm" data-idx="${i}">✕</span></div>`).join('');
    avoidBox.querySelectorAll('.rm').forEach(el=>{
      el.addEventListener('click', ()=>{
        const idx = parseInt(el.dataset.idx,10);
        storeData.tomorrowPlan.avoidItems.splice(idx,1);
        saveData();
        renderTomorrowTab();
      });
    });
    if(avoidEmpty) avoidEmpty.style.display = plan.avoidItems.length ? 'none' : 'block';
  }
}
(function(){
  const doAddBtn = document.getElementById('tmrwDoAdd');
  if(doAddBtn) doAddBtn.addEventListener('click', ()=>{
    const input = document.getElementById('tmrwDoInput');
    const val = input.value.trim();
    if(!val) return;
    ensureTomorrowPlan();
    storeData.tomorrowPlan.doItems.push(val);
    input.value = '';
    saveData();
    renderTomorrowTab();
    showToast('برای فردا اضافه شد');
  });
  const avoidAddBtn = document.getElementById('tmrwAvoidAdd');
  if(avoidAddBtn) avoidAddBtn.addEventListener('click', ()=>{
    const input = document.getElementById('tmrwAvoidInput');
    const val = input.value.trim();
    if(!val) return;
    ensureTomorrowPlan();
    storeData.tomorrowPlan.avoidItems.push(val);
    input.value = '';
    saveData();
    renderTomorrowTab();
    showToast('برای پرهیز فردا اضافه شد');
  });
})();

/* ================= Manual / custom-dated tasks (Today > برنامه‌های من) ================= */
// A user-authored task with its own due date. Stays in the active list until either
// checked off or its date passes, then quietly moves into the low-profile archive below.
function customTaskDaysLeft(t){
  if(!t.dueDate) return null;
  return Math.round((dateOnly(t.dueDate) - dateOnly(todayKey())) / 86400000);
}
function isCustomTaskArchived(t){
  return !!t.done || (!!t.dueDate && t.dueDate < todayKey());
}
function computeCustomTaskProgress(){
  const list = storeData.customTasks || [];
  const total = list.length;
  const done = list.filter(t=>t.done).length;
  return { total, done, pct: total ? Math.round((done/total)*100) : 0 };
}
function renderCustomTaskRing(){
  const ring = document.getElementById('customRingFg');
  const pctEl = document.getElementById('customRingPct');
  const summary = document.getElementById('customTaskSummary');
  if(!ring || !pctEl) return;
  const { total, done, pct } = computeCustomTaskProgress();
  ring.style.strokeDashoffset = MINI_CIRC - (pct/100)*MINI_CIRC;
  pctEl.textContent = toFa(pct)+'%';
  if(summary){
    const pending = (storeData.customTasks||[]).filter(t=>!isCustomTaskArchived(t)).length;
    summary.textContent = total ? `${toFa(pending)} کار در انتظار — از ${toFa(total)} کاری که تا الان نوشتی، ${toFa(done)} تاش انجام شده.` : 'هنوز کاری ثبت نکردی.';
  }
}
function renderCustomTaskList(){
  const list = storeData.customTasks || [];
  const activeBox = document.getElementById('customTaskList');
  const emptyBox = document.getElementById('customTaskEmpty');
  const archiveBox = document.getElementById('customTaskArchiveList');
  if(!activeBox || !archiveBox) return;

  const active = list.filter(t=>!isCustomTaskArchived(t))
    .sort((a,b)=> (a.dueDate||'').localeCompare(b.dueDate||''));
  const archived = list.filter(t=>isCustomTaskArchived(t))
    .sort((a,b)=> new Date(b.doneAt||b.dueDate||0) - new Date(a.doneAt||a.dueDate||0));

  if(emptyBox) emptyBox.style.display = active.length ? 'none' : 'block';
  activeBox.innerHTML = active.map(t=>{
    const dl = customTaskDaysLeft(t);
    const dlText = dl===null ? '' : (dl<=0 ? 'امروزه' : toFa(dl)+' روز مونده');
    return `<div class="item" data-id="${t.id}"><div class="box">${CHECK_SVG}</div>`+
      `<span class="label">${escapeHtml(t.text)}${dlText?`<br><span style="font-size:10.5px;color:var(--muted);">📅 ${dlText}</span>`:''}</span></div>`;
  }).join('');
  activeBox.querySelectorAll('.item').forEach(row=>{
    row.addEventListener('click', ()=> toggleCustomTask(row.dataset.id));
  });

  archiveBox.innerHTML = archived.length ? archived.map(t=>{
    const statusText = t.done ? '✅ انجام شد' : '⌛ تاریخش گذشت';
    return `<div class="c-row" data-id="${t.id}" style="cursor:pointer;">`+
      `<span style="font-size:11.5px;text-decoration:${t.done?'line-through':'none'};text-decoration-color:var(--line);">${escapeHtml(t.text)} <span style="color:var(--muted);">— ${statusText}</span></span>`+
      `<span class="rm" data-id-rm="${t.id}">✕</span></div>`;
  }).join('') : `<div style="padding:8px 14px;font-size:11px;color:var(--muted);">چیزی هنوز اینجا نیست</div>`;
  archiveBox.querySelectorAll('.rm').forEach(el=>{
    el.addEventListener('click', (e)=>{ e.stopPropagation(); deleteCustomTask(el.dataset.idRm); });
  });
  archiveBox.querySelectorAll('.c-row').forEach(row=>{
    row.addEventListener('click', ()=> toggleCustomTask(row.dataset.id));
  });

  renderCustomTaskRing();
}
function toggleCustomTask(id){
  const list = storeData.customTasks || [];
  const t = list.find(x=>String(x.id)===String(id));
  if(!t) return;
  const turningOn = !t.done;
  t.done = turningOn;
  t.doneAt = turningOn ? new Date().toISOString() : null;
  if(turningOn){
    sfxPop();
    showToast(ENCOURAGEMENTS[Math.floor(Math.random()*ENCOURAGEMENTS.length)]);
    cancelCustomTaskNotif(t);
  } else {
    sfxTap();
    scheduleCustomTaskNotif(t);
  }
  saveData();
  render();
}
function deleteCustomTask(id){
  const list = storeData.customTasks || [];
  const idx = list.findIndex(x=>String(x.id)===String(id));
  if(idx<0) return;
  cancelCustomTaskNotif(list[idx]);
  list.splice(idx,1);
  saveData();
  render();
  showToast('حذف شد');
}

const customTaskDaysInputEl = document.getElementById('customTaskDaysInput');
const customTaskDateInputEl = document.getElementById('customTaskDateInput');
if(customTaskDaysInputEl && customTaskDateInputEl){
  customTaskDaysInputEl.addEventListener('input', ()=>{
    const n = parseInt(customTaskDaysInputEl.value,10);
    if(!isNaN(n) && n>=0) customTaskDateInputEl.value = addDaysToKey(todayKey(), n);
  });
}
document.getElementById('customTaskAddBtn').addEventListener('click', async ()=>{
  const textEl = document.getElementById('customTaskTextInput');
  const text = textEl.value.trim();
  const dateVal = customTaskDateInputEl.value;
  if(!text){ showToast('اول متن کارو بنویس', 'error'); return; }
  if(!dateVal){ showToast('تعداد روز یا تاریخش رو مشخص کن', 'error'); return; }
  if('Notification' in window && Notification.permission==='default'){
    try{ await Notification.requestPermission(); }catch(err){}
  }
  if(!storeData.customTasks) storeData.customTasks = [];
  if(storeData.customTaskNotifSeq===undefined) storeData.customTaskNotifSeq = 0;
  const notifId = 9600 + (storeData.customTaskNotifSeq % 300);
  storeData.customTaskNotifSeq += 1;
  const task = { id:'ct_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), text, dueDate:dateVal,
    done:false, doneAt:null, createdAt:new Date().toISOString(), notified:false, notifId };
  storeData.customTasks.push(task);
  textEl.value=''; customTaskDaysInputEl.value=''; customTaskDateInputEl.value='';
  saveData();
  render();
  scheduleCustomTaskNotif(task);
  showToast('برنامه اضافه شد ✅', 'success');
});

// Native (Capacitor) one-time alarm at 9 AM on the task's due date — works even if the app
// is closed. No-ops silently in a plain browser tab (see getLN()).
async function scheduleCustomTaskNotif(t){
  if(t.done || !t.dueDate) return;
  const plugin = getLN();
  if(!plugin) return;
  try{
    const perm = await plugin.requestPermissions();
    if(perm.display !== 'granted') return;
    const at = dateOnly(t.dueDate);
    at.setHours(9,0,0,0);
    if(at.getTime() < Date.now()) at.setTime(Date.now()+2000);
    await plugin.schedule({ notifications:[{ id:t.notifId, title:'📌 یادآوری برنامه', body:t.text, schedule:{ at } }] });
  }catch(err){ console.error('scheduleCustomTaskNotif failed', err); }
}
async function cancelCustomTaskNotif(t){
  const plugin = getLN();
  if(!plugin || !t.notifId) return;
  try{ await plugin.cancel({ notifications:[{id:t.notifId}] }); }catch(err){}
}
async function scheduleAllCustomTaskNotifs(){
  for(const t of (storeData.customTasks||[])){
    if(!t.done && t.dueDate >= todayKey()) await scheduleCustomTaskNotif(t);
    else await cancelCustomTaskNotif(t);
  }
}
// Web-tab / in-app fallback: fires once per task the first time the app is open on (or after)
// its due date, as long as it hasn't been checked off already. Runs on load and every minute
// while the app stays open, so it also catches the midnight rollover.
function checkCustomTaskReminders(){
  const list = storeData.customTasks || [];
  const tk = todayKey();
  let changed = false;
  list.forEach(t=>{
    if(!t.done && t.dueDate && t.dueDate <= tk && !t.notified){
      t.notified = true; changed = true;
      showToast('📌 یادآوری: '+t.text);
      if('Notification' in window && Notification.permission==='granted'){
        try{ new Notification('📌 یادآوری برنامه', {body:t.text}); }catch(err){}
      }
    }
  });
  if(changed) saveData();
}
setInterval(checkCustomTaskReminders, 60000);

/* ================= Theme ================= */
/* small color helpers used to compute each theme's own "nearby shade" for the
   soft ambient drift — always a small nudge in hue/lightness of the SAME color,
   never a jump to a different hue family. */
function hexToHslArr(hex){
  hex = hex.replace('#','');
  if(hex.length===3) hex = hex.split('').map(c=>c+c).join('');
  const r = parseInt(hex.substr(0,2),16)/255, g = parseInt(hex.substr(2,2),16)/255, b = parseInt(hex.substr(4,2),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h,s,l = (max+min)/2;
  if(max===min){ h=0; s=0; }
  else{
    const d = max-min;
    s = l>0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){
      case r: h=(g-b)/d+(g<b?6:0); break;
      case g: h=(b-r)/d+2; break;
      default: h=(r-g)/d+4;
    }
    h/=6;
  }
  return [h*360, s*100, l*100];
}
function hslArrToHex(h,s,l){
  h=((h%360)+360)%360; s=Math.max(0,Math.min(100,s))/100; l=Math.max(0,Math.min(100,l))/100;
  const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2;
  let r,g,b;
  if(h<60){r=c;g=x;b=0;} else if(h<120){r=x;g=c;b=0;} else if(h<180){r=0;g=c;b=x;}
  else if(h<240){r=0;g=x;b=c;} else if(h<300){r=x;g=0;b=c;} else {r=c;g=0;b=x;}
  const toHex=v=>{const n=Math.round((v+m)*255); return n.toString(16).padStart(2,'0');};
  return '#'+toHex(r)+toHex(g)+toHex(b);
}
function nearbyShade(hex, dh, ds, dl){
  const [h,s,l] = hexToHslArr(hex);
  return hslArrToHex(h+dh, s+ds, l+dl);
}
/* ================= سایه‌های سه‌بعدیِ کادرها: یه ست برای تم‌های روشن، یه ست جدا برای
   تاریک/نیمه‌شب. رو زمینه‌ی تیره، سایه‌ی گرمِ قهوه‌ای اصلاً دیده نمی‌شه (کنتراست کافی با
   پس‌زمینه‌ی تیره نداره) و لعابِ سفیدِ پررنگ دقیقاً رو متنِ نزدیک‌به‌سفیدِ همون تم می‌شینه و
   می‌بردتش زیر خودش. برای تاریک: سایه‌ها مشکی/کم‌رنگ می‌شن (که رو تیره واقعاً «سایه» دیده
   بشن) و لعاب بالا خیلی کم‌رنگ‌تره (فقط یه خطِ نور ظریف، نه یه لکه‌ی سفیدِ روشن). ================= */
const ELEV_LIGHT = {
  lift: 'inset 0 1.5px 0 rgba(255,255,255,.8), inset 0 -16px 22px -13px rgba(120,80,30,.38), 0 16px 30px -10px rgba(180,120,60,.32), 0 5px 12px -4px rgba(180,120,60,.20)',
  liftSm: 'inset 0 1.5px 0 rgba(255,255,255,.75), inset 0 -11px 16px -10px rgba(120,80,30,.32), 0 9px 18px -8px rgba(180,120,60,.26), 0 2px 7px -2px rgba(180,120,60,.16)',
  press: 'inset 0 1.5px 0 rgba(255,255,255,.4), inset 0 -6px 10px -6px rgba(120,80,30,.24), 0 3px 8px -4px rgba(180,120,60,.16)',
  sheen: 'radial-gradient(circle at 18% 10%, rgba(255,255,255,.85) 0%, rgba(255,255,255,0) 42%), radial-gradient(circle at 88% 96%, rgba(120,80,30,.14) 0%, rgba(120,80,30,0) 55%), linear-gradient(115deg, rgba(255,255,255,.22) 6%, transparent 28%)',
  input: 'inset 0 2px 6px rgba(120,80,40,.10), inset 0 -1px 0 rgba(255,255,255,.55)'
};
const ELEV_DARK = {
  lift: 'inset 0 1.5px 0 rgba(255,255,255,.10), inset 0 -16px 22px -13px rgba(0,0,0,.55), 0 16px 30px -10px rgba(0,0,0,.5), 0 5px 12px -4px rgba(0,0,0,.4)',
  liftSm: 'inset 0 1.5px 0 rgba(255,255,255,.08), inset 0 -11px 16px -10px rgba(0,0,0,.5), 0 9px 18px -8px rgba(0,0,0,.45), 0 2px 7px -2px rgba(0,0,0,.32)',
  press: 'inset 0 1.5px 0 rgba(255,255,255,.06), inset 0 -6px 10px -6px rgba(0,0,0,.45), 0 3px 8px -4px rgba(0,0,0,.35)',
  sheen: 'radial-gradient(circle at 18% 10%, rgba(255,255,255,.07) 0%, rgba(255,255,255,0) 42%), radial-gradient(circle at 88% 96%, rgba(0,0,0,.35) 0%, rgba(0,0,0,0) 55%), linear-gradient(115deg, rgba(255,255,255,.05) 6%, transparent 28%)',
  input: 'inset 0 2px 6px rgba(0,0,0,.35), inset 0 -1px 0 rgba(255,255,255,.06)'
};
function applyElevTokens(darkMode){
  const e = darkMode ? ELEV_DARK : ELEV_LIGHT;
  const root = document.documentElement.style;
  root.setProperty('--elev-lift', e.lift);
  root.setProperty('--elev-lift-sm', e.liftSm);
  root.setProperty('--elev-press', e.press);
  root.setProperty('--elev-sheen', e.sheen);
  root.setProperty('--elev-input', e.input);
}
const THEMES = {
  brand:    {bg1:'#eef0ff', bg2:'#f2ecfb', bg3:'#e9eefe', card:'#fdfcff', card2:'#f3eefc', accent:'#4338ca', accent2:'#bf26d3', text:'#241f3d', muted:'#8a84ab', line:'#ddd6f5'},
  warm:     {bg1:'#fff3e6', bg2:'#ffe3ea', bg3:'#e8f1ff', card:'#fffdfa', card2:'#fff5ea', accent:'#ff9a3d', accent2:'#ffb347', text:'#3d2f22', muted:'#9c8b78', line:'#f0dcc4'},
  ocean:    {bg1:'#e7f3ff', bg2:'#eaf7f5', bg3:'#f0eefd', card:'#fbfeff', card2:'#eef8fb', accent:'#2f9bd6', accent2:'#5fc1e0', text:'#1f3a4a', muted:'#7c99a6', line:'#d7ebf3'},
  forest:   {bg1:'#eef6e9', bg2:'#f2f7e2', bg3:'#e8f2ee', card:'#fbfdf8', card2:'#eef5e6', accent:'#4f9d5c', accent2:'#7cbb6c', text:'#28361f', muted:'#84977a', line:'#dcebd2'},
  dark:     {bg1:'#20242c', bg2:'#242030', bg3:'#1c2733', card:'#2a2e38', card2:'#333844', accent:'#ff9a3d', accent2:'#ffb347', text:'#eee8de', muted:'#8b8f9a', line:'#3a3f4a'},
  rose:     {bg1:'#fff0f3', bg2:'#ffe4ec', bg3:'#fdeef6', card:'#fffbfc', card2:'#fff0f4', accent:'#e15b86', accent2:'#ee80a3', text:'#4a1f2d', muted:'#a17f8b', line:'#f5d9e2'},
  lavender: {bg1:'#f1edfd', bg2:'#eee6fb', bg3:'#eaf0fb', card:'#fbfaff', card2:'#f2edfc', accent:'#8b6fd9', accent2:'#a893e6', text:'#2e2545', muted:'#8e84a8', line:'#ddd3f5'},
  mint:     {bg1:'#e8faf3', bg2:'#eafbf0', bg3:'#e7f6fa', card:'#fbfffd', card2:'#eafcf5', accent:'#20b393', accent2:'#4fcaa8', text:'#173c33', muted:'#7c9c93', line:'#cdeee1'},
  midnight: {bg1:'#161a2b', bg2:'#1b1f33', bg3:'#141826', card:'#20263b', card2:'#262d47', accent:'#6d8dff', accent2:'#8fa8ff', text:'#e7e9f5', muted:'#8a90ab', line:'#333a56'},
  red:      {bg1:'#ffece9', bg2:'#ffe1e0', bg3:'#fde8e8', card:'#fffbfa', card2:'#ffefec', accent:'#e6231e', accent2:'#ff5b52', text:'#3d1210', muted:'#a3827e', line:'#f6d0cc'},
  white:    {bg1:'#ffffff', bg2:'#fafafa', bg3:'#f6f6f6', card:'#ffffff', card2:'#f2f2f2', accent:'#2b2b2b', accent2:'#555555', text:'#1a1a1a', muted:'#8a8a8a', line:'#e6e6e6'},
  gray:     {bg1:'#f2f2f3', bg2:'#eceef0', bg3:'#eef0f1', card:'#fbfbfc', card2:'#f0f1f2', accent:'#6b7280', accent2:'#9aa1ab', text:'#26282b', muted:'#8b8f95', line:'#dde0e3'}
};
function applyTheme(name, doSave){
  const t = THEMES[name] || THEMES.brand;
  const root = document.documentElement.style;
  root.setProperty('--bg1', t.bg1); root.setProperty('--bg2', t.bg2); root.setProperty('--bg3', t.bg3);
  root.setProperty('--card', t.card); root.setProperty('--card-2', t.card2);
  root.setProperty('--accent', t.accent); root.setProperty('--accent-2', t.accent2);
  root.setProperty('--accent-text', t.accentText || '#ffffff');
  root.setProperty('--text', t.text); root.setProperty('--muted', t.muted); root.setProperty('--line', t.line);
  root.setProperty('--hdr-c1', t.accent); root.setProperty('--hdr-c2', t.accent2);
  applyElevTokens(isDarkTheme(name));
  storeData.theme = name;
  try{ localStorage.setItem('checklistApp:lastTheme', name); }catch(e){}
  try{ pushWidgetTheme(); }catch(e){}
  if(doSave!==false) saveData();
}
function isDarkTheme(name){ return name==='dark' || name==='midnight'; }

/* ================= Time-of-day ambience ================= */
function getDayPeriod(h){
  if(h>=4 && h<7) return 't-dawn';
  if(h>=7 && h<11) return 't-morning';
  if(h>=11 && h<15) return 't-noon';
  if(h>=15 && h<18) return 't-afternoon';
  if(h>=18 && h<20) return 't-sunset';
  if(h>=20 && h<24) return 't-night';
  return 't-midnight';
}
function applyTimeOfDay(){
  const el = document.getElementById('timeDecor');
  if(!el) return;
  const period = getDayPeriod(new Date().getHours());
  el.classList.remove('t-dawn','t-morning','t-noon','t-afternoon','t-sunset','t-night','t-midnight');
  el.classList.add(period);
}
function initTimeOfDay(){
  applyTimeOfDay();
  setInterval(applyTimeOfDay, 10*60*1000);
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) applyTimeOfDay(); });
}
function switchTheme(name){
  applyTheme(name, true);
  renderThemeRow();
  try{ updateHeaderFlame(); }catch(err){}
  document.querySelectorAll('.coach-avatar, .celebrate-coach').forEach(av=>{
    if(av.dataset.mood) av.innerHTML = buildCoachSVG(av.dataset.mood, av.id || ('el'+Math.random().toString(36).slice(2,7)), av.dataset.gender || '');
  });
}
const FREE_THEMES = { brand:1, forest:1 };
function renderThemeRow(){
  const row = document.getElementById('themeRow');
  if(!row) return;
  row.innerHTML = Object.keys(THEMES).map(name=>{
    const t = THEMES[name];
    const active = storeData.theme===name ? ' active' : '';
    const locked = (!FREE_THEMES[name] && !(storeData.premium || isInTrial())) ? ' theme-swatch-locked' : '';
    const lockIcon = locked ? '<span class="theme-swatch-lock">🔒</span>' : '';
    return `<div class="theme-swatch${active}${locked}" data-theme="${name}" style="background:linear-gradient(135deg,${t.accent},${t.bg1})">${lockIcon}</div>`;
  }).join('');
  row.querySelectorAll('.theme-swatch').forEach(el=>{
    el.addEventListener('click', ()=>{
      if(!FREE_THEMES[el.dataset.theme] && !requirePremium()) return;
      switchTheme(el.dataset.theme);
      showToast('تم عوض شد');
    });
  });
  const dmToggle = document.getElementById('darkModeToggle');
  if(dmToggle) dmToggle.checked = isDarkTheme(storeData.theme);
}
document.getElementById('darkModeToggle').addEventListener('change', (e)=>{
  if(e.target.checked && !requirePremium()){ e.target.checked = false; return; }
  switchTheme(e.target.checked ? 'dark' : 'brand');
  showToast(e.target.checked ? 'حالت تاریک فعال شد' : 'حالت روشن فعال شد');
});

/* ================= Background music settings ================= */
function renderMusicSettings(){
  const toggle = document.getElementById('musicToggle');
  const slider = document.getElementById('musicVolumeSlider');
  const num = document.getElementById('musicVolumeNum');
  const row = document.getElementById('musicVolumeRow');
  if(!toggle || !slider) return;
  toggle.checked = storeData.musicEnabled !== false;
  slider.value = storeData.musicVolume===undefined ? 35 : storeData.musicVolume;
  if(num) num.textContent = faDigits(slider.value);
  if(row) row.style.opacity = toggle.checked ? '1' : '.45';
  if(slider) slider.disabled = !toggle.checked;
}
document.getElementById('musicToggle').addEventListener('change', async (e)=>{
  storeData.musicEnabled = e.target.checked;
  saveData();
  renderMusicSettings();
  if(e.target.checked) await startMusic(); else stopMusic();
});
document.getElementById('musicVolumeSlider').addEventListener('input', (e)=>{
  storeData.musicVolume = parseInt(e.target.value, 10);
  const num = document.getElementById('musicVolumeNum');
  if(num) num.textContent = faDigits(e.target.value);
  applyMusicVolume();
});
document.getElementById('musicVolumeSlider').addEventListener('change', ()=>{
  saveData();
});

/* ================= Sound effect settings ================= */
function renderSfxSettings(){
  const toggle = document.getElementById('sfxToggle');
  const slider = document.getElementById('sfxVolumeSlider');
  const num = document.getElementById('sfxVolumeNum');
  const row = document.getElementById('sfxVolumeRow');
  if(!toggle || !slider) return;
  toggle.checked = storeData.sfxEnabled !== false;
  slider.value = storeData.sfxVolume===undefined ? 10 : storeData.sfxVolume;
  if(num) num.textContent = faDigits(slider.value);
  if(row) row.style.opacity = toggle.checked ? '1' : '.45';
  if(slider) slider.disabled = !toggle.checked;
}
document.getElementById('sfxToggle').addEventListener('change', (e)=>{
  storeData.sfxEnabled = e.target.checked;
  saveData();
  renderSfxSettings();
  if(e.target.checked) sfxTap();
});
document.getElementById('sfxVolumeSlider').addEventListener('input', (e)=>{
  storeData.sfxVolume = parseInt(e.target.value, 10);
  const num = document.getElementById('sfxVolumeNum');
  if(num) num.textContent = faDigits(e.target.value);
});
document.getElementById('sfxVolumeSlider').addEventListener('change', ()=>{
  saveData();
  sfxTap();
});

/* ================= Program length ================= */
function renderLengthSeg(){
  document.querySelectorAll('#lengthSeg button').forEach(b=>{
    b.classList.toggle('active', parseInt(b.dataset.len,10)===storeData.programLength);
    b.classList.toggle('seg-locked', parseInt(b.dataset.len,10)!==60 && !(storeData.premium || isInTrial()));
  });
}
document.querySelectorAll('#lengthSeg button').forEach(b=>{
  b.addEventListener('click', ()=>{
    const len = parseInt(b.dataset.len,10);
    if(len !== 60 && !requirePremium()) return;
    storeData.programLength = len;
    renderLengthSeg();
    saveData();
    render();
    showToast('طول برنامه تنظیم شد');
  });
});

/* ================= Program intensity ================= */
document.querySelectorAll('#intensitySeg button').forEach(b=>{
  b.addEventListener('click', ()=>{
    if(b.classList.contains('active')) return;
    if(b.dataset.intensity !== 'medium' && !requirePremium()) return;
    storeData.intensity = b.dataset.intensity;
    saveData();
    render();
    showToast('سبک برنامه تنظیم شد');
  });
});

/* ================= Reminders ================= */
let reminderInterval=null, remindersFiredKey=null;
function renderReminderUI(){
  document.getElementById('reminderToggle').checked = !!storeData.reminder.enabled;
  document.getElementById('reminderMorning').value = storeData.reminder.morning || '08:00';
  document.getElementById('reminderNight').value = storeData.reminder.night || '22:30';
  setupReminderInterval();
}
document.getElementById('reminderToggle').addEventListener('change', async (e)=>{
  storeData.reminder.enabled = e.target.checked;
  if(e.target.checked && 'Notification' in window && Notification.permission==='default'){
    try{ await Notification.requestPermission(); }catch(err){}
  }
  saveData();
  setupReminderInterval();
  scheduleDailyReminders();
  scheduleInactivityNudge();
});
['reminderMorning','reminderNight'].forEach(id=>{
  document.getElementById(id).addEventListener('change',(e)=>{
    storeData.reminder[id==='reminderMorning'?'morning':'night'] = e.target.value;
    saveData();
    scheduleDailyReminders();
  });
});
function setupReminderInterval(){
  clearInterval(reminderInterval);
  if(!storeData.reminder.enabled) return;
  reminderInterval = setInterval(()=>{
    const now = new Date();
    const hhmm = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    const fireKey = todayKey()+'_'+hhmm;
    if(fireKey===remindersFiredKey) return;
    if(hhmm===storeData.reminder.morning || hhmm===storeData.reminder.night){
      remindersFiredKey = fireKey;
      const msg = hhmm===storeData.reminder.morning ? 'صبح بخیر! چک‌لیست امروزت منتظرته 🌤️' : 'وقت مرور شبه — یادت نره ثبت کنی 🌙';
      showToast(msg);
      if('Notification' in window && Notification.permission==='granted'){
        try{ new Notification('یادآور برنامه ۹۰ روزه', {body:msg}); }catch(err){}
      }
    }
  }, 20000);
}

/* ================= Smart risk-hour reminders ================= */
// Shared accessor for the native plugin — returns null on web/browser preview so every
// notification feature below can safely no-op there without repeating this check.
function getLN(){
  const isNative = window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform();
  return isNative && Capacitor.Plugins ? Capacitor.Plugins.LocalNotifications : null;
}
// Suggestion pools, matched to the HALT tags already logged from the SOS flow.
const SMART_ALT_SUGGESTIONS = {
  hungry:  ['یه لیوان آب یا یه میان‌وعده‌ی سبک بخور', 'یه میوه دم دست بذار و همونو بخور'],
  angry:   ['۱۰ تا نفس عمیق بکش، ۴ ثانیه بگیر ۴ ثانیه بده', 'چند دقیقه فقط راه برو تا آروم بشی'],
  lonely:  ['به یه نفر از لیست حمایتی‌ت پیام بده یا زنگ بزن', 'یه تماس کوتاه با یکی از نزدیکات بگیر'],
  tired:   ['صورتتو با آب سرد بشور و چند دقیقه دراز بکش', 'اگه میشه یه چرت کوتاه بزن'],
  generic: ['یه دوش کوتاه بگیر', '۵ دقیقه ورزش سبک انجام بده', 'از همون اتاق/محیط فعلی برو بیرون', 'یه آهنگ خوب بذار و تمرکزتو عوض کن']
};
const SMART_REMINDER_IDS = [9101, 9102];

// Scores each hour (0-23) using the SOS urge log: recent + unresisted (slip) events count more.
function analyzeRiskHours(){
  const log = storeData.urgeLog || [];
  if(log.length < 5) return [];
  const now = Date.now();
  const scores = {};
  log.forEach(e=>{
    const ageDays = Math.max(0, (now - new Date(e.ts).getTime())/86400000);
    const recencyWeight = Math.exp(-ageDays/45);
    const severityWeight = e.resisted ? 1 : 2.2;
    scores[e.hour] = (scores[e.hour]||0) + recencyWeight*severityWeight;
  });
  return Object.keys(scores)
    .map(h=>({hour:parseInt(h,10), score:scores[h]}))
    .sort((a,b)=>b.score-a.score)
    .slice(0,2);
}

// Picks a coping suggestion based on whichever HALT tag most often accompanied urges at that hour.
function pickSmartSuggestion(hour){
  const log = (storeData.urgeLog||[]).filter(e=>e.hour===hour);
  const haltCounts = {hungry:0, angry:0, lonely:0, tired:0};
  log.forEach(e=>{ if(e.halt){ Object.keys(haltCounts).forEach(k=>{ if(e.halt[k]) haltCounts[k]++; }); } });
  const top = Object.keys(haltCounts).sort((a,b)=>haltCounts[b]-haltCounts[a])[0];
  const pool = haltCounts[top] > 0 ? SMART_ALT_SUGGESTIONS[top] : SMART_ALT_SUGGESTIONS.generic;
  return pool[Math.floor(Math.random()*pool.length)];
}

function renderSmartReminderUI(){
  const toggle = document.getElementById('smartReminderToggle');
  const offsetInput = document.getElementById('smartReminderOffset');
  const info = document.getElementById('smartReminderInfo');
  if(!toggle) return;
  toggle.checked = !!storeData.smartReminder.enabled;
  offsetInput.value = storeData.smartReminder.offsetMinutes || 20;
  const log = storeData.urgeLog || [];
  if(log.length < 5){
    info.textContent = `برای فعال‌سازی، حداقل ۵ بار وسوسه/لغزش رو از دکمه SOS ثبت کن (تا الان ${log.length} بار). هرچی بیشتر ثبت کنی، دقیق‌تر می‌شه.`;
    return;
  }
  const risk = analyzeRiskHours();
  if(risk.length===0){
    info.textContent = 'هنوز الگوی مشخصی پیدا نشده.';
  } else {
    const txt = risk.map(r=>String(r.hour).padStart(2,'0')+':00').join(' و ');
    info.textContent = `پرخطرترین ساعت(های) شناسایی‌شده: ${txt} — ${storeData.smartReminder.offsetMinutes||20} دقیقه قبلش بهت هشدار می‌دیم.`;
  }
}

// Schedules real OS-level notifications on native (Android) via Capacitor Local Notifications.
// No-ops silently in a plain browser tab — this feature only makes sense as a native background alert.
async function scheduleSmartReminders(){
  const plugin = getLN();
  if(!plugin) return;
  try{ await plugin.cancel({ notifications: SMART_REMINDER_IDS.map(id=>({id})) }); }catch(err){}
  if(!storeData.smartReminder.enabled) return;
  const risk = analyzeRiskHours();
  if(risk.length===0) return;
  try{
    const perm = await plugin.requestPermissions();
    if(perm.display !== 'granted') return;
  }catch(err){ return; }
  const offset = storeData.smartReminder.offsetMinutes || 20;
  const notifications = risk.map((r,idx)=>{
    const totalMin = ((r.hour*60 - offset) + 1440) % 1440;
    return {
      id: SMART_REMINDER_IDS[idx],
      title: '⚠️ لحظه‌ی حساس داره نزدیک می‌شه',
      body: 'طبق سابقه‌ت این ساعت‌ها معمولاً وسوسه سراغت میاد. ' + pickSmartSuggestion(r.hour),
      schedule: { on: { hour: Math.floor(totalMin/60), minute: totalMin%60 }, repeats: true }
    };
  });
  try{ await plugin.schedule({ notifications }); }catch(err){ console.error('scheduleSmartReminders failed', err); }
}

document.getElementById('smartReminderToggle').addEventListener('change', async (e)=>{
  storeData.smartReminder.enabled = e.target.checked;
  saveData();
  renderSmartReminderUI();
  scheduleSmartReminders();
});
document.getElementById('smartReminderOffset').addEventListener('change', (e)=>{
  let v = parseInt(e.target.value,10);
  if(isNaN(v)) v=20;
  v = Math.min(90, Math.max(5, v));
  storeData.smartReminder.offsetMinutes = v;
  saveData();
  renderSmartReminderUI();
  scheduleSmartReminders();
});

/* ================= Post-slip check-in (uses the smart-reminder toggle) ================= */
// One-time notification a few hours after a logged slip — a gentle nudge back to the "why",
// not another warning. Re-scheduling on a later slip just replaces this same id.
const POST_SLIP_ID = 9201;
const POST_SLIP_DELAY_MS = 3*60*60*1000; // 3 hours
async function schedulePostSlipCheckin(){
  const plugin = getLN();
  if(!plugin || !storeData.smartReminder.enabled) return;
  try{
    const perm = await plugin.requestPermissions();
    if(perm.display !== 'granted') return;
    const why = (storeData.whyText||'').trim();
    const body = why ? ('یادت باشه چرا شروع کردی: ' + why) : 'هرکی هستی، امروز دوباره فرصت داری. ادامه بده 💛';
    await plugin.schedule({ notifications:[{
      id: POST_SLIP_ID,
      title: 'یه سر بزن ببین حالت چطوره 💛',
      body,
      schedule: { at: new Date(Date.now()+POST_SLIP_DELAY_MS) }
    }] });
  }catch(err){ console.error('schedulePostSlipCheckin failed', err); }
}

/* ================= Daily morning/night reminders + streak-risk warning ================= */
// Upgrades the existing "یادآور هوشمند" morning/night times from a tab-only Notification
// into real native alarms. The night message is computed fresh each time this runs, so it
// stays accurate as long as the app is opened at least once that day (see call sites below).
const DAILY_REMINDER_IDS = { morning: 9401, night: 9402 };
function isTodayStreakSafe(){
  const done = Object.values(entry.done||{}).filter(Boolean).length
    + Object.values(entry.avoidDone||{}).filter(Boolean).length
    + Object.values(entry.momentDone||{}).filter(Boolean).length;
  const tot = entry.total || totalToday();
  return tot>0 && Math.round((done/tot)*100) >= 60;
}
async function scheduleDailyReminders(){
  const plugin = getLN();
  if(!plugin) return;
  try{ await plugin.cancel({ notifications:[{id:DAILY_REMINDER_IDS.morning},{id:DAILY_REMINDER_IDS.night}] }); }catch(err){}
  if(!storeData.reminder.enabled) return;
  try{
    const perm = await plugin.requestPermissions();
    if(perm.display !== 'granted') return;
  }catch(err){ return; }
  const [mh,mm] = (storeData.reminder.morning||'08:00').split(':').map(Number);
  const [nh,nm] = (storeData.reminder.night||'22:30').split(':').map(Number);
  const nightBody = isTodayStreakSafe()
    ? 'وقت مرور شبه — یادت نره ثبت کنی 🌙'
    : 'هنوز امروز رو کامل نکردی! استریکت داره از دست می‌ره ⚠️';
  const notifications = [
    { id:DAILY_REMINDER_IDS.morning, title:'صبح بخیر ☀️', body:'چک‌لیست امروزت منتظرته 🌤️', schedule:{ on:{hour:mh||8, minute:mm||0}, repeats:true } },
    { id:DAILY_REMINDER_IDS.night, title:'یادآور شبانه 🌙', body:nightBody, schedule:{ on:{hour:nh||22, minute:nm||30}, repeats:true } }
  ];
  try{ await plugin.schedule({ notifications }); }catch(err){ console.error('scheduleDailyReminders failed', err); }
}

/* ================= Streak milestone celebration ================= */
// Fires an immediate real notification (not just the in-app confetti) the first time the
// user's streak crosses 7 / 30 / 90 days.
const STREAK_MILESTONES = [7,30,90];
async function fireInstantNotification(idSuffix, title, body){
  const plugin = getLN();
  if(!plugin) return;
  try{
    const perm = await plugin.requestPermissions();
    if(perm.display !== 'granted') return;
    await plugin.schedule({ notifications:[{ id:9500+idSuffix, title, body, schedule:{ at:new Date(Date.now()+1500) } }] });
  }catch(err){ console.error('fireInstantNotification failed', err); }
}
function checkStreakMilestone(streak){
  if(!storeData.streakMilestonesHit) storeData.streakMilestonesHit = {};
  STREAK_MILESTONES.forEach((m,idx)=>{
    if(streak>=m && !storeData.streakMilestonesHit[m]){
      storeData.streakMilestonesHit[m] = true;
      saveData();
      fireInstantNotification(idx, '🏆 '+toFa(m)+' روز پیاپی!', 'داری فوق‌العاده پیش می‌ری، همینجوری ادامه بده.');
      if(m===7 && !storeData.premium){
        showCelebration({emoji:'🏆', title:toFa(7)+' روز پیاپی!',
          text:'یه هفته‌ی کامل پایبند موندی — این خیلی چیز کمی نیست 👏 اگه دوست داشتی این مسیرو با امکانات کامل‌تر ادامه بدی، نسخه‌ی پرمیوم همیشه تو منو منتظرته 🌟'});
        pendingInviteNudgeReason = 'streak7';
      }
    }
  });
}

/* ================= Inactivity nudge (uses the basic reminder toggle) ================= */
// Rescheduled 2 days into the future every time the app opens, so it only actually fires
// if the user doesn't come back within that window. Body text is personalized from their
// best streak / stated "why" — a specific message lands better than a generic "come back".
const INACTIVITY_ID = 9301;
function inactivityNudgeCopy(){
  const name = (storeData.profile && storeData.profile.firstName) ? storeData.profile.firstName.trim() : '';
  const namePart = name ? (name+'، ') : '';
  const maxStreak = storeData.maxStreak || 0;
  const why = (storeData.whyText||'').trim();
  if(maxStreak >= 3){
    return namePart+toFa(maxStreak)+' روز پیاپی رو قبلاً رد کردی — یعنی از پسش برمیای. دو روزه نیومدی، یه سر بزن.';
  }
  if(why){
    return namePart+'یادت باشه چرا شروع کردی: «'+why.slice(0,60)+(why.length>60?'…':'')+'». دو روزه نیومدی سر بزنی.';
  }
  return 'چند روزه نیومدی سر بزنی؛ یه نگاه به برنامه‌ت بنداز.';
}
async function scheduleInactivityNudge(){
  const plugin = getLN();
  if(!plugin) return;
  try{ await plugin.cancel({ notifications:[{id:INACTIVITY_ID}] }); }catch(err){}
  if(!storeData.reminder.enabled) return;
  try{
    const perm = await plugin.requestPermissions();
    if(perm.display !== 'granted') return;
    const at = new Date(Date.now() + 2*24*60*60*1000);
    at.setHours(19,0,0,0);
    await plugin.schedule({ notifications:[{ id:INACTIVITY_ID, title:'دلمون برات تنگ شده 👋', body:inactivityNudgeCopy(), schedule:{ at } }] });
  }catch(err){ console.error('scheduleInactivityNudge failed', err); }
}

/* ================= Content Library ================= */
const LIBRARY = {
  p1: [
    {title:'چرا اول باید ریتم بدنت رو درست کنی', body:'بیدار شدن و خوابیدن سر ساعت مشخص، ساعت بدنت (ریتم شبانه‌روزی) رو تنظیم می‌کنه. وقتی این ریتم بهم می‌ریزه، انرژی، تمرکز و کنترل تصمیم‌گیری هم افت می‌کنه. هفته اول فقط روی همین تمرکز کن.'},
    {title:'قدرت یه لیوان آب صبح', body:'بدن بعد از چند ساعت خواب کمی کم‌آب شده. یه لیوان آب بلافاصله بعد بیدار شدن، متابولیسم و هوشیاری ذهنی رو سریع‌تر فعال می‌کنه؛ یه عادت کوچیک با تأثیر واقعی.'},
    {title:'پیاده‌روی کوتاه، اثر بزرگ', body:'۱۰ تا ۱۵ دقیقه پیاده‌روی، به‌خصوص زیر نور روز، سطح انرژی و خلق‌وخو رو بهتر می‌کنه و به مغز کمک می‌کنه ریتم بیداری رو بهتر بشناسه.'},
    {title:'گفتگوی واقعی، نه پیام', body:'یه مکالمه‌ی حضوری یا تلفنی کوتاه، چیزی رو فعال می‌کنه که پیام دادن نمی‌تونه: حس واقعی ارتباط. این حس دقیقاً همون چیزیه که وقتی تنها می‌مونی جاش خالیه.'}
  ],
  p2: [
    {title:'عادت‌ها با تکرار جا می‌افتن، نه با انگیزه', body:'انگیزه روز به روز بالا و پایین می‌شه، ولی تکرار یه کار ساده در یه زمان مشخص، اون رو به‌مرور خودکار می‌کنه. هدف این مرحله همینه: خودکار کردن، نه فقط «حال داشتن».'},
    {title:'ورزش سبک و شیمی مغز', body:'۲۵ تا ۳۰ دقیقه پیاده‌روی سریع یا ورزش سبک، اندورفین و دوپامین طبیعی بدن رو آزاد می‌کنه؛ همون حس خوبی که خیلی وقت‌ها دنبالش می‌گردیم، ولی این نسخه‌ی سالمشه.'},
    {title:'محدود کردن گوشی بدون حذف کامل', body:'به‌جای قطع کامل، محدودکردن زمان آزاد گوشی واقعی‌تر و پایدارتره. مغز به محدودیت تدریجی بهتر از ممنوعیت ناگهانی جواب می‌ده.'},
    {title:'یادداشت روزانه، آینه‌ی ذهنته', body:'نوشتن حتی دو خط درباره‌ی روزت، الگوهای فکری‌ای رو نشونت می‌ده که معمولاً نمی‌بینی. بعد از چند هفته، این یادداشت‌ها خودشون تبدیل به یه نقشه راه می‌شن.'}
  ],
  p3: [
    {title:'هدف‌گذاری کوچیک، پیشرفت بزرگ', body:'یه هدف کوچیک روزانه (کاری یا شخصی) باعث می‌شه مغزت هر روز طعم «تمام‌شدن» رو بچشه. این حس موفقیت، خودش یه نوع پاداش سالمه.'},
    {title:'خواب قبل از نیمه‌شب چه فرقی داره', body:'ساعات اولیه‌ی خواب (قبل از نیمه‌شب) بیشترین سهم رو در ترمیم فیزیکی و ذهنی بدن دارن. خواب دیرهنگام، حتی با همون تعداد ساعت، کیفیت پایین‌تری داره.'},
    {title:'تعامل اجتماعی معنادار یعنی چی', body:'لازم نیست مهمونی بگیری؛ یه گفتگوی عمیق با یه نفر، بیشتر از چندین تعامل سطحی روی حس تعلق اثر می‌ذاره.'},
    {title:'نوشتن نقطه قوت، نه فقط ایراد', body:'وقتی هر روز یه نقطه قوت رو یادداشت می‌کنی، مغزت یاد می‌گیره پیشرفت رو ببینه، نه فقط کمبودها رو. این تغییر نگاه، انگیزه رو پایدارتر می‌کنه.'}
  ],
  p4: [
    {title:'از تمرین به روتین', body:'وقتی یه کار رو بدون یادآوری انجام می‌دی، یعنی به مرحله‌ی خودکارشدن رسیده. این دقیقاً هدف این فاز از برنامه‌ست: کم‌کردن نیاز به اراده‌ی آگاهانه.'},
    {title:'برنامه غذایی منظم و انرژی پایدار', body:'وعده‌های نامنظم باعث نوسان قند خون و در نتیجه نوسان خلق‌وخو و تمرکز می‌شن. سه وعده منظم، پایه‌ی ثبات روزانه‌ست.'},
    {title:'کنترل کامل زمان صفحه، نه حذف کامل', body:'هدف نهایی محدودیت گوشی، رسیدن به یه استفاده‌ی آگاهانه‌ست، نه زندگی بدون تکنولوژی. تفاوت مهمه: کنترل، نه انکار.'},
    {title:'چرا این مرحله سخت‌تر به نظر می‌رسه', body:'بعد از هیجان اولیه، خیلی‌ها همینجا افت انگیزه رو تجربه می‌کنن. این طبیعیه؛ نشونه‌ی شکست نیست، نشونه‌ی اینه که داری از انگیزه به انضباط می‌رسی.'}
  ],
  p5: [
    {title:'وقتی روتین صبح دیگه فکر نمی‌خواد', body:'اگه صبح‌ها دیگه با خودت کلنجار نمی‌ری که «بلند شم یا نه»، یعنی مغزت مسیر جدید رو به‌عنوان پیش‌فرض پذیرفته. این بزرگ‌ترین دستاورد این مرحله‌ست.'},
    {title:'اهداف بلندمدت رو دوباره مرور کن', body:'حالا که پایه‌ها جا افتاده، وقتشه ببینی این عادت‌های جدید چطور به هدف‌های بزرگ‌تر زندگیت (کاری، جسمی، رابطه‌ای) وصل می‌شن.'},
    {title:'ارتباطات پایدار، نه فقط لحظه‌ای', body:'حفظ ارتباط اجتماعی به‌صورت مستمر، نه فقط یه‌بار در ماه، حسی از تعلق واقعی می‌سازه که در روزهای سخت پشتیبانته.'},
    {title:'رشد یعنی چی در این مرحله', body:'یادداشت رشد هفتگی کمکت می‌کنه ببینی از کجا شروع کردی. این مقایسه با خودِ گذشته، مهم‌ترین منبع انگیزه‌ی این مرحله‌ست.'}
  ],
  peak: [
    {title:'به قله که رسیدی، سفر تموم نمی‌شه', body:'رسیدن به روز ۹۰ (یا هر عددی که انتخاب کردی) پایان مسیر نیست؛ یعنی الان می‌تونی مسیر رو با آگاهی کامل ادامه بدی، نه با تلاش سنگین اولیه.'},
    {title:'چطور از این نسخه محافظت کنی', body:'حالا هدف اینه که این عادت‌ها رو حفظ کنی، نه اینکه دوباره از صفر شروع کنی. مرور دوره‌ای دلیل شروعت، بهترین محافظ در برابر برگشتنه.'},
    {title:'به خودت افتخار کن', body:'۹۰ روز پشتکار واقعیه، نه شانس. هر روزی که تیک زدی، یه انتخاب آگاهانه بود. این رو دست‌کم نگیر.'}
  ]
};
const LIB_QUOTES = [
  'پیشرفت همیشه بلند نیست؛ گاهی فقط یعنی امروز باز نگه‌داشتنِ مسیریه که دیروز باز کردی.',
  'انگیزه جرقه‌ست، عادت آتیشیه که خودش می‌سوزه. جرقه رو نگه‌دار تا آتیش بگیره.',
  'هر بار که «نه» گفتی به یه عادت قدیمی، یه رأی به هویت جدیدت دادی.',
  'راحت‌ترین روزها همونایی‌ان که هیچ‌کس نمی‌بینه چقدر سختن.',
  'قرار نیست کامل باشی؛ قراره ادامه بدی.',
  'مسیر تغییر، خط راست نیست؛ یه فنر رو به بالاست.',
  'بزرگ‌ترین دشمن پیشرفت، مقایسه با روزیه که هنوز شروع نکرده بودی.',
  'هر روزی که تیک زدی، یه انتخاب آگاهانه بود، نه شانس.',
  'استراحت با تسلیم فرق داره؛ اولی برای فرداست، دومی برای هیچ‌وقت.',
  'چیزی که مدام تکرارش می‌کنی، همونیه که آخرش می‌شی.',
  'صبر یعنی همچنان تلاش‌کردن وقتی نتیجه‌ش رو هنوز نمی‌بینی.',
  'ذهن راحت‌طلبه؛ کار تو اینه که هر روز یه‌کم باهاش مذاکره کنی، نه اینکه شکستش بدی.',
  'یه لغزش فقط یه داده‌ست، نه یه حکم.',
  'کوچیک‌ترین قدم امروز، از بزرگ‌ترین برنامه‌ی فرداهای نیومده ارزشمندتره.',
  'خستگی نشونه‌ی ضعف نیست؛ نشونه‌ی اینه که واقعاً داری تلاش می‌کنی.',
  'هیچ‌کس با یه روز خوب عوض نشد؛ با هزار روز معمولی که تسلیم نشد.',
  'حالِ آینده‌ت، همین الان داره ساخته می‌شه.',
  'انضباط یعنی به خودِ آینده‌ت قول بدی و امروز بهش عمل کنی.',
  'وقتی دلیل بزرگه، سختی‌های راه کوچیک می‌شن.',
  'رشد همیشه با احساس خوب همراه نیست؛ گاهی با احساس ناراحتیِ درست همراهه.',
  'خودت رو با کسی که بودی مقایسه کن، نه با کسی که فکر می‌کنی باید باشی.',
  'هر بار که سخت بود و بازم ادامه دادی، یه لایه‌ی جدید از قدرت به خودت اضافه کردی.',
  'مسیر رو کسی برات هموار نمی‌کنه؛ ولی هر قدمی که برمی‌داری، خودش هموارترش می‌کنه.',
  'امروز فقط باید بهتر از دیروز باشی، نه بهترین.'
];
const LIB_COURSES = [
  {
    id:'urgeSurf', emoji:'🌊', title:'۵ روز برای کنار اومدن با میل ناگهانی',
    lessons:[
      {title:'میل، یه موج ثابته نیست', body:'میل ناگهانی معمولاً حس می‌شه که همیشه همون شدته، ولی واقعیت اینه که مثل یه موجه: بالا میاد، به اوج می‌رسه، و اگه باهاش نجنگی، خودش پایین میاد. معمولاً کل این چرخه بین ۱۰ تا ۲۰ دقیقه طول می‌کشه، نه بیشتر. امروز فقط همینو بدون: تو نباید میل رو از بین ببری، فقط باید تا وقتی موج پایین بیاد دووم بیاری.'},
      {title:'اسمشو بذار، دنبالش نرو', body:'وقتی میل میاد، اولین قدم اینه که فقط تو ذهنت بگی «این یه میله». همین برچسب‌زدن ساده، یه فاصله‌ی کوچیک بین تو و اون حس ایجاد می‌کنه. لازم نیست باهاش بجنگی یا وانمود کنی نیست؛ فقط بگو چیه، و بذار همون‌جا بمونه، بدون اینکه دنبالش بری.'},
      {title:'بدنت رو جابه‌جا کن', body:'وقتی ذهن گیر می‌کنه، بدن راه فراره. چند تا شنا، یه دوش آب سرد، یه پیاده‌روی تند — هرکدوم که در دسترسه. حرکت فیزیکی توجه رو از حلقه‌ی فکری بیرون می‌کشه و به بدنت کمک می‌کنه انرژی میل رو یه‌جای دیگه خرج کنه.'},
      {title:'پنج دقیقه رو معامله کن، نه کل شب رو', body:'وقتی میل قویه، قول‌دادن «تا آخر عمر نه» ترسناکه و مغز در برابرش مقاومت می‌کنه. به‌جاش فقط با خودت پنج دقیقه معامله کن: «فقط پنج دقیقه صبر می‌کنم». اکثر وقت‌ها همون پنج دقیقه کافیه که موج بشکنه.'},
      {title:'بعدش چی؟ خودتو نگاه کن', body:'چه رد کردی چه نه، بعد از هر بار مواجهه با میل، دو خط بنویس: چی باعثش شد، و چیکار کردی. این یادداشت‌ها بعد از چند هفته یه الگو بهت نشون می‌دن — کِی و کجا بیشتر آسیب‌پذیری، و همین شناخت، خودش نصف راه مقابله‌ست.'}
    ]
  },
  {
    id:'restart', emoji:'🔄', title:'۳ روز برای شروع دوباره بعد از یه لغزش',
    lessons:[
      {title:'یه لغزش، پایان مسیر نیست', body:'یه روز بد یا یه لغزش، خط پایان نیست؛ فقط یه نقطه‌ست رو یه مسیر بلندتر. مغزی که فکر می‌کنه «همه‌چیز خراب شد، دیگه چه فرقی می‌کنه» دقیقاً همون مغزیه که مسیر برگشت رو سخت‌تر می‌کنه. امروز فقط اینو بپذیر: دیروز تموم شد، امروز یه روز جدیده.'},
      {title:'با خودت مثل یه دوست حرف بزن', body:'بعد از لغزش، خیلی‌ها با خودشون خیلی سخت‌گیرتر از چیزی حرف می‌زنن که با یه دوست حرف می‌زنن. اگه دوستت لغزیده بود چی بهش می‌گفتی؟ همون جمله‌ها رو به خودت بگو. مهربونی با خود، نه سرزنش، احتمال برگشت سریع‌تر رو بیشتر می‌کنه، نه کمتر.'},
      {title:'یه قدم کوچیک، همین امروز', body:'به‌جای برنامه‌ریزی برای «از فردا همه‌چیز عالی می‌شه»، همین امروز یه کار کوچیک انجام بده: یه چک‌لیست رو تیک بزن، یه پیاده‌روی کوتاه برو، یه ساعت گوشی رو کنار بذار. مسیر برگشت با قدم‌های کوچیک ساخته می‌شه، نه با تصمیم‌های بزرگ.'}
    ]
  }
];
function renderLibrary(){
  const list = document.getElementById('libraryList');
  const tag = document.getElementById('libPhaseTag');
  if(!list || !tag) return;
  tag.textContent = 'مرحله فعلی: ' + currentPhase.name;
  const items = LIBRARY[currentPhase.key] || [];
  list.innerHTML = items.map(a=>`<div class="lib-card"><h4>${a.title}</h4><p>${a.body}</p></div>`).join('');
  updateLibraryCoach();
  renderLibQuote();
  renderLibCourses();
  renderLibWeekly();
}
function renderLibDeep(){
  const box = document.getElementById('libDeepResult');
  const key = currentPhase.key;
  const saved = storeData.libraryDeepDive[key];
  if(!saved){ box.style.display='none'; return; }
  box.textContent = saved;
  box.style.display = 'block';
}
document.getElementById('libDeepBtn').addEventListener('click', async ()=>{
  if(!gateAIFeature('libDeep')) return;
  const btn = document.getElementById('libDeepBtn');
  btn.disabled = true; btn.textContent = 'در حال نوشتن...';
  try{
    const sys = personaSystemPrompt("تو یه مربی سبک‌زندگی سالم و متخصص عادت‌سازی هستی، لحن گرم و انگیزشی ولی مبتنی بر واقعیت داری.");
    const prompt = `کاربر الان تو مرحله «${currentPhase.name}» از یه برنامه ${storeData.programLength} روزه تغییر عادته (روز ${programDay()}).
دلیل شخصی‌اش برای این مسیر: "${storeData.whyText || 'ثبت نشده'}".
یه متن مطالعاتی اختصاصی (حدود ۶ تا ۸ جمله فارسی) بنویس که دقیقاً برای همین مرحله، همین هدف و همین عادت‌هایی که روشون کار می‌کنه کاربردی باشه: چرا این مرحله مهمه، چه دام‌های ذهنی‌ای معمولاً توش پیش میاد، و یه توصیه عملی مشخص. لحن مثل یه کتاب یا مقاله‌ی الهام‌بخش باشه، نه لیست. فقط متن رو بنویس، بدون هیچ عنوان یا JSON.`;
    const __auth = await authHeaders();
    const response = await fetch("https://groq-proxy.mahdihd648.workers.dev", {
      method:"POST", headers: Object.assign({"Content-Type":"application/json"}, __auth),
      body: JSON.stringify({ feature: "libDeep", max_tokens:700, system: sys, messages:[{role:"user", content:prompt}] })
    });
    const data = await response.json();
    if(!response.ok){
      handleAiWorkerError(response, data);
      return;
    }
    const rawText = (data.reply || '').trim();
    storeData.libraryDeepDive[currentPhase.key] = rawText;
    saveData();
    markAIFeatureUsed('libDeep');
    renderLibDeep();
    showToast('آماده شد', 'success');
  }catch(err){
    console.error(err);
    showToast('مشکلی پیش اومد، دوباره امتحان کن', 'error');
  }finally{
    btn.disabled = false;
    btn.textContent = storeData.libraryDeepDive[currentPhase.key] ? '🔄 دوباره بنویس' : 'بنویس برام';
  }
});

/* ---- Library: quote of the day ---- */
function libHashStr(s){
  let h = 0;
  for(let i=0;i<s.length;i++){ h = (h*31 + s.charCodeAt(i)) >>> 0; }
  return h;
}
function renderLibQuote(){
  const el = document.getElementById('libQuoteText');
  if(!el) return;
  const idx = libHashStr(today) % LIB_QUOTES.length;
  el.textContent = LIB_QUOTES[idx];
}

/* ---- Library: short step-by-step courses ---- */
function getCourseProgress(id){
  if(!storeData.courseProgress) storeData.courseProgress = {};
  if(!storeData.courseProgress[id]) storeData.courseProgress[id] = {current:0, completed:[]};
  return storeData.courseProgress[id];
}
function renderLibCourses(){
  const wrap = document.getElementById('libCourseList');
  if(!wrap) return;
  wrap.innerHTML = LIB_COURSES.map(c=>{
    const prog = getCourseProgress(c.id);
    const total = c.lessons.length;
    const doneCount = prog.completed.length;
    const pct = Math.round(doneCount/total*100);
    const isDone = doneCount >= total;
    const statusText = isDone ? 'تموم شد ✅' : (doneCount>0 ? (toFa(doneCount)+' از '+toFa(total)+' درس') : (toFa(total)+' درس'));
    return '<div class="lib-course-card'+(isDone?' done':'')+'" data-course="'+c.id+'">'
      + '<div class="lib-course-top">'
      + '<span class="lib-course-emoji">'+c.emoji+'</span>'
      + '<div class="lib-course-info"><div class="lib-course-title">'+escapeHtml(c.title)+'</div><div class="lib-course-status">'+statusText+'</div></div>'
      + '<span class="lib-course-arrow">‹</span>'
      + '</div>'
      + '<div class="lib-course-track"><div class="lib-course-fill" style="width:'+pct+'%"></div></div>'
      + '</div>';
  }).join('');
  wrap.querySelectorAll('.lib-course-card').forEach(card=>{
    card.addEventListener('click', ()=> openLibLesson(card.dataset.course));
  });
}
let libLessonCourseId = null, libLessonIdx = 0;
function openLibLesson(courseId){
  const course = LIB_COURSES.find(c=>c.id===courseId);
  if(!course) return;
  libLessonCourseId = courseId;
  const prog = getCourseProgress(courseId);
  libLessonIdx = Math.min(prog.current||0, course.lessons.length-1);
  renderLibLesson();
  document.getElementById('libLessonOverlay').classList.add('show');
}
function closeLibLesson(){
  document.getElementById('libLessonOverlay').classList.remove('show');
}
function renderLibLesson(){
  const course = LIB_COURSES.find(c=>c.id===libLessonCourseId);
  if(!course) return;
  const prog = getCourseProgress(course.id);
  const lesson = course.lessons[libLessonIdx];
  document.getElementById('libLessonCourseTitle').textContent = course.title;
  document.getElementById('libLessonEmoji').textContent = course.emoji;
  document.getElementById('libLessonTitle').textContent = 'روز ' + toFa(libLessonIdx+1) + ' — ' + lesson.title;
  document.getElementById('libLessonBody').textContent = lesson.body;
  document.getElementById('libLessonDots').innerHTML = course.lessons.map((_,i)=>{
    let cls = '';
    if(prog.completed.includes(i)) cls = 'done';
    else if(i===libLessonIdx) cls = 'current';
    return '<span class="lib-lesson-dot ' + cls + '"></span>';
  }).join('');
  document.getElementById('libLessonPrevBtn').style.visibility = libLessonIdx>0 ? 'visible' : 'hidden';
  const nextBtn = document.getElementById('libLessonNextBtn');
  const isLast = libLessonIdx === course.lessons.length-1;
  const alreadyDone = prog.completed.includes(libLessonIdx);
  nextBtn.textContent = isLast ? (alreadyDone ? 'بستن ✅' : 'پایان دوره 🎉') : 'بعدی ▶';
}
document.getElementById('libLessonCloseBtn').addEventListener('click', closeLibLesson);
document.getElementById('libLessonPrevBtn').addEventListener('click', ()=>{
  if(libLessonIdx>0){ libLessonIdx--; renderLibLesson(); }
});
document.getElementById('libLessonNextBtn').addEventListener('click', ()=>{
  const course = LIB_COURSES.find(c=>c.id===libLessonCourseId);
  if(!course) return;
  const prog = getCourseProgress(course.id);
  const isLast = libLessonIdx === course.lessons.length-1;
  const wasAlreadyDone = prog.completed.includes(libLessonIdx);
  if(!wasAlreadyDone){
    prog.completed.push(libLessonIdx);
    prog.current = Math.min(libLessonIdx+1, course.lessons.length-1);
    saveData();
    renderXP();
    renderLibCourses();
    sfxPop();
  }
  if(isLast){
    if(!wasAlreadyDone && prog.completed.length >= course.lessons.length){
      sfxSuccess();
      if(typeof launchConfetti === 'function') launchConfetti();
      showToast('دوره‌ی «' + course.title + '» تموم شد 🎉', 'success');
    }
    closeLibLesson();
    return;
  }
  libLessonIdx++;
  renderLibLesson();
});

/* ---- Library: weekly deep-dive article (time-based, not just phase-based) ---- */
const LIB_WEEKLY_THEMES = [
  'انگیزه و اینکه چرا روزهای بدون انگیزه هم می‌شه ادامه داد',
  'انضباط در مقابل تصمیم لحظه‌ای',
  'چطور بعد از یه لغزش یا روز بد دوباره برگردی',
  'رابطه‌ی با خودت و مهربانی با خودت',
  'معنا و هدف پشت این مسیر تغییر',
  'صبر و نتایجی که دیر ولی پایدار میان',
  'قدرت عادت‌های کوچیک روزانه',
  'مقایسه با خودِ گذشته، نه با دیگران',
  'چطور با میل‌های ناگهانی و لحظه‌ای کنار بیای',
  'اهمیت استراحت واقعی در کنار تلاش'
];
function libWeekNumber(){
  const day = programDay();
  return day > 0 ? Math.ceil(day/7) : 1;
}
function libWeekKey(){ return 'w' + libWeekNumber(); }
function renderLibWeekly(){
  const box = document.getElementById('libWeeklyResult');
  const tag = document.getElementById('libWeekTag');
  const btn = document.getElementById('libWeeklyBtn');
  if(!box || !btn) return;
  const week = libWeekNumber();
  if(tag){ tag.textContent = 'هفته‌ی ' + toFa(week) + ' مسیرت'; tag.style.display = 'inline-block'; }
  const saved = storeData.libraryWeekly[libWeekKey()];
  if(!saved){ box.style.display='none'; btn.textContent = 'بنویس برام'; return; }
  box.textContent = saved;
  box.style.display = 'block';
  btn.textContent = '🔄 دوباره بنویس';
}
document.getElementById('libWeeklyBtn').addEventListener('click', async ()=>{
  if(!gateAIFeature('libWeekly')) return;
  const btn = document.getElementById('libWeeklyBtn');
  btn.disabled = true; btn.textContent = 'در حال نوشتن...';
  try{
    const week = libWeekNumber();
    const theme = LIB_WEEKLY_THEMES[(week-1) % LIB_WEEKLY_THEMES.length];
    const sys = personaSystemPrompt("تو یه نویسنده و مربی سبک‌زندگی سالم هستی که مقاله‌های الهام‌بخش و عمیق می‌نویسی، نه لیست‌های خشک.");
    const prompt = `کاربر الان هفته‌ی ${week} از مسیر ${storeData.programLength} روزه‌ی تغییر عادتشه (روز ${programDay()}، مرحله «${currentPhase.name}»).
دلیل شخصی‌اش برای این مسیر: "${storeData.whyText || 'ثبت نشده'}".
یه مقاله‌ی نسبتاً بلند و عمیق فارسی (حدود ۱۴ تا ۱۸ جمله، در چند پاراگراف کوتاه) درباره‌ی محور «${theme}» بنویس که برای همین مرحله از مسیرش کاربردی باشه. لحن مثل یه مقاله یا فصل کتاب باشه، عمیق و فکرشده، نه لیست عددی و نه شعاری. فقط متن مقاله رو بنویس، بدون عنوان، بدون JSON.`;
    const __auth = await authHeaders();
    const response = await fetch("https://groq-proxy.mahdihd648.workers.dev", {
      method:"POST", headers: Object.assign({"Content-Type":"application/json"}, __auth),
      body: JSON.stringify({ feature: "libWeekly", max_tokens:1400, system: sys, messages:[{role:"user", content:prompt}] })
    });
    const data = await response.json();
    if(!response.ok){
      handleAiWorkerError(response, data);
      return;
    }
    const rawText = (data.reply || '').trim();
    storeData.libraryWeekly[libWeekKey()] = rawText;
    saveData();
    markAIFeatureUsed('libWeekly');
    renderLibWeekly();
    renderXP();
    showToast('آماده شد', 'success');
  }catch(err){
    console.error(err);
    showToast('مشکلی پیش اومد، دوباره امتحان کن', 'error');
  }finally{
    btn.disabled = false;
    if(btn.textContent === 'در حال نوشتن...'){
      btn.textContent = storeData.libraryWeekly[libWeekKey()] ? '🔄 دوباره بنویس' : 'بنویس برام';
    }
  }
});

/* ================= Export / Backup ================= */
document.getElementById('exportJsonBtn').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(storeData, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'checklist-backup-'+today+'.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('بکاپ دانلود شد');
});
document.getElementById('importJsonBtn').addEventListener('click', ()=>{
  document.getElementById('importJsonInput').click();
});
document.getElementById('importJsonInput').addEventListener('change', (e)=>{
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if(!file) return;
  if(!confirm('بازیابی از این فایل، اطلاعات فعلی گوشی رو جایگزین می‌کنه. مطمئنی؟')) return;
  const reader = new FileReader();
  reader.onload = async ()=>{
    try{
      const parsed = JSON.parse(reader.result);
      if(!parsed || typeof parsed !== 'object') throw new Error('invalid');
      storeData = parsed;
      normalizeAndRenderStoreData();
      await window.storage.set('checklist:data', JSON.stringify(storeData));
      pushCloudData();
      showToast('اطلاعات با موفقیت بازیابی شد', 'success');
    }catch(err){ showToast('این فایل معتبر نیست', 'error'); }
  };
  reader.onerror = ()=> showToast('خوندن فایل با خطا مواجه شد', 'error');
  reader.readAsText(file);
});
document.getElementById('printReportBtn').addEventListener('click', ()=>{
  // قبلاً این‌جا دستی 'active' رو به همه‌ی .tab-panel اضافه می‌کرد و بعد از چاپ فقط رو
  // tab-today می‌ذاشت — یعنی اگه چاپ از وسط بخش عمومی یا یه ساب‌پیج دیگه زده می‌شد (یا
  // مرورگر print رو غیرهم‌زمان اجرا می‌کرد)، بدون خبر دادن به setAppMode/currentAppMode
  // و بدون تماس با assertModeSeparation، صفحه رو زوری می‌برد رو تب «امروز» درحالی که نوار
  // بالا/پایین دست‌نخورده می‌موند — همون باگِ «صفحه‌ها به‌هم بخورن». کاملاً هم غیرضروری بود:
  // قانون `@media print{ .tab-panel{display:block!important;} }` تو CSS از قبل موقع چاپ
  // همه‌ی پنل‌ها رو نشون می‌ده، بدون این‌که کلاس active هیچ پنلی رو دست بزنه.
  window.print();
});

/* ================= Meditation (breathing + ambient soundscapes, ported) ================= */
const BREATH_PATTERNS = {
  simple: [ {label:'دم بگیر 🫁', type:'in',  sec:4}, {label:'آروم بده بیرون', type:'out', sec:6} ],
  box:    [ {label:'دم بگیر 🫁', type:'in',  sec:4}, {label:'نگه دار', type:'hold', sec:4},
            {label:'بده بیرون', type:'out', sec:4}, {label:'نگه دار', type:'hold', sec:4} ],
  calm:   [ {label:'دم بگیر 🫁', type:'in',  sec:4}, {label:'نگه دار', type:'hold', sec:7},
            {label:'آروم بده بیرون', type:'out', sec:8} ]
};
const MED_TRACKS = [
  {id:'pad',   emoji:'🎹', title:'پد آرام',      sub:'یه آکورد نرم و مداوم برای تمرکز'},
  {id:'bowl',  emoji:'🔔', title:'زنگ تبتی',     sub:'ضربه‌های آروم کاسه‌ی تبتی با یه زمینه‌ی محو'},
  {id:'rain',  emoji:'🌧️', title:'باران ملایم',  sub:'صدای بارش نرم برای آرامش ذهن'},
  {id:'ocean', emoji:'🌊', title:'امواج دریا',    sub:'موج‌های آهسته‌ی دریا، مثل نفس‌کشیدن طبیعت'}
];
let medDuration = 5, medPattern = 'simple', medSelectedTrack = 'pad', medRunning = false;
let medSecondsLeft = 300, medPhaseIdx = 0, medPhaseTimeout = null, medCountdownInterval = null;
let medAudioCtx = null, medMasterGain = null, medTrackNodes = [], medBellInterval = null;

function medFormatTime(totalSec){
  const m = Math.floor(totalSec/60), s = totalSec%60;
  return toFa(String(m).padStart(2,'0'))+':'+toFa(String(s).padStart(2,'0'));
}
function renderMedTrackList(){
  const wrap = document.getElementById('medTrackList');
  if(!wrap) return;
  wrap.innerHTML = MED_TRACKS.map(t=>`
    <div class="track-card${t.id===medSelectedTrack?' active':''}" data-track="${t.id}">
      <div class="t-emoji">${t.emoji}</div>
      <div class="t-info"><div class="t-title">${t.title}</div><div class="t-sub">${t.sub}</div></div>
      <div class="t-radio"></div>
    </div>`).join('');
  wrap.querySelectorAll('.track-card').forEach(card=>{
    card.addEventListener('click', ()=>{
      medSelectedTrack = card.dataset.track;
      wrap.querySelectorAll('.track-card').forEach(c=>c.classList.remove('active'));
      card.classList.add('active');
      if(medRunning){ stopMedTrack(); startMedTrack(medSelectedTrack); }
    });
  });
}
document.getElementById('medDurationSeg').querySelectorAll('button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(medRunning) return;
    medDuration = parseInt(btn.dataset.min,10);
    document.getElementById('medDurationSeg').querySelectorAll('button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('medTimer').textContent = medFormatTime(medDuration*60);
  });
});
document.getElementById('medPatternSeg').querySelectorAll('button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(medRunning) return;
    medPattern = btn.dataset.pattern;
    document.getElementById('medPatternSeg').querySelectorAll('button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  });
});
function medCreateNoiseBuffer(ctx){
  const bufferSize = 2*ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0;i<bufferSize;i++) data[i] = Math.random()*2-1;
  return buffer;
}
function startMedTrack(trackId){
  if(!medAudioCtx){ medAudioCtx = new (window.AudioContext||window.webkitAudioContext)(); }
  medMasterGain = medAudioCtx.createGain();
  medMasterGain.gain.value = 0.06;
  medMasterGain.connect(medAudioCtx.destination);
  medTrackNodes = [medMasterGain];
  if(trackId === 'pad'){
    const freqs = [174.61, 220.00, 261.63];
    freqs.forEach((f, idx)=>{
      const osc = medAudioCtx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = f;
      const gain = medAudioCtx.createGain(); gain.gain.value = 0.05;
      const lfo = medAudioCtx.createOscillator(); lfo.frequency.value = 0.04 + idx*0.015;
      const lfoGain = medAudioCtx.createGain(); lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain); lfoGain.connect(gain.gain);
      osc.connect(gain); gain.connect(medMasterGain);
      osc.start(); lfo.start();
      medTrackNodes.push(osc, lfo, gain, lfoGain);
    });
  } else if(trackId === 'bowl'){
    const drone = medAudioCtx.createOscillator();
    drone.type = 'sine'; drone.frequency.value = 110;
    const droneGain = medAudioCtx.createGain(); droneGain.gain.value = 0.02;
    drone.connect(droneGain); droneGain.connect(medMasterGain);
    drone.start();
    medTrackNodes.push(drone, droneGain);
    const strike = ()=>{
      if(!medMasterGain) return;
      [220, 528].forEach((f, i)=>{
        const osc = medAudioCtx.createOscillator();
        osc.type = 'sine'; osc.frequency.value = f;
        const gain = medAudioCtx.createGain();
        const now = medAudioCtx.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(i===0?0.09:0.04, now+0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now+6.5);
        osc.connect(gain); gain.connect(medMasterGain);
        osc.start(now); osc.stop(now+6.6);
      });
    };
    strike();
    medBellInterval = setInterval(strike, 13000);
  } else if(trackId === 'rain'){
    const noise = medAudioCtx.createBufferSource();
    noise.buffer = medCreateNoiseBuffer(medAudioCtx); noise.loop = true;
    const filter = medAudioCtx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 900;
    const gain = medAudioCtx.createGain(); gain.gain.value = 0.5;
    const lfo = medAudioCtx.createOscillator(); lfo.frequency.value = 0.08;
    const lfoGain = medAudioCtx.createGain(); lfoGain.gain.value = 150;
    lfo.connect(lfoGain); lfoGain.connect(filter.frequency);
    noise.connect(filter); filter.connect(gain); gain.connect(medMasterGain);
    noise.start(); lfo.start();
    medTrackNodes.push(noise, filter, gain, lfo, lfoGain);
  } else if(trackId === 'ocean'){
    const noise = medAudioCtx.createBufferSource();
    noise.buffer = medCreateNoiseBuffer(medAudioCtx); noise.loop = true;
    const filter = medAudioCtx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 400; filter.Q.value = 0.6;
    const gain = medAudioCtx.createGain(); gain.gain.value = 0.04;
    const lfo = medAudioCtx.createOscillator(); lfo.frequency.value = 0.12;
    const lfoGain = medAudioCtx.createGain(); lfoGain.gain.value = 0.35;
    lfo.connect(lfoGain); lfoGain.connect(gain.gain);
    noise.connect(filter); filter.connect(gain); gain.connect(medMasterGain);
    noise.start(); lfo.start();
    medTrackNodes.push(noise, filter, gain, lfo, lfoGain);
  }
}
function stopMedTrack(){
  clearInterval(medBellInterval); medBellInterval = null;
  medTrackNodes.forEach(node=>{
    try{ if(node.stop) node.stop(); }catch(err){}
    try{ node.disconnect(); }catch(err){}
  });
  medTrackNodes = [];
  medMasterGain = null;
}
function medPlayChime(){
  if(!medAudioCtx) return;
  const now = medAudioCtx.currentTime;
  const osc = medAudioCtx.createOscillator();
  osc.type = 'sine'; osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(660, now+0.3);
  const gain = medAudioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.12, now+0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now+0.45);
  osc.connect(gain); gain.connect(medAudioCtx.destination);
  osc.start(now); osc.stop(now+0.5);
}
function medVibrate(pattern){
  if(navigator.vibrate){ try{ navigator.vibrate(pattern); }catch(err){} }
}
function runMedPhase(){
  if(!medRunning) return;
  const pattern = BREATH_PATTERNS[medPattern];
  const phase = pattern[medPhaseIdx % pattern.length];
  medPlayChime();
  medVibrate(phase.type==='in' ? 70 : (phase.type==='out' ? [40,40,40] : 50));
  const circle = document.getElementById('medCircle');
  const text = document.getElementById('medCircleText');
  text.textContent = phase.label;
  circle.style.transition = `transform ${phase.sec}s ease-in-out`;
  if(phase.type==='in') circle.style.transform = 'scale(1.28)';
  else if(phase.type==='out') circle.style.transform = 'scale(0.82)';
  medPhaseIdx++;
  medPhaseTimeout = setTimeout(runMedPhase, phase.sec*1000);
}
async function startMeditation(){
  if(!medAudioCtx){ medAudioCtx = new (window.AudioContext||window.webkitAudioContext)(); }
  if(medAudioCtx.state === 'suspended'){ await medAudioCtx.resume(); }
  medRunning = true;
  medSecondsLeft = medDuration*60;
  document.getElementById('medTimer').textContent = medFormatTime(medSecondsLeft);
  document.getElementById('medSessionLabel').textContent = 'در حال مدیتیشن...';
  document.getElementById('medStartBtn').style.display = 'none';
  document.getElementById('medStopBtn').style.display = 'inline-block';
  startMedTrack(medSelectedTrack);
  medPhaseIdx = 0;
  runMedPhase();
  medCountdownInterval = setInterval(()=>{
    medSecondsLeft--;
    if(medSecondsLeft <= 0){ finishMeditation(); return; }
    document.getElementById('medTimer').textContent = medFormatTime(medSecondsLeft);
  }, 1000);
}
function stopMeditation(){
  medRunning = false;
  clearTimeout(medPhaseTimeout); medPhaseTimeout = null;
  clearInterval(medCountdownInterval); medCountdownInterval = null;
  stopMedTrack();
  const circle = document.getElementById('medCircle');
  circle.style.transition = 'transform .6s ease';
  circle.style.transform = 'scale(1)';
  document.getElementById('medCircleText').textContent = 'آماده‌ای؟';
  document.getElementById('medTimer').textContent = medFormatTime(medDuration*60);
  document.getElementById('medSessionLabel').textContent = '';
  document.getElementById('medStartBtn').style.display = 'inline-block';
  document.getElementById('medStopBtn').style.display = 'none';
}
function finishMeditation(){
  stopMeditation();
  medVibrate([100,60,100,60,220]);
  showToast('مدیتیشن تموم شد 🌿 آفرین بهت');
}
document.getElementById('medStartBtn').addEventListener('click', startMeditation);
document.getElementById('medStopBtn').addEventListener('click', stopMeditation);

/* ================= Meditation: Body Scan (feet to head, ported) ================= */
const BODYSCAN_PARTS = [
  {label:'انگشتان و کف پاها', text:'توجهت رو ببر سمت انگشتای پاهات و کف پاهات. هر حسی هست — گرما، سنگینی، حتی هیچی — رو فقط حس کن.'},
  {label:'مچ و ساق پاها', text:'حالا بیا بالاتر، سمت مچ پا و ساق پاها. اگه جایی سفت یا کشیده‌ست، با بازدمت بذار یه‌کم شل‌تر بشه.'},
  {label:'زانوها و ران‌ها', text:'توجه رو ببر روی زانوها و ران‌ها. وزن بدنت رو همین‌جا حس کن، بدون اینکه چیزی رو عوض کنی.'},
  {label:'لگن و کمر', text:'حالا لگن و کمر. اینجا معمولاً تنش زیادی جمع می‌شه؛ فقط باهاش بمون و بذار نفس بره اونجا.'},
  {label:'شکم', text:'توجهت رو بیار روی شکمت. بالا و پایین رفتنش با نفس رو دنبال کن، آروم و بدون عجله.'},
  {label:'قفسه‌ی سینه و قلب', text:'حالا قفسه‌ی سینه و قلبت. چند لحظه فقط به ضربان و حرکت نفس همین‌جا توجه کن.'},
  {label:'دست‌ها و انگشتان دست', text:'بیا سمت دست‌ها؛ از انگشتا شروع کن تا کف دست. سبکی یا سنگینیشون رو حس کن.'},
  {label:'بازوها و شونه‌ها', text:'توجه رو ببر روی بازوها و شونه‌ها. اگه شونه‌ها بالا کشیده‌ان، بذار با یه بازدم بیفتن پایین.'},
  {label:'گردن', text:'حالا گردن. آروم و بدون فشار، فقط حواست رو همین‌جا نگه دار.'},
  {label:'فک و صورت', text:'توجه به فک و صورت. اگه فکت قفله، یه‌کم بازش کن. عضله‌های دور چشم و پیشونی رو هم شل کن.'},
  {label:'چشم‌ها و پیشانی', text:'روی چشم‌ها و پیشونی بمون. سنگینی پلک‌ها رو حس کن، بدون اینکه لازم باشه کاری بکنی.'},
  {label:'تاج سر', text:'و در آخر، تاج سر. یه لحظه کل بدنت رو یک‌جا حس کن — از نوک پا تا همین‌جا.'}
];
let bsDuration = 10, bsRunning = false, bsPartIdx = 0, bsSecondsLeft = 600, bsPartSeconds = 50;
let bsPhaseTimeout = null, bsCountdownInterval = null;

function renderBsTrack(){
  const wrap = document.getElementById('bsTrack');
  if(!wrap) return;
  wrap.innerHTML = BODYSCAN_PARTS.map((p,i)=>`<div class="bodyscan-dot" data-i="${i}"></div>`).join('');
}
renderBsTrack();
document.getElementById('bsDurationSeg').querySelectorAll('button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(bsRunning) return;
    bsDuration = parseInt(btn.dataset.min,10);
    document.getElementById('bsDurationSeg').querySelectorAll('button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('bsTimer').textContent = medFormatTime(bsDuration*60);
  });
});
function updateBsTrackUI(){
  document.querySelectorAll('#bsTrack .bodyscan-dot').forEach((d,i)=>{
    d.classList.remove('done','current');
    if(i < bsPartIdx) d.classList.add('done');
    else if(i === bsPartIdx) d.classList.add('current');
  });
}
function runBsPart(){
  if(!bsRunning) return;
  if(bsPartIdx >= BODYSCAN_PARTS.length){ finishBodyScan(); return; }
  const part = BODYSCAN_PARTS[bsPartIdx];
  medPlayChime();
  medVibrate(60);
  document.getElementById('bsCircleText').textContent = part.label;
  document.getElementById('bsGuideText').textContent = part.text;
  updateBsTrackUI();
  bsPhaseTimeout = setTimeout(()=>{ bsPartIdx++; runBsPart(); }, bsPartSeconds*1000);
}
async function startBodyScan(){
  if(!medAudioCtx){ medAudioCtx = new (window.AudioContext||window.webkitAudioContext)(); }
  if(medAudioCtx.state === 'suspended'){ await medAudioCtx.resume(); }
  bsRunning = true;
  bsPartIdx = 0;
  bsSecondsLeft = bsDuration*60;
  bsPartSeconds = Math.max(8, Math.round(bsSecondsLeft / BODYSCAN_PARTS.length));
  document.getElementById('bsTimer').textContent = medFormatTime(bsSecondsLeft);
  document.getElementById('bsStartBtn').style.display = 'none';
  document.getElementById('bsStopBtn').style.display = 'inline-block';
  runBsPart();
  bsCountdownInterval = setInterval(()=>{
    bsSecondsLeft--;
    if(bsSecondsLeft <= 0){
      document.getElementById('bsTimer').textContent = medFormatTime(0);
      return;
    }
    document.getElementById('bsTimer').textContent = medFormatTime(bsSecondsLeft);
  }, 1000);
}
function stopBodyScan(){
  bsRunning = false;
  clearTimeout(bsPhaseTimeout); bsPhaseTimeout = null;
  clearInterval(bsCountdownInterval); bsCountdownInterval = null;
  bsPartIdx = 0;
  document.getElementById('bsCircleText').textContent = 'آماده‌ای؟';
  document.getElementById('bsGuideText').textContent = '';
  document.getElementById('bsTimer').textContent = medFormatTime(bsDuration*60);
  document.getElementById('bsStartBtn').style.display = 'inline-block';
  document.getElementById('bsStopBtn').style.display = 'none';
  updateBsTrackUI();
}
function finishBodyScan(){
  stopBodyScan();
  medVibrate([100,60,100,60,220]);
  showToast('اسکن بدن تموم شد 🌿 آفرین بهت');
}
document.getElementById('bsStartBtn').addEventListener('click', startBodyScan);
document.getElementById('bsStopBtn').addEventListener('click', stopBodyScan);

/* ================= Meditation: Gratitude (نعمت‌ها, ported) ================= */
const GRATITUDE_PROMPTS = [
  'یه نفس عمیق بکش. به این فکر کن که همین الان بدنت داره بی‌هیچ تلاشی نفس می‌کشه و قلبت داره می‌زنه — بدون اینکه حتی بهش دستور بدی.',
  'به کسی فکر کن که این روزها کنارته یا حتی از دور بهت فکر می‌کنه. شاید عادت کردی بهش، اما بودنش کم چیزی نیست.',
  'به سقفی که بالای سرته و جایی که امشب می‌خوابی فکر کن. خیلیا امشب این امنیت رو ندارن.',
  'یه چیز کوچیک رو به یاد بیار که امروز خوردی یا نوشیدی و طعمش خوب بود؛ حتی یه لیوان آب.',
  'به این فکر کن که چشمات الان دارن این جمله رو می‌بینن و ذهنت داره می‌فهمتش. توانایی دیدن و فهمیدن، خودش یه هدیه‌ست.',
  'یه سختی رو به یاد بیار که ازش رد شدی. همون تجربه، امروز یه‌جوری قوی‌ترت کرده — حتی اگه اون‌موقع حسش نکردی.',
  'به کسی فکر کن که یه زمانی بهت باور داشت، وقتی خودت به خودت شک داشتی.',
  'به یه لحظه‌ی کوچیک و ساده‌ی امروز فکر کن که خوب بود؛ یه لبخند، یه آهنگ، یه نور خورشید از پنجره.',
  'به این فکر کن که امروز، با همه‌ی سختی‌هاش، بازم یه فرصت بود. فرصتی که خیلیا آرزوشو دارن.',
  'به خودت فکر کن؛ به اینکه با همه‌ی روزهای سختت، هنوز داری تلاش می‌کنی و جلو می‌ری. این خودش قابل قدردانیه.',
  'به دست‌هات فکر کن؛ به همه‌ی کارهایی که امروز باهاشون انجام دادی، از باز کردن یه در تا نوشتن یه پیام.',
  'به پاهات فکر کن که هرجا لازم بود بردنت؛ راه رفتن، دویدن، ایستادن — کاری که خیلی وقتا بی‌توجه ازش رد می‌شیم.',
  'به صدایی که داری فکر کن؛ به اینکه می‌تونی حرفتو بزنی، بخندی، اسم کسیو صدا کنی.',
  'به یه صدا یا آهنگی فکر کن که این هفته شنیدیش و حالتو بهتر کرد.',
  'به این فکر کن که امشب یه جایی برای خوابیدن داری. خواب، یکی از ساده‌ترین و بی‌قدرترین نعمت‌هاست.',
  'به آبی که با باز کردن یه شیر بهش دسترسی داری فکر کن؛ چیزی که برای خیلیا تو دنیا یه رویاست.',
  'به این فکر کن که با زدن یه کلید، خونه‌ت روشن می‌شه. یه چیز به این سادگی، قرن‌ها آرزوی بشر بوده.',
  'به یه چیزی فکر کن که یاد گرفتیش و الان بلدی؛ یه مهارت، یه زبان، یه هنر کوچیک.',
  'به یه اشتباه فکر کن که یه زمانی زندگیتو زیر و رو کرد، اما الان می‌بینی چیزی بهت یاد داد.',
  'به این فکر کن که امروز، حداقل برای یه لحظه، اختیار داشتی که خودت تصمیم بگیری چیکار کنی.',
  'یه خاطره‌ی خوب از گذشته رو به یاد بیار؛ لحظه‌ای که همین حالا فکر کردن بهش لبخند رو لبت میاره.',
  'به آسمون، درخت‌ها یا هر چیزی از طبیعت فکر کن که این روزها دیدیش، حتی از پشت یه پنجره.',
  'به تغییر فصل‌ها فکر کن؛ به اینکه هر فصل یه چیز تازه با خودش میاره.',
  'اگه یه حیوون خونگی داری یا یه زمانی داشتی، به لحظه‌های ساده‌ای که کنارش بودی فکر کن.',
  'به یه بار فکر کن که یکی رو بخشیدی یا یکی تو رو بخشید. سبک شدن بعد از اون، خودش یه هدیه بود.',
  'به یه کتاب، فیلم یا آهنگی فکر کن که یه زمانی واقعاً روت تأثیر گذاشت.',
  'به یه لحظه‌ی خنده‌ی واقعی فکر کن؛ خنده‌ای که از ته دلت اومد، حتی اگه دلیلش الان یادت نیست.',
  'به یه محبت کوچیک از یه غریبه فکر کن؛ یه لبخند، یه کمک ساده، یه جمله‌ی خوب.',
  'به این فکر کن که از اشتباه‌های گذشته‌ت چیزی یاد گرفتی که الان داری باهاش زندگی می‌کنی.',
  'به یه هدفی فکر کن که داری براش تلاش می‌کنی. داشتن یه مسیر، خودش یه جور امیده.',
  'به آدم‌هایی فکر کن که پشتتن، حتی اگه همیشه ندونن چقدر برات مهمن.',
  'به جایی که زندگی می‌کنی فکر کن؛ به کوچه‌ها، صداها و چیزهایی که برات آشنا شدن.',
  'به یه سرگرمی فکر کن که وقتی انجامش می‌دی، زمان از دستت در می‌ره.',
  'به حس یه دوش آب گرم بعد از یه روز خسته‌کننده فکر کن.',
  'به یه چالش فکر کن که این ماه‌ها ازش رد شدی و الان پشت سرته.',
  'به کنجکاوی خودت فکر کن؛ به اینکه هنوزم دلت می‌خواد چیزهای جدید یاد بگیری.',
  'به تخیل خودت فکر کن؛ به اینکه می‌تونی چیزهایی رو تصور کنی که هنوز وجود ندارن.',
  'به این فکر کن که یه جایی داری که فقط مال خودته، حتی اگه فقط یه گوشه‌ی کوچیک از یه اتاق باشه.',
  'به یه گفتگو فکر کن که بعد از تمومش، هنوزم تو ذهنت مونده.',
  'به یه باری فکر کن که تونستی به کسی کمک کنی. اون حس مفید بودن، خودش یه ثروته.',
  'به یه فرصت دوباره فکر کن که یه زمانی بهت داده شد یا خودت به کسی دادی.',
  'به یه رسم یا عادت خانوادگی فکر کن که برات معنا داره، حتی اگه ساده باشه.',
  'به یه لحظه‌ی سکوت فکر کن که تو یه روز شلوغ، بهت آرامش داد.',
  'به آهنگی فکر کن که با شنیدنش، حالت یهو عوض می‌شه.',
  'به گرمای آفتاب روی پوستت فکر کن، همون حسی که شاید خیلی وقته بهش دقت نکردی.',
  'به یه فنجون چای یا قهوه فکر کن که یه بخش کوچیک ولی دلچسب از روزته.',
  'به یه دوستی قدیمی فکر کن که هنوز، بعد از این همه سال، سر جاشه.',
  'به یه آدم تازه فکر کن که تازه وارد زندگیت شده و داره جاشو باز می‌کنه.',
  'به این فکر کن که یه سال پیش نسبت به الان، چقدر رشد کردی — حتی اگه خودت متوجهش نباشی.',
  'به توانایی بدنت برای ترمیم خودش فکر کن؛ یه زخم کوچیک که خوب شد، یه سرماخوردگی که رد شد.',
  'به این فکر کن که می‌تونی از خونه بیرون بری و راه بری، بدون اینکه از کسی اجازه بگیری.',
  'به این فکر کن که یه گوشی تو دستته که می‌تونه صدا و تصویر یکی رو از هزاران کیلومتر دورتر بهت برسونه.',
  'به یه معلم یا کسی فکر کن که یه زمانی چیزی مهم بهت یاد داد.',
  'به این فکر کن که فرصت درس خوندن یا یاد گرفتن داشتی، حتی اگه همیشه دوستش نداشتی.',
  'به این فکر کن که امروز، حق انتخاب داشتی چی بخوری. یه انتخاب ساده که خیلیا ندارن.',
  'به یه جایی فکر کن که هروقت لازم بود، تونستی توش گریه کنی یا احساساتتو نشون بدی.',
  'به این فکر کن که هنوزم می‌تونی درباره‌ی آینده رویاپردازی کنی. این خودش یه جور امیده.',
  'به یه کار کوچیک برای خودت فکر کن که اخیراً انجام دادی؛ حتی یه استراحت کوتاه.',
  'به یه خاطره‌ی خوب از بچگیت فکر کن؛ یه بو، یه صدا، یه حس که هنوز باهاته.',
  'به یه چیزی فکر کن که باهاش می‌سازی یا درستش می‌کنی؛ یه مهارت دستی که بهش افتخار می‌کنی.',
  'به این فکر کن که هنوز اینجایی. زنده بودن، خودش، قبل از هر چیز دیگه‌ای، یه شروعه.',
  'به این فکر کن که می‌تونی «نه» بگی و برای خودت مرز بذاری، حتی اگه همیشه راحت نباشه.',
  'به کسی فکر کن که تو یه دوره‌ی سخت کنارت بود، بدون اینکه چیزی ازت بخواد.',
  'به یه جمله یا شعری فکر کن که یه‌جوری تو دلت نشسته و هنوز باهاته.',
  'به حسی که بعد از تموم کردن یه کار سخت داشتی فکر کن؛ اون حس رضایت کوچیک.',
  'به یه روز بارونی فکر کن که تو خونه، گرم و راحت بودی و صدای بارون رو می‌شنیدی.',
  'به صدای خنده‌ی یکی که دوستش داری فکر کن؛ صدایی که حالتو خوب می‌کنه.',
  'به این فکر کن که می‌تونی چیزی بنویسی یا نقاشی کنی که فقط مال خودته.',
  'به یه گیاه، درخت یا گلی فکر کن که ازش مراقبت می‌کنی یا یه زمانی مراقبتش کردی.',
  'به یه پتوی گرم تو یه شب سرد فکر کن؛ یه راحتی به این سادگی.',
  'به این فکر کن که می‌تونی خودتو ببخشی، حتی برای چیزهایی که فکر می‌کردی هیچ‌وقت نمی‌بخشی.',
  'به نور صبح فکر کن که از یه جایی به زندگیت میاد، حتی تو سخت‌ترین روزها.',
  'به یه لحظه‌ی سکوت واقعی فکر کن؛ لحظه‌ای که هیچ صدایی نبود و فقط با خودت بودی.',
  'به یه شب خوب خوابیدن فکر کن؛ چیزی که وقتی نداریمش، تازه قدرشو می‌فهمیم.',
  'به کسی فکر کن که بدون قضاوت بهت گوش داد، حتی اگه فقط یه بار بوده.',
  'به یه پیشرفت کوچیک فکر کن که اخیراً داشتی، حتی اگه هیچکس دیگه‌ای متوجهش نشده باشه.',
  'به جایی فکر کن که برات حس خونه رو داره، هرجا که هست.',
  'به این فکر کن که می‌تونی از یکی کمک بخوای، و این ضعف نیست.',
  'به آرامش یه عادت روزمره فکر کن؛ یه کار تکراری که بهت حس ثبات می‌ده.',
  'به این لحظه فکر کن؛ به اینکه همین الان، وسط یه روز شلوغ، وقت گذاشتی برای خودت. این خودش یه قدردانیه.'
];
let gratDuration = 10, gratRunning = false, gratSelectedTrack = 'pad';
let gratSecondsLeft = 600, gratPromptSeconds = 60, gratPhaseTimeout = null, gratCountdownInterval = null;

/* No-repeat shuffled "deck" of prompts, persisted across sessions so that
   consecutive meditations (even started fresh) keep drawing new sentences
   until the whole pool has been shown once, then reshuffle. */
const GRAT_STATE_KEY = 'gratPromptDeckState';
let gratDeck = [];
let gratDeckPos = 0;
function gratShuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
function gratFreshDeck(avoidFirst){
  let deck;
  do{
    deck = gratShuffle(GRATITUDE_PROMPTS.map((_,i)=>i));
  } while(GRATITUDE_PROMPTS.length > 1 && avoidFirst !== undefined && deck[0] === avoidFirst);
  return deck;
}
function gratLoadDeckState(){
  try{
    const raw = localStorage.getItem(GRAT_STATE_KEY);
    if(raw){
      const state = JSON.parse(raw);
      if(Array.isArray(state.deck) && state.deck.length === GRATITUDE_PROMPTS.length && Number.isInteger(state.pos)){
        gratDeck = state.deck;
        gratDeckPos = state.pos;
        return;
      }
    }
  }catch(e){}
  gratDeck = gratFreshDeck();
  gratDeckPos = 0;
}
function gratSaveDeckState(){
  try{ localStorage.setItem(GRAT_STATE_KEY, JSON.stringify({ deck: gratDeck, pos: gratDeckPos })); }catch(e){}
}
function gratNextPrompt(){
  if(!gratDeck.length) gratLoadDeckState();
  if(gratDeckPos >= gratDeck.length){
    const lastShown = gratDeck[gratDeck.length-1];
    gratDeck = gratFreshDeck(lastShown);
    gratDeckPos = 0;
  }
  const idx = gratDeck[gratDeckPos];
  gratDeckPos++;
  gratSaveDeckState();
  return GRATITUDE_PROMPTS[idx];
}

function renderGratTrackList(){
  const wrap = document.getElementById('gratTrackList');
  if(!wrap) return;
  wrap.innerHTML = MED_TRACKS.map(t=>`
    <div class="track-card${t.id===gratSelectedTrack?' active':''}" data-track="${t.id}">
      <div class="t-emoji">${t.emoji}</div>
      <div class="t-info"><div class="t-title">${t.title}</div><div class="t-sub">${t.sub}</div></div>
      <div class="t-radio"></div>
    </div>`).join('');
  wrap.querySelectorAll('.track-card').forEach(card=>{
    card.addEventListener('click', ()=>{
      gratSelectedTrack = card.dataset.track;
      wrap.querySelectorAll('.track-card').forEach(c=>c.classList.remove('active'));
      card.classList.add('active');
      if(gratRunning){ stopMedTrack(); startMedTrack(gratSelectedTrack); }
    });
  });
}
renderGratTrackList();
document.getElementById('gratDurationSeg').querySelectorAll('button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(gratRunning) return;
    gratDuration = parseInt(btn.dataset.min,10);
    document.getElementById('gratDurationSeg').querySelectorAll('button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('gratTimer').textContent = medFormatTime(gratDuration*60);
  });
});
function runGratPrompt(){
  if(!gratRunning) return;
  const prompt = gratNextPrompt();
  medPlayChime();
  medVibrate(60);
  document.getElementById('gratPromptText').textContent = prompt;
  gratPhaseTimeout = setTimeout(runGratPrompt, gratPromptSeconds*1000);
}
async function startGratitude(){
  if(!medAudioCtx){ medAudioCtx = new (window.AudioContext||window.webkitAudioContext)(); }
  if(medAudioCtx.state === 'suspended'){ await medAudioCtx.resume(); }
  gratRunning = true;
  gratSecondsLeft = gratDuration*60;
  gratPromptSeconds = 8;
  document.getElementById('gratTimer').textContent = medFormatTime(gratSecondsLeft);
  document.getElementById('gratCircleText').textContent = '🙏';
  document.getElementById('gratStartBtn').style.display = 'none';
  document.getElementById('gratStopBtn').style.display = 'inline-block';
  startMedTrack(gratSelectedTrack);
  runGratPrompt();
  gratCountdownInterval = setInterval(()=>{
    gratSecondsLeft--;
    if(gratSecondsLeft <= 0){ finishGratitude(); return; }
    document.getElementById('gratTimer').textContent = medFormatTime(gratSecondsLeft);
  }, 1000);
}
function stopGratitude(){
  gratRunning = false;
  clearTimeout(gratPhaseTimeout); gratPhaseTimeout = null;
  clearInterval(gratCountdownInterval); gratCountdownInterval = null;
  stopMedTrack();
  document.getElementById('gratPromptText').textContent = '';
  document.getElementById('gratTimer').textContent = medFormatTime(gratDuration*60);
  document.getElementById('gratStartBtn').style.display = 'inline-block';
  document.getElementById('gratStopBtn').style.display = 'none';
}
function finishGratitude(){
  stopGratitude();
  medVibrate([100,60,100,60,220]);
  showToast('مدیتیشن نعمت‌ها تموم شد 🙏 قدردان بودن یه مهارته که داری تمرینش می‌کنی');
}
document.getElementById('gratStartBtn').addEventListener('click', startGratitude);
document.getElementById('gratStopBtn').addEventListener('click', stopGratitude);

/* ================= Meditation: خلأ ذهنی (mental void — stare at a fixed dot, think of nothing) ================= */
const VOID_REMINDERS = [
  'به هیچی فکر نکن، فقط نگاه کن',
  'فکری اومد؟ یه خط روش بکش',
  'بندازش تو سطل آشغال ذهنت',
  'ذهنتو خالی نگه‌دار',
  'دنبال فکر نرو؛ بذار رد بشه',
  'دوباره برگرد به همین نقطه',
  'نیازی به فکر کردن نیست، فقط باش',
  'هر فکر یه ابره؛ بذار بگذره',
  'همین‌جا بمون، با نقطه',
  'هیچی مهم نیست الان، فقط این نقطه',
  'فقط ببین. همین.',
  'ذهنت شلوغ شد؟ خط بزن، بریزش دور',
  'لازم نیست جوابی پیدا کنی؛ فقط رهاش کن',
  'بذار سکوت باشه، نه فکر'
];
let voidDuration = 5, voidRunning = false, voidSecondsLeft = 300;
let voidReminderTimeout = null, voidCountdownInterval = null, voidLastReminderIdx = -1;

function voidPickReminder(){
  if(VOID_REMINDERS.length <= 1) return VOID_REMINDERS[0];
  let idx = Math.floor(Math.random()*VOID_REMINDERS.length);
  if(idx === voidLastReminderIdx) idx = (idx+1) % VOID_REMINDERS.length;
  voidLastReminderIdx = idx;
  return VOID_REMINDERS[idx];
}
function runVoidReminder(){
  if(!voidRunning) return;
  const el = document.getElementById('voidReminder');
  const toss = document.getElementById('voidToss');
  el.classList.add('void-fade');
  setTimeout(()=>{
    if(!voidRunning) return;
    el.textContent = voidPickReminder();
    el.classList.remove('void-fade');
    toss.classList.remove('show');
    void toss.offsetWidth;
    toss.classList.add('show');
    medVibrate(30);
  }, 450);
  voidReminderTimeout = setTimeout(runVoidReminder, 9000);
}
document.getElementById('voidDurationSeg').querySelectorAll('button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(voidRunning) return;
    voidDuration = parseInt(btn.dataset.min,10);
    document.getElementById('voidDurationSeg').querySelectorAll('button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('voidTimer').textContent = medFormatTime(voidDuration*60);
  });
});
function startVoidMind(){
  voidRunning = true;
  voidSecondsLeft = voidDuration*60;
  document.getElementById('voidTimer').textContent = medFormatTime(voidSecondsLeft);
  document.getElementById('voidStartBtn').style.display = 'none';
  document.getElementById('voidStopBtn').style.display = 'inline-block';
  const el = document.getElementById('voidReminder');
  el.classList.remove('void-fade');
  el.textContent = voidPickReminder();
  voidReminderTimeout = setTimeout(runVoidReminder, 9000);
  voidCountdownInterval = setInterval(()=>{
    voidSecondsLeft--;
    if(voidSecondsLeft <= 0){ finishVoidMind(); return; }
    document.getElementById('voidTimer').textContent = medFormatTime(voidSecondsLeft);
  }, 1000);
}
function stopVoidMind(){
  voidRunning = false;
  clearTimeout(voidReminderTimeout); voidReminderTimeout = null;
  clearInterval(voidCountdownInterval); voidCountdownInterval = null;
  const el = document.getElementById('voidReminder');
  if(el){ el.textContent = ''; el.classList.remove('void-fade'); }
  document.getElementById('voidTimer').textContent = medFormatTime(voidDuration*60);
  document.getElementById('voidStartBtn').style.display = 'inline-block';
  document.getElementById('voidStopBtn').style.display = 'none';
}
function finishVoidMind(){
  stopVoidMind();
  medVibrate([100,60,100,60,220]);
  showToast('خلأ ذهنی تموم شد 🔴 چند دقیقه بدون فکر، خودش یه دستاورده');
}
document.getElementById('voidStartBtn').addEventListener('click', startVoidMind);
document.getElementById('voidStopBtn').addEventListener('click', stopVoidMind);

/* ================= Account + Public Chat (Supabase, ported) =================
   This is a real shared/public chat: anything sent here is visible to every
   user of the app who's logged in, not just the person who wrote it — unlike
   the private advisor chat in the "مشاور شخصی" section, which only the
   person themself ever sees.
========================================================================= */
const SUPABASE_URL = "https://elrctpacwmsplxkbhlur.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_W0gxlYFD1uWfn3LGn4MvAA_qJUlJ5xs";
let sb = null, publicChatUser = null, publicChatUsername = null, publicChatChannel = null, myProfileCache = null;
let lastChatMsgUserId = null; // tracks the previous message's sender so back-to-back messages can be grouped (name/streak shown once)
// Owner account: matched by the logged-in Supabase Auth email. This only controls what THIS
// device shows/unlocks for that one signed-in session (premium UI, owner badge, delete-any-message
// buttons) — it is NOT what protects other users' data. The actual moderation power (deleting other
// people's messages) only works because of the Supabase RLS policy + trigger set up for this UID —
// see the SQL notes shipped alongside this file. Without that server-side piece, this flag alone
// would only change this client's own display, nothing it sends to the server would be trusted.
const OWNER_EMAIL = 'mahdihd648@gmail.com';
let isAppOwner = false;
// Chat-admin: a role the owner can grant to any signed-in user from the public chat
// header (see chatAdminManageBtn below). Same delete/pin moderation power as the owner,
// shown with a custom title instead of "مالک" — but does NOT unlock premium, the crown
// badge, or the ability to grant admin to others (only the real owner can do that).
// Real enforcement is server-side (Supabase RLS via is_chat_admin()) — see the SQL notes
// shipped alongside this file (chat-admin-supabase-schema.sql); this flag alone only
// changes this client's own UI, same caveat as isAppOwner above.
let isChatAdmin = false;
// Suspension state for the CURRENTLY LOGGED-IN user (read from their own `profiles` row).
// Enforced for real on the public-chat side by a Supabase RLS policy on `messages` INSERT
// (see the SQL notes) — this client-side state is what drives locking the "چت" and
// "مشاور شخصی" tabs' UI and is kept in sync with the server on every login/session refresh.
let mySuspendedUntil = null;        // Date|null
let mySuspendedPermanently = false; // true = 5th-stage, permanent ban from these sections
let mySuspensionStage = 0;          // how many times this account has been suspended so far
// Mute state for the CURRENTLY LOGGED-IN user — lighter than suspension: the person keeps
// full read access to the chat (and مشاور شخصی), only sending text/media is blocked until
// muted_until passes. Set by the owner for any custom duration (see muteChatUser below) and
// enforced for real by a Supabase RLS policy on `messages` INSERT, same caveat as suspension.
let myMutedUntil = null;            // Date|null
function chatConfigured(){
  return SUPABASE_URL.indexOf('PASTE_') !== 0 && SUPABASE_ANON_KEY.indexOf('PASTE_') !== 0 && window.supabase;
}

/* ================= App update check =================
   Bump APP_VERSION here on every release you ship to users. The app compares
   this against the `latest_version` row Supabase returns from the
   `app_version` table (single row, id=1) — see setup notes shared alongside
   this file for the table schema and how to publish a new version. Since the
   app isn't on Myket yet, "download_url" should point wherever the APK is
   actually hosted (e.g. a public Supabase Storage bucket, a GitHub release
   asset, or your own domain) — once it's live on Myket you can just swap
   this to open the Myket page instead. */
const APP_VERSION = '1.0.0';
function cmpVersions(a, b){
  const pa = String(a).split('.').map(n=>parseInt(n,10)||0);
  const pb = String(b).split('.').map(n=>parseInt(n,10)||0);
  const len = Math.max(pa.length, pb.length);
  for(let i=0;i<len;i++){
    const da = pa[i]||0, db = pb[i]||0;
    if(da > db) return 1;
    if(da < db) return -1;
  }
  return 0;
}
function renderUpdateStatus(state, data){
  const card = document.getElementById('updStatusCard');
  const spinner = document.getElementById('updSpinner');
  const title = document.getElementById('updStatusTitle');
  const sub = document.getElementById('updStatusSub');
  const dlBtn = document.getElementById('updDownloadBtn');
  const clSection = document.getElementById('updChangelogSection');
  const clList = document.getElementById('updChangelogList');
  card.classList.remove('is-latest','has-update','is-error');
  spinner.style.display = 'none';
  dlBtn.style.display = 'none';
  clSection.style.display = 'none';

  if(state === 'checking'){
    spinner.style.display = 'block';
    title.textContent = 'در حال بررسی...';
    sub.textContent = 'داریم آخرین نسخه رو از سرور می‌گیریم';
    return;
  }
  if(state === 'error'){
    card.classList.add('is-error');
    title.textContent = 'بررسی انجام نشد';
    sub.textContent = 'اتصال اینترنتت رو چک کن و دوباره تلاش کن.';
    return;
  }
  if(state === 'up-to-date'){
    card.classList.add('is-latest');
    title.textContent = 'به‌روزی، همه‌چی عالیه 🎉';
    sub.textContent = 'داری از آخرین نسخه‌ی برنامه استفاده می‌کنی.';
    return;
  }
  if(state === 'update-available'){
    card.classList.add('has-update');
    title.textContent = `نسخه‌ی جدید ${data.latest_version} موجوده!`;
    sub.textContent = 'برای دسترسی به امکانات و رفع مشکلات جدید، به‌روزرسانی کن.';
    if(data.download_url){
      dlBtn.style.display = 'block';
      dlBtn.dataset.url = data.download_url;
    }
    if(Array.isArray(data.changelog) && data.changelog.length){
      clSection.style.display = 'block';
      clList.innerHTML = data.changelog.map(line=>`<div class="upd-changelog-item">${line}</div>`).join('');
    } else if(typeof data.changelog === 'string' && data.changelog.trim()){
      clSection.style.display = 'block';
      clList.innerHTML = `<div class="upd-changelog-item">${data.changelog}</div>`;
    }
  }
}
async function checkForAppUpdate(){
  document.getElementById('updCurrentVersion').textContent = APP_VERSION;
  renderUpdateStatus('checking');
  if(!chatConfigured() || !sb){ renderUpdateStatus('error'); return; }
  try{
    const { data, error } = await sb.from('app_version').select('latest_version, download_url, changelog').eq('id', 1).single();
    if(error || !data){ renderUpdateStatus('error'); return; }
    if(cmpVersions(data.latest_version, APP_VERSION) > 0) renderUpdateStatus('update-available', data);
    else renderUpdateStatus('up-to-date');
  }catch(err){ console.error('Update check error', err); renderUpdateStatus('error'); }
}
document.getElementById('updRecheckBtn').addEventListener('click', checkForAppUpdate);
document.getElementById('updDownloadBtn').addEventListener('click', (e)=>{
  const url = e.currentTarget.dataset.url;
  if(url) window.open(url, '_blank');
});
function initChatAuth(){
  if(!chatConfigured()){
    const box = document.getElementById('chatUnconfiguredBox');
    if(box) box.innerHTML = `<div style="padding:0 14px 14px;font-size:12px;color:var(--muted);line-height:1.9;">این بخش هنوز به سرور وصل نشده.</div>`;
    return;
  }
  try{
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    applyRememberedAuthToLoginForms();
    watchLifetimeCapacity();
    sb.auth.getSession().then(({data})=> handlePublicChatSession(data.session)).catch(()=>{});
    sb.auth.onAuthStateChange((event, session)=>{
      if(event === 'PASSWORD_RECOVERY'){
        // Only relevant if this ever runs as a plain website and someone clicks
        // the email's link in a browser. In the packaged app there's no deep
        // link for this, so the code-based flow below (confirmResetCodeBtn) is
        // the normal path and doesn't depend on this event at all.
        showAuthForm('resetCode');
        return;
      }
      handlePublicChatSession(session);
    });
  }catch(err){ console.error('Supabase init error', err); }
}
/* Toggle which of the 4 account-tab forms (login / signup / forgot / resetCode) is visible */
function showAuthForm(which){
  document.getElementById('chatTabLogin').classList.toggle('active', which==='login');
  document.getElementById('chatTabSignup').classList.toggle('active', which==='signup');
  document.getElementById('chatLoginForm').style.display = which==='login' ? 'flex' : 'none';
  document.getElementById('chatSignupForm').style.display = which==='signup' ? 'flex' : 'none';
  document.getElementById('chatForgotForm').style.display = which==='forgot' ? 'flex' : 'none';
  document.getElementById('chatResetCodeForm').style.display = which==='resetCode' ? 'flex' : 'none';
  const tabsEl = document.querySelector('.chat-auth-tabs');
  if(tabsEl) tabsEl.style.display = (which==='login' || which==='signup') ? 'flex' : 'none';
  if(which !== 'login'){
    document.getElementById('chatLoggedOutBox').style.display = 'block';
    document.getElementById('chatLoggedInBox').style.display = 'none';
  }
  if(which === 'login') applyRememberedAuthToLoginForms();
}
async function handlePublicChatSession(session){
  publicChatUser = session ? session.user : null;
  if(publicChatUser){
    // Fired first, in parallel with everything below — the message list doesn't
    // actually depend on the profile fetch (own/other bubble styling only needs
    // publicChatUser, already set above). This used to be the 3rd/4th sequential
    // network round trip behind profile → purge-check → messages → reactions;
    // now it's the very first request that goes out.
    loadPublicChatMessages();
    let profile = null;
    try{ const res = await sb.from('profiles').select('username, referral_code, premium_until, referral_count, discount_percent, discount_code, wheel_spun, username_updated_at, suspended_until, suspension_stage, suspended_permanently, muted_until, is_admin, admin_title, avatar_url').eq('id', publicChatUser.id).single(); profile = res.data; }catch(err){}
    myProfileCache = profile;
    publicChatUsername = profile ? displayName(profile.username) : displayName(publicChatUser.email);
    isAppOwner = !!(publicChatUser.email && publicChatUser.email.toLowerCase() === OWNER_EMAIL);
    // Chat-admin: granted by the owner (see set_chat_admin_by_email RPC / chatAdminManageBtn).
    // Only the real owner sees the button that grants/revokes this to others.
    isChatAdmin = isAppOwner || !!(profile && profile.is_admin);
    const chatAdminManageBtn = document.getElementById('chatAdminManageBtn');
    if(chatAdminManageBtn) chatAdminManageBtn.style.display = isAppOwner ? 'inline-flex' : 'none';
    // Suspension is read fresh from the server on every session load, so a lifted/expired
    // suspension (or a fresh one applied on another device) is always picked up on login.
    mySuspendedUntil = (profile && profile.suspended_until) ? new Date(profile.suspended_until) : null;
    mySuspendedPermanently = !!(profile && profile.suspended_permanently);
    mySuspensionStage = (profile && profile.suspension_stage) || 0;
    myMutedUntil = (profile && profile.muted_until) ? new Date(profile.muted_until) : null;
    // منبع حقیقت پرمیوم همیشه سرور (profiles.premium_until) هست، نه storeData.premium.
    // این خط storeData.premium رو هر بار که سشن لود می‌شه بازنویسی می‌کنه — یعنی حتی اگه
    // کسی storeData.premium رو دستی تو کنسول true کرده باشه، با اولین لود بعدی برمی‌گرده به
    // همون چیزی که واقعاً روی سرور ثبته. مالک اپ (OWNER_EMAIL) همیشه true می‌مونه.
    storeData.premium = isAppOwner || !!(profile && profile.premium_until && new Date(profile.premium_until) > new Date());
    saveData();
    if(typeof applyPremiumLocksUI === 'function') applyPremiumLocksUI();
    // Session restored after the mandatory account gate was already shown (its login-state
    // check ran before this async session lookup finished) — skip straight to onboarding.
    if(!storeData.profile.onboardingComplete && document.getElementById('accountCreateOverlay').classList.contains('show')){
      advanceFromAccountGate();
    }
    document.getElementById('chatLoggedOutBox').style.display = 'none';
    document.getElementById('chatLoggedInBox').style.display = 'block';
    document.getElementById('chatUsernameLabel').innerHTML = escapeHtml(publicChatUsername) + (isAppOwner ? ' '+ci('crown') : '');
    renderInviteTab(profile);
    renderProfileTab();
    const delBox = document.getElementById('deleteAccountBox');
    if(delBox) delBox.style.display = 'block';
    const logoutBox = document.getElementById('logoutAccountBox');
    if(logoutBox) logoutBox.style.display = 'block';
    await resolveTrialStart();
    applyPremiumLocksUI();
    // Purge check runs in the background — it's rare (weekly) and low-priority, and
    // already self-heals the UI (clears #chatMessages) if it does purge, so it never
    // needs to block message loading, which already fired at the top of this function.
    maybeWeeklyPurgeChat();
    updateChatModeUI();
    renderSuspensionLocks();
    syncOnLogin();
    lbLastSyncedKey = null;
    syncMyLeaderboardData();
    touchLeaderboardActivity();
    startPresenceHeartbeat();
    initPushNotifications();
    initNotifBell();
    if(pendingAuthTab){
      const target = pendingAuthTab; pendingAuthTab = null;
      setTimeout(()=> goToTabAfterAuth(target), 400);
    }
  } else {
    publicChatUsername = null;
    myProfileCache = null;
    isAppOwner = false;
    isChatAdmin = false;
    { const _b = document.getElementById('chatAdminManageBtn'); if(_b) _b.style.display = 'none'; }
    mySuspendedUntil = null;
    mySuspendedPermanently = false;
    mySuspensionStage = 0;
    myMutedUntil = null;
    // مهم: بدون این خط، storeData.premium از آخرین لاگین (حتی لاگین OWNER_EMAIL) تو
    // localStorage باقی می‌مونه و بعد از خروج از حساب — یا رو یه حساب دیگه‌ی همون
    // دستگاه — همچنان پرمیوم نشون داده می‌شه. منبع حقیقت همیشه سروره؛ وقتی سشن
    // نیست (لاگ‌اوت یا هنوز لاگین نشده)، باید همیشه false باشه.
    storeData.premium = false;
    saveData();
    showAuthForm('login');
    renderInviteTab(null);
    renderProfileTab();
    renderSuspensionLocks();
    const delBox = document.getElementById('deleteAccountBox');
    if(delBox) delBox.style.display = 'none';
    const logoutBox = document.getElementById('logoutAccountBox');
    if(logoutBox) logoutBox.style.display = 'none';
    effectiveTrialStartMs = null;
    applyPremiumLocksUI();
  }
}

/* ================= Push notifications for public chat (real, works when app is closed) =================
   Pieces this depends on, each documented in the files shipped alongside this app:
   1) @capacitor/push-notifications added to the native Android project + google-services.json
      (native project change — see push-notifications-setup.md)
   2) the `push_tokens` table + RLS policy in Supabase (see push-notifications-schema.sql)
   3) the `/notify-new-message` endpoint added to the existing Cloudflare Worker, plus a Supabase
      Database Webhook on `messages` INSERT pointing at it (see worker-notify-snippet.js)
   If any piece is missing, the functions below just no-op — they never throw or block chat. */
let pushNotifInitialized = false;
function isNativeApp(){
  return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
}
async function initPushNotifications(){
  if(pushNotifInitialized) return; // register once per app run, not on every session refresh
  if(!isNativeApp() || !publicChatUser) return;
  const plugin = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.PushNotifications;
  if(!plugin) return; // native plugin not installed in this build yet
  try{
    let perm = await plugin.checkPermissions();
    if(perm.receive === 'prompt') perm = await plugin.requestPermissions();
    if(perm.receive !== 'granted') return;

    await plugin.register();
    pushNotifInitialized = true;

    plugin.addListener('registration', (token)=>{ savePushToken(token.value); });
    plugin.addListener('registrationError', (err)=>{ console.error('Push registration error', err); });
    // User tapped a chat-notification while the app was backgrounded/closed — jump into chat.
    plugin.addListener('pushNotificationActionPerformed', ()=>{
      try{ enterSubPage('chat'); }catch(e){}
    });
  }catch(err){ console.error('initPushNotifications error', err); }
}
async function savePushToken(fcmToken){
  if(!sb || !publicChatUser || !fcmToken) return;
  try{
    await sb.from('push_tokens').upsert({
      user_id: publicChatUser.id,
      token: fcmToken,
      platform: 'android',
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,token' });
  }catch(err){ console.error('savePushToken error', err); }
}

/* ---------------- Referral codes: signup with a friend's code gives both 7 days premium ---------------- */
function genReferralCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for(let i=0;i<6;i++) code += chars[Math.floor(Math.random()*chars.length)];
  return code;
}
async function applyReferralBonus(referrerCodeRaw, newUserId){
  if(!sb) return;
  const referrerCode = referrerCodeRaw.trim().toUpperCase();
  if(!referrerCode) return;
  // این منطق قبلاً مستقیم از کلاینت روی ردیف کاربر دیگه (referrer) می‌نوشت — یعنی هر کاربر
  // لاگین‌شده‌ای می‌تونست premium_until هر کسی رو دستی ست کنه. حالا فقط Worker (با service role)
  // این آپدیت رو انجام می‌ده؛ کلاینت فقط کد رفرال رو می‌فرسته.
  try{
    const __auth = await authHeaders();
    await fetch(WORKER_BASE + '/referral/apply', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, __auth),
      body: JSON.stringify({ referrerCode })
    });
  }catch(err){ console.error('Referral bonus failed', err); }
}

/* ---------------- Invite-friends tab: code, milestone ladder, discount, prize wheel ---------------- */
let myDiscount = { percent: 0, code: '' };
// این آرایه دیگه واقعاً استفاده نمی‌شه (جایزه‌ی گردونه رو الان Worker تصادفی انتخاب می‌کنه،
// نه این تابع کلاینت) — فقط برای هماهنگی با WHEEL_PRIZES واقعی تو groq-proxy-worker.js به‌روز نگه داشته شده.
const WHEEL_PRIZES = [
  { percent:40, weight:80 }, { percent:50, weight:20 }
];
function pickWheelPrize(){
  const total = WHEEL_PRIZES.reduce((s,p)=>s+p.weight, 0);
  let r = Math.random() * total;
  for(let i=0;i<WHEEL_PRIZES.length;i++){
    if(r < WHEEL_PRIZES[i].weight) return i;
    r -= WHEEL_PRIZES[i].weight;
  }
  return 0;
}
function renderInviteTab(profile){
  const codeEl = document.getElementById('inviteTabCode');
  const noteEl = document.getElementById('inviteProgressNote');
  const badgeEl = document.getElementById('inviteDiscountBadge');
  const wheelSection = document.getElementById('wheelSection');
  const pathFill = document.getElementById('invitePathFill');
  const pathRunner = document.getElementById('invitePathRunner');
  if(!codeEl) return;
  if(!profile){
    codeEl.textContent = '—';
    noteEl.textContent = 'برای گرفتن کد دعوت، اول تو تب چت وارد اکانتت شو.';
    badgeEl.style.display = 'none';
    wheelSection.style.display = 'none';
    if(pathFill) pathFill.style.height = '0%';
    if(pathRunner) pathRunner.style.top = '0%';
    myDiscount = { percent: 0, code: '' };
    return;
  }
  const count = profile.referral_count || 0;
  const percent = profile.discount_percent || 0;
  const code = profile.discount_code || '';
  myDiscount = { percent, code };

  codeEl.textContent = profile.referral_code || '—';
  noteEl.textContent = `تا الان ${count.toLocaleString('fa-IR')} نفر با کد تو ثبت‌نام کردن`;

  let currentSet = false;
  [[1,'inviteStep1','inviteCheck1'], [3,'inviteStep3','inviteCheck3'], [5,'inviteStep5','inviteCheck5']].forEach(([n, stepId, checkId])=>{
    const step = document.getElementById(stepId), check = document.getElementById(checkId);
    step.classList.remove('current');
    if(count >= n){
      step.classList.add('done'); check.textContent = '✓';
    } else {
      step.classList.remove('done'); check.textContent = toFa(n);
      if(!currentSet){ step.classList.add('current'); currentSet = true; }
    }
  });

  const pathPct = Math.min(count,5)/5*100;
  if(pathFill) pathFill.style.height = pathPct + '%';
  if(pathRunner) pathRunner.style.top = pathPct + '%';

  if(percent > 0){
    badgeEl.style.display = 'block';
    badgeEl.innerHTML = `🎉 تخفیف فعالت: ${percent}٪<br><span style="font-family:monospace;font-size:15px;">${escapeHtml(code)}</span><br>
      <span style="font-weight:400;font-size:11px;">این کد رو موقع خرید نسخه‌ی پرمیوم وارد کن</span>`;
  } else {
    badgeEl.style.display = 'none';
  }

  if(count >= 5 && !profile.wheel_spun){
    wheelSection.style.display = 'block';
    const spinBtn = document.getElementById('wheelSpinBtn');
    spinBtn.disabled = false;
    spinBtn.textContent = '🎁 جایزه‌مو بگیر!';
  } else {
    wheelSection.style.display = 'none';
  }
}
document.getElementById('wheelSpinBtn').addEventListener('click', async ()=>{
  if(!sb || !publicChatUser) return;
  sfxWhoosh();
  const btn = document.getElementById('wheelSpinBtn');
  btn.disabled = true; btn.textContent = 'در حال دریافت...';
  // انتخاب جایزه و ثبت wheel_spun قبلاً همینجا رو کلاینت انجام می‌شد (یعنی هرکسی می‌تونست تو
  // کنسول prize رو خودش هر عددی بذاره). حالا Worker خودش تصادفی جایزه رو انتخاب می‌کنه و
  // مستقیم رو دیتابیس می‌نویسه؛ کلاینت فقط نتیجه رو برای نمایش می‌گیره.
  try{
    const __auth = await authHeaders();
    const res = await fetch(WORKER_BASE + '/wheel/spin', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, __auth)
    });
    const result = await res.json();
    if(!result || !result.ok){
      showToast(result && result.error === 'already_spun' ? 'قبلاً گردونه رو چرخوندی' : 'مشکلی پیش اومد، دوباره امتحان کن', 'error');
      btn.disabled = false; btn.textContent = '🎁 جایزه‌مو بگیر!';
      return;
    }
    const prize = result.percent;
    showToast(`🎉 تبریک! ${prize}٪ تخفیف بردی!`, 'success');
    const { data } = await sb.from('profiles')
      .select('username, referral_code, premium_until, referral_count, discount_percent, discount_code, wheel_spun')
      .eq('id', publicChatUser.id).single();
    renderInviteTab(data);
  }catch(err){ showToast('مشکلی پیش اومد، دوباره امتحان کن', 'error'); btn.disabled = false; btn.textContent = '🎁 جایزه‌مو بگیر!'; }
});

/* ---------------- Smart "invite a friend" nudge popup ----------------
   Surfaces the invite-discount idea at natural, encouraging moments during app use
   (finishing the day, hitting a streak, or backing off a premium prompt) — throttled
   so it never feels spammy, and only for logged-in, non-premium users who haven't
   already maxed out their discount. */
const INVITE_NUDGE_MIN_GAP_MS = 3 * 24 * 60 * 60 * 1000; // don't repeat within 3 days
const INVITE_NUDGE_MESSAGES = {
  daily100: 'امروز رو کامل کردی، آفرین 👏 می‌دونستی به‌جای خرید کامل پرمیوم می‌تونی با دعوت از چندتا از دوستات، تا ۵۰٪ تخفیف بگیری؟',
  streak7: 'یه هفته‌ی کامل پیاپی موندی رو مسیر، عالیه 🏆 با دعوت از چندتا از دوستات همین الان می‌تونی چند ده درصد تخفیف رو پرمیوم بگیری.',
  aigate: 'به‌جای صبر کردن برای هفته‌ی بعد یا خرید کامل، می‌تونی با دعوت از دوستات تخفیف بگیری و زودتر به همه‌چیز دسترسی داشته باشی.'
};
let pendingInviteNudgeReason = null;
function shouldOfferInviteNudge(){
  if(storeData.premium) return false;
  if(!isLoggedIn()) return false;
  if(myDiscount.percent >= 50) return false;
  const last = storeData.inviteNudge && storeData.inviteNudge.lastShownAt;
  if(last && (Date.now() - new Date(last).getTime()) < INVITE_NUDGE_MIN_GAP_MS) return false;
  return true;
}
function maybeShowInviteNudge(reason){
  if(!shouldOfferInviteNudge()) return;
  if(!storeData.inviteNudge) storeData.inviteNudge = { lastShownAt:null, count:0 };
  storeData.inviteNudge.lastShownAt = new Date().toISOString();
  storeData.inviteNudge.count = (storeData.inviteNudge.count || 0) + 1;
  saveData();
  showInviteNudge(reason);
}
function showInviteNudge(reason){
  const coachEl = document.getElementById('inviteNudgeCoachAvatar');
  if(coachEl) coachEl.innerHTML = buildCoachSVG('excited', 'invitenudge');
  const extra = myDiscount.percent > 0 ? ` (الان ${toFa(myDiscount.percent)}٪ تخفیف داری، می‌تونه بیشتر هم بشه)` : '';
  document.getElementById('inviteNudgeMsgText').textContent = (INVITE_NUDGE_MESSAGES[reason] || INVITE_NUDGE_MESSAGES.daily100) + extra;
  document.getElementById('inviteNudgeOverlay').classList.add('show');
}
function hideInviteNudge(){ document.getElementById('inviteNudgeOverlay').classList.remove('show'); }
document.getElementById('inviteNudgeGoBtn').addEventListener('click', ()=>{
  hideInviteNudge();
  enterSubPage('invite');
});
document.getElementById('inviteNudgeCloseBtn').addEventListener('click', hideInviteNudge);

/* ---------------- Cross-device checklist sync (requires a `user_data` table, see setup notes) ----------------
   Local window.storage stays the source of truth for anonymous/offline use. Once someone logs in,
   we also mirror storeData to Supabase so it follows them to other devices. Conflict handling is
   simple last-write-wins based on the `lastModified` timestamp stamped in saveData(). */
async function pushCloudData(){
  if(!sb || !publicChatUser) return;
  try{
    await sb.from('user_data').upsert({
      user_id: publicChatUser.id,
      data: storeData,
      updated_at: storeData.lastModified || new Date().toISOString()
    });
  }catch(err){ console.error('Cloud push failed', err); }
  try{ await syncMyLeaderboardData(); }catch(err){}
}
async function syncOnLogin(){
  if(!sb || !publicChatUser) return;
  try{
    const { data, error } = await sb.from('user_data').select('data,updated_at').eq('user_id', publicChatUser.id).single();
    if(error || !data){
      // No cloud copy yet — push whatever we have locally so it starts following this account.
      pushCloudData();
      return;
    }
    const cloudTime = data.updated_at ? new Date(data.updated_at).getTime() : 0;
    const localTime = storeData.lastModified ? new Date(storeData.lastModified).getTime() : 0;
    if(cloudTime > localTime){
      storeData = data.data;
      try{ await window.storage.set('checklist:data', JSON.stringify(storeData)); }catch(err){}
      normalizeAndRenderStoreData();
      showToast('پیشرفتت از دستگاه دیگه‌ات همگام شد ☁️');
    } else if(localTime > cloudTime){
      pushCloudData();
    }
  }catch(err){ console.error('Cloud sync failed', err); }
}

/* ---------------- Leaderboard (رتبه‌بندی) ----------------
   Ranks users by their CURRENT program day (`profiles.day_count`) — the
   same number shown on the live day-counter. A reset drops this back near
   zero, which naturally sinks that user to the bottom of the order.
   Requires these columns on the existing `profiles` table:
     alter table profiles add column if not exists day_count integer default 0;
     alter table profiles add column if not exists day_count_updated_at timestamptz;
     alter table profiles add column if not exists gender text;
   Inactive players (haven't opened the app in LB_ACTIVE_WINDOW_DAYS days) are
   filtered OUT of every leaderboard query below — NOT reset, just hidden —
   and reappear automatically, wherever their day_count currently ranks, the
   moment they open the app again (their session-resolve handler stamps
   last_active_at, which is the only thing this filter checks):
     alter table profiles add column if not exists last_active_at timestamptz;
   Plus these OPT-IN columns — every one of them stays null unless the user
   has explicitly flipped the matching toggle on in Settings ▸ امنیت و حریم
   خصوصی. Default is off for everyone, field-by-field, never inferred:
     alter table profiles add column if not exists age_range text;
     alter table profiles add column if not exists habit_icon text;
     alter table profiles add column if not exists program_length integer;
     alter table profiles add column if not exists identity_titles text;
   `profiles` already has public SELECT (used elsewhere for referral-code lookups),
   so no RLS change should be needed for reading the leaderboard — only make sure
   users can only UPDATE their own row (id = auth.uid()), which the existing
   profile-update calls already rely on. */
const LB_ACTIVE_WINDOW_DAYS = 7;
function lbActiveSinceIso(){
  return new Date(Date.now() - LB_ACTIVE_WINDOW_DAYS*24*60*60*1000).toISOString();
}
// Unconditional "I'm here right now" stamp — called once whenever a logged-in
// session is confirmed (app open / login), regardless of whether day_count or
// any other field changed since last time. This is what pulls someone back
// into the league after 7+ inactive days.
async function touchLeaderboardActivity(){
  if(!sb || !publicChatUser) return;
  try{ await sb.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', publicChatUser.id); }catch(err){}
}

/* ---- Habit category → icon, shown only when the "دسته‌ی عادت" toggle is on.
   Sensitive categories ALWAYS collapse to one generic target icon, no matter
   what — the toggle controls whether an icon shows at all, never which icon
   a sensitive habit gets. A user can never accidentally out themselves. */
const LB_SENSITIVE_ADDICTIONS = new Set(['porn','anxiety','other']);
const LB_ADDICTION_ICONS = {
  phone:'📱', gaming:'🎮', smoking:'🚬', alcohol:'🍷', binge:'🍔',
  sleep:'😴', procrastination:'⏳', shopping:'🛍️', nailbiting:'💅'
};
const LB_GOOD_HABIT_ICONS = {
  reading:'📖', voice:'🎙️', skill:'🧠', social:'🤝', language:'🗣️', instrument:'🎸', exercise:'🏋️', other:'✨'
};
const LB_GENERIC_HABIT_ICON = '🎯';
function lbHabitIcon(){
  const p = storeData.profile || {};
  const addiction = (p.addictions||[])[0];
  if(addiction) return (LB_SENSITIVE_ADDICTIONS.has(addiction) || !LB_ADDICTION_ICONS[addiction]) ? LB_GENERIC_HABIT_ICON : LB_ADDICTION_ICONS[addiction];
  const good = (p.goodHabits||[])[0];
  if(good) return LB_GOOD_HABIT_ICONS[good] || LB_GENERIC_HABIT_ICON;
  return null;
}
/* ---- Age → 10-year-ish bucket, shown only when the "بازه‌ی سنی" toggle is on. ---- */
function lbAgeRangeLabel(age){
  const a = parseInt(age,10);
  if(!a || a<=0) return null;
  if(a<18) return 'زیر ۱۸';
  if(a<=24) return '۱۸-۲۴';
  if(a<=34) return '۲۵-۳۴';
  if(a<=44) return '۳۵-۴۴';
  if(a<=54) return '۴۵-۵۴';
  return '۵۵+';
}
function lbProgramLenLabel(len){
  const l = parseInt(len,10);
  return l ? toFa(l)+' روزه' : null;
}

/* ================= Leaderboard: extra community stats (aggregate-only) =================
   Everything rendered here comes from fields the user already opts into sharing
   (habit_icon / program_length, same toggles as the per-row chips) or from data
   that's inherently aggregate by nature (today_done rate, streak buckets). None
   of it is per-user-identifiable, and nothing health/medication-related is ever
   synced or shown here — that stays local-only, by design.

   Requires this SQL function once, in the Supabase SQL editor (counts-only —
   never returns raw rows, so it can't leak more than the existing count()
   queries above already do):

   create or replace function get_leaderboard_extra_stats(active_since timestamptz)
   returns json language sql stable security definer set search_path = public as $$
     select json_build_object(
       'habit_breakdown', (
         select coalesce(json_agg(json_build_object('icon', habit_icon, 'count', cnt)), '[]'::json)
         from (select habit_icon, count(*) cnt from profiles
               where habit_icon is not null and last_active_at >= active_since
               group by habit_icon order by cnt desc) t
       ),
       'program_length_breakdown', (
         select coalesce(json_agg(json_build_object('length', program_length, 'count', cnt)), '[]'::json)
         from (select program_length, count(*) cnt from profiles
               where program_length is not null and last_active_at >= active_since
               group by program_length order by cnt desc) t
       ),
       'today_done_count', (select count(*) from profiles where today_done = true and today_date = current_date and last_active_at >= active_since),
       'today_total_count', (select count(*) from profiles where today_date = current_date and last_active_at >= active_since),
       'streak_7_plus', (select count(*) from profiles where current_streak >= 7 and last_active_at >= active_since),
       'streak_30_plus', (select count(*) from profiles where current_streak >= 30 and last_active_at >= active_since),
       'streak_100_plus', (select count(*) from profiles where current_streak >= 100 and last_active_at >= active_since),
       'avg_streak', (select round(avg(current_streak)) from profiles where current_streak is not null and last_active_at >= active_since)
     );
   $$;
   grant execute on function get_leaderboard_extra_stats(timestamptz) to anon, authenticated;
*/
/* ---- Small inline SVG icons used across the leaderboard page, replacing the
   emoji that used to sit in these spots (page title, stats, medals, crown,
   buddy actions, etc.). Kept as plain strings so they drop straight into the
   existing template-literal HTML below. ---- */
const LB_SVG_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>';
const LB_SVG_FLAME = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2c1 3.3-3.2 4.4-3.2 8.7a3.2 3.2 0 0 0 6.4 0c0-1.1-.3-2.1-1-2.9.9.3 3.3 1.9 3.3 5.6a5.5 5.5 0 0 1-11 0c0-4.4 2.2-6.6 3.3-7.7.3-1.3.7-2.5 2.2-3.7z"/></svg>';
const LB_SVG_TARGET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/></svg>';
const LB_SVG_CALENDAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>';
const LB_SVG_EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.3A10.4 10.4 0 0 1 12 5.2c5 0 8.5 3.4 10 6.8-.6 1.3-1.5 2.7-2.7 3.9M6.5 6.7C4.4 8.1 2.8 10 2 12c1.5 3.4 5 6.8 10 6.8 1.5 0 2.9-.3 4.1-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
const LB_SVG_HANDSHAKE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 10.5l4-2.8 4.3 3.2"/><path d="M21.5 10.5l-4-2.8-4.3 3.2"/><path d="M10.8 10.9l-3.6 3.2a1.5 1.5 0 0 0 2 2.2l.6-.5"/><path d="M13.2 10.9l3.6 3.2a1.5 1.5 0 0 1-2 2.2l-.6-.5"/><path d="M9.6 15.4l1 .9a1.6 1.6 0 0 0 2.2 0"/></svg>';
const LB_SVG_HOURGLASS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12M6 21h12"/><path d="M7 3c0 4 4 5.5 4 9s-4 5-4 9M17 3c0 4-4 5.5-4 9s4 5 4 9"/></svg>';
const LB_SVG_MEDAL_RIBBON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h8l-2.3 6.2h-3.4z"/><circle cx="12" cy="15" r="6"/></svg>';
const LB_SVG_CROWN = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 8.3l4.2 3.1 4.8-6.2 4.8 6.2 4.2-3.1-1.7 9.4H4.7L3 8.3z"/><rect x="4.6" y="18.6" width="14.8" height="1.9" rx="0.9"/></svg>';
const LB_SVG_FEMALE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4.6"/><path d="M12 12.6v8M8.4 17.2h7.2"/></svg>';
const LB_SVG_MALE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.3" cy="13.7" r="5.3"/><path d="M14.3 9.7L20 4M14.6 4h5.4v5.4"/></svg>';
const LB_SVG_PEOPLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c0-3.6 2.6-5.8 5.5-5.8s5.5 2.2 5.5 5.8"/><path d="M15.4 8.8a2.6 2.6 0 1 0 0-5.2"/><path d="M15 13.4c2.4.3 4.5 2.3 4.5 5.6"/></svg>';
// Medal colors reuse the same gold/silver/bronze palette as the podium cards
// (.lb-podium-item.gold/.silver/.bronze) so the icon always matches its card.
const LB_MEDAL_COLORS = {1:['#ffd76a','#e8a020'],2:['#e3e9f0','#a9b4c2'],3:['#e3a879','#b9743f']};
function lbMedalSvg(rank){
  const c = LB_MEDAL_COLORS[rank];
  if(!c) return '';
  return '<svg viewBox="0 0 24 24"><path d="M8 2h8l-2.6 7h-2.8z" fill="'+c[1]+'"/><circle cx="12" cy="15" r="7" fill="'+c[0]+'" stroke="'+c[1]+'" stroke-width="1.4"/><circle cx="12" cy="15" r="3.4" fill="none" stroke="#fff" stroke-width="1.2" opacity=".65"/></svg>';
}
const LB_ICON_LABELS = {
  '📱':'گوشی و شبکه‌های اجتماعی', '🎮':'بازی‌های ویدیویی', '🚬':'سیگار و دخانیات', '🍷':'الکل',
  '🍔':'پرخوری / خوردن هیجانی', '😴':'بی‌نظمی خواب', '⏳':'تعلل و اهمال‌کاری', '🛍️':'خرید وسواسی', '💅':'ناخن‌جویدن',
  '📖':'مطالعه‌ی روزانه', '🎙️':'صداسازی / فن بیان', '🧠':'یادگیری یه مهارت جدید', '🤝':'بهبود روابط عمومی',
  '🗣️':'یادگیری زبان دوم', '🎸':'یادگیری یه ساز', '🏋️':'ورزش منظم',
  '🎯':'یه عادت شخصی', '✨':'یه هدف شخصی'
};
function lbRenderTodayProgress(doneCount, totalCount){
  const el = document.getElementById('lbTodayProgress');
  if(!el) return;
  if(!totalCount){ el.innerHTML = ''; return; }
  const pct = Math.round((doneCount/totalCount)*100);
  el.innerHTML = `
    <div class="lb-today-card">
      <div class="lb-today-pct">٪${toFa(pct)}</div>
      <div class="lb-today-sub">از ${toFa(totalCount)} کاربر فعال، امروز چک‌لیستشونو زدن ${LB_SVG_CHECK}</div>
    </div>`;
}
function lbRenderStreakStats(s){
  const el = document.getElementById('lbStreakStats');
  if(!el || !s) { if(el) el.innerHTML=''; return; }
  el.innerHTML = `
    <div class="lb-extra-title">${LB_SVG_FLAME} استمرار جامعه</div>
    <div class="lb-milestone-row">
      <div class="lb-milestone-chip"><div class="lb-gs-num">${toFa(s.streak_7_plus||0)}</div><div class="lb-gs-label">۷+ روز پیوسته</div></div>
      <div class="lb-milestone-chip"><div class="lb-gs-num">${toFa(s.streak_30_plus||0)}</div><div class="lb-gs-label">۳۰+ روز پیوسته</div></div>
      <div class="lb-milestone-chip"><div class="lb-gs-num">${toFa(s.streak_100_plus||0)}</div><div class="lb-gs-label">۱۰۰+ روز پیوسته</div></div>
      <div class="lb-milestone-chip"><div class="lb-gs-num">${toFa(s.avg_streak||0)}</div><div class="lb-gs-label">میانگین استمرار</div></div>
    </div>`;
}
function lbRenderHabitBreakdown(rows){
  const el = document.getElementById('lbHabitBreakdown');
  if(!el) return;
  if(!rows || !rows.length){ el.innerHTML = ''; return; }
  const total = rows.reduce((a,r)=>a+(r.count||0), 0);
  if(!total){ el.innerHTML = ''; return; }
  const top = rows.slice(0,6);
  const bars = top.map(r=>{
    const pct = Math.round((r.count/total)*100);
    const label = LB_ICON_LABELS[r.icon] || 'یه عادت شخصی';
    return `<div class="lb-bar-row">
      <span class="lb-bar-icon">${r.icon}</span>
      <span class="lb-bar-label">${escapeHtml(label)}</span>
      <span class="lb-bar-track"><span class="lb-bar-fill" style="width:${pct}%"></span></span>
      <span class="lb-bar-pct">${toFa(pct)}٪</span>
    </div>`;
  }).join('');
  el.innerHTML = `
    <div class="lb-extra-title">${LB_SVG_TARGET} عادت‌هایی که بقیه روشون کار می‌کنن</div>
    ${bars}
    <div class="lb-extra-note">بر اساس ${toFa(total)} نفری که تو تنظیمات، نمایش عادتشونو فعال کردن</div>`;
}
function lbRenderProgramLenBreakdown(rows){
  const el = document.getElementById('lbProgramLenBreakdown');
  if(!el) return;
  if(!rows || !rows.length){ el.innerHTML = ''; return; }
  const total = rows.reduce((a,r)=>a+(r.count||0), 0);
  if(!total){ el.innerHTML = ''; return; }
  const bars = rows.map(r=>{
    const pct = Math.round((r.count/total)*100);
    const label = lbProgramLenLabel(r.length) || '—';
    return `<div class="lb-bar-row">
      <span class="lb-bar-icon">${LB_SVG_CALENDAR}</span>
      <span class="lb-bar-label">${escapeHtml(label)}</span>
      <span class="lb-bar-track"><span class="lb-bar-fill" style="width:${pct}%"></span></span>
      <span class="lb-bar-pct">${toFa(pct)}٪</span>
    </div>`;
  }).join('');
  el.innerHTML = `
    <div class="lb-extra-title">${LB_SVG_CALENDAR} طول برنامه‌ی بقیه</div>
    ${bars}
    <div class="lb-extra-note">بر اساس ${toFa(total)} نفری که تو تنظیمات، نمایش طول برنامه‌شونو فعال کردن</div>`;
}
/* Fetches extra_stats via RPC and renders all four extra sections. Non-fatal —
   if the RPC isn't set up yet (or fails), the sections just render empty and
   the rest of the leaderboard keeps working exactly as before. */
async function lbLoadExtraStats(activeSince){
  try{
    const { data, error } = await sb.rpc('get_leaderboard_extra_stats', { active_since: activeSince });
    if(error || !data) throw error || new Error('no data');
    lbRenderTodayProgress(data.today_done_count, data.today_total_count);
    lbRenderStreakStats(data);
    lbRenderHabitBreakdown(data.habit_breakdown);
    lbRenderProgramLenBreakdown(data.program_length_breakdown);
  }catch(err){
    console.error('Leaderboard extra stats failed (RPC likely not set up yet):', err);
    ['lbTodayProgress','lbStreakStats','lbHabitBreakdown','lbProgramLenBreakdown'].forEach(id=>{
      const el = document.getElementById(id); if(el) el.innerHTML = '';
    });
  }
}

/* ---- Builds exactly what this device would publish right now, respecting
   each toggle — used both for the sync call and the settings live preview,
   so "what you see in the preview" and "what actually gets sent" can never drift. ---- */
// Comma-joined ids of identity titles this device has actually unlocked (see
// FOCUS_IDENTITIES / storeData.badges) — only sent when the "عنوان‌های حالت"
// toggle is on. Stored as ids, not emoji/text, so labels stay in sync with
// FOCUS_IDENTITIES client-side and nothing extra needs translating server-side.
function lbMyEarnedIdentityIds(){
  return FOCUS_IDENTITIES.filter(f=> storeData.badges && storeData.badges[f.id]).map(f=>f.id);
}
function lbMyPublicFields(){
  const priv = storeData.lbPrivacy || {};
  return {
    day_count: liveElapsedDays(),
    gender: (storeData.profile && storeData.profile.gender) || null,
    age_range: priv.age ? lbAgeRangeLabel(storeData.profile && storeData.profile.age) : null,
    habit_icon: priv.habit ? lbHabitIcon() : null,
    program_length: priv.programLen ? (storeData.programLength||null) : null,
    identity_titles: priv.titles ? lbMyEarnedIdentityIds().join(',') : null,
    // undefined (not null) when we haven't loaded the server profile yet, so the
    // periodic sync below never accidentally wipes out an already-uploaded photo.
    avatar_url: (myProfileCache && myProfileCache.avatar_url) || undefined
  };
}
let lbLastSyncedKey = null;
async function syncMyLeaderboardData(){
  if(!sb || !publicChatUser) return;
  const fields = lbMyPublicFields();
  const key = JSON.stringify(fields);
  if(key === lbLastSyncedKey) return;
  try{
    await sb.from('profiles').update(Object.assign({}, fields, { day_count_updated_at: new Date().toISOString(), last_active_at: new Date().toISOString() })).eq('id', publicChatUser.id);
    lbLastSyncedKey = key;
  }catch(err){ console.error('Leaderboard sync failed', err); }
}
/* ---- Settings ▸ live preview card + toggle wiring ---- */
function renderLbPrivacyUI(){
  const ageT = document.getElementById('lbShowAgeToggle');
  const habitT = document.getElementById('lbShowHabitToggle');
  const lenT = document.getElementById('lbShowProgLenToggle');
  const titlesT = document.getElementById('lbShowTitlesToggle');
  if(!ageT || !habitT || !lenT || !titlesT) return;
  const priv = storeData.lbPrivacy || {age:false, habit:false, programLen:false, titles:false};
  ageT.checked = !!priv.age;
  habitT.checked = !!priv.habit;
  lenT.checked = !!priv.programLen;
  titlesT.checked = !!priv.titles;
  const previewEl = document.getElementById('lbPrivacyPreview');
  if(previewEl){
    const me = Object.assign({
      id:'preview', username: (typeof publicChatUsername!=='undefined' && publicChatUsername) || (storeData.profile && storeData.profile.firstName) || 'تو'
    }, lbMyPublicFields());
    previewEl.innerHTML = lbRowHtml(1, me);
  }
}
['lbShowAgeToggle','lbShowHabitToggle','lbShowProgLenToggle','lbShowTitlesToggle'].forEach(id=>{
  const el = document.getElementById(id);
  if(!el) return;
  el.addEventListener('change', (e)=>{
    if(!storeData.lbPrivacy) storeData.lbPrivacy = {age:false, habit:false, programLen:false, titles:false};
    const key = id==='lbShowAgeToggle' ? 'age' : id==='lbShowHabitToggle' ? 'habit' : id==='lbShowProgLenToggle' ? 'programLen' : 'titles';
    storeData.lbPrivacy[key] = e.target.checked;
    saveData();
    renderLbPrivacyUI();
    syncMyLeaderboardData();
  });
});
// Preview card lives in Settings (outside #tab-leaderboard), so it needs its
// own tiny flip listener — tap it to see exactly what others will see on
// the back of your card.
document.getElementById('lbPrivacyPreview').addEventListener('click', (e)=>{
  const card = e.target.closest('.lb-flip');
  if(card) card.classList.toggle('is-flipped');
});

const LB_AVATAR_COLORS = ['#ff9a3d','#5b8def','#3fb87f','#e2665a','#8e6fce','#f0b429','#e2569a','#2fb3c9'];
function lbColorFor(id){
  const s = String(id||'?');
  let h=0; for(let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) >>> 0;
  return LB_AVATAR_COLORS[h % LB_AVATAR_COLORS.length];
}
function lbInitial(name){
  const n = (name||'؟').trim();
  return n ? n[0].toUpperCase() : '؟';
}
// Avatar circle content, in priority order:
// ۱) uploaded photo  ۲) a male/female avatar emoji when gender is known
// ۳) the colored-initial fallback (only when gender is also unset).
// Female/male leaderboard avatars — clean flat-vector bust portraits (replacing the
// plain 👩/👨 emoji) shown whenever a user hasn't set a custom photo. Transparent
// background so they sit on top of the per-user colored circle (lbColorFor) exactly
// like the emoji did; skin tone matches the coach mascot's palette for consistency.
const LB_AVATAR_FEMALE_SVG = '<svg viewBox="0 0 40 40" width="100%" height="100%"><path d="M4 40c0-9.4 7.2-15 16-15s16 5.6 16 15z" fill="#c65b8a"/><path d="M16 21h8v7.5a4 4 0 0 1-8 0z" fill="#ffdab3"/><path d="M9.3 16.2c0-7.6 4.7-13 10.7-13s10.7 5.4 10.7 13v8.6c0-.3-1.7-1-2.7-2.6a7 7 0 0 1-1-3.6v-2.7c0-4.4-3.1-7.4-7-7.4s-7 3-7 7.4v2.7a7 7 0 0 1-1 3.6c-1 1.6-2.7 2.9-2.7 2.6z" fill="#2e1f18"/><circle cx="20" cy="17" r="8.2" fill="#ffdab3"/><path d="M11.8 14.6c0-6.2 3.7-10.4 8.2-10.4s8.2 4.2 8.2 10.4c-2-2.9-4.7-4.6-8.2-4.6s-6.2 1.7-8.2 4.6z" fill="#2e1f18"/><path d="M26.5 12.3c1 1.1 1.6 2.7 1.7 4.3-.7-1.6-1.7-2.9-2.9-3.8.4-.2.8-.4 1.2-.5z" fill="#4a3226" opacity=".7"/></svg>';
const LB_AVATAR_MALE_SVG = '<svg viewBox="0 0 40 40" width="100%" height="100%"><path d="M4 40c0-9.4 7.2-15 16-15s16 5.6 16 15z" fill="#3d4f7a"/><path d="M16 21h8v6.5a4 4 0 0 1-8 0z" fill="#ffdab3"/><circle cx="20" cy="17" r="8.2" fill="#ffdab3"/><path d="M11.7 15.5c0-6.4 3.7-11 8.3-11s8.3 4.6 8.3 11c0-2.2-.8-3.8-1.8-4.6-2 1.7-4.2 2.6-6.5 2.6s-4.5-.9-6.5-2.6c-1 .8-1.8 2.4-1.8 4.6z" fill="#241a14"/><path d="M12.6 12.6c1.9-1.9 4.3-3.1 7.4-3.1s5.5 1.2 7.4 3.1c-.3-3.6-3.5-6.3-7.4-6.3s-7.1 2.7-7.4 6.3z" fill="#241a14"/></svg>';
function lbAvatarInnerHtml(user, name){
  if(user && user.avatar_url) return `<img src="${escapeHtml(user.avatar_url)}" alt="" loading="lazy">`;
  if(user && user.gender==='female') return LB_AVATAR_FEMALE_SVG;
  if(user && user.gender==='male') return LB_AVATAR_MALE_SVG;
  return escapeHtml(lbInitial(name));
}
function lbGenderBadge(gender){
  if(gender==='female') return '<span class="lb-gender-badge female" title="زن">♀</span>';
  if(gender==='male') return '<span class="lb-gender-badge male" title="مرد">♂</span>';
  return '';
}
/* ---- Level shown on leaderboard cards ----
   For your own card we know the real XP (computeXP), so the number matches
   exactly what shows in تب پیشرفت. For everyone else, only `day_count` is
   public, so we estimate their level from it using the same LEVELS curve —
   good enough for a cosmetic "respect" cue, not meant to be exact. */
function lbLevelIndexFor(user){
  if(publicChatUser && user && user.id === publicChatUser.id){
    const xp = computeXP();
    let idx=0; for(let i=0;i<LEVELS.length;i++){ if(xp>=LEVELS[i].min) idx=i; }
    return idx;
  }
  const days = (user && user.day_count) || 0;
  const estXp = days*18;
  let idx=0; for(let i=0;i<LEVELS.length;i++){ if(estXp>=LEVELS[i].min) idx=i; }
  return idx;
}
// Prestige tiers grouping the 24 levels into visual bands — the higher a
// user's level, the fancier the frame around their card, completely
// separate from their rank position (so a high-level user on rank #40
// still gets the respect their level earned).
const LB_TIERS = [
  {max:3,  cls:''},
  {max:7,  cls:'lb-tier-bronze'},
  {max:11, cls:'lb-tier-silver'},
  {max:15, cls:'lb-tier-gold'},
  {max:19, cls:'lb-tier-diamond'},
  {max:99, cls:'lb-tier-legend'}
];
function lbTierClassFor(levelIdx){
  for(const t of LB_TIERS){ if(levelIdx<=t.max) return t.cls; }
  return LB_TIERS[LB_TIERS.length-1].cls;
}
function lbLevelBadgeHtml(levelIdx){
  return '<span class="lb-mini-level" title="سطح '+toFa(levelIdx+1)+'">'+toFa(levelIdx+1)+'</span>';
}
// Renders the optional chip row (age range / habit icon / program length) —
// only the fields a user actually has set come through, so a card with
// nothing toggled on renders nothing here and stays exactly as clean as before.
function lbMetaHtml(user){
  const chips = [];
  if(user.age_range) chips.push('<span class="lb-chip">'+escapeHtml(user.age_range)+'</span>');
  if(user.habit_icon) chips.push('<span class="lb-chip" title="در حال کار روی یه عادت">'+user.habit_icon+'</span>');
  if(user.program_length) chips.push('<span class="lb-chip">'+escapeHtml(lbProgramLenLabel(user.program_length)||'')+'</span>');
  return chips.length ? '<div class="lb-meta-row">'+chips.join('')+'</div>' : '';
}
// Identity-title chips (e.g. 🏋️ ورزشکار) earned via تب «حالت» — only present
// when the card owner turned the "عنوان‌های حالت" toggle on; ids are matched
// against the local FOCUS_IDENTITIES table for their emoji/title.
function lbIdentityChipsHtml(user){
  const ids = String(user.identity_titles||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(!ids.length) return '';
  const chips = ids.map(id=>{
    const f = FOCUS_IDENTITIES.find(x=> x.id===id);
    return f ? '<span class="lb-identity-chip">'+f.emoji+' '+escapeHtml(f.title)+'</span>' : '';
  }).filter(Boolean);
  return chips.length ? '<div class="lb-back-chip-wrap">'+chips.join('')+'</div>' : '';
}
// Full back-of-card content: everything the card owner has opted into
// sharing (age range / habit / program length / identity titles) — nothing
// that isn't already gated by one of the Settings ▸ privacy toggles.
function lbCardBackHtml(user){
  const idChips = lbIdentityChipsHtml(user);
  const meta = lbMetaHtml(user);
  if(!idChips && !meta) return '<div class="lb-flip-back-empty">'+LB_SVG_EYE_OFF+' این کاربر چیزی برای نمایش عمومی فعال نکرده</div>';
  return (idChips ? '<div class="lb-back-title">'+LB_SVG_MEDAL_RIBBON+' عنوان‌ها</div>'+idChips : '') + meta;
}
function lbRowHtml(rank, user, opts){
  opts = opts || {};
  const isMe = publicChatUser && user.id === publicChatUser.id;
  const name = displayName(user.username);
  const color = lbColorFor(user.id || name);
  const levelIdx = lbLevelIndexFor(user);
  const tierCls = lbTierClassFor(levelIdx);
  return `<div class="lb-row lb-flip${isMe?' me':''}${tierCls?' '+tierCls:''}">
    <div class="lb-flip-inner">
      <div class="lb-flip-front">
        <div class="lb-rank">${toFa(rank)}</div>
        <div class="lb-avatar-wrap">
          <div class="lb-avatar" style="background:${user.avatar_url?'transparent':color}">${lbAvatarInnerHtml(user, name)}</div>
          ${lbGenderBadge(user.gender)}
          ${lbLevelBadgeHtml(levelIdx)}
        </div>
        <div style="flex:1;min-width:0;">
          <div class="lb-name">${escapeHtml(name)}${isMe?' <span class="lb-me-tag">تو</span>':''}</div>
        </div>
        <div class="lb-days">${toFa(user.day_count||0)}<span class="lb-days-label">روز</span></div>
      </div>
      <div class="lb-flip-back">${lbCardBackHtml(user)}</div>
    </div>
    ${opts.buddy ? lbBuddyBtnHtml(user) : ''}
  </div>`;
}
function lbPodiumHtml(rank, user, cls, medal, opts){
  opts = opts || {};
  const isMe = publicChatUser && user.id === publicChatUser.id;
  const name = displayName(user.username);
  const color = lbColorFor(user.id || name);
  const levelIdx = lbLevelIndexFor(user);
  const tierCls = lbTierClassFor(levelIdx);
  return `<div class="lb-podium-item lb-flip ${cls}${isMe?' me':''}${tierCls?' '+tierCls:''}">
    <div class="lb-crown">${rank===1?LB_SVG_CROWN:''}</div>
    <div class="lb-flip-inner">
      <div class="lb-flip-front">
        <div class="lb-avatar-wrap">
          <div class="lb-p-avatar" style="background:${user.avatar_url?'transparent':color}">${lbAvatarInnerHtml(user, name)}</div>
          ${lbGenderBadge(user.gender)}
          ${lbLevelBadgeHtml(levelIdx)}
        </div>
        <div class="lb-p-name">${escapeHtml(name)}${isMe?' <span class="lb-me-tag">تو</span>':''}</div>
        <div class="lb-p-days">${toFa(user.day_count||0)}<span class="lb-p-days-label">روز</span></div>
        <div class="lb-medal">${medal}</div>
      </div>
      <div class="lb-flip-back">${lbCardBackHtml(user)}</div>
    </div>
    ${opts.buddy ? lbBuddyBtnHtml(user) : ''}
  </div>`;
}
/* ---- Buddy-request button rendered on each podium/list leaderboard card.
   Reads the already-loaded myBuddyPair / myPendingBuddyRequests state (see
   the Buddy feature block below) so no extra request is made per card. ---- */
function lbBuddyBtnHtml(user){
  if(!publicChatUser || !user.id || user.id === publicChatUser.id) return '';
  if(myBuddyPair){
    const partnerId = myBuddyPair.user_a === publicChatUser.id ? myBuddyPair.user_b : myBuddyPair.user_a;
    if(user.id === partnerId) return '<button class="lb-buddy-btn paired" disabled>'+LB_SVG_HANDSHAKE+' هم‌مسیرتی</button>';
    return '';
  }
  const outgoing = myPendingBuddyRequests.find(r=> r.from_user===publicChatUser.id && r.to_user===user.id);
  if(outgoing) return '<button class="lb-buddy-btn pending" disabled>'+LB_SVG_HOURGLASS+' درخواست فرستاده شد</button>';
  const incoming = myPendingBuddyRequests.find(r=> r.to_user===publicChatUser.id && r.from_user===user.id);
  if(incoming) return '<button class="lb-buddy-btn accept" data-accept-req="'+incoming.id+'">'+LB_SVG_CHECK+' قبول درخواست</button>';
  return '<button class="lb-buddy-btn" data-request-uid="'+user.id+'">'+LB_SVG_HANDSHAKE+' هم‌مسیر شو</button>';
}
// Small badge shown ONLY on your own card in the horizontal strip below,
// comparing your rank right now against the last time the leaderboard was
// loaded (storeData.lbLastRank). Green ▲ = climbed, red ▼ = dropped.
let lbMyRankDelta = null;
function lbRankDeltaHtml(){
  if(!lbMyRankDelta) return '';
  const up = lbMyRankDelta > 0;
  return '<span class="lb-rank-delta '+(up?'up':'down')+'" title="'+(up?'رتبه‌ات بالا رفته':'رتبه‌ات پایین اومده')+'">'+(up?'▲':'▼')+' '+toFa(Math.abs(lbMyRankDelta))+'</span>';
}
function lbStripCardHtml(rank, user){
  const isMe = publicChatUser && user.id === publicChatUser.id;
  const name = displayName(user.username);
  const color = lbColorFor(user.id || name);
  const levelIdx = lbLevelIndexFor(user);
  const tierCls = lbTierClassFor(levelIdx);
  return `<div class="lb-strip-card lb-flip${isMe?' me':''}${tierCls?' '+tierCls:''}" data-me="${isMe?'1':'0'}">
    ${isMe ? lbRankDeltaHtml() : lbStripBuddyBadgeHtml(user)}
    <div class="lb-flip-inner">
      <div class="lb-flip-front">
        <div class="lb-strip-rank">#${toFa(rank)}</div>
        <div class="lb-avatar-wrap">
          <div class="lb-avatar" style="background:${user.avatar_url?'transparent':color}">${lbAvatarInnerHtml(user, name)}</div>
          ${lbGenderBadge(user.gender)}
          ${lbLevelBadgeHtml(levelIdx)}
        </div>
        <div class="lb-strip-name">${escapeHtml(name)}</div>
        <div class="lb-strip-days">${toFa(user.day_count||0)}<span class="lb-strip-days-label"> روز</span></div>
      </div>
      <div class="lb-flip-back">${lbCardBackHtml(user)}</div>
    </div>
  </div>`;
}
// Tiny corner badge marking your current buddy's card in the "جایگاه تو" rail —
// no click target here (space is too tight for a full request button); the
// full accept/request flow lives on the podium/list cards and the هم‌مسیر tab.
function lbStripBuddyBadgeHtml(user){
  if(!publicChatUser || !myBuddyPair || !user.id) return '';
  const partnerId = myBuddyPair.user_a === publicChatUser.id ? myBuddyPair.user_b : myBuddyPair.user_a;
  return user.id === partnerId ? '<span class="lb-strip-buddy-badge" title="هم‌مسیرته">'+LB_SVG_HANDSHAKE+'</span>' : '';
}
// Renders the "جایگاه تو" panel as a horizontally scrollable rail: rank #1
// sits at the (right) start of the legend bar and rank gets worse going left.
// Scroll position opens centered on your own card.
function lbRenderYourRankStrip(yourRankEl, stripItems, myRank){
  const legend = `<div class="lb-scroll-legend">
    <span class="lb-scroll-legend-end">${lbMedalSvg(1)} رتبه ۱</span>
    <span class="lb-scroll-legend-track"></span>
    <span class="lb-scroll-legend-arrow">رتبه‌های پایین‌تر ⟵</span>
  </div>`;
  const head = '<div class="lb-your-rank-head">جایگاه تو — رتبه '+toFa(myRank)+'</div>';
  const cardsHtml = stripItems.map(it=> it.gap ? '<div class="lb-strip-gap">⋯</div>' : lbStripCardHtml(it.rank, it.user)).join('');
  yourRankEl.innerHTML = head + legend + '<div class="lb-strip" id="lbStrip">'+cardsHtml+'</div>';
  yourRankEl.style.display = 'block';
  requestAnimationFrame(()=>{
    try{
      const stripEl = document.getElementById('lbStrip');
      const meEl = stripEl && stripEl.querySelector('[data-me="1"]');
      if(meEl) meEl.scrollIntoView({inline:'center', block:'nearest'});
    }catch(err){}
  });
}
let lbLoading = false;
// وقتی همین تازگی (کمتر از ۱۲ ثانیه پیش) لیدربورد لود شده، برگشتن سریع به این تب دیگه
// نیازی به لودینگ/کوئری دوباره نداره — محتوای قبلی رو (که تو DOM همچنان هست چون تب‌ها
// موقع سوییچ حذف نمی‌شن، فقط مخفی می‌شن) همونطور نگه می‌داریم. باعث می‌شه رفت‌وبرگشت بین
// تب‌های بخش عمومی حس آنی داشته باشه به‌جای اینکه هر بار منتظر شبکه بمونه.
let lbLastLoadedAt = 0;
const LB_FRESH_MS = 12000;
async function loadLeaderboard(force){
  if(lbLoading) return;
  if(!force && lbLastLoadedAt && (Date.now() - lbLastLoadedAt) < LB_FRESH_MS) return;
  lbLoading = true;
  const loadingEl = document.getElementById('lbLoading');
  const contentEl = document.getElementById('lbContent');
  const unconfEl = document.getElementById('lbUnconfigured');
  const errEl = document.getElementById('lbErrorBox');
  const emptyEl = document.getElementById('lbEmptyBox');
  const yourRankEl = document.getElementById('lbYourRank');
  loadingEl.style.display = 'flex';
  contentEl.style.display = 'none';
  unconfEl.style.display = 'none';
  errEl.style.display = 'none';
  emptyEl.style.display = 'none';
  yourRankEl.style.display = 'none';

  if(!chatConfigured() || !sb){
    loadingEl.style.display = 'none';
    unconfEl.style.display = 'block';
    lbLoading = false;
    return;
  }
  const LB_COLS = 'id,username,day_count,gender,age_range,habit_icon,program_length,identity_titles,avatar_url';
  try{
    const activeSince = lbActiveSinceIso();
    // این سه کار به نتیجه‌ی هم نیازی ندارن (sync، بارگذاری روابط هم‌مسیر، و کوئری‌های
    // خود لیدربورد کاملاً مستقلن)، پس به‌جای await پشت‌سرهم (که هر کدوم یه رفت‌وبرگشت
    // شبکه‌ی جدا بود)، همه با هم موازی اجرا می‌شن — همون تاخیر محسوسی که تب‌های عمومی
    // موقع باز شدن داشتن عمدتاً از همینجا بود.
    const buddyRelationsPromise = (typeof loadMyBuddyRelations === 'function') ? loadMyBuddyRelations() : Promise.resolve();
    const [, , { count: totalUsers }, { count: femaleCount }, { count: maleCount }, { data: topUsers, error: topErr }] = await Promise.all([
      syncMyLeaderboardData(),
      buddyRelationsPromise,
      sb.from('profiles').select('id', { count: 'exact', head: true }).gte('last_active_at', activeSince),
      sb.from('profiles').select('id', { count: 'exact', head: true }).eq('gender','female').gte('last_active_at', activeSince),
      sb.from('profiles').select('id', { count: 'exact', head: true }).eq('gender','male').gte('last_active_at', activeSince),
      sb.from('profiles').select(LB_COLS).gte('last_active_at', activeSince).order('day_count', { ascending:false }).order('username', { ascending:true }).limit(50)
    ]);
    if(topErr) throw topErr;

    document.getElementById('lbTotalUsers').textContent = toFa(totalUsers || (topUsers?topUsers.length:0));
    document.getElementById('lbGenderStats').innerHTML = `
      <div class="lb-gender-stat female"><div class="lb-gs-num">${toFa(femaleCount||0)}</div><div class="lb-gs-label">${LB_SVG_FEMALE} کاربر دختر</div></div>
      <div class="lb-gender-stat male"><div class="lb-gs-num">${toFa(maleCount||0)}</div><div class="lb-gs-label">${LB_SVG_MALE} کاربر پسر</div></div>
      <div class="lb-gender-stat total"><div class="lb-gs-num">${toFa(totalUsers||0)}</div><div class="lb-gs-label">${LB_SVG_PEOPLE} کل کاربران</div></div>
    `;

    const list = (topUsers || []).map(u=> ({
      id:u.id, username:u.username, day_count: u.day_count||0, gender: u.gender||'',
      age_range: u.age_range||null, habit_icon: u.habit_icon||null, program_length: u.program_length||null,
      identity_titles: u.identity_titles||null
    }));

    if(!list.length){
      contentEl.style.display = 'none';
      emptyEl.style.display = 'block';
      loadingEl.style.display = 'none';
      lbLoading = false;
      return;
    }

    // همه‌ی رتبه‌ها (نه فقط ۳ نفر اول) با همون استایل کارت گرد پودیوم رندر می‌شن،
    // توی یه نوار افقی قابل اسکرول — نفر اول همیشه سمت چپ‌ترین کارته و به ترتیب
    // رتبه به سمت راست ادامه پیدا می‌کنه (لیست مستطیلیِ قبلی حذف شد).
    const podiumEl = document.getElementById('lbPodium');
    const classes = ['gold','silver','bronze'];
    podiumEl.innerHTML = list.map((u,i)=>{
      const cls = i < 3 ? classes[i] : 'plain';
      const medal = i < 3 ? lbMedalSvg(i+1) : ('رتبه '+toFa(i+1));
      return lbPodiumHtml(i+1, u, cls, medal, {buddy:true});
    }).join('');

    const listEl = document.getElementById('lbList');
    if(listEl) listEl.innerHTML = '';

    contentEl.style.display = 'block';

    // Extra community stats — separate, non-blocking call: if the RPC isn't
    // set up yet (or the request fails), the main leaderboard above still
    // renders and works exactly as before.
    lbLoadExtraStats(activeSince);

    // "Your rank" strip — resolves your exact rank (whether you're in the
    // top 50 or not), tracks the change since last time for the ▲/▼ badge,
    // and — only when you're not already visible up in the podium/list —
    // renders a horizontally scrollable rail you can drag from your position
    // all the way to rank #1.
    if(publicChatUser){
      const myIndex = list.findIndex(u=> u.id === publicChatUser.id);
      let myRank = null, stripItems = null;
      if(myIndex !== -1){
        myRank = myIndex + 1;
        if(myIndex >= 5){
          stripItems = list.map((u,i)=> ({ rank:i+1, user:u }));
        }
      } else {
        const myDay = liveElapsedDays();
        const NEI = 15;
        const [{ data: above }, { data: below }, { count: betterCount }] = await Promise.all([
          sb.from('profiles').select(LB_COLS).gte('day_count', myDay).neq('id', publicChatUser.id).gte('last_active_at', activeSince)
            .order('day_count', { ascending:true }).limit(NEI),
          sb.from('profiles').select(LB_COLS).lte('day_count', myDay).neq('id', publicChatUser.id).gte('last_active_at', activeSince)
            .order('day_count', { ascending:false }).limit(NEI),
          sb.from('profiles').select('id', { count:'exact', head:true }).gt('day_count', myDay).gte('last_active_at', activeSince)
        ]);
        myRank = (betterCount||0) + 1;
        const me = Object.assign({ id: publicChatUser.id, username: publicChatUsername }, lbMyPublicFields());
        const aboveSorted = (above||[]).slice().reverse();
        const belowSorted = (below||[]);
        const neighborRows = [];
        aboveSorted.forEach((u,i)=> neighborRows.push({ rank: myRank-(aboveSorted.length-i), user:u }));
        neighborRows.push({ rank: myRank, user: me });
        belowSorted.forEach((u,i)=> neighborRows.push({ rank: myRank+i+1, user:u }));
        stripItems = list.map((u,i)=> ({ rank:i+1, user:u })).concat([{ gap:true }], neighborRows);
      }
      lbMyRankDelta = (myRank!=null && storeData.lbLastRank!=null) ? (storeData.lbLastRank - myRank) : null;
      if(myRank!=null && myRank !== storeData.lbLastRank){ storeData.lbLastRank = myRank; saveData(); }
      if(stripItems) lbRenderYourRankStrip(yourRankEl, stripItems, myRank);
    }
  }catch(err){
    console.error('Leaderboard load failed', err);
    errEl.style.display = 'block';
  }finally{
    loadingEl.style.display = 'none';
    lbLoading = false;
    lbLastLoadedAt = Date.now();
  }
}
const lbRefreshBtnEl = document.getElementById('lbRefreshBtn');
if(lbRefreshBtnEl) lbRefreshBtnEl.addEventListener('click', loadLeaderboard);
document.getElementById('tab-leaderboard').addEventListener('click', (e)=>{
  const reqBtn = e.target.closest('[data-request-uid]');
  if(reqBtn){ sendDirectBuddyRequest(reqBtn.dataset.requestUid); return; }
  const accBtn = e.target.closest('[data-accept-req]');
  if(accBtn){ acceptBuddyRequest(accBtn.dataset.acceptReq); return; }
  // Tap a card (podium / list row / your-rank strip) to flip it and reveal
  // whatever the card owner opted into sharing (age range, habit, program
  // length, identity titles). Never fires for the buddy-request buttons
  // above since those return early first.
  const card = e.target.closest('.lb-flip');
  if(card) card.classList.toggle('is-flipped');
});

/* ================= لمسِ زنده‌ی کارت‌های لیدربورد (پادیوم/ردیف/نوار «جایگاه تو») =================
   انگشتت رو که روی کارت می‌کشونی، کارت واقعاً تو فضای سه‌بعدی دنبالش می‌چرخه و
   نورش هم دنبال انگشتت میاد — دقیقاً مثل یه کارتِ کلکسیونیِ فویلی. با delegation
   کار می‌کنه (pointerdown رو خودِ #tab-leaderboard) تا بعد از هر رفرشِ لیدربورد که
   DOM کارت‌ها کامل عوض می‌شه، دوباره لازم نباشه هیچی bind بشه. */
(function(){
  const scene = document.getElementById('tab-leaderboard');
  if(!scene) return;
  const TILT_MAX = {podium:16, row:8, strip:9};
  let activeCard = null, activeRect = null, activeMax = 8;
  function cardKind(card){
    if(card.classList.contains('lb-podium-item')) return 'podium';
    if(card.classList.contains('lb-strip-card')) return 'strip';
    return 'row';
  }
  function updateTilt(clientX, clientY){
    if(!activeCard || !activeRect || !activeRect.width || !activeRect.height) return;
    const x = (clientX - activeRect.left) / activeRect.width;
    const y = (clientY - activeRect.top) / activeRect.height;
    const cx = Math.min(1, Math.max(0, x));
    const cy = Math.min(1, Math.max(0, y));
    const ry = (cx - .5) * activeMax * 2;
    const rx = (.5 - cy) * activeMax * 2;
    activeCard.style.setProperty('--drag-ry', ry.toFixed(2) + 'deg');
    activeCard.style.setProperty('--drag-rx', rx.toFixed(2) + 'deg');
    activeCard.style.setProperty('--gx', (cx * 100).toFixed(1) + '%');
    activeCard.style.setProperty('--gy', (cy * 100).toFixed(1) + '%');
  }
  function onPointerDown(e){
    const target = e.target.closest('.lb-flip');
    if(!target || !scene.contains(target)) return;
    activeCard = target;
    activeRect = target.getBoundingClientRect();
    activeMax = TILT_MAX[cardKind(target)] || 8;
    target.classList.add('lb-tilting');
    updateTilt(e.clientX, e.clientY);
  }
  function onPointerMove(e){
    if(!activeCard) return;
    updateTilt(e.clientX, e.clientY);
  }
  function releaseTilt(){
    if(!activeCard) return;
    activeCard.classList.remove('lb-tilting');
    activeCard.style.setProperty('--drag-rx', '0deg');
    activeCard.style.setProperty('--drag-ry', '0deg');
    activeCard = null; activeRect = null;
  }
  scene.addEventListener('pointerdown', onPointerDown, {passive:true});
  window.addEventListener('pointermove', onPointerMove, {passive:true});
  window.addEventListener('pointerup', releaseTilt, {passive:true});
  window.addEventListener('pointercancel', releaseTilt, {passive:true});
})();

/* ================= Profile tab (پروفایل) =================
   Pulls together: (1) account info from Supabase Auth + `profiles`,
   (2) local progress stats also shown in "پیشرفت"/چک‌لیست, and
   (3) this user's live rank among `profiles` rows — the same table
   the leaderboard reads from.
   Needs one extra column vs. the leaderboard's existing set:
     alter table profiles add column if not exists username_updated_at timestamptz;
   Display-name changes are throttled client-side against this column
   (14-day cooldown) to keep chat/leaderboard identities stable and
   discourage impersonation; enforcing it again with a DB trigger/RLS
   check is recommended before this ships publicly. */
const DISPLAYNAME_COOLDOWN_DAYS = 14;
async function fetchMyLeaderboardRank(){
  if(!sb || !publicChatUser) return null;
  try{
    const myDay = liveElapsedDays();
    const { count: betterCount } = await sb.from('profiles').select('id', { count:'exact', head:true }).gt('day_count', myDay).gte('last_active_at', lbActiveSinceIso());
    return (betterCount||0) + 1;
  }catch(err){ return null; }
}
function profileDisplayNameCooldownInfo(){
  const lastChange = myProfileCache && myProfileCache.username_updated_at;
  if(!lastChange) return { locked:false, daysLeft:0 };
  const elapsedDays = (Date.now() - new Date(lastChange).getTime()) / 86400000;
  const daysLeft = Math.ceil(DISPLAYNAME_COOLDOWN_DAYS - elapsedDays);
  return { locked: daysLeft > 0, daysLeft: Math.max(0, daysLeft) };
}
async function renderProfileTab(){
  if(!document.getElementById('tab-profile')) return;
  const heroName = document.getElementById('profileHeroName');
  const heroSub = document.getElementById('profileHeroSub');
  const heroAvatar = document.getElementById('profileHeroAvatar');
  const heroBadge = document.getElementById('profileHeroBadge');
  const accountInfo = document.getElementById('profileAccountInfo');
  const statsGrid = document.getElementById('profileStatsGrid');
  const referralInfo = document.getElementById('profileReferralInfo');
  const nameInput = document.getElementById('profileDisplayNameInput');
  const nameHint = document.getElementById('profileDisplayNameHint');
  const nameSaveBtn = document.getElementById('profileDisplayNameSaveBtn');

  if(!publicChatUser){
    heroName.textContent = 'وارد نشدی';
    heroSub.textContent = '';
    heroAvatar.textContent = '؟';
    heroBadge.style.display = 'none';
    accountInfo.innerHTML = '<div class="profile-info-row"><span class="pi-label">برای دیدن پروفایل، اول از تب «چت عمومی» وارد اکانتت شو یا یه حساب رایگان بساز.</span></div>';
    statsGrid.innerHTML = '';
    referralInfo.innerHTML = '';
    if(nameInput) nameInput.disabled = true;
    if(nameSaveBtn) nameSaveBtn.disabled = true;
    if(nameHint) nameHint.textContent = '';
    return;
  }

  const name = publicChatUsername || 'کاربر';
  heroName.textContent = name + (isAppOwner ? ' 👑' : '');
  heroAvatar.innerHTML = lbAvatarInnerHtml(myProfileCache, name);
  heroAvatar.style.background = (myProfileCache && myProfileCache.avatar_url) ? 'transparent' : lbColorFor(publicChatUser.id);
  const isPremiumNow = !!(myProfileCache && myProfileCache.premium_until && new Date(myProfileCache.premium_until) > new Date());
  heroSub.textContent = isPremiumNow ? 'عضو پرمیوم' : 'عضو رایگان';
  if(isPremiumNow){ heroBadge.style.display = 'inline-flex'; heroBadge.textContent = '🌟 پرمیوم'; }
  else heroBadge.style.display = 'none';

  const joinedDate = publicChatUser.created_at ? new Date(publicChatUser.created_at).toLocaleDateString('fa-IR') : '—';
  accountInfo.innerHTML = `
    <div class="profile-info-row"><span class="pi-label">ایمیل</span><span class="pi-value">${escapeHtml(publicChatUser.email||'—')}</span></div>
    <div class="profile-info-row"><span class="pi-label">عضو از</span><span class="pi-value">${joinedDate}</span></div>
    <div class="profile-info-row"><span class="pi-label">نوع اکانت</span><span class="pi-value">${isPremiumNow ? '🌟 پرمیوم' : 'رایگان'}</span></div>
  `;

  const currentStreak = (typeof computeStreak==='function') ? computeStreak() : 0;
  const bestStreak = storeData.maxStreak || 0;
  const day = liveElapsedDays();
  statsGrid.innerHTML = `
    <div class="profile-stat-card"><div class="profile-stat-num">${toFa(currentStreak)}</div><div class="profile-stat-label">استریک فعلی (روز)</div></div>
    <div class="profile-stat-card"><div class="profile-stat-num">${toFa(bestStreak)}</div><div class="profile-stat-label">بهترین رکورد (روز)</div></div>
    <div class="profile-stat-card"><div class="profile-stat-num">${day>0?toFa(day):'—'}</div><div class="profile-stat-label">روز برنامه</div></div>
    <div class="profile-stat-card"><div class="profile-stat-num" id="profileRankNum">…</div><div class="profile-stat-label">رتبه در رتبه‌بندی</div></div>
  `;
  fetchMyLeaderboardRank().then(rank=>{
    const el = document.getElementById('profileRankNum');
    if(el) el.textContent = rank ? ('#'+toFa(rank)) : '—';
  });

  const refCount = (myProfileCache && myProfileCache.referral_count) || 0;
  const refCode = (myProfileCache && myProfileCache.referral_code) || '—';
  const discount = (myProfileCache && myProfileCache.discount_percent) || 0;
  referralInfo.innerHTML = `
    <div class="profile-info-row"><span class="pi-label">کد دعوت من</span><span class="pi-value" style="font-family:monospace;">${escapeHtml(refCode)}</span></div>
    <div class="profile-info-row"><span class="pi-label">تعداد دعوت‌شده‌ها</span><span class="pi-value">${toFa(refCount)}</span></div>
    <div class="profile-info-row"><span class="pi-label">تخفیف فعال</span><span class="pi-value">${discount ? toFa(discount)+'٪' : '—'}</span></div>
  `;

  if(nameInput){ nameInput.disabled = false; nameInput.value = ''; nameInput.placeholder = name; }
  const cooldown = profileDisplayNameCooldownInfo();
  if(nameSaveBtn) nameSaveBtn.disabled = cooldown.locked;
  if(nameHint){
    nameHint.classList.toggle('locked', cooldown.locked);
    nameHint.textContent = cooldown.locked
      ? `تا تعویض بعدی ${toFa(cooldown.daysLeft)} روز مونده.`
      : 'می‌تونی الان اسمتو عوض کنی — بعدش تا ۱۴ روز قفل می‌شه.';
  }
}
async function saveProfileDisplayName(){
  if(!sb || !publicChatUser) return;
  const cooldown = profileDisplayNameCooldownInfo();
  if(cooldown.locked){ showToast(`تا تعویض بعدی ${toFa(cooldown.daysLeft)} روز مونده`, 'error'); return; }
  const input = document.getElementById('profileDisplayNameInput');
  const newName = (input.value||'').trim();
  if(newName.length < 3){ showToast('نام نمایشی باید حداقل ۳ حرف باشه', 'error'); return; }
  if(newName.length > 20){ showToast('نام نمایشی حداکثر ۲۰ حرف می‌تونه باشه', 'error'); return; }
  const btn = document.getElementById('profileDisplayNameSaveBtn');
  btn.disabled = true; btn.textContent = 'در حال ذخیره...';
  try{
    const nowIso = new Date().toISOString();
    const { error } = await sb.from('profiles').update({ username: newName, username_updated_at: nowIso }).eq('id', publicChatUser.id);
    if(error){
      showToast(error.code === '23505' ? 'این نام قبلاً گرفته شده' : 'ذخیره نشد، دوباره امتحان کن', 'error');
      return;
    }
    publicChatUsername = newName;
    if(myProfileCache) { myProfileCache.username = newName; myProfileCache.username_updated_at = nowIso; }
    const chatLabel = document.getElementById('chatUsernameLabel');
    if(chatLabel) chatLabel.innerHTML = escapeHtml(newName) + (isAppOwner ? ' '+ci('crown') : '');
    showToast('نام نمایشی عوض شد ✅', 'success');
    renderProfileTab();
  }catch(err){
    showToast('ذخیره نشد، دوباره امتحان کن', 'error');
  }finally{
    btn.disabled = false; btn.textContent = 'ذخیره‌ی نام جدید';
  }
}
const profileDisplayNameSaveBtnEl = document.getElementById('profileDisplayNameSaveBtn');
if(profileDisplayNameSaveBtnEl) profileDisplayNameSaveBtnEl.addEventListener('click', saveProfileDisplayName);

/* ==================== Profile photo: pick → downscale/compress client-side
   → upload to the public "avatars" Storage bucket → save the URL on the profile.
   Kept deliberately small (max ۲۵۶px, JPEG ~۷۰٪ کیفیت) so it stays "کم‌حجم" both
   for the user's mobile data and for the leaderboard/list queries that load it. ==================== */
const AVATAR_MAX_DIM = 256;
const AVATAR_JPEG_QUALITY = 0.72;
function compressAvatarFile(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        let w = img.width, h = img.height;
        const scale = Math.min(1, AVATAR_MAX_DIM / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob=> blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/jpeg', AVATAR_JPEG_QUALITY);
      };
      img.onerror = ()=> reject(new Error('invalid image'));
      img.src = reader.result;
    };
    reader.onerror = ()=> reject(new Error('file read failed'));
    reader.readAsDataURL(file);
  });
}
async function uploadMyAvatar(file){
  if(!sb || !publicChatUser) return;
  if(!file.type || !file.type.startsWith('image/')){ showToast('فقط فایل تصویر مجازه', 'error'); return; }
  const btn = document.getElementById('profileAvatarEditBtn');
  if(btn) btn.disabled = true;
  try{
    const blob = await compressAvatarFile(file);
    const path = publicChatUser.id + '/avatar.jpg';
    const { error: upErr } = await sb.storage.from('avatars').upload(path, blob, { upsert:true, contentType:'image/jpeg', cacheControl:'3600' });
    if(upErr) throw upErr;
    const { data: pub } = sb.storage.from('avatars').getPublicUrl(path);
    // cache-bust so the new photo shows immediately instead of a cached old one at the same URL
    const url = pub.publicUrl + '?v=' + Date.now();
    const { error: updErr } = await sb.from('profiles').update({ avatar_url: url }).eq('id', publicChatUser.id);
    if(updErr) throw updErr;
    if(myProfileCache) myProfileCache.avatar_url = url;
    renderProfileTab();
    showToast('عکس پروفایل عوض شد ✅', 'success');
  }catch(err){
    console.error('Avatar upload failed', err);
    showToast('آپلود عکس ناموفق بود، دوباره امتحان کن', 'error');
  }finally{
    if(btn) btn.disabled = false;
  }
}
const profileAvatarEditBtnEl = document.getElementById('profileAvatarEditBtn');
const profileAvatarInputEl = document.getElementById('profileAvatarInput');
if(profileAvatarEditBtnEl && profileAvatarInputEl){
  profileAvatarEditBtnEl.addEventListener('click', ()=>{
    if(!publicChatUser){ showToast('اول باید وارد اکانتت بشی', 'error'); return; }
    profileAvatarInputEl.click();
  });
  profileAvatarInputEl.addEventListener('change', (e)=>{
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if(file) uploadMyAvatar(file);
  });
}

/* ---- "رمزم رو به خاطر بسپار" — client-side only. When checked on signup, the email+
   password get saved on THIS device so the login form can fill itself in next time instead
   of the user retyping it. This is not real encryption, just a reversible encoding so the
   password isn't sitting in localStorage as plain readable text — anyone with access to
   this device/browser can still recover it, so this only ever runs when the user explicitly
   ticks the box, and login/logout never touches it unless the box is used again. ---- */
const REMEMBER_AUTH_KEY = 'checklistApp:rememberedAuth';
function saveRememberedAuth(email, password){
  try{
    localStorage.setItem(REMEMBER_AUTH_KEY, JSON.stringify({
      e: btoa(unescape(encodeURIComponent(email))),
      p: btoa(unescape(encodeURIComponent(password)))
    }));
  }catch(e){}
}
function loadRememberedAuth(){
  try{
    const raw = localStorage.getItem(REMEMBER_AUTH_KEY);
    if(!raw) return null;
    const obj = JSON.parse(raw);
    return {
      email: decodeURIComponent(escape(atob(obj.e))),
      password: decodeURIComponent(escape(atob(obj.p)))
    };
  }catch(e){ return null; }
}
function clearRememberedAuth(){
  try{ localStorage.removeItem(REMEMBER_AUTH_KEY); }catch(e){}
}
/* Fills whichever login form(s) are currently in the DOM, but never overwrites something
   the user already started typing. Safe to call repeatedly (tab switches, init, etc). */
function applyRememberedAuthToLoginForms(){
  const creds = loadRememberedAuth();
  if(!creds) return;
  const chatEmailEl = document.getElementById('loginEmail');
  const chatPassEl = document.getElementById('loginPassword');
  if(chatEmailEl && !chatEmailEl.value) chatEmailEl.value = creds.email;
  if(chatPassEl && !chatPassEl.value) chatPassEl.value = creds.password;
  const gateEmailEl = document.getElementById('gateLoginEmail');
  const gatePassEl = document.getElementById('gateLoginPassword');
  if(gateEmailEl && !gateEmailEl.value) gateEmailEl.value = creds.email;
  if(gatePassEl && !gatePassEl.value) gatePassEl.value = creds.password;
}
/* Shared login/signup logic — used by both the in-app "اکانت" tab and the mandatory
   account-creation gate shown before onboarding. Returns true on success so callers
   can decide what happens next (e.g. the gate advancing to onboarding). */
async function performLogin(email, password){
  if(!sb) return false;
  if(!email || !password){ showToast('ایمیل و رمز رو وارد کن', 'error'); return false; }
  try{
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if(error){ showToast(error.message, 'error'); return false; }
    showToast('خوش اومدی 👋', 'success');
    return true;
  }catch(err){ showToast('مشکل در اتصال به سرور', 'error'); return false; }
}
async function performSignup(username, email, password, referralInput){
  if(!sb) return false;
  if(!username || !email || !password){ showToast('همه‌ی فیلدها لازمه', 'error'); return false; }
  if(password.length < 6){ showToast('رمز باید حداقل ۶ کاراکتر باشه', 'error'); return false; }
  try{
    const { data, error } = await sb.auth.signUp({ email, password });
    if(error){ showToast(error.message, 'error'); return false; }
    if(data.user){
      const myReferralCode = genReferralCode();
      const myGender = (storeData.profile && storeData.profile.gender) || null;
      const { error: profErr } = await sb.from('profiles').insert({ id: data.user.id, username, referral_code: myReferralCode, gender: myGender });
      if(profErr){ showToast('این یوزرنیم قبلاً گرفته شده', 'error'); return false; }
      // Set the display name directly here instead of waiting for a re-fetch,
      // because the SIGNED_IN auth event can fire (and read profiles) before
      // this insert finishes, causing it to fall back to the user's email.
      publicChatUsername = username;
      const label = document.getElementById('chatUsernameLabel');
      if(label) label.textContent = username;
      if(referralInput){
        await applyReferralBonus(referralInput, data.user.id);
        showToast('ثبت‌نام شد و ۷ روز پرمیوم گرفتی! 🎁', 'success');
      } else {
        showToast('ثبت‌نام شد! اگه تأیید ایمیل فعال باشه، ایمیلتو چک کن.', 'success');
      }
      return true;
    }
    return false;
  }catch(err){ showToast('مشکل در اتصال به سرور', 'error'); return false; }
}
document.getElementById('chatTabLogin').addEventListener('click', ()=> showAuthForm('login'));
document.getElementById('chatTabSignup').addEventListener('click', ()=> showAuthForm('signup'));
document.getElementById('loginBtn').addEventListener('click', async ()=>{
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  await performLogin(email, password);
});
document.getElementById('signupBtn').addEventListener('click', async ()=>{
  const username = document.getElementById('signupUsername').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const referralInput = document.getElementById('signupReferralInput').value.trim();
  const remember = document.getElementById('signupRemember').checked;
  const ok = await performSignup(username, email, password, referralInput);
  if(ok && remember) saveRememberedAuth(email, password);
});
document.getElementById('forgotPasswordLink').addEventListener('click', ()=> showAuthForm('forgot'));

/* ---- Legacy mandatory account-creation gate — دیگه هیچ‌جا به‌صورت خودکار نشون داده
   نمی‌شه (بوت اپ دیگه صداش نمی‌زنه)؛ نگه داشته شده فقط برای این‌که چیزی نشکنه، ولی
   کاربر عملاً بهش نمی‌رسه. مسیر واقعیِ ساخت حساب الان از داخل بخش عمومی
   (چت/لیدربورد/هم‌مسیر/پروفایل) و showAuthGate() اتفاق می‌افته. ---- */
function showGateForm(which){
  document.getElementById('gateTabLogin').classList.toggle('active', which==='login');
  document.getElementById('gateTabSignup').classList.toggle('active', which==='signup');
  document.getElementById('gateLoginForm').style.display = which==='login' ? 'flex' : 'none';
  document.getElementById('gateSignupForm').style.display = which==='signup' ? 'flex' : 'none';
  document.getElementById('obErrAccount').style.display = 'none';
  if(which === 'login') applyRememberedAuthToLoginForms();
}
function advanceFromAccountGate(){
  storeData.profile.accountCreated = true;
  saveData();
  document.getElementById('accountCreateOverlay').classList.remove('show');
  document.getElementById('onboardOverlay').classList.add('show');
  setJourneyStep(2);
  openOnboarding(false);
}
document.getElementById('gateTabLogin').addEventListener('click', ()=> showGateForm('login'));
document.getElementById('gateTabSignup').addEventListener('click', ()=> showGateForm('signup'));
document.getElementById('gateLoginBtn').addEventListener('click', async ()=>{
  const email = document.getElementById('gateLoginEmail').value.trim();
  const password = document.getElementById('gateLoginPassword').value;
  const ok = await performLogin(email, password);
  if(ok) advanceFromAccountGate(); else { const e=document.getElementById('obErrAccount'); e.textContent='ایمیل و رمز رو درست وارد کن.'; e.style.display='block'; }
});
document.getElementById('gateSignupBtn').addEventListener('click', async ()=>{
  const username = document.getElementById('gateSignupUsername').value.trim();
  const email = document.getElementById('gateSignupEmail').value.trim();
  const password = document.getElementById('gateSignupPassword').value;
  const referralInput = document.getElementById('gateSignupReferralInput').value.trim();
  const remember = document.getElementById('gateSignupRemember').checked;
  const ok = await performSignup(username, email, password, referralInput);
  if(ok){ if(remember) saveRememberedAuth(email, password); advanceFromAccountGate(); }
  else { const e=document.getElementById('obErrAccount'); e.textContent='لطفاً فیلدها رو کامل و درست پر کن.'; e.style.display='block'; }
});
document.getElementById('backToLoginLink').addEventListener('click', ()=> showAuthForm('login'));
document.getElementById('backToLoginFromCodeLink').addEventListener('click', ()=> showAuthForm('login'));
let pendingResetEmail = '';
document.getElementById('sendResetBtn').addEventListener('click', async ()=>{
  if(!sb) return;
  const email = document.getElementById('forgotEmail').value.trim();
  if(!email){ showToast('ایمیلتو وارد کن', 'error'); return; }
  const btn = document.getElementById('sendResetBtn');
  btn.disabled = true; btn.textContent = 'در حال ارسال...';
  try{
    const { error } = await sb.auth.resetPasswordForEmail(email);
    if(error){ showToast(error.message, 'error'); }
    else{
      pendingResetEmail = email;
      showToast('یه کد ۶ رقمی به ایمیلت ارسال شد 📩', 'success');
      showAuthForm('resetCode');
    }
  }catch(err){ showToast('مشکل در اتصال به سرور', 'error'); }
  finally{ btn.disabled = false; btn.textContent = 'ارسال کد بازیابی'; }
});
document.getElementById('confirmResetCodeBtn').addEventListener('click', async ()=>{
  if(!sb) return;
  const code = document.getElementById('resetCodeInput').value.trim();
  const newPassword = document.getElementById('newPasswordInput').value;
  if(!newPassword || newPassword.length < 6){ showToast('رمز باید حداقل ۶ کاراکتر باشه', 'error'); return; }
  const btn = document.getElementById('confirmResetCodeBtn');
  btn.disabled = true; btn.textContent = 'در حال بررسی...';
  try{
    // If a recovery session already exists (e.g. someone opened this as a
    // website and clicked the email link), skip straight to setting the
    // password. Otherwise verify the 6-digit code they typed in.
    const { data: sessData } = await sb.auth.getSession();
    if(!sessData.session){
      if(!code){ showToast('کدی که برات ایمیل شده رو وارد کن', 'error'); btn.disabled = false; btn.textContent = 'ثبت رمز جدید'; return; }
      const { error: verifyErr } = await sb.auth.verifyOtp({ email: pendingResetEmail, token: code, type: 'recovery' });
      if(verifyErr){ showToast(verifyErr.message, 'error'); return; }
    }
    const { error: updErr } = await sb.auth.updateUser({ password: newPassword });
    if(updErr){ showToast(updErr.message, 'error'); return; }
    document.getElementById('resetCodeInput').value = '';
    document.getElementById('newPasswordInput').value = '';
    showToast('رمزت با موفقیت عوض شد 🎉', 'success');
    const { data } = await sb.auth.getSession();
    handlePublicChatSession(data.session);
  }catch(err){ showToast('مشکل در اتصال به سرور', 'error'); }
  finally{ btn.disabled = false; btn.textContent = 'ثبت رمز جدید'; }
});
document.getElementById('logoutBtn').addEventListener('click', async ()=>{
  if(!sb) return;
  if(!confirm('مطمئنی می‌خوای از حسابت خارج بشی؟ باید دوباره وارد بشی.')) return;
  await sb.auth.signOut();
  showToast('خارج شدی');
});
const reportedMsgIds = new Set();
// Same "marker prefix embedded in content" trick used by TASK_REPORT_MARKER/GROUP_STREAK_MARKER —
// keeps replies working without needing a new column on the messages table.
const REPLY_MARKER = '⟦REPLY⟧';
function parseReplyMsg(content){
  const rest = content.slice(REPLY_MARKER.length);
  const i1 = rest.indexOf('|'); if(i1 === -1) return null;
  const i2 = rest.indexOf('|', i1+1); if(i2 === -1) return null;
  const i3 = rest.indexOf('|', i2+1); if(i3 === -1) return null;
  return {
    replyId: rest.slice(0, i1),
    replyUsername: decodeURIComponent(rest.slice(i1+1, i2)),
    replyText: decodeURIComponent(rest.slice(i2+1, i3)),
    text: rest.slice(i3+1)
  };
}
function chatStreakChipHtml(m){
  // m.streak comes from the "streak" column on the messages row (the sender's
  // day-streak at the moment they sent it). Older rows / not-yet-migrated
  // tables won't have it, so we just skip the chip rather than show "0".
  // Free-user day counts are intentionally hidden in chat — only rows sent while
  // premium carry premium:true (denormalized at send-time), so non-premium
  // senders never show the chip.
  const s = Number(m.streak);
  if(!s || s <= 0 || !m.premium) return '';
  return `<span class="cm-streak-chip" title="${toFa(s)} روز پشت‌سرهم">
    <span class="cm-streak-flame">${ci('fire')}</span>${toFa(s)}</span>`;
}
// Circular avatar for the Telegram-style floating avatar beside a bubble. Uses the
// sender's real profile photo (profiles.avatar_url) when we already have it cached
// (see chatAvatarUrlCache/loadChatAvatarUrlsFor); otherwise falls back to a deterministic
// initial + hue derived from the display name — purely decorative, never leaks anything
// beyond what's already shown as the sender name. data-avatar-owner lets a later async
// avatar-url fetch upgrade this element in place once it resolves.
function chatAvatarHtml(name, userId){
  const n = displayName(name) || 'کاربر';
  const url = userId != null ? chatAvatarUrlCache[userId] : null;
  if(url){
    return `<span class="cm-avatar cm-avatar-img" data-avatar-owner="${escapeHtml(String(userId))}"><img src="${escapeHtml(url)}" alt="" loading="lazy"></span>`;
  }
  const ch = escapeHtml(n.trim().slice(0,1) || '؟');
  let hash = 0;
  for(let i=0;i<n.length;i++){ hash = (hash*31 + n.charCodeAt(i)) >>> 0; }
  const hue = hash % 360;
  return `<span class="cm-avatar" data-avatar-owner="${escapeHtml(String(userId||''))}" style="background:linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue+40)%360} 65% 45%))">${ch}</span>`;
}
// Cache of sender_id -> avatar_url|null for the public chat's floating avatars, fetched in
// batches (like reactions) so the first paint isn't blocked on a profiles round-trip; anyone
// not yet in this cache just renders the initials fallback above until it resolves.
let chatAvatarUrlCache = {};
async function loadChatAvatarUrlsFor(userIds){
  if(!sb || !userIds || !userIds.length) return;
  const missing = [...new Set(userIds)].filter(id => id && !(id in chatAvatarUrlCache));
  if(!missing.length) return;
  try{
    const { data, error } = await sb.from('profiles').select('id,avatar_url').in('id', missing);
    if(error) return;
    (data||[]).forEach(p=> chatAvatarUrlCache[p.id] = p.avatar_url || null);
    missing.forEach(id=>{ if(!(id in chatAvatarUrlCache)) chatAvatarUrlCache[id] = null; });
  }catch(err){ console.error('Load chat avatar urls failed', err); }
}
// Upgrades any already-rendered avatar bubbles for this sender from the initials fallback
// to their real photo, once loadChatAvatarUrlsFor resolves for them.
function updateChatAvatarUI(userId){
  const url = chatAvatarUrlCache[userId];
  if(!url) return;
  document.querySelectorAll(`#chatMessages .cm-avatar[data-avatar-owner="${userId}"]`).forEach(el=>{
    if(el.querySelector('img')) return;
    el.classList.add('cm-avatar-img');
    el.style.background = '';
    el.innerHTML = `<img src="${escapeHtml(url)}" alt="" loading="lazy">`;
  });
}
// Turns the plain-text daily report (✅/⭕ lines + a "پیشرفت: X٪ (Y از Z)" line) into a
// compact card body: checklist rows + an animated progress bar. Counts done/total itself
// from the ✅/⭕ markers so it always matches what's shown, regardless of locale digits.
function formatReportBody(raw){
  const lines = String(raw==null?'':raw).split('\n');
  let rowsHtml = '';
  let doneCount = 0, totalCount = 0;
  const metaLines = [];
  lines.forEach(line=>{
    const t = line.trim();
    if(!t || t.startsWith('📋') || t.startsWith('📊') || /^—+$/.test(t)) return;
    if(t.startsWith('✅') || t.startsWith('⭕')){
      const done = t.startsWith('✅');
      if(done) doneCount++;
      totalCount++;
      rowsHtml += `<div class="cm-report-row ${done?'done':'pending'}"><span class="cm-report-check">${done?'✓':''}</span><span class="cm-report-label">${escapeHtml(t.slice(1).trim())}</span></div>`;
      return;
    }
    metaLines.push(t);
  });
  const pct = totalCount ? Math.round((doneCount/totalCount)*100) : 0;
  const metaHtml = metaLines.length ? `<div class="cm-report-meta">${metaLines.map(l=>escapeHtml(l)).join('<br>')}</div>` : '';
  return `<div class="cm-report-rows">${rowsHtml}</div>${metaHtml}<div class="cm-report-pct-row"><span>پیشرفت</span><span>${toFa(pct)}٪ (${toFa(doneCount)} از ${toFa(totalCount)})</span></div><div class="cm-progress"><div class="cm-progress-fill" data-target="${pct}"></div></div>`;
}
// ---- چت عمومی: SVG line-icon set replacing platform emoji everywhere in this screen
// (header, buttons, badges, report tags) — same 24x24/currentColor-stroke style as the
// private tab-bar icons. ci(name) returns a ready-to-insert <span class="ci">…</span>;
// used both here in JS-built strings and copy-pasted into the static HTML template.
const CHAT_ICONS = {
  person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.3" r="3.6"/><path d="M4.7 19.5c1.3-3.4 4-5.1 7.3-5.1s6 1.7 7.3 5.1"/></svg>',
  bubble: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="11.5" rx="4"/><path d="M8.3 16.5l-1.6 3.3 4.4-3.3"/></svg>',
  scroll: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4.5h9.5a2 2 0 0 1 2 2V18a2 2 0 0 0 2 2H8a2 2 0 0 1-2-2V4.5z"/><path d="M6 4.5a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2"/><path d="M9 9h6M9 12.5h6"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l7 2.6v5.4c0 4.6-3 7.8-7 9-4-1.2-7-4.4-7-9V6.1l7-2.6z"/><path d="M9 12l2 2 4-4.2"/></svg>',
  power: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v7.5"/><path d="M7 6.2a7.3 7.3 0 1 0 10 0"/></svg>',
  clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5" width="13" height="16" rx="2.3"/><rect x="9" y="3" width="6" height="3.4" rx="1.2"/><path d="M8.5 11.5h7M8.5 15h7M8.5 18h4.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21M9 21h6"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14"/><path d="M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2"/><path d="M6.5 7l1 12.2A2 2 0 0 0 9.5 21h5a2 2 0 0 0 2-1.8L17.5 7"/><path d="M10 11v6M14 11v6"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12L19.5 4.5 13 19.5l-2-6.4-6.5-1.1z"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2.3"/><circle cx="8.3" cy="9.3" r="1.6"/><path d="M4 16.5l5-4.7 3.5 3 3-3.3 4.5 4.9"/></svg>',
  film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5l1.3-4.2a1.6 1.6 0 0 1 2-1.1l11 3.3-4 1.3z"/><rect x="3.5" y="9.5" width="17" height="10.5" rx="2"/><path d="M9 9.5L11 5M14 9.5L16 5"/></svg>',
  block: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3.5h8L20.5 8v8L16 20.5H8L3.5 16V8z"/><path d="M8 8l8 8"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4.5h10v4.3a5 5 0 0 1-10 0V4.5z"/><path d="M7 6H4.5v1.8A3 3 0 0 0 7 10.7M17 6h2.5v1.8A3 3 0 0 1 17 10.7"/><path d="M12 13.8V17M9 20.5h6M9.5 17h5l.6 3.5h-6.2z"/></svg>',
  handshake: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 10.5l4-2.8 4.3 3.2"/><path d="M21.5 10.5l-4-2.8-4.3 3.2"/><path d="M10.8 10.9l-3.6 3.2a1.5 1.5 0 0 0 2 2.2l.6-.5"/><path d="M13.2 10.9l3.6 3.2a1.5 1.5 0 0 1-2 2.2l-.6-.5"/><path d="M9.6 15.4l1 .9a1.6 1.6 0 0 0 2.2 0"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.3"/><path d="M3.7 12h16.6M12 3.7c2.6 2.2 4 5.1 4 8.3s-1.4 6.1-4 8.3c-2.6-2.2-4-5.1-4-8.3s1.4-6.1 4-8.3z"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.5L12 4l8 7.5"/><path d="M6 10v9.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V10"/><path d="M10 20.5v-5.3h4v5.3"/></svg>',
  fire: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5c.5 3-2.3 4-2.3 7a2.3 2.3 0 0 0 2.3 2.3 2 2 0 0 0 2-2.3c1.6 1.1 2.5 2.8 2.5 4.7a4.5 4.5 0 0 1-9 0c0-4 3.5-5.5 4.5-11.7z"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2.8l2.7 5.9 6.3.7-4.7 4.4 1.3 6.4-5.6-3.3-5.6 3.3 1.3-6.4-4.7-4.4 6.3-.7z"/></svg>',
  crown: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M4 8.5l3.3 2.6L12 5l4.7 6.1 3.3-2.6-1.4 8.9a1 1 0 0 1-1 .85H6.4a1 1 0 0 1-1-.85z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5.5" width="16" height="14.5" rx="2.3"/><path d="M8 3.5v4M16 3.5v4M4 10h16"/><path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 16.7h.01M12 16.7h.01"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="8.5" y="8.5" width="11" height="12" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9.5a2 2 0 0 0 2 2h2.5"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="10.5" width="13" height="9.5" rx="2.3"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.8" cy="10.8" r="6.3"/><path d="M20 20l-4.3-4.3"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l.9-4.2L15.5 5.2a1.8 1.8 0 0 1 2.5 0l.8.8a1.8 1.8 0 0 1 0 2.5L8.2 19.1z"/><path d="M14 7.2l2.8 2.8"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4.5h6l.7 4.8 3 2v2H5.3v-2l3-2z"/><path d="M12 13.3V20"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 9v3.5a3 3 0 0 0 5.1 2.1"/><path d="M13.5 4.3A3 3 0 0 1 15 7v3.2"/><path d="M4 4l16 16"/><path d="M5.5 11a6.5 6.5 0 0 0 9.4 5.8"/><path d="M12 17.5V21M9 21h6"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5v17"/><path d="M6 4.5h10l-2.3 3.3 2.3 3.2H6"/></svg>',
  hourglass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5h11M6.5 20.5h11"/><path d="M7.5 3.5v3.3a4.5 4.5 0 0 0 2 3.7l1.5 1-1.5 1a4.5 4.5 0 0 0-2 3.7v3.3M16.5 3.5v3.3a4.5 4.5 0 0 1-2 3.7l-1.5 1 1.5 1a4.5 4.5 0 0 1 2 3.7v3.3"/></svg>'
};
function ci(name){ return `<span class="ci">${CHAT_ICONS[name] || ''}</span>`; }
// Shared content-parsing for a chat message row — used both for the initial render
// (publicChatMsgHtml) and to refresh a single bubble's text in place after an edit,
// without duplicating the marker/report/reply parsing logic in two places.
function chatMsgContentParts(m){
  // Bot check is by user_id, not by content marker — a regular user typing the marker text
  // can never match this fixed id, since Supabase Auth assigns ids and users can't choose theirs.
  const isBot = m.user_id === GROUP_BOT_USER_ID;
  const isGroupStreak = isBot && typeof m.content === 'string' && m.content.startsWith(GROUP_STREAK_MARKER);
  const isGroupWeekly = isBot && typeof m.content === 'string' && m.content.startsWith(GROUP_WEEKLY_MARKER);
  const isReport = !isBot && typeof m.content === 'string' && m.content.startsWith(TASK_REPORT_MARKER);
  let rawContent = m.content;
  let replyInfo = null;
  if(!isBot && !isReport && typeof rawContent === 'string' && rawContent.startsWith(REPLY_MARKER)){
    const parsed = parseReplyMsg(rawContent);
    if(parsed){ replyInfo = parsed; rawContent = parsed.text; }
  }
  if(isReport) rawContent = m.content.slice(TASK_REPORT_MARKER.length);
  else if(isGroupStreak) rawContent = parseMarkerMsg(m.content, GROUP_STREAK_MARKER).text;
  else if(isGroupWeekly) rawContent = parseMarkerMsg(m.content, GROUP_WEEKLY_MARKER).text;
  let reportTag = '';
  if(isReport) reportTag = `<div class="cm-report-tag">${ci('clipboard')} گزارش روزانه</div>`;
  else if(isGroupStreak) reportTag = `<div class="cm-report-tag">${ci('fire')} زنجیره‌ی جمعی گروه</div>`;
  else if(isGroupWeekly) reportTag = `<div class="cm-report-tag">${ci('calendar')} کارت هفتگی گروه</div>`;
  const textHtml = isReport ? formatReportBody(rawContent) : ((isGroupStreak||isGroupWeekly) ? escapeHtml(rawContent).replace(/\n/g, '<br>') : escapeHtml(rawContent));
  const replyQuoteHtml = replyInfo ? `<div class="cm-reply-quote" data-reply-target-id="${escapeHtml(replyInfo.replyId)}">
      <div class="crq-bar"></div>
      <div class="crq-body"><div class="crq-name">${escapeHtml(displayName(replyInfo.replyUsername))}</div><div class="crq-text">${escapeHtml(replyInfo.replyText)}</div></div>
    </div>` : '';
  // media_localUrl only exists on the optimistic temp bubble (a blob: URL for instant
  // preview before the upload finishes); media_path is the real, permanent DB value.
  const hasMedia = !!(m.media_localUrl || m.media_path);
  // Giphy-sourced GIFs store the CDN URL directly in media_path (no Storage upload needed,
  // since Giphy already hosts it permanently) — only resolve through chatMediaPublicUrl()
  // when it's a bucket-relative path, not an absolute URL.
  const mediaSrc = giphyProxyIfNeeded(m.media_localUrl || (m.media_path ? (/^https?:\/\//i.test(m.media_path) ? m.media_path : chatMediaPublicUrl(m.media_path)) : ''));
  const mediaExpiredJs = `this.parentElement.innerHTML='${ci('hourglass')} این مدیا منقضی شده'; this.parentElement.classList.add('cm-media-expired');`.replace(/"/g, '&quot;');
  // Save-to-favorites star: only on GIFs/silent-videos, and only once the real (permanent)
  // URL exists — saving the temporary blob: preview would point at a URL that stops working
  // the moment the upload finishes and the object URL gets revoked.
  const isGifLike = m.media_type === 'gif' || m.media_type === 'gifvideo';
  const saveBtnHtml = (isGifLike && m.media_path)
    ? `<button type="button" class="cm-gif-save-btn" data-save-url="${escapeHtml(mediaSrc)}" data-save-type="${escapeHtml(m.media_type)}" title="ذخیره در گیف‌های من">${ci('star')}</button>`
    : '';
  const mediaHtml = hasMedia
    ? (m.media_type === 'video'
        ? `<div class="cm-media"><video src="${escapeHtml(mediaSrc)}" controls playsinline preload="metadata" onerror="${mediaExpiredJs}"></video></div>`
        : m.media_type === 'gifvideo'
        ? `<div class="cm-media cm-gifvideo"><video src="${escapeHtml(mediaSrc)}" autoplay loop muted playsinline preload="auto" onerror="${mediaExpiredJs}"></video><span class="cm-gif-badge">GIF</span>${saveBtnHtml}</div>`
        : m.media_type === 'voice'
        ? `<div class="cm-voice-retired">${ci('hourglass')} پیام صوتی (این قابلیت دیگه در دسترس نیست)</div>`
        : `<div class="cm-media"><img src="${escapeHtml(mediaSrc)}" alt="${m.media_type==='gif'?'گیف':'تصویر'}" loading="lazy" onerror="${mediaExpiredJs}">${m.media_type==='gif'?saveBtnHtml:''}</div>`)
    : '';
  return { isBot, isGroupStreak, isGroupWeekly, isReport, replyInfo, rawContent, reportTag, textHtml, replyQuoteHtml, mediaHtml, hasMedia };
}
function publicChatMsgHtml(m, grouped){
  const own = publicChatUser && m.user_id === publicChatUser.id;
  const isOwnerMsg = !!m.is_owner; // computed server-side (DB trigger), not something the client can fake
  // Same idea for chat-admins: is_admin/admin_title are stamped onto the row at insert time
  // from the sender's profiles row (see chat-admin-supabase-schema.sql), not client-supplied.
  // Owner badge always wins if somehow both are set on the same row.
  const isAdminMsg = !isOwnerMsg && !!m.is_admin;
  const parts = chatMsgContentParts(m);
  const { isBot, isReport, isGroupStreak, isGroupWeekly, reportTag, textHtml, replyQuoteHtml, mediaHtml, hasMedia } = parts;
  const textBlockHtml = textHtml ? `<div class="cm-text">${textHtml}</div>` : '';
  const time = new Date(m.created_at).toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
  // Telegram-style frameless media: a message that's ONLY a photo/gif/video (no caption,
  // no reply-quote, not a bot/report/streak card) drops the bubble's padding/background/
  // border entirely so just the media's own rounded corners show — the time is overlaid
  // on the media itself instead of sitting in the padded row below it. Old voice messages
  // (retired feature) keep their normal pill bubble (they're not really "media" visually).
  const isMediaOnly = hasMedia && !textHtml && !replyQuoteHtml && !isBot && !isReport && !isGroupStreak && !isGroupWeekly && m.media_type !== 'voice';
  const mediaHtmlFinal = (isMediaOnly && mediaHtml.endsWith('</div>'))
    ? mediaHtml.slice(0, -'</div>'.length) + `<span class="cm-media-time">${time}</span></div>`
    : mediaHtml;
  // Delete/report/block/suspend used to live here as always-visible buttons on the bubble;
  // they now live in the long-press menu (see openChatMsgMenu) so the bubble itself stays
  // clean — same permission rules, just moved. Owner can still delete/moderate any message,
  // not just their own; that still only actually succeeds if the Supabase RLS policy for
  // this UID has been added — see SQL notes.
  // The name shows once per consecutive run (first message only). The avatar photo now lives
  // once per run in the .cm-group wrapper around this bubble (see chatGroupAvatarHtml /
  // renderPublicChatMessages / appendPublicChatMessage) — not repeated on every bubble.
  const roleBadge = isOwnerMsg
    ? ` <span class="cm-owner-badge" title="مالک اپ">${ci('crown')} مالک</span>`
    : (isAdminMsg ? ` <span class="cm-admin-badge" title="ادمین چت">${ci('shield')} ${escapeHtml(m.admin_title || 'ادمین')}</span>` : '');
  const head = (grouped || isBot) ? '' : `<div class="cm-head">${chatStreakChipHtml(m)}<div class="cm-name">${escapeHtml(displayName(m.username))}${roleBadge}</div></div>`;
  const extraClass = (isGroupStreak ? ' group-msg' : (isGroupWeekly ? ' group-msg group-weekly-msg' : (isReport ? ' report-msg' : ''))) + (isMediaOnly ? ' cm-media-only' : '');
  // data-raw keeps the exact, unparsed DB content (including any reply/report marker prefix)
  // so the edit/copy actions can work from the source text rather than the rendered HTML.
  return `<div class="chat-msg${own?' own':''}${(grouped&&!isBot)?' grouped':''}${isOwnerMsg?' owner-msg':(isAdminMsg?' admin-msg':'')}${extraClass}${reactionTierClass(m.id)}" data-msg-id="${m.id}" data-user-id="${m.user_id}" data-username="${escapeHtml(displayName(m.username))}" data-raw="${escapeHtml(typeof m.content==='string'?m.content:'')}"${isBot?' data-bot="1"':''}${isReport?' data-report="1"':''}>
    ${head}
    ${reportTag}
    ${replyQuoteHtml}
    ${mediaHtmlFinal}
    ${textBlockHtml}
    <div class="cm-reactions" data-reactions-for="${m.id}">${renderReactionPillsInner(m.id)}</div>
    <div class="cm-bottom-row">${isMediaOnly ? '' : `<span class="cm-time">${time}</span>`}</div>
  </div>`;
}
// True for a message that should ever get a Telegram-style grouped avatar: any real
// sender, including us — only the automated group-bot account is excluded.
function chatMsgHasAvatar(m){
  return m.user_id !== GROUP_BOT_USER_ID;
}
// One avatar per consecutive run of messages from the same sender — wraps around the
// whole run so it lines up with the bottom of the last bubble (see #tab-chat .cm-avatar).
function chatGroupAvatarHtml(m){
  return `<div class="cm-group-avatar">${chatAvatarHtml(m.username, m.user_id)}</div>`;
}
// Wraps a run of same-sender bubble HTML (already built via publicChatMsgHtml) in the
// avatar+messages group shell. Own runs get the .own modifier so the CSS mirrors the
// avatar to the right edge instead of the left.
function wrapChatGroupHtml(firstMsg, innerBubblesHtml){
  const isOwn = !!(publicChatUser && firstMsg.user_id === publicChatUser.id);
  return `<div class="cm-group${isOwn?' own':''}">${chatGroupAvatarHtml(firstMsg)}<div class="cm-group-messages">${innerBubblesHtml}</div></div>`;
}
/* ---------------- Message reactions (Telegram-style) ----------------
   One reaction per user per message, stored in `message_reactions`
   (message_id, user_id, emoji — unique on message_id+user_id, so re-tapping a
   different emoji just replaces the row and tapping your own again deletes it).
   A single tap on a bubble opens a small emoji row; tapping an existing pill
   re-reacts in one tap without opening anything. Needs the `message_reactions`
   table + RLS policies + REPLICA IDENTITY FULL — see message-reactions-
   supabase-schema.sql (run once in the Supabase SQL editor). */
const REACTION_EMOJIS = ['👍','👎','❤️','🥺','😁','🤣','💔','🗿','😨','😭'];
const REACTION_HOT_1 = 5;   // bubble widens slightly past this many total reactions
const REACTION_HOT_2 = 15;  // widens a bit more past this many
let chatReactionsCache = {}; // { [msgId]: { counts:{emoji:n}, total:n, userEmoji:emoji|null, userId_map:{userId:emoji} } }
let chatReactionsChannel = null;

function reactionTierClass(msgId){
  const info = chatReactionsCache[msgId];
  const total = info ? info.total : 0;
  if(total >= REACTION_HOT_2) return ' cm-hot-2';
  if(total >= REACTION_HOT_1) return ' cm-hot-1';
  return '';
}
function renderReactionPillsInner(msgId){
  const info = chatReactionsCache[msgId];
  if(!info || !info.total) return '';
  return REACTION_EMOJIS.filter(e => info.counts[e] > 0).map(e=>{
    const c = info.counts[e];
    const mine = info.userEmoji === e;
    return `<button type="button" class="cm-reaction-pill${mine?' mine':''}" data-emoji="${e}">${e}${c>1?`<span class="cm-reaction-count">${toFa(c)}</span>`:''}</button>`;
  }).join('');
}
function buildReactionsCache(rows){
  const cache = {};
  (rows||[]).forEach(r=>{
    const id = r.message_id;
    if(!cache[id]) cache[id] = { counts:{}, total:0, userEmoji:null, userId_map:{} };
    cache[id].counts[r.emoji] = (cache[id].counts[r.emoji]||0) + 1;
    cache[id].total++;
    cache[id].userId_map[r.user_id] = r.emoji;
    if(publicChatUser && r.user_id === publicChatUser.id) cache[id].userEmoji = r.emoji;
  });
  return cache;
}
async function loadChatReactionsForIds(ids){
  if(!sb || !ids || !ids.length) return [];
  try{
    const { data, error } = await sb.from('message_reactions').select('message_id,user_id,emoji').in('message_id', ids);
    if(error){ console.error('Load reactions failed', error); return []; }
    return data || [];
  }catch(err){ console.error('Load reactions failed', err); return []; }
}
function updateMessageReactionsUI(msgId){
  const el = document.querySelector(`.chat-msg[data-msg-id="${msgId}"]`);
  if(!el) return;
  const slot = el.querySelector('.cm-reactions');
  if(slot) slot.innerHTML = renderReactionPillsInner(msgId);
  el.classList.remove('cm-hot-1', 'cm-hot-2');
  const tier = reactionTierClass(msgId).trim();
  if(tier) el.classList.add(tier);
}
// Reconciles one user's reaction on one message from either a realtime event or an
// optimistic local tap — drops that user's previous emoji (if any) before applying
// the new one, so INSERT/UPDATE/DELETE (and a change of emoji) are all handled the
// same way without needing to diff against a stored "old" row.
function applyReactionEvent(row, isDelete){
  const id = row.message_id;
  if(!chatReactionsCache[id]) chatReactionsCache[id] = { counts:{}, total:0, userEmoji:null, userId_map:{} };
  const info = chatReactionsCache[id];
  const prevEmoji = info.userId_map[row.user_id];
  if(prevEmoji){
    info.counts[prevEmoji] = Math.max(0, (info.counts[prevEmoji]||0) - 1);
    info.total = Math.max(0, info.total - 1);
    delete info.userId_map[row.user_id];
  }
  if(!isDelete){
    info.userId_map[row.user_id] = row.emoji;
    info.counts[row.emoji] = (info.counts[row.emoji]||0) + 1;
    info.total++;
  }
  if(publicChatUser && row.user_id === publicChatUser.id) info.userEmoji = isDelete ? null : row.emoji;
  updateMessageReactionsUI(id);
}
function subscribeChatReactions(){
  if(chatReactionsChannel) return;
  chatReactionsChannel = sb.channel('public:message_reactions')
    .on('postgres_changes', {event:'INSERT', schema:'public', table:'message_reactions'}, payload=> applyReactionEvent(payload.new, false))
    .on('postgres_changes', {event:'UPDATE', schema:'public', table:'message_reactions'}, payload=> applyReactionEvent(payload.new, false))
    .on('postgres_changes', {event:'DELETE', schema:'public', table:'message_reactions'}, payload=> applyReactionEvent(payload.old, true))
    .subscribe();
}
async function setChatReaction(msgId, emoji){
  if(!sb || !publicChatUser) return;
  if(!requirePremium()) return;
  const current = chatReactionsCache[msgId] && chatReactionsCache[msgId].userEmoji;
  const removing = current === emoji;
  // Optimistic local update so the tap feels instant; the realtime event that
  // arrives afterward just re-confirms the same state.
  applyReactionEvent({ message_id: msgId, user_id: publicChatUser.id, emoji: removing ? current : emoji }, removing);
  try{
    if(removing){
      const { error } = await sb.from('message_reactions').delete().eq('message_id', msgId).eq('user_id', publicChatUser.id);
      if(error) throw error;
    } else {
      const { error } = await sb.from('message_reactions')
        .upsert({ message_id: msgId, user_id: publicChatUser.id, emoji }, { onConflict: 'message_id,user_id' });
      if(error) throw error;
    }
  }catch(err){
    console.error('reaction failed', err);
    showToast('ری‌اکشن ثبت نشد', 'error');
  }
}
/* ---- Reaction picker: small floating emoji row opened with a single tap on a bubble ---- */
let cmReactionBarTargetId = null;
function closeChatReactionBar(){
  const bar = document.getElementById('cmReactionBar');
  const backdrop = document.getElementById('cmReactionBarBackdrop');
  if(bar) bar.classList.remove('show');
  if(backdrop) backdrop.classList.remove('show');
  cmReactionBarTargetId = null;
}
function openChatReactionBar(el){
  if(!el || !publicChatUser) return;
  if(!requirePremium()) return;
  const bar = document.getElementById('cmReactionBar');
  const backdrop = document.getElementById('cmReactionBarBackdrop');
  if(!bar || !backdrop) return;
  const msgId = el.dataset.msgId;
  cmReactionBarTargetId = msgId;
  const myEmoji = chatReactionsCache[msgId] && chatReactionsCache[msgId].userEmoji;
  bar.innerHTML = REACTION_EMOJIS.map(e=>`<button type="button" class="${e===myEmoji?'mine':''}" data-emoji="${e}">${e}</button>`).join('');
  const rect = el.getBoundingClientRect();
  backdrop.classList.add('show');
  bar.classList.add('show');
  bar.style.top = '-9999px';
  bar.style.left = '10px';
  requestAnimationFrame(()=>{
    const barRect = bar.getBoundingClientRect();
    let left = rect.left + rect.width/2 - barRect.width/2;
    left = Math.max(10, Math.min(left, window.innerWidth - barRect.width - 10));
    let top = rect.top - barRect.height - 8;
    if(top < 8) top = Math.min(rect.bottom + 8, window.innerHeight - barRect.height - 8);
    bar.style.left = left + 'px';
    bar.style.top = top + 'px';
  });
}
const cmReactionBarEl = document.getElementById('cmReactionBar');
if(cmReactionBarEl) cmReactionBarEl.addEventListener('click', e=>{
  const btn = e.target.closest('button[data-emoji]');
  if(btn && cmReactionBarTargetId) setChatReaction(cmReactionBarTargetId, btn.dataset.emoji);
  closeChatReactionBar();
});
const cmReactionBarBackdropEl = document.getElementById('cmReactionBarBackdrop');
if(cmReactionBarBackdropEl){
  cmReactionBarBackdropEl.addEventListener('click', closeChatReactionBar);
  cmReactionBarBackdropEl.addEventListener('touchstart', closeChatReactionBar, {passive:true});
}
// Tapping an existing reaction pill re-reacts (or removes yours) in one tap, no picker needed.
document.getElementById('chatMessages').addEventListener('click', e=>{
  const pill = e.target.closest('.cm-reaction-pill');
  if(!pill) return;
  const msgEl = pill.closest('.chat-msg');
  if(!msgEl || !publicChatUser) return;
  setChatReaction(msgEl.dataset.msgId, pill.dataset.emoji);
});
// Honest, non-fabricated stand-in for "online users": counts distinct human senders
// in the currently loaded message window, shown as "active members" rather than a
// live presence claim we can't actually back up.
function updateChatPresenceIndicator(rows){
  const el = document.getElementById('chatOnlineText');
  if(!el) return;
  const ids = new Set((rows||[]).filter(m=>m.user_id!==GROUP_BOT_USER_ID).map(m=>m.user_id));
  el.textContent = ids.size > 0 ? ` · ${toFa(ids.size)} عضو فعال` : '';
}

/* ---------------- اعضای چت عمومی (صفحه‌ی شبیه تلگرام) ----------------
   "آنلاین" یعنی last_active_at تو LB_ONLINE_WINDOW_MIN دقیقه‌ی اخیر آپدیت شده —
   یه سیگنال واقعیه، نه حدسی: presenceHeartbeat() هر ~۴۵ ثانیه که تب باز و
   قابل‌دیدنه last_active_at رو تازه می‌کنه (همون ستونی که فیلتر ۷روزه‌ی لیگ هم
   ازش استفاده می‌کنه)، پس وقتی کسی اپ رو ببنده یا ببره پس‌زمینه، طبیعتاً بعد
   از چند دقیقه آفلاین دیده می‌شه. */
const LB_ONLINE_WINDOW_MIN = 2;
function isOnlineNow(lastActiveAt){
  if(!lastActiveAt) return false;
  return (Date.now() - new Date(lastActiveAt).getTime()) <= LB_ONLINE_WINDOW_MIN*60*1000;
}
function lbLastSeenLabel(lastActiveAt){
  if(!lastActiveAt) return 'آخرین بازدید مدت‌ها پیش';
  const min = Math.floor((Date.now() - new Date(lastActiveAt).getTime())/60000);
  if(min < 1) return 'همین الان';
  if(min < 60) return 'آخرین بازدید '+toFa(min)+' دقیقه پیش';
  const hr = Math.floor(min/60);
  if(hr < 24) return 'آخرین بازدید '+toFa(hr)+' ساعت پیش';
  const day = Math.floor(hr/24);
  if(day === 1) return 'آخرین بازدید دیروز';
  if(day < 7) return 'آخرین بازدید '+toFa(day)+' روز پیش';
  const week = Math.floor(day/7);
  if(week < 5) return 'آخرین بازدید '+toFa(week)+' هفته پیش';
  return 'آخرین بازدید مدت‌ها پیش';
}
let presenceHeartbeatTimer = null;
async function presenceHeartbeat(){
  if(!sb || !publicChatUser || document.visibilityState !== 'visible') return;
  try{ await sb.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', publicChatUser.id); }catch(err){}
}
function startPresenceHeartbeat(){
  if(presenceHeartbeatTimer) clearInterval(presenceHeartbeatTimer);
  presenceHeartbeatTimer = setInterval(presenceHeartbeat, 45000);
  document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible') presenceHeartbeat(); });
}

/* ================= پنل اعلان‌ها: درخواست‌های هم‌مسیر + SOS فوری =================
   نیازمند این جدول تو Supabase (یک‌بار تو SQL editor اجرا کن، و بعد از Database →
   Replication، realtime رو براش فعال کن):

     create table if not exists sos_alerts (
       id bigint generated always as identity primary key,
       user_id uuid not null references profiles(id) on delete cascade,
       username text not null,
       gender text not null,
       day_count integer not null default 0,
       avatar_url text,
       created_at timestamptz not null default now(),
       resolved boolean not null default false,
       resolved_at timestamptz
     );
     alter table sos_alerts enable row level security;
     create policy "sos_alerts_select_all" on sos_alerts for select using (true);
     create policy "sos_alerts_insert_own" on sos_alerts for insert with check (auth.uid() = user_id);
     create policy "sos_alerts_update_own" on sos_alerts for update using (auth.uid() = user_id);

   قوانین تطبیق (دقیقاً همونی که خواسته شده):
   - فقط هم‌جنس فرستنده می‌بینه (دختر → فقط دخترها، پسر → فقط پسرها). اگه جنسیت
     فرستنده یا بیننده تو پروفایل ثبت نشده باشه، اصلاً نه دیده می‌شه نه فرستاده می‌شه.
   - فقط کسایی که day_count شون >= day_count فرستنده‌ست می‌بینن (هم‌سطح یا جلوتر).
   - فقط تا ۱۰ دقیقه بعد از ارسال معتبره؛ خودِ بیننده هم باید همین الان یا حداکثر
     تا ۱۰ دقیقه‌ی پیش آنلاین بوده باشه — این شرط را ست بودن presenceHeartbeat
     (هر ۴۵ ثانیه last_active_at رو آپدیت می‌کنه) و رفرش هر ۱ دقیقه‌ی این پنل
     تضمین می‌کنه: کسی که بیش‌تر از ۱۰ دقیقه غایب بوده، تب بسته/پس‌زمینه‌ست و
     اصلاً این کد را اجرا نمی‌کنه تا ببیندش. */
const SOS_ALERT_WINDOW_MIN = 10;       // یه درخواست SOS تا چند دقیقه بعد از ارسال معتبره
const SOS_ALERT_COOLDOWN_MIN = 10;     // فاصله‌ی لازم بین دو درخواست SOS از یک نفر
let incomingSosAlerts = [];             // درخواست‌های دیگران که الان برای من (هم‌جنس، هم‌سطح) قابل‌دیدنه
let myOpenSosAlert = null;              // آخرین درخواست فعال خودم، اگه دارم
let sosAlertsChannel = null;
let notifBellInitialized = false;

function myGenderValue(){
  return (storeData.profile && storeData.profile.gender) || null;
}
// شرط تطبیقِ یک ردیفِ sos_alerts با «من» به‌عنوان بیننده‌ی احتمالی —
// همون قانونی که هم روی کوئری اولیه و هم روی رویداد realtime اعمال می‌شه.
function sosAlertEligible(row){
  if(!row || row.resolved) return false;
  if(!publicChatUser || row.user_id === publicChatUser.id) return false;
  const myGender = myGenderValue();
  if(!myGender || !row.gender || row.gender !== myGender) return false;
  if((row.day_count||0) > programDay()) return false;
  const ageMin = (Date.now() - new Date(row.created_at).getTime()) / 60000;
  if(ageMin > SOS_ALERT_WINDOW_MIN || ageMin < 0) return false;
  return true;
}
function sosCooldownRemainingMs(){
  const last = storeData.lastSosAlertAt ? new Date(storeData.lastSosAlertAt).getTime() : 0;
  const remain = (last + SOS_ALERT_COOLDOWN_MIN*60000) - Date.now();
  return remain > 0 ? remain : 0;
}
function updateSosUrgentFabState(){
  const fab = document.getElementById('sosFab');
  if(!fab) return;
  fab.classList.toggle('urgent-cooldown', sosCooldownRemainingMs() > 0);
}
async function sendUrgentSOSAlert(){
  if(!chatConfigured() || !sb || !publicChatUser){ showToast('این قابلیت به اتصال اینترنت و ورود به حساب نیاز داره.'); return; }
  const myGender = myGenderValue();
  if(!myGender){ showToast('اول از پروفایلت جنسیت رو مشخص کن، بعد بزن.'); return; }
  const remain = sosCooldownRemainingMs();
  if(remain > 0){ showToast('چند دقیقه‌ی دیگه دوباره امتحان کن ('+toFa(Math.ceil(remain/60000))+' دقیقه مونده).'); return; }
  const ok = confirm('این یه درخواست کمک فوریه که فقط برای هم‌مسیرهای هم‌جنس‌ت که روزشمارشون هم‌سطح یا بالاتره و الان (یا تا ۱۰ دقیقه‌ی پیش) آنلاین بودن فرستاده می‌شه. ارسال بشه؟');
  if(!ok) return;
  try{
    const { data, error } = await sb.from('sos_alerts').insert({
      user_id: publicChatUser.id,
      username: publicChatUsername,
      gender: myGender,
      day_count: programDay(),
      avatar_url: (myProfileCache && myProfileCache.avatar_url) || null
    }).select().single();
    if(error) throw error;
    myOpenSosAlert = data;
    storeData.lastSosAlertAt = new Date().toISOString();
    saveData();
    updateSosUrgentFabState();
    showToast('درخواست کمک فرستاده شد 🆘');
  }catch(err){
    console.error('sendUrgentSOSAlert failed', err);
    showToast('ارسال درخواست ناموفق بود.');
  }
}
async function cancelMySosAlert(){
  if(!sb || !myOpenSosAlert) return;
  const id = myOpenSosAlert.id;
  try{ await sb.from('sos_alerts').update({ resolved:true, resolved_at:new Date().toISOString() }).eq('id', id); }catch(err){}
  myOpenSosAlert = null;
  renderNotifPanel();
}
async function loadMyOpenSosAlert(){
  if(!sb || !publicChatUser){ myOpenSosAlert = null; return; }
  try{
    const sinceIso = new Date(Date.now() - SOS_ALERT_WINDOW_MIN*60000).toISOString();
    const { data } = await sb.from('sos_alerts').select('*').eq('user_id', publicChatUser.id)
      .eq('resolved', false).gte('created_at', sinceIso).order('created_at', { ascending:false }).limit(1);
    myOpenSosAlert = (data && data[0]) || null;
  }catch(err){ myOpenSosAlert = null; }
}
async function loadIncomingSosAlerts(){
  if(!chatConfigured() || !sb || !publicChatUser){ incomingSosAlerts = []; updateNotifBellBadge(); return; }
  const myGender = myGenderValue();
  if(!myGender){ incomingSosAlerts = []; updateNotifBellBadge(); return; }
  try{
    const sinceIso = new Date(Date.now() - SOS_ALERT_WINDOW_MIN*60000).toISOString();
    const { data, error } = await sb.from('sos_alerts').select('*')
      .eq('resolved', false).eq('gender', myGender).lte('day_count', programDay())
      .neq('user_id', publicChatUser.id).gte('created_at', sinceIso)
      .order('created_at', { ascending:false }).limit(30);
    if(error) throw error;
    incomingSosAlerts = data || [];
  }catch(err){
    console.error('loadIncomingSosAlerts failed', err);
    incomingSosAlerts = [];
  }
  updateNotifBellBadge();
}
function updateNotifBellBadge(){
  const badge = document.getElementById('notifBellBadge');
  const sosDot = document.getElementById('pubSosDot');
  if(sosDot) sosDot.classList.toggle('show', incomingSosAlerts.length > 0);
  // اگه الان تو خودِ تب SOS و تو حالت لیست (نه گفتگو) هستیم، لیست رو زنده به‌روز نگه دار
  if(document.getElementById('tab-sos') && document.getElementById('tab-sos').classList.contains('active') && !sosThreadOpenId){
    if(typeof renderSosActiveList === 'function') renderSosActiveList();
    if(typeof renderSosMyAlertRow === 'function') renderSosMyAlertRow();
  }
  if(!badge) return;
  const incomingBuddyCount = (myPendingBuddyRequests||[]).filter(r=> publicChatUser && r.to_user === publicChatUser.id).length;
  const total = incomingBuddyCount + incomingSosAlerts.length;
  if(total > 0){ badge.textContent = total > 9 ? '۹+' : toFa(total); badge.classList.add('show'); }
  else { badge.classList.remove('show'); }
}
function renderNotifPanel(){
  const bodyEl = document.getElementById('notifPanelBody');
  const subEl = document.getElementById('notifPanelSub');
  if(!bodyEl) return;
  if(!chatConfigured() || !sb || !publicChatUser){
    bodyEl.innerHTML = '<div class="cm-ov-empty">این بخش نیاز به ورود به حساب داره.</div>';
    if(subEl) subEl.textContent = '';
    return;
  }
  const incomingBuddy = (myPendingBuddyRequests||[]).filter(r=> r.to_user === publicChatUser.id);
  let html = '<div class="notif-section-head">🤝 درخواست‌های هم‌مسیر</div>';
  if(incomingBuddy.length){
    html += '<div class="notif-buddy-row"><div style="flex:1;">'+toFa(incomingBuddy.length)+' درخواست هم‌مسیری جدید داری</div><button class="notif-go-btn" id="notifGoBuddyBtn">مشاهده</button></div>';
  } else {
    html += '<div class="notif-empty">درخواست جدیدی نداری.</div>';
  }
  if(myOpenSosAlert){
    html += '<div class="notif-my-sos-row"><div style="flex:1;">درخواست کمک فوری تو در حال ارسال به دیگرانه…</div><button class="notif-cancel-btn" id="notifCancelSosBtn">لغو</button></div>';
  }
  html += '<div class="notif-section-head">🆘 نیاز به کمک فوری دارن</div>';
  if(!myGenderValue()){
    html += '<div class="notif-empty">برای دیدن درخواست‌های کمک فوری، اول جنسیتت رو تو پروفایل مشخص کن.</div>';
  } else if(incomingSosAlerts.length){
    html += incomingSosAlerts.map(a=>{
      const name = escapeHtml(a.username || 'کاربر');
      const minAgo = Math.max(0, Math.floor((Date.now()-new Date(a.created_at).getTime())/60000));
      const sub = (minAgo < 1 ? 'همین الان' : (toFa(minAgo)+' دقیقه پیش')) + ' · روز ' + toFa(a.day_count||0);
      return '<div class="notif-sos-row"><div style="flex:1;min-width:0;"><div class="notif-sos-name">'+name+'</div><div class="notif-sos-sub">'+sub+'</div></div><button class="notif-go-btn" data-sos-respond="'+a.id+'" data-sos-name="'+name+'">برم کمک کنم</button></div>';
    }).join('');
  } else {
    html += '<div class="notif-empty">فعلاً کسی درخواست فوری نداره.</div>';
  }
  bodyEl.innerHTML = html;
  const totalNew = incomingBuddy.length + incomingSosAlerts.length;
  if(subEl) subEl.textContent = totalNew > 0 ? (toFa(totalNew)+' مورد جدید') : '';
}
function openNotifPanel(){
  document.getElementById('notifPanelOverlay').classList.add('show');
  const bellBtn = document.getElementById('notifBellBtn');
  if(bellBtn) bellBtn.classList.remove('ring');
  renderNotifPanel();
  Promise.all([loadIncomingSosAlerts(), loadMyOpenSosAlert()]).then(renderNotifPanel).catch(()=>{});
}
function closeNotifPanel(){
  document.getElementById('notifPanelOverlay').classList.remove('show');
}
function subscribeSosAlertsRealtime(){
  if(!sb || sosAlertsChannel) return;
  sosAlertsChannel = sb.channel('public:sos_alerts')
    .on('postgres_changes', {event:'INSERT', schema:'public', table:'sos_alerts'}, payload=>{
      const row = payload.new;
      if(sosAlertEligible(row)){
        incomingSosAlerts = incomingSosAlerts.filter(a=> a.id !== row.id);
        incomingSosAlerts.unshift(row);
        updateNotifBellBadge();
        const bellBtn = document.getElementById('notifBellBtn');
        if(bellBtn) bellBtn.classList.add('ring');
        if(isOverlayShown('notifPanelOverlay')) renderNotifPanel();
      }
      if(isAppOwner){
        adminSosAlerts = adminSosAlerts.filter(a=> a.id !== row.id);
        adminSosAlerts.unshift(row);
        renderAdminSosList();
      }
    })
    .on('postgres_changes', {event:'UPDATE', schema:'public', table:'sos_alerts'}, payload=>{
      const row = payload.new;
      incomingSosAlerts = incomingSosAlerts.filter(a=> a.id !== row.id || !row.resolved);
      if(myOpenSosAlert && row.id === myOpenSosAlert.id && row.resolved) myOpenSosAlert = null;
      updateNotifBellBadge();
      if(isOverlayShown('notifPanelOverlay')) renderNotifPanel();
      if(isAppOwner){
        const idx = adminSosAlerts.findIndex(a=> a.id === row.id);
        if(idx > -1) adminSosAlerts[idx] = row; else adminSosAlerts.unshift(row);
        renderAdminSosList();
      }
    })
    .subscribe();
}
async function initNotifBell(){
  if(!chatConfigured() || !sb || !publicChatUser) return;
  if(typeof loadMyBuddyRelations === 'function') await loadMyBuddyRelations();
  await loadMyOpenSosAlert();
  await loadIncomingSosAlerts();
  subscribeSosAlertsRealtime();
  updateSosUrgentFabState();
  if(!notifBellInitialized){
    notifBellInitialized = true;
    // هر ۱ دقیقه رفرش می‌شه تا هم درخواست‌های منقضی‌شده حذف بشن، هم شرط «آنلاین بودنِ
    // بیننده» با last_active_at خودم (که presenceHeartbeat آپدیتش می‌کنه) هماهنگ بمونه.
    setInterval(()=>{ if(publicChatUser){ loadIncomingSosAlerts(); updateSosUrgentFabState(); } }, 60000);
  }
}
document.getElementById('notifBellBtn').addEventListener('click', openNotifPanel);
document.getElementById('notifPanelBackBtn').addEventListener('click', closeNotifPanel);
document.getElementById('notifPanelBody').addEventListener('click', (e)=>{
  const goBuddy = e.target.closest('#notifGoBuddyBtn');
  if(goBuddy){ closeNotifPanel(); showPublicTab('buddy'); return; }
  const cancelBtn = e.target.closest('#notifCancelSosBtn');
  if(cancelBtn){ cancelMySosAlert(); return; }
  const respondBtn = e.target.closest('[data-sos-respond]');
  if(respondBtn){
    const id = respondBtn.dataset.sosRespond;
    const alert = incomingSosAlerts.find(a=> String(a.id) === String(id));
    closeNotifPanel();
    showPublicTab('sos');
    setTimeout(()=> openSosThread(id, respondBtn.dataset.sosName, alert && alert.day_count, alert && alert.created_at), 350);
    return;
  }
});

/* ================= تب مستقل «SOS چت» =================
   از همون sos_alerts بالا استفاده می‌کنه، به‌علاوه‌ی یه جدول جدید برای خودِ
   گفتگوی هر درخواست (این‌هم یک‌بار تو SQL editor اجرا بشه، و realtime‌ش هم از
   Database → Replication فعال بشه):

     create table if not exists sos_messages (
       id bigint generated always as identity primary key,
       alert_id bigint not null references sos_alerts(id) on delete cascade,
       user_id uuid not null references profiles(id) on delete cascade,
       username text not null,
       content text not null,
       created_at timestamptz not null default now()
     );
     alter table sos_messages enable row level security;
     create policy "sos_messages_select_all" on sos_messages for select using (true);
     create policy "sos_messages_insert_own" on sos_messages for insert with check (auth.uid() = user_id);

   این گفتگو از همون فیلترهای امنیتی چت عمومی (فحش/محتوای بحرانی/تعلیق/سکوت) رد
   می‌شه، فقط جدا از سقف روزانه‌ی پیام رایگانه — چون یه ابزار کمک فوریه، نه چت
   عادی، نباید پشت محدودیت پیام رایگان قفل بمونه. */
let sosThreadChannel = null;
let sosThreadOpenId = null;
let lastSosThreadSenderId = null;

function sosMinAgoLabel(createdAt){
  const min = Math.max(0, Math.floor((Date.now()-new Date(createdAt).getTime())/60000));
  return min < 1 ? 'همین الان' : (toFa(min)+' دقیقه پیش');
}
async function loadSosTab(){
  closeSosThread();
  if(isAppOwner){
    loadAdminSosAlerts().then(renderAdminSosList);
  } else {
    const adminBox = document.getElementById('sosAdminBox');
    if(adminBox) adminBox.style.display = 'none';
  }
  const listEl = document.getElementById('sosActiveList');
  if(!myGenderValue()){
    listEl.innerHTML = '<div class="sos-tab-empty">برای دیدن و فرستادن درخواست کمک فوری، اول از پروفایلت جنسیت رو مشخص کن.</div>';
    renderSosMyAlertRow();
    return;
  }
  listEl.innerHTML = '<div class="lb-loading"><div class="lb-spinner"></div>در حال بارگذاری...</div>';
  await Promise.all([loadMyOpenSosAlert(), loadIncomingSosAlerts()]);
  renderSosMyAlertRow();
  renderSosActiveList();
}
function renderSosMyAlertRow(){
  const box = document.getElementById('sosMyAlertBox');
  const row = document.getElementById('sosMyAlertRow');
  if(!box || !row) return;
  if(!myOpenSosAlert){ box.style.display = 'none'; return; }
  box.style.display = 'block';
  row.innerHTML = '<div style="flex:1;">درخواستت '+sosMinAgoLabel(myOpenSosAlert.created_at)+' فرستاده شده — منتظر بمون یا خودت گفتگو رو ببین.</div>'
    + '<button class="notif-go-btn" id="sosMyAlertOpenBtn" style="margin-inline-end:6px;">مشاهده</button>'
    + '<button class="notif-cancel-btn" id="sosMyAlertCancelBtn">لغو</button>';
  const openBtn = document.getElementById('sosMyAlertOpenBtn');
  if(openBtn) openBtn.onclick = ()=> openSosThread(myOpenSosAlert.id, publicChatUsername, myOpenSosAlert.day_count, myOpenSosAlert.created_at);
  const cancelBtn = document.getElementById('sosMyAlertCancelBtn');
  if(cancelBtn) cancelBtn.onclick = cancelMySosAlert;
}
function renderSosActiveList(){
  const listEl = document.getElementById('sosActiveList');
  if(!listEl) return;
  if(!incomingSosAlerts.length){
    listEl.innerHTML = '<div class="sos-tab-empty">فعلاً کسی درخواست فوری نداره. اگه یه هم‌مسیر کمک لازم داشته باشه، همین‌جا ظاهر می‌شه.</div>';
    return;
  }
  listEl.innerHTML = incomingSosAlerts.map(a=>{
    const name = escapeHtml(a.username || 'کاربر');
    return '<div class="sos-active-card"><span class="sos-active-card-dot"></span>'
      + '<div style="flex:1;min-width:0;"><div class="sos-active-card-name">'+name+'</div>'
      + '<div class="sos-active-card-sub">'+sosMinAgoLabel(a.created_at)+' · روز '+toFa(a.day_count||0)+'</div></div>'
      + '<button class="sos-active-card-join" data-sos-open="'+a.id+'" data-sos-name="'+name+'" data-sos-day="'+(a.day_count||0)+'" data-sos-created="'+a.created_at+'">پیوستن</button></div>';
  }).join('');
}
document.getElementById('sosActiveList').addEventListener('click', (e)=>{
  const btn = e.target.closest('[data-sos-open]');
  if(!btn) return;
  openSosThread(btn.dataset.sosOpen, btn.dataset.sosName, btn.dataset.sosDay, btn.dataset.sosCreated);
});

/* ================= نظارت مالک اپ (OWNER_EMAIL) روی همه‌ی اتاق‌های SOS =================
   isAppOwner از پروفایلِ لاگین‌شده (ایمیلش با OWNER_EMAIL یکی باشه) تعیین می‌شه — همون
   مکانیزمی که بقیه‌ی ابزارهای مدیریتی اپ (لغو تعلیق/سکوت و ...) ازش استفاده می‌کنن.
   این بخش هیچ فیلتر جنسیت/day_count/۱۰-دقیقه‌ای نداره: مدیر همه‌ی درخواست‌های SOS
   (چه فعال، چه بسته‌شده، چه منقضی) رو تا ۲۴ ساعت اخیر می‌بینه، می‌تونه هرکدوم رو باز
   کنه (همون اتاق گفتگوی مخصوص خودش) یا به‌عنوان «حل‌شده» ببندتش. برای کاربرهای عادی
   isAppOwner همیشه false می‌مونه، پس این بخش اصلاً براشون رندر/لود نمی‌شه. */
let adminSosAlerts = [];
async function loadAdminSosAlerts(){
  if(!isAppOwner || !sb) { adminSosAlerts = []; return; }
  try{
    const sinceIso = new Date(Date.now() - 24*60*60000).toISOString();
    const { data, error } = await sb.from('sos_alerts').select('*')
      .gte('created_at', sinceIso).order('created_at', { ascending:false }).limit(80);
    if(error) throw error;
    adminSosAlerts = data || [];
  }catch(err){
    console.error('loadAdminSosAlerts failed', err);
    adminSosAlerts = [];
  }
}
function sosAdminStatusInfo(a){
  if(a.resolved) return { text:'بسته‌شده', cls:'done' };
  const ageMin = (Date.now() - new Date(a.created_at).getTime())/60000;
  if(ageMin <= SOS_ALERT_WINDOW_MIN) return { text:'فعال', cls:'live' };
  return { text:'منقضی', cls:'expired' };
}
function renderAdminSosList(){
  const box = document.getElementById('sosAdminBox');
  const listEl = document.getElementById('sosAdminList');
  if(!box || !listEl) return;
  if(!isAppOwner){ box.style.display = 'none'; return; }
  box.style.display = 'block';
  if(!adminSosAlerts.length){ listEl.innerHTML = '<div class="sos-tab-empty">هنوز هیچ درخواستی ثبت نشده.</div>'; return; }
  listEl.innerHTML = adminSosAlerts.map(a=>{
    const name = escapeHtml(a.username || 'کاربر');
    const st = sosAdminStatusInfo(a);
    const genderLbl = a.gender==='male' ? 'پسر' : a.gender==='female' ? 'دختر' : '—';
    return '<div class="sos-active-card sos-admin-card">'
      + '<span class="sos-admin-status sos-admin-status-'+st.cls+'">'+st.text+'</span>'
      + '<div style="flex:1;min-width:0;"><div class="sos-active-card-name">'+name+' <span style="font-weight:500;color:var(--muted);">('+genderLbl+')</span></div>'
      + '<div class="sos-active-card-sub">'+sosMinAgoLabel(a.created_at)+' · روز '+toFa(a.day_count||0)+'</div></div>'
      + '<button class="sos-active-card-join" data-admin-open="'+a.id+'" data-sos-name="'+name+'" data-sos-day="'+(a.day_count||0)+'" data-sos-created="'+a.created_at+'">مشاهده</button>'
      + (a.resolved ? '' : '<button class="notif-cancel-btn" data-admin-resolve="'+a.id+'" style="margin-inline-start:6px;">بستن</button>')
      + '</div>';
  }).join('');
}
document.getElementById('sosAdminList').addEventListener('click', (e)=>{
  const openBtn = e.target.closest('[data-admin-open]');
  if(openBtn){ openSosThread(openBtn.dataset.adminOpen, openBtn.dataset.sosName, openBtn.dataset.sosDay, openBtn.dataset.sosCreated); return; }
  const resolveBtn = e.target.closest('[data-admin-resolve]');
  if(resolveBtn){
    const id = resolveBtn.dataset.adminResolve;
    if(!confirm('این درخواست به‌عنوان حل‌شده/بسته علامت بخوره؟')) return;
    sb.from('sos_alerts').update({ resolved:true, resolved_at:new Date().toISOString() }).eq('id', id)
      .then(()=> loadAdminSosAlerts().then(renderAdminSosList))
      .catch(()=> showToast('عملیات ناموفق بود', 'error'));
    return;
  }
});

function openSosThread(alertId, username, dayCount, createdAt){
  alertId = String(alertId);
  document.getElementById('sosListBox').style.display = 'none';
  document.getElementById('sosThreadBox').style.display = 'flex';
  document.getElementById('sosThreadName').textContent = username || 'کاربر';
  document.getElementById('sosThreadSub').textContent = '🆘 درخواست کمک فوری · روز '+toFa(dayCount||0)+' · '+sosMinAgoLabel(createdAt||new Date().toISOString());
  sosThreadOpenId = alertId;
  loadSosThreadMessages(alertId);
  subscribeSosThreadRealtime(alertId);
}
function closeSosThread(){
  const listBox = document.getElementById('sosListBox');
  const threadBox = document.getElementById('sosThreadBox');
  if(threadBox) threadBox.style.display = 'none';
  if(listBox) listBox.style.display = 'block';
  if(sosThreadChannel){ sb.removeChannel(sosThreadChannel); sosThreadChannel = null; }
  const wasOpen = !!sosThreadOpenId;
  sosThreadOpenId = null;
  if(wasOpen && publicChatUser){
    // با برگشتن به لیست، وضعیت رو تازه می‌کنیم — شاید تو این فاصله درخواستی حل شده باشه
    loadIncomingSosAlerts().then(renderSosActiveList);
    loadMyOpenSosAlert().then(renderSosMyAlertRow);
    if(isAppOwner) loadAdminSosAlerts().then(renderAdminSosList);
  }
}
document.getElementById('sosThreadBackBtn').addEventListener('click', closeSosThread);
document.getElementById('sosBackBtn').addEventListener('click', closeSosThread);
function sosThreadMsgHtml(m, grouped){
  const own = publicChatUser && m.user_id === publicChatUser.id;
  const time = new Date(m.created_at).toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
  const head = grouped ? '' : `<div class="cm-head"><div class="cm-name">${own?'تو':escapeHtml(m.username||'کاربر')}</div></div>`;
  return `<div class="chat-msg${own?' own':''}${grouped?' grouped':''}" data-msg-id="${m.id}">
    ${head}
    <div class="cm-text">${escapeHtml(m.content)}</div>
    <div class="cm-bottom-row"><span class="cm-time">${time}</span></div>
  </div>`;
}
function renderSosThreadMessages(rows){
  const wrap = document.getElementById('sosThreadMessages');
  if(!rows || !rows.length){ wrap.innerHTML = '<div class="chat-empty-msg">هنوز کسی پیام نداده — اولین نفری باش که دلگرمی می‌ده 🤍</div>'; lastSosThreadSenderId = null; return; }
  let prev = null;
  wrap.innerHTML = rows.map(m=>{ const grouped = prev===m.user_id; prev = m.user_id; return sosThreadMsgHtml(m, grouped); }).join('');
  lastSosThreadSenderId = prev;
  wrap.scrollTop = wrap.scrollHeight;
}
async function loadSosThreadMessages(alertId){
  const wrap = document.getElementById('sosThreadMessages');
  wrap.innerHTML = '<div class="chat-empty-msg">در حال بارگذاری پیام‌ها...</div>';
  if(!sb) return;
  try{
    const { data, error } = await sb.from('sos_messages').select('*').eq('alert_id', alertId).order('created_at', { ascending:true }).limit(200);
    if(error) throw error;
    if(String(sosThreadOpenId) === String(alertId)) renderSosThreadMessages(data);
  }catch(err){
    console.error('loadSosThreadMessages failed', err);
    wrap.innerHTML = '<div class="chat-empty-msg">مشکلی تو بارگذاری پیش اومد.</div>';
  }
}
function subscribeSosThreadRealtime(alertId){
  if(sosThreadChannel){ sb.removeChannel(sosThreadChannel); sosThreadChannel = null; }
  if(!sb) return;
  sosThreadChannel = sb.channel('sos:'+alertId)
    .on('postgres_changes', {event:'INSERT', schema:'public', table:'sos_messages', filter:'alert_id=eq.'+alertId}, payload=>{
      if(String(sosThreadOpenId) !== String(alertId)) return;
      const wrap = document.getElementById('sosThreadMessages');
      if(wrap.querySelector('.chat-empty-msg')) wrap.innerHTML = '';
      const grouped = lastSosThreadSenderId === payload.new.user_id;
      wrap.insertAdjacentHTML('beforeend', sosThreadMsgHtml(payload.new, grouped));
      lastSosThreadSenderId = payload.new.user_id;
      wrap.scrollTop = wrap.scrollHeight;
    }).subscribe();
}
async function sendSosThreadMessage(){
  const input = document.getElementById('sosThreadInput');
  const text = input.value.trim();
  if(!text || !publicChatUser || !sosThreadOpenId) return;
  if(isCurrentlySuspended()){ showToast('دسترسیت به چت موقتاً بسته‌ست', 'error'); return; }
  if(isCurrentlyMuted()){ showToast('فعلاً ساکتت کرده‌ن — نمی‌تونی پیام بفرستی', 'error'); return; }
  if(checkCrisisText(text)){
    input.value = '';
    autoGrowChatBox(input);
    renderCrisisBanner('sosThreadCrisisSlot');
    showToast('این یه پیام حساسه؛ به‌جاش این رو برات آوردیم 🤍');
    return;
  }
  if(containsAbusiveLanguage(text)){ showToast('لطفاً محترمانه بنویس 🙏', 'error'); return; }
  input.value = '';
  autoGrowChatBox(input);
  const alertId = sosThreadOpenId;
  try{
    const { error } = await sb.from('sos_messages').insert({ alert_id: alertId, user_id: publicChatUser.id, username: publicChatUsername, content: text });
    if(error) throw error;
  }catch(err){
    console.error('sendSosThreadMessage failed', err);
    showToast('پیام ارسال نشد', 'error');
    input.value = text;
    autoGrowChatBox(input);
  }
}
document.getElementById('sosThreadSendBtn').addEventListener('click', sendSosThreadMessage);
document.getElementById('sosThreadInput').addEventListener('keydown', e=>{
  if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendSosThreadMessage(); }
});

/* ---------------- Auto-growing chat composer boxes ----------------
   All three chat text boxes (public chat, buddy chat, SOS thread) used to be
   <input type="text">, so a long message just scrolled sideways inside a fixed
   single line instead of wrapping — and the box itself never got taller. They're
   now <textarea rows="1">; this keeps each one's height tracking its content
   (growing line-by-line) up to the CSS max-height, after which it scrolls
   internally like a normal chat app composer. */
function autoGrowChatBox(el){
  if(!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}
['chatInput','buddyChatInput','sosThreadInput'].forEach(id=>{
  const el = document.getElementById(id);
  if(el) el.addEventListener('input', ()=>autoGrowChatBox(el));
});

// Deliberately no day-count / habit info here — this is a member directory, not the leaderboard.
function cmMemberRowHtml(user, online){
  const name = user.username || 'کاربر';
  const color = lbColorFor(user.id || name);
  const statusHtml = online
    ? '<div class="cm-ov-status online">آنلاین</div>'
    : '<div class="cm-ov-status">'+escapeHtml(lbLastSeenLabel(user.last_active_at))+'</div>';
  return `<div class="cm-ov-row">
    <div class="lb-avatar-wrap">
      <div class="lb-avatar" style="background:${user.avatar_url?'transparent':color}">${lbAvatarInnerHtml(user, name)}</div>
      ${lbGenderBadge(user.gender)}
      ${online ? '<span class="cm-ov-online-dot"></span>' : ''}
    </div>
    <div style="flex:1;min-width:0;">
      <div class="cm-ov-name">${escapeHtml(name)}</div>
      ${statusHtml}
    </div>
  </div>`;
}
async function loadChatMembers(){
  const bodyEl = document.getElementById('cmOvBody');
  if(!bodyEl) return;
  bodyEl.innerHTML = '<div class="cm-ov-loading">در حال بارگذاری...</div>';
  if(!sb){ bodyEl.innerHTML = '<div class="cm-ov-empty">اتصال به سرور برقرار نیست.</div>'; return; }
  try{
    const { data, error } = await sb.from('profiles').select('id,username,gender,last_active_at,avatar_url')
      .order('last_active_at', { ascending:false, nullsFirst:false }).limit(300);
    if(error) throw error;
    const rows = data || [];
    const online = rows.filter(u=> isOnlineNow(u.last_active_at));
    const offline = rows.filter(u=> !isOnlineNow(u.last_active_at));
    if(!rows.length){ bodyEl.innerHTML = '<div class="cm-ov-empty">هنوز کسی اینجا نیست.</div>'; return; }
    let html = '';
    if(online.length){
      html += '<div class="cm-ov-section"><span class="cm-online-section-dot"></span>آنلاین ('+toFa(online.length)+')</div>';
      html += online.map(u=> cmMemberRowHtml(u, true)).join('');
    }
    if(offline.length){
      html += '<div class="cm-ov-section">سایر اعضا</div>';
      html += offline.map(u=> cmMemberRowHtml(u, false)).join('');
    }
    bodyEl.innerHTML = html;
    const subEl = document.getElementById('cmOvSub');
    if(subEl) subEl.textContent = toFa(rows.length)+' عضو · '+toFa(online.length)+' آنلاین';
  }catch(err){
    console.error('Load chat members failed', err);
    bodyEl.innerHTML = '<div class="cm-ov-empty">مشکلی در بارگذاری پیش اومد.</div>';
  }
}
function openChatMembers(){
  document.getElementById('chatMembersOverlay').classList.add('show');
  loadChatMembers();
}
function closeChatMembers(){
  document.getElementById('chatMembersOverlay').classList.remove('show');
}
document.querySelectorAll('#tab-chat .cph-id').forEach(el=> el.addEventListener('click', openChatMembers));
document.getElementById('chatMembersBackBtn').addEventListener('click', closeChatMembers);

/* ---------------- Scroll-to-bottom FAB (Telegram-style) ----------------
   While the user is near the bottom of the message list, new messages just auto-scroll in as
   before. Once they scroll up to read older messages, we stop yanking them back down: incoming
   messages instead bump a small unread counter on a floating arrow button until they tap it
   (or scroll back down themselves) to jump to the newest message. */
let chatUnseenCount = 0;
function isChatListNearBottom(){
  const wrap = document.getElementById('chatMessages');
  if(!wrap) return true;
  return (wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight) < 90;
}
function updateChatScrollDownBadge(){
  const badge = document.getElementById('chatScrollDownBadge');
  if(!badge) return;
  if(chatUnseenCount > 0){
    badge.textContent = chatUnseenCount > 9 ? '۹+' : toFa(chatUnseenCount);
    badge.classList.add('show');
  } else {
    badge.classList.remove('show');
  }
}
function updateChatScrollDownBtn(){
  const btn = document.getElementById('chatScrollDownBtn');
  if(!btn) return;
  if(isChatListNearBottom()){
    btn.classList.remove('show');
    if(chatUnseenCount !== 0){ chatUnseenCount = 0; updateChatScrollDownBadge(); }
  } else {
    btn.classList.add('show');
  }
}
function scrollChatToBottom(smooth){
  const wrap = document.getElementById('chatMessages');
  if(!wrap) return;
  if(smooth) wrap.scrollTo({top: wrap.scrollHeight, behavior:'smooth'});
  else wrap.scrollTop = wrap.scrollHeight;
  chatUnseenCount = 0;
  updateChatScrollDownBadge();
  updateChatScrollDownBtn();
}
(function(){
  const wrap = document.getElementById('chatMessages');
  const btn = document.getElementById('chatScrollDownBtn');
  if(wrap) wrap.addEventListener('scroll', updateChatScrollDownBtn, {passive:true});
  if(btn) btn.addEventListener('click', ()=> scrollChatToBottom(true));
})();

function renderPublicChatMessages(rows){
  const wrap = document.getElementById('chatMessages');
  const blockedIds = new Set(getBlockedChatUsers().map(u=>u.id));
  const visible = (rows||[]).filter(m=> !blockedIds.has(m.user_id));
  updateChatPresenceIndicator(rows);
  if(visible.length===0){ wrap.innerHTML = '<div class="chat-empty-msg">هنوز پیامی نیست، اولین نفر باش!</div>'; lastChatMsgUserId = null; chatUnseenCount = 0; updateChatScrollDownBadge(); updateChatScrollDownBtn(); return; }
  let html = '';
  let prevUserId = null;
  let i = 0;
  while(i < visible.length){
    const m = visible[i];
    const grouped = prevUserId === m.user_id;
    if(!chatMsgHasAvatar(m)){
      // own messages + the automated group-bot cards stay flat, exactly as before —
      // no avatar, no group wrapper.
      html += publicChatMsgHtml(m, grouped);
      prevUserId = m.user_id;
      i++;
      continue;
    }
    // Collect the whole consecutive run from this sender into one avatar group.
    let inner = '';
    let j = i;
    while(j < visible.length && visible[j].user_id === m.user_id){
      inner += publicChatMsgHtml(visible[j], j > i);
      j++;
    }
    html += wrapChatGroupHtml(m, inner);
    prevUserId = m.user_id;
    i = j;
  }
  wrap.innerHTML = html;
  lastChatMsgUserId = prevUserId;
  applyChatUserFilter();
  wrap.scrollTop = wrap.scrollHeight;
  chatUnseenCount = 0;
  updateChatScrollDownBadge();
  updateChatScrollDownBtn();
  // Real profile photos load in a second pass (like reactions below) so the first paint
  // isn't blocked on it — avatars just upgrade in place from initials once resolved.
  const avatarUserIds = visible.filter(chatMsgHasAvatar).map(m=>m.user_id);
  loadChatAvatarUrlsFor(avatarUserIds).then(()=>{
    avatarUserIds.forEach(id=> updateChatAvatarUI(id));
  });
  // Animate report-card progress bars from 0 -> target after they're in the DOM.
  requestAnimationFrame(()=>{
    wrap.querySelectorAll('.cm-progress-fill').forEach(el=>{
      const target = el.dataset.target || '0';
      requestAnimationFrame(()=>{ el.style.width = target + '%'; });
    });
  });
}
// Appends one live/new message to #chatMessages — extends the last .cm-group if this
// message continues the same sender's consecutive run (so the avatar isn't duplicated),
// otherwise starts a fresh group (or, for own/bot messages, just appends flat as before).
function appendPublicChatMessage(m){
  const wrap = document.getElementById('chatMessages');
  const grouped = lastChatMsgUserId === m.user_id;
  if(!chatMsgHasAvatar(m)){
    wrap.insertAdjacentHTML('beforeend', publicChatMsgHtml(m, grouped));
  } else if(grouped && wrap.lastElementChild && wrap.lastElementChild.classList.contains('cm-group')){
    const msgsEl = wrap.lastElementChild.querySelector('.cm-group-messages');
    if(msgsEl) msgsEl.insertAdjacentHTML('beforeend', publicChatMsgHtml(m, true));
    else wrap.insertAdjacentHTML('beforeend', wrapChatGroupHtml(m, publicChatMsgHtml(m, grouped)));
  } else {
    wrap.insertAdjacentHTML('beforeend', wrapChatGroupHtml(m, publicChatMsgHtml(m, grouped)));
  }
  lastChatMsgUserId = m.user_id;
  if(chatMsgHasAvatar(m) && !(m.user_id in chatAvatarUrlCache)){
    loadChatAvatarUrlsFor([m.user_id]).then(()=> updateChatAvatarUI(m.user_id));
  }
}
async function deletePublicChatMessage(id){
  if(!sb || !publicChatUser) return;
  try{
    // Owner and chat-admins can delete anyone's message; regular users are still restricted
    // to their own row client-side too — but the real backstop is the Supabase RLS policy on
    // the `messages` table, which is what actually determines whose delete requests succeed.
    let q = sb.from('messages').delete().eq('id', id);
    if(!isChatAdmin) q = q.eq('user_id', publicChatUser.id);
    const { error } = await q;
    if(error){ showToast('حذف نشد', 'error'); return; }
    const el = document.querySelector(`.chat-msg[data-msg-id="${id}"]`);
    if(el){
      const group = el.closest('.cm-group');
      el.remove();
      if(group && !group.querySelector('.chat-msg')) group.remove();
    }
    showToast('پیام حذف شد');
  }catch(err){ showToast('حذف نشد', 'error'); }
}
async function reportPublicChatMessage(id){
  if(!sb || !publicChatUser) return;
  if(reportedMsgIds.has(id)){ showToast('قبلاً گزارشش کردی', 'error'); return; }
  try{
    const { error } = await sb.from('message_reports').insert({ message_id: id, reporter_id: publicChatUser.id });
    if(error){ showToast('گزارش ثبت نشد', 'error'); return; }
    reportedMsgIds.add(id);
    showToast('گزارش ثبت شد، ممنون 🙏', 'success');
  }catch(err){ showToast('گزارش ثبت نشد', 'error'); }
}
document.getElementById('chatMessages').addEventListener('click', (e)=>{
  const editSaveBtn = e.target.closest('.cm-edit-save');
  if(editSaveBtn){ saveEditChatMessage(editSaveBtn.closest('.chat-msg')); return; }
  const editCancelBtn = e.target.closest('.cm-edit-cancel');
  if(editCancelBtn){ cancelEditChatMessage(editCancelBtn.closest('.chat-msg')); return; }
});
/* ---------------- Group features: collective streak, weekly card ----------------
   The bot user_id below MUST match the fixed system profile row created by the SQL migration
   (group-features.sql). It's what lets the client tell a real automatic group message apart
   from a regular user who happens to type the same marker text — a normal user's id is
   assigned by Supabase Auth and can never equal this constant. */
const GROUP_BOT_USER_ID = '00000000-0000-0000-0000-000000000001';
const GROUP_STREAK_MARKER = '⟦GROUPSTREAK⟧';
const GROUP_WEEKLY_MARKER = '⟦GROUPWEEKLY⟧';

function parseMarkerMsg(content, marker){
  // Server stores content as marker + "<value>|<display text>" so the client can show the
  // number without recomputing it, and still keep the rest as free text.
  const rest = content.slice(marker.length);
  const sep = rest.indexOf('|');
  if(sep === -1) return { value:null, text: rest };
  return { value: rest.slice(0, sep), text: rest.slice(sep+1) };
}
function groupStreakBannerText(count){
  if(!count || count<=0) return '';
  return `🔥 امروز روز ${toFa(count)} زنجیره‌ی گروهه`;
}
async function loadGroupStreakBanner(){
  const box = document.getElementById('groupStreakBanner');
  if(!box || !sb) return;
  try{
    const { data, error } = await sb.from('group_streak').select('current_count').eq('id', 1).single();
    if(error || !data) return;
    const text = groupStreakBannerText(data.current_count);
    box.textContent = text;
    box.classList.toggle('show', !!text);
  }catch(err){ console.error('group streak banner error', err); }
}

/* ---------------- Pinned messages (owner + admins) ----------------
   Pin state lives directly on the `messages` row itself (is_pinned + pinned_at
   columns — see chat-pin-supabase-schema.sql), instead of a separate one-row
   `chat_pinned` table. That old table needed a pre-seeded row for its `update()`
   call to ever affect anything — if that row was never created, the update
   silently matched zero rows (no error, no toast, nothing saved), which is why
   pinning looked completely broken. Storing the flag on the message itself
   removes that failure mode entirely, and — unlike the old single-slot design —
   any number of messages can be pinned at the same time; pinning a new one
   never touches the others. isChatAdmin already covers both the owner and any
   admin granted via set_chat_admin_by_email, so both can pin/unpin here with no
   extra permission check needed. The banner is loaded with its own targeted
   query (is_pinned=true), so every pinned message renders correctly even if
   it's scrolled out of the loaded 150-row window. */
let chatPinnedMsgs = []; // [{id, content, username}]
let chatPinnedChannel = null;
function renderChatPinnedBanner(){
  const box = document.getElementById('chatPinnedBanner');
  if(!box) return;
  // Defensive de-dupe by id — Supabase can hand back a numeric id while the DOM's
  // data-msg-id is always a string, so without normalizing here the same message
  // could otherwise get pushed into the array twice (once locally, once from the
  // realtime echo) and render as two identical rows.
  const seen = new Set();
  const unique = chatPinnedMsgs.filter(m=>{
    const key = String(m.id);
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if(unique.length !== chatPinnedMsgs.length) chatPinnedMsgs = unique;
  if(!chatPinnedMsgs.length){ box.classList.remove('show'); box.innerHTML = ''; return; }
  box.innerHTML = chatPinnedMsgs.map(m => `
    <div class="cpin-row" data-pin-id="${m.id}">
      <div class="cpin-icon">📌</div>
      <div class="cpin-body"><div class="cpin-name">${escapeHtml(m.username || 'کاربر')}</div><div class="cpin-text">${escapeHtml(m.content || '')}</div></div>
      ${isChatAdmin ? `<button type="button" class="cpin-unpin" data-pin-id="${m.id}" aria-label="برداشتن پین">✕</button>` : ''}
    </div>`).join('');
  box.classList.add('show');
}
async function loadChatPinned(){
  if(!sb) return;
  try{
    const { data, error } = await sb.from('messages')
      .select('id, content, username')
      .eq('is_pinned', true)
      .order('pinned_at', {ascending:true})
      .limit(20);
    if(error) return; // column not set up yet — skip silently, rest of the chat still works
    chatPinnedMsgs = (data || []).map(m => ({ id: String(m.id), content: m.content, username: m.username }));
    renderChatPinnedBanner();
    if(!chatPinnedChannel){
      chatPinnedChannel = sb.channel('public:messages-pin')
        .on('postgres_changes', {event:'UPDATE', schema:'public', table:'messages'}, payload=>{
          const row = payload.new;
          const rowId = String(row.id);
          const idx = chatPinnedMsgs.findIndex(m => m.id === rowId);
          if(row.is_pinned){
            const entry = { id: rowId, content: row.content, username: row.username };
            if(idx === -1) chatPinnedMsgs.push(entry); else chatPinnedMsgs[idx] = entry;
            renderChatPinnedBanner();
          } else if(idx !== -1){
            chatPinnedMsgs.splice(idx, 1);
            renderChatPinnedBanner();
          }
        }).subscribe();
    }
  }catch(err){ console.error('pinned message load error', err); }
}
async function pinChatMessage(el){
  if(!sb || !isChatAdmin || !el) return;
  const textEl = el.querySelector('.cm-text');
  const text = textEl ? textEl.textContent.trim().slice(0, 200) : '';
  const username = el.dataset.username || 'کاربر';
  const msgId = el.dataset.msgId ? String(el.dataset.msgId) : '';
  if(!msgId) return;
  try{
    const { error } = await sb.from('messages')
      .update({ is_pinned:true, pinned_at: new Date().toISOString() })
      .eq('id', msgId);
    if(error){ showToast('پین نشد', 'error'); return; }
    if(!chatPinnedMsgs.some(m => m.id === msgId)) chatPinnedMsgs.push({ id: msgId, content: text, username });
    renderChatPinnedBanner();
    showToast('پیام پین شد 📌');
  }catch(err){ showToast('پین نشد', 'error'); }
}
async function unpinChatMessage(msgId){
  msgId = msgId ? String(msgId) : '';
  if(!sb || !isChatAdmin || !msgId) return;
  try{
    const { error } = await sb.from('messages').update({ is_pinned:false, pinned_at:null }).eq('id', msgId);
    if(error){ showToast('برداشتن پین ناموفق بود', 'error'); return; }
    chatPinnedMsgs = chatPinnedMsgs.filter(m => m.id !== msgId);
    renderChatPinnedBanner();
    showToast('پین برداشته شد');
  }catch(err){ showToast('برداشتن پین ناموفق بود', 'error'); }
}
const chatPinnedBannerEl = document.getElementById('chatPinnedBanner');
if(chatPinnedBannerEl) chatPinnedBannerEl.addEventListener('click', e=>{
  const unpinBtn = e.target.closest('.cpin-unpin');
  if(unpinBtn){ unpinChatMessage(unpinBtn.dataset.pinId); return; }
  const row = e.target.closest('.cpin-row');
  if(!row) return;
  const id = row.dataset.pinId;
  const targetEl = document.querySelector(`.chat-msg[data-msg-id="${id}"]`);
  if(targetEl){
    targetEl.scrollIntoView({behavior:'smooth', block:'center'});
    targetEl.classList.add('flash');
    setTimeout(()=> targetEl.classList.remove('flash'), 900);
  } else {
    showToast('این پیام دیگه تو لیست بارگذاری‌شده نیست');
  }
});

/* ---------------- Weekly public-chat purge (free Supabase plan → keep table size down) ----------------
   Calls the purge_chat_if_due() RPC, which atomically checks a shared "last purged" timestamp
   and — only if 7+ days have passed — wipes the whole `messages` table (RLS-bypassing, via
   SECURITY DEFINER, so this is the only thing allowed to delete other people's messages).
   Runs once per session for every signed-in user, so the wipe happens on schedule regardless
   of which device happens to be open when the 7 days are up — not tied to any one person.
   Requires the `chat_meta` table + `purge_chat_if_due()` function from
   chat-purge-supabase-schema.sql (run once in the Supabase SQL editor). */
async function maybeWeeklyPurgeChat(){
  if(!sb) return;
  try{
    const { data: purged, error } = await sb.rpc('purge_chat_if_due');
    if(error) return; // RPC not set up yet — skip silently, chat just works as before
    if(purged){
      const wrap = document.getElementById('chatMessages');
      if(wrap) wrap.innerHTML = '<div class="chat-empty-msg">هنوز پیامی نیست، اولین نفر باش!</div>';
    }
  }catch(err){ console.error('weekly chat purge error', err); }
}

async function loadPublicChatMessages(){
  try{
    // Only the columns the chat UI actually renders — select('*') was pulling every
    // column on the table over the wire for up to 150 rows on every session load.
    let { data, error } = await sb.from('messages')
      .select('id,user_id,username,content,created_at,is_owner,is_admin,admin_title,streak,premium,media_path,media_type')
      .order('created_at', {ascending:true}).limit(150);
    if(error && /media_path|media_type/i.test(error.message || '')){
      // media_path/media_type haven't been added on this Supabase project yet
      // (chat-media-supabase-schema.sql not run) — fall back so the rest of the
      // chat still loads; media bubbles just won't be sendable/visible yet.
      ({ data, error } = await sb.from('messages')
        .select('id,user_id,username,content,created_at,is_owner,is_admin,admin_title,streak,premium')
        .order('created_at', {ascending:true}).limit(150));
    }
    if(error && /is_admin|admin_title/i.test(error.message || '')){
      // chat-admin-supabase-schema.sql hasn't been run yet on this project — fall back to
      // the old column set so chat still loads; admin badges just won't show until it's run.
      ({ data, error } = await sb.from('messages')
        .select('id,user_id,username,content,created_at,is_owner,streak,premium,media_path,media_type')
        .order('created_at', {ascending:true}).limit(150));
    }
    if(!error){
      // Paint the message list right away instead of making the whole chat wait on a
      // second sequential round trip just for reactions. Reaction pills patch themselves
      // in a beat later — renderReactionPillsInner already renders nothing for a message
      // with no cache entry yet, exactly like it does for a brand-new realtime message.
      renderPublicChatMessages(data);
      const ids = (data||[]).map(m=>m.id);
      loadChatReactionsForIds(ids).then(reactionRows=>{
        chatReactionsCache = buildReactionsCache(reactionRows);
        (data||[]).forEach(m=> updateMessageReactionsUI(m.id));
      });
    } else {
      // Previously this branch didn't exist, so any query error other than the missing
      // media_path/media_type columns (network drop, paused project, RLS, expired auth
      // session, ...) left the "در حال بارگذاری پیام‌ها..." placeholder on screen forever
      // with zero feedback. Surface it instead, so the chat doesn't look permanently stuck.
      console.error('Chat messages load error', error);
      const wrap = document.getElementById('chatMessages');
      if(wrap) wrap.innerHTML = `<div class="chat-empty-msg">خطا در بارگذاری پیام‌ها: ${escapeHtml(error.message || 'مشکل در اتصال')}<br>اتصال اینترنت/VPN رو چک کن و دوباره وارد این تب شو.</div>`;
    }
    loadGroupStreakBanner();
    loadChatPinned();
    subscribeChatReactions();
    if(!publicChatChannel){
      publicChatChannel = sb.channel('public:messages')
        .on('postgres_changes', {event:'INSERT', schema:'public', table:'messages'}, payload=>{
          if(isChatUserBlocked(payload.new.user_id)) return;
          const wrap = document.getElementById('chatMessages');
          // پیامی که خودمون همین الان optimistically رندرش کردیم (در sendPublicChatMessage)
          // و id موقتش با id واقعی سرور جایگزین شده، الان دوباره از realtime برمی‌گرده؛
          // اینجا جلوی رندر دوبرابری‌شو می‌گیریم.
          if(wrap.querySelector(`.chat-msg[data-msg-id="${payload.new.id}"]`)) return;
          const wasNearBottom = isChatListNearBottom();
          const isOwnMsg = publicChatUser && payload.new.user_id === publicChatUser.id;
          if(wrap.querySelector('.chat-empty-msg')) wrap.innerHTML = '';
          appendPublicChatMessage(payload.new);
          applyChatUserFilter();
          if(isOwnMsg || wasNearBottom){
            // Already at the bottom (or it's our own message going out): keep the classic
            // auto-scroll feel, exactly like before.
            scrollChatToBottom(false);
          } else {
            // User is reading up in the history — don't yank them down; just count it.
            chatUnseenCount++;
            updateChatScrollDownBadge();
            updateChatScrollDownBtn();
          }
          if(payload.new.user_id === GROUP_BOT_USER_ID && typeof payload.new.content === 'string' && payload.new.content.startsWith(GROUP_STREAK_MARKER)){
            loadGroupStreakBanner();
          }
        })
        .on('postgres_changes', {event:'DELETE', schema:'public', table:'messages'}, payload=>{
          // Keeps everyone's view in sync when a message is deleted from any device.
          const wrap = document.getElementById('chatMessages');
          const el = wrap.querySelector(`.chat-msg[data-msg-id="${payload.old.id}"]`);
          if(el){
            const group = el.closest('.cm-group');
            el.remove();
            if(group && !group.querySelector('.chat-msg')) group.remove();
          }
          if(!wrap.querySelector('.chat-msg')) wrap.innerHTML = '<div class="chat-empty-msg">هنوز پیامی نیست، اولین نفر باش!</div>';
        })
        .on('postgres_changes', {event:'UPDATE', schema:'public', table:'messages'}, payload=>{
          // Keeps everyone's view in sync when a message is edited from any device.
          const wrap = document.getElementById('chatMessages');
          const el = wrap.querySelector(`.chat-msg[data-msg-id="${payload.new.id}"]`);
          if(!el || el.dataset.editing === '1') return; // don't clobber an editor open right now on this device
          const parts = chatMsgContentParts(payload.new);
          const textEl = el.querySelector('.cm-text');
          if(textEl) textEl.innerHTML = parts.textHtml;
          el.dataset.raw = typeof payload.new.content === 'string' ? payload.new.content : '';
          const existingQuote = el.querySelector('.cm-reply-quote');
          if(existingQuote && parts.replyQuoteHtml) existingQuote.outerHTML = parts.replyQuoteHtml;
        }).subscribe();
    }
  }catch(err){ console.error('Chat load error', err); }
}
/* ---------------- Swipe-to-reply ---------------- */
let chatReplyTarget = null; // {id, username, text}
function showChatReplyPreview(){
  const box = document.getElementById('chatReplyPreview');
  if(!box || !chatReplyTarget) return;
  document.getElementById('chatReplyPreviewName').textContent = chatReplyTarget.username;
  document.getElementById('chatReplyPreviewText').textContent = chatReplyTarget.text;
  box.style.display = 'flex';
}
function clearChatReply(){
  chatReplyTarget = null;
  const box = document.getElementById('chatReplyPreview');
  if(box) box.style.display = 'none';
}
function startReplyTo(el){
  const id = el.dataset.msgId;
  const username = el.dataset.username || 'کاربر';
  const textEl = el.querySelector('.cm-text');
  const text = textEl ? textEl.textContent.trim().slice(0, 120) : '';
  if(!id || !text) return;
  chatReplyTarget = { id, username, text };
  showChatReplyPreview();
  document.getElementById('chatInput').focus();
}
const chatReplyPreviewCloseBtn = document.getElementById('chatReplyPreviewClose');
if(chatReplyPreviewCloseBtn) chatReplyPreviewCloseBtn.addEventListener('click', clearChatReply);
// Tapping the quoted snippet inside a reply jumps to (and briefly highlights) the original message.
document.getElementById('chatMessages').addEventListener('click', e=>{
  const q = e.target.closest('.cm-reply-quote');
  if(!q) return;
  const targetId = q.dataset.replyTargetId;
  const targetEl = document.querySelector(`.chat-msg[data-msg-id="${targetId}"]`);
  if(targetEl){
    targetEl.scrollIntoView({behavior:'smooth', block:'center'});
    targetEl.classList.add('flash');
    setTimeout(()=> targetEl.classList.remove('flash'), 900);
  }
});
// The ⭐ button on any GIF or silent-video-as-GIF bubble — including ones other people sent —
// saves it into this device's own "اخیرا استفاده‌شده" favorites list for quick reuse later.
document.getElementById('chatMessages').addEventListener('click', async e=>{
  const btn = e.target.closest('.cm-gif-save-btn');
  if(!btn) return;
  e.stopPropagation();
  const url = btn.dataset.saveUrl;
  const type = btn.dataset.saveType || 'gif';
  if(!url || btn.classList.contains('saved')) return;
  await addGifPickerRecent(url, url, type);
  btn.classList.add('saved');
  btn.textContent = '✓';
  showToast('به گیف‌های ذخیره‌شده اضافه شد ⭐');
});

/* ---------------- Pinch-to-zoom message size ----------------
   Two-finger pinch over the chat scales every bubble's text/padding/avatar/media size via the
   --chat-zoom CSS custom property (see the calc(...* var(--chat-zoom,1)) rules on .chat-msg,
   .cm-name, .cm-time, .cm-action, .cm-avatar, .cm-media and .cm-voice) — it only touches those
   specific sizes, never the scrollable #chatMessages container's own box, so scrolling/height
   stay exactly as before. Each person's chosen size is saved locally (window.storage, per
   device/user, not shared) and restored automatically next time they open the chat. */
(function(){
  const CHAT_ZOOM_MIN = 0.7, CHAT_ZOOM_MAX = 2.0;
  const CHAT_ZOOM_STORAGE_KEY = 'chatMsgZoom';
  const wrap = document.getElementById('chatMessages');
  if(!wrap) return;
  let pinchStartDist = 0;
  let pinchStartZoom = 1;
  let currentZoom = 1;
  let pinchActive = false;
  let hintHideTimer = null;

  function applyZoom(z){
    currentZoom = Math.min(CHAT_ZOOM_MAX, Math.max(CHAT_ZOOM_MIN, z));
    wrap.style.setProperty('--chat-zoom', currentZoom);
  }
  async function persistZoom(){
    try{ if(window.storage) await window.storage.set(CHAT_ZOOM_STORAGE_KEY, String(currentZoom), false); }catch(err){}
  }
  function showZoomHint(){
    let hint = document.getElementById('chatZoomHint');
    if(!hint){
      hint = document.createElement('div');
      hint.id = 'chatZoomHint';
      hint.className = 'chat-zoom-hint';
      wrap.appendChild(hint);
    }
    hint.textContent = toFa(Math.round(currentZoom * 100)) + '٪';
    hint.classList.add('show');
    clearTimeout(hintHideTimer);
    hintHideTimer = setTimeout(()=> hint.classList.remove('show'), 700);
  }
  function touchDist(t1, t2){
    return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  }
  wrap.addEventListener('touchstart', (e)=>{
    if(e.touches.length === 2){
      pinchActive = true;
      pinchStartDist = touchDist(e.touches[0], e.touches[1]);
      pinchStartZoom = currentZoom;
    }
  }, { passive:true });
  wrap.addEventListener('touchmove', (e)=>{
    if(!pinchActive || e.touches.length !== 2) return;
    e.preventDefault(); // stop the browser's own page-zoom from fighting our gesture
    if(pinchStartDist <= 0) return;
    const ratio = touchDist(e.touches[0], e.touches[1]) / pinchStartDist;
    applyZoom(pinchStartZoom * ratio);
    showZoomHint();
  }, { passive:false });
  function endPinch(){
    if(!pinchActive) return;
    pinchActive = false;
    pinchStartDist = 0;
    persistZoom();
  }
  wrap.addEventListener('touchend', endPinch);
  wrap.addEventListener('touchcancel', endPinch);

  // Restore this person's saved size as soon as the chat opens.
  (async function(){
    try{
      const res = window.storage ? await window.storage.get(CHAT_ZOOM_STORAGE_KEY, false) : null;
      const saved = res && res.value ? parseFloat(res.value) : NaN;
      if(!isNaN(saved)) applyZoom(saved);
    }catch(err){}
  })();
})();

(function(){
  const SWIPE_TRIGGER = 46;
  const SWIPE_MAX = 60;
  const wrap = document.getElementById('chatMessages');
  let cur = null;
  function findMsgEl(target){
    const el = target.closest ? target.closest('.chat-msg') : null;
    if(!el || el.dataset.bot === '1') return null;
    return el;
  }
  function ensureHint(el){
    let hint = el.querySelector('.cm-reply-hint');
    if(!hint){
      hint = document.createElement('span');
      hint.className = 'cm-reply-hint';
      hint.textContent = '↩';
      el.appendChild(hint);
    }
    return hint;
  }
  function resetEl(){
    if(!cur) return;
    cur.el.classList.remove('swiping');
    cur.el.style.transform = '';
    cur.hint.style.opacity = 0;
    cur.hint.style.transform = 'translateY(-50%) scale(.5)';
    cur.hint.classList.remove('ready');
  }
  function onStart(x, y, target){
    if(target.closest && target.closest('.cm-action, .cm-reply-quote')) return;
    const el = findMsgEl(target);
    if(!el) return;
    cur = { el, hint: ensureHint(el), startX: x, startY: y, dx: 0, active: false };
  }
  function onMove(x, y){
    if(!cur) return false;
    const dx = x - cur.startX, dy = y - cur.startY;
    if(!cur.active){
      if(Math.abs(dx) < 8 && Math.abs(dy) < 8) return false;
      if(Math.abs(dy) > Math.abs(dx)){ cur = null; return false; }
      cur.active = true;
      cur.el.classList.add('swiping');
    }
    if(dx <= 0){
      cur.dx = 0; cur.el.style.transform = ''; cur.hint.style.opacity = 0; cur.hint.classList.remove('ready');
      return true;
    }
    const capped = Math.min(dx, SWIPE_MAX);
    cur.dx = dx;
    cur.el.style.transform = `translateX(${capped}px)`;
    const p = Math.min(1, capped / SWIPE_TRIGGER);
    cur.hint.style.opacity = p;
    cur.hint.style.transform = `translateY(-50%) scale(${0.5 + p*0.5})`;
    cur.hint.classList.toggle('ready', dx >= SWIPE_TRIGGER);
    return true;
  }
  function onEnd(){
    if(!cur) return;
    const { el, dx, active } = cur;
    resetEl();
    if(active && dx >= SWIPE_TRIGGER) startReplyTo(el);
    cur = null;
  }
  wrap.addEventListener('touchstart', e=>{
    const t = e.touches[0];
    onStart(t.clientX, t.clientY, e.target);
  }, {passive:true});
  wrap.addEventListener('touchmove', e=>{
    if(!cur) return;
    const t = e.touches[0];
    if(onMove(t.clientX, t.clientY) && cur && cur.active) e.preventDefault();
  }, {passive:false});
  wrap.addEventListener('touchend', onEnd);
  wrap.addEventListener('touchcancel', onEnd);
  // Mouse support so the gesture also works when previewing on desktop.
  let mouseDown = false;
  wrap.addEventListener('mousedown', e=>{ mouseDown = true; onStart(e.clientX, e.clientY, e.target); });
  window.addEventListener('mousemove', e=>{ if(mouseDown) onMove(e.clientX, e.clientY); });
  window.addEventListener('mouseup', ()=>{ if(mouseDown){ mouseDown = false; onEnd(); } });
})();

/* ---------------- Long-press a message (or its name) → small action menu ----------------
   Telegram-style: hold on a bubble to open a menu with actions for that message/sender. */
let chatFilterUserId = null;
let chatFilterUsername = '';
function applyChatUserFilter(){
  const wrap = document.getElementById('chatMessages');
  if(!wrap) return;
  wrap.querySelectorAll('.chat-msg').forEach(el=>{
    const match = !chatFilterUserId || el.dataset.userId === chatFilterUserId;
    el.classList.toggle('cm-filtered-out', !match);
  });
  // Every bubble inside one .cm-group shares the same sender, so a group is only ever
  // fully shown or fully hidden — never a partial mix.
  wrap.querySelectorAll('.cm-group').forEach(g=>{
    g.classList.toggle('cm-filtered-out', !g.querySelector('.chat-msg:not(.cm-filtered-out)'));
  });
}
function setChatUserFilter(userId, username){
  if(!userId) return;
  chatFilterUserId = userId;
  chatFilterUsername = username || 'کاربر';
  const banner = document.getElementById('chatUserFilterBanner');
  const nameEl = document.getElementById('chatUserFilterName');
  if(nameEl) nameEl.textContent = chatFilterUsername;
  if(banner) banner.classList.add('show');
  applyChatUserFilter();
}
function clearChatUserFilter(){
  chatFilterUserId = null;
  chatFilterUsername = '';
  const banner = document.getElementById('chatUserFilterBanner');
  if(banner) banner.classList.remove('show');
  applyChatUserFilter();
}
const chatUserFilterClearBtn = document.getElementById('chatUserFilterClearBtn');
if(chatUserFilterClearBtn) chatUserFilterClearBtn.addEventListener('click', clearChatUserFilter);

/* ---- floating action menu shown after a long-press ---- */
let cmActionMenuTargetEl = null;
function closeChatMsgMenu(){
  const menu = document.getElementById('cmActionMenu');
  const backdrop = document.getElementById('cmActionMenuBackdrop');
  if(menu) menu.classList.remove('show');
  if(backdrop) backdrop.classList.remove('show');
  cmActionMenuTargetEl = null;
}
function openChatMsgMenu(el){
  const menu = document.getElementById('cmActionMenu');
  const backdrop = document.getElementById('cmActionMenuBackdrop');
  if(!menu || !backdrop || !el) return;
  cmActionMenuTargetEl = el;
  const username = el.dataset.username || 'کاربر';
  const msgId = el.dataset.msgId;
  const isPinned = chatPinnedMsgs.some(m => m.id === String(msgId));
  const own = publicChatUser && el.dataset.userId === publicChatUser.id;
  // Editing is only offered for the sender's own plain messages — not daily-report cards,
  // which are structured/generated content rather than free text.
  const canEdit = own && el.dataset.report !== '1';
  let html = `<button type="button" data-act="copy">${ci('copy')} کپی متن پیام${(storeData.premium || isInTrial()) ? '' : ' '+ci('lock')}</button>`;
  html += `<button type="button" data-act="filter">${ci('search')} فقط پیام‌های ${escapeHtml(username)}</button>`;
  if(canEdit) html += `<button type="button" data-act="edit">${ci('edit')} ویرایش پیام</button>`;
  if(isChatAdmin){
    html += isPinned
      ? `<button type="button" data-act="unpin">${ci('pin')} برداشتن پین</button>`
      : `<button type="button" data-act="pin">${ci('pin')} پین کردن این پیام</button>`;
  }
  // Delete/report/block/suspend — moved here from the always-visible bottom row of the
  // bubble, so the bubble itself stays clean. Same permission rules as before:
  // sender can delete their own message; the app owner can delete/block/suspend anyone;
  // everyone else can report + block.
  if(own){
    html += `<button type="button" class="cm-menu-danger" data-act="delete">${ci('trash')} حذف پیام</button>`;
  } else if(isChatAdmin){
    html += `<button type="button" class="cm-menu-danger" data-act="delete">${ci('trash')} حذف پیام (مدیریت)</button>`;
    html += `<button type="button" class="cm-menu-danger" data-act="block">${ci('block')} مسدود کردن ${escapeHtml(username)}</button>`;
    // Suspend/mute still go through the separate secret-token worker flow, so they stay
    // owner-only even for chat-admins (see suspendChatUser/muteChatUser notes above).
    if(isAppOwner){
      html += `<button type="button" class="cm-menu-danger" data-act="mute">${ci('mute')} سکوت ${escapeHtml(username)}</button>`;
      html += `<button type="button" class="cm-menu-danger" data-act="suspend">${ci('hourglass')} تعلیق ${escapeHtml(username)}</button>`;
    }
  } else {
    html += `<button type="button" data-act="report">${ci('flag')} گزارش پیام</button>`;
    html += `<button type="button" class="cm-menu-danger" data-act="block">${ci('block')} مسدود کردن ${escapeHtml(username)}</button>`;
  }
  menu.innerHTML = html;
  const rect = el.getBoundingClientRect();
  backdrop.classList.add('show');
  menu.classList.add('show');
  menu.style.top = '-9999px';
  menu.style.left = '10px';
  requestAnimationFrame(()=>{
    const menuRect = menu.getBoundingClientRect();
    let left = rect.left + rect.width/2 - menuRect.width/2;
    left = Math.max(10, Math.min(left, window.innerWidth - menuRect.width - 10));
    let top = rect.top - menuRect.height - 8;
    if(top < 8) top = Math.min(rect.bottom + 8, window.innerHeight - menuRect.height - 8);
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
  });
}
const cmActionMenu = document.getElementById('cmActionMenu');
if(cmActionMenu) cmActionMenu.addEventListener('click', e=>{
  const btn = e.target.closest('button[data-act]');
  if(!btn || !cmActionMenuTargetEl) { closeChatMsgMenu(); return; }
  const el = cmActionMenuTargetEl;
  const msgId = el.dataset.msgId;
  const userId = el.dataset.userId;
  const username = el.dataset.username;
  if(btn.dataset.act === 'copy'){ if(requirePremium()) copyChatMessageText(el); }
  else if(btn.dataset.act === 'edit') startEditChatMessage(el);
  else if(btn.dataset.act === 'filter') setChatUserFilter(userId, username);
  else if(btn.dataset.act === 'pin') pinChatMessage(el);
  else if(btn.dataset.act === 'unpin') unpinChatMessage(msgId);
  else if(btn.dataset.act === 'delete') deletePublicChatMessage(msgId);
  else if(btn.dataset.act === 'report') reportPublicChatMessage(msgId);
  else if(btn.dataset.act === 'block') blockChatUser(userId, username);
  else if(btn.dataset.act === 'suspend') suspendChatUser(userId, username);
  else if(btn.dataset.act === 'mute') muteChatUser(userId, username);
  closeChatMsgMenu();
});

/* ---- Copy message text: plain clipboard copy of the bubble's visible text ---- */
async function copyChatMessageText(el){
  const textEl = el && el.querySelector('.cm-text');
  const text = textEl ? textEl.innerText : '';
  if(!text){ showToast('متنی برای کپی نیست', 'error'); return; }
  try{
    await navigator.clipboard.writeText(text);
    showToast('متن پیام کپی شد');
  }catch(err){
    // Fallback for embedded webviews / older browsers without Clipboard API permission.
    try{
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('متن پیام کپی شد');
    }catch(err2){ showToast('کپی انجام نشد', 'error'); }
  }
}

/* ---- Edit own message: swaps the bubble's text for an inline textarea ---- */
function chatMsgEditableText(rawContent){
  // Strips the reply-marker prefix (if any) down to just the free text a person actually
  // typed, so editing only touches their words and keeps the reply context intact.
  if(typeof rawContent === 'string' && rawContent.startsWith(REPLY_MARKER)){
    const parsed = parseReplyMsg(rawContent);
    if(parsed) return { prefix: rawContent.slice(0, rawContent.length - parsed.text.length), text: parsed.text };
  }
  return { prefix: '', text: rawContent || '' };
}
function startEditChatMessage(el){
  if(!el || el.dataset.editing === '1') return;
  const textEl = el.querySelector('.cm-text');
  if(!textEl) return;
  const { prefix, text } = chatMsgEditableText(el.dataset.raw || '');
  el.dataset.editing = '1';
  el.dataset.editPrefix = prefix;
  textEl.outerHTML = `<div class="cm-edit-box">
      <textarea class="cm-edit-textarea">${escapeHtml(text)}</textarea>
      <div class="cm-edit-actions">
        <button type="button" class="cm-edit-cancel">انصراف</button>
        <button type="button" class="cm-edit-save">ذخیره</button>
      </div>
    </div>`;
  const ta = el.querySelector('.cm-edit-textarea');
  if(ta){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
}
function cancelEditChatMessage(el){
  const editBox = el && el.querySelector('.cm-edit-box');
  if(!editBox) return;
  const { text } = chatMsgEditableText(el.dataset.raw || '');
  editBox.outerHTML = `<div class="cm-text">${escapeHtml(text)}</div>`;
  delete el.dataset.editing;
  delete el.dataset.editPrefix;
}
async function saveEditChatMessage(el){
  if(!sb || !publicChatUser || !el) return;
  const ta = el.querySelector('.cm-edit-textarea');
  if(!ta) return;
  const newText = ta.value.trim();
  if(!newText){ showToast('متن نمی‌تونه خالی باشه', 'error'); return; }
  const finalContent = (el.dataset.editPrefix || '') + newText;
  if(finalContent === el.dataset.raw){ cancelEditChatMessage(el); return; }
  const msgId = el.dataset.msgId;
  try{
    // RLS on `messages` restricts updates to the row's own user_id — the .eq below is
    // just the client-side mirror of that, same pattern as deletePublicChatMessage.
    const { error } = await sb.from('messages').update({ content: finalContent }).eq('id', msgId).eq('user_id', publicChatUser.id);
    if(error){ showToast('ویرایش ذخیره نشد', 'error'); return; }
    el.dataset.raw = finalContent;
    const editBox = el.querySelector('.cm-edit-box');
    if(editBox) editBox.outerHTML = `<div class="cm-text">${escapeHtml(newText)}</div>`;
    delete el.dataset.editing;
    delete el.dataset.editPrefix;
    showToast('پیام ویرایش شد');
  }catch(err){ showToast('ویرایش ذخیره نشد', 'error'); }
}
const cmActionMenuBackdrop = document.getElementById('cmActionMenuBackdrop');
if(cmActionMenuBackdrop){
  cmActionMenuBackdrop.addEventListener('click', closeChatMsgMenu);
  cmActionMenuBackdrop.addEventListener('touchstart', closeChatMsgMenu, {passive:true});
}

(function(){
  const LONG_PRESS_MS = 480;
  const MOVE_CANCEL = 10;
  const wrap = document.getElementById('chatMessages');
  let timer = null, startX = 0, startY = 0, pressEl = null, fired = false;

  function clearTimer(){ if(timer){ clearTimeout(timer); timer = null; } }
  function cancel(){
    clearTimer();
    pressEl = null;
  }
  function begin(x, y, rawTarget){
    if(rawTarget.closest && rawTarget.closest('.cm-action, .cm-reply-quote, .cm-edit-box, .cm-reaction-pill, .cm-reaction-bar')) return;
    const el = rawTarget.closest ? rawTarget.closest('.chat-msg') : null;
    if(!el || el.dataset.bot === '1' || !el.dataset.userId || el.dataset.editing === '1') return;
    pressEl = el; startX = x; startY = y; fired = false;
    clearTimer();
    timer = setTimeout(()=>{
      fired = true;
      el.classList.add('long-press-active');
      if(navigator.vibrate) navigator.vibrate(15);
      openChatMsgMenu(el);
      setTimeout(()=> el.classList.remove('long-press-active'), 260);
    }, LONG_PRESS_MS);
  }
  function move(x, y){
    if(!pressEl || fired) return;
    if(Math.abs(x-startX) > MOVE_CANCEL || Math.abs(y-startY) > MOVE_CANCEL) cancel();
  }
  // A tap that releases before the long-press timer fires (and didn't move enough to be
  // cancelled) is a plain tap on the bubble — that's what opens the reaction picker,
  // Telegram-style, distinct from the hold-to-open action menu above.
  function end(){
    clearTimer();
    if(pressEl && !fired) openChatReactionBar(pressEl);
    pressEl = null;
  }

  wrap.addEventListener('touchstart', e=>{
    const t = e.touches[0];
    begin(t.clientX, t.clientY, e.target);
  }, {passive:true});
  wrap.addEventListener('touchmove', e=>{
    const t = e.touches[0];
    move(t.clientX, t.clientY);
  }, {passive:true});
  wrap.addEventListener('touchend', end);
  wrap.addEventListener('touchcancel', cancel);
  // Mouse support so the gesture also works when previewing on desktop.
  let mouseDown2 = false;
  wrap.addEventListener('mousedown', e=>{ mouseDown2 = true; begin(e.clientX, e.clientY, e.target); });
  window.addEventListener('mousemove', e=>{ if(mouseDown2) move(e.clientX, e.clientY); });
  window.addEventListener('mouseup', ()=>{ if(mouseDown2){ mouseDown2 = false; end(); } });
})();

/* ---------------- Nightly "work report" window (20:00–24:00) ---------------- */
// From 8pm to midnight, the public chat switches into a dedicated task-report
// mode: only the app owner can send regular messages, everyone else can only
// send their daily task report. Outside that window it's normal chat for
// everyone and the report button is fully disabled.
const REPORT_MODE_START_HOUR = 20; // 8pm
const REPORT_MODE_END_HOUR = 24;   // midnight
function isReportModeActive(){
  const h = new Date().getHours();
  return h >= REPORT_MODE_START_HOUR && h < REPORT_MODE_END_HOUR;
}
function updateChatModeUI(){
  const panel = document.getElementById('chatPanelSection');
  const banner = document.getElementById('chatReportModeBanner');
  const muteBanner = document.getElementById('chatMuteBanner');
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSendBtn');
  const attachBtn = document.getElementById('chatAttachBtn');
  const active = isReportModeActive();
  const muted = isCurrentlyMuted(); // sees the whole chat fine — only the composer locks
  if(panel) panel.classList.toggle('report-mode-active', active);
  const reportRestricted = active && !isAppOwner;
  const restricted = reportRestricted || muted;
  if(input){
    input.disabled = restricted;
    input.placeholder = muted ? 'فعلاً ساکتی، نمی‌تونی پیام بفرستی...' : (reportRestricted ? 'الان فقط گزارش کار قابل ارساله...' : 'پیامتو بنویس...');
  }
  if(sendBtn) sendBtn.disabled = restricted;
  if(attachBtn) attachBtn.disabled = muted;
  if(banner){
    if(active){
      banner.textContent = isAppOwner
        ? '⏰ حالت گزارش کار فعاله — فقط تو می‌تونی همچنان پیام عادی بفرستی، بقیه فقط گزارش کار می‌فرستن.'
        : '⏰ از الان تا نیمه‌شب فقط می‌تونی گزارش تسک‌های امروزتو بفرستی؛ ارسال پیام عادی موقتاً بسته‌ست.';
      banner.classList.add('show');
    } else {
      banner.classList.remove('show');
    }
  }
  if(muteBanner){
    if(muted){
      muteBanner.textContent = muteRemainingText();
      muteBanner.classList.add('show');
    } else {
      muteBanner.classList.remove('show');
    }
  }
  updateReportBtnState();
}
setInterval(updateChatModeUI, 30000);

/* ================= Chat-rules suspensions (public chat + مشاور شخصی) =================
   Applied by the owner (see suspendChatUser below) and enforced for real, server-side, by
   a Supabase RLS policy on the `messages` table (a suspended/banned user's INSERT is
   rejected regardless of what this client does) — see the SQL notes shipped alongside
   this file. This client-side layer is what actually LOCKS the UI for the affected user:
   it hides the public-chat composer and the مشاور شخصی feature sections and shows a
   countdown instead, on whichever stage of the ladder they're currently on:
     مرحله ۱: ۱ روز | مرحله ۲: ۳ روز | مرحله ۳: ۷ روز | مرحله ۴: ۳۰ روز | مرحله ۵: دائم
========================================================================================= */
function isCurrentlySuspended(){
  if(mySuspendedPermanently) return true;
  if(mySuspendedUntil && mySuspendedUntil.getTime() > Date.now()) return true;
  return false;
}
function suspensionRemainingText(){
  if(mySuspendedPermanently){
    return 'به‌خاطر رعایت‌نشدن مکرر قوانین چت، حساب تو به‌طور دائم از بخش عمومی و مشاور شخصی محروم شده.';
  }
  if(!mySuspendedUntil) return '';
  const ms = mySuspendedUntil.getTime() - Date.now();
  if(ms <= 0) return '';
  const totalMinutes = Math.ceil(ms/60000);
  const days = Math.floor(totalMinutes/1440);
  const hours = Math.floor((totalMinutes%1440)/60);
  const minutes = totalMinutes%60;
  const parts = [];
  if(days>0) parts.push(toFa(days)+' روز');
  if(hours>0) parts.push(toFa(hours)+' ساعت');
  if(days===0 && minutes>0) parts.push(toFa(minutes)+' دقیقه');
  const left = parts.join(' و ') || 'کمتر از یک دقیقه';
  const stageTxt = mySuspensionStage>0 ? ` (مرحله ${toFa(mySuspensionStage)} از قوانین چت)` : '';
  return `به‌خاطر رعایت‌نشدن قوانین چت، دسترسیت به بخش عمومی و مشاور شخصی موقتاً بسته شده${stageTxt}. ${left} دیگه تا باز شدن مونده.`;
}
function renderSuspensionLocks(){
  const active = !!(publicChatUser && isCurrentlySuspended());
  const msg = suspensionRemainingText();
  const chatSuspBox = document.getElementById('chatSuspendedBox');
  const chatInBox = document.getElementById('chatLoggedInBox');
  const chatText = document.getElementById('chatSuspendedText');
  const aiTab = document.getElementById('tab-ai');
  const aiSuspBox = document.getElementById('aiSuspendedBox');
  const aiText = document.getElementById('aiSuspendedText');
  if(chatText) chatText.textContent = msg;
  if(aiText) aiText.textContent = msg;
  if(chatSuspBox) chatSuspBox.style.display = active ? 'block' : 'none';
  if(chatInBox && publicChatUser) chatInBox.style.display = active ? 'none' : 'block';
  if(aiSuspBox) aiSuspBox.style.display = active ? 'block' : 'none';
  if(aiTab) aiTab.classList.toggle('ai-suspended', active);
}
// Re-checks every 30s so a suspension that just expired unlocks the UI on its own,
// without needing the person to log out/in or reload the app.
setInterval(renderSuspensionLocks, 30000);

/* ================= Chat mute (public chat + مشاور شخصی composer only) =================
   Lighter than a suspension: applied by the owner for any custom number of minutes (see
   muteChatUser below) instead of the fixed suspension ladder. The muted person keeps full
   read access — they still see every message come in — only sendPublicChatMessage /
   sendPublicChatMedia / voice notes / task reports are blocked while it's active, both by
   this client-side UI lock and, for real, by a Supabase RLS policy on `messages` INSERT
   (see the SQL notes shipped alongside this file). ========================================= */
function isCurrentlyMuted(){
  return !!(myMutedUntil && myMutedUntil.getTime() > Date.now());
}
function muteRemainingText(){
  if(!myMutedUntil) return '';
  const ms = myMutedUntil.getTime() - Date.now();
  if(ms <= 0) return '';
  const totalMinutes = Math.ceil(ms/60000);
  const hours = Math.floor(totalMinutes/60);
  const minutes = totalMinutes%60;
  const parts = [];
  if(hours>0) parts.push(toFa(hours)+' ساعت');
  if(minutes>0) parts.push(toFa(minutes)+' دقیقه');
  const left = parts.join(' و ') || 'کمتر از یک دقیقه';
  return `🔇 فعلاً ساکتت کرده‌ن — چت رو می‌بینی ولی نمی‌تونی پیام یا مدیا بفرستی. ${left} دیگه تا باز شدن مونده.`;
}

/* ---- Owner-only: designate (or remove) a chat-admin, with a custom displayed title ----
   Only mahdihd648@gmail.com can do this — enforced again server-side inside the
   set_chat_admin_by_email() RPC itself (see chat-admin-supabase-schema.sql), so this
   client-side isAppOwner check is just what shows/hides the button, not the real gate.
   A granted admin gets the same delete/pin moderation power as the owner (see isChatAdmin
   above) and a badge with the title given here instead of "مالک" — but only on messages
   they send AFTER being granted; it's stamped at insert time, not backfilled onto old ones. */
async function grantOrRevokeChatAdmin(email, makeAdmin, title){
  if(!sb || !isAppOwner) return;
  try{
    const { error } = await sb.rpc('set_chat_admin_by_email', { target_email: email, make_admin: makeAdmin, title: title || null });
    if(error){ alert('خطا: ' + error.message); return; }
    showToast(makeAdmin ? `${email} ادمین چت شد ✅ (از پیام بعدیش لقبش نشون داده می‌شه)` : `ادمین‌بودن ${email} حذف شد ✅`);
  }catch(err){ alert('مشکل در اتصال به سرور'); }
}
function openChatAdminManager(){
  if(!isAppOwner) return;
  const choice = prompt('چیکار می‌خوای بکنی؟\n۱) ادمین کردن یه کاربر (با لقب دلخواه)\n۲) حذف ادمین از یه کاربر\n\nعدد ۱ یا ۲ رو وارد کن:', '1');
  if(!choice) return;
  const c = choice.trim();
  if(c === '1' || c === '۱'){
    const email = prompt('ایمیل کاربری که می‌خوای ادمین چت کنی:');
    if(!email || !email.trim()) return;
    const title = prompt('لقبی که به‌جای «مالک» کنار پیام‌هاش نمایش داده بشه (مثلاً: مدیر، ناظر):');
    if(!title || !title.trim()){ showToast('لقب رو وارد نکردی', 'error'); return; }
    grantOrRevokeChatAdmin(email.trim(), true, title.trim());
  } else if(c === '2' || c === '۲'){
    const email = prompt('ایمیل کاربری که می‌خوای ادمین‌بودنش رو حذف کنی:');
    if(!email || !email.trim()) return;
    grantOrRevokeChatAdmin(email.trim(), false, null);
  }
}
const chatAdminManageBtn = document.getElementById('chatAdminManageBtn');
if(chatAdminManageBtn) chatAdminManageBtn.addEventListener('click', openChatAdminManager);

/* ---- Owner-only: apply the next suspension stage to a user, and lift one manually ---- */
function promptAdminToken(){ return prompt('رمز مدیریت:'); }
async function suspendChatUser(userId, username){
  if(!isAppOwner) return;
  if(publicChatUser && userId === publicChatUser.id){ showToast('نمی‌تونی خودتو تعلیق کنی', 'error'); return; }
  if(!confirm(`${username} به‌خاطر رعایت‌نشدن قوانین چت تعلیق بشه؟\nمدتش خودکار محاسبه می‌شه: هر تخلف جدید یه پله رو نردبان قوانین چت جلو می‌ره (۱ روز ← ۳ روز ← ۷ روز ← ۳۰ روز ← محرومیت دائم).`)) return;
  const token = promptAdminToken();
  if(!token) return;
  try{
    const res = await fetch(WORKER_BASE + '/admin/suspend', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ token, user_id: userId })
    });
    const data = await res.json();
    if(data.ok){
      const durText = data.permanent
        ? 'به‌طور دائم از بخش عمومی و مشاور شخصی محروم شد'
        : `به مدت ${toFa(data.days)} روز از بخش عمومی و مشاور شخصی تعلیق شد (مرحله ${toFa(data.stage)})`;
      alert(`${username} ${durText} ✅`);
      showToast('تعلیق ثبت شد');
    } else {
      alert('خطا: ' + (data.error || 'نامشخص'));
    }
  }catch(err){ alert('مشکل در اتصال به سرور'); }
}
async function unsuspendChatUserByEmail(){
  if(!isAppOwner) return;
  const email = prompt('ایمیل کاربری که می‌خوای تعلیقش رو لغو کنی:');
  if(!email) return;
  const token = promptAdminToken();
  if(!token) return;
  try{
    const res = await fetch(WORKER_BASE + '/admin/unsuspend', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ token, email: email.trim() })
    });
    const data = await res.json();
    if(data.ok) alert('تعلیق ' + email + ' لغو شد ✅');
    else alert('خطا: ' + (data.error || 'نامشخص'));
  }catch(err){ alert('مشکل در اتصال به سرور'); }
}

/* ---- Owner-only: mute a user for however many minutes you type in, and lift a mute early.
   Unlike suspend there's no fixed ladder/stage — every mute is a fresh custom duration, and
   the person keeps full read access to the chat the whole time (see isCurrentlyMuted above). */
async function muteChatUser(userId, username){
  if(!isAppOwner) return;
  if(publicChatUser && userId === publicChatUser.id){ showToast('نمی‌تونی خودتو ساکت کنی', 'error'); return; }
  const minutesStr = prompt(`${username} رو چند دقیقه ساکت کنیم؟\n(فقط ارسال پیام/مدیا/گزارش کار بسته می‌شه؛ خودش هنوز چت رو می‌بینه)`, '10');
  if(!minutesStr) return;
  const minutes = parseInt(minutesStr.trim(), 10);
  if(!minutes || minutes <= 0){ showToast('عدد دقیقه‌ی معتبر وارد نکردی', 'error'); return; }
  const token = promptAdminToken();
  if(!token) return;
  try{
    const res = await fetch(WORKER_BASE + '/admin/mute', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ token, user_id: userId, minutes })
    });
    const data = await res.json();
    if(data.ok){
      alert(`${username} به مدت ${toFa(minutes)} دقیقه ساکت شد ✅`);
      showToast('سکوت ثبت شد');
    } else {
      alert('خطا: ' + (data.error || 'نامشخص'));
    }
  }catch(err){ alert('مشکل در اتصال به سرور'); }
}
async function unmuteChatUserByEmail(){
  if(!isAppOwner) return;
  const email = prompt('ایمیل کاربری که می‌خوای سکوتش رو زودتر لغو کنی:');
  if(!email) return;
  const token = promptAdminToken();
  if(!token) return;
  try{
    const res = await fetch(WORKER_BASE + '/admin/unmute', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ token, email: email.trim() })
    });
    const data = await res.json();
    if(data.ok) alert('سکوت ' + email + ' لغو شد ✅');
    else alert('خطا: ' + (data.error || 'نامشخص'));
  }catch(err){ alert('مشکل در اتصال به سرور'); }
}
document.getElementById('chatSuspendedLogoutBtn').addEventListener('click', async ()=>{
  if(!sb) return;
  await sb.auth.signOut();
  showToast('خارج شدی');
});

/* ---------------- Chat media (GIF/image/video uploads) ----------------
   Files live in the 'chat-media' Storage bucket, one subfolder per user id (so RLS can
   restrict uploads to "your own folder" without a lookup). Only the *path* is stored on
   the messages row (media_path/media_type) — the public URL is rebuilt on render via
   getPublicUrl(), so nothing breaks if the project URL ever changes. Requires
   chat-media-supabase-schema.sql to have been run (adds the columns + bucket + daily
   purge cron); if it hasn't, sends fail with a clear toast instead of silently no-oping.
   Videos are capped higher than images/gifs since clips are naturally heavier — make sure
   the bucket's file_size_limit and allowed_mime_types in that same SQL migration are raised
   to match CHAT_MEDIA_MAX_BYTES_VIDEO / CHAT_MEDIA_ALLOWED_TYPES, or uploads will pass this
   client check and still get rejected by Storage. */
const CHAT_MEDIA_BUCKET = 'chat-media';
const CHAT_MEDIA_MAX_BYTES_IMAGE = 5 * 1024 * 1024;  // keep in sync with the bucket's file_size_limit in the SQL migration
const CHAT_MEDIA_MAX_BYTES_VIDEO = 25 * 1024 * 1024; // ditto — videos need more headroom than a still image/gif
const CHAT_MEDIA_ALLOWED_TYPES = ['image/gif','image/png','image/jpeg','image/webp','video/mp4','video/webm','video/quicktime'];
function isVideoFile(file){ return file.type.indexOf('video/') === 0; }
/* ---------------- Silent-video → "GIF" detection (مثل تلگرام) ----------------
   Telegram sends a video with no audio track as a looping, muted, control-less clip that
   behaves like a GIF instead of a normal video player. There's no reliable, synchronous way
   to check "does this file have an audio track" from the File object alone — it has to be
   loaded into a real <video> element first. None of the signals below (mozHasAudio,
   webkitAudioDecodedByteCount, the standard audioTracks list) are supported in every browser,
   so this checks all three and quietly falls back to treating the clip as a normal video
   (safer than silently muting something that did have sound) if none of them are available
   or loading fails. */
function detectVideoHasAudio(file){
  return new Promise((resolve)=>{
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    video.playsInline = true;
    const objUrl = URL.createObjectURL(file);
    let settled = false;
    const finish = (hasAudio)=>{
      if(settled) return;
      settled = true;
      video.pause();
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objUrl);
      resolve(hasAudio);
    };
    const checkSignals = ()=>{
      if(typeof video.mozHasAudio === 'boolean') return video.mozHasAudio;
      if(typeof video.webkitAudioDecodedByteCount === 'number') return video.webkitAudioDecodedByteCount > 0;
      if(video.audioTracks) return video.audioTracks.length > 0;
      return null; // no signal supported in this browser — caller decides the fallback
    };
    video.addEventListener('loadedmetadata', ()=>{
      // webkitAudioDecodedByteCount only populates once some audio has actually been
      // decoded, so give it a brief muted play before reading the signals.
      video.play().catch(()=>{});
      setTimeout(()=>{
        const signal = checkSignals();
        finish(signal === null ? true : signal); // unknown → assume it has audio (safer default)
      }, 250);
    }, { once:true });
    video.addEventListener('error', ()=> finish(true), { once:true }); // can't inspect it → don't guess
    video.src = objUrl;
  });
}
function chatMediaMaxBytesFor(file){ return isVideoFile(file) ? CHAT_MEDIA_MAX_BYTES_VIDEO : CHAT_MEDIA_MAX_BYTES_IMAGE; }
function chatMediaPublicUrl(path){
  if(!path || !sb) return '';
  try{ return sb.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl; }catch(err){ return ''; }
}
const FREE_CHAT_DAILY_LIMIT = 10;
function getFreeChatMsgCountToday(){
  const rec = storeData.chatDailyCount;
  if(!rec || rec.date !== todayKeyLocal()) return 0;
  return rec.count || 0;
}
function registerFreeChatMsgSent(){
  storeData.chatDailyCount = { date: todayKeyLocal(), count: getFreeChatMsgCountToday() + 1 };
  saveData();
}
async function sendPublicChatMessage(){
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if(!text || !publicChatUser) return;
  if(isCurrentlySuspended()){
    showToast('دسترسیت به چت عمومی موقتاً بسته‌ست', 'error');
    renderSuspensionLocks();
    return;
  }
  if(isCurrentlyMuted()){
    showToast('فعلاً ساکتت کرده‌ن — نمی‌تونی پیام بفرستی', 'error');
    updateChatModeUI();
    return;
  }
  if(!(storeData.premium || isInTrial()) && getFreeChatMsgCountToday() >= FREE_CHAT_DAILY_LIMIT){
    showToast(`تو نسخه‌ی رایگان روزی فقط ${toFa(FREE_CHAT_DAILY_LIMIT)} پیام می‌تونی بفرستی`, 'error');
    openPremiumOverlay();
    return;
  }
  if(isReportModeActive() && !isAppOwner){
    showToast('الان فقط ارسال گزارش کار امکان‌پذیره 📋', 'error');
    updateChatModeUI();
    return;
  }
  if(checkCrisisText(text)){
    input.value = '';
    autoGrowChatBox(input);
    renderCrisisBanner('publicChatCrisisSlot');
    showToast('این چت عمومیه؛ به‌جاش این پیام رو برات آوردیم 🤍');
    return;
  }
  if(containsAbusiveLanguage(text)){
    showToast('لطفاً محترمانه بنویس 🙏', 'error');
    return;
  }
  const finalText = chatReplyTarget
    ? (REPLY_MARKER + chatReplyTarget.id + '|' + encodeURIComponent(chatReplyTarget.username) + '|' + encodeURIComponent(chatReplyTarget.text) + '|' + text)
    : text;
  input.value = '';
  autoGrowChatBox(input);
  clearChatReply();
  const streakVal = (typeof computeStreak === 'function') ? computeStreak() : 0;
  const isPremiumNow = !!(storeData.premium || isInTrial());

  // --- رندر فوری (optimistic): قبلاً پیام فقط وقتی روی صفحه ظاهر می‌شد که هم
  // insert روی سرور تموم بشه، هم رویداد realtime همون INSERT برگرده — یعنی دو
  // رفت‌وبرگشت شبکه پشت‌سرهم، که چند ثانیه طول می‌کشید. الان بلافاصله با یه id
  // موقت رندر می‌شه؛ insert در پس‌زمینه انجام می‌شه و بعدش فقط id واقعی جایگزین
  // می‌شه. اگه ارسال شکست بخوره، حبابش برداشته می‌شه و متن برمی‌گرده تو اینپوت.
  const tempId = 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  const tempMsg = { id: tempId, user_id: publicChatUser.id, username: publicChatUsername, content: finalText, streak: streakVal, premium: isPremiumNow, created_at: new Date().toISOString(), is_owner: isAppOwner };
  const wrap = document.getElementById('chatMessages');
  if(wrap.querySelector('.chat-empty-msg')) wrap.innerHTML = '';
  const grouped = lastChatMsgUserId === publicChatUser.id;
  wrap.insertAdjacentHTML('beforeend', publicChatMsgHtml(tempMsg, grouped));
  const pendingEl = wrap.querySelector(`.chat-msg[data-msg-id="${tempId}"]`);
  if(pendingEl) pendingEl.classList.add('cm-pending');
  lastChatMsgUserId = publicChatUser.id;
  applyChatUserFilter();
  scrollChatToBottom(false);

  try{
    let { data, error } = await sb.from('messages').insert({ user_id: publicChatUser.id, username: publicChatUsername, content: finalText, streak: streakVal, premium: isPremiumNow }).select().single();
    if(error && /premium/i.test(error.message || '')){
      // The "premium" column hasn't been added to the messages table yet on this
      // Supabase project — fall back so sending still works (just without the badge logic).
      ({ data, error } = await sb.from('messages').insert({ user_id: publicChatUser.id, username: publicChatUsername, content: finalText, streak: streakVal }).select().single());
    }
    if(error && /streak/i.test(error.message || '')){
      // The "streak" column hasn't been added to the messages table yet on this
      // Supabase project — fall back so sending still works (just without the badge).
      ({ data, error } = await sb.from('messages').insert({ user_id: publicChatUser.id, username: publicChatUsername, content: finalText }).select().single());
    }
    if(error){
      showToast('پیام ارسال نشد', 'error');
      if(pendingEl) pendingEl.remove();
      if(!wrap.querySelector('.chat-msg')) wrap.innerHTML = '<div class="chat-empty-msg">هنوز پیامی نیست، اولین نفر باش!</div>';
      input.value = text;
      autoGrowChatBox(input);
    } else {
      // جایگزینی id موقت با id واقعیِ سرور. وقتی رویداد realtime همین INSERT هم برسه،
      // چک دوپلیکیت تو subscribe() جلوی رندر دوباره‌شو می‌گیره (پایین‌تر همین فایل).
      if(pendingEl && data){
        pendingEl.dataset.msgId = data.id;
        pendingEl.classList.remove('cm-pending');
      }
      if(!isPremiumNow) registerFreeChatMsgSent();
    }
  }catch(err){
    showToast('پیام ارسال نشد', 'error');
    if(pendingEl) pendingEl.remove();
    if(!wrap.querySelector('.chat-msg')) wrap.innerHTML = '<div class="chat-empty-msg">هنوز پیامی نیست، اولین نفر باش!</div>';
    input.value = text;
    autoGrowChatBox(input);
  }
}
document.getElementById('chatSendBtn').addEventListener('click', sendPublicChatMessage);
document.getElementById('chatInput').addEventListener('keydown', e=>{
  if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendPublicChatMessage(); }
});

/* ---------------- Sending a GIF/image ----------------
   Uploads to the 'chat-media' Storage bucket, then inserts a messages row that just
   points at the uploaded path (media_path/media_type) — same optimistic-render pattern
   as sendPublicChatMessage, except the "instant" preview uses a local blob: URL (since
   the real upload itself takes a beat) and gets swapped for the permanent Storage URL
   once the upload + insert both succeed. Same suspension/report-mode/daily-limit rules
   as a normal text message apply, since a media message still counts as a chat message. */
async function sendPublicChatMedia(file){
  if(!file || !publicChatUser) return;
  if(isCurrentlySuspended()){
    showToast('دسترسیت به چت عمومی موقتاً بسته‌ست', 'error');
    renderSuspensionLocks();
    return;
  }
  if(isCurrentlyMuted()){
    showToast('فعلاً ساکتت کرده‌ن — نمی‌تونی مدیا بفرستی', 'error');
    updateChatModeUI();
    return;
  }
  if(!(storeData.premium || isInTrial()) && getFreeChatMsgCountToday() >= FREE_CHAT_DAILY_LIMIT){
    showToast(`تو نسخه‌ی رایگان روزی فقط ${toFa(FREE_CHAT_DAILY_LIMIT)} پیام می‌تونی بفرستی`, 'error');
    openPremiumOverlay();
    return;
  }
  if(isReportModeActive() && !isAppOwner){
    showToast('الان فقط ارسال گزارش کار امکان‌پذیره 📋', 'error');
    updateChatModeUI();
    return;
  }
  if(!CHAT_MEDIA_ALLOWED_TYPES.includes(file.type)){
    showToast('فقط گیف، عکس (PNG/JPG/WebP) یا ویدیوی MP4/WebM مجازه', 'error');
    return;
  }
  const maxBytes = chatMediaMaxBytesFor(file);
  if(file.size > maxBytes){
    showToast(`حجم فایل باید کمتر از ${toFa(Math.round(maxBytes / (1024*1024)))} مگابایت باشه`, 'error');
    return;
  }

  const streakVal = (typeof computeStreak === 'function') ? computeStreak() : 0;
  const isPremiumNow = !!(storeData.premium || isInTrial());
  // Silent videos ("بدون صدا") get sent as media_type 'gifvideo' instead of 'video' — same mp4
  // file, but rendered muted/looping/without controls like a GIF (see publicChatMsgHtml).
  // Detection needs the file loaded into a real <video> element first, so this awaits it before
  // the optimistic bubble goes up — a short beat, but far shorter than the actual upload.
  const mediaType = isVideoFile(file)
    ? ((await detectVideoHasAudio(file)) ? 'video' : 'gifvideo')
    : (file.type === 'image/gif' ? 'gif' : 'image');
  const localUrl = URL.createObjectURL(file);

  const tempId = 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  const tempMsg = { id: tempId, user_id: publicChatUser.id, username: publicChatUsername, content: '', streak: streakVal, premium: isPremiumNow, created_at: new Date().toISOString(), is_owner: isAppOwner, media_localUrl: localUrl, media_type: mediaType };
  const wrap = document.getElementById('chatMessages');
  if(wrap.querySelector('.chat-empty-msg')) wrap.innerHTML = '';
  const grouped = lastChatMsgUserId === publicChatUser.id;
  wrap.insertAdjacentHTML('beforeend', publicChatMsgHtml(tempMsg, grouped));
  const pendingEl = wrap.querySelector(`.chat-msg[data-msg-id="${tempId}"]`);
  if(pendingEl) pendingEl.classList.add('cm-pending');
  lastChatMsgUserId = publicChatUser.id;
  applyChatUserFilter();
  scrollChatToBottom(false);

  try{
    const rawExt = (file.name && file.name.includes('.')) ? file.name.split('.').pop().replace(/[^a-z0-9]/gi,'').slice(0,8) : '';
    const ext = rawExt || (mediaType === 'gif' ? 'gif' : (mediaType === 'video' || mediaType === 'gifvideo') ? 'mp4' : 'jpg');
    const path = `${publicChatUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await sb.storage.from(CHAT_MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if(upErr) throw upErr;

    const { data, error } = await sb.from('messages').insert({ user_id: publicChatUser.id, username: publicChatUsername, content: '', streak: streakVal, premium: isPremiumNow, media_path: path, media_type: mediaType }).select().single();
    if(error && /media_path|media_type/i.test(error.message || '')){
      // The migration hasn't been run on this Supabase project yet — the file uploaded
      // fine but there's no column to record it against. Surface this clearly instead
      // of silently failing, since "upload succeeded, message never appeared" is confusing.
      throw new Error('ستون‌های media_path/media_type هنوز اجرا نشده — chat-media-supabase-schema.sql رو اجرا کن');
    }
    if(error) throw error;

    if(pendingEl && data){
      const mediaEl = pendingEl.querySelector('.cm-media img, .cm-media video');
      if(mediaEl) mediaEl.src = chatMediaPublicUrl(path);
      URL.revokeObjectURL(localUrl);
      pendingEl.dataset.msgId = data.id;
      pendingEl.classList.remove('cm-pending');
    }
    if(mediaType === 'gif' || mediaType === 'gifvideo'){
      addGifPickerRecent(chatMediaPublicUrl(path), chatMediaPublicUrl(path), mediaType);
    }
    if(!isPremiumNow) registerFreeChatMsgSent();
  }catch(err){
    console.error('Chat media send error', err);
    // Previously this always showed the same generic "ارسال مدیا ناموفق بود" no matter
    // what actually went wrong (missing migration, Storage rejecting the mime type/size,
    // RLS, network) — surfacing err.message makes the real cause visible without needing
    // to pull console logs off the device.
    showToast(`ارسال مدیا ناموفق بود: ${(err && err.message) ? err.message : 'خطای نامشخص'}`, 'error');
    if(pendingEl) pendingEl.remove();
    URL.revokeObjectURL(localUrl);
    if(!wrap.querySelector('.chat-msg')) wrap.innerHTML = '<div class="chat-empty-msg">هنوز پیامی نیست، اولین نفر باش!</div>';
  }
}
/* ---- attach menu: tapping ➕ shows a small popup ("عکس یا ویدیو" / "گیف") instead of
   two separate always-visible buttons — keeps the send row to the same icon count as
   before adding the voice button, so nothing gets pushed outside the box on narrow screens. */
function closeChatAttachMenu(){
  const menu = document.getElementById('chatAttachMenu');
  const backdrop = document.getElementById('chatAttachMenuBackdrop');
  if(menu) menu.classList.remove('show');
  if(backdrop) backdrop.classList.remove('show');
}
function openChatAttachMenu(){
  const btn = document.getElementById('chatAttachBtn');
  const menu = document.getElementById('chatAttachMenu');
  const backdrop = document.getElementById('chatAttachMenuBackdrop');
  if(!btn || !menu || !backdrop) return;
  backdrop.classList.add('show');
  menu.classList.add('show');
  menu.style.top = '-9999px';
  menu.style.left = '10px';
  requestAnimationFrame(()=>{
    const rect = btn.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    let left = rect.left + rect.width/2 - menuRect.width/2;
    left = Math.max(10, Math.min(left, window.innerWidth - menuRect.width - 10));
    let top = rect.top - menuRect.height - 8;
    if(top < 8) top = Math.min(rect.bottom + 8, window.innerHeight - menuRect.height - 8);
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
  });
}
document.getElementById('chatAttachBtn').addEventListener('click', openChatAttachMenu);
document.getElementById('chatAttachMenuBackdrop').addEventListener('click', closeChatAttachMenu);
document.getElementById('chatAttachMenu').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-act]');
  closeChatAttachMenu();
  if(!btn) return;
  if(btn.dataset.act === 'media'){
    const inp = document.getElementById('chatMediaInput');
    if(inp) inp.click();
  } else if(btn.dataset.act === 'gif'){
    openGifPicker();
  }
});
document.getElementById('chatMediaInput').addEventListener('change', (e)=>{
  const file = e.target.files && e.target.files[0];
  e.target.value = ''; // reset so picking the exact same file again still fires 'change'
  if(file) sendPublicChatMedia(file);
});

/* ---------------- Giphy GIF picker ----------------
   The phone's own keyboard GIF tray (Gboard/Samsung Keyboard) can't send content into this
   chat input — that "این برنامه از فایل‌های GIF پشتیبانی نمی‌کند" message comes from Android
   itself, because sending rich content from a keyboard into a WebView's <input> requires the
   native Android side to implement WebViewCompat.setOnReceiveContentListener (or the older
   InputConnection.commitContent API); it can't be turned on from this HTML/JS file alone.
   This in-app Giphy search is the standard workaround (same approach Discord/Slack/Telegram's
   web clients use): search or browse trending GIFs, tap one, and it's sent as a normal chat
   media message.
   نکته‌ی مهم: قبلاً این درخواست مستقیم از گوشیِ کاربر به api.giphy.com می‌رفت — و چون Giphy
   (مثل خیلی از سرویس‌های آمریکایی) IP ایران رو به‌خاطر تحریم‌ها مسدود/محدود می‌کنه، بدون
   فیلترشکن اصلاً گیفی لود نمی‌شد. الان از طریق همون Worker خودمون (که برای AI هم استفاده
   می‌شه و از ایران بدون مشکل در دسترسه) پروکسی می‌شه؛ کلید Giphy هم دیگه اینجا نیست، رو
   خودِ Worker (env.GIPHY_API_KEY) نگه‌داری می‌شه. */
let gifPickerSearchTimer = null;
let gifPickerReqSeq = 0;
let gifPickerActiveTab = 'trending'; // 'trending' | 'recent' — search results override whichever tab is active
const GIF_RECENT_STORAGE_KEY = 'gifPicker:recent';
const GIF_RECENT_MAX = 30;
async function giphyFetch(endpoint, params){
  const headers = Object.assign({ 'Content-Type': 'application/json' }, await authHeaders());
  const res = await fetch(WORKER_BASE + '/giphy', {
    method: 'POST',
    headers,
    body: JSON.stringify({ endpoint, q: (params && params.q) || '' }),
  });
  const data = await res.json();
  if(!res.ok) throw new Error((data && data.error) || ('Giphy request failed (' + res.status + ')'));
  return data;
}
function gifPickerCellHtml(thumb, full, type){
  if(!thumb || !full) return '';
  const proxiedThumb = giphyProxyIfNeeded(thumb);
  const media = type === 'gifvideo'
    ? `<video src="${escapeHtml(proxiedThumb)}" autoplay loop muted playsinline preload="auto"></video>`
    : `<img src="${escapeHtml(proxiedThumb)}" alt="گیف" loading="lazy">`;
  return `<div class="gif-picker-cell" data-full-url="${escapeHtml(full)}" data-thumb-url="${escapeHtml(thumb)}" data-media-type="${escapeHtml(type || 'gif')}">${media}</div>`;
}
function renderGifPickerResults(results){
  const grid = document.getElementById('gifPickerGrid');
  if(!grid) return;
  const cells = (results||[]).map(r=>{
    const thumb = r.images && ((r.images.fixed_width_small && r.images.fixed_width_small.url) || (r.images.fixed_width && r.images.fixed_width.url));
    const full = r.images && ((r.images.original && r.images.original.url) || (r.images.fixed_width && r.images.fixed_width.url));
    return gifPickerCellHtml(thumb, full, 'gif'); // Giphy results are always static/animated images, never silent-video clips
  }).filter(Boolean);
  grid.innerHTML = cells.length ? cells.join('') : '<div class="cm-ov-empty">گیفی پیدا نشد.</div>';
}
/* ---------------- Recently-used GIFs ("مثل تلگرام") ----------------
   Every GIF — or silent video sent/received as a GIF-style clip — gets remembered locally
   (window.storage, per-device/per-user, not shared with other chat members) so it shows up
   under the "اخیرا استفاده‌شده" tab next time, newest first, without another Giphy request. */
async function getGifPickerRecent(){
  try{
    const res = await window.storage.get(GIF_RECENT_STORAGE_KEY, false);
    if(!res || !res.value) return [];
    const list = JSON.parse(res.value);
    return Array.isArray(list) ? list : [];
  }catch(err){
    return [];
  }
}
async function addGifPickerRecent(thumb, full, type){
  if(!full) return;
  try{
    const list = await getGifPickerRecent();
    const deduped = list.filter(g => g.full !== full);
    deduped.unshift({ thumb: thumb || full, full, type: type || 'gif' });
    await window.storage.set(GIF_RECENT_STORAGE_KEY, JSON.stringify(deduped.slice(0, GIF_RECENT_MAX)), false);
  }catch(err){
    console.error('گیف: ذخیره‌ی اخیرا استفاده‌شده‌ها ناموفق بود', err);
  }
}
async function loadGifPickerRecent(){
  const grid = document.getElementById('gifPickerGrid');
  if(grid) grid.innerHTML = '<div class="cm-ov-loading">در حال بارگذاری...</div>';
  const seq = ++gifPickerReqSeq;
  const list = await getGifPickerRecent();
  if(seq !== gifPickerReqSeq) return;
  if(!grid) return;
  if(!list.length){
    grid.innerHTML = '<div class="cm-ov-empty">هنوز گیفی نفرستادی/ذخیره نکردی. گیف‌ها و ویدیوهای بی‌صدایی که می‌فرستی یا ذخیره می‌کنی اینجا میان.</div>';
    return;
  }
  grid.innerHTML = list.map(g => gifPickerCellHtml(g.thumb, g.full, g.type)).filter(Boolean).join('');
}
function loadGifPickerActiveTab(){
  if(gifPickerActiveTab === 'recent') loadGifPickerRecent();
  else loadGifPickerTrending();
}
async function loadGifPickerTrending(){
  const grid = document.getElementById('gifPickerGrid');
  if(grid) grid.innerHTML = '<div class="cm-ov-loading">در حال بارگذاری گیف‌های پرطرفدار...</div>';
  const seq = ++gifPickerReqSeq;
  try{
    const data = await giphyFetch('trending', {});
    if(seq !== gifPickerReqSeq) return; // یه جستجوی جدیدتر از این زودتر رسیده، این نتیجه رو دور بریز
    renderGifPickerResults(data.data);
  }catch(err){
    console.error('Giphy trending load error', err);
    if(seq !== gifPickerReqSeq) return;
    if(grid) grid.innerHTML = '<div class="cm-ov-empty">مشکلی در بارگذاری گیف‌ها پیش اومد، دوباره امتحان کن.</div>';
  }
}
async function searchGifPicker(q){
  if(!q){ loadGifPickerActiveTab(); return; }
  const grid = document.getElementById('gifPickerGrid');
  if(grid) grid.innerHTML = '<div class="cm-ov-loading">در حال جستجو...</div>';
  const seq = ++gifPickerReqSeq;
  try{
    const data = await giphyFetch('search', { q });
    if(seq !== gifPickerReqSeq) return;
    renderGifPickerResults(data.data);
  }catch(err){
    console.error('Giphy search error', err);
    if(seq !== gifPickerReqSeq) return;
    if(grid) grid.innerHTML = '<div class="cm-ov-empty">مشکلی در جستجو پیش اومد.</div>';
  }
}
function openGifPicker(){
  document.getElementById('gifPickerOverlay').classList.add('show');
  const input = document.getElementById('gifPickerSearchInput');
  if(input) input.value = '';
  gifPickerActiveTab = 'trending';
  document.querySelectorAll('#gifPickerTabs .gif-picker-tab').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.tab === 'trending');
  });
  loadGifPickerActiveTab();
}
function closeGifPicker(){
  document.getElementById('gifPickerOverlay').classList.remove('show');
}
document.getElementById('gifPickerBackBtn').addEventListener('click', closeGifPicker);
document.getElementById('gifPickerSearchInput').addEventListener('input', (e)=>{
  clearTimeout(gifPickerSearchTimer);
  const q = e.target.value.trim();
  gifPickerSearchTimer = setTimeout(()=> searchGifPicker(q), 400);
});
document.getElementById('gifPickerTabs').addEventListener('click', (e)=>{
  const btn = e.target.closest('.gif-picker-tab');
  if(!btn) return;
  gifPickerActiveTab = btn.dataset.tab;
  document.querySelectorAll('#gifPickerTabs .gif-picker-tab').forEach(b=> b.classList.toggle('active', b === btn));
  const input = document.getElementById('gifPickerSearchInput');
  if(input) input.value = '';
  loadGifPickerActiveTab();
});
document.getElementById('gifPickerGrid').addEventListener('click', (e)=>{
  const cell = e.target.closest('.gif-picker-cell');
  if(!cell) return;
  const url = cell.dataset.fullUrl;
  const thumb = cell.dataset.thumbUrl;
  const type = cell.dataset.mediaType || 'gif';
  if(url){ closeGifPicker(); sendPublicChatGif(url, thumb, type); }
});

/* ---------------- Sending a Giphy GIF (or resending a saved GIF/silent-video from Recent) ----------------
   Unlike sendPublicChatMedia() there's no Storage upload step — the URL already points at
   permanent hosting (Giphy's CDN, or our own chat-media bucket for a previously-saved silent
   video), so media_path is just stored as that full URL. Same suspension/report-mode/
   daily-limit rules as any other chat message still apply. */
async function sendPublicChatGif(gifUrl, gifThumbUrl, mediaType){
  if(!gifUrl || !publicChatUser) return;
  const type = mediaType || 'gif';
  addGifPickerRecent(gifThumbUrl, gifUrl, type);
  if(isCurrentlySuspended()){
    showToast('دسترسیت به چت عمومی موقتاً بسته‌ست', 'error');
    renderSuspensionLocks();
    return;
  }
  if(!(storeData.premium || isInTrial()) && getFreeChatMsgCountToday() >= FREE_CHAT_DAILY_LIMIT){
    showToast(`تو نسخه‌ی رایگان روزی فقط ${toFa(FREE_CHAT_DAILY_LIMIT)} پیام می‌تونی بفرستی`, 'error');
    openPremiumOverlay();
    return;
  }
  if(isReportModeActive() && !isAppOwner){
    showToast('الان فقط ارسال گزارش کار امکان‌پذیره 📋', 'error');
    updateChatModeUI();
    return;
  }

  const streakVal = (typeof computeStreak === 'function') ? computeStreak() : 0;
  const isPremiumNow = !!(storeData.premium || isInTrial());
  const tempId = 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  const tempMsg = { id: tempId, user_id: publicChatUser.id, username: publicChatUsername, content: '', streak: streakVal, premium: isPremiumNow, created_at: new Date().toISOString(), is_owner: isAppOwner, media_localUrl: gifUrl, media_type: type };
  const wrap = document.getElementById('chatMessages');
  if(wrap.querySelector('.chat-empty-msg')) wrap.innerHTML = '';
  const grouped = lastChatMsgUserId === publicChatUser.id;
  wrap.insertAdjacentHTML('beforeend', publicChatMsgHtml(tempMsg, grouped));
  const pendingEl = wrap.querySelector(`.chat-msg[data-msg-id="${tempId}"]`);
  if(pendingEl) pendingEl.classList.add('cm-pending');
  lastChatMsgUserId = publicChatUser.id;
  applyChatUserFilter();
  scrollChatToBottom(false);

  try{
    const { data, error } = await sb.from('messages').insert({ user_id: publicChatUser.id, username: publicChatUsername, content: '', streak: streakVal, premium: isPremiumNow, media_path: gifUrl, media_type: type }).select().single();
    if(error) throw error;
    if(pendingEl && data){
      pendingEl.dataset.msgId = data.id;
      pendingEl.classList.remove('cm-pending');
    }
    if(!isPremiumNow) registerFreeChatMsgSent();
  }catch(err){
    console.error('Giphy gif send error', err);
    showToast(`ارسال گیف ناموفق بود: ${(err && err.message) ? err.message : 'خطای نامشخص'}`, 'error');
    if(pendingEl) pendingEl.remove();
    if(!wrap.querySelector('.chat-msg')) wrap.innerHTML = '<div class="chat-empty-msg">هنوز پیامی نیست، اولین نفر باش!</div>';
  }
}


/* ---------------- One-click daily task report → public chat ---------------- */
// Invisible-in-normal-typing marker so a report bubble can always be told apart
// from a regular message, even after a page reload / for other users' devices.
const TASK_REPORT_MARKER = '⟦TASKREPORT⟧';
function getTaskReportData(){
  const doItems = getDoItems();
  const avoidItems = getAvoidItems();
  const lines = [];
  let doneCount = 0;
  doItems.forEach((label, idx)=>{
    const done = !!entry.done[idx];
    if(done) doneCount++;
    lines.push((done?'✅ ':'⭕ ') + label);
  });
  avoidItems.forEach((label, idx)=>{
    const done = !!entry.avoidDone[idx];
    if(done) doneCount++;
    lines.push((done?'✅ ':'⭕ ') + label);
  });
  const total = doItems.length + avoidItems.length;
  const pct = total ? Math.round((doneCount/total)*100) : 0;
  let text = '📋 گزارش تسک‌های امروز\n——————————\n' + (lines.join('\n') || 'تسکی ثبت نشده') + '\n——————————\n';
  if(entry.phoneHours!==null && entry.phoneHours!==undefined && entry.phoneHours!==''){
    text += '📱 استفاده از گوشی: ' + toFa(entry.phoneHours) + ' ساعت\n';
  }
  text += '📊 پیشرفت: ' + toFa(pct) + '٪ (' + toFa(doneCount) + ' از ' + toFa(total) + ')';
  return { text, doneCount, total };
}
function canSendTaskReport(){
  const { doneCount, total } = getTaskReportData();
  if(total === 0) return false;
  return doneCount * 3 >= total; // at least a third of today's tasks must be done
}
function updateReportBtnState(){
  const btn = document.getElementById('sendReportBtn');
  const hint = document.getElementById('reportBtnHint');
  if(!btn) return;
  if(isCurrentlyMuted()){
    btn.disabled = true;
    if(hint) hint.textContent = 'فعلاً ساکتی، نمی‌تونی گزارش کار هم بفرستی';
    return;
  }
  if(!isReportModeActive() && !isAppOwner){
    btn.disabled = true;
    if(hint) hint.textContent = 'ارسال گزارش کار فقط از ساعت ۲۰ تا ۲۴ فعاله';
    return;
  }
  if(!(storeData.premium || isInTrial()) && storeData.taskReportSentOnce){
    btn.disabled = true;
    if(hint) hint.textContent = 'ارسال گزارش کار تو نسخه‌ی رایگان فقط یک‌بار امکان‌پذیره — برای ارسال نامحدود، پرمیوم شو';
    return;
  }
  const { doneCount, total } = getTaskReportData();
  const ok = total > 0 && doneCount * 3 >= total;
  btn.disabled = !ok;
  if(hint){
    hint.textContent = ok ? '' : (total === 0 ? 'هنوز تسکی برای امروز نداری' : 'برای ارسال گزارش باید حداقل یک‌سوم کارهای امروزتو انجام داده باشی');
  }
}
async function sendTaskReport(){
  if(!sb || !publicChatUser) return;
  if(isCurrentlyMuted()){ showToast('فعلاً ساکتت کرده‌ن — نمی‌تونی گزارش کار بفرستی', 'error'); return; }
  if(!isReportModeActive() && !isAppOwner){ showToast('ارسال گزارش کار فقط از ساعت ۲۰ تا ۲۴ فعاله', 'error'); return; }
  if(!(storeData.premium || isInTrial()) && storeData.taskReportSentOnce){
    showToast('ارسال گزارش کار تو نسخه‌ی رایگان فقط یک‌بار امکان‌پذیره', 'error');
    openPremiumOverlay();
    return;
  }
  const { text, doneCount, total } = getTaskReportData();
  if(total === 0){ showToast('هنوز تسکی برای امروز نداری', 'error'); return; }
  if(doneCount * 3 < total){ showToast('برای ارسال گزارش باید حداقل یک‌سوم کارهای امروزتو انجام داده باشی', 'error'); return; }
  const btn = document.getElementById('sendReportBtn');
  if(btn) btn.disabled = true;
  const streakVal = (typeof computeStreak === 'function') ? computeStreak() : 0;
  try{
    let { error } = await sb.from('messages').insert({ user_id: publicChatUser.id, username: publicChatUsername, content: TASK_REPORT_MARKER + text, streak: streakVal, premium: !!(storeData.premium || isInTrial()) });
    if(error && /premium/i.test(error.message || '')){
      ({ error } = await sb.from('messages').insert({ user_id: publicChatUser.id, username: publicChatUsername, content: TASK_REPORT_MARKER + text, streak: streakVal }));
    }
    if(error && /streak/i.test(error.message || '')){
      ({ error } = await sb.from('messages').insert({ user_id: publicChatUser.id, username: publicChatUsername, content: TASK_REPORT_MARKER + text }));
    }
    if(error) showToast('گزارش ارسال نشد', 'error');
    else{
      showToast('گزارش ارسال شد ✅', 'success');
      if(!storeData.reportSentDates) storeData.reportSentDates = {};
      storeData.reportSentDates[todayKey()] = true;
      if(!(storeData.premium || isInTrial())){ storeData.taskReportSentOnce = true; }
      saveData();
      try{ renderXP(); }catch(err){}
    }
  }catch(err){ showToast('گزارش ارسال نشد', 'error'); }
  finally{ updateReportBtnState(); }
}
document.getElementById('sendReportBtn').addEventListener('click', sendTaskReport);

initChatAuth();
updateChatModeUI();

/* ================= رفیق هم‌مسیر (Accountability Buddy) =================
   Lives as a 4th tab inside the «عمومی» (public) section, alongside
   چت/لیدربورد/پروفایل — reached via #pubSubnav, not a side-menu subpage.
   Requires these Supabase objects (see buddy-supabase-schema.sql shipped
   alongside this file — run it once in the Supabase SQL editor):
     tables: buddy_requests, buddy_pairs, buddy_messages
     columns added to profiles: today_done boolean, today_date date, current_streak integer
     RPCs: accept_buddy_request(req_id uuid), request_random_buddy()
   Two ways to become buddies:
   1) Pick someone directly — a "🤝 هم‌مسیر شو" button on their card in the
      لیدربورد tab (podium + main list), wired via lbBuddyBtnHtml() above.
   2) Random & anonymous — the "🎲" button below, which calls the
      request_random_buddy() RPC so the client never sees the full user list;
      the server itself picks a random buddy-less profile.
   Once paired, both people only ever see each other's today-completed
   status + streak, plus a private two-person chat — never the other
   person's full checklist. Anonymous pairs additionally mask the name/avatar
   on both sides (in this tab and in the chat), everywhere else stays the
   same as a normal buddy pair. */
let myBuddyPair = null;              // the active buddy_pairs row involving me, or null
let myPendingBuddyRequests = [];     // pending buddy_requests rows where I'm from_user OR to_user
let buddyPartnerProfile = null;
let buddyMessagesChannel = null;
let lastBuddyMsgSenderId = null;

function todayKeyLocal(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
// Same 60%-of-today's-tasks rule computeStreak() uses per day, just for today alone —
// so the buddy status pill always agrees with what actually keeps the streak alive.
function isTodayDoneLocal(){
  const key = todayKeyLocal();
  const e = storeData.entries[key];
  if(!e) return false;
  const done = Object.values(e.done||{}).filter(Boolean).length
    + Object.values(e.avoidDone||{}).filter(Boolean).length
    + Object.values(e.momentDone||{}).filter(Boolean).length;
  const tot = e.total || totalToday();
  const pct = tot ? Math.round((done/tot)*100) : 0;
  return pct >= 60;
}
let lastBuddyStatusSyncKey = null;
async function syncMyBuddyDailyStatus(){
  if(!sb || !publicChatUser) return;
  const todayDone = isTodayDoneLocal();
  const streak = (typeof computeStreak === 'function') ? computeStreak() : 0;
  const key = todayKeyLocal()+'|'+todayDone+'|'+streak;
  if(key === lastBuddyStatusSyncKey) return;
  try{
    await sb.from('profiles').update({ today_done: todayDone, today_date: todayKeyLocal(), current_streak: streak }).eq('id', publicChatUser.id);
    lastBuddyStatusSyncKey = key;
  }catch(err){ console.error('Buddy status sync failed', err); }
}

async function loadMyBuddyRelations(){
  if(!sb || !publicChatUser){ myBuddyPair = null; myPendingBuddyRequests = []; return; }
  try{
    const [{ data: pair }, { data: reqs }] = await Promise.all([
      sb.from('buddy_pairs').select('*').or(`user_a.eq.${publicChatUser.id},user_b.eq.${publicChatUser.id}`).eq('status','active').maybeSingle(),
      sb.from('buddy_requests').select('*').or(`from_user.eq.${publicChatUser.id},to_user.eq.${publicChatUser.id}`).eq('status','pending')
    ]);
    myBuddyPair = pair || null;
    myPendingBuddyRequests = reqs || [];
  }catch(err){
    console.error('Buddy relations load failed', err);
    myBuddyPair = null; myPendingBuddyRequests = [];
  }
}

async function sendDirectBuddyRequest(targetUid){
  if(!sb || !publicChatUser) return;
  if(myBuddyPair){ showToast('همین الان یه هم‌مسیر فعال داری', 'error'); return; }
  try{
    const { error } = await sb.from('buddy_requests').insert({ from_user: publicChatUser.id, to_user: targetUid, anonymous: false });
    if(error){ showToast('درخواست ارسال نشد', 'error'); return; }
    showToast('درخواست هم‌مسیری فرستاده شد 🤝', 'success');
    await loadMyBuddyRelations();
    if(document.getElementById('tab-leaderboard').classList.contains('active')) loadLeaderboard(true);
  }catch(err){ showToast('درخواست ارسال نشد', 'error'); }
}
async function acceptBuddyRequest(reqId){
  if(!sb || !publicChatUser) return;
  try{
    const { error } = await sb.rpc('accept_buddy_request', { req_id: reqId });
    if(error){ showToast(error.message || 'قبول کردن درخواست انجام نشد', 'error'); return; }
    showToast('هم‌مسیر شدید! 🎉', 'success');
    await loadMyBuddyRelations();
    if(document.getElementById('tab-buddy').classList.contains('active')) renderBuddyTab();
    if(document.getElementById('tab-leaderboard').classList.contains('active')) loadLeaderboard(true);
  }catch(err){ showToast('قبول کردن درخواست انجام نشد', 'error'); }
}
async function declineBuddyRequest(reqId){
  if(!sb) return;
  try{
    const { error } = await sb.from('buddy_requests').update({ status:'declined', responded_at: new Date().toISOString() }).eq('id', reqId);
    if(error){ showToast('انجام نشد', 'error'); return; }
    await loadMyBuddyRelations();
    renderBuddyTab();
  }catch(err){ showToast('انجام نشد', 'error'); }
}
async function cancelBuddyRequest(reqId){
  if(!sb) return;
  try{
    const { error } = await sb.from('buddy_requests').update({ status:'cancelled', responded_at: new Date().toISOString() }).eq('id', reqId);
    if(error){ showToast('انجام نشد', 'error'); return; }
    await loadMyBuddyRelations();
    renderBuddyTab();
  }catch(err){ showToast('انجام نشد', 'error'); }
}
async function requestRandomBuddy(){
  if(!sb || !publicChatUser) return;
  const btn = document.getElementById('buddyRandomBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'در حال جست‌وجو...'; }
  try{
    const { error } = await sb.rpc('request_random_buddy');
    if(error){ showToast(error.message || 'الان کسی برای جفت‌شدن تصادفی در دسترس نیست', 'error'); return; }
    showToast('یه درخواست تصادفی و ناشناس فرستاده شد 🎲', 'success');
    await loadMyBuddyRelations();
    renderBuddyTab();
  }catch(err){ showToast('مشکلی پیش اومد', 'error'); }
  finally{ if(btn){ btn.disabled = false; btn.textContent = '🎲 پیدا کردن هم‌مسیر تصادفی (ناشناس)'; } }
}
async function endBuddyPair(){
  if(!sb || !myBuddyPair) return;
  if(!confirm('مطمئنی می‌خوای هم‌مسیریتونو تموم کنی؟')) return;
  try{
    const { error } = await sb.from('buddy_pairs').update({ status:'ended', ended_at: new Date().toISOString() }).eq('id', myBuddyPair.id);
    if(error){ showToast('انجام نشد', 'error'); return; }
    if(buddyMessagesChannel){ sb.removeChannel(buddyMessagesChannel); buddyMessagesChannel = null; }
    showToast('هم‌مسیریتون تموم شد');
    await loadMyBuddyRelations();
    renderBuddyTab();
  }catch(err){ showToast('انجام نشد', 'error'); }
}

/* ---- Buddy tab rendering ---- */
let buddyTabLastLoadedAt = 0;
const BUDDY_FRESH_MS = 12000;
async function loadBuddyTab(force){
  if(!force && buddyTabLastLoadedAt && (Date.now() - buddyTabLastLoadedAt) < BUDDY_FRESH_MS) return;
  const loadingEl = document.getElementById('buddyLoading');
  const pairedBox = document.getElementById('buddyPairedBox');
  const unpairedBox = document.getElementById('buddyUnpairedBox');
  const errEl = document.getElementById('buddyEmptyErr');
  loadingEl.style.display = 'flex';
  pairedBox.style.display = 'none';
  unpairedBox.style.display = 'none';
  errEl.style.display = 'none';
  if(!chatConfigured() || !sb){
    loadingEl.style.display = 'none';
    errEl.style.display = 'block';
    errEl.textContent = 'این بخش هنوز به سرور وصل نشده.';
    return;
  }
  try{
    await loadMyBuddyRelations();
    await renderBuddyTab();
    buddyTabLastLoadedAt = Date.now();
  }catch(err){
    console.error('Buddy tab load failed', err);
    loadingEl.style.display = 'none';
    errEl.style.display = 'block';
    errEl.textContent = 'مشکلی پیش اومد. دوباره امتحان کن.';
  }
}
async function renderBuddyTab(){
  const loadingEl = document.getElementById('buddyLoading');
  const pairedBox = document.getElementById('buddyPairedBox');
  const unpairedBox = document.getElementById('buddyUnpairedBox');
  loadingEl.style.display = 'none';
  if(myBuddyPair){
    unpairedBox.style.display = 'none';
    pairedBox.style.display = 'block';
    await renderBuddyPartner();
    loadBuddyMessages();
  } else {
    pairedBox.style.display = 'none';
    unpairedBox.style.display = 'block';
    await renderBuddyRequestLists();
  }
}
async function renderBuddyPartner(){
  const partnerId = myBuddyPair.user_a === publicChatUser.id ? myBuddyPair.user_b : myBuddyPair.user_a;
  const anon = !!myBuddyPair.anonymous;
  let profile = null;
  try{
    const cols = anon ? 'today_done,today_date,current_streak' : 'id,username,gender,current_streak,today_done,today_date,avatar_url';
    const { data } = await sb.from('profiles').select(cols).eq('id', partnerId).single();
    profile = data;
  }catch(err){}
  buddyPartnerProfile = profile;
  const name = anon ? 'همراه ناشناس' : (profile ? displayName(profile.username) : 'کاربر');
  const avatarEl = document.getElementById('buddyPartnerAvatar');
  // Anonymous pairing never shows the real photo — that would defeat the whole point of "ناشناس".
  avatarEl.innerHTML = anon ? '🎭' : lbAvatarInnerHtml(profile, name);
  avatarEl.style.background = anon ? '' : ((profile && profile.avatar_url) ? 'transparent' : lbColorFor(partnerId));
  avatarEl.classList.toggle('buddy-anon-avatar', anon);
  document.getElementById('buddyPartnerName').textContent = name;
  document.getElementById('buddyPartnerSub').textContent = anon
    ? 'هم‌مسیر ناشناس — فقط وضعیت روزانه و چتتون به هم دیده می‌شه'
    : ('رکورد پشت‌سرهم: '+toFa((profile&&profile.current_streak)||0)+' روز');
  const pillEl = document.getElementById('buddyPartnerTodayPill');
  const isFresh = profile && profile.today_date === todayKeyLocal();
  if(isFresh && profile.today_done){ pillEl.textContent = '✅ امروز کاراشو انجام داده'; pillEl.className = 'buddy-today-pill done'; }
  else if(isFresh && !profile.today_done){ pillEl.textContent = '⏳ هنوز امروزو ثبت نکرده'; pillEl.className = 'buddy-today-pill notyet'; }
  else { pillEl.textContent = '❔ وضعیت امروزش معلوم نیست'; pillEl.className = 'buddy-today-pill'; }
}
async function renderBuddyRequestLists(){
  const incoming = myPendingBuddyRequests.filter(r=> r.to_user === publicChatUser.id);
  const outgoing = myPendingBuddyRequests.filter(r=> r.from_user === publicChatUser.id);
  const namedIds = Array.from(new Set(
    incoming.filter(r=>!r.anonymous).map(r=>r.from_user)
      .concat(outgoing.filter(r=>!r.anonymous).map(r=>r.to_user))
  ));
  let profilesById = {};
  if(namedIds.length){
    try{
      const { data } = await sb.from('profiles').select('id,username,gender,avatar_url').in('id', namedIds);
      (data||[]).forEach(p=> profilesById[p.id] = p);
    }catch(err){}
  }
  const incomingSection = document.getElementById('buddyIncomingSection');
  const incomingList = document.getElementById('buddyIncomingList');
  const outgoingSection = document.getElementById('buddyOutgoingSection');
  const outgoingList = document.getElementById('buddyOutgoingList');

  incomingSection.style.display = incoming.length ? 'block' : 'none';
  incomingList.innerHTML = incoming.map(r=>{
    if(r.anonymous){
      return `<div class="buddy-request-row">
        <div style="flex:1;">
          <div class="buddy-request-name">🎭 یه نفر ناشناس می‌خواد هم‌مسیرت بشه</div>
          <div class="buddy-request-sub">اگه قبول کنی، هویت هر دوتون تو این هم‌مسیری مخفی می‌مونه</div>
        </div>
        <div class="buddy-request-actions">
          <button class="buddy-req-btn accept" data-accept-req="${r.id}">قبول</button>
          <button class="buddy-req-btn decline" data-decline-req="${r.id}">رد</button>
        </div>
      </div>`;
    }
    const p = profilesById[r.from_user];
    const name = p ? displayName(p.username) : 'کاربر';
    return `<div class="buddy-request-row">
      <div class="lb-avatar-wrap"><div class="lb-avatar" style="background:${p&&p.avatar_url?'transparent':lbColorFor(r.from_user)}">${lbAvatarInnerHtml(p, name)}</div>${lbGenderBadge(p&&p.gender)}</div>
      <div style="flex:1;min-width:0;">
        <div class="buddy-request-name">${escapeHtml(name)}</div>
        <div class="buddy-request-sub">می‌خواد هم‌مسیرت بشه</div>
      </div>
      <div class="buddy-request-actions">
        <button class="buddy-req-btn accept" data-accept-req="${r.id}">قبول</button>
        <button class="buddy-req-btn decline" data-decline-req="${r.id}">رد</button>
      </div>
    </div>`;
  }).join('');

  outgoingSection.style.display = outgoing.length ? 'block' : 'none';
  outgoingList.innerHTML = outgoing.map(r=>{
    const label = r.anonymous
      ? '🎲 درخواست تصادفی و ناشناس تو در انتظار پاسخه'
      : ('درخواستت به '+escapeHtml(profilesById[r.to_user] ? displayName(profilesById[r.to_user].username) : 'کاربر')+' در انتظار پاسخه');
    return `<div class="buddy-request-row">
      <div style="flex:1;"><div class="buddy-request-name">${label}</div></div>
      <div class="buddy-request-actions">
        <button class="buddy-req-btn cancel" data-cancel-req="${r.id}">لغو</button>
      </div>
    </div>`;
  }).join('');
}
document.getElementById('tab-buddy').addEventListener('click', (e)=>{
  const accBtn = e.target.closest('[data-accept-req]');
  if(accBtn){ acceptBuddyRequest(accBtn.dataset.acceptReq); return; }
  const decBtn = e.target.closest('[data-decline-req]');
  if(decBtn){ declineBuddyRequest(decBtn.dataset.declineReq); return; }
  const cancelBtn = e.target.closest('[data-cancel-req]');
  if(cancelBtn){ cancelBuddyRequest(cancelBtn.dataset.cancelReq); return; }
});
document.getElementById('buddyRandomBtn').addEventListener('click', requestRandomBuddy);
document.getElementById('buddyEndBtn').addEventListener('click', endBuddyPair);

/* ---- Private buddy chat — same shape as the public chat, scoped to one pair_id ---- */
function buddyMsgHtml(m, grouped){
  const own = publicChatUser && m.sender_id === publicChatUser.id;
  const anon = myBuddyPair && myBuddyPair.anonymous;
  const nm = own ? 'تو' : (anon ? 'همراه ناشناس' : (buddyPartnerProfile ? displayName(buddyPartnerProfile.username) : 'هم‌مسیر'));
  const time = new Date(m.created_at).toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
  const head = grouped ? '' : `<div class="cm-head"><div class="cm-name">${escapeHtml(nm)}</div></div>`;
  return `<div class="chat-msg${own?' own':''}${grouped?' grouped':''}" data-msg-id="${m.id}">
    ${head}
    <div class="cm-text">${escapeHtml(m.content)}</div>
    <div class="cm-bottom-row"><span class="cm-time">${time}</span></div>
  </div>`;
}
function renderBuddyMessages(rows){
  const wrap = document.getElementById('buddyMessages');
  if(!rows || !rows.length){ wrap.innerHTML = '<div class="chat-empty-msg">هنوز پیامی نیست — اولین قدم رو تو بردار 👋</div>'; lastBuddyMsgSenderId = null; return; }
  let prev = null;
  wrap.innerHTML = rows.map(m=>{ const grouped = prev===m.sender_id; prev = m.sender_id; return buddyMsgHtml(m, grouped); }).join('');
  lastBuddyMsgSenderId = prev;
  wrap.scrollTop = wrap.scrollHeight;
}
async function loadBuddyMessages(){
  if(!sb || !myBuddyPair) return;
  try{
    const { data, error } = await sb.from('buddy_messages').select('*').eq('pair_id', myBuddyPair.id).order('created_at', {ascending:true}).limit(300);
    if(!error) renderBuddyMessages(data);
    if(buddyMessagesChannel){ sb.removeChannel(buddyMessagesChannel); buddyMessagesChannel = null; }
    buddyMessagesChannel = sb.channel('buddy:'+myBuddyPair.id)
      .on('postgres_changes', {event:'INSERT', schema:'public', table:'buddy_messages', filter:'pair_id=eq.'+myBuddyPair.id}, payload=>{
        const wrap = document.getElementById('buddyMessages');
        if(wrap.querySelector('.chat-empty-msg')) wrap.innerHTML = '';
        const grouped = lastBuddyMsgSenderId === payload.new.sender_id;
        wrap.insertAdjacentHTML('beforeend', buddyMsgHtml(payload.new, grouped));
        lastBuddyMsgSenderId = payload.new.sender_id;
        wrap.scrollTop = wrap.scrollHeight;
      }).subscribe();
  }catch(err){ console.error('Buddy messages load failed', err); }
}
async function sendBuddyMessage(){
  const input = document.getElementById('buddyChatInput');
  const text = input.value.trim();
  if(!text || !publicChatUser || !myBuddyPair) return;
  if(checkCrisisText(text)){
    input.value = '';
    autoGrowChatBox(input);
    renderCrisisBanner('buddyChatCrisisSlot');
    return;
  }
  if(containsAbusiveLanguage(text)){ showToast('لطفاً محترمانه بنویس 🙏', 'error'); return; }
  input.value = '';
  autoGrowChatBox(input);
  try{
    const { error } = await sb.from('buddy_messages').insert({ pair_id: myBuddyPair.id, sender_id: publicChatUser.id, content: text });
    if(error) showToast('پیام ارسال نشد', 'error');
  }catch(err){ showToast('پیام ارسال نشد', 'error'); }
}
document.getElementById('buddyChatSendBtn').addEventListener('click', sendBuddyMessage);
document.getElementById('buddyChatInput').addEventListener('keydown', e=>{
  if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendBuddyMessage(); }
});

/* ================= Workout / bodybuilding program ================= */
const MUSCLE_LABELS = {chest:'سینه', back:'پشت', shoulders:'شانه', biceps:'جلوبازو', triceps:'پشت‌بازو', legs:'پا', glutes:'باسن', abs:'شکم'};
const FOCUS_TO_MUSCLES = {chest:['chest'], back:['back'], shoulders:['shoulders'], arms:['biceps','triceps'], legs:['legs'], glutes:['glutes'], abs:['abs']};
const MUSCLE_EXERCISES = {
  chest: {
    gym:[{name:'پرس سینه با هالتر', sets:'۴×۸-۱۰', type:'push'},{name:'پرس بالاسینه با دمبل', sets:'۳×۱۰-۱۲', type:'push'},{name:'قفسه سینه با کراس‌اور', sets:'۳×۱۲-۱۵', type:'push'},{name:'شنا سوئدی (فینیشر)', sets:'۲×حداکثر', type:'push'}],
    home:[{name:'شنا سوئدی', sets:'۴×۱۰-۱۵', type:'push'},{name:'شنا سوئدی شیب‌دار (پا بالا)', sets:'۳×۱۰-۱۲', type:'push'},{name:'شنا سوئدی دست باز', sets:'۳×۱۰-۱۵', type:'push'},{name:'شنا سوئدی آهسته (۴ ثانیه پایین)', sets:'۲×۸-۱۰', type:'push'}]
  },
  back: {
    gym:[{name:'زیربغل هالتر خم', sets:'۴×۸-۱۰', type:'pull'},{name:'لت پول‌داون یا بارفیکس', sets:'۳×۸-۱۰', type:'pull'},{name:'زیربغل سیم‌کش نشسته', sets:'۳×۱۰-۱۲', type:'pull'},{name:'فیس‌پول (زیربغل بالا)', sets:'۳×۱۲-۱۵', type:'pull'}],
    home:[{name:'سوپرمن', sets:'۳×۱۲-۱۵', type:'hinge'},{name:'زیربغل با کش مقاومتی', sets:'۴×۱۲-۱۵', type:'pull'},{name:'بارفیکس (اگه میله در دسترسه)', sets:'۳×حداکثر', type:'pull'},{name:'زیربغل تک‌دست با وسیله‌ی سنگین خونگی', sets:'۳×۱۰-۱۲', type:'pull'}]
  },
  shoulders: {
    gym:[{name:'پرس سرشانه هالتر یا دمبل', sets:'۴×۸-۱۰', type:'push'},{name:'نشر جانب دمبل', sets:'۳×۱۲-۱۵', type:'push'},{name:'نشر خم برای دلتوئید خلفی', sets:'۳×۱۲-۱۵', type:'pull'},{name:'شراگ سرشانه', sets:'۳×۱۲-۱۵', type:'pull'}],
    home:[{name:'شنا سوئدی سرشانه (پایک پوش‌آپ)', sets:'۳×۸-۱۲', type:'push'},{name:'نشر جانب با کش یا بطری آب', sets:'۳×۱۲-۱۵', type:'push'},{name:'نشر خم با کش', sets:'۳×۱۲-۱۵', type:'pull'}]
  },
  biceps: {
    gym:[{name:'جلوبازو هالتر', sets:'۳×۸-۱۰', type:'curl'},{name:'جلوبازو دمبل چکشی', sets:'۳×۱۰-۱۲', type:'curl'},{name:'جلوبازو لاری روی میز', sets:'۲×۱۲-۱۵', type:'curl'}],
    home:[{name:'جلوبازو با کش مقاومتی', sets:'۴×۱۲-۱۵', type:'curl'},{name:'جلوبازو با وزنه‌ی خانگی (بطری/کوله)', sets:'۳×۱۰-۱۵', type:'curl'}]
  },
  triceps: {
    gym:[{name:'پشت‌بازو سیم‌کش', sets:'۳×۱۰-۱۲', type:'extend'},{name:'پرس سینه دست جمع', sets:'۳×۸-۱۰', type:'push'},{name:'پشت‌بازو دمبل خوابیده', sets:'۲×۱۰-۱۲', type:'extend'}],
    home:[{name:'دیپ روی صندلی', sets:'۴×۱۰-۱۵', type:'extend'},{name:'شنا سوئدی الماسی', sets:'۳×۸-۱۲', type:'push'}]
  },
  legs: {
    gym:[{name:'اسکات با هالتر', sets:'۴×۸-۱۰', type:'squat'},{name:'پرس پا', sets:'۳×۱۰-۱۲', type:'squat'},{name:'ددلیفت رومانیایی', sets:'۳×۸-۱۰', type:'hinge'},{name:'جلو پا و پشت پا دستگاه', sets:'۳×۱۲', type:'squat'},{name:'ساق پا ایستاده', sets:'۳×۱۵-۲۰', type:'calf'}],
    home:[{name:'اسکات بدون وزنه', sets:'۴×۱۵-۲۰', type:'squat'},{name:'لانج', sets:'۳×۱۲ هر پا', type:'squat'},{name:'اسکات بلغاری با صندلی', sets:'۳×۱۰ هر پا', type:'squat'},{name:'ساق پا ایستاده', sets:'۴×۲۰', type:'calf'}]
  },
  glutes: {
    gym:[{name:'هیپ تراست با هالتر', sets:'۴×۱۰-۱۲', type:'hinge'},{name:'ددلیفت رومانیایی', sets:'۳×۸-۱۰', type:'hinge'},{name:'کیک‌بک با سیم‌کش', sets:'۳×۱۲ هر پا', type:'hinge'}],
    home:[{name:'پل باسن (Glute Bridge)', sets:'۴×۱۵-۲۰', type:'hinge'},{name:'لانج بلغاری با صندلی', sets:'۳×۱۲ هر پا', type:'squat'},{name:'پل باسن تک‌پا', sets:'۳×۱۲ هر پا', type:'hinge'}]
  },
  abs: {
    gym:[{name:'کرانچ با کابل', sets:'۳×۱۵', type:'core'},{name:'پلانک', sets:'۳×۴۵ ثانیه', type:'core'},{name:'بالا آوردن پا آویزان', sets:'۳×۱۲', type:'core'}],
    home:[{name:'پلانک', sets:'۳×۳۰-۶۰ ثانیه', type:'core'},{name:'کرانچ', sets:'۳×۱۵-۲۰', type:'core'},{name:'بالا آوردن پا (Leg Raise)', sets:'۳×۱۲-۱۵', type:'core'}]
  }
};
const SPLIT_TEMPLATES = {
  3: [ {label:'روز ۱', sub:'هول (سینه/شانه/پشت‌بازو)', muscles:['chest','shoulders','triceps']},
       {label:'روز ۲', sub:'پول (پشت/جلوبازو)', muscles:['back','biceps']},
       {label:'روز ۳', sub:'پا و شکم', muscles:['legs','glutes','abs']} ],
  4: [ {label:'روز ۱', sub:'سینه و پشت‌بازو', muscles:['chest','triceps']},
       {label:'روز ۲', sub:'پشت و جلوبازو', muscles:['back','biceps']},
       {label:'روز ۳', sub:'پا و باسن', muscles:['legs','glutes']},
       {label:'روز ۴', sub:'شانه و شکم', muscles:['shoulders','abs']} ]
};
/* ---- Warm-up / cool-down pools: general (based on gym/home access) + a couple of
   muscle-specific moves for whichever muscle groups today's split actually trains. ---- */
const WARMUP_GENERAL = {
  gym:[ {name:'۵ دقیقه دوچرخه ثابت یا تردمیل سبک', meta:'کاردیوی سبک'}, {name:'چرخش شانه و مچ دست و پا', meta:'۲۰ تکرار هر طرف'} ],
  home:[ {name:'جای پا (High Knees) یا طناب فرضی', meta:'۲-۳ دقیقه'}, {name:'چرخش شانه و مچ دست و پا', meta:'۲۰ تکرار هر طرف'} ]
};
const WARMUP_MUSCLE = {
  chest:[{name:'چرخش بازو رو به جلو و عقب', meta:'۱۵ تکرار هر طرف'}],
  back:[{name:'کشش دینامیک پشت (Cat-Cow)', meta:'۱۰ تکرار'}],
  shoulders:[{name:'چرخش بازو با دایره‌ی بزرگ', meta:'۱۵ تکرار هر طرف'}],
  biceps:[{name:'چرخش مچ و ساعد', meta:'۱۵ تکرار'}],
  triceps:[{name:'کشش سبک پشت‌بازو بالای سر', meta:'۲۰ ثانیه هر طرف'}],
  legs:[{name:'اسکات بدون وزنه', meta:'۱۵ تکرار'},{name:'لانج سبک در جا', meta:'۱۰ تکرار هر پا'}],
  glutes:[{name:'پل باسن سبک', meta:'۱۵ تکرار'}],
  abs:[{name:'چرخش لگن (Hip Circles)', meta:'۱۰ تکرار هر طرف'}]
};
const COOLDOWN_GENERAL = {
  gym:[ {name:'پیاده‌روی آهسته روی تردمیل', meta:'۳ دقیقه'}, {name:'چند نفس عمیق و آروم', meta:'۵ نفس'} ],
  home:[ {name:'پیاده‌روی آروم در جا', meta:'۲-۳ دقیقه'}, {name:'چند نفس عمیق و آروم', meta:'۵ نفس'} ]
};
const COOLDOWN_MUSCLE = {
  chest:[{name:'کشش سینه روی دیوار یا قاب در', meta:'۳۰ ثانیه هر طرف'}],
  back:[{name:'کشش پشت (Child\u2019s Pose)', meta:'۳۰ ثانیه'}],
  shoulders:[{name:'کشش شانه روی سینه', meta:'۲۰ ثانیه هر طرف'}],
  biceps:[{name:'کشش جلوبازو با دست صاف', meta:'۲۰ ثانیه هر طرف'}],
  triceps:[{name:'کشش پشت‌بازو بالای سر', meta:'۲۰ ثانیه هر طرف'}],
  legs:[{name:'کشش همسترینگ نشسته', meta:'۳۰ ثانیه هر پا'},{name:'کشش کوادریسپس ایستاده', meta:'۳۰ ثانیه هر پا'}],
  glutes:[{name:'کشش کبوتر یا زانو به سینه', meta:'۳۰ ثانیه هر پا'}],
  abs:[{name:'کشش کبرا', meta:'۲۰ ثانیه'}]
};
function renderWoPrepList(elId, muscles, generalPool, musclePool){
  const items = [...(generalPool[woAccess]||[])];
  muscles.forEach(m=> (musclePool[m]||[]).forEach(ex=> items.push(ex)));
  const html = items.map(ex=>`<div class="exercise-card">
    <div class="ex-icon-box" style="font-size:20px;">${elId==='woWarmupList' ? '🔥' : '🧊'}</div>
    <div class="ex-info">
      <div class="ex-name">${ex.name}</div>
      <div class="ex-meta">${ex.meta}</div>
    </div>
  </div>`).join('');
  document.getElementById(elId).innerHTML = html;
}
let woFocus = [];
let woSplit = 3;
let woAccess = 'home';
let woLevel = 'intermediate';
let woGoal = 'bulk';
let woActiveDay = 0;
let woObSelected = { level:'', goal:'', access:'', split:'', focus:[] };
const WO_LEVEL_LABELS = {beginner:'مبتدی', intermediate:'متوسط', advanced:'پیشرفته'};
const WO_GOAL_LABELS = {bulk:'عضله‌سازی', cut:'چربی‌سوزی و فرم بدن', fit:'حفظ آمادگی عمومی'};

/* ---- Free-plan personalization limits for the workout tab: فقط سطح «متوسط»، فقط برنامه‌ی
   «۳ روزه»، و بدون امکان انتخاب عضله‌ی فوکوس. کاربر پرمیوم/تو دوره‌ی آزمایشی همه چیو باز داره.
   همون الگوی seg-locked که برای طول/شدت برنامه‌ی «امروز» استفاده شده، اینجا هم تکرار می‌شه. ---- */
function applyWoPremiumLocksUI(){
  const isPremiumUser = !!(storeData.premium || (typeof isInTrial === 'function' && isInTrial()));
  ['woOBLevelSeg','woLevelSeg'].forEach(id=>{
    document.querySelectorAll('#'+id+' button').forEach(b=>{
      b.classList.toggle('seg-locked', b.dataset.val!=='intermediate' && !isPremiumUser);
    });
  });
  ['woOBSplitSeg','woSplitSeg'].forEach(id=>{
    document.querySelectorAll('#'+id+' button').forEach(b=>{
      b.classList.toggle('seg-locked', b.dataset.val!=='3' && !isPremiumUser);
    });
  });
  ['woOBFocusChips','woFocusChips'].forEach(id=>{
    const grid = document.getElementById(id);
    if(grid) grid.classList.toggle('chips-locked', !isPremiumUser);
  });
  ['woOBFocusHead','woFocusHead'].forEach(id=>{
    const head = document.getElementById(id);
    if(head) head.classList.toggle('feature-locked', !isPremiumUser);
  });
}

function woIconSvg(type){
  return `<svg class="wo-figure type-${type}" viewBox="0 0 60 60" width="30" height="30">
    <circle cx="30" cy="12" r="6"/>
    <g class="torsopart">
      <line x1="30" y1="18" x2="30" y2="38"/>
      <line class="arm-l" x1="30" y1="21" x2="18" y2="31"/>
      <line class="arm-r" x1="30" y1="21" x2="42" y2="31"/>
    </g>
    <g class="legpart">
      <line x1="30" y1="38" x2="22" y2="54"/>
      <line x1="30" y1="38" x2="38" y2="54"/>
    </g>
  </svg>`;
}
function woMusclesForFocus(){
  const set = new Set();
  woFocus.forEach(f=> (FOCUS_TO_MUSCLES[f]||[]).forEach(m=> set.add(m)));
  return set;
}
function renderWoDayPills(){
  const template = SPLIT_TEMPLATES[woSplit];
  if(woActiveDay >= template.length) woActiveDay = 0;
  document.getElementById('woDayPills').innerHTML = template.map((d,i)=>
    `<div class="wo-day-pill${i===woActiveDay?' active':''}" data-day="${i}">${d.label}<span class="wp-sub">${d.sub}</span></div>`
  ).join('');
  document.querySelectorAll('.wo-day-pill').forEach(pill=>{
    pill.addEventListener('click', ()=>{ woActiveDay = parseInt(pill.dataset.day,10); renderWoDayPills(); renderWoExercises(); });
  });
}
function renderWoExercises(){
  const template = SPLIT_TEMPLATES[woSplit];
  const day = template[woActiveDay];
  const focusMuscles = woMusclesForFocus();
  document.getElementById('woDayTitle').textContent =
    'عضله‌های امروز: ' + day.muscles.map(m=>MUSCLE_LABELS[m]).join('، ') +
    ' · سطح ' + (WO_LEVEL_LABELS[woLevel]||'متوسط') + ' · هدف ' + (WO_GOAL_LABELS[woGoal]||'عضله‌سازی');
  const baseCount = woLevel==='beginner' ? 2 : (woLevel==='advanced' ? 4 : 3);
  const focusCount = woLevel==='advanced' ? 5 : 4;
  let html = '';
  day.muscles.forEach(muscle=>{
    const isFocus = focusMuscles.has(muscle);
    const pool = (MUSCLE_EXERCISES[muscle] && MUSCLE_EXERCISES[muscle][woAccess]) || [];
    const count = isFocus ? Math.min(pool.length, focusCount) : Math.min(pool.length, baseCount);
    pool.slice(0, count).forEach((ex, idx)=>{
      const extra = isFocus && idx >= baseCount;
      html += `<div class="exercise-card${isFocus?' focus':''}">
        <div class="ex-icon-box">${woIconSvg(ex.type)}</div>
        <div class="ex-info">
          <div class="ex-name">${ex.name}</div>
          <div class="ex-meta">${MUSCLE_LABELS[muscle]} · ${ex.sets}</div>
          ${isFocus ? `<span class="ex-focus-badge">🎯 عضله‌ی هدف${extra?' · ست اضافه':''}</span>` : ''}
        </div>
      </div>`;
    });
  });
  document.getElementById('woExerciseList').innerHTML = html;
  renderWoPrepList('woWarmupList', day.muscles, WARMUP_GENERAL, WARMUP_MUSCLE);
  renderWoPrepList('woCooldownList', day.muscles, COOLDOWN_GENERAL, COOLDOWN_MUSCLE);
  updateWorkoutCoach();
}

/* ================= Guided workout session runner =================
   شروع تمرین → برای هر حرکت یه تایمرِ کار، بعدش یه استراحت کوتاه، و همینطور
   پشت سر هم تا آخر لیست؛ با دکمه‌ی رد کردن (هم برای حرکت، هم برای استراحت)
   و یه دکمه‌ی پایان تمرین برای خروج زودهنگام. در پایان، امتیاز کیفیت گرفته
   می‌شه و جلسه تو تاریخچه ذخیره می‌شه. */
function woFaToEnDigits(str){ return String(str).replace(/[۰-۹]/g, d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); }
function woParseDuration(rawText){
  const t = woFaToEnDigits(rawText||'');
  const setsMatch = t.match(/^(\d+)\s*[×xX]/);
  const sets = setsMatch ? parseInt(setsMatch[1],10) : null;
  const minMatch = t.match(/(\d+)\s*دقیقه/);
  if(minMatch) return parseInt(minMatch[1],10) * 60;
  const secMatch = t.match(/(\d+)(?:-(\d+))?\s*ثانیه/);
  if(secMatch){
    const val = secMatch[2] ? parseInt(secMatch[2],10) : parseInt(secMatch[1],10);
    return sets ? sets*val : val;
  }
  if(sets) return sets*40;
  return 30;
}
function woRestSecondsFor(item){ return item.phase === 'main' ? 40 : 12; }
function buildWoSessionQueue(){
  const queue = [];
  [ {id:'woWarmupList', phase:'warmup'}, {id:'woExerciseList', phase:'main'}, {id:'woCooldownList', phase:'cooldown'} ].forEach(sec=>{
    document.querySelectorAll('#'+sec.id+' .exercise-card').forEach(card=>{
      const nameEl = card.querySelector('.ex-name'), metaEl = card.querySelector('.ex-meta');
      if(!nameEl) return;
      const name = nameEl.textContent, meta = metaEl ? metaEl.textContent : '';
      queue.push({ phase:sec.phase, name, meta, workSec: woParseDuration(meta) });
    });
  });
  return queue;
}
let woSession = null; // {queue, idx, mode:'work'|'rest', secondsLeft, total, interval, startedAt}
function woFormatSessionTime(totalSec){
  const m = Math.floor(totalSec/60), s = totalSec%60;
  return toFa(String(m).padStart(2,'0'))+':'+toFa(String(s).padStart(2,'0'));
}
function woStartSession(){
  const queue = buildWoSessionQueue();
  if(!queue.length){ showToast('حرکتی برای امروز پیدا نشد', 'error'); return; }
  woSession = { queue, idx:0, mode:'work', secondsLeft:queue[0].workSec, total:queue[0].workSec, interval:null, startedAt:Date.now() };
  document.getElementById('woSessionOverlay').classList.add('show');
  woRenderSessionStep();
  woTickSession();
}
function woRenderSessionStep(){
  const s = woSession; if(!s) return;
  const item = s.queue[s.idx];
  const phaseLabels = {warmup:'🔥 گرم کردن', main:'🏋️ حرکت اصلی', cooldown:'🧊 سرد کردن'};
  document.getElementById('woSessionProgress').textContent = toFa(s.idx+1) + ' از ' + toFa(s.queue.length);
  document.getElementById('woSessionOverlay').classList.toggle('resting', s.mode==='rest');
  const nextItem = s.queue[s.idx+1];
  if(s.mode === 'work'){
    document.getElementById('woSessionPhaseLabel').textContent = phaseLabels[item.phase];
    document.getElementById('woSessionExName').textContent = item.name;
    document.getElementById('woSessionExMeta').textContent = item.meta;
    document.getElementById('woSessionNext').textContent = nextItem ? ('بعدی: ' + nextItem.name) : 'آخرین حرکت 🎉';
    document.getElementById('woSessionSkipBtn').textContent = 'رد کردن حرکت ⏭';
  } else {
    document.getElementById('woSessionPhaseLabel').textContent = '😌 استراحت کوتاه';
    document.getElementById('woSessionExName').textContent = '';
    document.getElementById('woSessionExMeta').textContent = nextItem ? ('بعدی: ' + nextItem.name) : '';
    document.getElementById('woSessionNext').textContent = '';
    document.getElementById('woSessionSkipBtn').textContent = 'رد کردن استراحت ⏭';
  }
  woUpdateSessionTimeDisplay();
}
function woUpdateSessionTimeDisplay(){
  const s = woSession; if(!s) return;
  document.getElementById('woSessionTime').textContent = woFormatSessionTime(Math.max(0,s.secondsLeft));
  const fill = document.getElementById('woSessionBarFill');
  if(fill) fill.style.width = (100*Math.max(0,s.secondsLeft)/Math.max(1,s.total))+'%';
}
function woTickSession(){
  clearInterval(woSession.interval);
  woSession.interval = setInterval(()=>{
    if(!woSession) return;
    woSession.secondsLeft--;
    if(woSession.secondsLeft <= 0){ woAdvanceSession(); return; }
    woUpdateSessionTimeDisplay();
  }, 1000);
}
function woAdvanceSession(){
  const s = woSession; if(!s) return;
  if(navigator.vibrate){ try{ navigator.vibrate(s.mode==='work'?[80,50,80]:60); }catch(e){} }
  if(s.mode === 'work'){
    const item = s.queue[s.idx];
    const restSec = woRestSecondsFor(item);
    const isLast = s.idx === s.queue.length - 1;
    if(isLast || restSec<=0){ woEndSessionCore(true); return; }
    s.mode = 'rest'; s.secondsLeft = restSec; s.total = restSec;
    woRenderSessionStep(); woTickSession();
  } else {
    s.idx++;
    if(s.idx >= s.queue.length){ woEndSessionCore(true); return; }
    s.mode = 'work'; s.secondsLeft = s.queue[s.idx].workSec; s.total = s.secondsLeft;
    woRenderSessionStep(); woTickSession();
  }
}
function woSkipSessionStep(){
  if(!woSession) return;
  clearInterval(woSession.interval);
  woAdvanceSession();
}
let woPendingEnd = null; // {minutes, dayLabel, exercisesDone, exercisesTotal} — waiting for quality rating
function woEndSessionCore(completedNaturally){
  const s = woSession; if(!s) return;
  clearInterval(s.interval);
  document.getElementById('woSessionOverlay').classList.remove('show');
  document.getElementById('woSessionActions').style.display = '';
  document.getElementById('woSessionConfirmRow').style.display = 'none';
  const minutes = Math.max(1, Math.round((Date.now()-s.startedAt)/60000));
  const doneCount = completedNaturally ? s.queue.length : (s.mode==='rest' ? s.idx+1 : s.idx);
  const template = SPLIT_TEMPLATES[woSplit];
  const day = template[woActiveDay];
  woSession = null;
  woPendingEnd = { minutes, dayLabel: day.label + ' - ' + day.sub, exercisesDone: doneCount, exercisesTotal: s.queue.length };
  document.querySelectorAll('#woFqStars .fq-star').forEach(b=> b.classList.remove('active'));
  document.getElementById('woQualityModal').classList.add('visible');
}
// «پایان تمرین» یه دیالوگ سفارشیِ داخل همون کارت رو نشون می‌ده (نه confirm() مرورگر که
// تو بعضی وب‌ویوها کار نمی‌کنه)؛ تایمر همون لحظه متوقف می‌شه تا وقت از دست نره.
function woRequestFinish(){
  const s = woSession; if(!s) return;
  clearInterval(s.interval);
  document.getElementById('woSessionActions').style.display = 'none';
  document.getElementById('woSessionConfirmRow').style.display = 'block';
}
function woCancelFinish(){
  if(!woSession) return;
  document.getElementById('woSessionConfirmRow').style.display = 'none';
  document.getElementById('woSessionActions').style.display = '';
  woTickSession();
}
function woConfirmFinish(){ woEndSessionCore(false); }
function woFinalizeSession(quality){
  const pending = woPendingEnd; woPendingEnd = null;
  document.getElementById('woQualityModal').classList.remove('visible');
  if(!pending) return;
  if(!storeData.woHistory) storeData.woHistory = {count:0, totalMinutes:0, qualitySum:0, qualityCount:0, history:[]};
  const wh = storeData.woHistory;
  wh.count = (wh.count||0) + 1;
  wh.totalMinutes = (wh.totalMinutes||0) + pending.minutes;
  if(quality){ wh.qualitySum = (wh.qualitySum||0) + quality; wh.qualityCount = (wh.qualityCount||0) + 1; }
  if(!wh.history) wh.history = [];
  wh.history.push({ ts:Date.now(), minutes:pending.minutes, quality:quality||null, dayLabel:pending.dayLabel,
    exercisesDone:pending.exercisesDone, exercisesTotal:pending.exercisesTotal });
  if(wh.history.length > 60) wh.history = wh.history.slice(-60);
  saveData();
  showToast('تمرین امروز ثبت شد! آفرین 💪', 'success');
  renderWoHistory();
}
document.querySelectorAll('#woFqStars .fq-star').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('#woFqStars .fq-star').forEach(b=>{
      b.classList.toggle('active', Number(b.dataset.q) <= Number(btn.dataset.q));
    });
    setTimeout(()=> woFinalizeSession(Number(btn.dataset.q)), 140);
  });
});
document.getElementById('woFqSkipBtn').addEventListener('click', ()=> woFinalizeSession(null));
document.getElementById('woStartSessionBtn').addEventListener('click', woStartSession);
document.getElementById('woSessionSkipBtn').addEventListener('click', woSkipSessionStep);
document.getElementById('woSessionFinishBtn').addEventListener('click', woRequestFinish);
document.getElementById('woSessionConfirmYesBtn').addEventListener('click', woConfirmFinish);
document.getElementById('woSessionConfirmNoBtn').addEventListener('click', woCancelFinish);


function woStarsHtml(avg){
  const rounded = Math.round(avg);
  let s = '';
  for(let i=1;i<=5;i++) s += (i<=rounded ? '⭐' : '☆');
  return s;
}
function woFormatDuration(totalMinutes){
  const h = Math.floor(totalMinutes/60), m = totalMinutes%60;
  if(h<=0) return toFa(m)+' دقیقه';
  if(m<=0) return toFa(h)+' ساعت';
  return toFa(h)+' ساعت و '+toFa(m)+' دقیقه';
}
function renderWoHistory(){
  const wh = storeData.woHistory || {count:0, totalMinutes:0, qualitySum:0, qualityCount:0, history:[]};
  const totalCard = document.getElementById('woHistTotalCard');
  if(totalCard){
    const avg = wh.qualityCount ? (wh.qualitySum/wh.qualityCount) : 0;
    totalCard.innerHTML = `
      <div style="text-align:center;flex:1;"><div class="ftl-num">${toFa(wh.count||0)}</div><div class="ftl-label">مجموع جلسه‌ها</div></div>
      <div class="ftl-div"></div>
      <div style="text-align:center;flex:1;"><div class="ftl-num">${woFormatDuration(wh.totalMinutes||0)}</div><div class="ftl-label">مجموع زمان تمرین</div></div>
      <div class="ftl-div"></div>
      <div style="text-align:center;flex:1;"><div class="ftl-num" style="font-size:15px;">${wh.qualityCount ? woStarsHtml(avg) : '—'}</div><div class="ftl-label">میانگین کیفیت</div></div>
    `;
  }
  const list = document.getElementById('woHistList');
  if(!list) return;
  const history = (wh.history||[]).slice().reverse();
  if(!history.length){
    list.innerHTML = '<div class="wo-hist-empty">هنوز هیچ تمرینی رو تا آخر نبردی؛ از تب «برنامه‌ی امروز» شروع کن تا اولین جلسه‌ت اینجا ثبت بشه.</div>';
    return;
  }
  list.innerHTML = history.map(h=>{
    const d = new Date(h.ts);
    const dateStr = d.toLocaleDateString('fa-IR');
    const timeStr = toFa(String(d.getHours()).padStart(2,'0'))+':'+toFa(String(d.getMinutes()).padStart(2,'0'));
    return `<div class="focus-stat-card" style="margin:0 14px 8px;">
      <div class="fsc-top"><span class="fsc-icon">🏋️</span><span class="fsc-title">${h.dayLabel||'تمرین'}</span>${h.quality?`<span class="fsc-identity">${woStarsHtml(h.quality)}</span>`:''}</div>
      <div class="fsc-row"><span>تاریخ</span><span>${dateStr} · ${timeStr}</span></div>
      <div class="fsc-row"><span>مدت زمان</span><span>${woFormatDuration(h.minutes||0)}</span></div>
      <div class="fsc-row"><span>حرکت‌های انجام‌شده</span><span>${toFa(h.exercisesDone||0)} از ${toFa(h.exercisesTotal||0)}</span></div>
    </div>`;
  }).join('');
}

function saveWoPrefs(){
  storeData.workoutPrefs = { focus: woFocus.slice(), split: woSplit, access: woAccess, level: woLevel, goal: woGoal, onboarded: true };
  saveData();
}
function showWorkoutOnboarding(){
  document.getElementById('woOnboard').style.display = '';
  document.getElementById('woMainContent').style.display = 'none';
  woObSelected = { level:'', goal:'', access:'', split:'', focus:[] };
  setSegActive('woOBLevelSeg', '');
  setSegActive('woOBGoalSeg', '');
  setSegActive('woOBAccessSeg', '');
  setSegActive('woOBSplitSeg', '');
  setChipActive('woOBFocusChips', []);
  document.getElementById('woOBErr').style.display = 'none';
  applyWoPremiumLocksUI();
}
function showWorkoutMain(){
  document.getElementById('woOnboard').style.display = 'none';
  document.getElementById('woMainContent').style.display = '';
  setChipActive('woFocusChips', woFocus);
  setSegActive('woSplitSeg', String(woSplit));
  setSegActive('woAccessSeg', woAccess);
  setSegActive('woLevelSeg', woLevel);
  setSegActive('woGoalSeg', woGoal);
  woActiveDay = 0;
  applyWoPremiumLocksUI();
  renderWoDayPills();
  renderWoExercises();
}
function initWorkoutTab(){
  updateWorkoutCoach(); // always populate the coach card right away, regardless of onboarding state below
  const wp = storeData.workoutPrefs;
  if(wp && wp.onboarded){
    // منبع حقیقت همون storeData.workoutPrefs ذخیره‌شده می‌مونه (دست‌نخورده)، ولی متغیرهای
    // ماژول (woLevel/woSplit/woFocus) که رندر و ساخت برنامه ازشون می‌خونن، برای کاربر رایگان
    // به مقادیر آزادِ پلن رایگان کلمپ می‌شن — دقیقاً همون رفتار currentIntensityRange() برای
    // شدتِ برنامه‌ی «امروز». اگه بعداً پرمیوم بشه، همون انتخاب‌های قبلیش بدون تغییر برمی‌گردن.
    const isPremiumUser = !!(storeData.premium || (typeof isInTrial === 'function' && isInTrial()));
    woFocus = isPremiumUser ? (wp.focus || []) : [];
    woSplit = (isPremiumUser || wp.split === 3) ? (wp.split || 3) : 3;
    woAccess = wp.access || (storeData.profile.exerciseAccess==='gym' ? 'gym' : 'home');
    woLevel = (isPremiumUser || wp.level === 'intermediate') ? (wp.level || 'intermediate') : 'intermediate';
    woGoal = wp.goal || 'bulk';
    showWorkoutMain();
  } else {
    woAccess = storeData.profile.exerciseAccess==='gym' ? 'gym' : 'home';
    showWorkoutOnboarding();
  }
}
document.getElementById('woOBLevelSeg').querySelectorAll('button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(btn.dataset.val!=='intermediate' && !requirePremium()) return;
    woObSelected.level = btn.dataset.val; setSegActive('woOBLevelSeg', woObSelected.level);
  });
});
document.getElementById('woOBGoalSeg').querySelectorAll('button').forEach(btn=>{
  btn.addEventListener('click', ()=>{ woObSelected.goal = btn.dataset.val; setSegActive('woOBGoalSeg', woObSelected.goal); });
});
document.getElementById('woOBAccessSeg').querySelectorAll('button').forEach(btn=>{
  btn.addEventListener('click', ()=>{ woObSelected.access = btn.dataset.val; setSegActive('woOBAccessSeg', woObSelected.access); });
});
document.getElementById('woOBSplitSeg').querySelectorAll('button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(btn.dataset.val!=='3' && !requirePremium()) return;
    woObSelected.split = btn.dataset.val; setSegActive('woOBSplitSeg', woObSelected.split);
  });
});
document.getElementById('woOBFocusChips').addEventListener('click', (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  if(!requirePremium()) return;
  const v = btn.dataset.val;
  const idx = woObSelected.focus.indexOf(v);
  if(idx>=0) woObSelected.focus.splice(idx,1);
  else { if(woObSelected.focus.length>=2) woObSelected.focus.shift(); woObSelected.focus.push(v); }
  setChipActive('woOBFocusChips', woObSelected.focus);
});
document.getElementById('woOBSubmitBtn').addEventListener('click', ()=>{
  if(!woObSelected.level || !woObSelected.goal || !woObSelected.access || !woObSelected.split){
    document.getElementById('woOBErr').style.display = 'block';
    return;
  }
  document.getElementById('woOBErr').style.display = 'none';
  woLevel = woObSelected.level;
  woGoal = woObSelected.goal;
  woAccess = woObSelected.access;
  woSplit = parseInt(woObSelected.split, 10);
  woFocus = woObSelected.focus.slice();
  saveWoPrefs();
  showWorkoutMain();
  showToast('برنامه‌ی تمرینیت آماده شد 💪', 'success');
});
document.getElementById('woFocusChips').addEventListener('click', (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  if(!requirePremium()) return;
  const v = btn.dataset.val;
  const idx = woFocus.indexOf(v);
  if(idx>=0) woFocus.splice(idx,1);
  else { if(woFocus.length>=2) woFocus.shift(); woFocus.push(v); }
  setChipActive('woFocusChips', woFocus);
  saveWoPrefs();
  renderWoExercises();
});
document.getElementById('woSplitSeg').querySelectorAll('button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(btn.dataset.val!=='3' && !requirePremium()) return;
    woSplit = parseInt(btn.dataset.val,10);
    setSegActive('woSplitSeg', String(woSplit));
    woActiveDay = 0;
    saveWoPrefs();
    renderWoDayPills();
    renderWoExercises();
  });
});
document.getElementById('woAccessSeg').querySelectorAll('button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    woAccess = btn.dataset.val;
    setSegActive('woAccessSeg', woAccess);
    saveWoPrefs();
    renderWoExercises();
  });
});
document.getElementById('woLevelSeg').querySelectorAll('button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(btn.dataset.val!=='intermediate' && !requirePremium()) return;
    woLevel = btn.dataset.val;
    setSegActive('woLevelSeg', woLevel);
    saveWoPrefs();
    renderWoExercises();
  });
});
document.getElementById('woGoalSeg').querySelectorAll('button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    woGoal = btn.dataset.val;
    setSegActive('woGoalSeg', woGoal);
    saveWoPrefs();
    renderWoExercises();
  });
});
document.getElementById('woRedoOnboardBtn').addEventListener('click', ()=>{
  showWorkoutOnboarding();
});

/* ==================== Onboarding wizard controller ==================== */
/* Drives every .journey-track on the page (account gate + onboarding wizard share the same 3 stages:
   1 = account creation, 2 = personal info, 3 = entering the app). Stages before `step` are marked
   done (green), `step` itself is marked active, unless opts.complete is passed — then `step` itself
   is also marked done and its incoming line fills, used for the final "entering the app" moment which
   has no screen of its own. */
function setJourneyStep(step, opts){
  const complete = !!(opts && opts.complete);
  document.querySelectorAll('.journey-track').forEach(track=>{
    track.querySelectorAll('.journey-node').forEach(el=>{
      const n = parseInt(el.dataset.jnode, 10);
      el.classList.toggle('done', n < step || (n===step && complete));
      el.classList.toggle('active', n === step && !complete);
    });
    track.querySelectorAll('.journey-line').forEach(el=>{
      const n = parseInt(el.dataset.jline, 10);
      el.classList.toggle('filled', n < step || (n===step && complete));
    });
  });
}
const OB_STEPS = 11;
let obStep = 0;
let obEditMode = false;
let obSelected = { gender:'', goal:'', addictions:[], goodHabits:[], exerciseAccess:'', exerciseLevel:'', sleepPattern:'', supportStyle:'', duration:'', frequency:'', riskTimes:[], commitmentReward:'', commitmentPunishment:'', healthHasCondition:'no', healthTags:[] };
const FREQ_LENGTH_SUGGEST = {f1:30, f2:60, f3:90, f4:90};
const DURATION_LABELS = {d1:'کمتر از ۱ ماه', d2:'۱ تا ۶ ماه', d3:'۶ ماه تا ۲ سال', d4:'بیشتر از ۲ سال'};
const FREQUENCY_LABELS = {f1:'خیلی کم، گاه‌به‌گاه', f2:'متوسط، چند بار در هفته', f3:'زیاد، تقریباً هر روز', f4:'خیلی زیاد، چند بار در روز'};
const MARITAL_LABELS = {single:'مجرد', married:'متاهل'};
const RISK_TIME_LABELS = {morning:'🌅 صبح', noon:'☀️ ظهر/عصر', night:'🌙 شب', latenight:'🌌 سحر/دیروقت'};
const GOOD_HABIT_LABELS = {
  reading:"مطالعه‌ی روزانه", voice:"صداسازی / فن بیان", skill:"یادگیری یه مهارت جدید",
  social:"بهبود روابط عمومی", language:"یادگیری زبان دوم", instrument:"یادگیری یه ساز",
  exercise:"نرمش و ورزش منظم", other:"یه هدف شخصی دیگه"
};
const REWARD_LABELS = {book:'خرید یه کتاب', gadget:'خرید یه وسیله‌ی دلخواه', trip:'یه سفر یا خروجی کوچیک', treat:'یه خودشیرینی/تفریح دوست‌داشتنی', other:''};
const PUNISH_LABELS = {none:'', donate_charity:'کمک مالی به یه خیریه', donate_dev:'حمایت مالی از سازنده‌ی اپ', detox:'یه روز کامل قطع اینستاگرام/شبکه‌ی اجتماعی', chore:'انجام یه کار خسته‌کننده که ازش فراری‌ام', other:''};
function rewardText(profile){
  const p = profile || storeData.profile || {};
  if(!p.commitmentReward) return '';
  return p.commitmentReward==='other' ? (p.commitmentRewardOther||'یه پاداش دلخواه') : REWARD_LABELS[p.commitmentReward];
}
function punishText(profile){
  const p = profile || storeData.profile || {};
  if(!p.commitmentPunishment || p.commitmentPunishment==='none') return '';
  return p.commitmentPunishment==='other' ? (p.commitmentPunishOther||'یه تاوان دلخواه') : PUNISH_LABELS[p.commitmentPunishment];
}

function setSegActive(containerId, val){
  document.querySelectorAll('#'+containerId+' button').forEach(b=> b.classList.toggle('active', b.dataset.val===val));
}
function setChipActive(containerId, vals){
  document.querySelectorAll('#'+containerId+' .onboard-chip').forEach(b=> b.classList.toggle('active', vals.indexOf(b.dataset.val)>=0));
}
function renderObGenderPreview(){
  const el = document.getElementById('obGenderPreview');
  if(!el) return;
  el.innerHTML = buildCoachSVG('happy', 'obpreview', obSelected.gender);
}
function showObStep(n){
  obStep = n;
  document.querySelectorAll('.onboard-step').forEach(s=> s.classList.toggle('active', parseInt(s.dataset.step,10)===n));
  document.getElementById('obProgressFill').style.width = Math.round(((n+1)/OB_STEPS)*100)+'%';
  document.getElementById('obBackBtn').style.visibility = n===0 ? 'hidden' : 'visible';
  document.getElementById('obNextBtn').textContent = n===OB_STEPS-1 ? (obEditMode ? 'ذخیره و به‌روزرسانی ✅' : 'شروع کن 🚀') : 'بعدی';
  document.querySelectorAll('.onboard-err').forEach(e=> e.style.display='none');
  if(n===1) renderObGenderPreview();
  if(n===OB_STEPS-1) renderObSummary();
  document.querySelector('.onboard-body').scrollTop = 0;
}
function validateObStep(n){
  if(n===0){
    if(!document.getElementById('obFirstName').value.trim()){ document.getElementById('obErr0').style.display='block'; return false; }
  }
  if(n===1){
    if(!document.getElementById('obAge').value || !obSelected.gender || !obSelected.maritalStatus){ document.getElementById('obErr1').style.display='block'; return false; }
  }
  if(n===2){
    if(!document.getElementById('obHeight').value || !document.getElementById('obWeight').value || !obSelected.goal){
      document.getElementById('obErr2').style.display='block'; return false;
    }
  }
  if(n===3){
    const addOtherOk = obSelected.addictions.indexOf('other')<0 || document.getElementById('obOtherText').value.trim();
    const goodOtherOk = obSelected.goodHabits.indexOf('other')<0 || document.getElementById('obGoodHabitOtherText').value.trim();
    if(obSelected.addictions.length===0 || obSelected.goodHabits.length===0 || !addOtherOk || !goodOtherOk){
      document.getElementById('obErr3').style.display='block'; return false;
    }
  }
  if(n===4){
    if(!obSelected.duration || !obSelected.frequency || obSelected.riskTimes.length===0){
      document.getElementById('obErr4').style.display='block'; return false;
    }
  }
  if(n===5){
    if(!obSelected.exerciseAccess || !obSelected.exerciseLevel || !obSelected.sleepPattern){
      document.getElementById('obErr5').style.display='block'; return false;
    }
  }
  if(n===6){
    // Health/medication step is fully optional by design — nothing to require, even
    // when "دارم" is selected. The tag chips, free-text details, and medication
    // notes are all opt-in extras on top of that.
    return true;
  }
  if(n===7){
    if(!obSelected.supportStyle){ document.getElementById('obErr6').style.display='block'; return false; }
  }
  if(n===8){
    if(!document.getElementById('obWhy').value.trim() || !document.getElementById('obGoalShort').value.trim()){
      document.getElementById('obErr7').style.display='block'; return false;
    }
  }
  if(n===9){
    const rewardOtherOk = obSelected.commitmentReward!=='other' || document.getElementById('obRewardOtherText').value.trim();
    const punishOtherOk = obSelected.commitmentPunishment!=='other' || document.getElementById('obPunishOtherText').value.trim();
    if(!obSelected.commitmentReward || !obSelected.commitmentPunishment || !rewardOtherOk || !punishOtherOk){
      document.getElementById('obErr8').style.display='block'; return false;
    }
  }
  return true;
}
function renderObSummary(){
  const name = (document.getElementById('obFirstName').value.trim()+' '+document.getElementById('obLastName').value.trim()).trim() || 'دوست من';
  const addictionsList = obSelected.addictions.map(a=> a==='other' ? (document.getElementById('obOtherText').value.trim()||'یه موضوع دیگه') : ADDICTION_LABELS[a]).join('، ') || '-';
  const goodHabitsList = obSelected.goodHabits.map(g=> g==='other' ? (document.getElementById('obGoodHabitOtherText').value.trim()||'یه هدف دیگه') : GOOD_HABIT_LABELS[g]).join('، ') || '-';
  const exText = {gym:'باشگاه دارم', home:'خونه، بدون وسیله', none:'فعلاً هیچ‌کدوم'}[obSelected.exerciseAccess] || '-';
  const suggestedLen = FREQ_LENGTH_SUGGEST[obSelected.frequency] || storeData.programLength || 90;
  let healthText = 'چیزی ثبت نشده';
  if(obSelected.healthHasCondition==='yes'){
    const tagsList = obSelected.healthTags.map(t=> t==='other' ? (document.getElementById('obHealthTagOtherText').value.trim()||'یه چیز دیگه') : HEALTH_TAG_LABELS[t]).filter(Boolean).join('، ');
    const hasDetails = document.getElementById('obHealthDetails').value.trim() || document.getElementById('obHealthMeds').value.trim();
    healthText = (tagsList || 'ثبت شد') + (hasDetails ? ' (توضیح/دارو هم نوشتی)' : '') + (document.getElementById('obHealthConsider').checked ? ' — در برنامه لحاظ می‌شه' : '');
  }
  const rows = [
    ['اسم', name],
    ['سن', document.getElementById('obAge').value || '-'],
    ['وضعیت تاهل', MARITAL_LABELS[obSelected.maritalStatus] || '-'],
    ['قد / وزن', (document.getElementById('obHeight').value||'-')+' cm / '+(document.getElementById('obWeight').value||'-')+' kg'],
    ['وزن هدف', document.getElementById('obGoalWeight').value ? document.getElementById('obGoalWeight').value+' kg' : 'مشخص نشده'],
    ['هدف بدنی', goalLabel(obSelected.goal)],
    ['روی این عادت‌ها کار می‌کنیم', addictionsList],
    ['این عادت‌های خوب رو هم می‌سازیم', goodHabitsList],
    ['مدت درگیری', DURATION_LABELS[obSelected.duration] || '-'],
    ['شدت تکرار', FREQUENCY_LABELS[obSelected.frequency] || '-'],
    ['ورزش', exText],
    ['سلامت جسمی/روانی', healthText],
    ['طول برنامه‌ی پیشنهادی', toFa(suggestedLen)+' روز'],
    ['🟢 پاداش موفقیت', rewardText(obSelected)||'-'],
    ['🔴 تاوان لغزش بزرگ', punishText(obSelected)||'بدون تاوان']
  ];
  document.getElementById('obSummaryBox').innerHTML = rows.map(r=>`<div class="onboard-summary-row"><span>${r[0]}</span><span>${r[1]}</span></div>`).join('');
}
function openOnboarding(editMode){
  obEditMode = !!editMode;
  if(editMode){
    const p = storeData.profile;
    document.getElementById('obFirstName').value = p.firstName||'';
    document.getElementById('obLastName').value = p.lastName||'';
    document.getElementById('obAge').value = p.age||'';
    document.getElementById('obHeight').value = p.height||'';
    document.getElementById('obWeight').value = p.weight||'';
    document.getElementById('obGoalWeight').value = p.goalWeight||'';
    document.getElementById('obOtherText').value = p.otherAddictionText||'';
    document.getElementById('obGoodHabitOtherText').value = p.otherGoodHabitText||'';
    document.getElementById('obWhy').value = storeData.whyText||'';
    document.getElementById('obGoalShort').value = p.goalShort||'';
    document.getElementById('obGoalLong').value = p.goalLong||'';
    document.getElementById('obIfThen').value = p.ifThenPlan||'';
    document.getElementById('obStress').value = p.stressLevel||3;
    document.getElementById('obStressNum').textContent = toFa(p.stressLevel||3);
    document.getElementById('obMotivation').value = p.motivationLevel||7;
    document.getElementById('obMotivationNum').textContent = toFa(p.motivationLevel||7);
    document.getElementById('obContactName').value = (storeData.supportContact && storeData.supportContact.name) || '';
    document.getElementById('obContactPhone').value = (storeData.supportContact && storeData.supportContact.phone) || '';
    const health = p.health || {};
    document.getElementById('obHealthDetails').value = health.detailsText||'';
    document.getElementById('obHealthMeds').value = health.medicationsText||'';
    document.getElementById('obHealthTagOtherText').value = health.otherTagText||'';
    document.getElementById('obHealthConsider').checked = health.considerInPlan!==false;
    obSelected = { gender:p.gender||'', maritalStatus:p.maritalStatus||'', goal:p.goal||'', addictions:[...(p.addictions||[])], goodHabits:[...(p.goodHabits||[])],
      exerciseAccess:p.exerciseAccess||'', exerciseLevel:p.exerciseLevel||'', sleepPattern:p.sleepPattern||'',
      supportStyle:p.supportStyle||'gentle', duration:p.duration||'', frequency:p.frequency||'', riskTimes:[...(p.riskTimes||[])],
      commitmentReward:p.commitmentReward||'', commitmentPunishment:p.commitmentPunishment||'',
      healthHasCondition: health.hasCondition ? 'yes' : 'no', healthTags:[...(health.tags||[])] };
    document.getElementById('obRewardOtherText').value = p.commitmentRewardOther||'';
    document.getElementById('obPunishOtherText').value = p.commitmentPunishOther||'';
    setChipActive('obRewardChips', [obSelected.commitmentReward]);
    setChipActive('obPunishChips', [obSelected.commitmentPunishment]);
    document.getElementById('obRewardOtherWrap').style.display = obSelected.commitmentReward==='other' ? 'block' : 'none';
    document.getElementById('obPunishOtherWrap').style.display = obSelected.commitmentPunishment==='other' ? 'block' : 'none';
    setSegActive('obGenderSeg', obSelected.gender);
    setSegActive('obMaritalSeg', obSelected.maritalStatus);
    renderObGenderPreview();
    setChipActive('obGoalChips', [obSelected.goal]);
    setChipActive('obAddictionChips', obSelected.addictions);
    document.getElementById('obOtherWrap').style.display = obSelected.addictions.indexOf('other')>=0 ? 'block' : 'none';
    setChipActive('obGoodHabitChips', obSelected.goodHabits);
    document.getElementById('obGoodHabitOtherWrap').style.display = obSelected.goodHabits.indexOf('other')>=0 ? 'block' : 'none';
    setChipActive('obDurationChips', [obSelected.duration]);
    setChipActive('obFrequencyChips', [obSelected.frequency]);
    setChipActive('obRiskChips', obSelected.riskTimes);
    setSegActive('obExAccessSeg', obSelected.exerciseAccess);
    setSegActive('obExLevelSeg', obSelected.exerciseLevel);
    setSegActive('obSleepSeg', obSelected.sleepPattern);
    setSegActive('obSupportSeg', obSelected.supportStyle);
    setSegActive('obHealthHasSeg', obSelected.healthHasCondition);
    document.getElementById('obHealthDetailsWrap').style.display = obSelected.healthHasCondition==='yes' ? 'block' : 'none';
    setChipActive('obHealthTagChips', obSelected.healthTags);
    document.getElementById('obHealthTagOtherWrap').style.display = obSelected.healthTags.indexOf('other')>=0 ? 'block' : 'none';
  } else {
    obSelected = { gender:'', maritalStatus:'', goal:'', addictions:[], goodHabits:[], exerciseAccess:'', exerciseLevel:'', sleepPattern:'', supportStyle:'', duration:'', frequency:'', riskTimes:[], commitmentReward:'', commitmentPunishment:'', healthHasCondition:'no', healthTags:[] };
    document.getElementById('obContactName').value = '';
    document.getElementById('obContactPhone').value = '';
    document.getElementById('obRewardOtherText').value = '';
    document.getElementById('obPunishOtherText').value = '';
    document.getElementById('obRewardOtherWrap').style.display = 'none';
    document.getElementById('obPunishOtherWrap').style.display = 'none';
    document.getElementById('obGoodHabitOtherText').value = '';
    document.getElementById('obGoodHabitOtherWrap').style.display = 'none';
    document.getElementById('obHealthDetails').value = '';
    document.getElementById('obHealthMeds').value = '';
    document.getElementById('obHealthTagOtherText').value = '';
    document.getElementById('obHealthConsider').checked = true;
    document.getElementById('obHealthDetailsWrap').style.display = 'none';
    setSegActive('obHealthHasSeg', 'no');
    setChipActive('obHealthTagChips', []);
    document.getElementById('obHealthTagOtherWrap').style.display = 'none';
  }
  document.getElementById('onboardOverlay').classList.add('show');
  showObStep(0);
  maybeSuggestIntroNarration();
}
function finishOnboarding(){
  const firstName = document.getElementById('obFirstName').value.trim() || 'دوست من';
  const lastName = document.getElementById('obLastName').value.trim();
  const age = parseInt(document.getElementById('obAge').value,10) || null;
  const height = parseFloat(document.getElementById('obHeight').value) || null;
  const weight = parseFloat(document.getElementById('obWeight').value) || null;
  const goalWeight = parseFloat(document.getElementById('obGoalWeight').value) || null;
  const otherText = document.getElementById('obOtherText').value.trim();
  const otherGoodHabitText = document.getElementById('obGoodHabitOtherText').value.trim();
  const whyText = document.getElementById('obWhy').value.trim();
  const goalShort = document.getElementById('obGoalShort').value.trim();
  const goalLong = document.getElementById('obGoalLong').value.trim();
  const ifThen = document.getElementById('obIfThen').value.trim();
  const stress = parseInt(document.getElementById('obStress').value,10) || 3;
  const motivation = parseInt(document.getElementById('obMotivation').value,10) || 7;
  const contactName = document.getElementById('obContactName').value.trim();
  const contactPhone = document.getElementById('obContactPhone').value.trim();
  const rewardOther = document.getElementById('obRewardOtherText').value.trim();
  const punishOther = document.getElementById('obPunishOtherText').value.trim();
  const healthHas = obSelected.healthHasCondition==='yes';
  const health = {
    hasCondition: healthHas,
    tags: healthHas ? obSelected.healthTags.slice() : [],
    otherTagText: healthHas ? document.getElementById('obHealthTagOtherText').value.trim() : '',
    detailsText: healthHas ? document.getElementById('obHealthDetails').value.trim() : '',
    medicationsText: healthHas ? document.getElementById('obHealthMeds').value.trim() : '',
    considerInPlan: healthHas ? document.getElementById('obHealthConsider').checked : true
  };

  storeData.profile = Object.assign(defaultProfile(), storeData.profile, {
    firstName, lastName, age, height, weight, goalWeight,
    gender: obSelected.gender, maritalStatus: obSelected.maritalStatus, goal: obSelected.goal || 'lifestyle',
    addictions: obSelected.addictions.slice(), otherAddictionText: otherText,
    goodHabits: obSelected.goodHabits.slice(), otherGoodHabitText: otherGoodHabitText,
    exerciseAccess: obSelected.exerciseAccess || 'home', exerciseLevel: obSelected.exerciseLevel || 'beginner',
    sleepPattern: obSelected.sleepPattern || 'irregular', stressLevel: stress, motivationLevel: motivation,
    supportStyle: obSelected.supportStyle || 'gentle', goalShort, goalLong, ifThenPlan: ifThen,
    duration: obSelected.duration, frequency: obSelected.frequency, riskTimes: obSelected.riskTimes.slice(),
    commitmentReward: obSelected.commitmentReward, commitmentRewardOther: rewardOther,
    commitmentPunishment: obSelected.commitmentPunishment, commitmentPunishOther: punishOther,
    health,
    onboardingComplete: true
  });
  storeData.whyText = whyText;
  if(contactName) storeData.supportContact = { name: contactName, phone: contactPhone };
  if(!obEditMode && obSelected.frequency && FREQ_LENGTH_SUGGEST[obSelected.frequency]){
    // Only auto-set the suggested length on the very first onboarding. If the user
    // is editing their profile later, don't silently overwrite a length they may
    // have manually chosen afterward in Settings.
    storeData.programLength = FREQ_LENGTH_SUGGEST[obSelected.frequency];
  }
  if(!storeData.startDate){
    storeData.startDate = today;
    storeData.startTimestamp = new Date().toISOString();
  }
  saveData();
  if(!obEditMode){
    // Not a profile re-edit from Settings: this is the first-time flow, so let the
    // journey track fill to its 3rd ("ورود به برنامه") stage briefly — it needs no
    // screen of its own, just this moment of completion — before revealing the app.
    setJourneyStep(2, {complete:true});
    setTimeout(()=> document.getElementById('onboardOverlay').classList.remove('show'), 550);
  } else {
    document.getElementById('onboardOverlay').classList.remove('show');
  }
  document.getElementById('whyArea').value = storeData.whyText;
  document.getElementById('heightInput').value = storeData.profile.height ?? '';
  document.getElementById('weightInput').value = storeData.profile.weight ?? '';
  document.getElementById('contactNameInput').value = storeData.supportContact ? storeData.supportContact.name||'' : '';
  document.getElementById('contactPhoneInput').value = storeData.supportContact ? storeData.supportContact.phone||'' : '';
  renderIfThenUI();
  renderProfileSummaryCard();
  renderLengthSeg();
  currentPhase = getPhase(programDay());
  entry.total = totalToday();
  render();
  updateLiveCounter();
  showToast(obEditMode ? 'پروفایلت به‌روز شد ✅' : 'برنامه‌ات دقیقاً بر اساس خودت چیده شد 🎉', 'success');
}
document.getElementById('obNextBtn').addEventListener('click', ()=>{
  if(!validateObStep(obStep)) return;
  if(obStep === OB_STEPS-1){ finishOnboarding(); return; }
  showObStep(obStep+1);
});
document.getElementById('obBackBtn').addEventListener('click', ()=>{ if(obStep>0) showObStep(obStep-1); });
function skipOnboarding(){
  if(obEditMode){
    // Editing an already-personalized (or already-skipped) profile from the menu/settings:
    // skip = cancel, close without saving anything.
    document.getElementById('onboardOverlay').classList.remove('show');
    return;
  }
  // First-time flow: let the user into the app with the generic/default plan,
  // and remember they skipped so we don't force this screen on them again.
  storeData.profile = Object.assign(defaultProfile(), storeData.profile, { onboardingSkipped:true });
  saveData();
  document.getElementById('onboardOverlay').classList.remove('show');
  currentPhase = getPhase(programDay());
  entry.total = totalToday();
  render();
  updatePersonalizeHints();
  showToast('باشه، فعلاً با برنامه‌ی عمومی شروع کن — هر وقت خواستی از منو تکمیلش کن', 'info');
}
document.getElementById('obSkipBtn').addEventListener('click', skipOnboarding);
function updatePersonalizeHints(){
  const done = !!(storeData.profile && storeData.profile.onboardingComplete);
  document.querySelectorAll('#personalizeHintBanner, #personalizeHintBanner2').forEach(el=>{
    if(!el) return;
    el.style.display = done ? 'none' : 'flex';
  });
  const note = document.getElementById('personalizeHintNote');
  if(note) note.style.display = done ? 'none' : 'block';
  const badge = document.getElementById('personalizeMenuBadge');
  if(badge) badge.style.display = done ? 'none' : 'inline-block';
}
document.getElementById('personalizeHintBtn').addEventListener('click', ()=> openOnboarding(true));
document.getElementById('personalizeHintBtn2').addEventListener('click', ()=> openOnboarding(true));
document.getElementById('personalizeMenuItem').addEventListener('click', ()=>{
  closeSideMenu();
  openOnboarding(true);
});
document.getElementById('obGenderSeg').addEventListener('click', (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  obSelected.gender = btn.dataset.val; setSegActive('obGenderSeg', obSelected.gender);
  document.getElementById('obErr1').style.display='none';
  renderObGenderPreview();
});
document.getElementById('obMaritalSeg').addEventListener('click', (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  obSelected.maritalStatus = btn.dataset.val; setSegActive('obMaritalSeg', obSelected.maritalStatus);
  document.getElementById('obErr1').style.display='none';
});
document.getElementById('obGoalChips').addEventListener('click', (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  obSelected.goal = btn.dataset.val; setChipActive('obGoalChips', [obSelected.goal]);
});
document.getElementById('obAddictionChips').addEventListener('click', (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  const v = btn.dataset.val;
  const idx = obSelected.addictions.indexOf(v);
  if(idx>=0) obSelected.addictions.splice(idx,1); else obSelected.addictions.push(v);
  setChipActive('obAddictionChips', obSelected.addictions);
  document.getElementById('obOtherWrap').style.display = obSelected.addictions.indexOf('other')>=0 ? 'block' : 'none';
});
document.getElementById('obGoodHabitChips').addEventListener('click', (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  const v = btn.dataset.val;
  const idx = obSelected.goodHabits.indexOf(v);
  if(idx>=0) obSelected.goodHabits.splice(idx,1); else obSelected.goodHabits.push(v);
  setChipActive('obGoodHabitChips', obSelected.goodHabits);
  document.getElementById('obGoodHabitOtherWrap').style.display = obSelected.goodHabits.indexOf('other')>=0 ? 'block' : 'none';
});
document.getElementById('obRewardChips').addEventListener('click', (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  obSelected.commitmentReward = btn.dataset.val;
  setChipActive('obRewardChips', [obSelected.commitmentReward]);
  document.getElementById('obRewardOtherWrap').style.display = obSelected.commitmentReward==='other' ? 'block' : 'none';
});
document.getElementById('obPunishChips').addEventListener('click', (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  obSelected.commitmentPunishment = btn.dataset.val;
  setChipActive('obPunishChips', [obSelected.commitmentPunishment]);
  document.getElementById('obPunishOtherWrap').style.display = obSelected.commitmentPunishment==='other' ? 'block' : 'none';
});
document.getElementById('obDurationChips').addEventListener('click', (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  obSelected.duration = btn.dataset.val; setChipActive('obDurationChips', [obSelected.duration]);
});
document.getElementById('obFrequencyChips').addEventListener('click', (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  obSelected.frequency = btn.dataset.val; setChipActive('obFrequencyChips', [obSelected.frequency]);
});
document.getElementById('obRiskChips').addEventListener('click', (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  const v = btn.dataset.val;
  const idx = obSelected.riskTimes.indexOf(v);
  if(idx>=0) obSelected.riskTimes.splice(idx,1); else obSelected.riskTimes.push(v);
  setChipActive('obRiskChips', obSelected.riskTimes);
});
document.getElementById('obExAccessSeg').addEventListener('click', (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  obSelected.exerciseAccess = btn.dataset.val; setSegActive('obExAccessSeg', obSelected.exerciseAccess);
});
document.getElementById('obExLevelSeg').addEventListener('click', (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  obSelected.exerciseLevel = btn.dataset.val; setSegActive('obExLevelSeg', obSelected.exerciseLevel);
});
document.getElementById('obSleepSeg').addEventListener('click', (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  obSelected.sleepPattern = btn.dataset.val; setSegActive('obSleepSeg', obSelected.sleepPattern);
});
document.getElementById('obHealthHasSeg').addEventListener('click', (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  obSelected.healthHasCondition = btn.dataset.val; setSegActive('obHealthHasSeg', obSelected.healthHasCondition);
  document.getElementById('obHealthDetailsWrap').style.display = obSelected.healthHasCondition==='yes' ? 'block' : 'none';
});
document.getElementById('obHealthTagChips').addEventListener('click', (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  const v = btn.dataset.val;
  const idx = obSelected.healthTags.indexOf(v);
  if(idx>=0) obSelected.healthTags.splice(idx,1); else obSelected.healthTags.push(v);
  setChipActive('obHealthTagChips', obSelected.healthTags);
  document.getElementById('obHealthTagOtherWrap').style.display = obSelected.healthTags.indexOf('other')>=0 ? 'block' : 'none';
});
document.getElementById('obSupportSeg').addEventListener('click', (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  obSelected.supportStyle = btn.dataset.val; setSegActive('obSupportSeg', obSelected.supportStyle);
});
document.getElementById('obStress').addEventListener('input', (e)=>{ document.getElementById('obStressNum').textContent = toFa(e.target.value); });
document.getElementById('obMotivation').addEventListener('input', (e)=>{ document.getElementById('obMotivationNum').textContent = toFa(e.target.value); });

/* ==================== Support contact (settings) ==================== */
document.getElementById('contactNameInput').addEventListener('input', (e)=>{
  if(!storeData.supportContact) storeData.supportContact = {name:'', phone:''};
  storeData.supportContact.name = e.target.value;
  saveData();
});
document.getElementById('contactPhoneInput').addEventListener('input', (e)=>{
  if(!storeData.supportContact) storeData.supportContact = {name:'', phone:''};
  storeData.supportContact.phone = e.target.value;
  saveData();
});

/* ==================== Invite friends (ported) ==================== */
// ثابت: لینک دانلود اپ — صفحه‌ی رسمی برنامه در مایکت (طبق قوانین مایکت، معرفی/ارجاع
// باید فقط به مایکت باشه، نه به مارکت یا دامنه‌ی دیگه).
const APP_DOWNLOAD_URL = 'https://myket.ir/app/com.mahdihd648.dreamlifeapp';
const INVITE_MESSAGE = 'یه اپ پیدا کردم به اسم Dreamlife که واقعا آدمو معتاد به بهتر شدن می‌کنه 🚀 یه مشاور شخصی هوش مصنوعی داره که انگار واقعا حرفاتو می‌فهمه، یه گروه چت با آدمای هم‌مسیر که هوای همو دارن، و مدیتیشن و فن بیان هم توشه. با کد دعوتم عضو شو تا هردومون تخفیف بگیریم 🎁';
document.getElementById('inviteShareBtn').addEventListener('click', async ()=>{
  const codeText = document.getElementById('inviteTabCode').textContent;
  const msg = codeText && codeText !== '—' ? INVITE_MESSAGE + ` کد دعوتم اینه: ${codeText} — ` : INVITE_MESSAGE;
  const text = msg + APP_DOWNLOAD_URL;
  // اول با پلاگین نیتیو Capacitor (اگه توی پروژه اضافه شده باشه) شیت اشتراک‌گذاری واقعی گوشی رو باز می‌کنیم،
  // چون وب‌ویوی اندروید برخلاف مرورگر کروم معمولاً navigator.share رو پیاده‌سازی نمی‌کنه.
  const nativeShare = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Share;
  if(nativeShare){
    try{ await nativeShare.share({ title:'چک‌لیست روزانه', text: msg, url: APP_DOWNLOAD_URL, dialogTitle:'اشتراک‌گذاری کد دعوت' }); return; }
    catch(err){ /* کاربر لغو کرد یا شکست خورد؛ می‌ریم سراغ کپی */ }
  } else if(navigator.share){
    try{ await navigator.share({ title:'چک‌لیست روزانه', text: msg, url: APP_DOWNLOAD_URL }); return; }
    catch(err){ if(err && err.name === 'AbortError') return; /* کاربر خودش لغو کرد، کپی نکن */ }
  }
  try{ await navigator.clipboard.writeText(text); showToast('پیام دعوت کپی شد'); }
  catch(err){ showToast('کپی نشد، خودت کپی کن', 'error'); }
});

/* ==================== In-App Billing (Myket) ====================
   جایگزین زرین‌پال. سمت نیتیو یه پلاگین Capacitor به اسم Capacitor.Plugins.MarketBilling
   وجود داره (فایل native-billing/MarketBillingPlugin.java) که به سرویس بیلینگ مایکت وصل می‌شه.
   متدها: purchase({sku}) => {sku,purchaseToken,orderId,store}, getPurchases() => {purchases:[...]},
   consumePurchase({purchaseToken}), getStore() => {store}.
   SKUهای «premium»، «donate_50000»، «donate_100000»، «donate_200000» باید با همین شناسه‌ها
   توی پنل توسعه‌دهنده‌ی مایکت ثبت بشن (با قیمت‌های متناظر). */
function getIabPlugin(){
  if(window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.MarketBilling) return Capacitor.Plugins.MarketBilling;
  // تشخیصی: این لاگ مشخص می‌کنه دقیقاً کدوم لایه گم شده - خودِ Capacitor لود نشده،
  // یا Capacitor هست ولی پلاگین MarketBilling توش رجیستر نشده. با اتصال گوشی به
  // Chrome (chrome://inspect) یا adb logcat موقع تست، این خط دقیقاً می‌گه مشکل کجاست.
  console.error('[IAB] پلاگین MarketBilling پیدا نشد.',
    'Capacitor روی صفحه هست؟', !!window.Capacitor,
    '| Capacitor.Plugins هست؟', !!(window.Capacitor && Capacitor.Plugins),
    '| پلاگین‌های واقعاً رجیسترشده:', (window.Capacitor && Capacitor.Plugins) ? Object.keys(Capacitor.Plugins).join(', ') : 'n/a (Capacitor.Plugins تعریف نشده)');
  iabDebugStep('پلاگین بیلینگ (MarketBilling)', false,
    'Capacitor=' + !!window.Capacitor +
    ' | Capacitor.Plugins=' + !!(window.Capacitor && Capacitor.Plugins) +
    ' | پلاگین‌های رجیسترشده=' + ((window.Capacitor && Capacitor.Plugins) ? Object.keys(Capacitor.Plugins).join(',') : 'هیچی'));
  return null;
}
function withTimeout(promise, ms){
  return new Promise((resolve, reject)=>{
    const t = setTimeout(()=> reject(new Error('iab-timeout')), ms);
    promise.then(v=>{ clearTimeout(t); resolve(v); }, e=>{ clearTimeout(t); reject(e); });
  });
}
async function iabPurchase(sku){
  console.log('[IAB] درخواست خرید، sku =', sku);
  const plugin = getIabPlugin();
  if(!plugin){ showToast('این نسخه هنوز به پرداخت درون‌برنامه‌ای مایکت وصل نشده', 'error'); return null; }
  iabDebugStep('پلاگین بیلینگ (MarketBilling)', true, 'پیدا شد');
  try{
    console.log('[IAB] پلاگین پیدا شد، در حال صدا زدن purchase() نیتیو...');
    iabDebugStep('purchase() نیتیو', null, 'در حال باز شدن پنل مایکت...');
    // اگه کاربر وسط درگاه پرداخت برگرده عقب یا فیلترشکن رو خاموش/روشن کنه، ممکنه
    // callback نیتیو هیچ‌وقت نرسه و promise برای همیشه معلق بمونه؛ برای همین یه
    // سقف زمانی می‌ذاریم تا دکمه هیچ‌وقت قفل نمونه.
    const result = await withTimeout(plugin.purchase({ sku }), 120000);
    console.log('[IAB] purchase() نیتیو resolve شد:', result);
    iabDebugStep('purchase() نیتیو', true, result);
    return result;
  }catch(e){
    console.error('[IAB] purchase() نیتیو fail شد:', (e && e.message) || e, e);
    iabDebugStep('purchase() نیتیو', false, (e && e.message) || String(e));
    if(e && e.message === 'iab-timeout'){
      showToast('پاسخی از درگاه پرداخت نرسید؛ اگه خرید انجام شده، از «بازیابی خرید قبلی» استفاده کن', 'error');
    } else {
      showToast('پرداخت انجام نشد یا لغو شد', 'error');
    }
    return null;
  }
}
// ضامن اطمینان: هر بار اپ از پس‌زمینه برمی‌گرده (مثلاً کاربر از صفحه‌ی درگاه یا
// اپ مایکت برگشته)، اگه دکمه‌ی خرید هنوز رو حالت "در حال اتصال..." قفل مونده
// بود (یعنی promise نیتیو گم شده)، دستی آزادش می‌کنیم.
function resetPremiumPayBtnIfStuck(){
  const btn = document.getElementById('premiumPayBtn');
  if(btn && btn.disabled){ btn.disabled = false; btn.textContent = '💳 خرید نسخه‌ی پرمیوم'; }
}
try{
  if(window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App){
    Capacitor.Plugins.App.addListener('resume', resetPremiumPayBtnIfStuck);
    Capacitor.Plugins.App.addListener('resume', ()=>{ try{ updateLiveCounter(); }catch(e){} });
    Capacitor.Plugins.App.addListener('appStateChange', (state)=>{
      if(state && state.isActive) resetPremiumPayBtnIfStuck();
      if(state && state.isActive){ try{ updateLiveCounter(); }catch(e){} }
      handleAppForegroundChange(!!(state && state.isActive));
    });
  }
}catch(e){}
/* در وب/WebView کپاسیتور، وقتی اپ می‌ره پس‌زمینه، تایمرهای جاوااسکریپت (از جمله
   تایمر داخلیِ supabase-js برای رفرش خودکار توکن، و همینطور setInterval یک‌ثانیه‌ایِ
   updateLiveCounter که تشخیص «روز عوض شده یا نه» رو انجام می‌ده) هَنگ/متوقف می‌شن.
   یعنی اگه اپ یه مدت (حتی فقط از نیمه‌شب گذشته باشه) پس‌زمینه بمونه، ممکنه تا وقتی
   کاربر یه کار دیگه‌ای نکنه، آواتار/روز برنامه هنوز «دیروز» رو نشون بده (مثلاً «امروز
   روز ۸ توئه» با اینکه واقعاً روز ۹ شده). برای همین علاوه بر تایمر، هر رویداد resume/
   appStateChange و visibilitychange هم صریحاً updateLiveCounter (که خودش
   checkDayRollover رو صدا می‌زنه) رو دوباره اجرا می‌کنه تا لحظه‌ی برگشت به اپ، بدون
   نیاز به صبر کردن برای تیک بعدی تایمر، فوراً رفع بشه.
   یه مدت (بیشتر از عمر access token، پیش‌فرض ۱ ساعت) پس‌زمینه بمونه، رفرش زمان‌بندی‌شده
   هیچ‌وقت اجرا نمی‌شه؛ وقتی کاربر برمی‌گرده، سشن رو client عملاً منقضی/نامعتبر می‌بینه
   و بعضی وقتا با یه ایونت SIGNED_OUT گذرا (که handlePublicChatSession رو با
   session=null صدا می‌زنه) کاربر رو دوباره روی باکس ورود/ثبت‌نام می‌ندازه — با اینکه
   واقعاً هنوز لاگین بوده و refresh token هنوز معتبره. این همون باگیه که گزارش شده:
   «بعضی وقتا برمی‌گردیم تو چت عمومی، دوباره باکس ورود میاد».
   طبق راهنمای رسمی Supabase برای اپ‌های هایبرید (React Native/Capacitor)، باید
   خودمون رفرش خودکار رو دستی با چرخه‌ی resume/pause اپ هماهنگ کنیم، و علاوه بر اون
   سشن رو صریح دوباره چک کنیم تا اگه ایونتی گم شده باشه هم جبران بشه. */
let lastAppForegroundState = true;
function handleAppForegroundChange(isActive){
  if(!sb) return;
  if(isActive === lastAppForegroundState) return;
  lastAppForegroundState = isActive;
  if(isActive){
    try{ sb.auth.startAutoRefresh(); }catch(e){}
    sb.auth.getSession().then(({data})=> handlePublicChatSession(data.session)).catch(()=>{});
  } else {
    try{ sb.auth.stopAutoRefresh(); }catch(e){}
  }
}
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'visible'){
    resetPremiumPayBtnIfStuck();
    try{ updateLiveCounter(); }catch(e){}
  }
  handleAppForegroundChange(document.visibilityState === 'visible');
});
async function iabVerifyOnServer(purchase){
  try{
    const __auth = await authHeaders();
    iabDebugStep('ارسال تایید به سرور (iab/verify)', null, 'auth header ارسال شد؟ ' + !!__auth.Authorization);
    const res = await fetch(WORKER_BASE + '/iab/verify', {
      method:'POST', headers: Object.assign({'Content-Type':'application/json'}, __auth),
      body: JSON.stringify({ store: purchase.store, sku: purchase.sku, purchaseToken: purchase.purchaseToken })
    });
    const data = await res.json().catch(()=>null);
    // قبلاً اینجا هیچ لاگی نبود؛ اگه ورکر خطا می‌داد یا جواب JSON نبود، کاملاً بی‌صدا
    // فقط ok:false برمی‌گشت و از کنسول هیچ سرنخی برای دیباگ نبود.
    if(!res.ok || !data || data.ok !== true){
      console.error('[IAB] iab/verify ناموفق. HTTP status:', res.status, '| auth header ارسال شد؟', !!__auth.Authorization, '| بدنه‌ی پاسخ:', data);
      iabDebugStep('پاسخ iab/verify', false, 'HTTP ' + res.status + ' | ' + JSON.stringify(data));
    } else {
      iabDebugStep('پاسخ iab/verify', true, JSON.stringify(data));
    }
    return data || { ok:false };
  }catch(e){
    console.error('[IAB] iab/verify درخواست fetch fail شد:', (e && e.message) || e);
    iabDebugStep('iab/verify (fetch)', false, (e && e.message) || String(e));
    return { ok:false };
  }
}
/* بعد از اینکه ورکر ok:true برگردوند، به جای اینکه کورکورانه بهش اعتماد کنیم، خودمون
   مستقیم از Supabase چک می‌کنیم profiles.premium_until واقعاً آپدیت شده یا نه. اگه
   ورکر باگ داشته باشه (مثلاً برای مایکت verify رو درست انجام نداده یا ذخیره نکرده)،
   این جلوی اون حالت رو می‌گیره که کاربر تست "فعال شد 🎉" ببینه ولی چند لحظه بعد
   (با اولین رفرش سشن) دوباره غیرپرمیوم بشه — منبع حقیقت همیشه همینجاست، نه پاسخ ورکر. */
async function confirmPremiumOnServer(){
  if(!sb || !publicChatUser){
    iabDebugStep('تایید نهایی از Supabase', false, 'sb یا publicChatUser موجود نیست (یعنی لاگین نبودی)');
    return isAppOwner === true;
  }
  try{
    const { data } = await sb.from('profiles').select('premium_until').eq('id', publicChatUser.id).single();
    const ok = !!(data && data.premium_until && new Date(data.premium_until) > new Date());
    iabDebugStep('تایید نهایی از Supabase (profiles.premium_until)', ok, data);
    return ok;
  }catch(e){ iabDebugStep('تایید نهایی از Supabase', false, (e && e.message) || String(e)); return false; }
}

/* ==================== Lifetime-capacity (500 slots) — REAL counter ====================
   قیمت فعلیِ لایف‌تایم فقط برای ۵۰۰ نفر اوله. عدد باقیمانده هیچ‌وقت تو کلاینت ساخته
   نمی‌شه — همیشه از جدول premium_capacity رو Supabase خونده می‌شه، و فقط زمانی کم
   می‌شه که یه خرید واقعاً رو سرور تایید بشه (بعد از confirmPremiumOnServer===true)،
   از طریق تابع claim_lifetime_slot که سمت دیتابیسه (idempotent per user — دوبار
   شمرده نمی‌شه، حتی اگه کاربر چندبار «بازیابی خرید» بزنه).
   نیازمند SQL همراه این فایل: premium-capacity-supabase-schema.sql (یک‌بار تو
   Supabase SQL editor اجرا بشه). تا وقتی اون فایل اجرا نشده، این ویجت فقط مخفی
   می‌مونه و بقیه‌ی فلوی خرید دست‌نخورده کار می‌کنه. */
let lifetimeSlotsRemaining = null;
let lifetimeSlotsTotal = 500;

function renderLifetimeScarcity(){
  const box = document.getElementById('premScarcityBox');
  const soldOutBox = document.getElementById('premScarcitySoldOut');
  const countEl = document.getElementById('premScarcityCount');
  const fillEl = document.getElementById('premScarcityFill');
  if(!box || !soldOutBox) return;
  if(lifetimeSlotsRemaining === null){ box.style.display = 'none'; soldOutBox.style.display = 'none'; return; }
  const owned = !!storeData.premium;
  if(owned){ box.style.display = 'none'; soldOutBox.style.display = 'none'; return; }
  if(lifetimeSlotsRemaining <= 0){
    box.style.display = 'none';
    soldOutBox.style.display = '';
    return;
  }
  soldOutBox.style.display = 'none';
  box.style.display = '';
  countEl.textContent = lifetimeSlotsRemaining.toLocaleString('fa-IR');
  const pct = Math.max(0, Math.min(100, (lifetimeSlotsRemaining / lifetimeSlotsTotal) * 100));
  fillEl.style.width = pct + '%';
  box.classList.toggle('low', lifetimeSlotsRemaining <= 50);
  // Buy button reflects real capacity too — no more purchases start once the 500 slots are gone.
  const payBtn = document.getElementById('premiumPayBtn');
  if(payBtn) payBtn.disabled = false;
}

async function loadLifetimeRemaining(){
  if(!sb) return;
  try{
    const { data, error } = await sb.rpc('get_lifetime_remaining');
    if(error) throw error;
    if(data && typeof data.remaining === 'number'){
      lifetimeSlotsRemaining = data.remaining;
      lifetimeSlotsTotal = data.total || 500;
    } else if(typeof data === 'number'){
      lifetimeSlotsRemaining = data;
    }
  }catch(e){
    // اگه SQL همراه هنوز اجرا نشده یا شبکه قطعه، ویجت فقط مخفی می‌مونه (fail silent) —
    // نباید جلوی خرید عادی رو بگیره.
    console.error('get_lifetime_remaining error', e);
  }
  renderLifetimeScarcity();
}

/* هر بار یه خرید رو سرور واقعاً تایید بشه (reallyActivated === true) صدا زده می‌شه.
   claim_lifetime_slot سمت دیتابیس چک می‌کنه این کاربر قبلاً شمرده شده یا نه (ستون
   profiles.lifetime_slot_claimed)، پس اگه چندبار صدا زده بشه (مثلاً هم از فلوی خرید
   مستقیم هم از «بازیابی خرید») باز درست فقط یک‌بار کم می‌شه. */
async function claimLifetimeSlotIfNeeded(){
  if(!sb || !publicChatUser) return;
  try{
    const { data, error } = await sb.rpc('claim_lifetime_slot', { p_uid: publicChatUser.id });
    if(error) throw error;
    if(data && typeof data.remaining === 'number'){
      lifetimeSlotsRemaining = data.remaining;
      lifetimeSlotsTotal = data.total || lifetimeSlotsTotal;
    }
  }catch(e){ console.error('claim_lifetime_slot error', e); }
  renderLifetimeScarcity();
}

/* لایو: اگه یه نفر دیگه (رو یه دستگاه دیگه) همون لحظه بخره، عدد بدون رفرش صفحه
   خودش کم می‌شه — چون منبعش واقعاً ردیف زنده‌ی premium_capacity تو Supabase‌ه. */
function watchLifetimeCapacity(){
  if(!sb) return;
  try{
    sb.channel('premium_capacity_watch')
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'premium_capacity' }, (payload)=>{
        if(payload && payload.new && typeof payload.new.remaining === 'number'){
          lifetimeSlotsRemaining = payload.new.remaining;
          lifetimeSlotsTotal = payload.new.total || lifetimeSlotsTotal;
          renderLifetimeScarcity();
        }
      })
      .subscribe();
  }catch(e){ console.error('watchLifetimeCapacity error', e); }
}


/* ==================== Exit confirmation (with Dream Coach) ==================== */
const EXIT_MESSAGES = [
  "مطمئنی می‌خوای بری؟ هنوز کلی مسیر تا قله مونده 🏔️",
  "وایسا! امروز رو هنوز کامل تیک نزدی‌ها 👀",
  "رفتن اشکالی نداره، فقط مطمئن شو که واقعاً همینو می‌خوای",
  "همین الان؟ باشه، ولی من همیشه همین‌جام برات",
  "یه لحظه صبر کن... مطمئنی می‌خوای از این صفحه بری بیرون؟",
  "قبل رفتن یادت باشه، فردا دوباره منتظرتم 😊",
  "بدون خداحافظی نریا! واقعاً می‌خوای خارج بشی؟",
  "باشه، ولی یادت نمونه این مسیر رو خودت انتخاب کردی 💪"
];
function pickExitMessage(){ return EXIT_MESSAGES[Math.floor(Math.random()*EXIT_MESSAGES.length)]; }
function showExitConfirm(){
  const coachEl = document.getElementById('exitCoachAvatar');
  if(coachEl) coachEl.innerHTML = buildCoachSVG('concerned', 'exitconfirm');
  document.getElementById('exitMsgText').textContent = pickExitMessage();
  const ov = document.getElementById('exitOverlay');
  ov.classList.remove('leaving');
  ov.classList.add('show');
  sfxAppExit(); // distinct descending chime — mirrors sfxAppEnter played on the splash/entry screen
}
function hideExitConfirm(){
  const ov = document.getElementById('exitOverlay');
  ov.classList.remove('leaving');
  ov.classList.remove('show');
}
function doRealExit(){
  try{
    if(window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App && Capacitor.Plugins.App.exitApp){
      Capacitor.Plugins.App.exitApp(); return;
    }
  }catch(e){}
  try{ window.close(); }catch(e){}
}
document.getElementById('exitStayBtn').addEventListener('click', hideExitConfirm);
document.getElementById('exitLeaveBtn').addEventListener('click', ()=>{
  // فقط برای همین خروج، فید بستن رو خیلی سریع‌تر از حالت پیش‌فرض overlay/card
  // می‌کنیم (استایل inline، فقط رو همین overlay) تا کاربر معطل نمونه — روی
  // بقیه‌ی اورلی‌های هم‌کلاس (aiGate/inviteNudge/authGate) اثری نداره.
  const ov = document.getElementById('exitOverlay');
  const card = ov.querySelector('.exit-card');
  ov.style.transition = 'opacity .1s ease';
  if(card) card.style.transition = 'opacity .1s ease, transform .1s ease';
  ov.classList.remove('leaving');
  ov.classList.remove('show');
  setTimeout(()=>{
    doRealExit();
    ov.style.transition = '';
    if(card) card.style.transition = '';
  }, 110);
});

function isOverlayShown(id){
  const el = document.getElementById(id);
  if(!el) return false;
  if(el.classList.contains('show')) return true;
  return !!(el.style.display && el.style.display !== 'none');
}
function closeDismissableOverlay(){
  if(isOverlayShown('gifPickerOverlay')){ closeGifPicker(); return true; }
  if(isOverlayShown('notifPanelOverlay')){ closeNotifPanel(); return true; }
  if(isOverlayShown('chatMembersOverlay')){ closeChatMembers(); return true; }
  if(isOverlayShown('sideMenuOverlay')){ document.getElementById('sideMenuOverlay').classList.remove('show'); return true; }
  if(isOverlayShown('sosOverlay')){ document.getElementById('sosOverlay').classList.remove('show'); return true; }
  if(isOverlayShown('celebrateOverlay')){ document.getElementById('celebrateOverlay').classList.remove('show'); return true; }
  if(isOverlayShown('aiGateOverlay')){ hideAIGate(); return true; }
  if(isOverlayShown('inviteNudgeOverlay')){ hideInviteNudge(); return true; }
  if(isOverlayShown('authGateOverlay')){ pendingAuthTab = null; hideAuthGate(); return true; }
  return false;
}
function handleHardwareBack(){
  if(isOverlayShown('exitOverlay')){ hideExitConfirm(); return; }
  if(closeDismissableOverlay()) return;
  if(isOverlayShown('onboardOverlay')) return; // mid-onboarding: ignore back, avoid losing entered data
  if(document.body.classList.contains('subpage-open')){ exitSubPage(); return; }
  showExitConfirm();
}
(function setupBackButton(){
  try{
    if(window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App){
      Capacitor.Plugins.App.addListener('backButton', handleHardwareBack);
    }
  }catch(e){}
  try{
    history.pushState({dreamlifeGuard:true}, '');
    window.addEventListener('popstate', ()=>{
      history.pushState({dreamlifeGuard:true}, '');
      handleHardwareBack();
    });
  }catch(e){}
})();

/* ==================== Premium overlay: open/close + IAB flow ====================
   چون تخفیف فقط از گردونه‌ی دعوت میاد و همیشه یکی از همین ۴ درصده (نه هر عددی)،
   به‌جای «کد تخفیف» که تو IAB اصلاً معنی نداره، برای هر پله یه SKU جدا با قیمت
   تخفیف‌خورده تو پنل مایکت ثبت می‌کنیم و اپ خودش SKU درست رو صدا می‌زنه.
   قیمت پایه (SKU: premium) همونیه که رو کارت قیمت نشون داده می‌شه: ۱,۳۵۰,۰۰۰ تومان.
   بقیه‌ی SKUها باید دقیقاً روی همین مبنا، با همین درصدها، تو پنل مایکت ساخته بشن:
     premium        (۰٪)  → ۱,۳۵۰,۰۰۰ تومان
     premium_20off  (۲۰٪) → ۱,۰۸۰,۰۰۰ تومان
     premium_30off  (۳۰٪) →   ۹۴۵,۰۰۰ تومان
     premium_40off  (۴۰٪) →   ۸۱۰,۰۰۰ تومان
     premium_50off  (۵۰٪) →   ۶۷۵,۰۰۰ تومان
   اگه قیمت پایه‌ی رو کارت (بالا، prem-price-value) عوض شد، این ۴ SKU هم باید با همون
   درصدها دوباره محاسبه و تو پنل مایکت آپدیت بشن — وگرنه تخفیف واقعی با درصدی که
   به کاربر نشون داده می‌شه یکی نیست. */
const PREMIUM_SKU_BY_DISCOUNT = { 0: 'premium', 20: 'premium_20off', 30: 'premium_30off', 40: 'premium_40off', 50: 'premium_50off' };
function currentPremiumSku(){
  return PREMIUM_SKU_BY_DISCOUNT[myDiscount.percent] || 'premium';
}
function openPremiumPage(){
  let discBadge = document.getElementById('premiumDiscountBadge');
  if(!discBadge){
    discBadge = document.createElement('div');
    discBadge.id = 'premiumDiscountBadge';
    discBadge.style.cssText = 'margin:0 0 12px;padding:10px;border-radius:12px;background:var(--accent-soft);border:1px solid var(--accent);color:var(--accent);font-size:12.5px;font-weight:700;text-align:center;';
    document.getElementById('premiumPayBtn').insertAdjacentElement('beforebegin', discBadge);
  }
  if(myDiscount.percent > 0){
    discBadge.style.display = 'block';
    discBadge.style.cursor = 'default';
    discBadge.onclick = null;
    discBadge.innerHTML = `🎁 ${myDiscount.percent}٪ تخفیف فعاله — دکمه‌ی پرداخت خودکار با قیمت تخفیف‌خورده باز می‌شه`;
  } else {
    discBadge.style.display = 'block';
    discBadge.style.cursor = 'pointer';
    discBadge.innerHTML = `🎁 با دعوت از دوستات تا ۵۰٪ تخفیف بگیر`;
    discBadge.onclick = ()=>{ enterSubPage('invite'); };
  }
  renderPremiumPurchaseUI();
  loadLifetimeRemaining();
  enterSubPage('premium');
}
// Backward-compatible alias (kept in case anything else in the app still calls the old name)
function openPremiumOverlay(){ openPremiumPage(); }

document.getElementById('premiumPayBtn').addEventListener('click', async ()=>{
  // مهم: قبل از باز کردن درگاه پرداخت، حتماً باید کاربر لاگین باشه. اگه بدون حساب
  // خرید کنه، iabVerifyOnServer() هیچ Authorization header ای نداره (authHeaders()
  // خالی برمی‌گرده) و confirmPremiumOnServer() هم چون publicChatUser=null هست
  // همیشه false برمی‌گردونه — یعنی پول از کاربر کم می‌شه ولی پرمیوم برای همیشه
  // فعال نمی‌شه («خرید ثبت شد ولی تاییدش رو سرور کامل نشد»). این همون باگیه که
  // پشتیبانی مایکت گزارش داده: «بعد از پرداخت فیچرها باز نمی‌شن». قبلاً این تب هیچ
  // auth gate ای نداشت (برخلاف تب‌های عمومی مثل چت/لیدربورد که PUBLIC_AUTH_TABS
  // دارن). با لاگین اجباری قبل از پرداخت، هر خریدی همیشه به یه حساب واقعی وصله و
  // بعد از لاگین کاربر خودش با pendingAuthTab دوباره به همین صفحه‌ی پرمیوم برمی‌گرده.
  if(!isLoggedIn()){
    showToast('برای خرید پرمیوم اول باید یه حساب رایگان بسازی یا وارد شی', 'error');
    goToAuthPage('premium');
    return;
  }
  const btn = document.getElementById('premiumPayBtn');
  btn.disabled = true; btn.textContent = 'در حال اتصال...';
  console.log('[IAB] دکمه‌ی خرید کلیک شد. sku انتخاب‌شده:', currentPremiumSku(), '| myDiscount:', myDiscount);
  iabDebugReset();
  iabDebugStep('کلیک روی دکمه‌ی خرید', true, 'sku=' + currentPremiumSku());
  try{
    const purchase = await iabPurchase(currentPremiumSku());
    if(purchase){
      console.log('[IAB] purchase از نیتیو برگشت:', purchase);
      const verify = await iabVerifyOnServer(purchase);
      console.log('[IAB] نتیجه‌ی iab/verify از ورکر:', verify);
      const reallyActivated = (verify && verify.ok) ? await confirmPremiumOnServer() : false;
      console.log('[IAB] reallyActivated (تایید نهایی رو Supabase):', reallyActivated);
      iabDebugStep('نتیجه‌ی کلی', reallyActivated, reallyActivated ? 'پرمیوم فعال شد 🎉' : 'فعال نشد — اولین ❌ بالا رو نگاه کن');
      if(reallyActivated){
        storeData.premium = true; saveData();
        await claimLifetimeSlotIfNeeded();
        // مهم: بعد از تایید قطعی سرور، خریدِ رو مارکت/مایکت رو consume می‌کنیم.
        // بدون این خط، این SKU برای همیشه رو حساب کاربر «owned» می‌مونه و وقتی
        // premium_until تموم بشه و کاربر بخواد دوباره بخره، پلاگین بیلینگ با خطای
        // «قبلاً خریداری شده» (item already owned) جلوی خرید مجدد رو می‌گیره —
        // که از دید کاربر همون «پرداخت انجام نشد» غیرقابل‌فهمه.
        try{
          const plugin = getIabPlugin();
          if(plugin && plugin.consumePurchase && purchase.purchaseToken){
            await plugin.consumePurchase({ purchaseToken: purchase.purchaseToken });
          }
        }catch(e){ /* عدم موفقیت consume نباید فعال‌سازی که سرور تاییدش کرده رو خراب کنه */ }
        renderPremiumPurchaseUI();
        if(typeof applyPremiumLocksUI === 'function') applyPremiumLocksUI();
        exitSubPage();
        showPremiumSuccessCelebration();
      } else {
        // مهم: اینجا دیگه storeData.premium=true ست نمی‌کنیم، چون اگه سرور واقعاً
        // ثبتش نکرده باشه، این فلگ محلی با اولین رفرش سشن (handlePublicChatSession)
        // به false برمی‌گشت و به کاربر یه فعال‌سازی دروغین نشون داده بودیم.
        showToast('خرید ثبت شد ولی تاییدش رو سرور کامل نشد؛ چند لحظه دیگه از «بازیابی خرید قبلی» دوباره امتحان کن', 'error');
      }
    } else {
      console.log('[IAB] iabPurchase چیزی برنگردوند (null) — یعنی یا پلاگین پیدا نشد، یا خرید نیتیو fail/cancel/timeout شد؛ جزئیاتش تو لاگ‌های بالاتره.');
      iabDebugStep('نتیجه‌ی کلی', false, 'iabPurchase چیزی برنگردوند — یکی از مراحل بالا ❌ خورده');
    }
  }finally{
    btn.disabled = false; btn.textContent = '💳 خرید نسخه‌ی پرمیوم';
  }
});

document.getElementById('premiumCheckBtn').addEventListener('click', async ()=>{
  // همون دلیل premiumPayBtn: بدون لاگین، confirmPremiumOnServer() همیشه false
  // برمی‌گرده حتی اگه رو مارکت واقعاً owned باشه، پس بازیابی هم بدون حساب معنی نداره.
  if(!isLoggedIn()){
    showToast('برای بازیابی خرید اول باید وارد حسابت بشی', 'error');
    goToAuthPage('premium');
    return;
  }
  const btn = document.getElementById('premiumCheckBtn');
  btn.disabled = true; btn.textContent = 'در حال بررسی...';
  const plugin = getIabPlugin();
  if(!plugin){ showToast('این نسخه هنوز به پرداخت درون‌برنامه‌ای مایکت وصل نشده', 'error'); btn.disabled = false; btn.textContent = 'بازیابی خرید قبلی'; return; }
  try{
    const owned = await plugin.getPurchases();
    const premiumSkus = new Set(Object.values(PREMIUM_SKU_BY_DISCOUNT));
    const ownedPremium = owned && owned.purchases && owned.purchases.find(p=>premiumSkus.has(p.sku));
    if(ownedPremium){
      // فقط دیدن اینکه رو مارکت "owned" هست کافی نیست — باید مطمئن شیم سرور
      // (profiles.premium_until) هم همینو می‌دونه، وگرنه دقیقاً همون باگ خرید اول
      // (فلگ محلی که با اولین رفرش سشن ریست می‌شه) اینجا هم تکرار می‌شه.
      await iabVerifyOnServer(ownedPremium);
      const reallyActivated = await confirmPremiumOnServer();
      if(reallyActivated){
        storeData.premium = true; saveData();
        await claimLifetimeSlotIfNeeded();
        // همون دلیل consume تو فلوی خرید مستقیم: اگه اینجا هم consume نکنیم، خریدی که
        // با «بازیابی» تایید شده همچنان رو مارکت owned می‌مونه و بعد از انقضای
        // premium_until، خرید مجدد با «قبلاً خریداری شده» رد می‌شه.
        try{
          if(plugin.consumePurchase && ownedPremium.purchaseToken){
            await plugin.consumePurchase({ purchaseToken: ownedPremium.purchaseToken });
          }
        }catch(e){}
        renderPremiumPurchaseUI();
        if(typeof applyPremiumLocksUI === 'function') applyPremiumLocksUI();
        showToast('نسخه‌ی پرمیوم فعال شد 🎉', 'success');
        exitSubPage();
      } else {
        showToast('خرید رو مارکت پیدا شد ولی سرور تاییدش نکرد؛ لطفاً با پشتیبانی تماس بگیر', 'error');
      }
    } else {
      showToast('خریدی برای این حساب پیدا نشد', 'error');
    }
  }catch(e){
    showToast('مشکلی تو بررسی خرید پیش اومد', 'error');
  }finally{
    btn.disabled = false; btn.textContent = 'بازیابی خرید قبلی';
  }
});

document.getElementById('aiGatePremiumBtn').addEventListener('click', ()=>{
  hideAIGate();
  openPremiumPage();
});
document.getElementById('aiGateCloseBtn').addEventListener('click', ()=>{
  hideAIGate();
  setTimeout(()=>maybeShowInviteNudge('aigate'), 450);
});

/* ==================== Hidden developer/admin panel (grant or gift premium manually) ==================== */
let menuTitleTapCount = 0, menuTitleTapTimer = null;
const menuTitleEl = document.querySelector('.side-menu-title');
if(menuTitleEl){
  menuTitleEl.addEventListener('click', ()=>{
    menuTitleTapCount++;
    clearTimeout(menuTitleTapTimer);
    menuTitleTapTimer = setTimeout(()=>{ menuTitleTapCount = 0; }, 3000);
    if(menuTitleTapCount >= 5){
      menuTitleTapCount = 0;
      openAdminPanel();
    }
  });
}
function openAdminPanel(){
  if(!isAppOwner) return;
  const choice = prompt('چه کاری می‌خوای انجام بدی؟\n۱) فعال‌سازی پرمیوم با ایمیل حساب\n۲) لغو تعلیق یه کاربر با ایمیلش\n۳) لغو سکوت یه کاربر با ایمیلش\n\nعدد ۱ یا ۲ یا ۳ رو وارد کن:', '1');
  if(!choice) return;
  if(choice.trim() === '2' || choice.trim() === '۲'){ unsuspendChatUserByEmail(); return; }
  if(choice.trim() === '3' || choice.trim() === '۳'){ unmuteChatUserByEmail(); return; }
  const token = prompt('رمز مدیریت:');
  if(!token) return;
  // قبلاً اینجا شماره موبایل می‌گرفت، ولی هیچ ستونی برای phone تو profiles نیست و این
  // درخواست هیچ‌وقت واقعاً کار نمی‌کرد. حالا با همون ایمیلی که کاربر باهاش تو اپ ثبت‌نام
  // کرده کار می‌کنه (دقیقاً مثل مسیر لغو تعلیق).
  const email = prompt('ایمیل حسابی که می‌خوای پرمیومش کنی:');
  if(!email) return;
  fetch(WORKER_BASE + '/admin/grant', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ token, email: email.trim() })
  }).then(r=>r.json()).then(data=>{
    if(data.ok){ alert('پرمیوم برای ' + email + ' فعال شد ✅'); }
    else{ alert('خطا: ' + (data.error || 'نامشخص')); }
  }).catch(()=>alert('مشکل در اتصال به سرور'));
}

loadData().then(()=>{
  syncTaskWidget();
  applyPendingWidgetToggles();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW register failed', err));
  });
}


// Assistant catalog — a faithful port of the prototype's `cfg`, `GROUPS`,
// `ORDER` and default per-assistant settings.

export type BotId = 'prompt' | 'formal' | 'insta' | 'english' | 'study'

export type FieldOption = { v: string; l?: string }
export type Field = { key: string; label: string; options: FieldOption[] }
export type Example = { text: string; tag: string; patch?: Record<string, string> }
export type Refine = { label: string; mod: string; lang?: 'en' | 'fa' }

export type BotConfig = {
  name: string
  tagline: string
  heroPre: string
  heroAccent: string
  heroPost: string
  heroSub: string
  placeholder: string
  resultLabel: string
  loadingText: string
  copyToast: string
  fields: Field[]
  examples: Example[]
  refines: Refine[]
}

export const ORDER: BotId[] = ['prompt', 'formal', 'insta', 'english', 'study']

export const GROUPS: { label: string; ids: BotId[] }[] = [
  { label: 'ساختن و نوشتن', ids: ['prompt', 'formal', 'insta'] },
  { label: 'یاد گرفتن', ids: ['english', 'study'] },
]

export const cfg: Record<BotId, BotConfig> = {
  prompt: {
    name: 'پرامپت‌نویس فارسی',
    tagline: 'ایده‌ی خام → پرامپتِ حرفه‌ای',
    heroPre: 'ایده‌ت رو بگو، ',
    heroAccent: 'پرامپت حرفه‌ای',
    heroPost: ' بگیر',
    heroSub:
      'یه ایده‌ی خامِ فارسی بنویس؛ ساختارش می‌دم — نقش، هدف، زمینه، قالب و محدودیت‌ها — و یه پرامپتِ آماده‌ی کپی تحویلت می‌دم.',
    placeholder: 'ایده‌ت رو این‌جا بنویس… مثلاً «یه کپشن برای معرفی دوره‌ی هوش مصنوعی»',
    resultLabel: 'کپی پرامپت',
    loadingText: 'در حال ساختِ پرامپت…',
    copyToast: 'پرامپت کپی شد ✓',
    fields: [
      { key: 'lang', label: 'زبان خروجی', options: [{ v: 'fa', l: 'فارسی' }, { v: 'en', l: 'English' }] },
      { key: 'tone', label: 'لحن', options: [{ v: 'دوستانه' }, { v: 'حرفه‌ای' }, { v: 'خلاقانه' }] },
      { key: 'useCase', label: 'کاربرد', options: [{ v: 'عمومی' }, { v: 'تصویرسازی' }, { v: 'نوشتن' }, { v: 'کدنویسی' }] },
    ],
    examples: [
      { text: 'یه پست لینکدین درباره‌ی این‌که چرا هر کسب‌وکاری به هوش مصنوعی نیاز داره', tag: 'نوشتن', patch: { useCase: 'نوشتن' } },
      { text: 'عکس یه فضانورد که توی کافه نشسته و قهوه می‌خوره، سبک سینمایی', tag: 'تصویرسازی', patch: { useCase: 'تصویرسازی' } },
      { text: 'یه تابع پایتون که فایل اکسل رو می‌خونه و خلاصه‌ی آماری می‌ده', tag: 'کدنویسی', patch: { useCase: 'کدنویسی' } },
      { text: 'ایمیلِ پیگیریِ مودبانه به مشتری‌ای که هنوز جواب نداده', tag: 'نوشتن', patch: { useCase: 'نوشتن' } },
    ],
    refines: [
      { label: 'کوتاه‌ترش کن', mod: 'پرامپت را کوتاه‌تر و فشرده‌تر کن.' },
      { label: 'حرفه‌ای‌ترش کن', mod: 'پرامپت را حرفه‌ای‌تر و دقیق‌تر کن.' },
      { label: 'جزئیات بیشتر', mod: 'جزئیات و مثالِ بیشتری اضافه کن.' },
      { label: 'انگلیسی‌اش کن', mod: 'دقیقاً همین پرامپت را به انگلیسیِ روان بازنویسی کن.', lang: 'en' },
    ],
  },
  formal: {
    name: 'محاوره به رسمی',
    tagline: 'پیامِ دوستانه → متنِ رسمی',
    heroPre: 'پیامت رو ',
    heroAccent: 'رسمی و حرفه‌ای',
    heroPost: ' کن',
    heroSub:
      'یه متنِ محاوره‌ای بنویس؛ تبدیلش می‌کنم به متنی رسمی و مودبانه — برای ایمیلِ کاری، نامه‌ی اداری یا پیام به استاد و ارباب‌رجوع.',
    placeholder: 'متنِ محاوره‌ایت رو بنویس… مثلاً «سلام، میشه گزارشو تا فردا بفرستی؟»',
    resultLabel: 'کپی متن',
    loadingText: 'در حال رسمی‌کردنِ متن…',
    copyToast: 'متن کپی شد ✓',
    fields: [
      { key: 'kind', label: 'نوعِ متن', options: [{ v: 'ایمیلِ کاری' }, { v: 'نامه‌ی اداری' }, { v: 'پیام به استاد' }, { v: 'پیام به ارباب‌رجوع' }] },
      { key: 'formality', label: 'میزانِ رسمیت', options: [{ v: 'رسمی' }, { v: 'خیلی رسمی' }] },
      { key: 'length', label: 'طول', options: [{ v: 'کوتاه' }, { v: 'متوسط' }] },
    ],
    examples: [
      { text: 'سلام، میشه گزارشِ پروژه رو تا فردا برام بفرستی؟', tag: 'ایمیلِ کاری', patch: { kind: 'ایمیلِ کاری' } },
      { text: 'ببخشید استاد، من فردا نمی‌تونم سرِ کلاس بیام', tag: 'پیام به استاد', patch: { kind: 'پیام به استاد' } },
      { text: 'بابتِ تأخیر در ارسالِ سفارش عذر می‌خوام، جبران می‌کنیم', tag: 'ارباب‌رجوع', patch: { kind: 'پیام به ارباب‌رجوع' } },
      { text: 'می‌خواستم بپرسم درخواستِ مرخصی‌م تأیید شده یا نه', tag: 'نامه‌ی اداری', patch: { kind: 'نامه‌ی اداری' } },
    ],
    refines: [
      { label: 'رسمی‌ترش کن', mod: 'متن را رسمی‌تر و اداری‌تر کن.' },
      { label: 'کوتاه‌ترش کن', mod: 'متن را کوتاه‌تر و موجزتر کن.' },
      { label: 'مودبانه‌ترش کن', mod: 'لحن را مودبانه‌تر و محترمانه‌تر کن.' },
      { label: 'یه نسخه‌ی دیگه', mod: 'یک نسخه‌ی متفاوت با همان معنا و لحن بنویس.' },
    ],
  },
  insta: {
    name: 'کوچ هوک و کپشن',
    tagline: 'موضوع → هوک، کپشن و CTA',
    heroPre: 'موضوعت رو بده، ',
    heroAccent: 'هوک و کپشن',
    heroPost: ' بگیر',
    heroSub:
      'موضوعِ پستت رو بنویس؛ چند هوکِ قوی، یه کپشنِ کامل، فراخوانِ اقدام و هشتگ‌های مرتبط برات می‌سازم.',
    placeholder: 'موضوعِ پستت رو بنویس… مثلاً «معرفیِ دوره‌ی رایگانِ ChatGPT»',
    resultLabel: 'کپی کپشن',
    loadingText: 'در حال نوشتنِ هوک و کپشن…',
    copyToast: 'کپشن کپی شد ✓',
    fields: [
      { key: 'format', label: 'قالب', options: [{ v: 'پست' }, { v: 'ریلز' }, { v: 'استوری' }] },
      { key: 'tone', label: 'لحن', options: [{ v: 'دوستانه' }, { v: 'حرفه‌ای' }, { v: 'طنز' }] },
      { key: 'hooks', label: 'تعدادِ هوک', options: [{ v: '3', l: '۳ هوک' }, { v: '5', l: '۵ هوک' }] },
    ],
    examples: [
      { text: 'معرفیِ دوره‌ی رایگانِ ChatGPT', tag: 'پست', patch: { format: 'پست' } },
      { text: '۵ تا اشتباهِ رایج در پرامپت‌نویسی', tag: 'ریلز', patch: { format: 'ریلز' } },
      { text: 'یه روز از زندگیِ یه فریلنسرِ هوش مصنوعی', tag: 'استوری', patch: { format: 'استوری' } },
      { text: 'چرا هر کسب‌وکاری به اتوماسیون نیاز داره', tag: 'پست', patch: { format: 'پست' } },
    ],
    refines: [
      { label: 'هوک‌های بیشتر', mod: 'هوک‌های بیشتر و متنوع‌تری بده.' },
      { label: 'کوتاه‌ترش کن', mod: 'کپشن را کوتاه‌تر و جمع‌وجورتر کن.' },
      { label: 'طنز اضافه کن', mod: 'لحن را طنزآمیزتر و بامزه‌تر کن.' },
      { label: 'یه نسخه‌ی دیگه', mod: 'یک نسخه‌ی کاملاً متفاوت بساز.' },
    ],
  },
  english: {
    name: 'تمرین انگلیسی',
    tagline: 'جمله بگو → تصحیح + توضیحِ فارسی',
    heroPre: 'انگلیسی تمرین کن، ',
    heroAccent: 'به فارسی',
    heroPost: ' یاد بگیر',
    heroSub:
      'یه جمله یا متنِ انگلیسی بنویس؛ تصحیحش می‌کنم، اشتباه‌ها رو فارسی و ساده توضیح می‌دم و یه سؤال برای ادامه‌ی مکالمه می‌پرسم.',
    placeholder: 'یه جمله انگلیسی بنویس… مثلاً "I go to school yesterday"',
    resultLabel: 'کپی تصحیح',
    loadingText: 'در حال بررسی و تصحیح…',
    copyToast: 'تصحیح کپی شد ✓',
    fields: [
      { key: 'level', label: 'سطح', options: [{ v: 'مبتدی' }, { v: 'متوسط' }, { v: 'پیشرفته' }] },
      { key: 'focus', label: 'تمرکز', options: [{ v: 'گرامر' }, { v: 'مکالمه' }, { v: 'واژگان' }] },
    ],
    examples: [
      { text: 'I go to school yesterday with my friend', tag: 'گرامر', patch: { focus: 'گرامر' } },
      { text: 'How I can improve my speaking?', tag: 'مکالمه', patch: { focus: 'مکالمه' } },
      { text: 'یه مکالمه‌ی کوتاه برای سفارش قهوه در کافه بهم یاد بده', tag: 'مکالمه', patch: { focus: 'مکالمه' } },
      { text: 'فرقِ make و do چیه؟ با مثال', tag: 'واژگان', patch: { focus: 'واژگان' } },
    ],
    refines: [
      { label: 'ساده‌تر توضیح بده', mod: 'توضیح‌ها را ساده‌تر و مبتدی‌پسندتر کن.' },
      { label: 'مثالِ بیشتر', mod: 'مثال‌های بیشتری به انگلیسی اضافه کن.' },
      { label: 'یه تمرین بده', mod: 'یک تمرینِ کوتاه برای همین نکته بده.' },
      { label: 'سخت‌ترش کن', mod: 'سطح را کمی بالاتر ببر و واژگانِ پیشرفته‌تر استفاده کن.' },
    ],
  },
  study: {
    name: 'خلاصه‌ساز درسی',
    tagline: 'متن یا موضوع → خلاصه + سؤال',
    heroPre: 'درس‌ت رو ',
    heroAccent: 'خلاصه و فلش‌کارت',
    heroPost: ' کن',
    heroSub:
      'متن یا موضوعِ درس رو بفرست؛ یه خلاصه‌ی روان، چند فلش‌کارتِ پرسش‌وپاسخ و چند سؤالِ امتحانی برات می‌سازم.',
    placeholder: 'متن یا موضوعِ درس رو بنویس… مثلاً «خلاصه‌ی فصلِ فتوسنتز»',
    resultLabel: 'کپی خلاصه',
    loadingText: 'در حال خلاصه‌کردن…',
    copyToast: 'خلاصه کپی شد ✓',
    fields: [
      { key: 'output', label: 'خروجی', options: [{ v: 'خلاصه' }, { v: 'فلش‌کارت' }, { v: 'سؤال امتحانی' }, { v: 'همه' }] },
      { key: 'level', label: 'سطح', options: [{ v: 'مدرسه' }, { v: 'دانشگاه' }] },
    ],
    examples: [
      { text: 'خلاصه‌ی فرایندِ فتوسنتز در گیاهان', tag: 'خلاصه', patch: { output: 'خلاصه' } },
      { text: 'از این متن فلش‌کارت بساز: قانونِ اول و دومِ نیوتون درباره‌ی حرکت…', tag: 'فلش‌کارت', patch: { output: 'فلش‌کارت' } },
      { text: 'چند سؤالِ امتحانی از مبحثِ جنگِ جهانیِ دوم بده', tag: 'سؤال', patch: { output: 'سؤال امتحانی' } },
      { text: 'مبحثِ مشتق در ریاضی رو کامل برام جمع‌بندی کن', tag: 'همه', patch: { output: 'همه' } },
    ],
    refines: [
      { label: 'ساده‌ترش کن', mod: 'خلاصه را ساده‌تر و روان‌تر کن.' },
      { label: 'فلش‌کارتِ بیشتر', mod: 'فلش‌کارت‌های بیشتری اضافه کن.' },
      { label: 'سؤالِ سخت‌تر', mod: 'سؤال‌های امتحانیِ سخت‌تر و تحلیلی‌تر بده.' },
      { label: 'نکته‌های کلیدی', mod: 'فقط مهم‌ترین نکته‌های کلیدی را فهرست کن.' },
    ],
  },
}

export const defaultSettings: Record<BotId, Record<string, string>> = {
  prompt: { lang: 'fa', tone: 'حرفه‌ای', useCase: 'عمومی' },
  formal: { kind: 'ایمیلِ کاری', formality: 'رسمی', length: 'متوسط' },
  insta: { format: 'پست', tone: 'دوستانه', hooks: '5' },
  english: { level: 'متوسط', focus: 'گرامر' },
  study: { output: 'همه', level: 'مدرسه' },
}

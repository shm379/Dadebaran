# کاتالوگ اسکیل‌های پرامپت‌کده در سیستم

> منبع: [promptkade.xyz/skills](https://promptkade.xyz/skills) · ۲۳ اسکیل · به‌روزرسانی: ۱۰ اکتبر ۲۰۲۶
> این فایل نسخه‌ی اصلاح‌شده‌ی کاتالوگ است؛ در کارت کاتالوگِ workflow، ردیف `grill-me` به‌اشتباه «نصب نشد» بود — این نسخه درست است.

## وضعیت کلی

- **۲۳ از ۲۳ اسکیل** در `~/.agents/skills/` نصب و اعتبارسنجی شده‌اند (SKILL.md معتبر با name و description).
- ۲۱ اسکیل تازه نصب شد؛ ۲ اسکیل (`remotion-best-practices` و `find-skills`) از قبل موجود بودند و حفظ شدند — نسخه‌ی محلی `remotion-best-practices` (v4.0.529) **جدیدتر از نسخه‌ی پرامپت‌کده** (v4.0.506) بود و `find-skills` فقط یک خط خلافی تفاوت داشت.
- همه‌ی نصب‌های جدید با CLI رسمی `skills` از **منابع کانونی GitHub** (همان‌هایی که پرامپت‌کده ازشان import کرده) انجام و در `.skill-lock.json` ثبت شده‌اند؛ symlink های ZCode هم ساخته شده‌اند.
- `grill-me` عمداً اسکیلی کوچک از نوع slash-command است (`Run a /grilling session.` + `disable-model-invocation: true`) — سالم و کامل است.

## فهرست اسکیل‌ها

| # | اسکیل | دسته | وضعیت | خلاصه |
|---|-------|------|--------|-------|
| ۱ | `programmatic-seo` | مارکتینگ | نصب‌شده | ساخت صفحات فرود سئو در مقیاس انبوه (دایرکتوری، مکان، مقایسه، ادغام) با قالب و داده |
| ۲ | `content-strategy` | تولید محتوا | نصب‌شده | تعیین موضوع‌ها، خوشه‌های محتوایی و تقویم انتشار محتوا |
| ۳ | `marketing-psychology` | مارکتینگ | نصب‌شده | به‌کارگیری روان‌شناسی و سوگیری‌های شناختی در بازاریابی |
| ۴ | `copywriting` | مارکتینگ | نصب‌شده | نوشتن و بازنویسی کپی متقاعدکننده برای صفحات اصلی، فرود، قیمت و محصول |
| ۵ | `seo-audit` | مارکتینگ | نصب‌شده | بررسی فنی سئو — سرعت، ایندکس، متاتگ، خطاهای خزش — برای یافتن مشکل رتبه و ترافیک |
| ۶ | `code-review` | کدنویسی | نصب‌شده | بازبینی تغییرات کد نسبت به نقطه‌ی مرجع با دو گزارش موازی: استاندارد پروژه و انطباق با مشخصات |
| ۷ | `diagnosing-bugs` | کدنویسی | نصب‌شده | چرخه‌ی ساخت‌یافته برای تشخیص و رفع باگ‌های سخت و افت کارایی |
| ۸ | `grill-me` | بهره‌وری | نصب‌شده | بازجویی سخت‌گیرانه از برنامه/طراحی با سوال‌های موشکافانه برای کشف ضعف قبل از اجرا |
| ۹ | `verification-before-completion` | کدنویسی | نصب‌شده | اجرای دستورات راستی‌آزمایی و بررسی خروجی قبل از ادعای اتمام کار |
| ۱۰ | `test-driven-development` | کدنویسی | نصب‌شده | اجرای چرخه‌ی TDD — تست شکست‌خورده، پیاده‌سازی، بازآرایی |
| ۱۱ | `writing-plans` | بهره‌وری | نصب‌شده | ساخت برنامه‌ی مرحله‌به‌مرحله از مشخصات و نیازمندی‌ها قبل از کدنویسی |
| ۱۲ | `systematic-debugging` | کدنویسی | نصب‌شده | عیب‌یابی گام‌به‌گام خطا (بازتولید، ایزوله‌سازی، اعتبارسنجی) بدون حدس‌زدن |
| ۱۳ | `brainstorming` | سایر | نصب‌شده | کاوش نیّت و نیازمندی‌ها قبل از کارهای خلاقانه مثل ساخت فیچر یا کامپوننت |
| ۱۴ | `design-taste-frontend` | طراحی | نصب‌شده | طراحی فرانت‌اند غیرقالبی برای صفحات فرود، پورتفولیو و بازطراحی با چک‌لیست نهایی |
| ۱۵ | `supabase-postgres-best-practices` | کدنویسی | نصب‌شده | الگوهای استاندارد Supabase/Postgres برای جداول، مایگریشن، RLS، ایندکس و کوئری کند |
| ۱۶ | `remotion-best-practices` | کدنویسی | از قبل موجود | بهترین شیوه‌های ساخت ویدیوهای موشن‌گرافیک با React و Remotion (نسخه‌ی محلی جدیدتر) |
| ۱۷ | `web-design-guidelines` | طراحی | نصب‌شده | ممیزی کد رابط کاربری بر اساس Web Interface Guidelines از نظر طراحی، دسترس‌پذیری و UX |
| ۱۸ | `vercel-react-best-practices` | کدنویسی | نصب‌شده | بازبینی و بازنویسی React/Next.js طبق راهنمای کارایی Vercel — کامپوننت، fetch، باندل |
| ۱۹ | `agent-browser` | کدنویسی | نصب‌شده | اتوماسیون مرورگر از خط فرمان — ناوبری، فرم، کلیک، اسکرین‌شات، استخراج داده |
| ۲۰ | `find-skills` | بهره‌وری | از قبل موجود | تحلیل سوال کاربر برای پیدا کردن اسکیل‌های قابل‌نصب و پیشنهاد گزینه‌های مرتبط |
| ۲۱ | `improve` | کدنویسی | نصب‌شده | بازبینی کدبیس مثل مشاور ارشد و تولید برنامه‌ی اقدام اولویت‌بندی‌شده بدون تغییر خود کد |
| ۲۲ | `ask-matt` | بهره‌وری | نصب‌شده | بررسی اسکیل‌های موجود نسبت به نیاز شما و پیشنهاد بهترین گزینه |
| ۲۳ | `hallmark` | طراحی | نصب‌شده | طراحی صفحات و اپ‌ها با معیارهای «ضد ماشینی»؛ بازطراحی، استخراج طراحی از URL و ممیزی طراحی |

## منبع نصب هر اسکیل (کانونی در GitHub)

| مخزن GitHub | اسکیل‌ها |
|-------------|----------|
| `coreyhaines31/marketingskills` | programmatic-seo، content-strategy، marketing-psychology، copywriting، seo-audit |
| `mattpocock/skills` | code-review، diagnosing-bugs، grill-me، ask-matt |
| `obra/superpowers` | verification-before-completion، test-driven-development، writing-plans، systematic-debugging، brainstorming |
| `leonxlnx/taste-skill` | design-taste-frontend |
| `supabase/agent-skills` | supabase-postgres-best-practices |
| `vercel-labs/agent-skills` | web-design-guidelines، vercel-react-best-practices |
| `vercel-labs/agent-browser` | agent-browser |
| `shadcn/improve` | improve |
| `nutlope/hallmark` | hallmark |
| (از قبل در سیستم) | remotion-best-practices، find-skills |

## یادداشت‌ها

- مسیر هر اسکیل: `~/.agents/skills/<slug>/SKILL.md` — ZCode این مسیر را مستقیم می‌خواند و `~/.zcode/skills/` هم symlink دارد. برای دیدن اسکیل‌های جدید در فهرستِ اسکیل‌ها، یک بار ZCode را راه‌اندازی مجدد کنید.
- همه‌ی نصب‌های جدید در `.skill-lock.json` ثبت شده‌اند؛ از این پس با `npx skills update` قابل به‌روزرسانی‌اند.
- مقاله‌های بخش «یادگیری» سایت در `~/.agents/promptkade/learn/` ذخیره شده‌اند (اسکیل نیستند).

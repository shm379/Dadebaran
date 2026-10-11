# پرامپت‌های پرامپت‌کده

همه‌ی پرامپت‌ها/اسکیل‌های [پرامپت‌کده](https://promptkade.xyz/skills) — ۲۳ مورد — عیناً از خود سایت (endpoint رسمی دانلود بسته) در این پوشه منتقل شده‌اند.

## ساختار

- `<slug>/SKILL.md` — پرامپت اصلی هر اسکیل (مارک‌داون با frontmatter شامل name و description)
- `<slug>/references/`، `<slug>/evals/` و… — فایل‌های جانبی بعضی اسکیل‌ها
- `catalog.md` — کاتالوگ فارسی: توضیح، دسته و وضعیت هر ۲۳ اسکیل + منبع GitHub هر کدام

## فهرست

| دسته | اسکیل‌ها |
|------|----------|
| مارکتینگ | programmatic-seo، marketing-psychology، copywriting، seo-audit |
| تولید محتوا | content-strategy |
| کدنویسی | code-review، diagnosing-bugs، verification-before-completion، test-driven-development، systematic-debugging، supabase-postgres-best-practices، remotion-best-practices، vercel-react-best-practices، agent-browser، improve |
| بهره‌وری | grill-me، writing-plans، find-skills، ask-matt |
| طراحی | design-taste-frontend، web-design-guidelines، hallmark |
| سایر | brainstorming |

## یادداشت

- تاریخ انتقال: ۱۱ اکتبر ۲۰۲۶ — نسخه‌ی هر بسته همان است که سایت در همان لحظه می‌داد.
- همین اسکیل‌ها به‌صورت فعال هم در سیستم نصب‌اند (`~/.agents/skills/`) و در `.skill-lock.json` از منابع کانونی GitHub ثبت شده‌اند؛ این پوشه نسخه‌ی داخل ریپازیتوری پروژه است.
- برای استفاده در ایجنت‌ها، محتوای `SKILL.md` هر پوشه همان پرامپت آماده‌ی استفاده است.

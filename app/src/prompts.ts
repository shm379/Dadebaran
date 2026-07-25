// Prompt construction and response parsing — a direct port of the prototype's
// `buildPrompt`, `jsonInstr` and `parse`.
import type { BotId } from './config'
import type { Settings } from './types'

export type { Settings }
export type MediaKind = 'image' | 'video' | null

function jsonInstr(keys: string): string {
  return 'فقط یک JSON معتبر برگردان، بدونِ هیچ متنِ اضافه و بدونِ code fence، دقیقاً با این کلیدها:\n' + keys
}

export function buildPrompt(
  bot: BotId,
  idea: string,
  s: Settings,
  modifier?: string,
  mediaKind?: MediaKind,
): string {
  const mod = modifier ? 'نکته‌ی اصلاحی: ' + modifier + '\n' : ''
  if (mediaKind) {
    const what = mediaKind === 'video' ? 'یک فریم از یک ویدیوی پیوست‌شده' : 'یک تصویرِ پیوست‌شده'
    idea =
      idea && idea.trim()
        ? idea + '\n(' + what + ' هم هست؛ به آن نگاه کن و در پاسخ از محتوایش استفاده کن.)'
        : 'به ' + what + ' نگاه کن و بر اساسِ محتوای آن این کار را انجام بده.'
  }
  if (bot === 'formal') {
    return [
      'تو ویراستارِ متونِ رسمیِ فارسی هستی.',
      'متنِ محاوره‌ایِ کاربر: «' + idea + '»',
      'این را به فارسیِ «' + s.formality + '» و مودبانه برای «' + s.kind + '» بازنویسی کن.',
      'طولِ خروجی: ' + s.length + '. معنا را تغییر نده؛ فقط لحن، ادب و ساختارِ مکاتبه را درست کن.',
      mod,
      jsonInstr(
        '{"title":"عنوانِ کوتاهِ فارسی","prompt":"متنِ رسمیِ بازنویسی‌شده (آماده‌ی کپی)","tips":["دو نکته‌ی کوتاه درباره‌ی لحن یا کاربردِ این متن"]}',
      ),
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (bot === 'insta') {
    const n = s.hooks === '3' ? 'سه' : 'پنج'
    return [
      'تو یک کوچِ محتوای اینستاگرام برای مخاطبِ فارسی‌زبان هستی.',
      'موضوعِ پست: «' + idea + '»',
      'قالب: ' + s.format + '. لحن: ' + s.tone + '.',
      'خروجی باید شاملِ این بخش‌ها باشد و همه در فیلدِ prompt به‌صورتِ متنِ چندخطی بیاید:',
      '۱) «' +
        n +
        ' هوک» شماره‌دار، هر کدام یک خط. ۲) یک خط فاصله. ۳) «کپشن:» و یک کپشنِ کامل. ۴) «CTA:» و یک فراخوانِ اقدام. ۵) «هشتگ‌ها:» و ۵ تا ۷ هشتگِ فارسیِ مرتبط.',
      mod,
      jsonInstr(
        '{"title":"موضوع به‌شکلِ کوتاه","prompt":"کلِ بسته‌ی هوک‌ها، کپشن، CTA و هشتگ‌ها","tips":["دو نکته‌ی کوتاهِ انتشار"]}',
      ),
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (bot === 'english') {
    return [
      'تو یک مربیِ زبانِ انگلیسی برای فارسی‌زبان‌ها هستی و توضیح‌ها را به فارسیِ ساده می‌دهی.',
      'سطحِ زبان‌آموز: ' + s.level + '. تمرکزِ این تمرین: ' + s.focus + '.',
      'ورودیِ کاربر: «' + idea + '»',
      'این کار را انجام بده: ۱) نسخه‌ی درست و طبیعیِ انگلیسی را بنویس (اگر ورودی فارسی بود، معادلِ انگلیسیِ مناسب بده). ۲) اشتباه‌ها یا نکته‌ها را به فارسیِ ساده توضیح بده. ۳) یک سؤالِ کوتاهِ انگلیسی برای ادامه‌ی مکالمه بپرس.',
      mod,
      jsonInstr(
        '{"title":"عنوانِ کوتاهِ فارسی","prompt":"دقیقاً این بخش‌ها با همین عنوان‌های فارسی و یک خط فاصله بینشان: «نسخه‌ی درست:» سپس متنِ انگلیسی، «توضیح:» سپس توضیحِ فارسی، «برای ادامه:» سپس یک سؤالِ کوتاهِ انگلیسی","tips":["یک نکته‌ی کوتاهِ یادگیری"]}',
      ),
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (bot === 'study') {
    const want = s.output
    const parts: string[] = []
    if (want === 'خلاصه' || want === 'همه') parts.push('«خلاصه:» یک خلاصه‌ی روان و نکته‌وار.')
    if (want === 'فلش‌کارت' || want === 'همه')
      parts.push('«فلش‌کارت‌ها:» چهار تا شش فلش‌کارت، هر کدام در یک خط به‌شکلِ «پرسش — پاسخ».')
    if (want === 'سؤال امتحانی' || want === 'همه')
      parts.push('«سؤال‌های امتحانی:» سه تا پنج سؤال با پاسخِ کوتاه.')
    return [
      'تو یک دستیارِ مطالعه برای دانش‌آموزان و دانشجوهای فارسی‌زبان هستی.',
      'سطح: ' + s.level + '.',
      'متن یا موضوعِ کاربر: «' + idea + '»',
      'این بخش‌ها را بساز و هر بخش را با همان عنوانِ فارسی و یک خط فاصله جدا کن: ' + parts.join(' '),
      mod,
      jsonInstr(
        '{"title":"عنوانِ کوتاهِ فارسی","prompt":"کلِ بخش‌های خواسته‌شده به‌صورتِ متنِ چندخطی","tips":["یک یا دو نکته‌ی مطالعه‌ی کوتاه"]}',
      ),
    ]
      .filter(Boolean)
      .join('\n')
  }
  const langName = s.lang === 'en' ? 'English' : 'فارسی'
  const domain =
    (
      {
        عمومی: 'کاربرد عمومی است؛ پرامپتی همه‌منظوره و روشن بنویس.',
        تصویرسازی:
          'برای مدل‌های تصویرساز است؛ سبکِ بصری، نورپردازی، ترکیب‌بندی، رنگ، لنز و نسبتِ تصویر را مشخص کن.',
        نوشتن: 'برای تولیدِ متن است؛ مخاطب، لحن، طول، ساختار و هدفِ متن را مشخص کن.',
        کدنویسی:
          'برای کدنویسی است؛ زبان/فریم‌ورک، ورودی و خروجی، محدودیت‌ها و معیارِ درستی را مشخص کن.',
      } as Record<string, string>
    )[s.useCase] || ''
  return [
    'تو یک مهندس پرامپتِ خبره هستی که برای کاربرانِ فارسی‌زبان پرامپتِ بهینه می‌نویسی.',
    'ایده‌ی خامِ کاربر: «' + idea + '»',
    'کاربرد: ' + s.useCase + '. ' + domain,
    'زبانِ خروجیِ پرامپت باید ' + langName + ' باشد. لحن: ' + s.tone + '.',
    mod,
    'یک پرامپتِ آماده‌ی استفاده و ساختارمند بنویس که بهترین شیوه‌ها (نقش، هدفِ روشن، زمینه، قالبِ خروجی و محدودیت‌ها) را به‌شکلِ طبیعی داشته باشد و مستقیم قابلِ کپی در ChatGPT باشد.',
    jsonInstr(
      '{"title":"عنوانِ کوتاهِ فارسی","prompt":"متنِ کاملِ پرامپت به زبانِ خواسته‌شده","tips":["دو تا سه نکته‌ی کوتاهِ فارسی"]}',
    ),
  ]
    .filter(Boolean)
    .join('\n')
}

export type Parsed = { title: string; prompt: string; tips: string[] }

// Read one string field out of a JSON envelope that may still be incomplete,
// stopping at the end of the text received so far.
function partialField(s: string, key: string): string {
  const at = s.search(new RegExp('"' + key + '"\\s*:'))
  if (at < 0) return ''
  const open = s.indexOf('"', s.indexOf(':', at))
  if (open < 0) return ''
  let out = ''
  for (let i = open + 1; i < s.length; i++) {
    const ch = s[i]
    if (ch === '\\') {
      const n = s[i + 1]
      if (n === undefined) break
      out += n === 'n' ? '\n' : n === 't' ? '\t' : n === 'r' ? '' : n
      i++
      continue
    }
    if (ch === '"') break
    out += ch
  }
  return out
}

function stripFence(raw: string): string {
  return (raw || '').replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '')
}

/**
 * Best-effort read of the `prompt` field out of a partially-received answer, so
 * a streaming response shows the prompt being written rather than raw JSON.
 * Returns '' while the field hasn't started arriving yet. Plain-text answers
 * (no JSON envelope) are shown verbatim.
 */
export function partialPrompt(raw: string): string {
  const s = stripFence(raw).trimStart()
  if (!s) return ''
  if (!s.startsWith('{')) return s
  return partialField(s, 'prompt')
}

export function parse(raw: string): Parsed {
  let s = stripFence(raw).trim()
  const a = s.indexOf('{'),
    b = s.lastIndexOf('}')
  if (a >= 0 && b > a) s = s.slice(a, b + 1)
  try {
    const o = JSON.parse(s)
    return {
      title: o.title || 'خروجیِ پیشنهادی',
      prompt: (o.prompt || raw || '').trim(),
      tips: Array.isArray(o.tips) ? o.tips.slice(0, 3) : [],
    }
  } catch {
    // Truncated envelope — stopped early, or the answer hit the token cap.
    // Recover the text that was actually written instead of showing raw JSON.
    const salvaged = partialPrompt(raw).trim()
    return {
      title: partialField(s, 'title') || 'خروجیِ پیشنهادی',
      prompt: salvaged || (raw || '').trim(),
      tips: [],
    }
  }
}

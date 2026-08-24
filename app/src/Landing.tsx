import { css } from './css'

export default function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div dir="rtl" style={css("min-height:100vh;display:flex;flex-direction:column;font-family:'Vazirmatn',Tahoma,sans-serif;color:#f7fbff;background:radial-gradient(circle at 18% -10%,rgba(22,122,254,.34),transparent 46%),radial-gradient(circle at 84% 116%,rgba(22,122,254,.2),transparent 56%),#101424;")}>
      <header style={css("display:flex;align-items:center;justify-content:space-between;padding:1.5rem 3rem;")}>
        <div style={css("display:flex;align-items:center;gap:12px;")}>
          <div style={css('width:44px;height:44px;display:grid;place-items:center;border-radius:13px;background:rgba(22,122,254,.18);border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 0 40px rgba(22,122,254,.4);')}>
            <img src="/assets/logo-mark-dark.svg" alt="داده باران" style={css('width:24px;height:24px;')} />
          </div>
          <strong style={css("font-size:1.3rem;font-weight:800;")}>داده باران</strong>
        </div>
        <div>
          <button onClick={onStart} style={css("background:none;border:none;color:#fff;font-family:inherit;font-size:1rem;font-weight:600;cursor:pointer;padding:0.5rem 1rem;")}>ورود / ثبت‌نام</button>
        </div>
      </header>
      
      <main style={css("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:2rem;")}>
        <h1 style={css("font-size:3.5rem;font-weight:900;margin-bottom:1rem;")}>همراه هوشمند شما در <span style={css("color:#167afe;")}>داده باران</span></h1>
        <p style={css("font-size:1.3rem;color:rgba(255,255,255,0.7);max-width:600px;margin-bottom:3rem;line-height:1.6;")}>
          بهترین دستیارهای هوش مصنوعی با قابلیت اجرای وظایف، مکالمه صوتی، و حل مسائل پیچیده در اختیار شماست.
        </p>
        
        <button onClick={onStart} style={css("display:inline-flex;align-items:center;justify-content:center;padding:1rem 2.5rem;border-radius:14px;font-weight:700;font-size:1.2rem;cursor:pointer;color:#fff;border:1px solid #167afe;background:linear-gradient(180deg,#2488ff,#1460ca);box-shadow:0 8px 30px rgba(22,122,254,0.4);transition:all 0.2s;")}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          شروع گفت‌وگو
        </button>
      </main>
    </div>
  )
}

import React from 'react';
import { ArrowRight, Check, Eye, Lock, Pause, ShieldCheck } from 'lucide-react';
import Logo from '../components/Logo';

const features = [
  { icon: Eye, title: 'Agent Registry', text: 'Know who owns each agent and exactly what it can do.' },
  { icon: Check, title: 'Approval Checkpoints', text: 'Give people a say before high-impact actions happen.' },
  { icon: ShieldCheck, title: 'Activity Trail', text: 'Keep a tamper-evident record of every action.' },
  { icon: Pause, title: 'Pause and Restrict', text: 'Stop or limit any agent in one click.' },
];

const steps = ['Register your agents', 'Set your rules', 'Every action is checked', 'Everything is recorded'];

const promises = [
  'Your data stays with you',
  'Agents see only what they need',
  'Customers only ever see their own information',
  'Company internal information is never shared',
];

function TopBar({ onLogin, onSignup }) {
  return (
    <header className="fixed top-0 w-full z-10 bg-white/70 backdrop-blur-md border-b border-[#E6E0D3]">
      <div className="max-w-[1120px] mx-auto px-6 h-[68px] flex items-center gap-10">
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center" aria-label="WARDEN home">
          <Logo height={28} />
        </button>
        <nav className="hidden md:flex gap-7 text-[13px] text-stone-500">
          <a href="#about" className="hover:text-stone-900 transition">Why Warden</a>
          <a href="#product" className="hover:text-stone-900 transition">Product</a>
          <a href="#how-it-works" className="hover:text-stone-900 transition">How it works</a>
          <a href="#security" className="hover:text-stone-900 transition">Security</a>
        </nav>
        <div className="flex items-center gap-2.5 ml-auto">
          <button
            onClick={onLogin}
            className="text-[13px] px-3.5 py-2 rounded-md border border-stone-300 bg-white text-stone-900 hover:border-stone-900 transition"
          >
            Log in
          </button>
          <button
            onClick={onSignup}
            className="text-[13px] font-medium px-3.5 py-2 rounded-md bg-stone-900 text-white hover:bg-stone-800 transition"
          >
            Sign up
          </button>
        </div>
      </div>
    </header>
  );
}

function FlowCard() {
  return (
    <div className="w-full max-w-[430px] p-5 bg-white border border-[#E6E0D3] rounded-lg shadow-[0_1px_2px_rgba(28,25,23,0.06)]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-[0.11em] text-stone-900">LIVE CONTROL ROOM</span>
        <span className="text-[11px] text-stone-500 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-stone-900 inline-block" /> Monitoring
        </span>
      </div>
      <div className="flex items-center gap-3 my-6">
        <div className="w-10 h-10 rounded-md bg-stone-900 text-white grid place-items-center text-[11px] font-bold">AR</div>
        <div>
          <div className="text-[13px] font-semibold text-stone-900">Account Recovery Agent</div>
          <div className="text-[11px] text-stone-500 mt-0.5">Request: reset customer account</div>
        </div>
      </div>
      <div className="border-t border-stone-100" />
      <div className="flex items-center justify-between py-4 text-[11px] text-stone-500">
        <span>Approval status</span>
        <span className="px-3 py-1.5 rounded-full bg-stone-900 text-white font-medium">Approved by manager</span>
      </div>
      <div className="flex items-center gap-3 py-3.5 border-t border-stone-100">
        <span className="w-[22px] h-[22px] grid place-items-center rounded-full bg-stone-900 text-white text-[12px]">✓</span>
        <div>
          <div className="text-[13px] font-semibold text-stone-900">Action added to audit trail</div>
          <div className="text-[11px] text-stone-500 mt-0.5">manager@acme.co · just now</div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 text-[10px] text-stone-400">
        <span>Policy: Customer data access</span>
        <span>•••</span>
      </div>
    </div>
  );
}

export default function Landing({ onLogin, onSignup }) {
  return (
    <div className="min-h-screen bg-[#F2EFE9] text-stone-900">
      <TopBar onLogin={onLogin} onSignup={onSignup} />

      {/* Hero — same copy as warden-frontend.zip, restyled to CODEX theme */}
      <section className="max-w-[1120px] mx-auto px-6 grid md:grid-cols-[1fr_0.85fr] gap-16 items-center min-h-[720px] pt-[120px] pb-16">
        <div>
          <span className="text-[11px] font-bold tracking-[0.11em] text-stone-900">THE ACCOUNTABILITY LAYER FOR AI</span>
          <h1 className="mt-4 text-[clamp(44px,6vw,68px)] leading-[1.03] tracking-tight font-bold">
            Every AI agent.<br />
            <span className="text-stone-500">Under your control.</span>
          </h1>
          <p className="mt-6 max-w-[480px] text-[16px] leading-relaxed text-stone-500">
            WARDEN helps teams use AI agents safely. Set clear boundaries, ask a human before
            high-impact actions, and keep a record of what happened.
          </p>
          <div className="flex gap-3 mt-8">
            <button
              onClick={onSignup}
              className="inline-flex items-center gap-2 bg-stone-900 text-white text-[13px] font-semibold px-5 py-3 rounded-md hover:bg-stone-800 transition"
            >
              Get started <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#how-it-works"
              className="inline-flex items-center bg-white border border-stone-300 text-stone-900 text-[13px] font-semibold px-5 py-3 rounded-md hover:border-stone-500 transition"
            >
              See how it works
            </a>
          </div>
          <div className="flex items-center gap-2 mt-7 text-[11px] text-stone-500">
            <span className="w-[19px] h-[19px] grid place-items-center border border-stone-400 rounded-full text-stone-900 text-[10px] font-bold">✓</span>
            Made for teams that need people to stay accountable.
          </div>
        </div>
        <div className="flex md:justify-end">
          <FlowCard />
        </div>
      </section>

      {/* Why Warden */}
      <section id="about" className="border-y border-[#E6E0D3] bg-white">
        <div className="max-w-[1120px] mx-auto px-6 py-20 grid md:grid-cols-[0.7fr_1.3fr] gap-10">
          <span className="text-[11px] font-bold tracking-[0.11em]">WHY WARDEN</span>
          <div>
            <h2 className="text-[clamp(28px,4vw,44px)] leading-tight tracking-tight font-bold">
              AI is becoming part of every team.<br />
              <span className="text-stone-500">Accountability should be too.</span>
            </h2>
            <p className="mt-4 max-w-[550px] text-stone-500 leading-relaxed">
              Companies are replacing manual work with AI agents. WARDEN makes sure security and
              accountability are never compromised as they do.
            </p>
          </div>
        </div>
      </section>

      {/* Product */}
      <section id="product" className="max-w-[1120px] mx-auto px-6 py-24">
        <span className="text-[11px] font-bold tracking-[0.11em]">ONE CLEAR VIEW</span>
        <h2 className="mt-3 mb-10 text-[clamp(30px,4vw,44px)] tracking-tight font-bold">Control without slowing down.</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {features.map(({ icon: Icon, title, text }) => (
            <article key={title} className="bg-white border border-[#E6E0D3] rounded-lg p-6 min-h-[190px] hover:border-stone-400 hover:-translate-y-1 transition">
              <Icon className="w-5 h-5 text-stone-900 mb-10" strokeWidth={1.5} />
              <h3 className="text-[14px] font-semibold mb-2">{title}</h3>
              <p className="text-[13px] text-stone-500 leading-relaxed m-0">{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-[#E9E2D3]/70 border-y border-[#E6E0D3]">
        <div className="max-w-[1120px] mx-auto px-6 py-20">
          <span className="text-[11px] font-bold tracking-[0.11em]">HOW IT WORKS</span>
          <h2 className="mt-3 mb-10 text-[clamp(30px,4vw,44px)] tracking-tight font-bold">A simple path to safer agents.</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={step}>
                <span className="text-[12px] font-bold">0{i + 1}</span>
                <h3 className="mt-4 text-[14px] font-semibold leading-snug max-w-[160px]">{step}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="bg-white border-b border-[#E6E0D3]">
        <div className="max-w-[1120px] mx-auto px-6 py-20 grid md:grid-cols-[0.7fr_1.3fr] gap-10">
          <div>
            <span className="text-[11px] font-bold tracking-[0.11em]">SECURITY PROMISE</span>
            <h2 className="mt-3 text-[clamp(30px,4vw,44px)] leading-tight tracking-tight font-bold">
              Built for trust.<br />
              <span className="text-stone-500">Designed for control.</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {promises.map((t) => (
              <div key={t} className="flex items-center gap-3 p-4 border border-[#E6E0D3] rounded-md bg-[#F2EFE9] text-[13px] text-stone-700">
                <Lock className="w-4 h-4 text-stone-900 shrink-0" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[1120px] mx-auto px-6 py-24 text-center">
        <h2 className="text-[clamp(36px,5vw,56px)] leading-tight tracking-tight font-bold">Bring your agents<br />under control.</h2>
        <p className="text-stone-500 mt-3">Start with a clear view of every action.</p>
        <div className="flex gap-3 justify-center mt-8">
          <button
            onClick={onSignup}
            className="inline-flex items-center gap-2 bg-stone-900 text-white text-[13px] font-semibold px-5 py-3 rounded-md hover:bg-stone-800 transition"
          >
            Sign up <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onLogin}
            className="bg-white border border-stone-300 text-stone-900 text-[13px] font-semibold px-5 py-3 rounded-md hover:border-stone-500 transition"
          >
            Log in
          </button>
        </div>
      </section>

      <footer className="border-t border-[#E6E0D3] bg-white">
        <div className="max-w-[1120px] mx-auto px-6 min-h-[72px] py-4 flex flex-wrap items-center justify-between gap-4 text-[11px] text-stone-500">
          <div className="flex items-center gap-3">
            <Logo height={24} />
            <span>Built by team HIDE &amp; SEEK</span>
          </div>
          <div className="flex gap-6">
            <a href="#product" className="hover:text-stone-900">Product</a>
            <a href="#security" className="hover:text-stone-900">Security</a>
            <button onClick={onLogin} className="hover:text-stone-900">Log in</button>
          </div>
          <span>© 2026 WARDEN. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}

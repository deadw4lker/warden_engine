import React from 'react';
import { ArrowRight, Check, Eye, Lock, Pause, ShieldCheck } from 'lucide-react';
import Logo from '../components/Logo';

const features = [
  { icon: Eye, title: 'Agent access', text: 'Choose what each agent can do, what information it can use, and how much it can spend.' },
  { icon: Check, title: 'Human review', text: 'Send requests that need a person’s decision to the right reviewer.' },
  { icon: ShieldCheck, title: 'Company rules', text: 'Check every request against the rules your team has set.' },
  { icon: Pause, title: 'Pause an agent', text: 'Stop an agent from the console whenever its activity needs attention.' },
];

const steps = [
  'Add an agent and connect it to WARDEN',
  'Choose what it can do and what information it can use',
  'Check each request before the agent acts',
  'Review decisions in the activity log',
];

const controls = [
  'Check requests before the agent acts',
  'Ask a person to review important requests',
  'Pause or restart an agent from the console',
  'Keep a protected record of each decision',
];

function TopBar({ onLogin, onSignup }) {
  return (
    <header className="fixed top-0 w-full z-10 border-t-4 border-t-[#367F92] bg-white/85 backdrop-blur-xl border-b border-[#D8E8EC] shadow-[0_4px_18px_rgba(42,94,109,0.05)]">
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
            className="action-pop text-[13px] px-3.5 py-2 rounded-md border border-stone-300 bg-white text-stone-900 hover:border-stone-900 transition"
          >
            Log in
          </button>
          <button
            onClick={onSignup}
            className="action-pop text-[13px] font-medium px-3.5 py-2 rounded-md bg-stone-900 text-white hover:bg-stone-800 transition"
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
    <div className="glass-surface hover-lift w-full max-w-[430px] p-5 rounded-lg">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-[0.11em] text-[#2F7182]">EXAMPLE REQUEST</span>
        <span className="text-[11px] text-stone-500 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3F899A] inline-block" /> Checked before it happens
        </span>
      </div>
      <div className="flex items-center gap-3 my-6">
        <div className="w-10 h-10 rounded-md bg-stone-900 text-white grid place-items-center text-[11px] font-bold">SA</div>
        <div>
          <div className="text-[13px] font-semibold text-stone-900">Support Agent</div>
          <div className="text-[11px] text-stone-500 mt-0.5">Request: issue refund · $1,250</div>
        </div>
      </div>
      <div className="border-t border-stone-100" />
      <div className="flex items-center justify-between py-4 text-[11px] text-stone-500">
        <span>Decision</span>
        <span className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 font-medium">Awaiting human review</span>
      </div>
      <div className="flex items-center gap-3 py-3.5 border-t border-stone-100">
        <span className="w-[22px] h-[22px] grid place-items-center rounded-full bg-stone-900 text-white text-[12px]">✓</span>
        <div>
          <div className="text-[13px] font-semibold text-stone-900">Decision recorded in the ledger</div>
          <div className="text-[11px] text-stone-500 mt-0.5">support_agent · just now</div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 text-[10px] text-stone-400">
        <span>Company rule: Large refunds need review</span>
        <span>•••</span>
      </div>
    </div>
  );
}

export default function Landing({ onLogin, onSignup }) {
  return (
    <div className="min-h-screen bg-[#F4F7FA] text-stone-900">
      <TopBar onLogin={onLogin} onSignup={onSignup} />

      {/* Hero copy describes WARDEN's pre-execution governance workflow. */}
      <section className="max-w-[1120px] mx-auto px-6 grid md:grid-cols-[1fr_0.85fr] gap-16 items-center min-h-[720px] pt-[120px] pb-16">
        <div className="motion-enter">
          <span className="inline-flex rounded-full bg-[#E5F1F4] px-3 py-1.5 text-[11px] font-bold tracking-[0.11em] text-[#2A6877]">CLEAR RULES FOR AI AGENTS</span>
          <h1 className="mt-4 text-[clamp(44px,6vw,68px)] leading-[1.03] tracking-tight font-bold">
            Every AI agent.<br />
            <span className="text-[#367F92]">Checked before it acts.</span>
          </h1>
          <p className="mt-6 max-w-[480px] text-[16px] leading-relaxed text-stone-500">
            WARDEN checks what each agent wants to do against the access you gave it and your
            company’s rules. Requests that need a person’s decision wait for review, and every
            outcome is saved in the activity log.
          </p>
          <div className="flex gap-3 mt-8">
            <button
              onClick={onSignup}
              className="action-pop inline-flex items-center gap-2 bg-stone-900 text-white text-[13px] font-semibold px-5 py-3 rounded-md hover:bg-stone-800 transition"
            >
              Create your workspace <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#how-it-works"
              className="action-pop inline-flex items-center bg-white border border-stone-300 text-stone-900 text-[13px] font-semibold px-5 py-3 rounded-md hover:border-stone-500 transition"
            >
              See how it works
            </a>
          </div>
          <div className="flex items-center gap-2 mt-7 text-[11px] text-stone-500">
            <span className="w-[19px] h-[19px] grid place-items-center border border-stone-400 rounded-full text-stone-900 text-[10px] font-bold">✓</span>
            Request checks · Human review · Activity history
          </div>
        </div>
        <div className="motion-enter motion-delay-150 flex md:justify-end">
          <FlowCard />
        </div>
      </section>

      {/* Why Warden */}
      <section id="about" className="border-y border-[#D8E8EC] bg-white">
        <div className="max-w-[1120px] mx-auto px-6 py-20 grid md:grid-cols-[0.7fr_1.3fr] gap-10">
          <span className="text-[11px] font-bold tracking-[0.11em] text-[#2F7182]">WHY WARDEN</span>
          <div>
            <h2 className="text-[clamp(28px,4vw,44px)] leading-tight tracking-tight font-bold">
              AI agents can act quickly.<br />
              <span className="text-stone-500">Your rules should come first.</span>
            </h2>
            <p className="mt-4 max-w-[550px] text-stone-500 leading-relaxed">
              Before an agent carries out a request, WARDEN checks that it is allowed and follows
              your company’s rules. Requests that need a closer look go to a person.
            </p>
          </div>
        </div>
      </section>

      {/* Product */}
      <section id="product" className="max-w-[1120px] mx-auto px-6 py-24">
        <span className="text-[11px] font-bold tracking-[0.11em] text-[#2F7182]">YOUR WARDEN CONSOLE</span>
        <h2 className="mt-3 mb-10 text-[clamp(30px,4vw,44px)] tracking-tight font-bold">Set clear limits. Review requests. Keep a record.</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {features.map(({ icon: Icon, title, text }) => (
            <article key={title} className="glass-surface hover-lift rounded-lg p-6 min-h-[190px]">
              <div className="mb-8 grid h-10 w-10 place-items-center rounded-lg border border-[#D5E5DB] bg-[#EDF4EF] text-[#356A58]">
                <Icon className="w-5 h-5" strokeWidth={1.8} aria-hidden="true" />
              </div>
              <h3 className="text-[14px] font-semibold mb-2">{title}</h3>
              <p className="text-[13px] text-stone-500 leading-relaxed m-0">{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-[#EAF3F6] border-y border-[#D8E8EC]">
        <div className="max-w-[1120px] mx-auto px-6 py-20">
          <span className="text-[11px] font-bold tracking-[0.11em] text-[#2F7182]">HOW IT WORKS</span>
          <h2 className="mt-3 mb-10 text-[clamp(30px,4vw,44px)] tracking-tight font-bold">From adding an agent to reviewing what it did.</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={step}>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#D5E9EE] text-[12px] font-bold text-[#225C69]">0{i + 1}</span>
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
            <span className="text-[11px] font-bold tracking-[0.11em] text-[#2F7182]">HOW WARDEN HELPS</span>
            <h2 className="mt-3 text-[clamp(30px,4vw,44px)] leading-tight tracking-tight font-bold">
              Clear limits.<br />
              <span className="text-stone-500">A clear record of each decision.</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {controls.map((t) => (
              <div key={t} className="flex items-center gap-3 p-4 border border-[#D8E8EC] rounded-md bg-[#F4F8FA] text-[13px] text-stone-700">
                <Lock className="w-4 h-4 text-[#367F92] shrink-0" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[1120px] mx-auto px-6 py-24 text-center">
        <h2 className="text-[clamp(36px,5vw,56px)] leading-tight tracking-tight font-bold">Know what your agents can do.<br />Control what happens next.</h2>
        <p className="text-stone-500 mt-3">Manage agent access, review important requests, and see what happened in one place.</p>
        <div className="flex gap-3 justify-center mt-8">
          <button
            onClick={onSignup}
            className="action-pop inline-flex items-center gap-2 bg-stone-900 text-white text-[13px] font-semibold px-5 py-3 rounded-md hover:bg-stone-800 transition"
          >
            Create your workspace <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onLogin}
            className="action-pop bg-white border border-stone-300 text-stone-900 text-[13px] font-semibold px-5 py-3 rounded-md hover:border-stone-500 transition"
          >
            Log in
          </button>
        </div>
      </section>

      <footer className="border-t border-[#E6E0D3] bg-white">
        <div className="max-w-[1120px] mx-auto px-6 min-h-[72px] py-4 flex flex-wrap items-center justify-between gap-4 text-[11px] text-stone-500">
          <div className="flex items-center gap-3">
              <Logo height={24} />
            <span>Clear rules and oversight for AI agents</span>
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

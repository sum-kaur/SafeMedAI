import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, Brain, Heart, FileText, Zap, Users, Shield, Loader2, CheckCircle, ChevronDown } from 'lucide-react';

/* ─── Pill Logo (from SafeMedAI demo site) ─────────────────────────── */
function PillLogo({ size = 42 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lp-redHalf" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EF4444" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>
        <linearGradient id="lp-blueHalf" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
        <linearGradient id="lp-tabletGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
        <filter id="lp-pillShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#1E3A5F" floodOpacity="0.3" />
        </filter>
      </defs>
      {/* Red/Blue bi-colored capsule, rotated */}
      <g transform="translate(32, 28) rotate(-35)" filter="url(#lp-pillShadow)">
        <path d="M-18,-7 L0,-7 L0,7 L-18,7 C-21.87,7 -25,3.87 -25,0 C-25,-3.87 -21.87,-7 -18,-7 Z" fill="url(#lp-redHalf)" />
        <path d="M0,-7 L18,-7 C21.87,-7 25,-3.87 25,0 C25,3.87 21.87,7 18,7 L0,7 Z" fill="url(#lp-blueHalf)" />
        <line x1="0" y1="-7" x2="0" y2="7" stroke="white" strokeWidth="0.8" opacity="0.5" />
        <ellipse cx="-12" cy="-3" rx="8" ry="2.5" fill="white" opacity="0.25" transform="rotate(-5)" />
        <ellipse cx="12" cy="-3" rx="8" ry="2.5" fill="white" opacity="0.2" transform="rotate(-5)" />
      </g>
      {/* Blue tablet — right */}
      <g transform="translate(44, 46)">
        <circle cx="0" cy="0" r="10" fill="url(#lp-tabletGrad)" />
        <circle cx="0" cy="0" r="9" fill="none" stroke="white" strokeWidth="0.6" opacity="0.3" />
        <line x1="-6" y1="0" x2="6" y2="0" stroke="white" strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
        <ellipse cx="-2" cy="-4" rx="5" ry="3" fill="white" opacity="0.2" transform="rotate(-15)" />
      </g>
      {/* Red tablet — bottom left */}
      <g transform="translate(14, 50)">
        <circle cx="0" cy="0" r="6" fill="#EF4444" />
        <circle cx="0" cy="0" r="5.3" fill="none" stroke="white" strokeWidth="0.5" opacity="0.3" />
      </g>
    </svg>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────── */
export default function LandingPage() {
  const { user, demoLogin } = useAuth();
  const navigate = useNavigate();
  const [demoLoading, setDemoLoading] = useState(null);

  const handleDemoLogin = async (role) => {
    setDemoLoading(role);
    try {
      await demoLogin(role);
      navigate('/dashboard', { replace: true });
    } catch {
      setDemoLoading(null);
    }
  };

  const handleGoToDashboard = () => {
    if (user) navigate(user.role ? '/dashboard' : '/select-role');
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'Work Sans, sans-serif' }}>

      {/* ── NAV ──────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 border-b"
        style={{ backgroundColor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderColor: '#E2E8F0' }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5" data-testid="logo">
            <PillLogo size={36} />
            <span className="text-xl font-semibold" style={{ fontFamily: 'Outfit', color: '#0F172A' }}>SafeMedAI</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {['How It Works', 'Portals', 'Evidence'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                className="text-sm font-medium transition-colors hover:text-blue-600"
                style={{ color: '#64748B' }}
              >
                {item}
              </a>
            ))}
          </div>
          {user ? (
            <Button
              onClick={handleGoToDashboard}
              className="h-9 px-5 rounded-xl font-medium text-sm"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: 'white' }}
            >
              Go to Dashboard
            </Button>
          ) : (
            <Button
              data-testid="header-login-btn"
              onClick={() => handleDemoLogin('medical_practitioner')}
              disabled={!!demoLoading}
              className="h-9 px-5 rounded-xl font-medium text-sm"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: 'white' }}
            >
              {demoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Try Demo'}
            </Button>
          )}
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)', minHeight: '90vh', display: 'flex', alignItems: 'center' }}
      >
        {/* Ambient glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div style={{ position: 'absolute', top: '-60px', left: '10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(59,130,246,0.14) 0%, transparent 70%)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', top: '20%', right: '5%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(6,182,212,0.10) 0%, transparent 70%)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', bottom: '-80px', left: '30%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(239,68,68,0.07) 0%, transparent 70%)', borderRadius: '50%' }} />
        </div>

        <div className="max-w-6xl mx-auto px-6 py-20 relative z-10 w-full">
          <div className="max-w-3xl mx-auto text-center">
            {/* Label badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8" style={{ backgroundColor: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)' }}>
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs font-semibold tracking-wide" style={{ color: '#93C5FD' }}>
                AI-Powered Medication Safety
              </span>
            </div>

            <h1
              className="font-bold leading-tight mb-6"
              style={{ fontFamily: 'Outfit', fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', color: 'white', letterSpacing: '-0.02em' }}
            >
              Reducing Medication Harm{' '}
              <span style={{ background: 'linear-gradient(135deg, #60A5FA, #06B6D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                for Seniors
              </span>
            </h1>

            <p className="text-lg leading-relaxed mb-10" style={{ color: '#94A3B8', maxWidth: '600px', margin: '0 auto 2.5rem' }}>
              AI-powered discharge summary analysis that flags medication risks, empowers clinicians with actionable insights, and keeps families informed.
            </p>

            {/* Demo CTA */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <button
                data-testid="demo-practitioner-btn"
                onClick={() => handleDemoLogin('medical_practitioner')}
                disabled={!!demoLoading}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-base transition-all duration-200 hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: 'white', boxShadow: '0 4px 24px rgba(59,130,246,0.4)' }}
              >
                {demoLoading === 'medical_practitioner'
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <Brain className="w-5 h-5" />
                }
                Practitioner Demo
              </button>
              <button
                data-testid="demo-family-btn"
                onClick={() => handleDemoLogin('family_carer')}
                disabled={!!demoLoading}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-base transition-all duration-200 hover:-translate-y-0.5"
                style={{ backgroundColor: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', color: '#93C5FD' }}
              >
                {demoLoading === 'family_carer'
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <Heart className="w-5 h-5" />
                }
                Family / Carer Demo
              </button>
            </div>

            <p className="text-xs" style={{ color: '#475569' }}>
              No account needed · Decision support only · Not a substitute for professional medical advice
            </p>

            {/* Scroll cue */}
            <div className="flex justify-center mt-16 animate-bounce">
              <ChevronDown className="w-6 h-6" style={{ color: '#475569' }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24" style={{ backgroundColor: '#F8FAFC' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold tracking-widest mb-3" style={{ color: '#3B82F6' }}>SIMPLE PROCESS</p>
            <h2 className="text-3xl sm:text-4xl font-bold" style={{ fontFamily: 'Outfit', color: '#0F172A', letterSpacing: '-0.02em' }}>
              From discharge summary to actionable insight
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                icon: FileText,
                title: 'Upload',
                desc: 'Snap a photo, screenshot, or upload a PDF of the hospital discharge summary. No special format required.',
                color: '#3B82F6',
                bg: '#EFF6FF',
              },
              {
                step: '02',
                icon: Zap,
                title: 'Analyse',
                desc: 'AI extracts medications and calculates a risk score using evidence-based clinical scoring engines (ACB, DBI, Sedative Load).',
                color: '#06B6D4',
                bg: '#ECFEFF',
              },
              {
                step: '03',
                icon: CheckCircle,
                title: 'Act',
                desc: 'Receive role-appropriate recommendations — detailed clinical guidance for practitioners, plain language for families.',
                color: '#10B981',
                bg: '#ECFDF5',
              },
            ].map((item, i) => (
              <div
                key={i}
                className="relative p-8 rounded-2xl transition-all duration-200 hover:-translate-y-1"
                style={{ backgroundColor: 'white', border: '1px solid #E2E8F0', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
                data-testid={`how-it-works-step-${i}`}
              >
                {/* Accent bar */}
                <div className="h-1 absolute top-0 left-8 right-8 rounded-full" style={{ background: `linear-gradient(90deg, ${item.color}, transparent)` }} />
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-5xl font-black" style={{ fontFamily: 'Outfit', color: `${item.color}20`, lineHeight: 1 }}>{item.step}</span>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: item.bg }}>
                    <item.icon className="w-5 h-5" style={{ color: item.color }} />
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-3" style={{ fontFamily: 'Outfit', color: '#0F172A' }}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TWO PORTALS ──────────────────────────────────────────────── */}
      <section id="portals" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold tracking-widest mb-3" style={{ color: '#3B82F6' }}>ROLE-BASED DESIGN</p>
            <h2 className="text-3xl sm:text-4xl font-bold" style={{ fontFamily: 'Outfit', color: '#0F172A', letterSpacing: '-0.02em' }}>
              Two portals, one mission
            </h2>
            <p className="text-base mt-3 max-w-xl mx-auto" style={{ color: '#64748B' }}>
              Designed for the different needs of clinical teams and families
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Clinical Portal */}
            <div
              className="rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1"
              style={{ border: '1px solid #E2E8F0', boxShadow: '0 8px 32px rgba(59,130,246,0.08)' }}
              data-testid="practitioner-feature-card"
            >
              <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #3B82F6, #06B6D4, #10B981)' }} />
              <div className="p-8">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: '#EFF6FF' }}>
                  <Brain className="w-6 h-6" style={{ color: '#3B82F6' }} />
                </div>
                <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Outfit', color: '#0F172A' }}>Clinical Decision Support</h3>
                <p className="text-sm mb-6" style={{ color: '#64748B' }}>
                  Dense, scannable control-room interface built for medical practitioners
                </p>
                <ul className="space-y-3">
                  {[
                    'ACB, DBI & Sedative Load risk scoring',
                    'Detailed medication extraction from summaries',
                    'Structured recommendations with evidence links',
                    'Patient management and risk timeline',
                    'Clinical Q&A grounded in patient documents',
                  ].map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm" style={{ color: '#334155' }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: '#DBEAFE' }}>
                        <CheckCircle className="w-3 h-3" style={{ color: '#3B82F6' }} />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  data-testid="prac-portal-demo-btn"
                  onClick={() => handleDemoLogin('medical_practitioner')}
                  disabled={!!demoLoading}
                  className="mt-8 w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: 'white' }}
                >
                  {demoLoading === 'medical_practitioner' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Try Practitioner Demo <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Family Portal */}
            <div
              className="rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1"
              style={{ border: '1px solid #E2E8F0', boxShadow: '0 8px 32px rgba(239,68,68,0.06)' }}
              data-testid="family-feature-card"
            >
              <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #EF4444, #F97316, #F59E0B)' }} />
              <div className="p-8">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: '#FEF2F2' }}>
                  <Heart className="w-6 h-6" style={{ color: '#EF4444' }} />
                </div>
                <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Outfit', color: '#0F172A' }}>Family & Carer Portal</h3>
                <p className="text-sm mb-6" style={{ color: '#64748B' }}>
                  Simple, jargon-free interface designed for families caring for elderly loved ones
                </p>
                <ul className="space-y-3">
                  {[
                    'Plain-language risk explanations',
                    'Safe escalation guidance and clear next steps',
                    'Ask questions about the discharge summary',
                    'Emergency contacts and action prompts',
                    'Urgent alerts when review is needed',
                  ].map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm" style={{ color: '#334155' }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: '#FEE2E2' }}>
                        <CheckCircle className="w-3 h-3" style={{ color: '#EF4444' }} />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  data-testid="family-portal-demo-btn"
                  onClick={() => handleDemoLogin('family_carer')}
                  disabled={!!demoLoading}
                  className="mt-8 w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: 'white' }}
                >
                  {demoLoading === 'family_carer' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Try Family Demo <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── EVIDENCE / STATS ─────────────────────────────────────────── */}
      <section id="evidence" className="py-24" style={{ backgroundColor: '#F8FAFC' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold tracking-widest mb-3" style={{ color: '#3B82F6' }}>CLINICAL FOUNDATION</p>
            <h2 className="text-3xl sm:text-4xl font-bold" style={{ fontFamily: 'Outfit', color: '#0F172A', letterSpacing: '-0.02em' }}>
              Built on clinical evidence
            </h2>
            <p className="text-base mt-3 max-w-xl mx-auto" style={{ color: '#64748B' }}>
              SafeMedAI's risk engines are based on validated, peer-reviewed clinical scoring frameworks
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16">
            {[
              { value: '65+', label: 'Target age group', sub: 'Seniors after hospital discharge', color: '#3B82F6', bg: '#EFF6FF' },
              { value: '3', label: 'Scoring engines', sub: 'ACB · DBI · Sedative Load', color: '#06B6D4', bg: '#ECFEFF' },
              { value: 'AI', label: 'Document extraction', sub: 'Vision AI + fallback parser', color: '#10B981', bg: '#ECFDF5' },
            ].map((stat, i) => (
              <div
                key={i}
                className="p-8 rounded-2xl text-center"
                style={{ backgroundColor: 'white', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: stat.bg }}
                >
                  <span className="text-2xl font-black" style={{ fontFamily: 'Outfit', color: stat.color }}>{stat.value}</span>
                </div>
                <p className="font-bold text-base mb-1" style={{ fontFamily: 'Outfit', color: '#0F172A' }}>{stat.label}</p>
                <p className="text-xs" style={{ color: '#94A3B8' }}>{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* Scoring engine details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: 'Anticholinergic Cognitive Burden (ACB)',
                desc: 'Scores medications 0–3 based on anticholinergic potency. High ACB scores (≥3) are linked to increased dementia risk in older adults.',
                color: '#3B82F6',
              },
              {
                title: 'Drug Burden Index (DBI)',
                desc: 'Measures the cumulative exposure to sedative and anticholinergic medications. Higher DBI is associated with functional impairment.',
                color: '#06B6D4',
              },
              {
                title: 'Sedative Load Score',
                desc: 'Quantifies sedative medication burden using a 0–2 scale per drug. Total scores indicate risk of falls, confusion, and reduced cognition.',
                color: '#8B5CF6',
              },
            ].map((engine, i) => (
              <div key={i} className="p-6 rounded-2xl" style={{ backgroundColor: 'white', border: '1px solid #E2E8F0' }}>
                <div className="w-2 h-2 rounded-full mb-3" style={{ backgroundColor: engine.color }} />
                <h4 className="font-bold text-sm mb-2" style={{ fontFamily: 'Outfit', color: '#0F172A' }}>{engine.title}</h4>
                <p className="text-xs leading-relaxed" style={{ color: '#64748B' }}>{engine.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MISSION / CTA ────────────────────────────────────────────── */}
      <section
        className="py-24 relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)' }}
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 65%)', borderRadius: '50%' }} />
        </div>
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <div className="flex justify-center mb-6">
            <PillLogo size={56} />
          </div>
          <h2
            className="font-bold mb-5"
            style={{ fontFamily: 'Outfit', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', color: 'white', letterSpacing: '-0.02em' }}
          >
            On a mission to eliminate{' '}
            <span style={{ background: 'linear-gradient(135deg, #60A5FA, #06B6D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              preventable medication harm
            </span>
          </h2>
          <p className="text-base leading-relaxed mb-10" style={{ color: '#94A3B8', maxWidth: '520px', margin: '0 auto 2.5rem' }}>
            Every year, thousands of seniors are harmed by medication errors after leaving hospital. SafeMedAI gives clinicians and families the tools to catch these risks early.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              data-testid="get-started-btn"
              onClick={() => handleDemoLogin('medical_practitioner')}
              disabled={!!demoLoading}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-base transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: 'white', boxShadow: '0 4px 24px rgba(59,130,246,0.35)' }}
            >
              {demoLoading === 'medical_practitioner' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
              Try the Practitioner Demo
            </button>
            <button
              onClick={() => handleDemoLogin('family_carer')}
              disabled={!!demoLoading}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-base transition-all duration-200 hover:-translate-y-0.5"
              style={{ backgroundColor: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#93C5FD' }}
            >
              {demoLoading === 'family_carer' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Heart className="w-5 h-5" />}
              Try the Family Demo
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────── */}
      <footer className="py-10 border-t" style={{ backgroundColor: '#0F172A', borderColor: '#1E293B' }}>
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <PillLogo size={28} />
            <span className="text-base font-semibold" style={{ fontFamily: 'Outfit', color: '#E2E8F0' }}>SafeMedAI</span>
          </div>
          <p className="text-xs text-center" style={{ color: '#475569' }}>
            Decision support only. Does not replace professional medical judgment.{' '}
            <span style={{ color: '#334155' }}>© {new Date().getFullYear()} SafeMedAI</span>
          </p>
          <div className="flex items-center gap-4">
            <Shield className="w-4 h-4" style={{ color: '#334155' }} />
            <span className="text-xs" style={{ color: '#475569' }}>Healthcare-grade security</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

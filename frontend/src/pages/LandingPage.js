import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Shield, Heart, ArrowRight, FileText, Brain, Users, Loader2 } from 'lucide-react';

export default function LandingPage() {
  const { user, login, demoLogin } = useAuth();
  const navigate = useNavigate();
  const [demoLoading, setDemoLoading] = useState(null);

  const handleGetStarted = () => {
    if (user) {
      window.location.href = user.role ? '/dashboard' : '/select-role';
    } else {
      login();
    }
  };

  const handleDemoLogin = async (role) => {
    setDemoLoading(role);
    try {
      await demoLogin(role);
      navigate('/dashboard', { replace: true });
    } catch {
      setDemoLoading(null);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--sma-bg)' }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: 'var(--sma-border)', backgroundColor: 'var(--sma-bg)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3" data-testid="logo">
            <Shield className="w-8 h-8" style={{ color: 'var(--sma-brand)' }} />
            <span className="text-2xl font-semibold" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>SafeMedAI</span>
          </div>
          <Button
            data-testid="header-login-btn"
            onClick={handleGetStarted}
            className="h-11 px-6 rounded-full font-medium transition-all duration-200 hover:-translate-y-0.5"
            style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}
          >
            {user ? 'Go to Dashboard' : 'Sign In'}
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-16 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <p className="text-sm uppercase tracking-[0.2em] font-semibold mb-4" style={{ color: 'var(--sma-brand)' }}>
              Medication Safety Decision Support
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-tight mb-6" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
              Safer Medication Transitions for Seniors
            </h1>
            <p className="text-base sm:text-lg leading-relaxed mb-8" style={{ color: 'var(--sma-text-secondary)', fontFamily: 'Work Sans' }}>
              SafeMedAI helps reduce medication-related harm for patients aged 65+ after hospital discharge. Upload a discharge summary and receive evidence-based risk analysis with actionable guidance.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                data-testid="get-started-btn"
                onClick={handleGetStarted}
                className="h-14 px-8 text-lg rounded-full font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                style={{ backgroundColor: 'var(--sma-brand)', color: 'var(--sma-text-inverse)' }}
              >
                Get Started <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
            {/* Demo Login */}
            <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--sma-text-muted)' }}>Try a demo account instantly</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  data-testid="demo-practitioner-btn"
                  onClick={() => handleDemoLogin('medical_practitioner')}
                  disabled={!!demoLoading}
                  variant="outline"
                  className="flex-1 h-12 rounded-xl font-medium transition-all duration-200 hover:-translate-y-0.5"
                  style={{ borderColor: 'var(--sma-brand)', color: 'var(--sma-brand)' }}
                >
                  {demoLoading === 'medical_practitioner' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
                  Practitioner Demo
                </Button>
                <Button
                  data-testid="demo-family-btn"
                  onClick={() => handleDemoLogin('family_carer')}
                  disabled={!!demoLoading}
                  variant="outline"
                  className="flex-1 h-12 rounded-xl font-medium transition-all duration-200 hover:-translate-y-0.5"
                  style={{ borderColor: 'var(--sma-accent)', color: 'var(--sma-accent)' }}
                >
                  {demoLoading === 'family_carer' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Heart className="w-4 h-4 mr-2" />}
                  Family / Carer Demo
                </Button>
              </div>
            </div>
            <p className="mt-4 text-xs" style={{ color: 'var(--sma-text-muted)' }}>
              Decision support only. Does not replace professional medical judgment.
            </p>
          </div>
          <div className="animate-slide-up">
            <div className="relative rounded-2xl overflow-hidden shadow-xl" style={{ border: '1px solid var(--sma-border)' }}>
              <img
                src="https://images.unsplash.com/photo-1766808982775-f171b60fbb9e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NjZ8MHwxfHNlYXJjaHwyfHxlbGRlcmx5JTIwcGF0aWVudCUyMHdpdGglMjBmYW1pbHklMjBzbWlsaW5nfGVufDB8fHx8MTc3NTg4NzI0OXww&ixlib=rb-4.1.0&q=85"
                alt="Family caring for elderly loved one"
                className="w-full h-[400px] object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 p-6" style={{ background: 'linear-gradient(transparent, rgba(31,36,33,0.7))' }}>
                <p className="text-white font-medium" style={{ fontFamily: 'Work Sans' }}>Supporting families and clinicians in safer medication management</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16" style={{ backgroundColor: 'var(--sma-surface)' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-medium tracking-tight mb-4" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
              Two Portals. One Mission.
            </h2>
            <p className="text-base sm:text-lg" style={{ color: 'var(--sma-text-secondary)' }}>
              Role-based experiences designed for medical practitioners and family carers
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Practitioner Card */}
            <div className="p-8 rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }} data-testid="practitioner-feature-card">
              <div className="relative rounded-lg overflow-hidden mb-6 h-48">
                <img
                  src="https://images.pexels.com/photos/5452293/pexels-photo-5452293.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
                  alt="Medical practitioner using tablet"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--sma-risk-low-bg)' }}>
                  <Brain className="w-5 h-5" style={{ color: 'var(--sma-brand)' }} />
                </div>
                <h3 className="text-xl font-medium" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>Medical Practitioner Portal</h3>
              </div>
              <ul className="space-y-2 text-sm" style={{ color: 'var(--sma-text-secondary)' }}>
                <li className="flex items-start gap-2"><ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--sma-brand)' }} /> Clinical risk scoring with ACB analysis</li>
                <li className="flex items-start gap-2"><ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--sma-brand)' }} /> Detailed medication extraction from discharge summaries</li>
                <li className="flex items-start gap-2"><ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--sma-brand)' }} /> Decision support Q&A grounded in patient documents</li>
                <li className="flex items-start gap-2"><ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--sma-brand)' }} /> Patient management and risk timeline</li>
              </ul>
            </div>
            {/* Family Card */}
            <div className="p-8 rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }} data-testid="family-feature-card">
              <div className="relative rounded-lg overflow-hidden mb-6 h-48">
                <img
                  src="https://images.unsplash.com/photo-1676280622193-b43637498e82?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1Mjh8MHwxfHNlYXJjaHwxfHxjYXVjYXNpYW4lMjBlbGRlcmx5JTIwbW90aGVyJTIwYWR1bHQlMjBkYXVnaHRlciUyMHNtaWxpbmclMjBjYXJpbmd8ZW58MHx8fHwxNzc1ODg5ODQ0fDA&ixlib=rb-4.1.0&q=85"
                  alt="Caucasian mother and adult daughter smiling together"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--sma-risk-low-bg)' }}>
                  <Heart className="w-5 h-5" style={{ color: 'var(--sma-accent)' }} />
                </div>
                <h3 className="text-xl font-medium" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>Family & Carer Portal</h3>
              </div>
              <ul className="space-y-2 text-sm" style={{ color: 'var(--sma-text-secondary)' }}>
                <li className="flex items-start gap-2"><ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--sma-accent)' }} /> Plain-language risk explanations</li>
                <li className="flex items-start gap-2"><ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--sma-accent)' }} /> Safe escalation guidance and next steps</li>
                <li className="flex items-start gap-2"><ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--sma-accent)' }} /> Ask questions about the discharge summary</li>
                <li className="flex items-start gap-2"><ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--sma-accent)' }} /> Contact information and action prompts</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-center mb-12" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: FileText, title: "Upload", desc: "Upload a discharge summary photo or PDF document" },
              { icon: Brain, title: "Analyse", desc: "AI extracts medications and calculates risk score using the ACB scoring engine" },
              { icon: Users, title: "Act", desc: "Receive role-appropriate recommendations and guidance for next steps" },
            ].map((step, i) => (
              <div key={i} className="text-center p-8 rounded-xl transition-all duration-200 hover:-translate-y-0.5" style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)' }} data-testid={`how-it-works-step-${i}`}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--sma-risk-low-bg)' }}>
                  <step.icon className="w-8 h-8" style={{ color: 'var(--sma-brand)' }} />
                </div>
                <h3 className="text-xl font-medium mb-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>{step.title}</h3>
                <p className="text-sm" style={{ color: 'var(--sma-text-secondary)' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t" style={{ borderColor: 'var(--sma-border)' }}>
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-xs" style={{ color: 'var(--sma-text-muted)' }}>
            SafeMedAI provides decision support information only and does not replace professional medical judgment. Always consult a qualified healthcare professional for medical advice.
          </p>
        </div>
      </footer>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown, FileText, Smartphone, Monitor, GraduationCap,
  Brain, MessageSquare, SlidersHorizontal, Laptop, Lock, WifiOff, Map, TrendingUp, Sparkles,
  ArrowRight, CheckCircle2, ShieldCheck, ScanLine,
} from 'lucide-react';

const PRICING_TIERS = [
  {
    name: 'Starter', price: '$49', popular: false,
    features: ['Up to 500 papers / month', 'Standard OCR engine', 'Basic analytics'],
  },
  {
    name: 'Professional', price: '$199', popular: true,
    features: ['Up to 5,000 papers / month', 'Advanced AI answer scoring', 'Full class analytics', 'CSV / PDF export'],
  },
  {
    name: 'Enterprise', price: 'Custom', popular: false,
    features: ['Unlimited processing', 'Dedicated support', 'On-premise deployment', 'Custom model training'],
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);
  const [activeFeatures, setActiveFeatures] = useState(new Set());
  const [activeSteps, setActiveSteps] = useState(new Set());

  const toggleInSet = (setState) => (id) =>
    setState((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleFeature = toggleInSet(setActiveFeatures);
  const toggleStep = toggleInSet(setActiveSteps);
  const handleActivateKey = (e, fn, id) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(id); }
  };

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const faqs = [
    { q: "What is GradicAI?", a: "GradicAI is an AI-powered platform designed to automate grading, provide instant feedback, and offer actionable insights for both educators and students." },
    { q: "How does GradicAI grade handwritten papers?", a: "GradicAI uses advanced OCR and machine learning to scan and evaluate handwritten answers against your provided marking scheme." },
    { q: "Is student data secure?", a: "Yes, we adhere strictly to GDPR and FERPA standards to ensure all academic data is encrypted and securely stored." },
    { q: "Should teachers upload exam templates individually?", a: "Yes, you can upload specific templates and marking schemes for each assignment to ensure accurate AI grading." },
    { q: "How can institutions implement GradicAI?", a: "Institutions can easily integrate GradicAI by signing up and using our intuitive dashboard to set up classes and assignments." }
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-4 md:px-8 py-4 border-b border-violet-100 sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-lg font-display">G</div>
          <span className="text-xl font-bold text-slate-900 hidden sm:block font-display">GradicAI</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a href="#features" className="hover:text-primary">Features</a>
          <a href="#how-it-works" className="hover:text-primary">How it Works</a>
          <a href="#pricing" className="hover:text-primary">Pricing</a>
          <a href="#faqs" className="hover:text-primary">FAQs</a>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/signin')} className="text-primary hover:text-primary-dark font-medium px-4 py-2 rounded-lg text-sm">Login</button>
          <button onClick={() => navigate('/signup')} className="bg-primary hover:bg-primary-dark text-white font-medium px-5 py-2 rounded-lg transition text-sm">Get Started</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-16 pb-20 px-4 md:px-8 max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 bg-primary-light text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <Sparkles className="w-3.5 h-3.5" strokeWidth={2} /> NEW: AI-DRIVEN GRADING ACCURACY
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold font-display leading-tight mb-6 text-balance">
            AI-Powered Smart <span className="text-primary">Exam Evaluation</span> Platform
          </h1>
          <p className="text-slate-500 text-lg mb-8 max-w-lg">
            Revolutionize your grading workflow. Upload handwritten exam sheets and let our AI evaluate, score, and analyze results in seconds.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => navigate('/signup')} className="bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-3 rounded-xl transition flex items-center gap-2 shadow-lg shadow-violet-200">
              Get Started <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </button>
            <button onClick={() => scrollTo('how-it-works')} className="border border-slate-200 text-slate-700 font-semibold px-6 py-3 rounded-xl hover:bg-slate-50 transition">
              See How It Works
            </button>
          </div>
        </div>

        {/* Hero Mockup */}
        <div className="relative min-w-0">
          <div className="w-full bg-slate-50 rounded-2xl border border-slate-200 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6 border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-white text-sm font-bold">G</div>
                <span className="font-semibold text-slate-800">GradicAI</span>
              </div>
            </div>
            <div className="text-left">
              <h3 className="text-xl font-bold text-slate-900 mb-2 font-display">Grade New Assignment</h3>
              <p className="text-sm text-slate-500 mb-6">Upload the required documents to begin the AI grading process.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {['Upload Question Paper', 'Upload Marking Scheme', 'Upload Answer Sheets'].map((label) => (
                  <div key={label} className="border border-dashed border-violet-300 bg-primary-light/50 rounded-xl p-4 md:p-6 text-center">
                    <FileText className="w-8 h-8 mx-auto mb-3 text-violet-500" strokeWidth={1.5} />
                    <p className="text-sm text-slate-700 font-medium mb-3">{label}</p>
                    <button className="text-xs bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-medium w-full sm:w-auto">Select File</button>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 overflow-x-auto">
                <div className="min-w-[600px]">
                  <div className="grid grid-cols-5 text-sm font-semibold text-slate-500 mb-3 px-2">
                    <span>Student</span><span>Score</span><span className="col-span-2">Feedback</span><span>Status</span>
                  </div>
                {[
                  { name: 'Alex Johnson', score: '88/100', fb: 'Good work, needs more detail in section 2...', status: 'Graded', color: 'bg-emerald-100 text-emerald-700' },
                  { name: 'Brenda Smith', score: '75/100', fb: 'Answer for question 5 is unclear, review concepts...', status: 'Needs Review', color: 'bg-amber-100 text-amber-700' },
                  { name: 'Charles Brown', score: '95/100', fb: 'Excellent and well-structured responses...', status: 'Graded', color: 'bg-emerald-100 text-emerald-700' },
                ].map((row) => (
                  <div key={row.name} className="grid grid-cols-5 text-sm text-slate-700 py-3 px-2 border-t border-slate-100 items-center">
                    <span className="font-medium">{row.name}</span>
                    <span className="text-primary font-bold">{row.score}</span>
                    <span className="col-span-2 text-slate-500 truncate pr-4">{row.fb}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold w-fit ${row.color}`}>{row.status}</span>
                  </div>
                ))}
                </div>
              </div>
            </div>
          </div>
          {/* Floating badge */}
          <div className="hidden sm:flex absolute -bottom-5 -left-5 bg-white rounded-xl shadow-xl border border-slate-100 px-4 py-3 items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-white flex-shrink-0">
              <ScanLine className="w-4 h-4" strokeWidth={2} />
            </div>
            <div>
              <p className="text-xs text-slate-500 leading-none mb-1">Real-time Processing</p>
              <p className="text-sm font-bold text-primary leading-none">Scanning Sheet #042... Done</p>
            </div>
          </div>
        </div>
      </section>

      {/* About Us */}
      <section className="bg-primary text-white py-16 md:py-20 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <span className="block text-violet-200 font-semibold tracking-wider uppercase mb-6 text-center md:text-left">About Us</span>
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-start text-center md:text-left">
            <h2 className="text-3xl md:text-4xl font-bold font-display leading-tight">
              Transforming <br className="hidden md:block" />Education Through <br className="hidden md:block" />AI
            </h2>
            <p className="text-violet-50 text-lg leading-relaxed">
              GradicAI integrates with schools and institutions to supercharge grading and provide the data and insights needed to keep students on track. Spend less time grading and more time making a real impact in the classroom.
            </p>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section id="features" className="py-16 md:py-24 px-4 md:px-8 bg-primary-light/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <span className="text-primary font-semibold tracking-wider uppercase mb-3 block">Our Capabilities</span>
            <h2 className="text-2xl md:text-3xl font-bold font-display text-slate-900 mb-4">Powerful AI Tools for Educators</h2>
            <p className="text-slate-500 max-w-2xl mx-auto px-2">
              GradicAI is packed with features to make grading and learning easier, faster, and more effective for educators and students. Click any card to learn more.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {[
              { id: 1, icon: Brain, title: 'AI Powered Grading', desc: 'Automate grading using advanced AI that compares answers with your marking schemes.' },
              { id: 2, icon: MessageSquare, title: 'Instant Feedback', desc: 'Provide immediate, personalized insights to help students learn from their mistakes.' },
              { id: 3, icon: SlidersHorizontal, title: 'Adjustable Grading Scheme', desc: 'Customize rubrics and point allocations flexibly for any subject or exam type.' },
              { id: 4, icon: Laptop, title: 'Online Exam System', desc: 'Host and manage secure digital exams seamlessly on the platform.' },
              { id: 5, icon: Lock, title: 'Browser Lock', desc: 'Prevent cheating during online assessments by locking student browsers and restricting tabs.' },
              { id: 6, icon: WifiOff, title: 'Offline Mode', desc: 'Grade scanned physical papers or allow students to download materials for offline study.' },
              { id: 7, icon: Map, title: 'Personalized Study Plans', desc: 'AI generates custom learning paths based on individual student performance.' },
              { id: 8, icon: TrendingUp, title: 'Progress Tracking', desc: 'Monitor student growth over time with intuitive dashboards and analytics.' },
              { id: 9, icon: Sparkles, title: 'AI Practice Quizzes', desc: 'Automatically generate practice tests targeting specific weak areas for students.' },
            ].map((feature) => {
              const active = activeFeatures.has(feature.id);
              return (
                <div
                  key={feature.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleFeature(feature.id)}
                  onKeyDown={(e) => handleActivateKey(e, toggleFeature, feature.id)}
                  className={`p-6 rounded-2xl border shadow-sm transition-all duration-300 ease-out cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                    active
                      ? 'bg-primary border-primary shadow-xl -translate-y-1.5 scale-[1.03]'
                      : 'bg-white border-violet-100 hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-5 transition-colors duration-300 ${active ? 'bg-white/20 text-white' : 'bg-primary-light text-primary'}`}>
                    <feature.icon className="w-5 h-5" strokeWidth={2} />
                  </div>
                  <h3 className={`text-lg font-bold mb-2 font-display transition-colors ${active ? 'text-white' : 'text-slate-900'}`}>{feature.title}</h3>
                  <p className={`text-sm leading-relaxed transition-colors ${active ? 'text-violet-100' : 'text-slate-500'}`}>{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-16 md:py-24 px-4 md:px-8 bg-white text-center">
        <div className="max-w-6xl mx-auto">
          <span className="text-primary font-semibold tracking-wider uppercase mb-3 block">The Workflow</span>
          <h2 className="text-2xl md:text-3xl font-bold font-display text-slate-900 mb-4">Seamless Evaluation in 4 Steps</h2>
          <p className="text-slate-500 max-w-2xl mx-auto mb-12 md:mb-16">
            Experience the efficiency of AI-driven grading and learning in four simple steps. Click a step to zoom in.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 md:gap-8 relative">
            {[
              { icon: FileText, title: 'Upload', desc: 'Bulk scan and upload physical exam papers, or host a fully online exam.' },
              { icon: Smartphone, title: 'AI Reads', desc: 'Neural networks digitize handwriting and evaluate typed responses alike.' },
              { icon: Monitor, title: 'Evaluation', desc: 'AI scores each answer against your marking scheme; teachers review and confirm.' },
              { icon: GraduationCap, title: 'Reports', desc: 'Students receive detailed feedback and personalized study plans instantly.' }
            ].map((step, idx) => {
              const active = activeSteps.has(idx);
              return (
                <div
                  key={idx}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleStep(idx)}
                  onKeyDown={(e) => handleActivateKey(e, toggleStep, idx)}
                  className="relative z-10 flex flex-col items-center cursor-pointer select-none focus:outline-none group"
                >
                  <div
                    className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-all duration-300 ease-out bg-primary group-focus-visible:ring-2 group-focus-visible:ring-violet-400 ${
                      active ? 'scale-[1.15] -translate-y-1 shadow-xl bg-primary-dark' : 'shadow-md group-hover:scale-105 group-hover:shadow-lg'
                    }`}
                  >
                    <step.icon className="w-9 h-9 text-white" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-md font-bold text-slate-900 mb-2 leading-snug font-display">{step.title}</h3>
                  <p className="text-sm text-slate-500 px-4">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 md:py-24 px-4 md:px-8 bg-violet-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <span className="text-primary font-semibold tracking-wider uppercase mb-3 block">Pricing Plans</span>
            <h2 className="text-2xl md:text-3xl font-bold font-display text-slate-900">Choose the Right Plan for Your Institution</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {PRICING_TIERS.map((tier) => (
              <div key={tier.name} className={`relative bg-white rounded-2xl p-8 ${tier.popular ? 'border-2 border-primary shadow-xl' : 'border border-violet-100 shadow-sm'}`}>
                {tier.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">MOST POPULAR</span>
                )}
                <h3 className="text-lg font-bold text-slate-900 font-display">{tier.name}</h3>
                <p className="mt-2 mb-6">
                  <span className="text-3xl font-black text-slate-900">{tier.price}</span>
                  {tier.price !== 'Custom' && <span className="text-slate-400 text-sm"> /month</span>}
                </p>
                <ul className="space-y-2.5 mb-8">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" strokeWidth={2} /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate('/signup')}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition ${tier.popular ? 'bg-primary hover:bg-primary-dark text-white' : 'border border-primary text-primary hover:bg-primary-light'}`}
                >
                  {tier.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-16 md:py-24 px-4 md:px-8 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-6 md:gap-12 items-start text-center md:text-left">
          <div className="w-full md:w-1/3">
            <span className="text-primary font-semibold tracking-wider uppercase mb-3 block flex md:block items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4" strokeWidth={2} /> Security
            </span>
            <h2 className="text-2xl md:text-3xl font-bold font-display text-slate-900">Protecting Academic Data</h2>
          </div>
          <div className="w-full md:w-2/3">
            <p className="text-slate-600 text-base md:text-lg leading-relaxed">
              GradicAI is built with industry standard data protection for educational institutions. Your data is encrypted and kept safe for your learning. We comply strictly with local privacy laws like GDPR and FERPA, ensuring data security for students and teachers.
            </p>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section id="faqs" className="py-16 md:py-24 px-4 md:px-8 bg-primary-light/40">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <span className="text-primary font-semibold tracking-wider uppercase mb-3 block">FAQs</span>
            <h2 className="text-2xl md:text-3xl font-bold font-display text-slate-900">Common Questions</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div key={idx} className="border border-violet-100 rounded-xl overflow-hidden bg-white">
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-primary-light/50 transition"
                >
                  <span className="font-semibold text-slate-900">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-primary transition-transform flex-shrink-0 ml-3 ${openFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === idx && (
                  <div className="p-5 pt-0 text-slate-600">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="bg-primary text-white py-16 md:py-20 px-4 md:px-8 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-4xl font-bold font-display mb-4 md:mb-6 leading-snug">Ready to Modernize Your Grading?</h2>
          <p className="text-violet-100 text-base md:text-lg mb-8 px-2">
            Join the future of education with GradicAI's AI-powered assessment and analytics platform.
          </p>
          <button onClick={() => navigate('/signup')} className="bg-white text-primary font-bold px-8 py-3 rounded-lg hover:bg-slate-50 transition shadow-lg w-full sm:w-auto">
            Start Free Trial
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-violet-100 py-12 md:py-16 px-4 md:px-8">
        <div className="max-w-6xl mx-auto grid sm:grid-cols-2 md:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-lg font-display">G</div>
              <span className="text-xl font-bold text-slate-900 font-display">GradicAI</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">Building the future of educational assessment through responsible and powerful AI.</p>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 mb-3 text-sm">Product</h4>
            <div className="flex flex-col gap-2 text-sm text-slate-500">
              <a href="#features" className="hover:text-primary">Features</a>
              <a href="#pricing" className="hover:text-primary">Pricing</a>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 mb-3 text-sm">Company</h4>
            <div className="flex flex-col gap-2 text-sm text-slate-500">
              <a href="#" onClick={(e) => { e.preventDefault(); scrollTo('security'); }} className="hover:text-primary">About Us</a>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 mb-3 text-sm">Support</h4>
            <div className="flex flex-col gap-2 text-sm text-slate-500">
              <a href="#faqs" className="hover:text-primary">FAQs</a>
              <a href="#security" className="hover:text-primary">Privacy &amp; Security</a>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-10 pt-8 border-t border-violet-100 text-center text-sm text-slate-400">
          <span>© {new Date().getFullYear()} GradicAI. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}

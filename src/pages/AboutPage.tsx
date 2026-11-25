import { Link } from 'react-router-dom'
import { APP_NAME, EXAM, FREE_TUTOR_REPLIES_TOTAL, PAID_PRICE_USD_PER_MONTH, PAID_TUTOR_REPLIES_PER_DAY } from '../config'

const FEATURES = [
  { icon: '🧭', title: 'Every MCAT section', body: 'Bio/Biochem, Chem/Phys, Psych/Soc and CARS, split into clear topics. Pick one and go.' },
  { icon: '🫀', title: '3D anatomy', body: 'Rotate a real 3D heart, tap any structure, and hear what it does. Audio lessons let you study hands-free.' },
  { icon: '✅', title: 'Practice questions', body: 'MCAT-style multiple choice for every topic, with instant feedback and an explanation.' },
  { icon: '🎯', title: 'Weak spots first', body: 'Every miss is tracked. Spaced repetition brings each question back right before you’d forget it.' },
  { icon: '💬', title: 'AI tutor with sources', body: 'Ask about any MCAT topic. Answers come only from our study sources, with citations under every reply.' },
  { icon: '🚩', title: '“This looks wrong”', body: 'One tap sends any explanation or answer to a human reviewer. Only reviewed content is marked Verified.' },
]

const STEPS = [
  { title: 'Openly licensed sources', body: 'Tutor passages come from openly licensed sources like Wikipedia (CC BY-SA), with the exact source and license recorded on every passage.' },
  { title: 'Retrieval, not guessing', body: 'The tutor searches those passages first and answers only from what it finds.' },
  { title: '“I’m not sure”', body: 'If the sources don’t cover it, the tutor says so instead of making something up.' },
  { title: 'Human review', body: 'Reviewers approve content before it earns a Verified badge. Student reports go straight to their queue.' },
]

const FAQ = [
  { q: 'Is this medical advice?', a: 'No. It’s a study tool for exam prep. It doesn’t store patient data, and the tutor tells anyone describing a real health problem to see a doctor.' },
  { q: `Is it only for the ${EXAM}?`, a: `Yes, for now. It covers all four ${EXAM} sections. Other exams may come later.` },
  { q: 'Are these real exam questions?', a: 'No. Official AAMC questions are copyrighted. Ours are written in the MCAT style by our team and labeled Draft until a reviewer checks them.' },
  { q: 'What happens when my free tutor replies run out?', a: `Practice questions, 3D anatomy, weak-spot tracking, and audio stay free forever. The ${FREE_TUTOR_REPLIES_TOTAL} free tutor replies are a taste of the paid plan.` },
]

export function AboutPage() {
  return (
    <div className="landing">
      <section className="hero">
        <p className="eyebrow">{EXAM} prep · All four sections</p>
        <h1>
          Pick a topic. Practice it.
          <br />
          <span className="accent">Remember it on exam day.</span>
        </h1>
        <p className="lede">
          {APP_NAME} covers biology, chemistry, physics, psychology, sociology and reading. Practice by topic, see your
          weakest areas first, explore 3D anatomy, and ask an AI tutor that only answers from vetted sources.
        </p>
        <div className="row hero-cta">
          <Link to="/" className="button big">
            Start studying, free
          </Link>
        </div>
        <p className="small">No credit card. Study tool only. Not medical advice.</p>
      </section>


      <section className="features" id="features">
        <div className="section-head">
          <h2>Everything you need to actually remember it</h2>
        </div>
        <div className="grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature">
              <span className="feature-icon" aria-hidden="true">
                {f.icon}
              </span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>


      <section className="accuracy" id="accuracy">
        <div className="section-head">
          <h2>Built to be precise</h2>
          <p className="hint">A study tool is only useful if you can trust it. Here’s how every answer is grounded.</p>
        </div>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="step-num">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="tutor-preview" aria-label="Example AI tutor exchange">
          <p className="small">Example tutor reply</p>
          <div className="bubble user">Why is the left ventricle wall thicker than the right?</div>
          <div className="bubble assistant">
            <p className="answer">
              The left ventricle pumps blood into the high-pressure systemic circulation, so it needs a thicker muscular
              wall. The right ventricle only pumps to the lungs, a low-pressure circuit.
              {'\n\n'}Exam tip: both ventricles still pump the same volume per beat.
            </p>
            <div className="citations">
              <span className="small">Sources:</span>
              <ul>
                <li>
                  Left ventricle <span className="small">(MedAi notes)</span>{' '}
                  <span className="badge draft">Draft</span>
                </li>
                <li>
                  Heart: Structure <span className="small">(Wikipedia)</span>{' '}
                  <span className="badge draft">Draft</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="pricing" id="pricing">
        <div className="section-head">
          <h2>Simple pricing</h2>
        </div>
        <div className="plans">
          <div className="plan">
            <h3>Free</h3>
            <p className="price">$0</p>
            <ul>
              <li>Practice questions for every MCAT section</li>
              <li>Weak-spot tracking</li>
              <li>Spaced repetition</li>
              <li>3D heart with audio lessons</li>
              <li>{FREE_TUTOR_REPLIES_TOTAL} AI tutor replies to try</li>
            </ul>
            <Link to="/" className="button ghost wide-btn">
              Start free
            </Link>
          </div>
          <div className="plan featured">
            <h3>Pro</h3>
            <p className="price">
              ${PAID_PRICE_USD_PER_MONTH}
              <span>/month</span>
            </p>
            <ul>
              <li>Everything in Free</li>
              <li>AI tutor, up to {PAID_TUTOR_REPLIES_PER_DAY} replies a day</li>
              <li>Answers with citations</li>
              <li>Personalized study plans</li>
              <li>Personalized audio lessons</li>
            </ul>
            <Link to="/account" className="button wide-btn">
              Go Pro
            </Link>
          </div>
        </div>
      </section>

      <section className="faq">
        <div className="section-head">
          <h2>Questions</h2>
        </div>
        {FAQ.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>

      <section className="final-cta">
        <h2>Pick a topic and start.</h2>
        <p>Free to use. Takes ten seconds to start.</p>
        <Link to="/" className="button big">
          Open {APP_NAME}
        </Link>
      </section>
    </div>
  )
}

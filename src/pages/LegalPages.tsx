import { APP_NAME } from '../config'

const UPDATED = 'October 22, 2026'
const CONTACT = '[contact email]'

export function PrivacyPage() {
  return (
    <section className="page-narrow legal">
      <p className="badge draft">Template, pending legal review</p>
      <h1>Privacy policy</h1>
      <p className="small">Last updated {UPDATED}</p>
      <p>
        {APP_NAME} is a study tool. We collect as little as we can to make it work. We do not collect or store patient
        data or information about your health.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Your email address, so you can sign in.</li>
        <li>Your study activity: quiz answers, review schedule, and how many AI tutor replies you've used.</li>
        <li>Questions you send to the AI tutor and reports you send with “This looks wrong.”</li>
        <li>Billing status from our payment processor (Stripe). We never see your full card number.</li>
      </ul>
      <h2>How we use it</h2>
      <p>
        To run the app, personalize your reviews, enforce plan limits, fix content mistakes, and keep costs in check.
        We don't sell your data.
      </p>
      <h2>Who processes it</h2>
      <p>
        Supabase (database and sign-in), Anthropic (generates tutor answers from your question), Voyage AI (search over
        our study notes), Stripe (payments), and Vercel (hosting).
      </p>
      <h2>Your choices</h2>
      <p>You can ask us to export or delete your account and data at any time by emailing {CONTACT}.</p>
    </section>
  )
}

export function CreditsPage() {
  return (
    <section className="page-narrow legal">
      <h1>Credits and licenses</h1>
      <h2>3D anatomy models</h2>
      <p>
        Adapted from{' '}
        <a href="https://lifesciencedb.jp/bp3d/" target="_blank" rel="noreferrer">
          BodyParts3D
        </a>
        , © The Database Center for Life Science (DBCLS), licensed under{' '}
        <a href="https://creativecommons.org/licenses/by-sa/2.1/jp/" target="_blank" rel="noreferrer">
          CC BY-SA 2.1 Japan
        </a>
        . We merged the meshes for each structure, re-oriented, simplified and compressed them, and for the heart split
        the ventricular wall into left and right halves. Our adapted models are shared under the same license:
      </p>
      <ul>
        {['heart', 'brain', 'eye', 'torso', 'skeleton'].map((m) => (
          <li key={m}>
            <a href={`/models/${m}.glb`}>{m}.glb</a> (<a href={`/models/${m}-LICENSE.txt`}>license notice</a>)
          </li>
        ))}
      </ul>
      <h2>AI tutor sources</h2>
      <p>
        Most passages the AI tutor searches are excerpts from English{' '}
        <a href="https://en.wikipedia.org/" target="_blank" rel="noreferrer">
          Wikipedia
        </a>{' '}
        articles by Wikipedia contributors, licensed under{' '}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
          CC BY-SA 4.0
        </a>
        . We split articles into short passages and drop reference sections. Every passage links to the exact article
        revision it came from, where you can see its authors in the page history. Our excerpts are shared under the same
        license. Wikipedia does not endorse {APP_NAME}.
      </p>
      <h2>Practice questions and notes</h2>
      <p>
        Practice questions, answer explanations and the 3D anatomy notes are written by {APP_NAME}. They are drafts until a
        reviewer approves them, and are labeled Draft until then. Questions drafted from Wikipedia passages are shared under
        CC BY-SA 4.0.
      </p>
      <h2>Exam names</h2>
      <p>
        MCAT is a registered trademark of the Association of American Medical Colleges (AAMC), which does not endorse{' '}
        {APP_NAME}. Our questions are not official exam questions.
      </p>
    </section>
  )
}

export function TermsPage() {
  return (
    <section className="page-narrow legal">
      <p className="badge draft">Template, pending legal review</p>
      <h1>Terms of use</h1>
      <p className="small">Last updated {UPDATED}</p>
      <h2>Study tool only</h2>
      <p>
        {APP_NAME} helps you study for exams. It is not medical advice and must not be used to diagnose or treat anyone.
        If you have a health concern, see a doctor.
      </p>
      <h2>Accuracy</h2>
      <p>
        We work to keep content correct, and items marked “Verified” have been checked by a reviewer. Draft content and AI
        answers can still contain mistakes. Always check against your course materials, and tap “This looks wrong” if
        something seems off.
      </p>
      <h2>Your account</h2>
      <p>Keep your sign-in secure. Don't share accounts or try to get around usage limits.</p>
      <h2>Paid plan</h2>
      <p>
        Subscriptions renew monthly until canceled. You can cancel anytime from your account page; access continues
        until the end of the paid period.
      </p>
      <h2>Contact</h2>
      <p>{CONTACT}</p>
    </section>
  )
}

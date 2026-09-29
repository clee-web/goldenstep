import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { NarrativeRail } from '@/components/layout/NarrativeRail';
import { Hero } from '@/components/sections/Hero';
import { About } from '@/components/sections/About';
import { VisionMission } from '@/components/sections/VisionMission';
import { Approach } from '@/components/sections/Approach';
import { Programs } from '@/components/sections/Programs';
import { Gallery } from '@/components/sections/Gallery';
import { Impact } from '@/components/sections/Impact';
import { Field } from '@/components/sections/Field';
import { Team } from '@/components/sections/Team';
import { Testimonials } from '@/components/sections/Testimonials';
import { Partners } from '@/components/sections/Partners';
import { Policies } from '@/components/sections/Policies';
import { Contact } from '@/components/sections/Contact';
import { useManagedContent } from '@/hooks/useManagedContent';
import { resolveSiteContent } from '@/lib/content';

/**
 * Section order is the narrative, not a menu of features. It follows the order a
 * reader needs to be convinced in:
 *
 *   01 Who we are      -> the people and the place
 *   02 Why we exist    -> the vision and mission
 *   03 How we work     -> the method that makes it credible
 *   04 What we do      -> the six programme areas
 *   05 Proof, in people-> one woman, then the photographs
 *   06 Proof, in scale -> the numbers those people add up to
 *   07 From the field  -> dated projects and the latest activity
 *   08 Who we work with-> the credibility to scale
 *   09 Our policies   -> the commitments behind the claims
 *   10 Take the step   -> the ask
 *
 * Proof lands after the work rather than before it, and the approach is earned
 * before the programmes depend on it. Each chapter ends with a bridge line that
 * names the next movement of the story.
 *
 * The order of the two proof chapters is deliberate. A 35,000-person aggregate
 * produces category-level thinking — "NGOs help people" — so chapter 05 has to
 * give the reader a single identifiable person *before* chapter 06 counts them.
 * `<Person>` renders at the head of chapter 05 for exactly that reason.
 *
 * There is deliberately no thematic ticker directly under the hero. The six
 * areas it listed are the same six rendered as programme cards one screen
 * further down, so the highest-attention position on the page was being spent
 * restating a list the reader meets properly three scrolls later.
 *
 * The whole page renders from the bundled static content. `useManagedContent`
 * layers admin edits on top once the API answers, so a slow or failing API
 * never delays or blanks the story.
 */
export default function App() {
  const { content, ready, offline } = useManagedContent();
  const resolved = resolveSiteContent(content, { ready, offline });

  return (
    <>
      <a
        href="#about"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-full focus:bg-brand focus:px-5 focus:py-2.5 focus:text-[13px] focus:font-extrabold focus:text-white"
      >
        Skip to content
      </a>

      <NarrativeRail />
      {/* Renders the top bar and the header as one sticky object, so the two
          cannot drift apart while scrolling. */}
      <Header />

      <main id="home">
        <Hero content={resolved} />
        <About />
        <VisionMission />
        <Approach />
        <Programs programmes={resolved.programmes} />
        <Gallery slides={resolved.gallerySlides} />
        <Impact content={resolved} />
        <Field content={resolved} />
        <Team content={resolved} />
        <Testimonials content={resolved} />
        <Partners />
        <Policies content={resolved} />
        <Contact />
      </main>

      <Footer />
    </>
  );
}

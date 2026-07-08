import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

import { FeaturesSection } from "./_sections/features"
import { HeroSection } from "./_sections/hero"
import { ObservabilitySection } from "./_sections/observability"
import { OpenSourceSection } from "./_sections/open-source"
import { WhyChooseSection } from "./_sections/why-choose"

export default function Page() {
  return (
    <div className="relative min-h-svh">
      <SiteHeader />

      <HeroSection />
      <WhyChooseSection />
      <FeaturesSection />
      <ObservabilitySection />
      <OpenSourceSection />

      <SiteFooter />
    </div>
  )
}

import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

import {
  FeaturesSection,
  HeroSection,
  ObservabilitySection,
  OpenSourceSection,
  WhyChooseSection,
} from "./_sections"

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

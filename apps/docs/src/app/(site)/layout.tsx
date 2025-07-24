import Footer from "~/components/footer"
import MainHeader from "~/components/main-header"

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream-50 dark:bg-dark-200">
      {/* Header */}
      <MainHeader />
      {children}
      <Footer />
    </div>
  )
}

import Image from "next/image"
import Link from "next/link"

export default function Footer() {
  return (
    <footer className="bg-dark-100 dark:bg-dark-300 text-cream-50 dark:border-dark-100 border-t px-4 py-12">
      <div className="container mx-auto">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Image
                src="/vorsteh-queue-logo.svg"
                alt="Vorsteh Queue Logo"
                width={32}
                height={32}
                className="rounded"
              />
              <span className="text-lg font-bold">Vorsteh Queue</span>
            </div>
            <p className="text-cream-200 text-sm">
              The reliable, database-agnostic queue engine for modern applications.
            </p>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">Product</h4>
            <ul className="text-cream-200 space-y-2 text-sm">
              <li>
                <Link href="#" className="hover:text-orange-primary transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-orange-primary transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-orange-primary transition-colors">
                  Examples
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-orange-primary transition-colors">
                  Changelog
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">Community</h4>
            <ul className="text-cream-200 space-y-2 text-sm">
              <li>
                <a
                  href="https://github.com/noxify/vorsteh-queue"
                  target="_blank"
                  className="hover:text-orange-primary transition-colors"
                >
                  GitHub
                </a>
              </li>

              <li>
                <Link href="#" className="hover:text-orange-primary transition-colors">
                  Contributing
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">Support</h4>
            <ul className="text-cream-200 space-y-2 text-sm">
              <li>
                <a
                  href="https://github.com/noxify/vorsteh-queue/issues"
                  target="_blank"
                  className="hover:text-orange-primary transition-colors"
                >
                  Bug Reports
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-fur-400 dark:border-dark-100 text-cream-200 mt-8 border-t pt-8 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} Vorsteh Queue. Released under the MIT License.</p>
        </div>
      </div>
    </footer>
  )
}

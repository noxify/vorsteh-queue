import Image from "next/image"
import Link from "next/link"

const links = [
  {
    name: "Home",
    target: "/",
  },
  {
    name: "Docs",
    target: "/docs",
  },
  {
    name: "Examples",
    target: "/docs/examples",
  },
  {
    name: "Adapters",
    target: "/docs/adapters",
  },
]

export default function Footer() {
  return (
    <footer className="border-t bg-dark-100 px-4 py-12 text-cream-50 dark:border-dark-100 dark:bg-dark-300">
      <div className="container mx-auto">
        <div className="px-4 py-4 md:mx-auto md:flex md:items-center md:justify-between">
          <div className="space-y-4">
            <Link href={"/"} className="flex items-center space-x-3">
              <Image
                src="/vorsteh-queue-logo.svg"
                alt="Vorsteh Queue Logo"
                width={32}
                height={32}
              />
              <span className="text-lg font-bold">Vorsteh Queue</span>
            </Link>
            <p className="text-sm text-cream-200 md:w-96 lg:w-xl">
              A powerful, ORM-agnostic queue engine for PostgreSQL 12+. Handle background jobs,
              scheduled tasks, and recurring processes with ease.
            </p>
          </div>

          <nav className="mt-4 items-center md:mt-0 md:flex">
            <div className="items-center space-x-6 md:flex">
              {links.map((ele, eleIdx) => (
                <Link
                  key={eleIdx}
                  href={ele.target}
                  className="transition-colors hover:text-orange-primary"
                >
                  {ele.name}
                </Link>
              ))}
            </div>
          </nav>
        </div>

        <div className="mt-8 border-t border-fur-400 pt-8 text-center text-sm text-cream-200 dark:border-dark-100">
          <p>&copy; {new Date().getFullYear()} Vorsteh Queue. Released under the MIT License.</p>

          <p>
            Powered by{" "}
            <a
              href="https://www.nextjs.org"
              target="_blank"
              className="font-bold hover:text-orange-primary"
            >
              Next.js
            </a>{" "}
            and{" "}
            <a
              href="https://www.renoun.dev"
              target="_blank"
              className="font-bold hover:text-orange-primary"
            >
              Renoun
            </a>{" "}
          </p>
        </div>
      </div>
    </footer>
  )
}

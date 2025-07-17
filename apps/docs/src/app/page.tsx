import Image from "next/image"
import Link from "next/link"
import {
  Calendar,
  CheckCircle,
  Clock,
  Code,
  Database,
  Github,
  Heart,
  Info,
  Play,
  RotateCcw,
  Settings,
  Shield,
  Users,
  Zap,
} from "lucide-react"

import { ThemeToggle } from "~/components/theme-toggle"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"

export default function Home() {
  return (
    <div className="bg-cream-50 dark:bg-dark-200 min-h-screen">
      {/* Header */}
      <header className="border-cream-200 dark:border-dark-100 bg-cream-50/80 dark:bg-dark-200/80 sticky top-0 z-50 border-b backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center space-x-3">
            <Image
              src="/vorsteh-queue-logo.svg"
              alt="Vorsteh Queue Logo"
              width={40}
              height={40}
              className="rounded-lg"
            />
            <span className="text-dark-200 dark:text-dark-900 text-xl font-bold">
              Vorsteh Queue
            </span>
          </div>
          <nav className="hidden items-center space-x-6 md:flex">
            <Link
              href="#features"
              className="text-dark-200 dark:text-dark-900 hover:text-orange-primary transition-colors"
            >
              Features
            </Link>
            <Link
              href="#why"
              className="text-dark-200 dark:text-dark-900 hover:text-orange-primary transition-colors"
            >
              Why Choose Us
            </Link>
            <Link
              href="#about" // New link for About section
              className="text-dark-200 dark:text-dark-900 hover:text-orange-primary transition-colors"
            >
              About
            </Link>
            <Link
              href="#opensource"
              className="text-dark-200 dark:text-dark-900 hover:text-orange-primary transition-colors"
            >
              Open Source
            </Link>
            <ThemeToggle />
            <Button className="bg-orange-darker hover:bg-orange-accessible text-white">
              Get Started
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-4 py-20">
        <div className="container mx-auto">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="space-y-6">
              <Badge className="bg-badge-bg dark:bg-badge-dark-bg text-badge-text dark:text-badge-dark-text border-orange-primary/20">
                Database Agnostic Queue Engine
              </Badge>
              <h1 className="text-dark-200 dark:text-dark-900 text-4xl font-bold leading-tight md:text-6xl">
                Reliable Job Queue for Modern Applications
              </h1>
              <p className="text-fur-500 dark:text-dark-800 text-xl leading-relaxed">
                A powerful, ORM-agnostic queue engine that works with any database. Handle
                background jobs, scheduled tasks, and recurring processes with ease.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row">
                <Button
                  size="lg"
                  className="bg-orange-darker hover:bg-orange-accessible text-white"
                >
                  <Code className="mr-2 h-5 w-5" />
                  Get Started
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-orange-darker dark:border-orange-light text-orange-darker dark:text-orange-light hover:bg-orange-darker dark:hover:bg-orange-light dark:hover:text-dark-200 border-2 bg-transparent hover:text-white"
                >
                  <Github className="mr-2 h-5 w-5" />
                  View on GitHub
                </Button>
              </div>
            </div>

            {/* Code Example */}
            <div className="bg-dark-100 text-cream-50 overflow-x-auto rounded-lg border p-6 font-mono text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                <div className="h-3 w-3 rounded-full bg-green-500"></div>
                <span className="text-cream-200 ml-2 dark:text-slate-300">queue-example.ts</span>
              </div>
              <pre className="text-cream-50 dark:text-slate-100">
                {`import { VorstehQueue } from 'vorsteh-queue';

// Initialize with any database
const queue = new VorstehQueue({
  adapter: 'prisma', // or 'drizzle', 'typeorm'
  connection: prisma
});

// Add a job
await queue.add('send-email', {
  to: 'user@example.com',
  subject: 'Welcome!'
}, {
  delay: 5000,
  attempts: 3
});

// Process jobs
queue.process('send-email', async (job) => {
  await sendEmail(job.data);
});

// Schedule recurring jobs
await queue.repeat('daily-report', 
  { type: 'summary' }, 
  { cron: '0 9 * * *' }
);`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Why Section */}
      <section id="why" className="bg-cream-100 dark:bg-dark-100 px-4 py-20">
        <div className="container mx-auto">
          <div className="mb-16 text-center">
            <h2 className="text-dark-200 dark:text-dark-900 mb-4 text-3xl font-bold md:text-4xl">
              Why Choose Vorsteh Queue?
            </h2>
            <p className="text-fur-500 dark:text-dark-800 mx-auto max-w-2xl text-xl">
              Built for developers who need reliability, flexibility, and excellent developer
              experience
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Card className="border-cream-200 dark:border-dark-50 bg-cream-50 dark:bg-dark-200 transition-shadow hover:shadow-lg dark:hover:shadow-xl">
              <CardHeader>
                <div className="bg-orange-primary/10 dark:bg-orange-primary/20 mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                  <Zap className="text-orange-primary h-6 w-6" />
                </div>
                <CardTitle className="text-dark-200 dark:text-dark-900">Excellent DX</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-fur-500 dark:text-dark-800">
                  Intuitive API design with TypeScript support, comprehensive documentation, and
                  helpful error messages that make development a breeze.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-cream-200 dark:border-dark-50 bg-cream-50 dark:bg-dark-200 transition-shadow hover:shadow-lg dark:hover:shadow-xl">
              <CardHeader>
                <div className="bg-orange-primary/10 dark:bg-orange-primary/20 mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                  <Database className="text-orange-primary h-6 w-6" />
                </div>
                <CardTitle className="text-dark-200 dark:text-dark-900">ORM Agnostic</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-fur-500 dark:text-dark-800">
                  Works seamlessly with Prisma, Drizzle, TypeORM, or any database adapter. No vendor
                  lock-in, use what you already know and love.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-cream-200 dark:border-dark-50 bg-cream-50 dark:bg-dark-200 transition-shadow hover:shadow-lg dark:hover:shadow-xl">
              <CardHeader>
                <div className="bg-orange-primary/10 dark:bg-orange-primary/20 mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                  <Shield className="text-orange-primary h-6 w-6" />
                </div>
                <CardTitle className="text-dark-200 dark:text-dark-900">Production Ready</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-fur-500 dark:text-dark-800">
                  Battle-tested with built-in retry logic, dead letter queues, monitoring, and
                  graceful shutdown handling for mission-critical applications.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-cream-200 dark:border-dark-50 bg-cream-50 dark:bg-dark-200 transition-shadow hover:shadow-lg dark:hover:shadow-xl">
              <CardHeader>
                <div className="bg-orange-primary/10 dark:bg-orange-primary/20 mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                  <Settings className="text-orange-primary h-6 w-6" />
                </div>
                <CardTitle className="text-dark-200 dark:text-dark-900">
                  Highly Configurable
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-fur-500 dark:text-dark-800">
                  Fine-tune every aspect from concurrency limits to retry strategies. Adapts to your
                  specific needs without compromising simplicity.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-cream-200 dark:border-dark-50 bg-cream-50 dark:bg-dark-200 transition-shadow hover:shadow-lg dark:hover:shadow-xl">
              <CardHeader>
                <div className="bg-orange-primary/10 dark:bg-orange-primary/20 mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                  <Users className="text-orange-primary h-6 w-6" />
                </div>
                <CardTitle className="text-dark-200 dark:text-dark-900">Scalable</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-fur-500 dark:text-dark-800">
                  Horizontal scaling support with distributed processing, load balancing, and
                  cluster-aware job distribution.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-cream-200 dark:border-dark-50 bg-cream-50 dark:bg-dark-200 transition-shadow hover:shadow-lg dark:hover:shadow-xl">
              <CardHeader>
                <div className="bg-orange-primary/10 dark:bg-orange-primary/20 mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                  <CheckCircle className="text-orange-primary h-6 w-6" />
                </div>
                <CardTitle className="text-dark-200 dark:text-dark-900">
                  Zero Dependencies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-fur-500 dark:text-dark-800">
                  Lightweight core with minimal dependencies. Only bring in what you need, keeping
                  your bundle size small and security surface minimal.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-4 py-20">
        <div className="container mx-auto">
          <div className="mb-16 text-center">
            <h2 className="text-dark-200 dark:text-dark-900 mb-4 text-3xl font-bold md:text-4xl">
              Powerful Features
            </h2>
            <p className="text-fur-500 dark:text-dark-800 mx-auto max-w-2xl text-xl">
              Everything you need to handle background processing in your applications
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="bg-cream-100 dark:bg-dark-100 hover:bg-cream-200 dark:hover:bg-dark-50 dark:border-dark-50 rounded-lg border p-6 text-center transition-colors">
              <div className="bg-orange-primary/10 dark:bg-orange-primary/20 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                <Play className="text-orange-primary h-6 w-6" />
              </div>
              <h3 className="text-dark-200 dark:text-dark-900 mb-2 font-semibold">One-time Jobs</h3>
              <p className="text-fur-500 dark:text-dark-800 text-sm">
                Execute tasks once with optional delays and priority levels
              </p>
            </div>

            <div className="bg-cream-100 dark:bg-dark-100 hover:bg-cream-200 dark:hover:bg-dark-50 dark:border-dark-50 rounded-lg border p-6 text-center transition-colors">
              <div className="bg-orange-primary/10 dark:bg-orange-primary/20 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                <RotateCcw className="text-orange-primary h-6 w-6" />
              </div>
              <h3 className="text-dark-200 dark:text-dark-900 mb-2 font-semibold">
                Recurring Jobs
              </h3>
              <p className="text-fur-500 dark:text-dark-800 text-sm">
                Set up repeating tasks with flexible intervals and cron expressions
              </p>
            </div>

            <div className="bg-cream-100 dark:bg-dark-100 hover:bg-cream-200 dark:hover:bg-dark-50 dark:border-dark-50 rounded-lg border p-6 text-center transition-colors">
              <div className="bg-orange-primary/10 dark:bg-orange-primary/20 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                <Calendar className="text-orange-primary h-6 w-6" />
              </div>
              <h3 className="text-dark-200 dark:text-dark-900 mb-2 font-semibold">
                Scheduled Jobs
              </h3>
              <p className="text-fur-500 dark:text-dark-800 text-sm">
                Schedule jobs for specific dates and times with timezone support
              </p>
            </div>

            <div className="bg-cream-100 dark:bg-dark-100 hover:bg-cream-200 dark:hover:bg-dark-50 dark:border-dark-50 rounded-lg border p-6 text-center transition-colors">
              <div className="bg-orange-primary/10 dark:bg-orange-primary/20 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                <Shield className="text-orange-primary h-6 w-6" />
              </div>
              <h3 className="text-dark-200 dark:text-dark-900 mb-2 font-semibold">Retry Logic</h3>
              <p className="text-fur-500 dark:text-dark-800 text-sm">
                Configurable retry strategies with exponential backoff and limits
              </p>
            </div>

            <div className="bg-cream-100 dark:bg-dark-100 hover:bg-cream-200 dark:hover:bg-dark-50 dark:border-dark-50 rounded-lg border p-6 text-center transition-colors">
              <div className="bg-orange-primary/10 dark:bg-orange-primary/20 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                <Clock className="text-orange-primary h-6 w-6" />
              </div>
              <h3 className="text-dark-200 dark:text-dark-900 mb-2 font-semibold">Job Delays</h3>
              <p className="text-fur-500 dark:text-dark-800 text-sm">
                Delay job execution with precise timing control
              </p>
            </div>

            <div className="bg-cream-100 dark:bg-dark-100 hover:bg-cream-200 dark:hover:bg-dark-50 dark:border-dark-50 rounded-lg border p-6 text-center transition-colors">
              <div className="bg-orange-primary/10 dark:bg-orange-primary/20 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                <Settings className="text-orange-primary h-6 w-6" />
              </div>
              <h3 className="text-dark-200 dark:text-dark-900 mb-2 font-semibold">
                Priority Queues
              </h3>
              <p className="text-fur-500 dark:text-dark-800 text-sm">
                Process high-priority jobs first with customizable priority levels
              </p>
            </div>

            <div className="bg-cream-100 dark:bg-dark-100 hover:bg-cream-200 dark:hover:bg-dark-50 dark:border-dark-50 rounded-lg border p-6 text-center transition-colors">
              <div className="bg-orange-primary/10 dark:bg-orange-primary/20 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                <Database className="text-orange-primary h-6 w-6" />
              </div>
              <h3 className="text-dark-200 dark:text-dark-900 mb-2 font-semibold">
                Dead Letter Queue
              </h3>
              <p className="text-fur-500 dark:text-dark-800 text-sm">
                Handle failed jobs with dedicated error queues and analysis
              </p>
            </div>

            <div className="bg-cream-100 dark:bg-dark-100 hover:bg-cream-200 dark:hover:bg-dark-50 dark:border-dark-50 rounded-lg border p-6 text-center transition-colors">
              <div className="bg-orange-primary/10 dark:bg-orange-primary/20 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                <Zap className="text-orange-primary h-6 w-6" />
              </div>
              <h3 className="text-dark-200 dark:text-dark-900 mb-2 font-semibold">
                Real-time Monitoring
              </h3>
              <p className="text-fur-500 dark:text-dark-800 text-sm">
                Monitor job status, performance metrics, and queue health
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="bg-cream-50 dark:bg-dark-200 px-4 py-20">
        <div className="container mx-auto text-center">
          <div className="mx-auto max-w-3xl">
            <div className="bg-orange-primary/10 dark:bg-orange-primary/20 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full">
              <Info className="text-orange-primary h-8 w-8" />
            </div>
            <h2 className="text-dark-200 dark:text-dark-900 mb-6 text-3xl font-bold md:text-4xl">
              About the Name: Vorsteh Queue
            </h2>
            <p className="text-fur-500 dark:text-dark-800 mb-8 text-xl leading-relaxed">
              The name "Vorsteh Queue" is a tribute to our beloved German Spaniel. This breed is
              closely related to the Münsterländer, a type of pointing dog, known in German as a
              "Vorstehhund". Just as a pointing dog steadfastly indicates its target, Vorsteh Queue
              aims to reliably point your application towards efficient and robust background job
              processing.
            </p>
            <p className="text-fur-500 dark:text-dark-800 text-xl leading-relaxed">
              The inspiration for naming a tech project after a dog comes from the delightful story
              of Bruno, the API client. It's a nod to the personal touch and passion that drives
              open-source development, much like the loyalty and dedication of our canine
              companions.
            </p>
          </div>
        </div>
      </section>

      {/* Open Source Section */}
      <section id="opensource" className="bg-cream-100 dark:bg-dark-100 px-4 py-20">
        <div className="container mx-auto text-center">
          <div className="mx-auto max-w-3xl">
            <div className="bg-orange-primary/10 dark:bg-orange-primary/20 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full">
              <Heart className="text-orange-primary h-8 w-8" />
            </div>
            <h2 className="text-dark-200 dark:text-dark-900 mb-6 text-3xl font-bold md:text-4xl">
              Free & Open Source
            </h2>
            <p className="text-fur-500 dark:text-dark-800 mb-8 text-xl leading-relaxed">
              Vorsteh Queue is completely free and open source. Built by developers, for developers.
              No hidden costs, no vendor lock-in, no limitations. Use it in your personal projects,
              startups, or enterprise applications.
            </p>
            <div className="mb-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <div className="text-fur-500 dark:text-dark-800 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span>MIT License</span>
              </div>
              <div className="text-fur-500 dark:text-dark-800 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span>Community Driven</span>
              </div>
              <div className="text-fur-500 dark:text-dark-800 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span>No Vendor Lock-in</span>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button size="lg" className="bg-orange-darker hover:bg-orange-accessible text-white">
                <Github className="mr-2 h-5 w-5" />
                Star on GitHub
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-orange-darker dark:border-orange-light text-orange-darker dark:text-orange-light hover:bg-orange-darker dark:hover:bg-orange-light dark:hover:text-dark-200 border-2 bg-transparent hover:text-white"
              >
                <Code className="mr-2 h-5 w-5" />
                Read Documentation
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-dark-100 dark:bg-dark-300 text-cream-50 dark:border-dark-100 border-t px-4 py-12">
        <div className="container mx-auto">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Image
                  src="/logo.png"
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
                  <Link href="#" className="hover:text-orange-primary transition-colors">
                    GitHub
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-orange-primary transition-colors">
                    Discord
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-orange-primary transition-colors">
                    Twitter
                  </Link>
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
                  <Link href="#" className="hover:text-orange-primary transition-colors">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-orange-primary transition-colors">
                    Bug Reports
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-orange-primary transition-colors">
                    Feature Requests
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-orange-primary transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-fur-400 dark:border-dark-100 text-cream-200 mt-8 border-t pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} Vorsteh Queue. Released under the MIT License.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

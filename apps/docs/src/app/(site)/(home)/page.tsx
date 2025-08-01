import Link from "next/link"
import { CheckCircle, Code, Heart, Info } from "lucide-react"
import pMap from "p-map"
import { CodeBlock, GitProviderLink, GitProviderLogo } from "renoun/components"

import type { AllowedIcon } from "~/lib/icon"
import { features } from "~/collections"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { asyncFilter } from "~/lib/array-helper"
import { getIcon } from "~/lib/icon"

const example_snippet = /* typescript */ `
import { MemoryQueueAdapter, Queue } from "@vorsteh-queue/core"

interface TEmailPayload {
  to: string
  subject: string
}

interface TEmailResult {
  sent: boolean
}

const adapter = new MemoryQueueAdapter()
const queue = new Queue(adapter, { name: "email-queue" })

queue.register<TEmailPayload, TEmailResult>("send-email", async ({ payload }) => {
  // Send email logic here
  return { sent: true }
})

await queue.add("send-email", { to: "user@example.com", subject: "Welcome!" })
queue.start()
`

export default async function Home() {
  const featuresCollection = await features.getEntries()

  const filterKeyFeatures = await asyncFilter(featuresCollection, async (ele) => {
    const frontmatter = await ele.getExportValue("frontmatter")

    return frontmatter.type === "key_feature"
  })

  const filterOtherFeatures = await asyncFilter(featuresCollection, async (ele) => {
    const frontmatter = await ele.getExportValue("frontmatter")

    return frontmatter.type === "feature"
  })

  const keyFeatures = await pMap(filterKeyFeatures, async (ele) => {
    const frontmatter = await ele.getExportValue("frontmatter")
    const description = await ele.getExportValue("default")
    return {
      title: frontmatter.title,
      description,
      icon: frontmatter.icon as AllowedIcon,
    }
  })

  const otherFeatures = await pMap(filterOtherFeatures, async (ele) => {
    const frontmatter = await ele.getExportValue("frontmatter")
    const description = await ele.getExportValue("default")
    return {
      title: frontmatter.title,
      description,
      icon: frontmatter.icon as AllowedIcon,
    }
  })

  return (
    <>
      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="space-y-6">
              <h1 className="text-4xl leading-tight font-bold text-dark-200 md:text-6xl dark:text-dark-900">
                Reliable Job Queue for Modern Applications
              </h1>
              <p className="text-xl leading-relaxed text-fur-500 dark:text-dark-800">
                A powerful, ORM-agnostic queue engine for PostgreSQL 12+. Handle background jobs,
                scheduled tasks, and recurring processes with ease.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="bg-orange-darker text-white hover:bg-orange-accessible"
                >
                  <Link href={"/docs/getting-started/introduction/"}>
                    <Code className="mr-2 h-5 w-5" />
                    Get Started
                  </Link>
                </Button>

                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-2 border-orange-darker bg-transparent text-orange-darker hover:bg-orange-darker hover:text-white dark:border-orange-light dark:text-orange-light dark:hover:bg-orange-light dark:hover:text-dark-200"
                >
                  <GitProviderLink>
                    <GitProviderLogo width="1em" height="1em" />
                    <span>View on GitHub</span>
                  </GitProviderLink>
                </Button>
              </div>
            </div>
            <div>
              {/* Code Example */}
              <CodeBlock language="ts" showToolbar={true} allowCopy={true} path="example-queue.ts">
                {example_snippet}
              </CodeBlock>
            </div>
          </div>
        </div>
      </section>

      {/* Why Section */}
      <section id="why" className="bg-cream-100 py-20 dark:bg-dark-100">
        <div className="container mx-auto">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-dark-200 md:text-4xl dark:text-dark-900">
              Why Choose Vorsteh Queue?
            </h2>
            <p className="mx-auto text-xl text-fur-500 dark:text-dark-800">
              Built for developers who need reliability, flexibility, and excellent developer
              experience
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {keyFeatures.map((ele, eleIdx) => (
              <Card
                key={eleIdx}
                className="border-cream-200 bg-cream-50 transition-shadow hover:shadow-lg dark:border-dark-50 dark:bg-dark-200 dark:hover:shadow-xl"
              >
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-orange-primary/10 dark:bg-orange-primary/20">
                    {getIcon(ele.icon, { className: "text-orange-primary h-6 w-6" })}
                  </div>
                  <CardTitle className="text-dark-200 dark:text-dark-900">{ele.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-fur-500 dark:text-dark-800">
                    <ele.description />
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="container mx-auto">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-dark-200 md:text-4xl dark:text-dark-900">
              Powerful Features
            </h2>
            <p className="mx-auto text-xl text-fur-500 dark:text-dark-800">
              Everything you need to handle background processing in your applications
            </p>
          </div>

          <div className="grid place-items-stretch gap-6 md:grid-cols-2 lg:grid-cols-4">
            {otherFeatures.map((ele, eleIdx) => (
              <div
                key={eleIdx}
                className="rounded-lg border border-orange-primary/40 bg-cream-100 p-6 text-center transition-colors hover:bg-cream-200 dark:border-dark-50 dark:bg-dark-100 dark:hover:bg-dark-50"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-orange-primary/10 dark:bg-orange-primary/20">
                  {getIcon(ele.icon, { className: "text-orange-primary h-6 w-6" })}
                </div>
                <h3 className="mb-2 font-semibold text-dark-200 dark:text-dark-900">{ele.title}</h3>
                <div className="text-sm text-fur-500 dark:text-dark-800">
                  <ele.description />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="bg-cream-50 py-20 dark:bg-dark-200">
        <div className="container mx-auto text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-orange-primary/10 dark:bg-orange-primary/20">
              <Info className="h-8 w-8 text-orange-primary" />
            </div>
            <h2 className="mb-6 text-3xl font-bold text-dark-200 md:text-4xl dark:text-dark-900">
              About the Name: Vorsteh Queue
            </h2>
            <p className="mb-8 text-xl leading-relaxed text-fur-500 dark:text-dark-800">
              The name "Vorsteh Queue" is a tribute to our beloved German Spaniel. This breed is
              closely related to the Münsterländer, a type of pointing dog, known in German as a
              "Vorstehhund". Just as a pointing dog steadfastly indicates its target, Vorsteh Queue
              aims to reliably point your application towards efficient and robust background job
              processing.
            </p>
            <p className="text-xl leading-relaxed text-fur-500 dark:text-dark-800">
              The inspiration for naming a tech project after a dog comes from the delightful story
              of{" "}
              <a
                href="https://www.usebruno.com/"
                target="_blank"
                className="font-bold text-orange-primary hover:text-orange-accessible"
              >
                Bruno
              </a>
              , the API client. It's a nod to the personal touch and passion that drives open-source
              development, much like the loyalty and dedication of our canine companions.
            </p>
          </div>
        </div>
      </section>

      {/* Open Source Section */}
      <section id="opensource" className="bg-cream-100 py-20 dark:bg-dark-100">
        <div className="container mx-auto text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-orange-primary/10 dark:bg-orange-primary/20">
              <Heart className="h-8 w-8 text-orange-primary" />
            </div>
            <h2 className="mb-6 text-3xl font-bold text-dark-200 md:text-4xl dark:text-dark-900">
              Free & Open Source
            </h2>
            <p className="mb-8 text-xl leading-relaxed text-fur-500 dark:text-dark-800">
              Vorsteh Queue is completely free and open source. Built by developers, for developers.
              No hidden costs, no vendor lock-in, no limitations. Use it in your personal projects,
              startups, or enterprise applications.
            </p>
            <div className="mb-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <div className="flex items-center gap-2 text-fur-500 dark:text-dark-800">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span>MIT License</span>
              </div>
              <div className="flex items-center gap-2 text-fur-500 dark:text-dark-800">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span>Community Driven</span>
              </div>
              <div className="flex items-center gap-2 text-fur-500 dark:text-dark-800">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span>No Vendor Lock-in</span>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="bg-orange-darker text-white hover:bg-orange-accessible"
              >
                <GitProviderLink>
                  <GitProviderLogo width="1em" height="1em" />
                  <span>View on GitHub</span>
                </GitProviderLink>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-2 border-orange-darker bg-transparent text-orange-darker hover:bg-orange-darker hover:text-white dark:border-orange-light dark:text-orange-light dark:hover:bg-orange-light dark:hover:text-dark-200"
              >
                <Link href={"/docs"}>
                  <Code className="mr-2 h-5 w-5" />
                  Read Documentation
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

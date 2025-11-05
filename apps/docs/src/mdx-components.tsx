import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { ComponentPropsWithoutRef, ReactNode } from "react"
import type { CodeBlockProps } from "renoun/components"
import type { MDXComponents } from "renoun/mdx"
import Image from "next/image"
import Link from "next/link"
import { ExternalLinkIcon } from "lucide-react"
import { CodeBlock, CodeInline, Command } from "renoun/components"

import { Heading } from "~/components/heading"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Stepper, StepperItem } from "~/components/ui/stepper"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"

type AnchorProps = ComponentPropsWithoutRef<"a">

export function useMDXComponents() {
  return {
    h1: (props) => {
      return <Heading level={1} {...props} />
    },
    h2: (props) => {
      return <Heading level={2} {...props} />
    },
    h3: (props) => {
      return <Heading level={3} {...props} />
    },
    h4: (props) => {
      return <Heading level={4} {...props} />
    },
    h5: (props) => {
      return <Heading level={5} {...props} />
    },
    h6: (props) => {
      return <Heading level={6} {...props} />
    },
    // links ( relative, absolute, remote, mails )
    a: ({ href, children, ...props }: AnchorProps) => {
      if (!href) {
        return <Link href="/">###INVALID_LINK###</Link>
      }

      if (href.startsWith("http") || href.startsWith("https") || href.startsWith("mailto")) {
        return (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
            <ExternalLinkIcon className="ml-1 inline h-4 w-4" />
          </a>
        )
      }

      if (href.startsWith("#")) {
        return (
          <a href={href} {...props}>
            {children}
          </a>
        )
      }

      return (
        <>
          <Link href={href} {...props} prefetch={true}>
            {children ?? href}
          </Link>
        </>
      )
    },
    // markdown image handler
    img: (props) => (
      <section>
        <div className="flex items-center justify-center">
          <div className="dot-background rounded-md border p-8 md:w-3/4 dark:border-gray-700">
            <div className="border bg-background p-4">
              <Image
                {...props}
                width={0}
                height={0}
                style={{ width: "100%", height: "auto" }}
                className="not-prose object-contain"
              />
            </div>
          </div>
        </div>
      </section>
    ),
    // if you decide to use `<Image />` inside your mdx, you have the possibility to overwrite
    // the default values ( e.g. for width, height or className ) - we do this differently from the `img` tag above
    // because we think if you use `<Image />` inside your mdx, you should have this flexibility
    // if this is not what you want - feel free to change the code below or import the `Image` component directly
    Image: (props) => (
      <section>
        <div className="flex items-center justify-center">
          <div className="dot-background rounded-md border p-8 md:w-3/4 dark:border-gray-700">
            <div className="border bg-background p-4">
              <Image
                width={0}
                height={0}
                style={{ width: "100%", height: "auto" }}
                className="not-prose object-contain"
                {...props}
              />
            </div>
          </div>
        </div>
      </section>
    ),

    CodeInline,
    CodeBlock,
    Command,

    RemoteCodeBlock: async (props: CodeBlockProps & { source: string }) => {
      const directoryPath = join(process.cwd(), "../..")
      const { source, ...restProps } = props
      const code = await readFile(join(directoryPath, source), "utf-8")

      return <CodeBlock {...restProps}>{code}</CodeBlock>
    },
    Note: ({ title, children }: { title?: string; children: ReactNode }) => {
      return (
        <Alert variant={"default"} className="my-4">
          {title && <AlertTitle>{title}</AlertTitle>}
          <AlertDescription className="block">{children}</AlertDescription>
        </Alert>
      )
    },
    Warning: ({ title, children }: { title?: string; children: ReactNode }) => {
      return (
        <Alert variant={"destructive"} className="my-4">
          {title && <AlertTitle>{title}</AlertTitle>}
          <AlertDescription className="block">{children}</AlertDescription>
        </Alert>
      )
    },
    Stepper: ({ children }: { children: ReactNode }) => {
      return <Stepper>{children}</Stepper>
    },
    StepperItem: ({ title, children }: { title?: string; children: ReactNode }) => {
      return <StepperItem title={title}>{children}</StepperItem>
    },
    Tabs: ({ defaultValue, children }: { defaultValue?: string; children: ReactNode }) => (
      <Tabs defaultValue={defaultValue}>{children}</Tabs>
    ),
    TabsTrigger: ({ value, children }: { value: string; children: ReactNode }) => (
      <TabsTrigger value={value}>{children}</TabsTrigger>
    ),
    TabsList: ({ children }: { children: ReactNode }) => <TabsList>{children}</TabsList>,
    TabsContent: ({ value, children }: { value: string; children: ReactNode }) => (
      <TabsContent value={value}>{children}</TabsContent>
    ),

    table: ({ children }: { children?: ReactNode }) => {
      return (
        <div className="my-4 rounded-md border bg-white dark:border-gray-700 dark:bg-transparent">
          <div className="w-full overflow-auto">
            <Table>{children}</Table>
          </div>
        </div>
      )
    },

    thead: ({ children }: { children?: ReactNode }) => {
      return <TableHeader>{children}</TableHeader>
    },
    tbody: ({ children }: { children?: ReactNode }) => {
      return <TableBody>{children}</TableBody>
    },

    th: ({ children }: { children?: ReactNode }) => {
      return <TableHead>{children}</TableHead>
    },

    tr: ({ children }: { children?: ReactNode }) => {
      return <TableRow>{children}</TableRow>
    },

    td: ({ children }: { children?: ReactNode }) => {
      return <TableCell>{children}</TableCell>
    },

    dl: ({ children }: { children?: ReactNode }) => {
      return (
        <dl className="divide-y divide-gray-100">
          <div className="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">{children}</div>
        </dl>
      )
    },

    dt: ({ children }: { children?: ReactNode }) => {
      return <dt className="text-sm leading-6 font-medium text-primary">{children}</dt>
    },

    dd: ({ children }: { children?: ReactNode }) => {
      return (
        <dd className="mt-1 text-sm leading-6 text-primary sm:col-span-2 sm:mt-0">{children}</dd>
      )
    },

    DescriptionList: ({ children }: { children: ReactNode }) => {
      return <dl className="divide-y divide-accent-foreground/15">{children}</dl>
    },

    DescriptionListItem: ({ label, children }: { label: string; children: ReactNode }) => {
      return (
        <div className="px-0 py-6 lg:grid lg:grid-cols-3 lg:gap-4">
          <dt className="text-sm leading-6 font-bold text-primary lg:mt-0">{label}</dt>
          <dd className="mt-1 text-sm leading-6 text-primary lg:col-span-2 lg:mt-0">{children}</dd>
        </div>
      )
    },
  } satisfies MDXComponents
}

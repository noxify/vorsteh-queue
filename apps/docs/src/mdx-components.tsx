import { Children, isValidElement } from "react"
import type { ComponentPropsWithoutRef, ReactNode } from "react"
import type { CodeBlockProps } from "renoun/components"
import { CodeBlock, Toolbar } from "renoun/components"
import type { MDXComponents } from "renoun/mdx"
import { createSlug } from "renoun/mdx"

import { CliCommandDetails } from "@/components/mdx/cli-command-details"
import { CommandWrapper as Command } from "@/components/mdx/command"
import { Heading } from "@/components/mdx/heading"
import {
  ImageHandler,
  MarkdownImageHandler,
} from "@/components/mdx/image-handler"
import { InlineReference } from "@/components/mdx/inline-reference"
import { InterfaceReference } from "@/components/mdx/interface-reference"
import { LinkHandler } from "@/components/mdx/link-handler"
import { MermaidDiagram } from "@/components/mdx/mermaid"
import { RailroadDiagram } from "@/components/mdx/railroad"
import { References } from "@/components/mdx/reference"
import {
  StepperComponent,
  StepperItemComponent,
} from "@/components/mdx/stepper"
import { TemplateList } from "@/components/mdx/template-list"
import {
  Accordion as BaseAccordion,
  AccordionContent as BaseAccordionContent,
  AccordionItem as BaseAccordionItem,
  AccordionTrigger as BaseAccordionTrigger,
} from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { cn } from "./lib/utils"

type AnchorProps = ComponentPropsWithoutRef<"a">

export function useMDXComponents() {
  return {
    p(paragraph) {
      // oxlint-disable-next-line react/no-react-children -- needed for dynamic child inspection
      const children = Children.toArray(paragraph.children)

      const hasImageChild = children.some((child) => {
        if (!isValidElement(child)) {
          return false
        }

        if (child.type === "img") {
          return true
        }

        if (typeof child.type === "function") {
          const component = child.type as {
            name?: string
            displayName?: string
          }
          const componentName = component.displayName ?? component.name ?? ""
          return /image|img/iu.test(componentName)
        }

        return false
      })

      // Image-only paragraphs should not be wrapped in <p>, otherwise block
      // wrappers inside the mapped image component can cause hydration errors.
      if (hasImageChild && children.length === 1) {
        return paragraph.children
      }

      // If text and image are mixed, prefer a <div> to avoid invalid HTML
      // descendants (<section>/<div>) inside a paragraph element.
      if (hasImageChild) {
        return <div>{paragraph.children}</div>
      }

      return <p>{paragraph.children}</p>
    },
    h1: (props) => <Heading level={1} {...props} />,
    h2: (props) => <Heading level={2} {...props} />,
    h3: (props) => <Heading level={3} {...props} />,
    h4: (props) => <Heading level={4} {...props} />,
    h5: (props) => <Heading level={5} {...props} />,
    h6: (props) => <Heading level={6} {...props} />,
    a: ({ href, children, ...props }: AnchorProps) => (
      <LinkHandler href={href} {...props}>
        {children}
      </LinkHandler>
    ),
    // markdown image handler
    img: (props) => <MarkdownImageHandler {...props} />,
    // if you decide to use `<Image />` inside your mdx, you have the possibility to overwrite
    // the default values ( e.g. for width, height or className ) - we do this differently from the `img` tag above
    // because we think if you use `<Image />` inside your mdx, you should have this flexibility
    // if this is not what you want - feel free to change the code below or import the `Image` component directly
    Image: (props) => <ImageHandler {...props} />,

    Note: ({ title, children }: { title?: string; children: ReactNode }) => (
      <Alert variant="note" className="my-4">
        {title && <AlertTitle>{title}</AlertTitle>}
        <AlertDescription className="block">{children}</AlertDescription>
      </Alert>
    ),

    Callout: ({ title, children }: { title?: string; children: ReactNode }) => (
      <Alert variant="default" className="my-4">
        {title && <AlertTitle>{title}</AlertTitle>}
        <AlertDescription className="block">{children}</AlertDescription>
      </Alert>
    ),

    Success: ({ title, children }: { title?: string; children: ReactNode }) => (
      <Alert variant="success" className="my-4">
        {title && <AlertTitle>{title}</AlertTitle>}
        <AlertDescription className="block">{children}</AlertDescription>
      </Alert>
    ),
    Warning: ({ title, children }: { title?: string; children: ReactNode }) => (
      <Alert variant="warning" className="my-4">
        {title && <AlertTitle>{title}</AlertTitle>}
        <AlertDescription className="block">{children}</AlertDescription>
      </Alert>
    ),
    Error: ({ title, children }: { title?: string; children: ReactNode }) => (
      <Alert variant="destructive" className="my-4">
        {title && <AlertTitle>{title}</AlertTitle>}
        <AlertDescription className="block">{children}</AlertDescription>
      </Alert>
    ),
    table: ({ children }: { children?: ReactNode }) => (
      <div className="border-border my-4 rounded-md border bg-white dark:bg-transparent">
        <div className="w-full overflow-auto">
          <Table>{children}</Table>
        </div>
      </div>
    ),

    thead: ({ children }: { children?: ReactNode }) => (
      <TableHeader>{children}</TableHeader>
    ),
    tbody: ({ children }: { children?: ReactNode }) => (
      <TableBody>{children}</TableBody>
    ),
    th: ({ children }: { children?: ReactNode }) => (
      <TableHead>{children}</TableHead>
    ),
    tr: ({ children }: { children?: ReactNode }) => (
      <TableRow>{children}</TableRow>
    ),
    td: ({ children }: { children?: ReactNode }) => (
      <TableCell>{children}</TableCell>
    ),

    dl: ({ children }: { children?: ReactNode }) => (
      <dl className="divide-y divide-gray-100">
        <div className="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
          {children}
        </div>
      </dl>
    ),

    dt: ({ children }: { children?: ReactNode }) => (
      <dt className="text-primary text-sm leading-6 font-medium">{children}</dt>
    ),

    dd: ({ children }: { children?: ReactNode }) => (
      <dd className="text-primary mt-1 text-sm leading-6 sm:col-span-2 sm:mt-0">
        {children}
      </dd>
    ),

    DescriptionList: ({ children }: { children: ReactNode }) => (
      <dl className="divide-accent-foreground/15 divide-y">{children}</dl>
    ),

    DescriptionListItem: ({
      label,
      children,
    }: {
      label: string
      children: ReactNode
    }) => (
      <div className="px-0 py-6 lg:grid lg:grid-cols-3 lg:gap-4">
        <dt className="text-primary text-sm leading-6 font-bold lg:mt-0">
          {label}
        </dt>
        <dd className="text-primary mt-1 text-sm leading-6 lg:col-span-2 lg:mt-0">
          {children}
        </dd>
      </div>
    ),

    Stepper: ({ children }: { children: ReactNode }) => (
      <StepperComponent>{children}</StepperComponent>
    ),
    StepperItem: ({
      title,
      children,
    }: {
      title: string
      children: ReactNode
    }) => <StepperItemComponent title={title}>{children}</StepperItemComponent>,

    Tabs: ({
      defaultValue,
      children,
    }: {
      defaultValue?: string
      children: ReactNode
    }) => <Tabs defaultValue={defaultValue}>{children}</Tabs>,
    TabsTrigger: ({
      value,
      children,
    }: {
      value: string
      children: ReactNode
    }) => <TabsTrigger value={value}>{children}</TabsTrigger>,
    TabsList: ({ children }: { children: ReactNode }) => (
      <TabsList>{children}</TabsList>
    ),
    TabsContent: ({
      value,
      children,
    }: {
      value: string
      children: ReactNode
    }) => <TabsContent value={value}>{children}</TabsContent>,

    Accordion: ({
      children,
      multiple,
      orientation,
    }: {
      children: ReactNode
      multiple?: boolean
      orientation?: "horizontal" | "vertical"
    }) => (
      <BaseAccordion multiple={multiple} orientation={orientation}>
        {children}
      </BaseAccordion>
    ),
    AccordionItem: ({
      children,
      title,
    }: {
      children: ReactNode
      title: string
    }) => (
      <BaseAccordionItem value={createSlug(title)}>
        <BaseAccordionTrigger>{title}</BaseAccordionTrigger>
        <BaseAccordionContent>{children}</BaseAccordionContent>
      </BaseAccordionItem>
    ),

    CodeBlock: ({
      shouldAnalyze: _shouldAnalyze,
      containerClassName,
      ...props
    }: CodeBlockProps & { preview?: boolean; containerClassName?: string }) => {
      // Disable shouldAnalyze globally to avoid type resolution timeouts during SSG builds.
      // The MDX files still declare `shouldAnalyze` but we ignore it here.
      const shouldAnalyze = false
      if (props.language === "mermaid") {
        const { preview = false } = props
        return (
          <MermaidDiagram code={props.children as string} preview={preview} />
        )
      }

      // @ts-expect-error - railroad is not a valid language
      if (props.language === "railroad") {
        const { preview = false } = props
        return (
          <RailroadDiagram code={props.children as string} preview={preview} />
        )
      }

      return (
        <div
          className={cn(
            "not-prose bg-muted my-6 rounded-lg text-sm leading-6 border border-border dark:border-none",
            containerClassName
          )}
        >
          <CodeBlock
            {...props}
            shouldFormat={false}
            showErrors={false}
            shouldAnalyze={shouldAnalyze}
            components={{
              // oxlint-disable-next-line react/no-unstable-nested-components
              Toolbar: (toolbarProps) => (
                <Toolbar {...toolbarProps} className="border-b text-base!" />
              ),
              // oxlint-disable-next-line react/no-unstable-nested-components
              Container: (containerProps) => (
                <div
                  {...containerProps}
                  style={containerProps.css}
                  className="not-prose border-border border dark:border-none"
                />
              ),
            }}
            showLineNumbers
          />
        </div>
      )
    },

    Command,
    CliCommandDetails,
    InlineReference,
    InterfaceReference,
    References,
    TemplateList,
  } satisfies MDXComponents
}

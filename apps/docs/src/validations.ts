import { z } from "zod"

export const frontmatterSchema = z.object({
  alias: z.string().optional(),
  description: z.string().optional(),
  entrypoint: z.string().optional(),
  externalLink: z.url().optional(),
  ignoreSearch: z.boolean().optional().default(false),
  navBadge: z
    .enum(["new", "updated", "beta", "experimental", "deprecated", "pulse"])
    .optional(),
  navIcon: z.string().optional(),
  navTitle: z.string().optional(),
  apiReference: z
    .array(z.object({ name: z.string(), file: z.string() }))
    .default([]),
  cliCommand: z.string().optional(),
  separator: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional(),
  title: z.string().optional(),
  toc: z.boolean().optional().default(true),
  favorite: z.boolean().optional().default(false),
})

export const headingSchema = z.array(
  z.object({
    id: z.string(),
    level: z.number(),
    text: z.string(),
  })
)

export const docSchema = {
  frontmatter: frontmatterSchema,
  headings: headingSchema,
}

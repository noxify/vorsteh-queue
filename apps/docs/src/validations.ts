import z from "zod"

export const frontmatterSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  navTitle: z.string().optional(),
  entrypoint: z.string().optional(),
  alias: z.string().optional(),
  showToc: z.boolean().optional().default(true),
})

export const headingSchema = z.array(
  z.object({
    level: z.number(),
    text: z.string(),
    id: z.string(),
  }),
)

export const docSchema = {
  frontmatter: frontmatterSchema,
  headings: headingSchema,
}

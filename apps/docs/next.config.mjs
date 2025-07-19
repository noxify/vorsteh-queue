import createMDXPlugin from "@next/mdx"
import rehypeRenoun from "@renoun/mdx/rehype"
import remarkRenounAddHeadings from "@renoun/mdx/remark/add-headings"
import remarkRenounRemoveParagraphs from "@renoun/mdx/remark/remove-immediate-paragraphs"
import remarkRenounRelativeLinks from "@renoun/mdx/remark/transform-relative-links"
import rehypeMdxImportMedia from "rehype-mdx-import-media"
import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import remarkMdxFrontmatter from "remark-mdx-frontmatter"
import remarkSqueezeParagraphs from "remark-squeeze-paragraphs"
import remarkStripBadges from "remark-strip-badges"

const withMDX = createMDXPlugin({
  options: {
    remarkPlugins: [
      remarkRenounAddHeadings,
      remarkFrontmatter,
      remarkMdxFrontmatter,
      remarkSqueezeParagraphs,
      remarkRenounRemoveParagraphs,
      remarkStripBadges,
      remarkRenounRelativeLinks,
      remarkGfm,
    ],
    rehypePlugins: [rehypeRenoun, rehypeMdxImportMedia],
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  trailingSlash: true,
  poweredByHeader: false,
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack(config) {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    }
    return config
  },
}

export default withMDX(nextConfig)

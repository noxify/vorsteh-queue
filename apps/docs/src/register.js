/**
 * workaround to supress the node warning
 * @see https://mdxjs.com/packages/node-loader
 */

import { register } from "node:module"

register("@mdx-js/node-loader", import.meta.url)

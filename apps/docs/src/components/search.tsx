"use client"

import type { Pagefind, PagefindSearchResults } from "types/pagefind"
import * as React from "react"
import { useEffect, useState } from "react"
import { addBasePath } from "next/dist/client/add-base-path"
import { useRouter } from "next/navigation"
import { Interweave } from "interweave"
import { ArrowDown, ArrowUp, CornerDownLeft, FileIcon, HashIcon, SearchIcon } from "lucide-react"
import pMap from "p-map"
import { useDebouncedCallback } from "use-debounce"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command"
import { Button, buttonVariants } from "./ui/button"

async function flattenSearchResult(pagefindResult: PagefindSearchResults) {
  const resultData = pMap(
    pagefindResult.results ?? [],
    async (result) => {
      const { data, id } = result
      const resolvedData = await data()

      const { sub_results, meta, url, excerpt } = resolvedData

      const headingResult = sub_results.map((ele, eleIdx) => {
        return {
          id: `${id}_${eleIdx}`,
          type: "heading",
          title: ele.title,
          url: ele.url,
          excerpt: ele.excerpt,
          level: ele.anchor?.element,
        }
      })

      const pageResult = {
        id,
        meta,
        title: meta.title,
        type: "page",
        url,
        excerpt,
        headings: headingResult,
      }

      return [pageResult]
    },
    { concurrency: 1 },
  )

  return (await resultData).flat()
}

export function Search() {
  const router = useRouter()
  const [searchValue, setSearchValue] = useState("")
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [useMockProvider, setUseMockProvider] = useState(false)
  const [results, setResults] = useState<Awaited<ReturnType<typeof flattenSearchResult>>>([])
  const [isPending, setIsPending] = useState(false)
  // try to load pagefind
  // if not found, use mock provider
  useEffect(() => {
    async function loadPagefind() {
      if (typeof window.pagefind === "undefined") {
        try {
          window.pagefind = (await import(
            /* webpackIgnore: true */ addBasePath("/pagefind/pagefind.js")
          )) as unknown as Pagefind
          setLoaded(true)
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log(
            "Unable to load pagefind. Maybe you're running the page in dev mode? Switching to the mock provider...",
          )
          setLoaded(true)
          setUseMockProvider(true)
        }
      }
    }
    void loadPagefind()
  }, [])

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const handleOpen = () => {
    setOpen(!open)
    setSearchValue("")
    setResults([])
  }

  const handleSearch = async (value: string) => {
    if (value === "") {
      setIsPending(false)
      setResults([])
      return
    }

    setIsPending(true)
    if (!useMockProvider) {
      if (window.pagefind) {
        // await window.pagefind.options({
        //   excerptLength: 10,
        // })
        const search = await window.pagefind.debouncedSearch(value, undefined, 100)
        const transformedResultList = await flattenSearchResult(search)
        setResults(transformedResultList)
      }
    }

    setIsPending(false)
  }

  const debouncedFetchItems = useDebouncedCallback(handleSearch, 300)
  const handleOnSearchChange = (e: string) => {
    setIsPending(true)
    setSearchValue(e)
    void debouncedFetchItems(e)
  }

  if (!loaded) {
    return (
      <div className={buttonVariants({ variant: "ghost", size: "icon" })}>
        <svg
          aria-hidden="true"
          className="h-4 w-4 animate-spin fill-foreground/80 text-foreground/50"
          viewBox="0 0 100 101"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
            fill="currentColor"
          />
          <path
            d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
            fill="currentFill"
          />
        </svg>
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  return (
    <>
      <Button variant={"ghost"} size={"icon"} onClick={() => setOpen(true)}>
        <SearchIcon />
        <span className="sr-only">Search</span>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={handleOpen}
        showCloseButton={false}
        async={true}
        className="top-20"
      >
        <CommandInput
          value={searchValue}
          placeholder="Type a command or search..."
          onValueChange={handleOnSearchChange}
          isPending={isPending}
        />
        <CommandList className="max-h-[700px]">
          <>
            {results.length > 0 ? (
              <>
                {results.map((result, idx) => {
                  return (
                    <CommandGroup key={idx} heading={result.meta.breadcrumb}>
                      <CommandItem
                        className="group"
                        key={`${idx}`}
                        value={result.url}
                        id={`${idx}`}
                        onSelect={(element) => {
                          setOpen(false)
                          setSearchValue("")
                          router.push(element)
                        }}
                      >
                        <div>
                          <div className="flex items-center space-x-2 font-bold">
                            <FileIcon className="text-orange-primary group-data-[selected=true]:text-white" />
                            <span>{result.title}</span>
                          </div>
                          <Interweave
                            content={result.excerpt}
                            className="line-clamp-2 w-auto max-w-[calc(100%-2rem)] text-ellipsis [&_mark]:rounded [&_mark]:bg-orange-primary [&_mark]:px-1 [&_mark]:text-white group-data-[selected=true]:[&_mark]:bg-white group-data-[selected=true]:[&_mark]:text-foreground group-data-[selected=true]:[&_mark]:dark:text-orange-accessible"
                          />
                        </div>
                      </CommandItem>
                      {result.headings
                        .filter((ele) => {
                          return ele.level != "h1" && ele.level !== undefined
                        })
                        .map((heading, idy) => {
                          return (
                            <CommandItem
                              className="group"
                              key={`${idx}_${idy}`}
                              value={heading.url}
                              id={`${idx}_${idy}`}
                              onSelect={(element) => {
                                setOpen(false)
                                setSearchValue("")
                                router.push(element)
                              }}
                            >
                              <div className="ml-2">
                                <div className="flex items-center space-x-2 font-bold">
                                  <HashIcon className="text-orange-primary group-data-[selected=true]:text-white" />
                                  <span>{heading.title}</span>
                                </div>
                                <Interweave
                                  content={heading.excerpt}
                                  className="line-clamp-2 w-auto max-w-[calc(100%-2rem)] text-ellipsis [&_mark]:rounded [&_mark]:bg-orange-primary [&_mark]:px-1 [&_mark]:text-white group-data-[selected=true]:[&_mark]:bg-white group-data-[selected=true]:[&_mark]:text-foreground group-data-[selected=true]:[&_mark]:dark:text-orange-accessible"
                                />
                              </div>
                            </CommandItem>
                          )
                        })}
                    </CommandGroup>
                  )
                })}
              </>
            ) : searchValue !== "" ? (
              isPending ? (
                <CommandEmpty>Searching...</CommandEmpty>
              ) : (
                <CommandEmpty>Nothing found...</CommandEmpty>
              )
            ) : (
              <CommandEmpty>Start typing...</CommandEmpty>
            )}
          </>
        </CommandList>
        <div className="inset-x-0 flex h-10 items-center justify-end gap-4 rounded-b-xl border-t px-4 text-xs font-medium text-muted-foreground">
          <div className="flex items-center gap-1">
            <kbd className="pointer-events-none flex h-5 items-center justify-center gap-1 rounded border bg-orange-primary px-1 font-sans text-[0.7rem] font-medium text-white select-none">
              <CornerDownLeft className="size-3" />
            </kbd>{" "}
            Go to Page
          </div>
          <div className="flex items-center gap-1">
            <kbd className="pointer-events-none flex h-5 items-center justify-center gap-1 rounded border bg-orange-primary px-1 font-sans text-[0.7rem] font-medium text-white select-none">
              ESC
            </kbd>{" "}
            Close
          </div>

          <div className="flex items-center gap-1">
            <kbd className="pointer-events-none flex h-5 items-center justify-center gap-1 rounded border bg-orange-primary px-1 font-sans text-[0.7rem] font-medium text-white select-none">
              <ArrowUp className="size-3" />
            </kbd>
            <kbd className="pointer-events-none flex h-5 items-center justify-center gap-1 rounded border bg-orange-primary px-1 font-sans text-[0.7rem] font-medium text-white select-none">
              <ArrowDown className="size-3" />
            </kbd>{" "}
            Navigate
          </div>
        </div>
      </CommandDialog>
    </>
  )
}

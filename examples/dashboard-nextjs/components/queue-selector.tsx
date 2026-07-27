"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams, usePathname, useRouter } from "next/navigation"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function QueueSelector() {
  const router = useRouter()
  const params = useParams()
  const pathname = usePathname()
  const currentQueue = params.queue as string | undefined

  const { data } = useQuery({
    queryKey: ["queue-names"],
    queryFn: () =>
      fetch("/api/queues").then(
        (r) => r.json() as Promise<{ names: string[]; defaultQueue: string }>
      ),
  })

  const names = data?.names ?? []

  function handleQueueChange(newQueue: string | null) {
    if (!newQueue) {
      return
    }
    if (currentQueue) {
      // On a queue sub-page, swap the queue segment keeping the sub-path
      const subPath = pathname.replace(`/${currentQueue}`, "")
      router.push(`/${newQueue}${subPath}`)
    } else {
      // On the dashboard page, navigate to the queue overview
      router.push(`/${newQueue}`)
    }
  }

  if (names.length === 0) {
    return null
  }

  return (
    <Select value={currentQueue ?? ""} onValueChange={handleQueueChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select queue..." />
      </SelectTrigger>
      <SelectContent>
        {names.map((name) => (
          <SelectItem key={name} value={name}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

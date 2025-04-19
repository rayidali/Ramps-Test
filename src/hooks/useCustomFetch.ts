import { useCallback, useContext } from "react"
import { AppContext } from "../utils/context"
import { fakeFetch, RegisteredEndpoints } from "../utils/fetch"
import { useWrappedRequest } from "./useWrappedRequest"

export function useCustomFetch() {
  const { cache } = useContext(AppContext)
  const { loading, wrappedRequest } = useWrappedRequest()

  const fetchWithCache = useCallback(
    async <TData, TParams extends object = object>(
      endpoint: RegisteredEndpoints,
      params?: TParams
    ): Promise<TData | null> =>
      wrappedRequest<TData>(async () => {
        const cacheKey = getCacheKey(endpoint, params)
        const cacheResponse = cache?.current.get(cacheKey)

        if (cacheResponse) {
          const data = JSON.parse(cacheResponse)
          return data as Promise<TData>
        }

        const result = await fakeFetch<TData>(endpoint, params)
        cache?.current.set(cacheKey, JSON.stringify(result))
        return result
      }),
    [cache, wrappedRequest]
  )

  const fetchWithoutCache = useCallback(
    async <TData, TParams extends object = object>(
      endpoint: RegisteredEndpoints,
      params?: TParams
    ): Promise<TData | null> =>
      wrappedRequest<TData>(async () => {
        const result = await fakeFetch<TData>(endpoint, params)
        
        // Update cache for paginatedTransactions and transactionsByEmployee
        if (endpoint === "setTransactionApproval" && params && 'transactionId' in params) {
          const transactionId = (params as any).transactionId
          const newValue = (params as any).value
          
          // Update all paginatedTransactions cache entries
          const paginatedCacheKeys = Array.from(cache?.current.keys() || [])
            .filter(key => key.startsWith("paginatedTransactions"))
          
          for (const key of paginatedCacheKeys) {
            const paginatedCacheResponse = cache?.current.get(key)
            if (paginatedCacheResponse) {
              const paginatedData = JSON.parse(paginatedCacheResponse)
              const updatedData = paginatedData.data.map((transaction: any) => 
                transaction.id === transactionId ? { ...transaction, approved: newValue } : transaction
              )
              cache?.current.set(key, JSON.stringify({ ...paginatedData, data: updatedData }))
            }
          }

          // Update transactionsByEmployee cache
          const employeeCacheKeys = Array.from(cache?.current.keys() || [])
            .filter(key => key.startsWith("transactionsByEmployee"))
          
          for (const key of employeeCacheKeys) {
            const employeeCacheResponse = cache?.current.get(key)
            if (employeeCacheResponse) {
              const employeeData = JSON.parse(employeeCacheResponse)
              const updatedEmployeeData = employeeData.map((transaction: any) =>
                transaction.id === transactionId ? { ...transaction, approved: newValue } : transaction
              )
              cache?.current.set(key, JSON.stringify(updatedEmployeeData))
            }
          }
        }
        
        return result
      }),
    [cache, wrappedRequest]
  )

  const clearCache = useCallback(() => {
    if (cache?.current === undefined) {
      return
    }

    cache.current = new Map<string, string>()
  }, [cache])

  const clearCacheByEndpoint = useCallback(
    (endpointsToClear: RegisteredEndpoints[]) => {
      if (cache?.current === undefined) {
        return
      }

      const cacheKeys = Array.from(cache.current.keys())

      for (const key of cacheKeys) {
        const clearKey = endpointsToClear.some((endpoint) => key.startsWith(endpoint))

        if (clearKey) {
          cache.current.delete(key)
        }
      }
    },
    [cache]
  )

  return { fetchWithCache, fetchWithoutCache, clearCache, clearCacheByEndpoint, loading }
}

function getCacheKey(endpoint: RegisteredEndpoints, params?: object) {
  return `${endpoint}${params ? `@${JSON.stringify(params)}` : ""}`
}

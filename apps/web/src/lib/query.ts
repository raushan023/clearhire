import { useRef } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type Query,
} from "@tanstack/react-query";
import { useAuth } from "./auth";
import { ApiError } from "./api-client";
export function retryRequest(count: number, error: Error) {
  return (
    !(error instanceof ApiError && error.status >= 400 && error.status < 600) &&
    count < 1
  );
}
export function previousListData<T>(
  previous: T | undefined,
  query: Pick<Query, "queryKey"> | undefined,
  nextKey: QueryKey,
): T | undefined {
  const prior = query?.queryKey;
  if (!prior || prior[1] !== nextKey[1] || prior[2] !== nextKey[2])
    return undefined;
  if (
    !["jobs", "employer-jobs", "applicants", "saved", "notifications"].includes(
      String(nextKey[2]),
    )
  )
    return undefined;
  // Applicant lists also belong to one particular job.
  if (nextKey[2] === "applicants" && prior[3] !== nextKey[3]) return undefined;
  return previous;
}
export function useApiQuery<T>(
  key: QueryKey,
  load: (signal: AbortSignal) => Promise<T>,
  enabled = true,
) {
  const { user } = useAuth();
  const queryKey = ["account", user?.id, ...key];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => load(signal),
    enabled: !!user && enabled,
    staleTime: ["skills", "benefits"].includes(String(key[0]))
      ? 300_000
      : 30_000,
    gcTime: 60_000,
    placeholderData: (previous, query) =>
      previousListData(previous, query, queryKey),
    retry: retryRequest,
  });
  // Retain existing content on transient refetch errors. Permission failures still block it.
  if (
    query.isRefetchError &&
    (!(query.error instanceof ApiError) ||
      query.error.status === 0 ||
      query.error.status >= 500)
  ) {
    return {
      ...query,
      error: null,
      isError: false as const,
      isSuccess: true as const,
      status: "success" as const,
      isRefetchError: false as const,
      refreshError: query.error,
    };
  }
  return { ...query, refreshError: null };
}
export function useApiMutation<TInput, TResult = void>(
  action: (input: TInput) => Promise<TResult>,
  invalidate: string[],
) {
  const client = useQueryClient(),
    { user } = useAuth();
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: action,
    onSuccess: async () => {
      await Promise.all(
        invalidate.map((key) =>
          client.invalidateQueries({ queryKey: ["account", user?.id, key] }),
        ),
      );
    },
    onError: async (error) => {
      if (error instanceof ApiError && [403, 404, 409].includes(error.status))
        await Promise.all(
          invalidate.map((key) =>
            client.invalidateQueries({ queryKey: ["account", user?.id, key] }),
          ),
        );
    },
  });
  const mutate: typeof mutation.mutate = (...args) => {
    // Synchronous guard also covers two submissions before React paints disabled state.
    if (inFlight.current) return;
    inFlight.current = true;
    const options = args[1];
    args[1] = {
      ...options,
      onSettled: (...settled) => {
        inFlight.current = false;
        options?.onSettled?.(...settled);
      },
    };
    mutation.mutate(...args);
  };
  return { ...mutation, mutate };
}

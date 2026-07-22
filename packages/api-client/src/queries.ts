import type {
  CapaDto,
  DocumentDto,
  DocumentVersionDto,
  FileDto,
  InspectionDto,
  MeDto,
  NcrActionDto,
  NcrDto,
  NotificationDto,
  NotificationPrefsDto,
  Page,
  SearchResults,
  UnreadCountDto,
} from "@kaenal/types";
import type { ApiClient } from "./client.js";
import { queryKeys } from "./query-keys.js";

/**
 * TanStack Query integration, framework-agnostic. Rather than bake React or a
 * specific @tanstack/react-query major into this shared client (it ships to both
 * Next and Expo), each factory returns a plain query-option object
 * `{ queryKey, queryFn }` — the pattern TanStack v5 itself recommends. The app
 * feeds it straight to `useQuery`:
 *
 *   const q = useQuery(apiQueries.ncrs.list(client, { query: { status: "open" } }));
 *
 * Mutations are the client call composed with `unwrap`:
 *
 *   useMutation({ mutationFn: (body) => unwrap(client.createNcr({ body })) });
 */

export interface QueryOption<TData> {
  readonly queryKey: readonly unknown[];
  readonly queryFn: () => Promise<TData>;
}

/** Raised by `unwrap` when the API returns a non-2xx status (the error envelope). */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API request failed with status ${status}`);
    this.name = "ApiRequestError";
  }
}

/**
 * Turn a ts-rest response (a discriminated union on `status`) into a value or a
 * throw — which is what TanStack Query's `queryFn`/`mutationFn` expect (a
 * rejected promise becomes an error state). Success bodies pass through typed.
 */
export function unwrap<TData>(res: { status: number; body: unknown }): Promise<TData> {
  if (res.status >= 200 && res.status < 300) return Promise.resolve(res.body as TData);
  return Promise.reject(new ApiRequestError(res.status, res.body));
}

// Argument types forwarded verbatim to the client methods, so the factories stay
// as strongly typed as the contract without re-declaring each shape.
type Arg<K extends keyof ApiClient> = ApiClient[K] extends (args: infer A) => unknown ? A : never;

export const apiQueries = {
  me: (client: ApiClient): QueryOption<MeDto> => ({
    queryKey: queryKeys.me(),
    queryFn: () => client.getMe().then((r) => unwrap<MeDto>(r)),
  }),

  search: (client: ApiClient, q: string): QueryOption<SearchResults> => ({
    queryKey: queryKeys.search(q),
    queryFn: () => client.search({ query: { q } }).then((r) => unwrap<SearchResults>(r)),
  }),

  inspections: {
    list: (client: ApiClient, args?: Arg<"listInspections">): QueryOption<Page<InspectionDto>> => ({
      queryKey: queryKeys.inspections.list(args?.query),
      queryFn: () => client.listInspections(args).then((r) => unwrap<Page<InspectionDto>>(r)),
    }),
    detail: (client: ApiClient, id: string): QueryOption<InspectionDto> => ({
      queryKey: queryKeys.inspections.detail(id),
      queryFn: () => client.getInspection({ params: { id } }).then((r) => unwrap<InspectionDto>(r)),
    }),
  },

  ncrs: {
    list: (client: ApiClient, args?: Arg<"listNcrs">): QueryOption<Page<NcrDto>> => ({
      queryKey: queryKeys.ncrs.list(args?.query),
      queryFn: () => client.listNcrs(args).then((r) => unwrap<Page<NcrDto>>(r)),
    }),
    detail: (client: ApiClient, id: string): QueryOption<NcrDto> => ({
      queryKey: queryKeys.ncrs.detail(id),
      queryFn: () => client.getNcr({ params: { id } }).then((r) => unwrap<NcrDto>(r)),
    }),
    actions: (client: ApiClient, id: string): QueryOption<Page<NcrActionDto>> => ({
      queryKey: queryKeys.ncrs.actions(id),
      queryFn: () => client.listNcrActions({ params: { id } }).then((r) => unwrap<Page<NcrActionDto>>(r)),
    }),
  },

  capas: {
    list: (client: ApiClient, args?: Arg<"listCapas">): QueryOption<Page<CapaDto>> => ({
      queryKey: queryKeys.capas.list(args?.query),
      queryFn: () => client.listCapas(args).then((r) => unwrap<Page<CapaDto>>(r)),
    }),
    detail: (client: ApiClient, id: string): QueryOption<CapaDto> => ({
      queryKey: queryKeys.capas.detail(id),
      queryFn: () => client.getCapa({ params: { id } }).then((r) => unwrap<CapaDto>(r)),
    }),
  },

  documents: {
    list: (client: ApiClient, args?: Arg<"listDocuments">): QueryOption<Page<DocumentDto>> => ({
      queryKey: queryKeys.documents.list(args?.query),
      queryFn: () => client.listDocuments(args).then((r) => unwrap<Page<DocumentDto>>(r)),
    }),
    detail: (client: ApiClient, id: string): QueryOption<DocumentDto> => ({
      queryKey: queryKeys.documents.detail(id),
      queryFn: () => client.getDocument({ params: { id } }).then((r) => unwrap<DocumentDto>(r)),
    }),
    versions: (client: ApiClient, id: string): QueryOption<Page<DocumentVersionDto>> => ({
      queryKey: queryKeys.documents.versions(id),
      queryFn: () => client.listDocumentVersions({ params: { id } }).then((r) => unwrap<Page<DocumentVersionDto>>(r)),
    }),
  },

  files: {
    detail: (client: ApiClient, id: string): QueryOption<FileDto> => ({
      queryKey: queryKeys.files.detail(id),
      queryFn: () => client.getFile({ params: { id } }).then((r) => unwrap<FileDto>(r)),
    }),
  },

  notifications: {
    list: (client: ApiClient, args?: Arg<"listNotifications">): QueryOption<Page<NotificationDto>> => ({
      queryKey: queryKeys.notifications.list(args?.query),
      queryFn: () => client.listNotifications(args).then((r) => unwrap<Page<NotificationDto>>(r)),
    }),
    unreadCount: (client: ApiClient): QueryOption<UnreadCountDto> => ({
      queryKey: queryKeys.notifications.unreadCount(),
      queryFn: () => client.unreadCount().then((r) => unwrap<UnreadCountDto>(r)),
    }),
    prefs: (client: ApiClient): QueryOption<NotificationPrefsDto> => ({
      queryKey: queryKeys.notifications.prefs(),
      queryFn: () => client.getNotificationPrefs().then((r) => unwrap<NotificationPrefsDto>(r)),
    }),
  },
} as const;

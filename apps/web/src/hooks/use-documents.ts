"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiQueries, queryKeys, unwrap } from "@kaenal/api-client";
import type {
  CreateDocumentBody,
  DocumentDto,
  NewDocumentVersionBody,
  ReviewDocumentBody,
  TransitionDocumentBody,
  DocumentVersionDto,
} from "@kaenal/types";
import { getApiClient } from "@/lib/api";

/** Query filters accepted by the documents list endpoint (03 §3). */
export interface DocumentListQuery {
  status?: DocumentDto["status"];
  category?: DocumentDto["category"];
  cursor?: string;
  limit?: number;
}

export function useDocuments(query?: DocumentListQuery) {
  return useQuery(apiQueries.documents.list(getApiClient(), query !== undefined ? { query } : undefined));
}

export function useDocument(id: string) {
  return useQuery(apiQueries.documents.detail(getApiClient(), id));
}

export function useDocumentVersions(id: string) {
  return useQuery(apiQueries.documents.versions(getApiClient(), id));
}

export function useCreateDocument() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDocumentBody) => client.createDocument({ body }).then((r) => unwrap<DocumentDto>(r)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.documents.list() }),
  });
}

/** Author-side lifecycle: submit (→pending), revise (rejected→draft), archive. */
export function useTransitionDocument() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: TransitionDocumentBody }) =>
      client.transitionDocument({ params: { id }, body }).then((r) => unwrap<DocumentDto>(r)),
    onSuccess: (doc) => {
      void qc.invalidateQueries({ queryKey: queryKeys.documents.list() });
      void qc.invalidateQueries({ queryKey: queryKeys.documents.detail(doc.id) });
    },
  });
}

/** Approve or reject a pending document (four-eyes: not the author). */
export function useReviewDocument() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReviewDocumentBody }) =>
      client.reviewDocument({ params: { id }, body }).then((r) => unwrap<DocumentDto>(r)),
    onSuccess: (doc) => {
      void qc.invalidateQueries({ queryKey: queryKeys.documents.list() });
      void qc.invalidateQueries({ queryKey: queryKeys.documents.detail(doc.id) });
      void qc.invalidateQueries({ queryKey: queryKeys.documents.versions(doc.id) });
    },
  });
}

/** Open a fresh draft version of an approved document (never moves it backward). */
export function useNewDocumentVersion() {
  const client = getApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: NewDocumentVersionBody }) =>
      client.newDocumentVersion({ params: { id }, body }).then((r) => unwrap<DocumentVersionDto>(r)),
    onSuccess: (_v, { id }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.documents.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.documents.versions(id) });
    },
  });
}

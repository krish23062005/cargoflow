"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const DEFAULT_EVENTS = ["positions"];

/**
 * Subscribe to a Server-Sent Events endpoint with automatic reconnection.
 *
 * EventSource reconnects by itself, but if the connection dies silently the
 * browser's backoff can be slow — so we also probe with a heartbeat comment
 * (`:` lines, which EventSource swallows). Events are delivered to `onEvent`;
 * a per-stream `status` ("connecting" | "open" | "error") is exposed for UI.
 */
export function useSSE<T extends Record<string, unknown>>({
  url,
  onEvent,
  events = DEFAULT_EVENTS,
}: {
  url: string;
  onEvent: (event: string, data: T) => void;
  /** Named server events to register explicit listeners for. */
  events?: string[];
}) {
  const [status, setStatus] = useState<"connecting" | "open" | "error">("connecting");
  const [tick, setTick] = useState(0);
  const handlerRef = useRef(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  const reconnect = useCallback(() => {
    setStatus("connecting");
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const armHeartbeat = () => {
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      heartbeatTimer = setTimeout(() => {
        if (!closed) {
          es?.close();
          reconnect();
        }
      }, 45_000);
    };

    es = new EventSource(url);

    es.onopen = () => {
      if (closed) return;
      setStatus("open");
      armHeartbeat();
    };

    es.onerror = () => {
      if (closed) return;
      setStatus("error");
      // Let EventSource auto-reconnect; if it fails for a while the heartbeat
      // watcher above kicks in with a hard reconnect.
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      heartbeatTimer = setTimeout(() => {
        if (!closed && es && es.readyState !== EventSource.OPEN) {
          es.close();
          reconnect();
        }
      }, 15_000);
    };

    // Generic message listener; heartbeat comments never reach onmessage.
    es.onmessage = (msg) => {
      armHeartbeat();
      try {
        handlerRef.current("message", JSON.parse(msg.data) as T);
      } catch {
        // ignore malformed payloads
      }
    };

    // Named events arrive here (e.g. the positions payload from tracking SSE).
    for (const eventName of events) {
      es.addEventListener(eventName, (e) => {
        armHeartbeat();
        try {
          handlerRef.current(eventName, JSON.parse((e as MessageEvent).data) as T);
        } catch {
          // ignore
        }
      });
    }

    return () => {
      closed = true;
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      es?.close();
    };
  }, [url, reconnect, tick, events]);

  return { status, reconnect };
}
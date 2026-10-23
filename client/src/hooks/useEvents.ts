import { useEffect, useState } from 'react';

export interface SSEMessage {
  type: string;
  data: any;
  timestamp: string;
}

export function useEvents(onEvent?: (event: SSEMessage) => void) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SSEMessage | null>(null);

  useEffect(() => {
    const eventSource = new EventSource('/events');

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as SSEMessage;
        setLastEvent(parsed);
        if (onEvent) {
          onEvent(parsed);
        }
      } catch (err) {
        // Parse error ignored
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return { connected, lastEvent };
}

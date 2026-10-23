import { Response } from 'express';

interface Client {
  id: string;
  res: Response;
}

let clients: Client[] = [];

export function registerSSEClient(id: string, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', id })}\n\n`);

  clients.push({ id, res });

  res.on('close', () => {
    clients = clients.filter(c => c.id !== id);
  });
}

export function broadcastEvent(type: string, data: any) {
  const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  for (const client of clients) {
    try {
      client.res.write(`data: ${payload}\n\n`);
    } catch (e) {
      // Ignore broken pipe
    }
  }
}

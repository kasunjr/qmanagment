import { NextRequest } from "next/server";
import { Client } from "pg";
import { authenticateStaffRequest } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

export async function GET(request: NextRequest) {
  const staffUser = await authenticateStaffRequest(request);
  if (!staffUser) {
    return new Response("Staff authentication required.", { status: 401 });
  }
  if (!staffUser.queue_id) {
    return new Response(null, { status: 204 });
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.query("LISTEN queue_ticket_created");
  } catch (error) {
    await client.end().catch(() => {});
    console.error("Staff queue event subscription failed:", error);
    return new Response("Unable to subscribe to queue events.", { status: 500 });
  }

  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;
  const heartbeat = setInterval(() => {
    if (!closed) {
      try {
        streamController?.enqueue(encoder.encode(": keepalive\n\n"));
      } catch {
        void close();
      }
    }
  }, 25_000);

  const close = async () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    request.signal.removeEventListener("abort", onAbort);
    client.off("notification", onNotification);
    client.off("error", onError);
    await client.end().catch(() => {});
  };
  const onAbort = () => void close();
  const onNotification = (notification: { channel?: string; payload?: string }) => {
    if (notification.channel !== "queue_ticket_created" || notification.payload !== staffUser.queue_id) return;
    try {
      streamController?.enqueue(encoder.encode("event: tickets-updated\ndata: {}\n\n"));
    } catch {
      void close();
    }
  };
  const onError = (error: Error) => {
    console.error("Staff queue event stream failed:", error);
    try {
      streamController?.error(error);
    } catch {
      // The stream may already be closed by the client.
    }
    void close();
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      client.on("notification", onNotification);
      client.on("error", onError);
      request.signal.addEventListener("abort", onAbort, { once: true });
      controller.enqueue(encoder.encode("event: ready\ndata: {}\n\n"));
    },
    cancel() {
      void close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

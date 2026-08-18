// Route handlers in this app only use Supabase REST/Auth. Supabase JS still
// initializes Realtime, so provide a placeholder transport for Node 20 where
// global WebSocket is not available.
export class ServerRealtimeTransport {
  constructor() {
    throw new Error("Supabase Realtime is not available in this server runtime.");
  }
}

export const serverSupabaseOptions = {
  realtime: {
    transport: ServerRealtimeTransport,
  },
};

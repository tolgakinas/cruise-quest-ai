import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchSailingsTool from "./tools/search-sailings";
import getSailingItineraryTool from "./tools/get-sailing-itinerary";
import listPortExcursionsTool from "./tools/list-port-excursions";
import listMyBookingsTool from "./tools/list-my-bookings";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged and Vite inlines it at build time.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "shore-hopper",
  title: "Shore Hopper",
  version: "0.1.0",
  instructions:
    "Tools for Shore Hopper, a shore excursion marketplace. Use `search_sailings` to find upcoming cruises, `get_sailing_itinerary` for the port-by-port schedule, `list_port_excursions` for tours in a port, and `list_my_bookings` for the signed-in passenger's own reservations.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    searchSailingsTool,
    getSailingItineraryTool,
    listPortExcursionsTool,
    listMyBookingsTool,
  ] as unknown as Parameters<typeof defineMcp>[0]["tools"],
});

// ============================================================================
// main.jsx
// ----------------------------------------------------------------------------
// Entry point of the whole app. Vite loads this file first (it's the script
// tag referenced in index.html) and everything else gets pulled in from here.
//
// What happens on this page, step by step:
//   1. React needs a real DOM element to render into — that's the
//      <div id="root"></div> element sitting in index.html.
//   2. createRoot() takes that element and gives us a "root" we can render
//      React components into.
//   3. .render(...) draws our component tree into that root for the first
//      time (and keeps it updated afterward, whenever state changes).
// ============================================================================

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Chakra UI's provider component. Every Chakra component used anywhere in
// the app (Button, Input, Textarea, etc. inside GoogleCalendar.jsx and
// EventPopup.jsx) needs to be inside a <ChakraProvider> to pick up Chakra's
// default styling — without it, those components would render unstyled.
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import GoogleCalendar from "./GoogleCalendar.jsx";
// Our own plain CSS file with all the calendar's custom styling (colors,
// layout, spacing). Importing it here means Vite bundles it into the page
// for every part of the app, since main.jsx is the very first file loaded.
import "./calendar.css";

createRoot(document.getElementById("root")).render(
  // StrictMode is a React development helper. It doesn't render any visible
  // UI itself — it just runs extra checks in development (like calling
  // functions twice on purpose) to help catch mistakes early. It's
  // automatically removed/ignored in a production build.
  <StrictMode>
    {/* ChakraProvider needs a "system" (a set of default theme values —
        colors, fonts, spacing scale) passed as its `value` prop. Chakra UI
        ships a ready-made one called `defaultSystem`, so we don't have to
        build a custom theme ourselves. */}
    <ChakraProvider value={defaultSystem}>
      {/* GoogleCalendar is the ONE top-level component for this entire
          app — it owns all the state (events, popup open/closed, which
          view mode is selected, etc.) and renders the whole page:
          header, sidebar, calendar grid, and the create/edit popup. */}
      <GoogleCalendar />
    </ChakraProvider>
  </StrictMode>
);

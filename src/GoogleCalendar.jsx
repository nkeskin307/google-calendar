// ============================================================================
// GoogleCalendar.jsx
// ----------------------------------------------------------------------------
// This is the ONE big component that renders the entire app: the header,
// the left summary sidebar, the calendar grid, and (conditionally) the
// create/edit popup. It also owns every piece of state the app needs —
// there is no other component holding its own state anywhere else, which
// keeps the whole data flow easy to follow: everything lives here, and
// EventPopup.jsx only ever receives data via props and reports back via
// callback props (onSave, onUpdate, onDelete, onCancel).
//
// Rough map of this file, top to bottom:
//   1. Imports
//   2. Constants that never change (categories, sample week, hour labels,
//      grid math constants)
//   3. Small helper functions (timeToHours, formatTime)
//   4. The GoogleCalendar component itself:
//        a. useState calls (all the app's state)
//        b. Event handler functions (create/update/delete/slot-click)
//        c. Derived values computed fresh on every render (Weekly Balance,
//           Busiest Day, Week Mood, Next Up, which days to show)
//        d. The JSX returned (header, sidebar, calendar grid, popup)
// ============================================================================

import { useState } from "react";
import { Button } from "@chakra-ui/react";
import {
  Menu,
  ChevronLeft,
  ChevronRight,
  Search,
  Settings,
  CircleUserRound,
  Plus,
  Smile,
  CalendarDays,
  Sparkles,
  CalendarRange,
} from "lucide-react";
import sampleEvents from "./events.js";
import EventPopup from "./EventPopup.jsx";

// ----------------------------------------------------------------------------
// CONSTANTS
// Everything below is defined OUTSIDE the component function on purpose.
// These values never change while the app runs, so there's no reason to
// recreate them on every render the way a value declared inside the
// component function body would be.
// ----------------------------------------------------------------------------

// The full list of categories, used to build the "All / School / Personal /
// Work / Social" Focus Mode filter chips. "All" is a special value meaning
// "don't filter anything" — it isn't a real event category.
const categories = ["All", "School", "Personal", "Work", "Social"];

// Which day (by its short name) is treated as "today" for the purposes of
// highlighting a column in the grid AND for the Next Up calculation below.
// Since this whole app uses a fixed, hardcoded sample week instead of real
// live dates, this is just a constant rather than something computed from
// an actual Date object.
const TODAY_DAY_NAME = "Tue";

// Maps each short day code (as stored on every event and in weekDays) to
// its full display name. Used anywhere the UI wants to show "Tuesday"
// instead of just "Tue" — e.g. the Busiest Day and Next Up cards.
const fullDayNames = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

// The 7 columns of the calendar, in order. Each event's `day` field (from
// events.js) is matched against the `name` here to know which column it
// belongs in. `date` is just a hardcoded display label — this whole app
// uses one fixed sample week rather than real, ever-changing dates.
const weekDays = [
  { name: "Mon", date: "Sep 14" },
  { name: "Tue", date: "Sep 15" },
  { name: "Wed", date: "Sep 16" },
  { name: "Thu", date: "Sep 17" },
  { name: "Fri", date: "Sep 18" },
  { name: "Sat", date: "Sep 19" },
  { name: "Sun", date: "Sep 20" },
];

// The row of hour labels running down the left edge of the grid, from
// 8 AM through 6 PM (11 rows total). The grid simply doesn't have rows for
// any hour outside this range — an event starting before 8 AM or after
// 6 PM would render outside the visible grid area.
const hours = [
  "8 AM",
  "9 AM",
  "10 AM",
  "11 AM",
  "12 PM",
  "1 PM",
  "2 PM",
  "3 PM",
  "4 PM",
  "5 PM",
  "6 PM",
];

// GRID_START_HOUR: the grid's first visible hour, as a 24-hour number
// (8 = 8 AM). Used to convert an event's real-world start time into a
// position relative to the TOP of the grid (position 0 = 8 AM).
//
// HOUR_HEIGHT_PX: how many pixels tall ONE hour row is. This MUST stay in
// sync with the `height: 48px` rule on .time-slot and .hour-cell in
// calendar.css — if you change one, change the other, or events will be
// drawn at the wrong height/position.
const GRID_START_HOUR = 8;
const HOUR_HEIGHT_PX = 48;

// ----------------------------------------------------------------------------
// HELPER FUNCTIONS
// Plain functions (not React hooks, not components) used to convert
// between the "HH:MM" time format events are stored in and the numbers /
// friendly strings the UI actually needs.
// ----------------------------------------------------------------------------

// Converts a 24-hour "HH:MM" time string into a single decimal number of
// hours. Examples: "09:00" -> 9, "14:30" -> 14.5, "18:15" -> 18.25.
// This decimal form is what makes the pixel-position math for event cards
// simple: (timeToHours(event.startTime) - GRID_START_HOUR) * HOUR_HEIGHT_PX
// gives the exact number of pixels from the top of the grid to where that
// event should start being drawn.
function timeToHours(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours + minutes / 60;
}

// Converts a 24-hour "HH:MM" string into a friendlier "H:MM AM/PM" string
// for display, e.g. "09:00" -> "9:00 AM", "14:30" -> "2:30 PM",
// "00:00" -> "12:00 AM". Only used for display (currently just in the
// Next Up card) — the underlying event data always stays in 24-hour
// format everywhere else.
function formatTime(time) {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  // Convert 24-hour to 12-hour: hour 0 and hour 12 both need to display as
  // "12", every other hour just wraps around with % 12.
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

// ============================================================================
// THE COMPONENT
// ============================================================================
export default function GoogleCalendar() {
  // --------------------------------------------------------------------
  // STATE
  // Every piece of state the whole app needs lives here. Passing bits of
  // it down to EventPopup as props (and getting changes back via callback
  // props) is what keeps that component "dumb" — it never touches
  // eventList directly, it just reports user actions upward.
  // --------------------------------------------------------------------

  // The full list of events currently on the calendar. Starts out as a
  // COPY of the sample data from events.js, then grows/shrinks/changes as
  // the user creates, edits, and deletes events. events.js itself is never
  // modified while the app runs — all changes only ever touch this state.
  const [eventList, setEventList] = useState(sampleEvents);

  // Whether the create/edit popup is currently showing at all. EventPopup
  // is only rendered in the JSX below when this is true.
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  // Remembers which day + hour the user clicked on an EMPTY slot, so that
  // information can be handed to EventPopup as a starting point when
  // creating a brand new event. Only meaningful in "create" mode — ignored
  // when editing an existing event (selectedEvent below takes priority).
  const [clickedSlot, setClickedSlot] = useState(null);

  // The full event object being edited, or null when there's nothing
  // being edited (either the popup is closed, or it's open in "create new
  // event" mode). Passing this to EventPopup as `existingEvent` is what
  // switches that component from "create" mode into "edit" mode — see the
  // big comment at the top of EventPopup.jsx for more on that.
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Focus Mode: which single category is currently "in focus". The
  // special value "All" means no filtering is happening at all — every
  // event is shown at full opacity. Any other value (e.g. "School") means
  // every event NOT in that category should be dimmed (but still visible).
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Free Time Finder: a simple on/off switch. When true, every empty
  // 1-hour slot in the grid gets a soft green highlight (see isHourFree
  // below and the .free-slot CSS class).
  const [isFreeTimeOn, setIsFreeTimeOn] = useState(false);

  // View Mode: controls which days of the week the grid currently shows.
  // One string with 3 possible values instead of separate true/false
  // flags for each mode — that way it's impossible to accidentally have
  // two modes "on" at once, and adding a future 4th mode later would just
  // mean adding one more string value instead of another whole boolean.
  //   "week"    -> Monday through Friday only
  //   "weekend" -> Saturday and Sunday only
  //   "full"    -> the entire Monday through Sunday week
  const [viewMode, setViewMode] = useState("week");

  // --------------------------------------------------------------------
  // EVENT HANDLERS
  // Functions that respond to user actions (clicks) by updating state.
  // --------------------------------------------------------------------

  // Called when the user clicks an EMPTY hour cell in the grid (or the
  // Create button — see handleSlotClick("Mon", 0) further down in the
  // JSX). Works out the exact "HH:00" start time from which hour was
  // clicked, clears out any previously selected event (so the popup opens
  // in CREATE mode, not edit mode), remembers the clicked day/time, and
  // opens the popup.
  //
  //   dayName   - e.g. "Mon", "Tue" — which column was clicked
  //   hourIndex - the position of the clicked row inside the `hours` array
  //               (0 = "8 AM", 1 = "9 AM", ... 10 = "6 PM")
  function handleSlotClick(dayName, hourIndex) {
    // hourIndex is just a position in the `hours` array (0, 1, 2, ...) —
    // adding it to GRID_START_HOUR converts it back into a real 24-hour
    // clock hour. padStart(2, "0") makes sure single-digit hours come out
    // as "08" instead of "8", matching the "HH:MM" format everywhere else.
    const startHour = String(GRID_START_HOUR + hourIndex).padStart(2, "0");
    setSelectedEvent(null);
    setClickedSlot({ day: dayName, startTime: `${startHour}:00` });
    setIsPopupOpen(true);
  }

  // Called by EventPopup's onSave prop when the user presses "Save" while
  // creating a brand new event. `newEvent` is a plain object with title/
  // day/startTime/endTime/category/notes, but NO id yet (EventPopup never
  // generates ids) — so this function is responsible for stamping one on
  // before adding it to the list. Date.now() (milliseconds since 1970) is
  // an easy way to get a number that's guaranteed to be different from
  // every id already in the sample data (which only go up to 8).
  function handleSaveEvent(newEvent) {
    setEventList([...eventList, { ...newEvent, id: Date.now() }]);
    setIsPopupOpen(false);
  }

  // Called by EventPopup's onUpdate prop when the user presses "Update"
  // while editing an existing event. `updatedEvent` is the FULL event
  // object (EventPopup already merged the original event with whatever
  // the user changed, including keeping the original id). This walks the
  // whole eventList and replaces just the one entry whose id matches,
  // leaving every other event untouched.
  function handleUpdateEvent(updatedEvent) {
    setEventList(
      eventList.map((event) =>
        event.id === updatedEvent.id ? updatedEvent : event
      )
    );
    setIsPopupOpen(false);
    setSelectedEvent(null);
  }

  // Called by EventPopup's onDelete prop when the user presses "Delete".
  // Simply keeps every event EXCEPT the one whose id matches.
  function handleDeleteEvent(eventId) {
    setEventList(eventList.filter((event) => event.id !== eventId));
    setIsPopupOpen(false);
    setSelectedEvent(null);
  }

  // Free Time Finder logic: figures out whether a given 1-hour window on a
  // given day is "free" (has no event overlapping it at all).
  //
  //   dayName - which day column to check, e.g. "Wed"
  //   hour    - the hour to check, as a plain number (e.g. 14 for 2 PM) —
  //             this represents the window [hour, hour + 1)
  //
  // The overlap check itself: an event overlaps this hour if the event
  // STARTS before the hour ends (event.startTime < hour + 1) AND the event
  // ENDS after the hour begins (event.endTime > hour). If ANY event on
  // that day satisfies both conditions, the slot is NOT free. This is
  // intentionally simple — it only answers "is this hour already taken?",
  // nothing more (no buffers, no minimum gaps, etc.).
  function isHourFree(dayName, hour) {
    return !eventList.some(
      (event) =>
        event.day === dayName &&
        timeToHours(event.startTime) < hour + 1 &&
        timeToHours(event.endTime) > hour
    );
  }

  // --------------------------------------------------------------------
  // DERIVED VALUES
  // Everything below this point is NOT state — these are plain values
  // recalculated from scratch on every single render, straight from
  // eventList (and the constants above). Because they're recalculated
  // every render, they automatically stay correct the instant eventList
  // changes (after creating, editing, or deleting an event) — there's no
  // separate "don't forget to update this too" step anywhere.
  // --------------------------------------------------------------------

  // ---- Weekly Balance: how many events exist in each category ----
  // Four independent counts, each found the same way: filter the whole
  // eventList down to just the events matching one category, then read
  // how many are left with .length.
  const schoolCount = eventList.filter(
    (event) => event.category === "School"
  ).length;
  const personalCount = eventList.filter(
    (event) => event.category === "Personal"
  ).length;
  const workCount = eventList.filter(
    (event) => event.category === "Work"
  ).length;
  const socialCount = eventList.filter(
    (event) => event.category === "Social"
  ).length;

  // ---- Busiest Day: which day has the most events ----
  // A simple "keep track of the best one seen so far" loop: walk through
  // every day of the week in order, count how many events fall on that
  // day, and remember it if it beats the current highest count. Using
  // strictly ">" (not ">=") means that if two days are TIED for the most
  // events, whichever day comes FIRST in weekDays (i.e. earlier in the
  // week) wins and stays remembered — later ties don't overwrite it.
  // This only counts events, it never looks at how long they are.
  let busiestDayName = null;
  let busiestDayCount = 0;
  weekDays.forEach((day) => {
    const countForDay = eventList.filter(
      (event) => event.day === day.name
    ).length;
    if (countForDay > busiestDayCount) {
      busiestDayName = day.name;
      busiestDayCount = countForDay;
    }
  });

  // ---- Week Mood: a simple label based on the total number of events ----
  // Three buckets, checked from the top down: 11 or more events is
  // "Packed", 6 to 10 is "Balanced", and anything less (0-5) falls through
  // to the default "Light". This looks only at the raw COUNT of events —
  // it has no idea how long any of them are or how "busy" a day actually
  // feels in real life.
  const totalEventCount = eventList.length;
  let weekMood = "Light";
  if (totalEventCount >= 11) {
    weekMood = "Packed";
  } else if (totalEventCount >= 6) {
    weekMood = "Balanced";
  }

  // ---- Next Up: the single soonest event from "today" onward ----
  // This app has no real live clock — TODAY_DAY_NAME is just a hardcoded
  // constant — so "soonest" is worked out purely by comparing each
  // event's day against today's position in the week, then (for events on
  // the same day) by start time. It does NOT check whether a specific
  // hour on today has technically "already passed" in real life, because
  // there's no real current time to compare against.
  //
  // Step 1: find where "today" sits in the weekDays array (its index).
  // Mon is index 0, Tue is index 1, and so on.
  const todayIndex = weekDays.findIndex((day) => day.name === TODAY_DAY_NAME);

  // Step 2: build a list of every event whose day comes ON OR AFTER today
  // (comparing each event's own day-index against todayIndex), then sort
  // that shortened list into calendar order — earliest day first, and for
  // events landing on the exact same day, earliest start time first.
  const upcomingEvents = eventList
    .filter(
      (event) => weekDays.findIndex((day) => day.name === event.day) >= todayIndex
    )
    .sort((a, b) => {
      // Compare by day position first. A negative result means "a" comes
      // before "b" in the week, which is exactly what Array.sort expects
      // to place "a" earlier in the sorted list.
      const dayDifference =
        weekDays.findIndex((day) => day.name === a.day) -
        weekDays.findIndex((day) => day.name === b.day);
      // Only fall back to comparing start times when both events are on
      // the exact same day (dayDifference === 0) — otherwise the day
      // comparison above already decided the order.
      if (dayDifference !== 0) return dayDifference;
      return timeToHours(a.startTime) - timeToHours(b.startTime);
    });

  // Step 3: after sorting, the very first item in the list (if any) is the
  // soonest upcoming event. `|| null` handles the case where the filtered
  // list came back completely empty (nothing left this week) — without
  // it, upcomingEvents[0] would just be `undefined`, which still works
  // fine in an `if`, but `null` is a clearer, more intentional way to
  // represent "there is no next event".
  const nextEvent = upcomingEvents[0] || null;

  // ---- View Mode: which days actually get rendered in the grid ----
  // Starts from the full weekDays array, then narrows it down depending
  // on viewMode. Everything ELSE in this file (event filtering, the Free
  // Time Finder, click-to-create) keeps working directly off each event's
  // `day` field, completely unaware of which days are currently visible —
  // so none of that logic needed to change when this 3-mode system was
  // added.
  let displayedDays = weekDays;
  if (viewMode === "week") {
    displayedDays = weekDays.filter(
      (day) => day.name !== "Sat" && day.name !== "Sun"
    );
  } else if (viewMode === "weekend") {
    displayedDays = weekDays.filter(
      (day) => day.name === "Sat" || day.name === "Sun"
    );
  }
  // (if viewMode is "full", displayedDays is simply left as the complete
  // weekDays array from the line above)

  // Builds the CSS grid-template-columns value used by BOTH the day-header
  // row and the hour-grid below it, so their columns always line up. A
  // fixed 60px for the time labels, then one equal-width (1fr) column per
  // currently-visible day. Fewer visible days (like Weekend Mode's 2)
  // automatically means each of those columns gets more of the available
  // width — no extra math needed for "make weekend columns wider".
  const gridColumns = `60px repeat(${displayedDays.length}, 1fr)`;

  // --------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------
  return (
    <div className="calendar-app">
      {/* ================= HEADER ================= */}
      {/* Top bar: menu icon + app title on the left, Today button + arrows
          + current month in the center, search/settings/profile icons on
          the right. None of these controls are actually wired up to real
          behavior (no real navigation between months, no real search) —
          this app always shows the same fixed sample week. */}
      <header className="calendar-header">
        <div className="header-left">
          <Menu className="icon" />
          <span className="app-title">Google Calendar</span>
        </div>

        <div className="header-center">
          <Button size="sm" variant="outline" className="today-button">
            Today
          </Button>
          <ChevronLeft className="icon" />
          <ChevronRight className="icon" />
          <span className="current-month">September 2026</span>
        </div>

        <div className="header-right">
          <Search className="icon" />
          <Settings className="icon" />
          <CircleUserRound className="icon" />
        </div>
      </header>

      {/* ================= BODY: sidebar + calendar ================= */}
      <div className="calendar-body">
        {/* ---------- LEFT SIDEBAR ---------- */}
        {/* Summary panel (left): the 3 view-mode buttons, then Next Up,
            Weekly Balance, Busiest Day, and Week Mood — all 4 of those
            summary sections are calculated fresh above on every render, so
            they update automatically the instant eventList changes. */}
        <aside className="summary-panel">
          {/* Week Mode / Weekend Mode / Full Calendar buttons. Each one
              just calls setViewMode with a different string — the
              displayedDays logic above reacts to whichever value is
              currently set. The `mode-button-active` class (which gives
              the currently-selected button its thicker, colored border)
              is added conditionally by comparing viewMode to each
              button's own value. */}
          <button
            className={`mode-button mode-button-week ${
              viewMode === "week" ? "mode-button-active" : ""
            }`}
            onClick={() => setViewMode("week")}
          >
            <CalendarDays className="mode-button-icon" />
            Week Mode
          </button>

          <button
            className={`mode-button mode-button-weekend ${
              viewMode === "weekend" ? "mode-button-active" : ""
            }`}
            onClick={() => setViewMode("weekend")}
          >
            <Sparkles className="mode-button-icon" />
            Weekend Mode
          </button>

          <button
            className={`mode-button mode-button-full ${
              viewMode === "full" ? "mode-button-active" : ""
            }`}
            onClick={() => setViewMode("full")}
          >
            <CalendarRange className="mode-button-icon" />
            Full Calendar
          </button>

          {/* Next Up card: shows the single soonest event found in the
              "DERIVED VALUES" section above (nextEvent). The card's left
              border color comes from a CSS class built dynamically from
              the event's own category, e.g. category "Work" produces
              className "next-up-work" (see calendar.css). When there's no
              upcoming event at all, a plain fallback message is shown
              instead of an empty/broken-looking card. */}
          <div className="summary-section next-up-section">
            <h4>Next Up</h4>
            {nextEvent ? (
              <div className={`next-up-card next-up-${nextEvent.category.toLowerCase()}`}>
                <p className="next-up-title">{nextEvent.title}</p>
                <p className="summary-subtext">
                  {fullDayNames[nextEvent.day]} · {formatTime(nextEvent.startTime)}
                </p>
                <p className="summary-subtext">{nextEvent.category}</p>
              </div>
            ) : (
              <p className="summary-subtext">No upcoming events</p>
            )}
          </div>

          {/* Weekly Balance card: one line per category, each with a
              small colored dot matching that category's event-card color,
              followed by the live count calculated above. */}
          <div className="summary-section summary-card">
            <h4>Weekly Balance</h4>
            <p>
              <span className="calendar-dot dot-school" />
              School {schoolCount}
            </p>
            <p>
              <span className="calendar-dot dot-personal" />
              Personal {personalCount}
            </p>
            <p>
              <span className="calendar-dot dot-work" />
              Work {workCount}
            </p>
            <p>
              <span className="calendar-dot dot-social" />
              Social {socialCount}
            </p>
          </div>

          {/* Busiest Day card: pale-blue background (from the extra
              summary-card-blue class). Shows the full day name if one was
              found, otherwise falls back to "No events yet" for the edge
              case where eventList is completely empty. The "X events"
              subtext line only renders when there IS a busiest day. */}
          <div className="summary-section summary-card summary-card-blue">
            <h4>Busiest Day</h4>
            <p>{busiestDayName ? fullDayNames[busiestDayName] : "No events yet"}</p>
            {busiestDayName && (
              <p className="summary-subtext">{busiestDayCount} events</p>
            )}
          </div>

          {/* Week Mood card: pale warm background, with a small Smile
              icon next to the label just for a bit of personality. Shows
              the computed mood word plus the raw total event count
              underneath as supporting context. */}
          <div className="summary-section summary-card summary-card-warm">
            <h4>
              <Smile className="mood-icon" />
              Week Mood
            </h4>
            <p>{weekMood}</p>
            <p className="summary-subtext">{totalEventCount} events total</p>
          </div>
        </aside>

        {/* ---------- CENTER: calendar column ---------- */}
        {/* Everything to the right of the sidebar: the top-right row (My
            Calendars + Create button), then the toolbar and the grid
            itself. This column is the widest/largest part of the whole
            page on purpose — the calendar grid is the main feature. */}
        <div className="calendar-center">
          {/* Top-right row: My Calendars (a purely informational legend —
              clicking these names doesn't filter anything, that's what
              the Focus Mode chips further down are for) and the Create
              button, sitting side by side in the corner. */}
          <div className="top-right-row">
            <div className="calendars-panel">
              <span className="calendars-label">My Calendars</span>
              <span className="calendar-chip">
                <span className="calendar-dot dot-school" />
                School
              </span>
              <span className="calendar-chip">
                <span className="calendar-dot dot-personal" />
                Personal
              </span>
              <span className="calendar-chip">
                <span className="calendar-dot dot-work" />
                Work
              </span>
              <span className="calendar-chip">
                <span className="calendar-dot dot-social" />
                Social
              </span>
            </div>

            {/* Create button: intentionally reuses handleSlotClick — the
                exact same function that runs when you click an empty grid
                cell — instead of having its own separate "create" logic.
                Calling it with a fixed ("Mon", 0) just means "open the
                popup as if the user had clicked Monday at 8 AM"; since
                every field in the popup is still fully editable before
                saving, this default is only a convenient starting point,
                not a real restriction on what gets created. */}
            <Button
              size="sm"
              className="create-button-top"
              onClick={() => handleSlotClick("Mon", 0)}
            >
              <Plus className="icon" />
              Create
            </Button>
          </div>

          {/* The scrollable area holding the toolbar and the grid. */}
          <main className="calendar-main">
          <div className="calendar-toolbar">
            <h2>Week View</h2>

            <div className="toolbar-controls">
              {/* Focus Mode chips: one button per entry in `categories`
                  (including "All"). Clicking a chip just updates
                  selectedCategory — the actual dimming behavior happens
                  later, per-event, down in the grid rendering below. */}
              <div className="focus-filters">
                {categories.map((category) => (
                  <button
                    key={category}
                    className={`filter-button ${
                      selectedCategory === category
                        ? "filter-button-active"
                        : ""
                    }`}
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {/* Free Time Finder toggle: a simple on/off switch that
                  flips isFreeTimeOn. The actual highlighting of empty
                  slots happens down in the grid rendering, using the
                  isHourFree() helper defined above. */}
              <button
                className={`free-time-toggle ${
                  isFreeTimeOn ? "free-time-toggle-active" : ""
                }`}
                onClick={() => setIsFreeTimeOn(!isFreeTimeOn)}
              >
                Show Free Time
              </button>
            </div>
          </div>

          {/* Day headers row: one blank corner cell above the time
              column, then one header per currently-visible day (from
              displayedDays, NOT the full weekDays — this is what actually
              makes Week/Weekend/Full Calendar mode show different
              columns). The inline gridTemplateColumns style keeps this
              row's columns lined up exactly with the hour grid below it. */}
          <div className="week-header" style={{ gridTemplateColumns: gridColumns }}>
            <div className="time-column-header" />
            {displayedDays.map((day) => (
              <div
                className={`day-header ${
                  day.name === TODAY_DAY_NAME ? "day-header-today" : ""
                }`}
                key={day.name}
              >
                <span>{day.name}</span>
                <span>{day.date}</span>
              </div>
            ))}
          </div>

          {/* The main hour-by-hour grid: a fixed time-label column on the
              left, then one column per currently-visible day. */}
          <div className="week-grid" style={{ gridTemplateColumns: gridColumns }}>
            {/* Time column: just the list of hour labels, top to bottom.
                This doesn't change based on viewMode — the same 8 AM-6 PM
                range is shown no matter which days are visible. */}
            <div className="time-column">
              {hours.map((hour) => (
                <div className="time-slot" key={hour}>
                  {hour}
                </div>
              ))}
            </div>

            {/* One column per visible day. Each column contains TWO
                layers stacked on top of each other:
                  1. A grid of empty, clickable 1-hour cells (rendered
                     first, so they sit at the back).
                  2. The actual event cards for that day, absolutely
                     positioned over those cells (rendered second, so they
                     sit on top and are what actually receives clicks
                     wherever an event exists). */}
            {displayedDays.map((day) => (
              <div
                className={`day-column ${
                  day.name === TODAY_DAY_NAME ? "day-column-today" : ""
                }`}
                key={day.name}
              >
                {/* Layer 1: empty hour cells. Clicking one opens the
                    create-event popup pre-filled for this exact day and
                    hour. When Free Time Finder is on AND this specific
                    hour has no event anywhere on this day, the extra
                    "free-slot" class adds a soft green highlight. */}
                {hours.map((hour, hourIndex) => {
                  // Convert this cell's position in the `hours` array back
                  // into a real clock hour, the same way handleSlotClick
                  // does, so isHourFree can check the right hour.
                  const hourNumber = GRID_START_HOUR + hourIndex;
                  const isFree =
                    isFreeTimeOn && isHourFree(day.name, hourNumber);

                  return (
                    <div
                      className={`hour-cell ${isFree ? "free-slot" : ""}`}
                      key={hour}
                      onClick={() => handleSlotClick(day.name, hourIndex)}
                    />
                  );
                })}

                {/* Layer 2: the actual events for this specific day, found
                    by filtering the FULL eventList down to just this
                    day's events (regardless of which days are currently
                    displayed — an event's own day never changes based on
                    viewMode, only whether its column happens to be
                    visible right now). */}
                {eventList
                  .filter((event) => event.day === day.name)
                  .map((event) => {
                    // Convert this event's start/end times into a pixel
                    // position within the column. `top` is how far down
                    // from the column's top edge (8 AM) the event begins;
                    // `height` is how tall the event card should be,
                    // based on its duration.
                    const top =
                      (timeToHours(event.startTime) - GRID_START_HOUR) *
                      HOUR_HEIGHT_PX;
                    const height =
                      (timeToHours(event.endTime) -
                        timeToHours(event.startTime)) *
                      HOUR_HEIGHT_PX;

                    // Focus Mode: this event should look "dimmed" only
                    // when a specific category is selected (not "All")
                    // AND this particular event doesn't belong to that
                    // category. Events matching the selected category (or
                    // every event, when "All" is selected) stay at full
                    // opacity.
                    const isDimmed =
                      selectedCategory !== "All" &&
                      event.category !== selectedCategory;

                    return (
                      <div
                        // The category-based color class is built
                        // dynamically here, e.g. category "Personal"
                        // becomes "event-personal", which matches a rule
                        // in calendar.css. The dimmed class is only added
                        // conditionally, on top of that color class.
                        className={`event-card event-${event.category.toLowerCase()} ${
                          isDimmed ? "event-dimmed" : ""
                        }`}
                        key={event.id}
                        style={{ top: `${top}px`, height: `${height}px` }}
                        onClick={() => {
                          // Clicking an existing event opens the SAME
                          // popup used for creating one, but this time
                          // with existingEvent set — which is exactly
                          // what switches EventPopup into "edit" mode.
                          setSelectedEvent(event);
                          setIsPopupOpen(true);
                        }}
                      >
                        {/* Only the title and time range are shown on the
                            card itself — notes are intentionally never
                            displayed here, only inside the edit popup. */}
                        <div className="event-title">{event.title}</div>
                        <div className="event-time">
                          {event.startTime}–{event.endTime}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
          </main>
        </div>
      </div>

      {/* ================= CREATE/EDIT POPUP ================= */}
      {/* This whole block only renders anything at all when isPopupOpen is
          true — otherwise EventPopup isn't mounted at all. The `key` prop
          here is a deliberate React trick: whenever the key changes (e.g.
          switching from editing event #3 to editing event #7, or from
          editing to creating a new one), React treats it as a completely
          different component instance and throws away the old one's
          internal state instead of reusing it. Without this, EventPopup's
          useState calls (for title, day, startTime, etc.) would keep
          their OLD values when you closed the popup and reopened it for a
          different event or a different empty slot. */}
      {isPopupOpen && (
        <EventPopup
          key={
            selectedEvent
              ? `edit-${selectedEvent.id}`
              : `create-${clickedSlot.day}-${clickedSlot.startTime}`
          }
          clickedSlot={clickedSlot}
          existingEvent={selectedEvent}
          onSave={handleSaveEvent}
          onUpdate={handleUpdateEvent}
          onDelete={handleDeleteEvent}
          onCancel={() => {
            setIsPopupOpen(false);
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
}

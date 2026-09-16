// ============================================================================
// events.js
// ----------------------------------------------------------------------------
// This file holds the sample event data used by the whole app.
//
// GoogleCalendar.jsx imports this array as the STARTING value for its
// `eventList` state (see `useState(sampleEvents)`). After that first load,
// the array below is never touched again directly — every event the user
// creates, edits, or deletes only changes the copy living in React state.
// That means editing this file only changes what you see the very first
// time the app loads (or after a full page refresh).
//
// Shape of one event object:
//   {
//     id:        number  -> unique identifier, used as the React `key` and
//                            to find/update/delete the right event later.
//     title:     string  -> shown on the event card and in the popup form.
//     day:       string  -> one of "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",
//                            "Sun". Must match the short names used in the
//                            `weekDays` array inside GoogleCalendar.jsx,
//                            because that's how events get matched to the
//                            correct day column in the grid.
//     startTime: string  -> 24-hour "HH:MM" format, e.g. "09:00" or "14:30".
//     endTime:   string  -> same format as startTime, must be later than it.
//     category:  string  -> one of "School", "Personal", "Work", "Social".
//                            This controls the event's color everywhere
//                            (event card, Weekly Balance dot, Next Up
//                            accent, My Calendars legend) and which Focus
//                            Mode filter chip it belongs to.
//     notes:     string  -> OPTIONAL. Free-text notes typed in the popup's
//                            "Notes" field. Not present on these sample
//                            events (so it just reads as undefined until
//                            the user adds one), and never shown on the
//                            event card itself — only inside the edit popup.
//   }
// ============================================================================

const events = [
  // --- Weekday sample events -------------------------------------------
  {
    id: 1,
    title: "Product Management Class",
    day: "Mon",
    startTime: "09:00", // 9:00 AM
    endTime: "10:00", // 10:00 AM (1 hour long)
    category: "School",
  },
  {
    id: 2,
    title: "Team Meeting",
    day: "Tue",
    startTime: "11:00", // 11:00 AM
    endTime: "12:00", // 12:00 PM (1 hour long)
    category: "Work",
  },
  {
    id: 3,
    title: "Gym",
    day: "Wed",
    startTime: "17:00", // 5:00 PM
    endTime: "18:00", // 6:00 PM (1 hour long)
    category: "Personal",
  },
  {
    id: 4,
    title: "Study Session",
    day: "Thu",
    startTime: "14:00", // 2:00 PM
    endTime: "15:30", // 3:30 PM (1.5 hours long)
    category: "School",
  },
  {
    id: 5,
    title: "Dinner",
    day: "Fri",
    startTime: "18:00", // 6:00 PM
    endTime: "19:00", // 7:00 PM (1 hour long)
    category: "Personal",
  },
  {
    id: 6,
    title: "Study Group",
    day: "Tue",
    startTime: "15:00", // 3:00 PM
    endTime: "16:00", // 4:00 PM (1 hour long)
    // This is the SECOND event on Tuesday (alongside "Team Meeting"),
    // which is what makes Tuesday the "Busiest Day" in the sidebar summary.
    category: "School",
  },

  // --- Weekend sample events (visible in Weekend Mode / Full Calendar) --
  {
    id: 7,
    title: "Brunch with Friends",
    day: "Sat",
    startTime: "11:00", // 11:00 AM
    endTime: "12:30", // 12:30 PM (1.5 hours long)
    category: "Social",
  },
  {
    id: 8,
    title: "Movie Night",
    day: "Sun",
    startTime: "16:00", // 4:00 PM
    endTime: "18:00", // 6:00 PM (2 hours long)
    // Kept within 8 AM-6 PM on purpose: the week grid only draws hour rows
    // for that range, so an event starting later than 6 PM would render
    // below the visible grid instead of inside it.
    category: "Social",
  },
];

// Default export: GoogleCalendar.jsx imports this as `sampleEvents`.
export default events;

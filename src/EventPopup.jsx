// ============================================================================
// EventPopup.jsx
// ----------------------------------------------------------------------------
// This is the ONE form used for both creating a brand new event and editing
// an existing one. Which mode it's in depends entirely on whether the
// `existingEvent` prop is passed in:
//
//   - existingEvent is null/undefined  -> "create" mode: blank form,
//     pre-filled only with the day/time the user clicked, heading says
//     "New Event", no Delete button, main button says "Save".
//   - existingEvent is an event object -> "edit" mode: every field is
//     pre-filled from that event, heading says "Edit Event", a Delete
//     button appears, and the main button says "Update".
//
// GoogleCalendar.jsx is the ONLY place that renders this component. It
// decides which mode to use by either passing `existingEvent` (when an
// event card was clicked) or leaving it out (when an empty slot or the
// Create button was clicked). See GoogleCalendar.jsx's handleSlotClick,
// handleSaveEvent, handleUpdateEvent, and handleDeleteEvent for the other
// half of this flow.
// ============================================================================

import { useState } from "react";
import { Button, Input, Textarea } from "@chakra-ui/react";

// Quick Add templates: 4 shortcut buttons shown at the top of the form.
// Clicking one just fills in the Title and Category fields for you — it
// does NOT save anything by itself. The user can still change any field
// (including the ones a template filled in) before pressing Save/Update.
// This is just a convenience list, not real event data, so it lives here
// instead of in events.js.
const templates = [
  { label: "Class", title: "Class", category: "School" },
  { label: "Study", title: "Study Session", category: "School" },
  { label: "Gym", title: "Gym", category: "Personal" },
  { label: "Meeting", title: "Meeting", category: "Work" },
];

// Props this component receives from GoogleCalendar.jsx:
//   clickedSlot   -> { day, startTime } of the grid cell that was clicked.
//                    Only used in "create" mode, to pre-fill Day/Start time.
//   existingEvent -> the full event object being edited, or undefined/null
//                    when creating a new one. Its presence is what decides
//                    whether this component is in "create" or "edit" mode.
//   onSave        -> called with the new event's data when Save is clicked
//                    (create mode only).
//   onUpdate      -> called with the full updated event object when Update
//                    is clicked (edit mode only).
//   onDelete      -> called with the event's id when Delete is clicked
//                    (edit mode only).
//   onCancel      -> called when Cancel is clicked, in either mode. Closes
//                    the popup without saving/changing anything.
export default function EventPopup({
  clickedSlot,
  existingEvent,
  onSave,
  onUpdate,
  onDelete,
  onCancel,
}) {
  // `!!existingEvent` turns existingEvent into a plain true/false: true if
  // an event object was passed in (edit mode), false if it's null/undefined
  // (create mode). This one flag controls almost every difference in the
  // JSX below (heading text, button labels, whether Delete shows up).
  const isEditing = !!existingEvent;

  // ---- Form field state -----------------------------------------------
  // Each field below is its own piece of state, initialized differently
  // depending on isEditing:
  //   - In edit mode, we read the starting value straight off existingEvent.
  //   - In create mode, most fields start empty, except Day and Start time,
  //     which come from clickedSlot (the grid cell the user clicked), and
  //     Category, which defaults to "School" just to have something valid
  //     pre-selected in the dropdown.
  // Because these are separate useState calls, typing in one field (like
  // Title) only re-renders this component — it doesn't touch the parent's
  // eventList until Save/Update is actually clicked.

  const [title, setTitle] = useState(isEditing ? existingEvent.title : "");

  const [day, setDay] = useState(isEditing ? existingEvent.day : clickedSlot.day);

  const [startTime, setStartTime] = useState(
    isEditing ? existingEvent.startTime : clickedSlot.startTime
  );

  // endTime has no default in create mode — the user has to pick one.
  const [endTime, setEndTime] = useState(isEditing ? existingEvent.endTime : "");

  const [category, setCategory] = useState(
    isEditing ? existingEvent.category : "School"
  );

  // Notes: a fully optional free-text field. `existingEvent.notes || ""`
  // handles the case where an older/sample event doesn't have a `notes`
  // property at all (it would be `undefined`) — falling back to an empty
  // string so the Textarea always has a valid string value to display.
  const [notes, setNotes] = useState(
    isEditing ? existingEvent.notes || "" : ""
  );

  // Builds a plain event-data object out of the current form fields, then
  // decides what to do with it:
  //   - In edit mode: merge it into a COPY of the original existingEvent
  //     (so we keep its `id`, which eventData doesn't have) and call
  //     onUpdate with the result.
  //   - In create mode: hand the plain eventData straight to onSave —
  //     GoogleCalendar.jsx's handleSaveEvent is the one that actually
  //     generates a new id for it.
  // Either way, this function itself never touches eventList directly —
  // it just reports "here's what the user entered" up to the parent.
  function handleSave() {
    const eventData = { title, day, startTime, endTime, category, notes };
    if (isEditing) {
      // { ...existingEvent, ...eventData } means: start with everything
      // existingEvent already had (including its id), then overwrite with
      // whatever is in eventData (the possibly-edited fields).
      onUpdate({ ...existingEvent, ...eventData });
    } else {
      onSave(eventData);
    }
  }

  return (
    // Full-page dimmed backdrop. Clicking Cancel/Save/Update/Delete all
    // close the popup by having GoogleCalendar.jsx stop rendering this
    // component (isPopupOpen becomes false) — there's no click-outside-
    // to-close behavior here, only the explicit buttons do it.
    <div className="popup-overlay">
      <div className="popup-content">
        {/* Heading changes based on which mode we're in. */}
        <h3>{isEditing ? "Edit Event" : "New Event"}</h3>

        {/* Quick Add row: 4 small buttons that just pre-fill Title and
            Category. Nothing is saved here — the user still has to press
            Save/Update at the bottom for anything to actually happen. */}
        <div className="quick-add-row">
          {templates.map((template) => (
            <Button
              key={template.label}
              size="xs"
              variant="outline"
              onClick={() => {
                setTitle(template.title);
                setCategory(template.category);
              }}
            >
              {template.label}
            </Button>
          ))}
        </div>

        {/* Title field: plain text input, fully controlled by the `title`
            state above. `value` + `onChange` together make this a
            "controlled input" — React always knows exactly what's typed. */}
        <label className="popup-field">
          Title
          <Input
            size="sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        {/* Day field: a plain HTML <select> (not a Chakra component) with
            one hardcoded <option> per day of the week. Whatever the user
            picks becomes the event's `day`, which is what decides which
            column of the grid the event appears in. */}
        <label className="popup-field">
          Day
          <select value={day} onChange={(e) => setDay(e.target.value)}>
            <option>Mon</option>
            <option>Tue</option>
            <option>Wed</option>
            <option>Thu</option>
            <option>Fri</option>
            <option>Sat</option>
            <option>Sun</option>
          </select>
        </label>

        {/* Start/End time fields use the browser's native time picker
            (type="time"), which always gives back a 24-hour "HH:MM"
            string — exactly the format the rest of the app expects
            (see timeToHours/formatTime in GoogleCalendar.jsx). */}
        <label className="popup-field">
          Start time
          <Input
            size="sm"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </label>

        <label className="popup-field">
          End time
          <Input
            size="sm"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </label>

        {/* Category field: another plain <select>. This value decides the
            event's color everywhere in the app (see the .event-school /
            .event-personal / .event-work / .event-social CSS classes,
            which are built from this exact string, lowercased, in
            GoogleCalendar.jsx). */}
        <label className="popup-field">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option>School</option>
            <option>Personal</option>
            <option>Work</option>
            <option>Social</option>
          </select>
        </label>

        {/* Notes field: optional multi-line free text. Saved as part of
            the event object, but deliberately NEVER shown on the small
            event card in the grid — only here, inside the popup, so the
            calendar itself stays uncluttered. */}
        <label className="popup-field">
          Notes (optional)
          <Textarea
            size="sm"
            rows={2}
            placeholder="Bring presentation slides"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        {/* Action buttons. Delete only renders at all when isEditing is
            true — there's nothing to delete yet in create mode. */}
        <div className="popup-actions">
          {isEditing && (
            <Button
              size="sm"
              variant="outline"
              colorPalette="red"
              onClick={() => onDelete(existingEvent.id)}
            >
              Delete
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>
            {/* Same button does double duty: "Save" when creating,
                "Update" when editing — handleSave already knows which
                one to actually do based on isEditing. */}
            {isEditing ? "Update" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
